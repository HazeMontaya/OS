use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Capability {
    FilesystemRead,
    FilesystemWrite,
    NetworkAccess,
    ModelInvoke,
    ToolExecute,
    ExternalMutation,
    SecretReferenceRead,
}

#[derive(Debug, Clone)]
pub struct PolicyRequest {
    pub actor: String,
    pub capability: Capability,
    pub resource: String,
    pub destructive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyDecision {
    Allow,
    Deny { reason: String },
}

#[derive(Debug, Default)]
pub struct PolicyEngine {
    grants: HashSet<Capability>,
}

impl PolicyEngine {
    pub fn developer_default() -> Self {
        Self {
            grants: HashSet::from([
                Capability::FilesystemRead,
                Capability::ModelInvoke,
                Capability::ToolExecute,
            ]),
        }
    }

    pub fn grant(&mut self, capability: Capability) {
        self.grants.insert(capability);
    }

    pub fn revoke(&mut self, capability: Capability) {
        self.grants.remove(&capability);
    }

    pub fn evaluate(&self, request: &PolicyRequest) -> PolicyDecision {
        if request.destructive && request.capability == Capability::ExternalMutation {
            return PolicyDecision::Deny {
                reason: "destructive external mutation requires an explicit elevated policy".into(),
            };
        }

        if self.grants.contains(&request.capability) {
            PolicyDecision::Allow
        } else {
            PolicyDecision::Deny {
                reason: format!(
                    "actor '{}' has no grant for {:?} on '{}'",
                    request.actor, request.capability, request.resource
                ),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Capability, PolicyDecision, PolicyEngine, PolicyRequest};

    #[test]
    fn destructive_external_mutation_is_denied_by_default() {
        let engine = PolicyEngine::developer_default();
        let decision = engine.evaluate(&PolicyRequest {
            actor: "agent:code".into(),
            capability: Capability::ExternalMutation,
            resource: "remote-repository".into(),
            destructive: true,
        });
        assert!(matches!(decision, PolicyDecision::Deny { .. }));
    }
}
