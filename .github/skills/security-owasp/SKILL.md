---
name: "security-owasp"
description: "On-demand skill. Load when task involves: security audit, vulnerability review, hardening, pre-release checklist, OWASP Top 10, LLM security, AI application security."
---

# Security — OWASP Top 10 Checklist

On-demand skill. Load when task involves: security audit, vulnerability review, hardening, pre-release checklist.

## When to Load

- Security review or audit task
- Pre-release hardening
- New auth system implementation
- After adding user-facing input forms or API endpoints
- After integrating third-party services or LLM APIs

## Standards Covered

| Standard | Version | Scope |
|----------|---------|-------|
| OWASP Top 10 | 2021 | Web application security baseline |
| OWASP Top 10 | 2025 | Updated web application security (new categories) |
| OWASP LLM Top 10 | v2 (2025) | AI/LLM application security |

Cross-references to **AI Act** articles are noted where applicable (see `security-compliance/SKILL.md` for full EU compliance checklist).

## OWASP Top 10 (2021) — Applied to AI-Assisted Development

### A01 — Broken Access Control

**AI-generated risk**: agent creates CRUD endpoints fast, often skipping ownership checks.

**Checklist:**

- [ ] Every endpoint verifies the authenticated user owns or has access to the requested resource
- [ ] No reliance on client-sent IDs for authorization — derive user context from session/token
- [ ] Directory traversal: file paths from user input validated against allowed base directory
- [ ] API rate limiting configured on sensitive endpoints (login, password reset, payments)
- [ ] Default deny: new routes require explicit role/permission assignment

**Pattern — ownership check (Next.js example):**

```ts
// ❌ IDOR — anyone can access any order
const order = await db.order.findUnique({ where: { id: params.id } });

// ✅ ownership enforced
const order = await db.order.findUnique({
  where: { id: params.id, userId: session.user.id },
});
if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

### A02 — Cryptographic Failures

**Checklist:**

- [ ] Passwords hashed with bcrypt/argon2 — never MD5, SHA-1, or plain text
- [ ] Sensitive data encrypted at rest (DB-level or field-level encryption for PII)
- [ ] TLS enforced for all external communications
- [ ] No secrets in URLs, query strings, or local storage
- [ ] JWT: use asymmetric keys (RS256) for production, short expiry, no sensitive data in payload

### A03 — Injection

**Checklist:**

- [ ] All database queries use parameterized statements or ORM — zero string concatenation
- [ ] Shell commands use `execFile` with argument arrays — no `exec` with interpolated strings
- [ ] HTML output sanitized — no raw user content in `innerHTML` or equivalent
- [ ] NoSQL injection: validate and type-check MongoDB/Firestore query parameters
- [ ] GraphQL: input validation on all resolver arguments, query depth limits

**Pattern — shell command (Node.js):**

```ts
// ❌ command injection
exec(`convert ${userFilename} output.png`);

// ✅ safe
execFile("convert", [userFilename, "output.png"]);
```

### A04 — Insecure Design

**Checklist:**

- [ ] Business logic limits enforced server-side (max items, max amount, rate limits)
- [ ] Password reset: token-based with expiry, not security questions
- [ ] File upload: validate MIME type server-side, limit size, store outside webroot
- [ ] Multi-tenant: data isolation verified — tenant A cannot access tenant B data

### A05 — Security Misconfiguration

**AI-generated risk**: scaffolding with permissive defaults that never get tightened.

**Checklist:**

- [ ] CORS configured with explicit allowed origins — no wildcard `*` with credentials
- [ ] Debug mode / stack traces disabled in production
- [ ] Default credentials changed (database, admin panel, third-party services)
- [ ] Security headers set: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`
- [ ] Unnecessary HTTP methods disabled (TRACE, OPTIONS where not needed)
- [ ] `.env.example` contains variable names only — no real values

### A06 — Vulnerable and Outdated Components

**AI-generated risk**: agent installs packages from training data that may be outdated or deprecated.

**Checklist:**

- [ ] `npm audit` / `yarn npm audit` — zero critical/high vulnerabilities
- [ ] No deprecated packages (`request`, `node-sass`, old CrmServiceClient)
- [ ] Lock file (`yarn.lock`, `package-lock.json`) committed and reviewed
- [ ] Container base images: use specific version tags, not `latest`

### A07 — Identification and Authentication Failures

**Checklist:**

- [ ] Session tokens: `httpOnly`, `secure`, `sameSite=lax` (or `strict`)
- [ ] Brute-force protection: rate limit or account lockout on login
- [ ] Password policy: minimum 8 chars, no maximum limit, check against breached lists (optional)
- [ ] MFA supported for admin/sensitive roles
- [ ] Session invalidated on logout, password change, and privilege escalation

### A08 — Software and Data Integrity Failures

**Checklist:**

- [ ] CI/CD pipeline: dependencies pinned, integrity verified via lock file
- [ ] No `eval()` or dynamic `import()` with user-controlled paths
- [ ] Webhook endpoints verify signatures (Stripe, GitHub, etc.)
- [ ] Serialization: no `JSON.parse` on untrusted input without schema validation

### A09 — Security Logging and Monitoring Failures

**Checklist:**

- [ ] Auth events logged: login success/failure, password reset, role changes
- [ ] Sensitive actions logged: data export, bulk delete, admin operations
- [ ] Logs do not contain passwords, tokens, or PII — redact before logging
- [ ] Log injection prevented: sanitize user input before including in log messages

### A10 — Server-Side Request Forgery (SSRF)

**AI-generated risk**: agent creates proxy routes or URL fetch features without restricting targets.

**Checklist:**

- [ ] User-supplied URLs validated against allowlist of domains/protocols
- [ ] Internal network ranges blocked (127.0.0.1, 10.x, 172.16-31.x, 192.168.x, metadata endpoints)
- [ ] Redirect chains not followed blindly — limit redirects and revalidate destination
- [ ] Cloud metadata endpoint (169.254.169.254) explicitly blocked

## AI-Specific Vulnerabilities — Extended Checklist

These apply when the application itself uses AI/LLM features.

> **AI Act cross-reference**: Art. 15 (robustness, cybersecurity), Art. 52 (generative AI transparency).

### Prompt Injection

- [ ] User input never directly concatenated into system prompts
- [ ] User-controlled content wrapped in delimiters and treated as data, not instructions
- [ ] System prompt stored server-side — never sent to client
- [ ] Output from LLM treated as untrusted — sanitize before rendering or executing

### Model Output Safety

- [ ] LLM output sanitized before DOM insertion (prevent XSS from hallucinated HTML)
- [ ] LLM-generated code never executed directly (`eval`, `Function`, `exec`)
- [ ] LLM responses validated against expected schema before processing
- [ ] Rate limiting on LLM API calls to prevent cost abuse

### Data Leakage via AI

- [ ] PII not sent to external LLM APIs without user consent and data processing agreement
- [ ] Conversation history size limited — no unbounded context accumulation
- [ ] LLM API keys not exposed to client-side code
- [ ] Training data opt-out configured where available

---

## OWASP Top 10 — 2025 Update

New and restructured categories for 2025. Items marked with ★ are new or significantly changed from 2021.

### A01:2025 — Broken Access Control *(unchanged)*

Same as A01:2021 above. Remains the #1 risk.

### A02:2025 — Cryptographic Failures *(unchanged)*

Same as A02:2021 above.

### A03:2025 — Injection *(unchanged)*

Same as A03:2021 above.

### A04:2025 — Insecure Design *(unchanged)*

Same as A04:2021 above.

### A05:2025 — Security Misconfiguration *(unchanged)*

Same as A05:2021 above.

### A06:2025 — Vulnerable and Outdated Components *(unchanged)*

Same as A06:2021 above.

### A07:2025 — Identification and Authentication Failures *(unchanged)*

Same as A07:2021 above.

### A08:2025 — Software and Data Integrity Failures *(unchanged)*

Same as A08:2021 above.

### A09:2025 — Security Logging and Monitoring Failures *(unchanged)*

Same as A09:2021 above. **AI Act cross-reference**: Art. 11 — inference logging mandatory for high-risk AI systems.

### A10:2025 — Server-Side Request Forgery *(unchanged)*

Same as A10:2021 above.

---

## OWASP LLM Top 10 v2 (2025) — AI Application Security

Applies to any application that integrates LLM/AI features. **Load this section when the project uses AI agents, chatbots, content generators, or any LLM API.**

> **AI Act cross-reference**: These risks map directly to Art. 15 (robustness, cybersecurity) and Art. 9 (risk management) obligations.

### LLM01 — Prompt Injection

Direct or indirect manipulation of LLM behavior through crafted inputs.

- [ ] System prompts isolated from user input with clear delimiters
- [ ] Input sanitization: strip or escape instruction-like patterns from user content
- [ ] Indirect injection: external data (URLs, documents, emails) treated as untrusted when fed to LLM
- [ ] Output filtering: LLM responses validated before execution (no blind tool calls)
- [ ] Privileged actions require explicit user confirmation, not just LLM decision

**Pattern:**

```typescript
// ❌ Direct concatenation
const prompt = `You are a helpful assistant. User says: ${userInput}`;

// ✅ Structured separation
const messages = [
  { role: "system", content: systemPrompt },  // stored server-side
  { role: "user", content: userInput },         // clearly separated
];
```

### LLM02 — Sensitive Information Disclosure

LLM reveals confidential data from training, context, or system prompt.

- [ ] System prompt does not contain secrets, API keys, or internal URLs
- [ ] RAG context filtered: sensitive documents excluded from retrieval
- [ ] PII masking applied before sending user data to LLM
- [ ] Response filtering: regex/pattern matching to catch leaked credentials, emails, internal IPs
- [ ] Context window management: conversation history pruned, no stale sensitive data

### LLM03 — Supply Chain Vulnerabilities

Compromised models, plugins, training data, or dependencies.

- [ ] Models sourced from verified providers only (pinned versions/checksums)
- [ ] Third-party plugins/tools sandboxed with minimal permissions
- [ ] Model provenance documented (source, version, fine-tuning data)
- [ ] SBOM includes AI/ML components (models, frameworks, datasets)
- [ ] No arbitrary model loading from user input

### LLM04 — Data and Model Poisoning

Manipulation of training or fine-tuning data to alter model behavior.

- [ ] Fine-tuning data validated and reviewed before use
- [ ] RAG data sources authenticated and integrity-verified
- [ ] Data provenance tracked (who uploaded, when, source)
- [ ] Anomaly detection on model outputs (drift from expected behavior)
- [ ] Rollback capability: revert to previous model version if poisoning detected

### LLM05 — Improper Output Handling

Using LLM output without validation in downstream systems.

- [ ] LLM output never passed directly to `eval()`, `exec()`, SQL queries, or shell commands
- [ ] HTML/markdown from LLM sanitized before rendering (prevent XSS)
- [ ] Structured output validated against JSON schema before processing
- [ ] Code generation outputs reviewed/sandboxed before execution
- [ ] Error messages from LLM not exposed raw to end users

**Pattern:**

```typescript
// ❌ Blind execution of LLM-generated code
const code = await llm.generate("Write a database query for...");
await db.execute(code);  // SQL injection via LLM

// ✅ Validated structured output
const result = await llm.generate("Return JSON: {table, filters}");
const parsed = querySchema.safeParse(JSON.parse(result));
if (!parsed.success) throw new Error("Invalid LLM output");
const query = buildSafeQuery(parsed.data);  // parameterized query builder
```

### LLM06 — Excessive Agency

LLM-powered agents with too many permissions or autonomy.

- [ ] Tool/function calling restricted to explicitly allowed operations
- [ ] Destructive actions (delete, modify, send) require human confirmation
- [ ] Rate limiting on autonomous agent actions (max actions per session)
- [ ] Agent permissions scoped per user role (principle of least privilege)
- [ ] Kill switch: ability to immediately halt agent execution

> **AI Act cross-reference**: Art. 14 — human oversight mandatory for significant decisions.

### LLM07 — System Prompt Leakage

Extraction of system prompts through adversarial queries.

- [ ] System prompt treated as confidential (do not confirm or deny its content)
- [ ] Anti-extraction instructions in system prompt (refuse to reveal instructions)
- [ ] Input filtering: detect and block prompt extraction attempts
- [ ] Output monitoring: detect system prompt content in responses
- [ ] System prompt versioned and access-controlled (not in client-side code)

### LLM08 — Vector and Embedding Weaknesses

Attacks on RAG systems through manipulated embeddings or retrieval.

- [ ] Embedding model access controlled (no public write access to vector store)
- [ ] Document ingestion pipeline validates source integrity
- [ ] Retrieval results filtered for relevance score threshold
- [ ] Access control enforced on retrieved documents (user can only see their data)
- [ ] Vector store isolated per tenant in multi-tenant systems

### LLM09 — Misinformation

LLM generates factually incorrect or misleading content.

- [ ] AI-generated content labeled as such (Art. 52 AI Act)
- [ ] Critical outputs validated against authoritative sources
- [ ] Confidence scores displayed when available
- [ ] User feedback mechanism for reporting incorrect AI outputs
- [ ] Grounding: RAG or retrieval used to anchor responses in verified data

### LLM10 — Unbounded Consumption

Resource exhaustion through excessive LLM usage.

- [ ] Token limits enforced per request (max input + output tokens)
- [ ] Rate limiting per user/session/API key
- [ ] Cost monitoring and alerting (daily/monthly spend caps)
- [ ] Timeout on LLM API calls (no infinite waits)
- [ ] Queue/backpressure for concurrent LLM requests

## Report Format

When running a full OWASP audit, produce findings in this format:

```markdown
## Security Audit Report — <project-name>

**Date**: YYYY-MM-DD
**Scope**: <files/routes audited>

### Findings

| # | Category | Severity | File | Description | Remediation |
|---|----------|----------|------|-------------|-------------|
| 1 | A01 | High | `api/orders/[id]/route.ts` | Missing ownership check | Add `userId` filter to query |

### Summary

- Critical: N
- High: N
- Medium: N
- Low: N
- Total endpoints audited: N
- Passing: N
```
