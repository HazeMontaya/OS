use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EconomicMode {
    Explore,
    Operate,
    Optimize,
    Survival,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasurySnapshot {
    pub balance_cents: i64,
    pub reserved_cents: i64,
    pub revenue_cents: i64,
    pub expense_cents: i64,
    pub burn_rate_cents_per_day: u64,
    pub runway_days: Option<u64>,
    pub mode: EconomicMode,
}

impl TreasurySnapshot {
    pub fn available_cents(&self) -> i64 {
        self.balance_cents.saturating_sub(self.reserved_cents)
    }

    pub fn recalculate_mode(&mut self, thresholds: &SurvivalThresholds) {
        self.mode = thresholds.mode_for(self.runway_days);
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SurvivalThresholds {
    pub explore_days: u64,
    pub operate_days: u64,
    pub optimize_days: u64,
    pub survival_days: u64,
}

impl Default for SurvivalThresholds {
    fn default() -> Self {
        Self {
            explore_days: 90,
            operate_days: 30,
            optimize_days: 7,
            survival_days: 1,
        }
    }
}

impl SurvivalThresholds {
    pub fn mode_for(&self, runway_days: Option<u64>) -> EconomicMode {
        match runway_days {
            None => EconomicMode::Explore,
            Some(days) if days > self.explore_days => EconomicMode::Explore,
            Some(days) if days > self.operate_days => EconomicMode::Operate,
            Some(days) if days > self.optimize_days => EconomicMode::Optimize,
            Some(days) if days > self.survival_days => EconomicMode::Survival,
            Some(_) => EconomicMode::Emergency,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LedgerKind {
    Revenue,
    Expense,
    Reserve,
    Release,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomicEntry {
    pub id: Uuid,
    pub kind: LedgerKind,
    pub amount_cents: u64,
    pub reference: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum EconomyError {
    #[error("amount must be greater than zero")]
    ZeroAmount,
    #[error("insufficient available funds")]
    InsufficientFunds,
    #[error("invalid ledger operation")]
    InvalidOperation,
}

#[derive(Debug, Default)]
pub struct Treasury {
    snapshot: TreasurySnapshot,
    entries: Vec<EconomicEntry>,
}

impl Treasury {
    pub fn new(balance_cents: i64) -> Self {
        let mut treasury = Self {
            snapshot: TreasurySnapshot {
                balance_cents,
                reserved_cents: 0,
                revenue_cents: 0,
                expense_cents: 0,
                burn_rate_cents_per_day: 0,
                runway_days: None,
                mode: EconomicMode::Explore,
            },
            entries: Vec::new(),
        };
        treasury.recalculate();
        treasury
    }

    pub fn snapshot(&self) -> &TreasurySnapshot {
        &self.snapshot
    }

    pub fn entries(&self) -> &[EconomicEntry] {
        &self.entries
    }

    pub fn record_revenue(&mut self, amount_cents: u64, reference: impl Into<String>) -> Result<(), EconomyError> {
        self.ensure_amount(amount_cents)?;
        self.snapshot.balance_cents = self.snapshot.balance_cents.saturating_add(amount_cents as i64);
        self.snapshot.revenue_cents = self.snapshot.revenue_cents.saturating_add(amount_cents as i64);
        self.entries.push(EconomicEntry { id: Uuid::new_v4(), kind: LedgerKind::Revenue, amount_cents, reference: reference.into() });
        self.recalculate();
        Ok(())
    }

    pub fn record_expense(&mut self, amount_cents: u64, reference: impl Into<String>) -> Result<(), EconomyError> {
        self.ensure_amount(amount_cents)?;
        if self.snapshot.available_cents() < amount_cents as i64 {
            return Err(EconomyError::InsufficientFunds);
        }
        self.snapshot.balance_cents -= amount_cents as i64;
        self.snapshot.expense_cents = self.snapshot.expense_cents.saturating_add(amount_cents as i64);
        self.entries.push(EconomicEntry { id: Uuid::new_v4(), kind: LedgerKind::Expense, amount_cents, reference: reference.into() });
        self.recalculate();
        Ok(())
    }

    pub fn reserve(&mut self, amount_cents: u64, reference: impl Into<String>) -> Result<(), EconomyError> {
        self.ensure_amount(amount_cents)?;
        if self.snapshot.available_cents() < amount_cents as i64 {
            return Err(EconomyError::InsufficientFunds);
        }
        self.snapshot.reserved_cents += amount_cents as i64;
        self.entries.push(EconomicEntry { id: Uuid::new_v4(), kind: LedgerKind::Reserve, amount_cents, reference: reference.into() });
        Ok(())
    }

    pub fn release(&mut self, amount_cents: u64, reference: impl Into<String>) -> Result<(), EconomyError> {
        self.ensure_amount(amount_cents)?;
        if self.snapshot.reserved_cents < amount_cents as i64 {
            return Err(EconomyError::InvalidOperation);
        }
        self.snapshot.reserved_cents -= amount_cents as i64;
        self.entries.push(EconomicEntry { id: Uuid::new_v4(), kind: LedgerKind::Release, amount_cents, reference: reference.into() });
        Ok(())
    }

    pub fn set_burn_rate(&mut self, cents_per_day: u64) {
        self.snapshot.burn_rate_cents_per_day = cents_per_day;
        self.recalculate();
    }

    fn recalculate(&mut self) {
        self.snapshot.runway_days = if self.snapshot.burn_rate_cents_per_day == 0 {
            None
        } else {
            Some((self.snapshot.available_cents().max(0) as u64) / self.snapshot.burn_rate_cents_per_day)
        };
        self.snapshot.recalculate_mode(&SurvivalThresholds::default());
    }

    fn ensure_amount(&self, amount_cents: u64) -> Result<(), EconomyError> {
        if amount_cents == 0 { Err(EconomyError::ZeroAmount) } else { Ok(()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runway_drives_survival_mode() {
        let mut treasury = Treasury::new(800);
        treasury.set_burn_rate(100);
        assert_eq!(treasury.snapshot().runway_days, Some(8));
        assert_eq!(treasury.snapshot().mode, EconomicMode::Survival);
    }

    #[test]
    fn reserved_money_cannot_be_spent() {
        let mut treasury = Treasury::new(1_000);
        treasury.reserve(800, "compute");
        assert_eq!(treasury.record_expense(300, "api"), Err(EconomyError::InsufficientFunds));
    }
}
