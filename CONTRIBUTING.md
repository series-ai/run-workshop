# Contributing

Thanks for helping improve run-workshop.

## Before you contribute

You may submit a contribution only if you qualify as **"You"** under the [RUN Repository Supplemental License v1.0](LICENSE.md):

- You have an active, registered RUN Platform account in good standing.
- You have agreed to and remain bound by the applicable [RUN Terms](https://policy.run.world/eula.html) (User Terms, Creator Terms, Community Standards, and Privacy Policy).

Cloning, forking, or opening a pull request does not by itself grant rights under the license.

## Developer Certificate of Origin

By submitting a contribution, you accept the [Developer Certificate of Origin (DCO) v1.1](https://developercertificate.org/) and certify that:

1. The contribution was created in whole or in part by you and you have the right to submit it under the repository license.
2. The contribution is based on previous work that, to the best of your knowledge, is covered by an appropriate open source license and you have the right under that license to submit that work with modifications.
3. You understand and agree that this project and the contribution are public and that a record of the contribution is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.

You accept the DCO by checking the certification boxes in the pull request template. You do not need to add a `Signed-off-by` trailer to your commits, so you are not required to publish a name or email in commit history.

Pull requests without all certification boxes checked should not be merged.

## License for contributions

Unless Series Entertainment has a separate written agreement with you, any contribution you submit is licensed under the [RUN Repository Supplemental License v1.0](LICENSE.md), including its automatic conversion to the MIT License on January 1, 2028.

By submitting a contribution, you represent that:

- You have all rights necessary to license the contribution under this license.
- The contribution is your original work, or you otherwise have permission to submit it.
- The contribution does not include third-party code, assets, or other materials unless they are clearly identified and accompanied by a license that permits inclusion and onward licensing under this license.
- The contribution does not contain confidential information and does not infringe or misappropriate anyone else's rights.
- You are not subject to any agreement, obligation, or restriction that conflicts with these representations.

## Third-party materials

Do not add third-party software, assets, or other materials unless:

- Their license permits inclusion and redistribution under this repository's license terms.
- You add the required attribution to the affected sub-project's `THIRD_PARTY_NOTICES.md` (indexed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
- You include the applicable license notice or SPDX identifier on the affected files.

## Secrets and credentials

Never commit secrets. This includes API keys, deploy tokens, and per-account
RUN configuration:

- Real keys belong in `.env` (gitignored). Commit a placeholder `.env.example`
  instead. CI reads keys from GitHub Actions secrets.
- `game.config.*.json` files are per-account RUN game bindings created by
  `rundot init` and the sandbox plugin. They are gitignored — run `rundot init`
  to generate your own rather than committing one.
- `RUNDOT_API_KEY` (`rk_…`) and publishable keys (`pk_…`) must never be
  committed.

A secret scanner enforces this in two places:

- **Locally** via a pre-commit hook. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

- **In CI** via the **Secret Scan** workflow, which blocks the pull request if a
  likely secret is found.

Both run the same detector, `scripts/secret-scan.sh`. If it flags a confirmed
false positive, append `# secret-scan: allow` to that line.

### Personal pre-commit checks

You may add your own local-only checks without requiring other contributors to
run them. Create an executable `.githooks.local/pre-commit` script in your clone:

```bash
mkdir -p .githooks.local
$EDITOR .githooks.local/pre-commit
chmod +x .githooks.local/pre-commit
```

The shared `.githooks/pre-commit` hook runs it after the required secret scan
and passes the staged file paths as arguments. The `.githooks.local/` directory
is gitignored, so scripts in it stay private to your clone.

## Large files (Git LFS)

Binary assets (audio, images, video, 3D models, archives) are stored with
[Git LFS](https://git-lfs.com). The tracked patterns live in `.gitattributes`.
Install Git LFS once per machine before cloning or contributing assets:

```bash
git lfs install
git config core.hooksPath .githooks
```

`git lfs install` configures the clean/smudge filters, and `core.hooksPath`
points Git at the shared `.githooks/` hooks (`post-checkout`, `post-commit`,
`post-merge`, `pre-push`) that keep LFS objects in sync. Without these, asset
files check out as small text pointers instead of real binaries, and pushes can
fail to upload LFS objects.

When adding a new binary type, add its glob to `.gitattributes` so it is tracked
by LFS rather than committed directly into Git history.

## Pull requests

Use the pull request template and confirm all required certification checkboxes before requesting review.

Keep changes focused. Clearly describe what changed and why.

If your change is security-sensitive (workflows, dependencies, credentials), check the
matching boxes in the template so reviewers can prioritize it.

## Security

Report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

### CI safety for community pull requests

Community pull request workflows are untrusted. This repository encodes several
guardrails:

- **Secret Scan** blocks likely secrets in tracked files.
- **Workflow Security** blocks unpinned GitHub Actions and `pull_request_target`.
- **Dependency Review** runs when dependency manifests or lockfiles change.
- **Contribution Certification** requires legal attestations in the PR description.

Forked pull requests do not receive repository secrets. Do not add workflows that
need secrets to run on every community pull request.

### GitHub Actions pinning

Pin third-party actions to a full 40-character commit SHA, not a moving tag:

```yaml
uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
```

`scripts/workflow-security-check.sh` enforces this in CI. Local actions, Docker
images, and runner images (`ubuntu-latest`) produce warnings when they cannot be
SHA-pinned; prefer fixed runners such as `ubuntu-24.04` and image digests when
possible.

Dependabot opens weekly pull requests to refresh pinned GitHub Actions.

### AI-assisted review

Maintainers may use AI to help review pull requests. To do that safely:

- Do not run AI review automatically on fork pull requests with repository secrets.
- Prefer `workflow_dispatch` or a maintainer-triggered comment workflow that verifies the actor before using secrets.
- Send only the diff and metadata to the model; do not execute untrusted pull request code in secret-backed jobs.
- Treat AI output as advisory; a human maintainer remains responsible for merge decisions.

## Review and merge

Maintainers may decline or request changes to any contribution that does not meet these requirements or that has not checked all certification boxes.

Changes to security-sensitive paths listed in [.github/CODEOWNERS](.github/CODEOWNERS) require review from the listed owners.

## Branch protection

The default branch requires a pull request with at least one approving review before merge. Required status checks:

- **Contribution Certification**
- **Secret Scan**
- **Workflow Security**

Add **Dependency Review** as a required check once dependency manifests exist in the repository.

New commits after approval require re-review.

### Repository settings to verify (not encoded in git)

Confirm these GitHub settings manually or via org policy:

- Require approval for first-time contributors before workflows run.
- Default `GITHUB_TOKEN` permissions: read-only.
- Secret scanning and push protection enabled.
- Dependabot alerts enabled.
- Restrict who can approve and merge pull requests.
