use os_economy::EconomicMode;
use os_system::{CapabilityMode, SystemCapability};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DecisionClass {
    ReadOnly,
    Reversible,
    External,
    Financial,
    Destructive,
    SelfModification,
    Replication,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPolicy {
    pub class: DecisionClass,
    pub mode: CapabilityMode,
    pub max_cents: Option<u64>,
    pub requires_owner_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernancePolicy {
    pub actions: BTreeMap<String, ActionPolicy>,
    pub immutable_capabilities: Vec<SystemCapability>,
}

impl Default for GovernancePolicy {
    fn default() -> Self {
        use CapabilityMode::{Allow, Ask, Sandbox};
        use DecisionClass::*;
        Self {
            actions: BTreeMap::from([
                ("research".into(), ActionPolicy { class: ReadOnly, mode: Allow, max_cents: None, requires_owner_approval: false }),
                ("write".into(), ActionPolicy { class: Reversible, mode: Ask, max_cents: None, requires_owner_approval: false }),
                ("external".into(), ActionPolicy { class: External, mode: Ask, max_cents: None, requires_owner_approval: true }),
                ("financial".into(), ActionPolicy { class: Financial, mode: Ask, max_cents: Some(5_000), requires_owner_approval: true }),
                ("self-modify".into(), ActionPolicy { class: SelfModification, mode: Sandbox, max_cents: None, requires_owner_approval: true }),
                ("replicate".into(), ActionPolicy { class: Replication, mode: Sandbox, max_cents: Some(1_000), requires_owner_approval: true }),
                ("destructive".into(), ActionPolicy { class: Destructive, mode: Ask, max_cents: None, requires_owner_approval: true }),
            ]),
            immutable_capabilities: vec![
                SystemCapability::FilesystemDelete,
                SystemCapability::ProcessKill,
                SystemCapability::SystemSettingsWrite,
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub action: String,
    pub economic_mode: EconomicMode,
    pub amount_cents: Option<u64>,
    pub approved_by_owner: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Ask,
    Deny,
    Sandbox,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GovernanceError {
    #[error("unknown action policy")]
    UnknownAction,
    #[error("action exceeds economic limit")]
    BudgetExceeded,
}

impl GovernancePolicy {
    pub fn decide(&self, request: &ActionRequest) -> Result<Decision, GovernanceError> {
        let policy = self.actions.get(&request.action).ok_or(GovernanceError::UnknownAction)?;
        if let (Some(amount), Some(max)) = (request.amount_cents, policy.max_cents) {
            if amount > max {
                return Err(GovernanceError::BudgetExceeded);
            }
        }
        if request.economic_mode == EconomicMode::Emergency && policy.class != DecisionClass::ReadOnly {
            return Ok(Decision::Deny);
        }
        if policy.requires_owner_approval && !request.approved_by_owner {
            return Ok(Decision::Ask);
        }
        Ok(match policy.mode {
            CapabilityMode::Allow => Decision::Allow,
            CapabilityMode::Ask => Decision::Ask,
            CapabilityMode::Deny => Decision::Deny,
            CapabilityMode::Sandbox => Decision::Sandbox,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emergency_mode_stops_external_actions() {
        let policy = GovernancePolicy::default();
        let result = policy.decide(&ActionRequest {
            action: "external".into(),
            economic_mode: EconomicMode::Emergency,
            amount_cents: None,
            approved_by_owner: true,
        }).expect("policy decision");
        assert_eq!(result, Decision::Deny);
    }
}
