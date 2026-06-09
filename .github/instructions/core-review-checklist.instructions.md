---
applyTo: "**"
---

# Code Review — Universal Checklist

Shared review rules for all stacks. Language-specific rules are in the reviewer agent file.

## Review Process

For each issue found, report:
1. Severity: 🔴 Critical | 🟡 Warning | 🔵 Suggestion
2. File and line
3. Specific problem
4. Proposed fix with code

## Security

- No hardcoded secrets (API keys, passwords, tokens, connection strings)
- Input validation on all external inputs (endpoints, CLI args, file uploads)
- Sanitize output to prevent injection (SQL, command, template, eval)
- Auth and authorization check on every protected route/endpoint
- Dependencies pinned and free of known vulnerabilities

## Performance

- No blocking I/O in async code
- DB queries use appropriate indexes
- N+1 queries detected and flagged
- Connection pooling configured
- Resources closed correctly (context managers, event listeners, streams)
- No unnecessary allocations in hot paths

## Patterns

- Dependency injection — no service locator, no direct import of implementations
- Error handling: custom errors/exceptions, no generic catch-all
- Separation of concerns: controller/route → service → repository
- Config validated at startup — no raw environment variable access in business logic
- Structured logging — no `print()` or `console.log()` for production logging

## Testing

- Every new service/module must have unit tests
- New endpoints must have integration tests
- Mock only external dependencies (DB, third-party APIs, filesystem, network)
- Tests must be meaningful — no tests that always pass
