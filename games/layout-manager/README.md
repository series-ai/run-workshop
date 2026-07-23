![Layout Manager](public/readme-banner.webp)

# Layout Manager

A browser-based image layout, composition, and AI-assisted generation tool. Built for arranging, aligning, and compositing images on a freeform workspace — with integrated AI tools for generating images, removing backgrounds, and chatting with multiple AI providers.

## Recommended Browser

**Use a Chromium-based browser (Chrome, Brave, Edge, etc.)** — strongly recommended for any non-trivial session. Layout Manager works with large 2K+ images, paint layers, and undo history that can run into hundreds of MB of heap. Chromium browsers handle this workload noticeably better than Firefox, and they expose the `performance.memory` API that powers the **MEM** indicator in the toolbar so you can watch heap usage live and bake or save before things get tight. On Firefox the app still runs, but the MEM readout falls back to tracked-blob bytes only and you'll be flying blind on heap pressure.

## Easy Install (No Terminal Needed)

Layout Manager runs on your own computer, in your browser. You need to do two things once: install Node.js, and download this project. After that, starting the app is a double-click.

### Windows

**Step 1 — Install Node.js (one time)**

1. Go to [nodejs.org](https://nodejs.org) and click the big green **LTS** download button.
2. Open the downloaded installer and click **Next** through every screen (the defaults are fine), then **Install**.

**Step 2 — Download Layout Manager (one time)**

1. On this GitHub page, click the green **<> Code** button near the top, then **Download ZIP**.
2. Find the ZIP in your Downloads folder, right-click it, and choose **Extract All…**. Extract it somewhere easy to find, like your Desktop or Documents.

**Step 3 — Start the app**

1. Open the extracted `LayoutManager` folder and double-click **`start.bat`**.
   - If Windows shows a blue "Windows protected your PC" screen, click **More info**, then **Run anyway**. (Windows shows this for any script it hasn't seen before.)
2. A black window opens. The **first time**, it installs the app's dependencies — this takes a minute or two. Let it finish.
3. Your browser opens Layout Manager automatically. You're in!
4. **Keep the black window open** while you use the app — it *is* the app. When you're done, just close it.

Next time, it's only step 3 — double-click `start.bat` and the app opens in a few seconds.

### Mac

**Step 1 — Install Node.js (one time)**

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version for macOS.
2. Open the downloaded `.pkg` file and click **Continue** through the installer.

**Step 2 — Download Layout Manager (one time)**

1. On this GitHub page, click the green **<> Code** button near the top, then **Download ZIP**.
2. Double-click the ZIP in your Downloads folder to unpack it. Move the `LayoutManager` folder somewhere easy to find, like Documents.

**Step 3 — Start the app**

1. Open the `LayoutManager` folder. **Right-click** (or Control-click) **`start.command`** and choose **Open**.
   - The first time, macOS warns that it's from an unidentified developer. Click **Open** in that dialog. (You only need the right-click trick once — after that a normal double-click works.)
   - If macOS only offers **Cancel** / **Move to Trash**: go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**, then try again.
2. A Terminal window opens. The **first time**, it installs the app's dependencies — this takes a minute or two. Let it finish.
3. Your browser opens Layout Manager automatically. You're in!
4. **Keep the Terminal window open** while you use the app. When you're done, just close it.

Next time, it's only step 3 — double-click `start.command` and the app opens in a few seconds.

### Linux

You've got a terminal — use it:

```bash
# 1. Install Node.js 18+ (pick your flavor)
sudo apt install nodejs npm        # Debian/Ubuntu
sudo dnf install nodejs npm        # Fedora
sudo pacman -S nodejs npm          # Arch
brew install node                  # Bazzite (Homebrew ships with it — don't layer packages)
# Other immutable distros (Silverblue, Kinoite, etc.): use Homebrew, mise/nvm,
# or a distrobox instead of rpm-ostree layering.

# 2. Get Layout Manager
git clone https://github.com/series-ai/LayoutManager.git
cd LayoutManager

# 3. Install dependencies and run
npm install
npx vite --open
```

The dev server stays in the foreground — Ctrl+C stops it. Next time it's just `npx vite --open` from the project folder (dependencies are already installed). Update with `git pull` (rerun `npm install` if `package.json` changed).

### Troubleshooting

- **"Node.js is not installed" error** — do Step 1, then close the window and start again. On Windows, if you installed Node while the window was open, restart your computer (or at least the launcher) so it's picked up.
- **Browser doesn't open** — look in the launcher window for a line like `Local: http://localhost:5173` and type that address into Chrome yourself.
- **Something looks broken** — close the launcher window, delete the `node_modules` folder inside `LayoutManager`, and double-click the launcher again to reinstall fresh.
- **Updating to a new version** — download the ZIP again and replace your old folder (your saved `.layout` files are wherever you saved them, not inside the app folder, so they're safe).

## Getting Started (Developers)

If you're comfortable in a terminal:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser. (`npm install` / `npx vite` works too — that's what the double-click launchers use.)

### AI Features Setup (Optional)

AI features call provider APIs directly — no extra CLI install needed. You only need API keys for whichever providers you want to use.

Open **Preferences > AI** in Layout Manager and paste your API keys, or click **Import .env** to load them from a file.

#### Supported API Providers

| Provider | Key | Used For |
|---|---|---|
| **Google GenAI** (Nano Banana) | `GOOGLE_GENAI_API_KEY` | Text/reference-to-image generation, AI chat |
| **OpenAI** | `OPENAI_API_KEY` | Text-to-image generation, AI chat |
| **xAI (Grok)** | `XAI_API_KEY` | AI chat (text only, no image support) |
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | AI chat |

Not all keys are required. Only add the providers you plan to use.

#### No-Key Providers (AI Chat)

These chat providers need no API key at all:

| Provider | Requirement | Notes |
|---|---|---|
| **Claude Code** | [Claude Code](https://claude.com/claude-code) installed and logged in on the machine running Layout Manager | Chats through the local CLI using your Claude Pro/Max login. Text only, no model choice, and usage counts against your subscription's rate limits (shared with claude.ai and Claude Code itself) — the chat panel shows a disclaimer to this effect. All CLI tools are disabled, so it behaves as pure chat. |
| **KoboldCpp** | A local KoboldCpp server (default `http://127.0.0.1:5001`) | Chats with whatever model is loaded. URL configurable in **Preferences > AI > Local Models**. |
| **Ollama** | A local Ollama server (default `http://127.0.0.1:11434`) | Uses the model set in Preferences, or auto-picks your first installed model if left blank. |

Local models support images if the loaded model is multimodal (e.g. llava); text-only models will ignore or reject them.


## Features

### Workspace
- Welcome screen on startup with new-page presets, recent update notes, and quick open
- Infinite pannable, zoomable workspace with grid background
- Pages (canvas overlays) with size presets for framing exports
- Rulers with draggable guides for precise alignment
- MEM indicator with a Free Memory action that clears undo history to release deleted images
- Snap-to-edge and snap-to-guide when moving images
- Text elements with Google Fonts, size, color, alignment, and bold/italic/underline

### Image Manipulation
- Drag-and-drop or file-picker import (PNG, JPG, GIF, WebP, SVG)
- Drag images from the web (Midjourney, Reddit, Google, etc.) with CDN hotlink protection handling
- Move, resize (aspect-locked by default), and rotate images
- Crop overlay for trimming images non-destructively
- Split images into grids (UV-style)
- Scale filter toggle: bicubic (smooth) or nearest-neighbor (crisp pixel art)
- Non-destructive image adjustments — brightness, contrast, saturation, and hue per element (baked into pixels on demand)
- Lossless PNG optimization on import via oxipng WASM

### Paint Editor
- Multi-layer paint system with blend modes
- Per-layer adjustments (brightness / contrast / saturation / hue) in the layer properties panel
- Brush-based painting with customizable brushes
- Text layers within the paint editor (resizable text boxes, Google Fonts)
- Stroke effects on layers
- Full undo/redo within the paint editor

### Masking
- Brush-based mask painting with hide/reveal tools
- Adjustable brush size presets
- Mask undo/redo, invert, and fill-selection support
- Apply or cancel mask edits non-destructively

### Selection & Layers
- Click, Ctrl+click, Ctrl+drag marquee, or Ctrl+A to select
- Multi-select group transform box with proportional scale and rotate handles
- Layer ordering via context menu or keyboard shortcuts
- Node tree panel showing image hierarchy with parent/child relationships
- Element parenting (drag link button onto another element)

### Alignment
- PureRef-style collision-slide alignment (Ctrl+Arrow keys)
- Scale normalization: match tallest, shortest, or normalize to average height

### AI Tools

All AI tools are accessible from the toolbar. They can be hidden entirely from **Preferences > AI > Hide AI Features**.

#### Text to Image / Reference to Image
- Generate images from text prompts using Nano Banana (Google GenAI) or OpenAI
- **Nano Banana**: aspect ratio picker (1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16) + image size (1K / 2K / 4K)
- **OpenAI gpt-image-1**: size variants (1024², 1024×1536, 1536×1024), quality (low/medium/high), transparent background option
- Select images on the workspace as style references (up to 5) — this covers image-to-image: the reference images carry the source, the prompt describes the change. Paint layers are flattened and included
- Batch generation (configurable count)
- Provider picker with API key status
- Persistent prompt across sessions

#### Remove Background
- Runs through the ComfyUI integration (see below), using the bundled workflow source at `comfy-workflows_source/BackgroundRemoval_API_LM.json` (built on the [ComfyUI-RMBG](https://github.com/1038lab/ComfyUI-RMBG) BiRefNet node)
- One-time setup: install ComfyUI-RMBG in your ComfyUI, load the workflow source there, then **Save (API Format)** into `comfy-workflows/` — see [`docs/comfyui-integration.md`](docs/comfyui-integration.md)

#### AI Chat
- Multi-provider chat: Claude, Gemini, OpenAI, Grok
- **Claude Code provider** — no API key: chats through your locally installed Claude Code CLI using its Claude Pro/Max login (text only, tools disabled; an in-panel disclaimer notes that usage shares your subscription limits)
- **Local LLM providers** — KoboldCpp and Ollama servers running on your own machine, configured under **Preferences > AI > Local Models**
- Streaming responses
- Drag images into chat or attach selected workspace images (up to 5)
- Auto-describe mode: sends image-only messages with a generation-focused prompt
- Copy button on AI responses for easy prompt extraction
- Edit/reuse button on your messages
- Resizable, draggable panel
- Conversation persists when closing/reopening
- New Chat button to clear history
- Stop button to cancel streaming responses

#### ComfyUI Workflows (Local)
Run your own ComfyUI workflows directly from Layout Manager. For power users.

- Connects to your local ComfyUI server (default `http://127.0.0.1:8188`)
- Drop workflow JSONs (saved in API format) into `comfy-workflows/`
- Title any node `$Something` in ComfyUI to expose it as an input — `$Prompt`, `$Width`, `$Image`, etc.
- Title the output `PreviewImage` node `$Output` so Layout Manager knows where the result comes from
- Auto-detected input types based on node class: `PrimitiveStringMultiline` → textarea, `PrimitiveInt`/`PrimitiveFloat` → number, `LoadImage` → image picker (uses canvas selection with paint layers flattened)
- Live progress streamed from ComfyUI's WebSocket
- Stop button cancels mid-run via `/interrupt`
- Connection bar with refresh button — surface "ComfyUI not running" instead of silently failing

> **Important:** ComfyUI must be launched with the `--enable-cors-header "*"` flag, otherwise the browser cannot open a WebSocket to it and the connection bar will stay red. Example:
> ```bash
> python main.py --enable-cors-header "*"
> ```
> If you launch ComfyUI through a custom script, edit it to include the flag (e.g. `python3 main.py --listen --enable-cors-header "*"`). This is the most common reason "Not connected" stays red even when ComfyUI is clearly running.

See [`docs/comfyui-integration.md`](docs/comfyui-integration.md) for full setup, tagging conventions, and troubleshooting.

#### Progress & Feedback
- Progress toast with real-time generation count
- Stop button to cancel running generations
- Completion ding sound on finish
- Delete button on elements when AI panels are open (since keyboard delete is blocked)
- Trash button flashes red when Delete key is pressed as a visual hint

### Export
- PNG, JPG, and WebP export with a quality slider for lossy formats
- Page info JSON export
- Save/load `.layout` project files (all images embedded as base64); Save updates the opened file in place
- Sprite sheet import from JSON + PNG pairs
- Source Manager for reviewing and replacing image sources

### Preferences
- Multiple themes with custom accent colors
- Frosted glass panel toggle
- Grid and ruler visibility
- Default scale filter
- Smart scale override for large images
- AI settings: hide AI features, API keys (obfuscated in localStorage), .env import, max batch count

## Keyboard Shortcuts

### General

| Shortcut | Action |
|---|---|
| Ctrl+S | Save project |
| Ctrl+Shift+S | Save project as |
| Ctrl+O | Open project |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+A | Select all |
| F | Frame selection (or all) |
| S | Toggle snapping |
| T | Text tool |
| Escape | Close context menu / cancel |

### Image Manipulation

| Shortcut | Action |
|---|---|
| Delete / Backspace | Delete selected |
| D | Duplicate selection |
| Q | Toggle onion skin (60% opacity) |
| C | Enter crop mode |
| O | Enter offset mode |
| M | Enter mask mode |
| Ctrl+] | Bring forward |
| Ctrl+[ | Send backward |
| Arrow keys | Nudge selection (10px) |
| Shift+Arrow keys | Nudge selection (1px) |
| Ctrl+Arrow keys | Align selection |

### AI Modals

| Shortcut | Action |
|---|---|
| Ctrl+Enter | Generate (in prompt textarea) |
| Enter | Send message (in AI chat) |
| Shift+Enter | New line (in AI chat) |
| Escape | Close modal |

### Viewport

| Shortcut | Action |
|---|---|
| Space+drag | Pan |
| Middle-click+drag | Pan |
| Scroll wheel | Zoom (centered on cursor) |
| Ctrl+click | Toggle selection |
| Ctrl+drag (empty space) | Marquee selection |
| Shift (while resizing) | Free resize (ignore aspect ratio) |
| Shift (while rotating) | Snap to 15-degree increments |

## Tech Stack

- **React** 18 + **TypeScript**
- **Vite** 6 (dev server, bundler, and AI backend proxy)
- Direct provider APIs: Google GenAI (Gemini / Nano Banana), OpenAI (gpt-image-1), Anthropic (Claude), xAI (Grok)
- DOM-based rendering with CSS transforms (not HTML5 Canvas)
- State management via `useReducer` (no external libraries)
- API keys obfuscated with XOR + base64 in localStorage

## Project Structure

```
src/
  workspace/
    Workspace.tsx          Main workspace component
    Toolbar.tsx            Top toolbar with all buttons
    ImageNode.tsx          Individual image element rendering
    InfoPanel.tsx          Draggable properties panel
    Preferences.tsx        Settings dialog (themes, workspace, AI)
    CanvasMenu.tsx         Page menu and export
    useWorkspaceState.ts   State management (reducer + history)
    userConfig.ts          Config persistence with key obfuscation
    ai/
      AiChatPanel.tsx      Multi-provider AI chat
      TextToImageModal.tsx Text/reference-to-image generation modal
      ComfyModal.tsx       ComfyUI local workflow runner
      aiClient.ts          Direct provider API communication (SSE streaming)
      comfyClient.ts       ComfyUI server communication (HTTP + WebSocket)
      completionSound.ts   Audio feedback
      flattenNode.ts       Paint layer compositing for AI input
      useDraggableModal.ts Shared drag behavior for panels
    paint/                 Paint editor subsystem
comfy-workflows/           Drop your ComfyUI workflow JSONs here (API format)
comfy-workflows_source/    UI-format workflow sources (load in ComfyUI, re-export as API)
vite.config.ts             Dev server + direct AI API proxies + ComfyUI proxy
```

## License

Part of the [run-workshop](../../) repository — see the repository [LICENSE.md](../../LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
