use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum SystemCapability {
    FilesystemRead,
    FilesystemWrite,
    FilesystemDelete,
    ProcessStart,
    ProcessKill,
    NetworkRequest,
    GitCommit,
    GitPush,
    SystemSettingsRead,
    SystemSettingsWrite,
    ClipboardRead,
    ClipboardWrite,
    ApplicationLaunch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CapabilityMode {
    Allow,
    Ask,
    Deny,
    Sandbox,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityProfile {
    pub name: String,
    pub rules: BTreeMap<SystemCapability, CapabilityMode>,
}

impl CapabilityProfile {
    pub fn safe_default() -> Self {
        use CapabilityMode::{Allow, Ask, Sandbox};
        use SystemCapability::*;
        Self {
            name: "safe-default".into(),
            rules: BTreeMap::from([
                (FilesystemRead, Allow),
                (FilesystemWrite, Ask),
                (FilesystemDelete, Ask),
                (ProcessStart, Sandbox),
                (ProcessKill, Ask),
                (NetworkRequest, Ask),
                (GitCommit, Ask),
                (GitPush, Ask),
                (SystemSettingsRead, Allow),
                (SystemSettingsWrite, Ask),
                (ClipboardRead, Ask),
                (ClipboardWrite, Ask),
                (ApplicationLaunch, Ask),
            ]),
        }
    }

    pub fn mode(&self, capability: SystemCapability) -> CapabilityMode {
        self.rules
            .get(&capability)
            .copied()
            .unwrap_or(CapabilityMode::Deny)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemDescriptor {
    pub platform: String,
    pub architecture: String,
    pub profile: CapabilityProfile,
}

impl SystemDescriptor {
    pub fn detect() -> Self {
        Self {
            platform: std::env::consts::OS.into(),
            architecture: std::env::consts::ARCH.into(),
            profile: CapabilityProfile::safe_default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destructive_actions_are_not_implicitly_allowed() {
        let profile = CapabilityProfile::safe_default();
        assert_ne!(
            profile.mode(SystemCapability::FilesystemDelete),
            CapabilityMode::Allow
        );
    }
}
