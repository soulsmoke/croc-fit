---
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.cs,**/*.py,**/*.go,**/*.java,**/*.php"
---

# Security — Always-On Rules

These rules apply automatically to every coding session. Verify before marking any task complete.

## Secrets and Credentials

- No hardcoded secrets, API keys, passwords, tokens, connection strings in code.
- Secrets go in `.env` files (excluded from git) or secret manager.
- Never commit `.env.local`, `.env.*.local`, or files containing real credentials.
- Test fixtures: use clearly fake values (`sk-test-fake-key-000`), never production-like strings.

## Input Validation

- Validate and sanitize all user input at system boundaries (API routes, form handlers, CLI args).
- Never trust client-side validation alone — always validate server-side.
- Reject unexpected types: use schema validation (Zod, Joi, class-validator) on API inputs.

## Injection Prevention

- No SQL/ORM raw queries with string interpolation or concatenation. Use parameterized queries.
- No `eval()`, `new Function()`, or dynamic code execution with user-controlled input.
- No `innerHTML`, `dangerouslySetInnerHTML`, `v-html` without sanitization (DOMPurify or equivalent).
- No template literal interpolation in shell commands — use `execFile` with argument arrays.

## Authentication and Authorization

- Every new API route/endpoint must have auth check. No "add auth later".
- Verify resource ownership on every data access — prevent IDOR (Insecure Direct Object Reference).
- Use `403 Forbidden` for unauthorized, `401 Unauthorized` for unauthenticated. Do not leak existence of resources.
- Session tokens: `httpOnly`, `secure`, `sameSite` flags mandatory.

## Dependencies

- After `npm install` / `yarn add`: run `npm audit` or `yarn npm audit` and review results.
- Do not install packages with known critical/high vulnerabilities without explicit user approval.
- Prefer well-maintained packages (recent commits, active maintainers, >1k weekly downloads).

## LLM-Powered Features

If the application uses LLM APIs (OpenAI, Anthropic, etc.):

- Never interpolate raw user input directly into system prompts — sanitize and bound content.
- Limit user-controlled prompt length to prevent token abuse.
- Never render raw LLM output directly to DOM — sanitize to prevent XSS via hallucinated HTML/JS.
- Log and rate-limit LLM API calls to prevent abuse.

## Data Exposure

- API responses must not include fields the user is not authorized to see. Use explicit `select` or DTOs.
- Error messages in production: generic user-facing text. Detailed errors only in logs.
- Never log sensitive data (passwords, tokens, PII) — redact before logging.

## HTTPS and Transport

- External API calls must use HTTPS. No plain HTTP for sensitive data.
- CORS: configure explicit allowed origins. Never use `origin: "*"` with credentials.

## Infrastructure and Cloud Resources

Code that interacts with cloud infrastructure APIs must follow these rules:

- **Least privilege**: API tokens and service accounts must have the minimum permissions required. Never use admin/root tokens in application code.
- **Scoped operations**: every cloud API call (create, update, delete) must target a specific resource by ID — never use wildcard or bulk operations without explicit safeguards.
- **Soft-delete preferred**: when designing delete endpoints or consuming cloud APIs, prefer soft-delete (flag + retention period) over hard-delete. If the API only supports hard-delete, document this in code comments.
- **Environment isolation**: production and staging resources must use separate credentials, separate API tokens, and separate configuration. Never share resource IDs, volumes, or databases across environments in code.
- **No destructive cloud calls in application code**: application code must never call infrastructure-level destructive APIs (delete volumes, drop databases, destroy deployments). These operations belong in dedicated ops scripts or CI/CD pipelines with manual approval gates.

## Post-Task Security Review

After completing any important task (features, critical fixes, CI/CD or infrastructure changes), run `/security-review` before marking the task as done.

> **Note**: `/security-review` is a Copilot preview skill — availability may vary.
