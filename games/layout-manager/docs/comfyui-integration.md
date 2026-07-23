# ComfyUI Integration

Layout Manager can run your local ComfyUI workflows directly from the toolbar. This is a power-user feature — you bring your own workflows, your own models, your own setup. Layout Manager just gives you a UI on top.

## Quick Setup

### 1. Launch ComfyUI with CORS enabled

The browser needs permission to talk to your local ComfyUI server. Add the `--enable-cors-header` flag when you launch:

```bash
python main.py --enable-cors-header "*"
```

If you run ComfyUI through a custom script, edit it to include the flag. For example:

```bash
# Before
python3 main.py --listen

# After
python3 main.py --listen --enable-cors-header "*"
```

Without this flag, Layout Manager will show "Not connected" in the ComfyUI panel and the WebSocket will fail.

### 2. Set the server URL in Layout Manager

Open **Preferences → AI**. The default `http://127.0.0.1:8188` covers a standard local setup. Change it if you run ComfyUI on a different port or host.

### 3. Open the ComfyUI panel

Click the **Workflow** icon (last AI button on the toolbar). You should see:
- **Connection bar** showing green dot + your server URL = connected
- **Workflow** dropdown listing JSONs found in the project's `comfy-workflows/` folder

If the connection bar is red, click the refresh button next to it. Make sure ComfyUI is actually running and reachable.

---

## Where to Put Workflows

Drop your workflow JSON files into:

```
LayoutManager/comfy-workflows/
```

Layout Manager picks them up at request time, so you can drop in a new workflow and it appears the next time you open the modal — no restart needed.

The two example workflows that ship with the project (`Flux2Klein_txt2img.json` and `Flux2Klein_img2img.json`) are reference implementations of the conventions described below.

---

## Exporting a Workflow from ComfyUI

In ComfyUI, build the workflow you want, then:

1. Click **Save (API Format)** in the menu (this is **different** from the regular "Save" — make sure you pick API format)
2. Save the `.json` file into your `LayoutManager/comfy-workflows/` directory
3. Open Layout Manager, the workflow appears in the ComfyUI panel dropdown

The regular "Save" exports a UI-format workflow that won't work — only "Save (API Format)" produces the right structure.

---

## Tagging Nodes for Layout Manager

Layout Manager looks at each node's **title** (right-click a node → "Title" in ComfyUI) and exposes the ones starting with `$` as inputs in the modal.

### Required: Output node(s)

You **must** title at least one output node `$Output`:

| Node | Title |
|---|---|
| `PreviewImage` | `$Output` |

This is where Layout Manager pulls the result from. We recommend `PreviewImage` over `SaveImage` because ComfyUI auto-cleans the temp folder, but either works.

**Multiple outputs:** If your workflow produces more than one image (e.g., a depth pass alongside the final render), title each one with anything that **starts with** `$Output` — `$Output1`, `$Output2`, `$OutputDepth`, `$OutputAlbedo`, etc. all qualify. Layout Manager will collect images from every matching node and drop each one onto the canvas.

### Inputs you can expose

Title any node `$<Label>` to expose it as an input. The label after the `$` becomes the field name in the modal.

| If you title a... | ...node of class_type | ...you get | Field used |
|---|---|---|---|
| `$Prompt` | `PrimitiveStringMultiline` | Multiline textarea | `value` |
| `$Subject` | `PrimitiveString` | Single-line text input | `value` |
| `$Steps`, `$Seed`, `$Width`, `$Height` | `PrimitiveInt` or `PrimitiveFloat` | Number input | `value` |
| `$Image`, `$Reference` | `LoadImage` | Image picker (uses canvas selection) | `image` |
| `$Negative` | `CLIPTextEncode` | Multiline textarea | `text` |
| `$LoraPower`, `$LoraStrength` | `LoraLoader` or `LoraLoaderModelOnly` | Number input | `strength_model` |
| `$Anything` | _other_ | Generic text/number input (best-effort) | first scalar input |

You can name the inputs whatever you want — `$Prompt`, `$Positive`, `$Subject Description`, all work. The label in the modal is whatever you put after the `$`.

### Special-cased titles

A few title names get extra UI treatment:

- **`$Width` + `$Height`** — when both are present, they render side-by-side on one row instead of stacked.
- **`$Seed`** — gets a "Randomize?" checkbox next to the label (on by default). When on, Layout Manager generates a fresh random seed on every run (including each iteration of a batch). Uncheck it to lock the seed to a value you type.

These are matched case-insensitively (`$width`, `$Seed`, `$SEED` all work).

### Anything not tagged is locked

Nodes without a `$`-prefixed title use the values you saved in the workflow. You can't change them from Layout Manager. This is intentional — workflows can have hundreds of nodes; you only expose what the user actually needs to edit.

---

## Image Inputs (`$Image`)

When a workflow has a `$Image` LoadImage node, Layout Manager:

1. Asks you to **select an image on the canvas**
2. **Flattens any paint layers** on that selection (so paint applied in Layout Manager is included)
3. **Uploads the flattened image** to ComfyUI's `input/` folder via `POST /upload/image`
4. **Patches the workflow** so the LoadImage node reads the uploaded filename

If you have multiple images selected, the first one is used. If no image is selected, the Generate button is disabled and you get a message in the modal telling you to select one.

---

## Running a Workflow

1. Pick a workflow from the dropdown
2. Fill in any exposed inputs
3. Click **Generate**
4. The progress toast updates in real time:
   - "Connecting to ComfyUI..."
   - "Running node X..." (whichever node is currently executing)
   - "Generating... N/M" (sampling progress)
5. Result drops onto the canvas as a new image element when done

You can hit **Stop** mid-run to interrupt the workflow. Layout Manager calls ComfyUI's `/interrupt` endpoint and closes the WebSocket.

### Batch (`Count`)

Set **Count** to N to run the workflow N times in a row. ComfyUI processes one workflow at a time, so batches run sequentially. The progress toast shows `[2/5] ...` so you can see where the batch is. Hitting **Stop** interrupts the current run and skips the remaining ones. If your workflow has a `$Seed` input with **Randomize?** checked, every run gets a fresh seed (otherwise every batch run produces the same image).

### Unload Model

Click **Unload Model** in the connection bar to tell ComfyUI to free the loaded model from VRAM/RAM. Useful if you're switching to other GPU work and don't want ComfyUI hanging onto the model. The next generation will reload the model (a few seconds) and then run normally.

### Time estimates

Layout Manager records how long each successful **warm** run takes (measured from prompt submit to result delivery — model-load time is not included since that only happens on the first run after a load). Samples are stored in a side file next to the workflow:

```
comfy-workflows/
  Flux2Klein_txt2img.json
  Flux2Klein_txt2img.timing.json   ← timing samples
```

The file format keys samples by dimension (e.g. `1024x1024`) and caps at the last 20 samples per dimension. When you pick a workflow with samples on file, the modal shows an "Estimated: ~Xs per run" line under the inputs. The first run after a model load (or after **Unload Model**) is treated as the cold start and is not recorded — instead the modal shows "First run after model load — measuring for future estimates".

---

## Troubleshooting

### "Not connected" / WebSocket fails

ComfyUI isn't running, or wasn't launched with `--enable-cors-header "*"`. The HTTP side goes through Layout Manager's Vite proxy and works without CORS, but the WebSocket connects directly from the browser and needs CORS.

### Workflow shows up but inputs are weird

Layout Manager couldn't auto-detect what kind of input a node should produce. Check:
- The node's `class_type` is one we recognize (see table above)
- If it's a custom node type, the fallback exposes the first scalar (non-array) input as a generic text/number field — usually the right thing
- Make sure you used **Save (API Format)**, not regular Save

### "No images in output — workflow may have errored"

The workflow ran but produced no images at the `$Output` node. Common causes:
- The workflow errored mid-run (check ComfyUI's terminal output for stack traces)
- A model the workflow references isn't installed in ComfyUI
- The `$Output` node isn't actually wired to the rest of the graph

### Workflow doesn't appear in the dropdown

- File must be in `LayoutManager/comfy-workflows/`
- File must end in `.json`
- File must be valid JSON (try opening it in a browser tab to verify)
- Close and reopen the ComfyUI modal to re-scan the folder

---

## Architecture Notes

For developers / debugging:

- **HTTP requests** (workflow submit, image upload, history, /view) → proxied through Vite at `/__comfy/<path>?target=<url>` to bypass CORS
- **WebSocket** (live progress events) → connects directly from the browser to `ws://<comfyUrl>/ws?clientId=<uuid>` (this is why CORS flag matters)
- **Workflow files** → discovered via Vite plugin reading `comfy-workflows/*.json` at request time
- **API key** → not used; ComfyUI is local and unauthenticated by default

The integration code lives in:
- `src/workspace/ai/comfyClient.ts` — workflow submission, parsing, WebSocket handling
- `src/workspace/ai/ComfyModal.tsx` — UI
- `vite.config.ts` `comfyPlugin()` — `/__comfy-workflows` and `/__comfy/*` proxy
