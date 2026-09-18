#[derive(Clone, Copy, Debug, Eq, PartialEq)] pub enum EconomicMode{Explore,Operate,Optimize,Survival,Emergency}
#[derive(Clone, Copy, Debug, Eq, PartialEq)] pub enum LedgerKind{Revenue,Expense,Reserve,Release}
#[derive(Clone, Debug, Eq, PartialEq)] pub struct EconomicEntry{pub kind:LedgerKind,pub cents:i64,pub memo:String}
#[derive(Clone, Copy, Debug, Eq, PartialEq)] pub struct SurvivalThresholds{pub explore_days:u32,pub operate_days:u32,pub optimize_days:u32,pub emergency_days:u32}
#[derive(Clone, Debug, Eq, PartialEq)] pub struct TreasurySnapshot{pub balance_cents:i64,pub reserved_cents:i64,pub revenue_cents:i64,pub expense_cents:i64,pub burn_rate_cents_per_day:i64,pub runway_days:Option<u32>,pub mode:EconomicMode}
#[derive(Clone, Debug, Default)] pub struct Treasury{balance_cents:i64,reserved_cents:i64,revenue_cents:i64,expense_cents:i64,burn_rate_cents_per_day:i64,ledger:Vec<EconomicEntry>}
impl Treasury{
 pub fn new(b:i64)->Self{Self{balance_cents:b.max(0),..Self::default()}}
 pub fn spendable_cents(&self)->i64{(self.balance_cents-self.reserved_cents).max(0)}
 pub fn record_revenue(&mut self,c:i64,m:impl Into<String>){if c>0{self.balance_cents+=c;self.revenue_cents+=c;self.ledger.push(EconomicEntry{kind:LedgerKind::Revenue,cents:c,memo:m.into()});}}
 pub fn record_expense(&mut self,c:i64,m:impl Into<String>)->Result<(),&'static str>{if c<=0{return Ok(());}if c>self.spendable_cents(){return Err("insufficient spendable treasury");}self.balance_cents-=c;self.expense_cents+=c;self.ledger.push(EconomicEntry{kind:LedgerKind::Expense,cents:c,memo:m.into()});Ok(())}
 pub fn reserve(&mut self,c:i64,m:impl Into<String>)->Result<(),&'static str>{if c<=0{return Ok(());}if c>self.spendable_cents(){return Err("insufficient spendable treasury");}self.reserved_cents+=c;self.ledger.push(EconomicEntry{kind:LedgerKind::Reserve,cents:c,memo:m.into()});Ok(())}
 pub fn release(&mut self,c:i64,m:impl Into<String>){let a=c.max(0).min(self.reserved_cents);self.reserved_cents-=a;self.ledger.push(EconomicEntry{kind:LedgerKind::Release,cents:a,memo:m.into()});}
 pub fn set_burn_rate(&mut self,c:i64){self.burn_rate_cents_per_day=c.max(0)}
 pub fn snapshot(&self,t:SurvivalThresholds)->TreasurySnapshot{let r=if self.burn_rate_cents_per_day>0{Some((self.spendable_cents()/self.burn_rate_cents_per_day)as u32)}else{None};let d=r.unwrap_or(u32::MAX);let m=if d<=t.emergency_days{EconomicMode::Emergency}else if d<=t.optimize_days{EconomicMode::Survival}else if d<=t.operate_days{EconomicMode::Optimize}else if d<=t.explore_days{EconomicMode::Operate}else{EconomicMode::Explore};TreasurySnapshot{balance_cents:self.balance_cents,reserved_cents:self.reserved_cents,revenue_cents:self.revenue_cents,expense_cents:self.expense_cents,burn_rate_cents_per_day:self.burn_rate_cents_per_day,runway_days:r,mode:m}}
 pub fn ledger(&self)->&[EconomicEntry]{&self.ledger}
}
#[cfg(test)]mod tests{use super::*;#[test]fn emergency(){let mut t=Treasury::new(200);t.set_burn_rate(100);assert_eq!(t.snapshot(SurvivalThresholds{explore_days:30,operate_days:14,optimize_days:7,emergency_days:2}).mode,EconomicMode::Emergency)}#[test]fn reserve(){let mut t=Treasury::new(1000);t.reserve(800,"r").unwrap();assert!(t.record_expense(300,"x").is_err());}}