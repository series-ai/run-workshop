# AGENTS.md

Guidance for AI coding agents working in **run-workshop**. This is the canonical
instructions file. `CLAUDE.md` (Claude Code) and `GEMINI.md` (Gemini CLI) are
one-line stubs that import this file, so every tool reads the same content
without duplicating it — and without symlinks, which don't check out reliably on
Windows.

## Opening a pull request

The **Contribution Certification** CI check parses the PR *description* for a
`## Contribution certification` section and fails unless both of its checkboxes
are `- [x]`. So:

- Build the PR body from `.github/pull_request_template.md` — do **not** replace
  it with a from-scratch summary. With `gh pr create`, prefer
  `--body-file .github/pull_request_template.md` (then fill it in) over an inline
  `--body`.
- Keep every template section: **Summary**, **Contribution certification**
  (check both boxes), **Security-sensitive changes**, and **Test plan**.
- Leave the **Security-sensitive changes** boxes unchecked unless the PR changes
  CI/CD workflows or GitHub Actions, adds/updates dependency manifests or
  lockfiles, or touches authentication, credentials, or secret handling.

## Repository setup

- Enable the shared hooks once per clone: `git config core.hooksPath .githooks`.
  They run the secret scanner before each commit and keep Git LFS objects in
  sync. Binary assets are stored with Git LFS (`git lfs install`).
- Each project under `games/` is self-contained (its own `package.json`,
  dependencies, and docs). Work inside the sub-project directory.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution requirements and
[GETTING_STARTED.md](GETTING_STARTED.md) for onboarding.
