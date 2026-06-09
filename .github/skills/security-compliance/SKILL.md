---
name: "security-compliance"
description: "On-demand skill. Load when task involves: EU regulatory compliance, AI Act audit, NIS2 assessment, GDPR review, compliance checklist, incident response plan, transparency obligations."
---

# Security — EU Compliance Checklist (AI Act + NIS2 + GDPR)

On-demand skill. Load when the project operates in the EU, processes personal data, or uses AI/LLM features that influence business decisions.

## When to Load

- Compliance audit or regulatory assessment
- Pre-release compliance review for EU-market products
- After integrating AI/LLM features into business workflows
- After onboarding critical-sector customers (NIS2 scope)
- When preparing technical documentation for regulators
- Incident response planning

---

## AI Act — Reg. UE 2024/1689

The AI Act applies to any system that uses AI to produce outputs influencing decisions. The obligations scale with the risk level of the system.

### Risk Classification

Before auditing, classify the system:

| Risk Level | Description | Example | Obligations |
|------------|-------------|---------|-------------|
| Unacceptable | Manipulative, social scoring, real-time biometric ID | — | Banned (Art. 5) |
| High-risk | Safety components, biometrics, critical infrastructure, employment, credit | HR screening agent, credit scoring | Full compliance (Art. 6–15) |
| Limited risk | Interacts with users, generates content | Chatbot, content generator | Transparency only (Art. 52) |
| Minimal risk | No significant impact | Spam filter, recommendation | No specific obligations |

- [ ] AI system risk level classified and documented
- [ ] Classification rationale recorded with legal/DPO sign-off

### Art. 9 — Risk Management System

Required for high-risk systems. Recommended for all AI systems.

- [ ] Risks identified and assessed (bias, safety, fundamental rights)
- [ ] Mitigation measures documented and implemented
- [ ] Residual risk is acceptable and documented
- [ ] Risk assessment reviewed periodically (at least annually or after significant changes)

### Art. 11 — Technical Documentation

- [ ] System description: purpose, intended use, limitations
- [ ] Data governance: training data sources, preprocessing, bias mitigation
- [ ] Architecture: model type, parameters, inference pipeline
- [ ] Performance metrics: accuracy, precision, recall, fairness metrics
- [ ] **Inference logging**: every AI inference logged immutably with:
  - Prompt / input
  - Model name and version
  - Output / response
  - Context (session, conversation ID)
  - User identifier (pseudonymized)
  - Timestamp (UTC)
- [ ] Logging retention: minimum 6 months for high-risk systems (Art. 20)
- [ ] Logs tamper-proof (append-only, integrity-verified)

### Art. 13 — Transparency

- [ ] Users informed they are interacting with an AI system (before or at first interaction)
- [ ] AI-generated content clearly labeled as such
- [ ] System capabilities and limitations disclosed
- [ ] Contact information for human escalation provided
- [ ] Emotion recognition or biometric categorization: explicit disclosure to affected persons

### Art. 14 — Human Oversight

- [ ] Human-in-the-loop mechanism exists for decisions with significant impact
- [ ] Human can override, pause, or stop the AI system
- [ ] Override actions are logged
- [ ] Human reviewer has access to AI reasoning/context (explainability)
- [ ] Escalation path documented: AI decision → human review → final decision

**Pattern — human oversight (FastAPI example):**

```python
# ❌ AI decides autonomously
@router.post("/evaluate")
async def evaluate(data: EvalRequest):
    result = await agent.run(data.input)
    await db.decisions.insert(result)  # auto-committed
    return result

# ✅ AI proposes, human confirms
@router.post("/evaluate")
async def evaluate(data: EvalRequest):
    proposal = await agent.run(data.input)
    await db.proposals.insert({
        **proposal,
        "status": "pending_review",
        "requires_human_approval": True
    })
    return {"proposal_id": proposal.id, "status": "pending_review"}
```

### Art. 15 — Accuracy, Robustness, Cybersecurity

- [ ] Model outputs validated against expected schema before processing
- [ ] Adversarial input handling: prompt injection mitigated, input sanitized
- [ ] Fallback behavior defined for model errors, timeouts, hallucinations
- [ ] Model version pinned (no silent updates in production)
- [ ] Regular accuracy evaluation against ground truth / golden dataset

### Art. 52 — Transparency for Generative AI

Applies to all generative AI systems, regardless of risk level.

- [ ] AI-generated text, image, audio, video disclosed as artificial
- [ ] Deep fake content: clearly and visibly labeled
- [ ] Machine-readable metadata in generated content (C2PA / watermarking where applicable)
- [ ] Users can distinguish AI-generated from human-created content

---

## NIS2 — Dir. UE 2022/2555

NIS2 applies if the organization operates in an essential or important sector, or serves customers in those sectors. Even SaaS providers may be in scope as supply chain dependencies.

### Scope Assessment

| Sector Category | Examples |
|----------------|----------|
| Essential (Art. 3.1) | Energy, transport, banking, health, water, digital infrastructure, public administration |
| Important (Art. 3.2) | Postal, waste, chemicals, food, manufacturing, digital providers, research |

- [ ] Organization sector classification documented
- [ ] In-scope services and systems identified
- [ ] Supply chain dependencies mapped (who depends on us?)

### Art. 21 — Cybersecurity Risk Management

Minimum measures (all sub-items mandatory for in-scope entities):

- [ ] **(a)** Risk analysis and information system security policies
- [ ] **(b)** Incident handling procedures (detection, response, recovery)
- [ ] **(c)** Business continuity and disaster recovery (backups, failover)
- [ ] **(d)** Supply chain security (vendor assessment, dependency audit, SBOM)
- [ ] **(e)** Security in acquisition, development, and maintenance (SDLC security)
- [ ] **(f)** Vulnerability handling and disclosure policies
- [ ] **(g)** Cybersecurity risk assessment practices (annual or after changes)
- [ ] **(h)** Cybersecurity awareness and training for staff
- [ ] **(i)** Cryptography and encryption policies
- [ ] **(j)** Human resource security, access control, and asset management
- [ ] **(k)** Multi-factor authentication or continuous authentication

### Art. 23 — Incident Reporting Obligations

| Timeline | Requirement | Recipient |
|----------|------------|-----------|
| 24 hours | Early warning: significant incident occurred, suspected cause | National CSIRT |
| 72 hours | Incident notification: severity, impact, initial assessment | National CSIRT |
| 1 month | Final report: root cause, mitigation, lessons learned | National CSIRT |

- [ ] Incident classification criteria defined (significant vs. non-significant)
- [ ] Incident response team identified with roles and contact info
- [ ] Incident reporting template prepared with required fields
- [ ] Communication plan: internal escalation + external notification
- [ ] Post-incident review process documented

**Incident Response Plan Template:**

```markdown
## Incident Response Plan — <project-name>

### 1. Classification
- Severity: Critical / High / Medium / Low
- Type: Data breach / Service disruption / Unauthorized access / Malware / Supply chain
- Significant incident? (NIS2 Art. 23 threshold): Yes / No

### 2. Immediate Actions (0–24h)
- [ ] Contain the incident (isolate affected systems)
- [ ] Preserve evidence (logs, snapshots, memory dumps)
- [ ] Notify incident response team lead
- [ ] File early warning to national CSIRT (if significant)

### 3. Investigation (24–72h)
- [ ] Determine root cause
- [ ] Assess impact scope (users, data, systems)
- [ ] File incident notification to CSIRT (if significant)
- [ ] Notify affected data subjects (if personal data involved — GDPR Art. 34)

### 4. Recovery
- [ ] Remediate vulnerability / threat
- [ ] Restore services from clean backups
- [ ] Verify integrity of restored systems
- [ ] Monitor for recurrence

### 5. Post-Incident (within 1 month)
- [ ] File final report to CSIRT
- [ ] Conduct post-mortem / lessons learned
- [ ] Update risk assessment and controls
- [ ] Update this incident response plan
```

### Art. 24 — Certification

- [ ] Relevant cybersecurity certification schemes evaluated (ISO 27001, SOC 2, CSA STAR)
- [ ] Certification status documented
- [ ] Certification renewal schedule tracked

### Supply Chain Security (Art. 21(d))

- [ ] Software Bill of Materials (SBOM) generated for all releases (CycloneDX format)
- [ ] VEX (Vulnerability Exploitability Exchange) published for known CVEs
- [ ] Third-party dependencies audited for known vulnerabilities (npm audit, pip audit, trivy)
- [ ] Vendor security assessment performed for critical suppliers
- [ ] SLA/DPA with suppliers includes security obligations and incident notification

---

## GDPR — Reg. UE 2016/679 (Baseline)

Essential GDPR checks when processing personal data. Not exhaustive — defer to DPO for complex cases.

### Data Processing Principles (Art. 5)

- [ ] Lawful basis for processing identified and documented (consent, contract, legitimate interest)
- [ ] Data minimization: only necessary data collected
- [ ] Purpose limitation: data used only for stated purposes
- [ ] Storage limitation: retention periods defined and enforced
- [ ] Integrity and confidentiality: encryption at rest and in transit

### Technical Measures

- [ ] Data residency: all personal data stored in EU region
- [ ] Multi-tenant isolation: tenant A data inaccessible to tenant B (RLS, tenant_id filtering)
- [ ] Right to erasure (Art. 17): mechanism to delete all user data on request
- [ ] Data portability (Art. 20): export user data in machine-readable format
- [ ] Data Protection Impact Assessment (DPIA) completed for high-risk processing
- [ ] Sub-processors: DPA in place with all third parties processing personal data (including LLM providers)

### AI + GDPR Intersection

- [ ] Automated decision-making disclosed (Art. 22) — right to human review
- [ ] Profiling: data subjects informed, opt-out mechanism available
- [ ] LLM API calls: no PII sent to external models without DPA and consent
- [ ] Conversation data: retention policy, deletion mechanism, no unbounded accumulation

---

## Audit Report — Compliance Section Format

When running a compliance audit, add this section to `SECURITY_AUDIT_YYYY-MM-DD.md`:

```markdown
## EU Compliance Status

### AI Act (Reg. UE 2024/1689)
- Risk classification: <level>
- Applicable articles: <list>

| Article | Requirement | Status | Finding | Remediation |
|---------|-------------|--------|---------|-------------|
| Art. 11 | Inference logging | ❌ FAIL | No logging configured | Implement Langfuse / OpenTelemetry |
| Art. 14 | Human oversight | ✅ PASS | Expert review stage exists | — |

### NIS2 (Dir. UE 2022/2555)
- In scope: Yes / No / Under assessment
- Sector: <sector>

| Article | Measure | Status | Finding | Remediation |
|---------|---------|--------|---------|-------------|
| Art. 21(d) | Supply chain security | ⚠️ PARTIAL | SBOM missing | Generate with syft |
| Art. 23 | Incident reporting | ❌ FAIL | No plan | Create IR plan |

### GDPR (Reg. UE 2016/679)
| Requirement | Status | Finding |
|-------------|--------|---------|
| Data residency EU | ✅ PASS | Supabase EU region |
| Tenant isolation | ✅ PASS | RLS enforced |
```
