use std::collections::BTreeMap;

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum ServiceState {
    Healthy,
    Degraded,
    Failed,
    Recovering,
    Disabled,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ServiceStatus {
    pub id: String,
    pub state: ServiceState,
    pub failures: u32,
    pub restarts: u32,
    pub consecutive_successes: u32,
    pub next_restart_ms: u128,
    pub last_error: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RestartPolicy {
    pub max_restarts: u32,
    pub base_backoff_ms: u64,
    pub max_backoff_ms: u64,
    pub healthy_after_successes: u32,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        Self {
            max_restarts: 5,
            base_backoff_ms: 1_000,
            max_backoff_ms: 60_000,
            healthy_after_successes: 2,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct Supervisor {
    services: BTreeMap<String, ServiceStatus>,
    pub policy: RestartPolicy,
}

impl Supervisor {
    pub fn register(&mut self, id: impl Into<String>) -> Result<(), String> {
        let id=id.into();
        if id.trim().is_empty() { return Err("service id is required".into()); }
        self.services.entry(id.clone()).or_insert(ServiceStatus {
            id,
            state: ServiceState::Healthy,
            failures: 0,
            restarts: 0,
            consecutive_successes: 0,
            next_restart_ms: 0,
            last_error: None,
        });
        Ok(())
    }

    pub fn report_success(&mut self, id:&str) -> Result<(), String> {
        let service=self.services.get_mut(id).ok_or_else(|| format!("unknown service {id}"))?;
        service.consecutive_successes=service.consecutive_successes.saturating_add(1);
        if service.consecutive_successes >= self.policy.healthy_after_successes {
            service.state=ServiceState::Healthy;
            service.last_error=None;
        } else if service.state != ServiceState::Disabled {
            service.state=ServiceState::Degraded;
        }
        Ok(())
    }

    pub fn report_failure(&mut self, id:&str, now_ms:u128, error:impl Into<String>) -> Result<bool,String> {
        let service=self.services.get_mut(id).ok_or_else(|| format!("unknown service {id}"))?;
        service.failures=service.failures.saturating_add(1);
        service.consecutive_successes=0;
        service.last_error=Some(error.into());
        if service.restarts >= self.policy.max_restarts {
            service.state=ServiceState::Disabled;
            service.next_restart_ms=0;
            return Ok(false);
        }
        service.restarts=service.restarts.saturating_add(1);
        let exponent=service.restarts.saturating_sub(1).min(31);
        let backoff=self.policy.base_backoff_ms.saturating_mul(1u64.saturating_shl(exponent)).min(self.policy.max_backoff_ms);
        service.next_restart_ms=now_ms.saturating_add(backoff as u128);
        service.state=ServiceState::Recovering;
        Ok(true)
    }

    pub fn restart_due(&self, id:&str, now_ms:u128) -> Result<bool,String> {
        let service=self.services.get(id).ok_or_else(|| format!("unknown service {id}"))?;
        Ok(service.state==ServiceState::Recovering && now_ms>=service.next_restart_ms)
    }

    pub fn mark_restarted(&mut self, id:&str) -> Result<(),String> {
        let service=self.services.get_mut(id).ok_or_else(|| format!("unknown service {id}"))?;
        if service.state != ServiceState::Recovering { return Err("service is not awaiting recovery".into()); }
        service.state=ServiceState::Degraded;
        service.next_restart_ms=0;
        Ok(())
    }

    pub fn get(&self,id:&str)->Option<&ServiceStatus>{self.services.get(id)}
    pub fn all(&self)->impl Iterator<Item=&ServiceStatus>{self.services.values()}
    pub fn replace_all(&mut self, services:Vec<ServiceStatus>) { self.services.clear(); for service in services { self.services.insert(service.id.clone(),service); } }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn failure_schedules_exponential_recovery() {
        let mut s=Supervisor::default();
        s.register("runtime").unwrap();
        assert!(s.report_failure("runtime",1000,"boom").unwrap());
        assert_eq!(s.get("runtime").unwrap().next_restart_ms,2000);
        assert!(s.restart_due("runtime",2000).unwrap());
        s.mark_restarted("runtime").unwrap();
        s.report_failure("runtime",2000,"boom2").unwrap();
        assert_eq!(s.get("runtime").unwrap().next_restart_ms,4000);
    }

    #[test]
    fn repeated_success_recovers_health() {
        let mut s=Supervisor::default();
        s.register("runtime").unwrap();
        s.report_failure("runtime",0,"boom").unwrap();
        s.mark_restarted("runtime").unwrap();
        s.report_success("runtime").unwrap();
        assert_eq!(s.get("runtime").unwrap().state,ServiceState::Degraded);
        s.report_success("runtime").unwrap();
        assert_eq!(s.get("runtime").unwrap().state,ServiceState::Healthy);
    }

    #[test]
    fn restart_budget_disables_service() {
        let mut s=Supervisor::default();
        s.policy.max_restarts=1;
        s.register("runtime").unwrap();
        assert!(s.report_failure("runtime",0,"one").unwrap());
        assert!(!s.report_failure("runtime",1000,"two").unwrap());
        assert_eq!(s.get("runtime").unwrap().state,ServiceState::Disabled);
    }
}
