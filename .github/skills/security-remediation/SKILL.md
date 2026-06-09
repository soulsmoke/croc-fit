---
name: "security-remediation"
description: "On-demand skill. Load when task involves: creating security issues, CVE remediation tasks, vulnerability tracking, automated issue generation from audit findings."
---

# Security — Remediation Task Generation

On-demand skill for converting security audit findings into structured, actionable GitHub issues with CVE details, remediation plans, and NIS2-compliant timelines.

## When to Load

- After running a security audit (Step 7 of Security Auditor agent)
- When triaging vulnerability scan results (Trivy, Grype, Semgrep)
- When converting SBOM/VEX findings into actionable tasks
- When onboarding a backlog of known vulnerabilities

## Issue Template

Each finding with severity ≥ High should generate a GitHub issue with the following structure:

```markdown
## 🔒 [SEVERITY] TITLE — CVE-YYYY-NNNNN

**Severity**: Critical / High / Medium / Low
**CVSS Score**: X.X (vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
**Category**: OWASP A01 / LLM01 / Dependency / Configuration
**Discovered**: YYYY-MM-DD
**Deadline**: YYYY-MM-DD (based on NIS2 timeline)

### Affected Component

- **File**: `path/to/file.ts:42`
- **Package**: `package-name@version` (if dependency)
- **Endpoint**: `POST /api/endpoint` (if route)

### Description

[Clear description of the vulnerability, how it can be exploited, and what data/systems are at risk.]

### Proof of Concept

[Minimal reproduction steps or code snippet demonstrating the vulnerability.]

### Remediation Plan

1. [ ] Step 1 — [specific action with code example]
2. [ ] Step 2 — [verification step]
3. [ ] Step 3 — [test to confirm fix]

### Code Fix

```diff
- // Vulnerable code
+ // Fixed code
```

### References

- [CVE Link](https://nvd.nist.gov/vuln/detail/CVE-YYYY-NNNNN)
- [Advisory](link)
- [OWASP Category](link)

### NIS2 Compliance

- [ ] If significant incident: file early warning to CSIRT within 24h
- [ ] Update SBOM/VEX after remediation
- [ ] Document in incident log
```

## Labels

Apply these labels to created issues:

| Label | When |
|-------|------|
| `security` | All security issues |
| `severity-critical` | CVSS ≥ 9.0 |
| `severity-high` | CVSS 7.0–8.9 |
| `severity-medium` | CVSS 4.0–6.9 |
| `severity-low` | CVSS 0.1–3.9 |
| `cve` | Known CVE with identifier |
| `owasp-a01` ... `owasp-a10` | OWASP Top 10 category |
| `owasp-llm01` ... `owasp-llm10` | OWASP LLM Top 10 category |
| `dependency` | Third-party dependency vulnerability |
| `configuration` | Security misconfiguration |
| `compliance` | Regulatory compliance gap (AI Act, NIS2, GDPR) |

## Remediation Priority (NIS2-aligned)

| Severity | Response Time | Fix Deadline | Escalation |
|----------|--------------|--------------|------------|
| Critical | Immediate (within 4h) | 24h | CSIRT notification, management alert |
| High | Same business day | 72h (1 week max) | Team lead notification |
| Medium | Next sprint planning | 2 weeks | Standard backlog |
| Low | Next maintenance window | 1 month | Backlog |

## Automated Issue Creation

### Using GitHub CLI

```bash
# Single issue from audit finding
gh issue create \
  --title "🔒 [CRITICAL] SQL Injection in /api/users — CVE-2024-12345" \
  --body-file issue-body.md \
  --label "security,severity-critical,cve,owasp-a03" \
  --assignee "@me"

# Batch creation from audit report (parse findings table)
cat SECURITY_AUDIT_*.md | \
  grep "^|" | grep -v "^| #\|^|---" | \
  while IFS='|' read -r _ num category severity file description remediation _; do
    severity_lower=$(echo "$severity" | tr '[:upper:]' '[:lower:]' | xargs)
    gh issue create \
      --title "🔒 [${severity}] ${description}" \
      --body "**Category**: ${category}\n**File**: ${file}\n**Remediation**: ${remediation}" \
      --label "security,severity-${severity_lower}"
  done
```

### Using GitHub Actions (automated on audit workflow)

```yaml
- name: Create issues from findings
  uses: actions/github-script@v7
  with:
    script: |
      const findings = JSON.parse(require('fs').readFileSync('findings.json', 'utf8'));
      for (const finding of findings) {
        if (['critical', 'high'].includes(finding.severity)) {
          await github.rest.issues.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title: `🔒 [${finding.severity.toUpperCase()}] ${finding.title}`,
            body: finding.body,
            labels: ['security', `severity-${finding.severity}`, finding.category],
          });
        }
      }
```

## Deduplication

Before creating an issue, check for existing open issues:

```bash
# Check if issue already exists for this CVE
existing=$(gh issue list --label "cve" --state open --search "CVE-2024-12345" --json number --jq '.[0].number')
if [ -n "$existing" ]; then
  echo "Issue #${existing} already exists for CVE-2024-12345 — skipping"
else
  gh issue create ...
fi
```

Rules:
- One issue per unique CVE ID (dependency vulnerabilities)
- One issue per unique file:line + category (code vulnerabilities)
- If a CVE affects multiple packages, create one issue listing all affected packages
- If a fix resolves multiple findings, link them in the issue body

## Workflow Integration

This skill is designed to be called:

1. **Manually** — by the Security Auditor agent after Step 5 (report generation)
2. **In CI** — by the `security-issues.yml` workflow after vulnerability scanning
3. **On schedule** — by `security-scheduled.yml` when new CVEs are discovered for existing dependencies
