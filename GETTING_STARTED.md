# Getting Started with RUN

This is the shared onboarding guide for **run-workshop**. Every game starter,
tool, and tutorial in this repo links here for the common setup, then documents
its own specifics in its own `README.md`.

## What is RUN?

**RUN** is Series Entertainment's AI game & media creation and publishing platform [run.world](https://run.world). You build a game against the RUN game SDK, develop it locally in a browser sandbox, and publish it to the platform.

Two pieces show up throughout this repo:

- **`@series-inc/rundot-game-sdk`** — the game SDK a starter depends on. It
  provides the runtime APIs (storage, purchases, multiplayer, generation, …) and
  the Vite plugins that power the local playground.
- **`rundot`** — the platform CLI. You authenticate once with `rundot login`,
  then use it to bind a game (`rundot init`), generate content
  (`rundot generate`), mint sandbox keys (`rundot playground`), and deploy.

You need a registered RUN Platform account to sign in and publish. Everything in
this repo is source-available under the
[RUN Repository Supplemental License v1.0](LICENSE.md).

## What is run-workshop?

A community-centric collection of game starters, tools, and tutorials for
building on RUN. Each sub-project under `games/` is a **self-contained** project
(its own `package.json`, dependencies, and docs) — there is no shared monorepo
tooling. Clone the repo once, then work inside whichever sub-project you want.

## Prerequisites

Install these once per machine:

- **Node.js 20+** and **npm 10+**
- **Git** and **[Git LFS](https://git-lfs.com)** — binary assets (audio, images,
  video, 3D models) are stored with LFS
- The **`rundot` CLI** — install it below

Individual sub-projects may need extra tools (for example, BeatBoard uses
`ffmpeg` for audio pack authoring). Check the sub-project's `README.md` for its
own prerequisites.

## Install the `rundot` CLI

The `rundot` CLI is what you use to initialize, manage, generate content for,
and deploy your games.

**macOS / Linux** — run this, then restart your terminal so it can find the CLI:

```bash
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash
```

**Windows** — run this in PowerShell:

```powershell
irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex
```

Verify the install:

```bash
rundot --help
```

The CLI alerts you when a new version is available; update manually with
`rundot update`. Full platform walkthrough (SDK install, `rundot init`,
deploying) lives in the
[RUN docs](https://series-1.gitbook.io/rundot-docs/readme/getting-started).

## One-time setup after cloning

```bash
git lfs install                      # configure LFS clean/smudge filters
git clone <repo-url>
cd run-workshop
git config core.hooksPath .githooks  # enable secret-scan + LFS sync hooks
```

`git lfs install` ensures binary assets check out as real files instead of text
pointers. `core.hooksPath` points Git at the shared `.githooks/` hooks that run
the secret scanner before each commit and keep LFS objects in sync. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full hook and secret-handling details.

## Authenticate the CLI

```bash
rundot login
```

This stores a session the CLI reuses for `rundot generate`, `rundot init`, and
deploys. You do **not** put an API key in `.env` for normal local development —
sign in through the sandbox toolbar in the browser instead. A headless
`RUNDOT_API_KEY` (minted with `rundot playground`) is only needed to run a dev
server with no browser sign-in (CI / automation).

## Run your first game starter

1. Pick a game from the [Games](README.md#games) list in the repo README.
2. `cd` into it (for example, `cd games/beat-board`).
3. Follow that sub-project's `README.md` — typically:

```bash
npm install
npm run dev
```

4. Open the dev server and sign in through the sandbox toolbar (Google
   Sign-In).

## Where to go next

- **Build a game** — start from a starter under `games/` and read its `README.md`.
- **Author content** — sub-projects document their own pipelines (for example,
  BeatBoard's [pack-authoring guide](games/beat-board/docs/authoring-packs.md)).
- **Contribute** — read [CONTRIBUTING.md](CONTRIBUTING.md) for account
  eligibility, the DCO, and CI guardrails.
- **Report a vulnerability** — see [SECURITY.md](SECURITY.md).
- **Platform docs** — the RUN game SDK and platform reference live in the
  [RUN docs](https://series-1.gitbook.io/rundot-docs/readme/getting-started);
  starters also vendor SDK docs locally under `.rundot-docs/` once tooling has run.
