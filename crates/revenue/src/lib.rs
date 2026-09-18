use os_economy::EconomicMode;

#[derive(Clone, Debug)]
pub struct Opportunity {
    pub id: String,
    pub name: String,
    pub hypothesis: String,
    pub expected_revenue_cents: i64,
    pub expected_cost_cents: i64,
    pub confidence_bps: u16,
}

impl Opportunity {
    pub fn expected_value_cents(&self) -> i64 {
        (self.expected_revenue_cents.max(0) * self.confidence_bps as i64 / 10_000) - self.expected_cost_cents.max(0)
    }

    pub fn actionable(&self, mode: EconomicMode) -> bool {
        mode != EconomicMode::Emergency && self.expected_value_cents() > 0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RevenueStage { Discovered, Validating, Building, Selling, Delivering, Measuring, Stopped }

#[derive(Clone, Debug)]
pub struct RevenueProject {
    pub opportunity: Opportunity,
    pub stage: RevenueStage,
}

impl RevenueProject {
    pub fn new(opportunity: Opportunity) -> Self { Self { opportunity, stage: RevenueStage::Discovered } }
}
