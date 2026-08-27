use thiserror::Error;

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
    #[error("embedding vector must not be empty")]
    EmptyVector,
    #[error("vector dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },
    #[error("semantic index unavailable (stub)")]
    Unavailable,
}

pub type Result<T> = std::result::Result<T, SemanticIndexError>;

#[derive(Clone)]
pub struct SemanticIndex;

impl SemanticIndex {
    pub async fn open(_uri: impl AsRef<str>) -> Result<Self> {
        Ok(Self)
    }

    pub async fn upsert(&self, _document: SemanticDocument) -> Result<()> {
        Ok(())
    }

    pub async fn search(&self, _vector: &[f32], _limit: usize) -> Result<Vec<SemanticHit>> {
        Ok(Vec::new())
    }

    pub async fn count(&self) -> Result<usize> {
        Ok(0)
    }
}
