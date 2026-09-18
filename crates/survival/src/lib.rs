use os_economy::EconomicMode;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SurvivalDecision {
    pub allow_experiments: bool,
    pub allow_new_workers: bool,
    pub allow_nonessential_compute: bool,
    pub max_experiment_cents: i64,
}

pub fn replan(mode: EconomicMode) -> SurvivalDecision {
    match mode {
        EconomicMode::Explore => SurvivalDecision { allow_experiments: true, allow_new_workers: true, allow_nonessential_compute: true, max_experiment_cents: 2_500 },
        EconomicMode::Operate => SurvivalDecision { allow_experiments: true, allow_new_workers: true, allow_nonessential_compute: true, max_experiment_cents: 1_000 },
        EconomicMode::Optimize => SurvivalDecision { allow_experiments: true, allow_new_workers: false, allow_nonessential_compute: false, max_experiment_cents: 250 },
        EconomicMode::Survival | EconomicMode::Emergency => SurvivalDecision { allow_experiments: false, allow_new_workers: false, allow_nonessential_compute: false, max_experiment_cents: 0 },
    }
}
