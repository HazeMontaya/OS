use os_model_gateway::ModelRegistry;
use os_policy::{Capability, PolicyDecision, PolicyEngine, PolicyRequest};

#[derive(Debug, Clone)]
pub struct TaskIntent {
    pub actor: String,
    pub capability: String,
    pub local_only: bool,
    pub resource: String,
}

#[derive(Debug, Clone)]
pub struct ExecutionPlan {
    pub model_id: String,
    pub capability: String,
    pub resource: String,
}

#[derive(Debug, Clone)]
pub enum PlanError {
    PolicyDenied(String),
    NoCompatibleModel,
}

pub struct Orchestrator<'a> {
    policy: &'a PolicyEngine,
    models: &'a ModelRegistry,
}

impl<'a> Orchestrator<'a> {
    pub fn new(policy: &'a PolicyEngine, models: &'a ModelRegistry) -> Self {
        Self { policy, models }
    }

    pub fn plan(&self, intent: &TaskIntent) -> Result<ExecutionPlan, PlanError> {
        let decision = self.policy.evaluate(&PolicyRequest {
            actor: intent.actor.clone(),
            capability: Capability::ModelInvoke,
            resource: intent.resource.clone(),
            destructive: false,
        });

        if let PolicyDecision::Deny { reason } = decision {
            return Err(PlanError::PolicyDenied(reason));
        }

        let model = self
            .models
            .select(&intent.capability, intent.local_only)
            .ok_or(PlanError::NoCompatibleModel)?;

        Ok(ExecutionPlan {
            model_id: model.id.clone(),
            capability: intent.capability.clone(),
            resource: intent.resource.clone(),
        })
    }
}
