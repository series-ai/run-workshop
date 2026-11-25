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

## Expanding asset packs (`jam-ready-assets`)

- **Always add new and expanded pack assets to the `jam-ready-assets` repository**
  (not only locally in `run-workshop`) whenever expanding `run-chisel-*`
  (`tools/run-chisel-packs/`) or `run-voxel-*` (`tools/run-voxel-packs/`), so
  published RUN games and showcase pinned builds (`src/pins.ts`) can load them
  via `@series-inc/rundot-game-sdk`.
- After building, validating, and rendering thumbnails in the showcase, run
  `npm run stage -- --target <jam-ready-assets-checkout>` (which writes GLBs,
  `Previews/*.jpg`, `License.txt`, `.preview-sources/`, `preview.webp`, and
  `preview-sources.json`), rebuild the v2 manifest and run `npm test` inside
  `jam-ready-assets`, then sync the updated leaf hashes back into `src/pins.ts`
  with `npm run sync-pins -- --target <jam-ready-assets-checkout>` (for Chisel
  packs) and verify a pinned `npm run build`.

### Add or update Chisel assets

- Start with the [Chisel authoring skill](.agents/skills/run-chisel-assets/SKILL.md)
  and the [pack color briefs](tools/run-chisel-packs/contracts/data/color-direction.json).
  Start new assets with `npm run scaffold` in `tools/run-chisel-packs`.
- Build, validate, and export the catalogs. Use `snapshot` to check the mesh
  and `lineup` to check its scale against the 1.80 m adult. For assets that
  interact, check the actual fit at the pose used in the scene.
- Run `npm run verify:visual -- --only '^(09|10)'` from `tools/run-chisel-packs`
  after the showcase local build. Review screenshots at desktop, 390 px, and
  320 px before staging. See the [Chisel commands](tools/run-chisel-packs/README.md).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution requirements and
[GETTING_STARTED.md](GETTING_STARTED.md) for onboarding.
