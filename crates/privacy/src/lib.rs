use os_contracts::Sensitivity;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrivacyAssessment {
    pub sensitivity: Sensitivity,
    pub stored_text: String,
    pub secret_categories: Vec<&'static str>,
    pub redacted: bool,
}

#[derive(Debug, Default)]
pub struct PrivacyFilter;

impl PrivacyFilter {
    pub fn assess(&self, input: &str) -> PrivacyAssessment {
        let trimmed = input.trim();
        let lower = trimmed.to_ascii_lowercase();
        let mut categories = Vec::new();

        detect(
            &mut categories,
            contains_any(
                &lower,
                &[
                    "password=",
                    "password:",
                    "passwd=",
                    "api_key=",
                    "api-key=",
                    "apikey=",
                    "access_token=",
                    "refresh_token=",
                    "client_secret=",
                ],
            ),
            "credential_assignment",
        );
        detect(
            &mut categories,
            contains_any(
                trimmed,
                &[
                    "ghp_",
                    "github_pat_",
                    "glpat-",
                    "xoxb-",
                    "xoxp-",
                    "sk-",
                ],
            ),
            "token",
        );
        detect(
            &mut categories,
            lower.contains("authorization: bearer ") || lower.starts_with("bearer "),
            "bearer_token",
        );
        detect(
            &mut categories,
            trimmed.contains("-----BEGIN PRIVATE KEY-----")
                || trimmed.contains("-----BEGIN RSA PRIVATE KEY-----")
                || trimmed.contains("-----BEGIN OPENSSH PRIVATE KEY-----"),
            "private_key",
        );
        detect(&mut categories, looks_like_jwt(trimmed), "jwt");

        if !categories.is_empty() {
            return PrivacyAssessment {
                sensitivity: Sensitivity::SecretReference,
                stored_text: format!(
                    "[protected secret reference: {}]",
                    categories.join(",")
                ),
                secret_categories: categories,
                redacted: true,
            };
        }

        let sensitivity = if contains_any(
            &lower,
            &["confidential", "vertraulich", "strictly private", "nda"],
        ) {
            Sensitivity::Confidential
        } else {
            Sensitivity::Normal
        };

        PrivacyAssessment {
            sensitivity,
            stored_text: trimmed.to_string(),
            secret_categories: categories,
            redacted: false,
        }
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn detect(categories: &mut Vec<&'static str>, condition: bool, category: &'static str) {
    if condition && !categories.contains(&category) {
        categories.push(category);
    }
}

fn looks_like_jwt(value: &str) -> bool {
    let candidate = value
        .split_whitespace()
        .find(|part| part.starts_with("eyJ") && part.matches('.').count() == 2);
    let Some(candidate) = candidate else {
        return false;
    };
    let segments = candidate.split('.').collect::<Vec<_>>();
    segments.len() == 3 && segments.iter().all(|segment| segment.len() >= 16)
}

#[cfg(test)]
mod tests {
    use os_contracts::Sensitivity;

    use super::PrivacyFilter;

    #[test]
    fn redacts_known_secret_shapes() {
        let filter = PrivacyFilter;
        let assessment = filter.assess("authorization: Bearer eyJabcdefghijklmnop.abcdefghijklmnop.abcdefghijklmnop");
        assert_eq!(assessment.sensitivity, Sensitivity::SecretReference);
        assert!(assessment.redacted);
        assert!(!assessment.stored_text.contains("eyJabcdefghijklmnop"));
    }

    #[test]
    fn normal_text_remains_available_to_memory() {
        let filter = PrivacyFilter;
        let assessment = filter.assess("OS should remember temporal graph relationships");
        assert_eq!(assessment.sensitivity, Sensitivity::Normal);
        assert!(!assessment.redacted);
        assert!(assessment.stored_text.contains("temporal graph"));
    }
}
