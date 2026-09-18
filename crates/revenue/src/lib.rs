use os_economy::EconomicMode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Opportunity {
    pub id: Uuid,
    pub name: String,
    pub hypothesis: String,
    pub expected_revenue_cents: u64,
    pub expected_cost_cents: u64,
    pub confidence_bps: u16,
}

impl Opportunity {
    pub fn expected_value_cents(&self) -> i64 {
        let gross = self.expected_revenue_cents.saturating_sub(self.expected_cost_cents) as i64;
        gross * self.confidence_bps as i64 / 10_000
    }

    pub fn is_actionable(&self, mode: EconomicMode, experiment_budget_cents: u64) -> bool {
        self.expected_value_cents() > 0
            && self.expected_cost_cents <= experiment_budget_cents
            && !matches!(mode, EconomicMode::Survival | EconomicMode::Emergency)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevenueStage {
    Discovered,
    Validating,
    Building,
    Selling,
    Delivering,
    Measuring,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueProject {
    pub opportunity: Opportunity,
    pub stage: RevenueStage,
    pub realized_revenue_cents: u64,
    pub realized_cost_cents: u64,
}

impl RevenueProject {
    pub fn realized_margin_cents(&self) -> i64 {
        self.realized_revenue_cents as i64 - self.realized_cost_cents as i64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_expected_value_is_actionable_only_outside_survival() {
        let opportunity = Opportunity {
            id: Uuid::new_v4(),
            name: "micro-saas".into(),
            hypothesis: "solve a narrow recurring workflow".into(),
            expected_revenue_cents: 10_000,
            expected_cost_cents: 1_000,
            confidence_bps: 8_000,
        };
        assert!(opportunity.is_actionable(EconomicMode::Operate, 2_000));
        assert!(!opportunity.is_actionable(EconomicMode::Survival, 2_000));
    }
}
