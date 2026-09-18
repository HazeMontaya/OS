use os_economy::{EconomicMode, SurvivalThresholds, TreasurySnapshot};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurvivalDecision {
    pub mode: EconomicMode,
    pub allow_experiments: bool,
    pub allow_new_workers: bool,
    pub allow_nonessential_compute: bool,
    pub max_experiment_cents: u64,
}

pub fn decide(snapshot: &TreasurySnapshot, thresholds: SurvivalThresholds) -> SurvivalDecision {
    let mode = thresholds.mode_for(snapshot.runway_days);
    match mode {
        EconomicMode::Explore => SurvivalDecision { mode, allow_experiments: true, allow_new_workers: true, allow_nonessential_compute: true, max_experiment_cents: snapshot.available_cents().max(0) as u64 / 20 },
        EconomicMode::Operate => SurvivalDecision { mode, allow_experiments: true, allow_new_workers: true, allow_nonessential_compute: true, max_experiment_cents: snapshot.available_cents().max(0) as u64 / 50 },
        EconomicMode::Optimize => SurvivalDecision { mode, allow_experiments: true, allow_new_workers: false, allow_nonessential_compute: false, max_experiment_cents: snapshot.available_cents().max(0) as u64 / 100 },
        EconomicMode::Survival => SurvivalDecision { mode, allow_experiments: false, allow_new_workers: false, allow_nonessential_compute: false, max_experiment_cents: 0 },
        EconomicMode::Emergency => SurvivalDecision { mode, allow_experiments: false, allow_new_workers: false, allow_nonessential_compute: false, max_experiment_cents: 0 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use os_economy::Treasury;

    #[test]
    fn survival_disables_growth() {
        let mut treasury = Treasury::new(800);
        treasury.set_burn_rate(100);
        let decision = decide(treasury.snapshot(), SurvivalThresholds::default());
        assert_eq!(decision.mode, EconomicMode::Survival);
        assert!(!decision.allow_new_workers);
    }
}
