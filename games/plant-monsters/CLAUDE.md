<!-- ASSET BOT START -->
# Asset Bot

Game asset generation with consistency and multi-format support. You interact with Asset Bot through its CLI.

## Quick Start

```bash
asset-bot status --json              # Project status
asset-bot generate image --help      # See generation flags
asset-bot assets list --json         # List all assets
```

All commands accept `--json` for structured output and `--project <path>` to override project detection. Project path is auto-detected by walking up from the current directory to find `.asset-bot/`.

## Credentials

API keys are configured via `asset-bot apikey set` (per-project) or `asset-bot global apikey set` (global). Use `asset-bot apikey list` to see all supported keys.

## Critical Rules

1. **Literal prompts only.** Image/video/3D models interpret text literally. Never use metaphors or figurative language. Write "knight standing with sword raised above head", not "warrior channeling inner strength".

2. **Style comes from reference images, never from text.** When style refs exist, the text prompt describes only the subject. Refs carry the aesthetic. See `.claude/skills/pipeline/references/CONSISTENT-PIPELINE-REFERENCE.md` for the full policy.

## When the User Asks to Generate Assets

Read the matching skill FIRST — do not run any command until you have read it:

| User intent                                   | Skill to read        |
| --------------------------------------------- | -------------------- |
| "generate image", "create art", "concept art" | `generate-image`     |
| "pixel art", "sprite", "tileset"              | `generate-pixel-art` |
| "3D model", "mesh"                            | `generate-3d`        |
| "audio", "sound", "music"                     | `generate-audio`     |
| "full pipeline", "populate assets"            | `pipeline`           |

Before ANY `asset-bot generate` command you MUST:

1. **Write literal prompts.** No metaphors, no figurative language. Describe exactly what should appear in the output.
2. **Never put style in the text prompt.** Style is carried by reference images only.
3. **Check `refs/style/` for reference images.** If the directory is empty or missing, bootstrap style references before generating.

## Before Using Any Command

Read the relevant skill first. Each one documents workflows, constraints, and examples:

```
.claude/skills/pipeline/               — End-to-end asset pipeline orchestration
.claude/skills/generate-image/         — 2D image generation
.claude/skills/generate-pixel-art/     — Pixel art, sprites, tilesets
.claude/skills/generate-3d/            — 3D model pipeline
.claude/skills/generate-from-template/ — Template-based generation
.claude/skills/generate-audio/         — SFX, music, voice
.claude/skills/generate-multiview/     — Multi-angle views
.claude/skills/generate-scene/         — 3D scenes / environments
.claude/skills/manage-assets/          — Asset CRUD, templates, project status
.claude/skills/ui-kit/                 — UI panel/button/icon sheets
.claude/skills/marketing-art/          — Store listings, feature graphics
.claude/skills/rig-animate/            — 3D rigging and animation
.claude/skills/sync-assets/            — Import/export to game projects
```

For exact command flags and parameters, use the `get_cli_reference` MCP tool.

Prompt style guides and API references live in each skill folder under `.claude/skills/*/references/`.

## Extensions

Asset Bot supports project-local extensions under `.asset-bot/extensions/`. Extensions let you add new generation backends or workbench tools without editing Asset Bot itself.

```bash
asset-bot extension list              # List discovered extensions
asset-bot extension create <id> --kind generation-adapter   # Scaffold a new adapter
asset-bot extension create <id> --kind workbench-plugin     # Scaffold a new plugin
asset-bot extension enable <id>       # Enable an extension
asset-bot extension validate <id>     # Validate an extension
asset-bot extension docs              # Regenerate extension reference files
```

Extensions are `.mjs`-based with no build step required. Use `asset-bot extension ...` commands to manage extension manifests instead of editing `extension.json` by hand. See `.asset-bot/extensions/EXTENSIONS-REFERENCE.md` for details on installed extensions.

Asset Bot injects an `sdk` object as the third argument to every extension handler at runtime. Generation adapters receive `generate(ctx, input, sdk)` and workbench plugins receive `handleRequest(req, res, sdk)`. The SDK provides `sdk.generation.*` (image, 3D, audio, dispatch, prompt helpers) and `sdk.transforms.*` (remove background, upscale, optimize mesh, etc.). All SDK methods return `Result` types (`{ ok, data }` or `{ ok, error }`) and never throw. Each scaffolded extension includes a `types.d.ts` for editor autocompletion.
<!-- ASSET BOT END -->
