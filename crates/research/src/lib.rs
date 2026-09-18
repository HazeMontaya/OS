use std::collections::HashSet;

#[derive(Clone, Debug)]
pub struct ResearchPolicy {
    pub allowed_hosts: HashSet<String>,
    pub max_bytes: usize,
    pub timeout_seconds: u64,
}
impl Default for ResearchPolicy {
    fn default() -> Self {
        Self { allowed_hosts: HashSet::new(), max_bytes: 512 * 1024, timeout_seconds: 15 }
    }
}
#[derive(Clone, Debug)]
pub struct ResearchResult { pub url: String, pub status: u16, pub body: String }

pub fn fetch(url: &str, policy: &ResearchPolicy) -> Result<ResearchResult, String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().ok_or("URL has no host")?.to_ascii_lowercase();
    if !policy.allowed_hosts.contains(&host) { return Err(format!("host not allowlisted: {host}")); }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(policy.timeout_seconds))
        .build().map_err(|e| e.to_string())?;
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(policy.max_bytes)]).into_owned();
    Ok(ResearchResult { url: url.into(), status, body })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn denies_unapproved_host() {
        let p=ResearchPolicy::default();
        assert!(fetch("https://example.com",&p).is_err());
    }
}
