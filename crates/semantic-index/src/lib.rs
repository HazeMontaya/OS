use std::sync::Arc;

use arrow_array::{
    Array, FixedSizeListArray, Float32Array, Float64Array, Int64Array, RecordBatch,
    RecordBatchIterator, StringArray,
    types::Float32Type,
};
use arrow_schema::{DataType, Field, Schema, SchemaRef};
use futures::TryStreamExt;
use lancedb::{
    Connection, Table,
    query::{ExecutableQuery, QueryBase},
};
use thiserror::Error;

const DEFAULT_TABLE: &str = "memory_vectors";

#[derive(Debug, Clone)]
pub struct SemanticDocument {
    pub memory_id: String,
    pub kind: String,
    pub embedding_model: String,
    pub updated_at_ms: i64,
    pub vector: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SemanticHit {
    pub memory_id: String,
    pub kind: String,
    pub distance: f32,
}

#[derive(Debug, Error)]
pub enum SemanticIndexError {
    #[error("LanceDB error: {0}")]
    Lance(#[from] lancedb::Error),
    #[error("Arrow error: {0}")]
    Arrow(#[from] arrow_schema::ArrowError),
    #[error("embedding vector must not be empty")]
    EmptyVector,
    #[error("vector dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },
    #[error("semantic query result is missing column '{0}'")]
    MissingColumn(&'static str),
    #[error("semantic query column '{0}' has an unexpected Arrow type")]
    InvalidColumnType(&'static str),
}

pub type Result<T> = std::result::Result<T, SemanticIndexError>;

#[derive(Clone)]
pub struct SemanticIndex {
    db: Connection,
    table_name: String,
}

impl SemanticIndex {
    pub async fn open(uri: impl AsRef<str>) -> Result<Self> {
        let db = lancedb::connect(uri.as_ref()).execute().await?;
        Ok(Self {
            db,
            table_name: DEFAULT_TABLE.into(),
        })
    }

    pub async fn upsert(&self, document: SemanticDocument) -> Result<()> {
        if document.vector.is_empty() {
            return Err(SemanticIndexError::EmptyVector);
        }

        let dimension = document.vector.len();
        let table = self.ensure_table(dimension).await?;
        self.validate_dimension(&table, dimension).await?;
        let schema = table.schema().await?;
        let batch = document_batch(schema.clone(), document, dimension)?;
        let reader = RecordBatchIterator::new(vec![Ok(batch)], schema);

        let mut merge = table.merge_insert(&["memory_id"]);
        merge
            .when_matched_update_all(None)
            .when_not_matched_insert_all();
        merge.execute(Box::new(reader)).await?;
        Ok(())
    }

    pub async fn search(&self, vector: &[f32], limit: usize) -> Result<Vec<SemanticHit>> {
        if vector.is_empty() || limit == 0 {
            return Ok(Vec::new());
        }
        let Some(table) = self.open_table_if_present().await? else {
            return Ok(Vec::new());
        };
        self.validate_dimension(&table, vector.len()).await?;

        let stream = table
            .query()
            .nearest_to(vector)?
            .limit(limit)
            .execute()
            .await?;
        let batches: Vec<RecordBatch> = stream.try_collect().await?;
        let mut hits = Vec::new();

        for batch in batches {
            let ids = batch
                .column_by_name("memory_id")
                .ok_or(SemanticIndexError::MissingColumn("memory_id"))?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(SemanticIndexError::InvalidColumnType("memory_id"))?;
            let kinds = batch
                .column_by_name("kind")
                .ok_or(SemanticIndexError::MissingColumn("kind"))?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(SemanticIndexError::InvalidColumnType("kind"))?;
            let distances = batch
                .column_by_name("_distance")
                .ok_or(SemanticIndexError::MissingColumn("_distance"))?;

            for row in 0..batch.num_rows() {
                if ids.is_null(row) || kinds.is_null(row) || distances.is_null(row) {
                    continue;
                }
                hits.push(SemanticHit {
                    memory_id: ids.value(row).to_string(),
                    kind: kinds.value(row).to_string(),
                    distance: distance_at(distances.as_ref(), row)?,
                });
            }
        }

        hits.sort_by(|left, right| left.distance.total_cmp(&right.distance));
        hits.truncate(limit);
        Ok(hits)
    }

    pub async fn count(&self) -> Result<usize> {
        let Some(table) = self.open_table_if_present().await? else {
            return Ok(0);
        };
        Ok(table.count_rows(None).await?)
    }

    async fn ensure_table(&self, dimension: usize) -> Result<Table> {
        if let Some(table) = self.open_table_if_present().await? {
            return Ok(table);
        }

        Ok(self
            .db
            .create_empty_table(&self.table_name, vector_schema(dimension))
            .execute()
            .await?)
    }

    async fn open_table_if_present(&self) -> Result<Option<Table>> {
        let tables = self.db.table_names().execute().await?;
        if tables.iter().any(|name| name == &self.table_name) {
            Ok(Some(self.db.open_table(&self.table_name).execute().await?))
        } else {
            Ok(None)
        }
    }

    async fn validate_dimension(&self, table: &Table, actual: usize) -> Result<()> {
        let schema = table.schema().await?;
        let field = schema.field_with_name("vector")?;
        let expected = match field.data_type() {
            DataType::FixedSizeList(_, dimension) => *dimension as usize,
            _ => return Err(SemanticIndexError::InvalidColumnType("vector")),
        };
        if expected != actual {
            return Err(SemanticIndexError::DimensionMismatch { expected, actual });
        }
        Ok(())
    }
}

fn vector_schema(dimension: usize) -> SchemaRef {
    Arc::new(Schema::new(vec![
        Field::new("memory_id", DataType::Utf8, false),
        Field::new("kind", DataType::Utf8, false),
        Field::new("embedding_model", DataType::Utf8, false),
        Field::new("updated_at_ms", DataType::Int64, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                dimension as i32,
            ),
            false,
        ),
    ]))
}

fn document_batch(
    schema: SchemaRef,
    document: SemanticDocument,
    dimension: usize,
) -> Result<RecordBatch> {
    let vector = FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(
        [Some(document.vector.into_iter().map(Some).collect::<Vec<_>>())],
        dimension as i32,
    );

    Ok(RecordBatch::try_new(
        schema,
        vec![
            Arc::new(StringArray::from(vec![document.memory_id])),
            Arc::new(StringArray::from(vec![document.kind])),
            Arc::new(StringArray::from(vec![document.embedding_model])),
            Arc::new(Int64Array::from(vec![document.updated_at_ms])),
            Arc::new(vector),
        ],
    )?)
}

fn distance_at(array: &dyn Array, row: usize) -> Result<f32> {
    if let Some(values) = array.as_any().downcast_ref::<Float32Array>() {
        return Ok(values.value(row));
    }
    if let Some(values) = array.as_any().downcast_ref::<Float64Array>() {
        return Ok(values.value(row) as f32);
    }
    Err(SemanticIndexError::InvalidColumnType("_distance"))
}

#[cfg(test)]
mod tests {
    use super::{SemanticDocument, SemanticIndex, SemanticIndexError};

    #[tokio::test]
    async fn upserts_and_searches_memory_vectors() {
        let tempdir = tempfile::tempdir().expect("tempdir");
        let index = SemanticIndex::open(tempdir.path().to_string_lossy())
            .await
            .expect("open semantic index");

        for (id, vector) in [
            ("memory-a", vec![1.0, 0.0, 0.0]),
            ("memory-b", vec![0.0, 1.0, 0.0]),
        ] {
            index
                .upsert(SemanticDocument {
                    memory_id: id.into(),
                    kind: "episodic_memory".into(),
                    embedding_model: "test".into(),
                    updated_at_ms: 1,
                    vector,
                })
                .await
                .expect("upsert vector");
        }

        index
            .upsert(SemanticDocument {
                memory_id: "memory-a".into(),
                kind: "stable_memory".into(),
                embedding_model: "test-v2".into(),
                updated_at_ms: 2,
                vector: vec![0.95, 0.05, 0.0],
            })
            .await
            .expect("update vector");

        assert_eq!(index.count().await.expect("count"), 2);
        let hits = index
            .search(&[1.0, 0.0, 0.0], 2)
            .await
            .expect("vector search");
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].memory_id, "memory-a");
        assert_eq!(hits[0].kind, "stable_memory");
    }

    #[tokio::test]
    async fn rejects_dimension_changes_in_same_index() {
        let tempdir = tempfile::tempdir().expect("tempdir");
        let index = SemanticIndex::open(tempdir.path().to_string_lossy())
            .await
            .expect("open semantic index");
        index
            .upsert(SemanticDocument {
                memory_id: "memory-a".into(),
                kind: "episodic_memory".into(),
                embedding_model: "test".into(),
                updated_at_ms: 1,
                vector: vec![1.0, 0.0, 0.0],
            })
            .await
            .expect("upsert vector");

        let error = index
            .search(&[1.0, 0.0], 1)
            .await
            .expect_err("dimension mismatch expected");
        assert!(matches!(
            error,
            SemanticIndexError::DimensionMismatch {
                expected: 3,
                actual: 2
            }
        ));
    }
}
