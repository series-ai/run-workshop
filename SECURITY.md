# Security Policy

## Supported versions

Security fixes are applied to the default branch. Older tags and branches are not
actively supported unless a maintainer announces otherwise.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately so we can investigate and patch before details
are public:

1. Use [GitHub private vulnerability reporting](https://github.com/series-ai/run-workshop/security/advisories/new) for this repository.
2. If private reporting is unavailable, contact repository maintainers through a private channel rather than a public issue.

We aim to acknowledge reports within three business days. We will coordinate
disclosure timing with you when a fix is ready.

## What we consider in scope

- Secrets or credentials committed to the repository
- CI/CD workflows that expose secrets or run untrusted code with elevated privileges
- Supply-chain changes (dependencies, GitHub Actions, release scripts) that weaken repository security
- Vulnerabilities in code shipped from this repository

Platform, account, or production RUN infrastructure issues should be reported
through RUN support channels unless they stem from code maintained here.

## Safe disclosure

Please give us reasonable time to investigate and remediate before public
disclosure. We appreciate responsible disclosure and will credit reporters when
they want recognition.
