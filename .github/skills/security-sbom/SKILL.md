---
name: "security-sbom"
description: "On-demand skill. Load when task involves: SBOM generation, VEX creation, CycloneDX, SPDX, software bill of materials, supply chain transparency, dependency inventory, NIS2 supply chain compliance."
---

# Security — SBOM & VEX Generation

On-demand skill for generating Software Bill of Materials (SBOM) and Vulnerability Exploitability eXchange (VEX) documents. Required for NIS2 Art. 21(d) supply chain security compliance.

## When to Load

- Supply chain security assessment
- Pre-release compliance packaging
- NIS2 audit preparation
- Dependency inventory for procurement/legal
- Vulnerability disclosure and triage
- Container image attestation

## Toolchain

| Tool | Purpose | Install |
|------|---------|---------|
| [Syft](https://github.com/anchore/syft) | SBOM generation (source + container) | `brew install syft` / `curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh \| sh` |
| [Grype](https://github.com/anchore/grype) | Vulnerability scanning + VEX | `brew install grype` / `curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh \| sh` |
| [vexctl](https://github.com/openvex/vexctl) | VEX document management | `go install github.com/openvex/vexctl@latest` |

## Format Choice

**CycloneDX** is the recommended format:
- OWASP standard, designed for security and compliance
- Native VEX support (embedded in SBOM or standalone)
- NIS2-aligned (EU Cyber Resilience Act references CycloneDX)
- Machine-readable (JSON) and human-readable
- Specification version: **1.5+** (required for VEX support)

Use SPDX only if explicitly required by a customer or regulation.

---

## SBOM Generation by Ecosystem

### Node.js / TypeScript

```bash
# From source (uses package-lock.json / yarn.lock / pnpm-lock.yaml)
syft . -o cyclonedx-json > SBOM.json

# From container image
syft <image>:<tag> -o cyclonedx-json > SBOM.json

# Include dev dependencies (for full audit)
syft . -o cyclonedx-json --select-catalogers "+npm-package-lock-cataloger" > SBOM.json
```

### Python

```bash
# From source (uses requirements.txt / Pipfile.lock / poetry.lock / pyproject.toml)
syft . -o cyclonedx-json > SBOM.json

# From virtual environment
syft dir:/path/to/venv -o cyclonedx-json > SBOM.json
```

### .NET / C#

```bash
# From source (uses .csproj / packages.config / Directory.Packages.props)
syft . -o cyclonedx-json > SBOM.json
```

### Go

```bash
# From source (uses go.mod / go.sum)
syft . -o cyclonedx-json > SBOM.json

# From compiled binary
syft file:./my-binary -o cyclonedx-json > SBOM.json
```

### Rust

```bash
# From source (uses Cargo.lock)
syft . -o cyclonedx-json > SBOM.json
```

### Container Images (Docker)

```bash
# From image reference
syft <registry>/<image>:<tag> -o cyclonedx-json > SBOM.json

# From local Dockerfile build
docker build -t myapp:latest .
syft myapp:latest -o cyclonedx-json > SBOM.json

# From OCI archive
syft oci-archive:image.tar -o cyclonedx-json > SBOM.json
```

---

## VEX Generation

VEX documents communicate vulnerability exploitability status — not all CVEs in a dependency are actually exploitable in your context.

### Automated VEX (from SBOM)

```bash
# Scan SBOM for known vulnerabilities and generate VEX
grype sbom:SBOM.json -o cyclonedx-json > VEX.json

# Filter only HIGH/CRITICAL
grype sbom:SBOM.json --fail-on high -o cyclonedx-json > VEX.json
```

### Manual VEX Statement (for triage)

Use `vexctl` to add exploitability assessments:

```bash
# Mark a CVE as "not affected" with justification
vexctl create \
  --product="pkg:npm/my-app@1.0.0" \
  --vuln="CVE-2024-12345" \
  --status="not_affected" \
  --justification="vulnerable_code_not_present" \
  > vex-statement.json

# Mark as "affected" with action statement
vexctl create \
  --product="pkg:npm/my-app@1.0.0" \
  --vuln="CVE-2024-67890" \
  --status="affected" \
  --action-statement="Upgrade lodash to >=4.17.21" \
  > vex-statement.json
```

### VEX Status Values

| Status | Meaning | When to Use |
|--------|---------|-------------|
| `not_affected` | Vulnerability exists in dependency but is not exploitable | Vulnerable code path not reachable |
| `affected` | Vulnerability is exploitable, remediation needed | Active risk, requires fix |
| `fixed` | Vulnerability was present, now remediated | After applying patch/upgrade |
| `under_investigation` | Assessment in progress | Initial triage phase |

### VEX Justifications (for `not_affected`)

| Justification | Meaning |
|---------------|---------|
| `component_not_present` | The vulnerable component is not actually included |
| `vulnerable_code_not_present` | The specific vulnerable code path is not included |
| `vulnerable_code_not_in_execute_path` | Code exists but is never executed |
| `vulnerable_code_cannot_be_controlled_by_adversary` | Code runs but input is not attacker-controllable |
| `inline_mitigations_already_exist` | Other controls prevent exploitation |

---

## Severity → Priority Mapping (NIS2-aligned)

| CVSS Score | Severity | Remediation Priority | NIS2 Timeline |
|------------|----------|---------------------|---------------|
| 9.0–10.0 | Critical | Immediate | 24h notification, fix ASAP |
| 7.0–8.9 | High | Urgent | 72h notification, fix within 1 week |
| 4.0–6.9 | Medium | Planned | Next sprint / 2 weeks |
| 0.1–3.9 | Low | Backlog | Next maintenance window |

---

## CI/CD Integration

### GitHub Actions — SBOM as Build Artifact

```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    format: cyclonedx-json
    output-file: sbom.cdx.json
    artifact-name: sbom

- name: Scan SBOM for vulnerabilities
  uses: anchore/scan-action@v6
  with:
    sbom: sbom.cdx.json
    fail-build: true
    severity-cutoff: high
    output-format: cyclonedx-json
```

### GitHub Attestation (Sigstore)

For supply chain integrity verification (optional, enterprise-grade):

```yaml
- name: Attest SBOM
  uses: actions/attest-sbom@v2
  with:
    subject-path: sbom.cdx.json
    sbom-format: cyclonedx-json
```

---

## Validation

Verify generated SBOM is valid CycloneDX:

```bash
# Install validator
npm install -g @cyclonedx/cyclonedx-cli

# Validate
cyclonedx-cli validate --input-file SBOM.json --input-format json --input-version 1.5

# Summary stats
cyclonedx-cli analyze --input-file SBOM.json --input-format json
```

Expected minimum content:
- [ ] `bomFormat`: "CycloneDX"
- [ ] `specVersion`: "1.5" or higher
- [ ] `serialNumber`: unique URN
- [ ] `metadata.timestamp`: ISO 8601
- [ ] `metadata.tools`: lists Syft version
- [ ] `components[]`: at least one component with `purl` identifier
- [ ] Each component has: `type`, `name`, `version`, `purl`

## Output Files

| File | Format | Purpose |
|------|--------|---------|
| `SBOM_YYYY-MM-DD.json` | CycloneDX JSON 1.5+ | Full dependency inventory |
| `VEX_YYYY-MM-DD.json` | CycloneDX JSON or OpenVEX | Exploitability assessments |
| `sbom.cdx.json` | CycloneDX JSON | CI artifact (attached to release) |
