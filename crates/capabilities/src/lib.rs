use os_governance::DecisionClass;
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub struct Capability {
    pub name: String,
    pub class: DecisionClass,
    pub description: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Default)]
pub struct CapabilityRegistry {
    capabilities: BTreeMap<String, Capability>,
}

impl CapabilityRegistry {
    pub fn standard() -> Self {
        let mut r = Self::default();
        r.register(Capability { name: "read_file".into(), class: DecisionClass::ReadOnly, description: "Read a file inside the workspace".into(), enabled: true });
        r.register(Capability { name: "write_file".into(), class: DecisionClass::Reversible, description: "Write a file inside the workspace".into(), enabled: true });
        r.register(Capability { name: "run_command".into(), class: DecisionClass::External, description: "Run an explicitly allowlisted process".into(), enabled: true });
        r
    }

    pub fn register(&mut self, capability: Capability) {
        self.capabilities.insert(capability.name.clone(), capability);
    }

    pub fn get(&self, name: &str) -> Option<&Capability> {
        self.capabilities.get(name)
    }

    pub fn allows(&self, name: &str, class: DecisionClass) -> bool {
        self.get(name).map(|c| c.enabled && c.class == class).unwrap_or(false)
    }

    pub fn all(&self) -> impl Iterator<Item = &Capability> {
        self.capabilities.values()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn standard_registry_has_core_tools() {
        let r = CapabilityRegistry::standard();
        assert!(r.allows("read_file", DecisionClass::ReadOnly));
        assert!(!r.allows("run_command", DecisionClass::ReadOnly));
    }
}
