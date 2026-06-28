# Scratch

This directory is for **local, throwaway work** that should never be committed.

Use it when you want to:

- prototype a game or tool without polluting the main tree
- run `rundot init` and experiment with a fresh project
- try a starter or tutorial in isolation

Everything under `scratch/` is gitignored except this file. Create subdirectories freely
(`scratch/my-game/`, `scratch/spike-foo/`, etc.).

When something is ready to share, move or recreate it as a proper contribution under the
appropriate top-level path (starter, tool, tutorial) and open a pull request.

**Do not put secrets here expecting privacy from git** — the pre-commit secret scan and CI
still apply if you force-add ignored files. Keep API keys in `.env` (also gitignored).
