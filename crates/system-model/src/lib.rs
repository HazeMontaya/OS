use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, serde::Serialize, serde::Deserialize)]
pub enum EntityKind {
    Workspace,
    Project,
    Service,
    Agent,
    Tool,
    Credential,
    Workflow,
    Deployment,
    Revenue,
    Document,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, serde::Serialize, serde::Deserialize)]
pub enum VerificationStatus {
    Unverified,
    Observed,
    Verified,
    Stale,
}

#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Evidence {
    pub id: String,
    pub source: String,
    pub producer: String,
    pub observed_at_ms: u128,
    pub verification: VerificationStatus,
    pub excerpt: String,
}

#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SystemEntity {
    pub id: String,
    pub kind: EntityKind,
    pub label: String,
    pub properties: BTreeMap<String, String>,
    pub evidence_ids: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SystemRelation {
    pub from: String,
    pub relation: String,
    pub to: String,
    pub evidence_ids: Vec<String>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct SystemModel {
    pub entities: BTreeMap<String, SystemEntity>,
    pub relations: Vec<SystemRelation>,
    pub evidence: BTreeMap<String, Evidence>,
}

impl SystemModel {
    pub fn upsert_entity(
        &mut self,
        id: impl Into<String>,
        kind: EntityKind,
        label: impl Into<String>,
    ) -> Result<(), String> {
        let id = id.into();
        let label = label.into();
        if id.trim().is_empty() || label.trim().is_empty() {
            return Err("system entity id and label are required".into());
        }
        let entity = self.entities.entry(id.clone()).or_insert_with(|| SystemEntity {
            id: id.clone(),
            kind,
            label: label.clone(),
            properties: BTreeMap::new(),
            evidence_ids: Vec::new(),
        });
        entity.kind = kind;
        entity.label = label;
        Ok(())
    }

    pub fn set_property(&mut self, entity_id: &str, key: impl Into<String>, value: impl Into<String>) -> Result<(), String> {
        let entity = self.entities.get_mut(entity_id).ok_or_else(|| "unknown system entity".to_string())?;
        entity.properties.insert(key.into(), value.into());
        Ok(())
    }

    pub fn link(&mut self, from: &str, relation: impl Into<String>, to: &str) -> Result<(), String> {
        if !self.entities.contains_key(from) || !self.entities.contains_key(to) {
            return Err("system relation references unknown entity".into());
        }
        let relation = relation.into();
        if relation.trim().is_empty() {
            return Err("relation is required".into());
        }
        if self.relations.iter().any(|r| r.from == from && r.relation == relation && r.to == to) {
            return Ok(());
        }
        self.relations.push(SystemRelation {
            from: from.into(),
            relation,
            to: to.into(),
            evidence_ids: Vec::new(),
        });
        Ok(())
    }

    pub fn add_evidence(&mut self, evidence: Evidence) -> Result<(), String> {
        if evidence.id.trim().is_empty() || evidence.source.trim().is_empty() {
            return Err("evidence id and source are required".into());
        }
        self.evidence.insert(evidence.id.clone(), evidence);
        Ok(())
    }

    pub fn attach_entity_evidence(&mut self, entity_id: &str, evidence_id: &str) -> Result<(), String> {
        if !self.evidence.contains_key(evidence_id) {
            return Err("unknown evidence".into());
        }
        let entity = self.entities.get_mut(entity_id).ok_or_else(|| "unknown system entity".to_string())?;
        if !entity.evidence_ids.contains(&evidence_id.to_string()) {
            entity.evidence_ids.push(evidence_id.into());
        }
        Ok(())
    }

    pub fn attach_relation_evidence(&mut self, from: &str, relation: &str, to: &str, evidence_id: &str) -> Result<(), String> {
        if !self.evidence.contains_key(evidence_id) {
            return Err("unknown evidence".into());
        }
        let edge = self.relations.iter_mut()
            .find(|r| r.from == from && r.relation == relation && r.to == to)
            .ok_or_else(|| "unknown system relation".to_string())?;
        if !edge.evidence_ids.contains(&evidence_id.to_string()) {
            edge.evidence_ids.push(evidence_id.into());
        }
        Ok(())
    }

    pub fn save_json(&self, path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
        let path=path.as_ref();
        if let Some(parent)=path.parent() { std::fs::create_dir_all(parent)?; }
        let tmp=path.with_extension("tmp");
        let data=serde_json::to_vec_pretty(self).map_err(|e|std::io::Error::new(std::io::ErrorKind::InvalidData,e.to_string()))?;
        std::fs::write(&tmp,data)?;
        let file=std::fs::OpenOptions::new().read(true).open(&tmp)?;
        file.sync_all()?;
        std::fs::rename(tmp,path)?;
        Ok(())
    }

    pub fn load_json(path: impl AsRef<std::path::Path>) -> std::io::Result<Self> {
        let path=path.as_ref();
        let data=match std::fs::read(path) {
            Ok(data)=>data,
            Err(error) if error.kind()==std::io::ErrorKind::NotFound=>return Ok(Self::default()),
            Err(error)=>return Err(error),
        };
        serde_json::from_slice(&data).map_err(|e|std::io::Error::new(std::io::ErrorKind::InvalidData,e.to_string()))
    }

    pub fn explain(&self, entity_id: &str) -> Option<SystemExplanation> {
        let entity = self.entities.get(entity_id)?;
        let relations = self.relations.iter().filter(|r| r.from == entity_id || r.to == entity_id).cloned().collect();
        let evidence = entity.evidence_ids.iter().filter_map(|id| self.evidence.get(id)).cloned().collect();
        Some(SystemExplanation { entity: entity.clone(), relations, evidence })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SystemExplanation {
    pub entity: SystemEntity,
    pub relations: Vec<SystemRelation>,
    pub evidence: Vec<Evidence>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_has_evidence_backed_edges() {
        let mut m = SystemModel::default();
        m.upsert_entity("agent-01", EntityKind::Agent, "Governor").unwrap();
        m.upsert_entity("tool-read", EntityKind::Tool, "Read File").unwrap();
        m.link("agent-01", "can_use", "tool-read").unwrap();
        m.add_evidence(Evidence {
            id: "e1".into(),
            source: "capability-registry".into(),
            producer: "runtime".into(),
            observed_at_ms: 1,
            verification: VerificationStatus::Verified,
            excerpt: "read_file registered".into(),
        }).unwrap();
        m.attach_relation_evidence("agent-01", "can_use", "tool-read", "e1").unwrap();
        let x = m.explain("agent-01").unwrap();
        assert_eq!(x.evidence.len(), 0);
        assert_eq!(x.relations[0].evidence_ids, vec!["e1"]);
    }

    #[test]
    fn persistence_roundtrip() {
        let path=std::env::temp_dir().join(format!("haze-system-{}.json",std::process::id()));
        let mut m=SystemModel::default();
        m.upsert_entity("a",EntityKind::Agent,"A").unwrap();
        m.save_json(&path).unwrap();
        let loaded=SystemModel::load_json(&path).unwrap();
        assert_eq!(loaded.entities.get("a").unwrap().label,"A");
        let _=std::fs::remove_file(path);
    }

    #[test]
    fn duplicate_links_are_idempotent() {
        let mut m = SystemModel::default();
        m.upsert_entity("a", EntityKind::Agent, "A").unwrap();
        m.upsert_entity("b", EntityKind::Tool, "B").unwrap();
        m.link("a", "uses", "b").unwrap();
        m.link("a", "uses", "b").unwrap();
        assert_eq!(m.relations.len(), 1);
    }
}
