#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EconomicMode { Explore, Operate, Optimize, Survival, Emergency }

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LedgerKind { Revenue, Expense, Reserve, Release }

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EconomicEntry { pub kind: LedgerKind, pub cents: i64, pub memo: String }

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SurvivalThresholds {
    pub explore_days: u32,
    pub operate_days: u32,
    pub optimize_days: u32,
    pub emergency_days: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasurySnapshot {
    pub balance_cents: i64,
    pub reserved_cents: i64,
    pub revenue_cents: i64,
    pub expense_cents: i64,
    pub burn_rate_cents_per_day: i64,
    pub runway_days: Option<u32>,
    pub mode: EconomicMode,
}

#[derive(Clone, Debug, Default)]
pub struct Treasury {
    balance_cents: i64,
    reserved_cents: i64,
    revenue_cents: i64,
    expense_cents: i64,
    burn_rate_cents_per_day: i64,
    ledger: Vec<EconomicEntry>,
}

impl Treasury {
    pub fn new(balance_cents: i64) -> Self { Self { balance_cents: balance_cents.max(0), ..Self::default() } }

    pub fn record_revenue(&mut self, cents: i64, memo: impl Into<String>) {
        if cents <= 0 { return; }
        self.balance_cents += cents;
        self.revenue_cents += cents;
        self.ledger.push(EconomicEntry { kind: LedgerKind::Revenue, cents, memo: memo.into() });
    }

    pub fn record_expense(&mut self, cents: i64, memo: impl Into<String>) -> Result<(), &'static str> {
        if cents <= 0 { return Ok(()); }
        let spendable = self.balance_cents - self.reserved_cents;
        if cents > spendable { return Err("insufficient spendable treasury"); }
        self.balance_cents -= cents;
        self.expense_cents += cents;
        self.ledger.push(EconomicEntry { kind: LedgerKind::Expense, cents, memo: memo.into() });
        Ok(())
    }

    pub fn reserve(&mut self, cents: i64, memo: impl Into<String>) -> Result<(), &'static str> {
        if cents <= 0 { return Ok(()); }
        if cents > self.balance_cents - self.reserved_cents { return Err("insufficient spendable treasury"); }
        self.reserved_cents += cents;
        self.ledger.push(EconomicEntry { kind: LedgerKind::Reserve, cents, memo: memo.into() });
        Ok(())
    }

    pub fn release(&mut self, cents: i64, memo: impl Into<String>) {
        let amount = cents.max(0).min(self.reserved_cents);
        self.reserved_cents -= amount;
        self.ledger.push(EconomicEntry { kind: LedgerKind::Release, cents: amount, memo: memo.into() });
    }

    pub fn set_burn_rate(&mut self, cents_per_day: i64) { self.burn_rate_cents_per_day = cents_per_day.max(0); }

    pub fn snapshot(&self, t: SurvivalThresholds) -> TreasurySnapshot {
        let runway_days = if self.burn_rate_cents_per_day > 0 {
            Some(((self.balance_cents / self.burn_rate_cents_per_day).max(0)) as u32)
        } else { None };
        let days = runway_days.unwrap_or(u32::MAX);
        let mode = if days <= t.emergency_days { EconomicMode::Emergency }
            else if days <= t.optimize_days { EconomicMode::Survival }
            else if days <= t.operate_days { EconomicMode::Optimize }
            else if days <= t.explore_days { EconomicMode::Operate }
            else { EconomicMode::Explore };
        TreasurySnapshot { balance_cents: self.balance_cents, reserved_cents: self.reserved_cents, revenue_cents: self.revenue_cents, expense_cents: self.expense_cents, burn_rate_cents_per_day: self.burn_rate_cents_per_day, runway_days, mode }
    }

    pub fn ledger(&self) -> &[EconomicEntry] { &self.ledger }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn runway_changes_mode() {
        let mut t = Treasury::new(1_000);
        t.set_burn_rate(100);
        let s = t.snapshot(SurvivalThresholds { explore_days: 30, operate_days: 14, optimize_days: 7, emergency_days: 2 });
        assert_eq!(s.mode, EconomicMode::Emergency);
    }
}
