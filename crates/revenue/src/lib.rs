use os_economy::EconomicMode;

#[derive(Clone, Debug)]
pub struct Opportunity {
    pub id: String, pub name: String, pub hypothesis: String,
    pub expected_revenue_cents: i64, pub expected_cost_cents: i64, pub confidence_bps: u16,
}
impl Opportunity {
    pub fn expected_value_cents(&self) -> i64 {
        (self.expected_revenue_cents.max(0) * self.confidence_bps as i64 / 10_000) - self.expected_cost_cents.max(0)
    }
    pub fn actionable(&self, mode: EconomicMode) -> bool { mode != EconomicMode::Emergency && self.expected_value_cents() > 0 }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RevenueStage { Discovered, Validating, Building, Selling, Delivering, Measuring, Stopped }

#[derive(Clone, Debug)]
pub struct RevenueProject { pub opportunity: Opportunity, pub stage: RevenueStage }
impl RevenueProject {
    pub fn new(opportunity: Opportunity) -> Self { Self { opportunity, stage: RevenueStage::Discovered } }

    pub fn advance(&mut self) -> Result<RevenueStage, &'static str> {
        let next = match self.stage {
            RevenueStage::Discovered => RevenueStage::Validating,
            RevenueStage::Validating => RevenueStage::Building,
            RevenueStage::Building => RevenueStage::Selling,
            RevenueStage::Selling => RevenueStage::Delivering,
            RevenueStage::Delivering => RevenueStage::Measuring,
            RevenueStage::Measuring | RevenueStage::Stopped => return Err("revenue project has reached a terminal stage"),
        };
        self.stage = next;
        Ok(next)
    }

    pub fn stop(&mut self) { self.stage = RevenueStage::Stopped; }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lifecycle_advances() {
        let o=Opportunity{id:"1".into(),name:"test".into(),hypothesis:"x".into(),expected_revenue_cents:1000,expected_cost_cents:100,confidence_bps:9000};
        let mut p=RevenueProject::new(o);
        assert_eq!(p.advance().unwrap(),RevenueStage::Validating);
    }
}