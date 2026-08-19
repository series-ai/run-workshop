# PFX Agent Instructions

Before changing this subtree:

1. Run `npm run quality:status`.
2. Read the first recommended action in `quality/current-status.md`.
3. Follow `docs/quality-review-workflow.md` for commands and recovery.
4. Use `docs/pfx-craft-guide.md` for authoring and remediation.
5. Use `docs/production-pfx-standard.md` to resolve acceptance disputes.

Generated rubric metadata, dossiers, templates, and local Chromium results are
non-approving. Never fabricate independent review or physical-device evidence,
and never let an implementation actor self-certify peer approval.

After a completed converging iteration, regenerate
`quality/current-status.md`. Append to `quality/decisions.jsonl` only through
the validated assembly workflow.
