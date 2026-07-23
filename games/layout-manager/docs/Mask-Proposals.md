# Mask Proposals — Paint/Masking Tools for Layout Manager

## Goal
Add masking / basic paint tools so users can paint away parts of an image. Need: hard brush, soft brush (hardness falloff), selection tools, flood fill. Mask data must save/load in .layout files.

---

## Option A: Klecks (kleki.com engine)

**What it is**: Full open-source painting app (MIT, TypeScript, actively maintained)

### Strengths
- 7 brushes: pen, eraser, blend, smudge, sketchy, pixel, chemy
- Eraser uses alpha (`destination-out`) — real transparency painting on non-base layers
- 16 layers with blend modes (multiply, screen, overlay, etc.)
- Selection tools: rect, ellipse, lasso, polygon with union/difference
- Flood fill tool
- PSD export/import via `ag-psd`
- Programmatic extraction: `getPNG()` / `getPSD()`
- Color picker, undo/redo

### Weaknesses
- **No independent hardness slider** — pen brush draws hard circles only. Eraser derives softness from opacity (`sharpness = Math.pow(opacity, 2)` controls radial gradient stop). Chalk alpha has procedural Perlin noise, not Photoshop-style soft round
- No magic wand (color-based selection)
- No feathered selection edges

### Embedding Problem
Klecks was built as a full-page app, NOT a component:
- Sizes to `window.innerWidth/Height` — assumes viewport ownership
- Global CSS: `body { overflow: hidden }`, `* { box-sizing: border-box }`, `color-scheme: light` on `:root`
- Global event listeners: captures all paste, blocks pinch-zoom with `preventDefault()`
- Singleton — only one instance allowed (enforced by guard)
- No shadow DOM, styles leak both ways
- `position: fixed` loading screens
- Author explicitly warns against iframes due to browser bugs

### Integration Paths
1. **iframe** — simplest isolation, communicate via `postMessage`. Author warns against it but may work on desktop
2. **Fork and scope** — replace window sizing with container-relative, namespace CSS, scope global listeners. Significant work but clean integration
3. **Full-page takeover** (recommended) — hide workspace, Klecks takes full page, user edits, hits Submit, get PNG back, workspace returns. Least engineering effort. Feels intentional — like switching to "editor mode"

### Serialization
- Store result as `maskDataUrl` (base64 PNG) on each `ImageNode`
- PNG compression on alpha mask is efficient (5-50KB per image)
- PSD format also available for full layer preservation

### Source
- GitHub: https://github.com/bitbof/klecks
- Live: https://kleki.com
- Embed example: `/examples/embed/example.html`
- Embed API: `new Klecks({ onSubmit })` → `klecks.openProject({...})` → `klecks.getPNG()` / `klecks.getPSD()`

---

## Option B: libmypaint.js — DEAD, Not Viable

**What it is**: Emscripten port of MyPaint's libmypaint (same brush engine as Krita/GIMP)

### Status: Effectively dead
- Last commit: **December 2015** (pre-WASM era, asm.js)
- 12 stars, 1 fork, zero open issues
- Build requires ancient Grunt + Emscripten SDK — won't work on modern toolchains
- **No modern forks or alternative WASM ports exist** — searched extensively
- Nobody has recompiled the upstream libmypaint C library to WASM

### Verdict
Would need to compile current libmypaint C library yourself with modern Emscripten to WASM. Significant undertaking. Not viable.

### Source
- GitHub (stale): https://github.com/vitalipe/libmypaint.js
- Upstream C library: https://github.com/mypaint/libmypaint

---

## Option C: glbrush.js — Confirmed Real, But Lacking

**What it is**: WebGL + Canvas 2D rendering library for painting apps. MIT license, 59 stars.

**Live demo**: http://oletus.github.io/glbrush.js/example.html — demo is underwhelming in practice.

### Strengths
- 16-bit internal precision for soft brush rendering
- WebGL-accelerated with Canvas 2D fallback
- Full layer stack with 10+ blend modes
- Vector-based serialization

### Weaknesses
- **Unmaintained since ~2019**
- Demo quality is poor — doesn't inspire confidence
- No selection tools, no flood fill
- JavaScript only (Closure compiler annotations, not TypeScript)
- Would need all tool UI built on top

### Verdict
Real but not compelling. The demo doesn't deliver on the promises. Easy-Brush with custom tips is a better path.

### Source
- GitHub: https://github.com/Oletus/glbrush.js

---

## Option D: Easy-Brush — LEADING CANDIDATE

**What it is**: Standalone Canvas 2D brush engine with Photoshop-style parameters

### Source Code Deep Dive

**Architecture**: ~800 lines of TypeScript, zero runtime dependencies. Uses a multi-canvas internal system:
1. **Source canvas** — the one you pass in (displayed to user)
2. **Original canvas** — snapshot before current stroke
3. **Stroke canvas** — current stroke stamps accumulate here
4. **Transfer canvas** — intermediate; stroke composited here with opacity
5. **Shape canvas** — the brush tip image (optional custom tip)

**Custom brush tip = our hardness control**: `loadImage()` accepts `HTMLCanvasElement`, `HTMLImageElement`, or URL string. On load, it fills with `source-atop` (preserves alpha, replaces color). This means:
- Supply a radial gradient canvas with soft alpha edges → **soft brush**
- Supply a hard circle → **hard brush**
- A **hardness slider** just regenerates the brush tip canvas at runtime
- This is exactly how Photoshop works internally — the brush tip IS the softness

**Stamping mechanism**: Distance-based spacing (`config.spacing * config.size`, min 0.5px). Interpolates between input points via quadratic Bezier curves with equidistant sampling. Pressure linearly interpolated between endpoints. A 5px input lag smooths movement. No gaps on fast mouse strokes.

**Flow vs Opacity (Photoshop-correct model)**:
- **Flow** (`config.flow`, 0-1) = `strokeContext.globalAlpha` per stamp. Stamps accumulate on strokeCanvas.
- **Opacity** (`config.opacity`, 0-1) = `transferContext.globalAlpha` per stroke. Caps maximum stroke density.

**Compositing**: `blendMode` property accepts any `globalCompositeOperation` value. Set to `destination-out` for erasing/masking.

**Pressure**: Caller passes pressure explicitly via `putPoint(x, y, pressure)`. Library is fully decoupled from DOM events. Includes `MousePressure` helper that simulates pressure from mouse velocity.

**Built-in undo**: ImageData snapshot-based. Default 10 steps. For mask canvases (not 4K images) this is fine on memory.

**Optional modules** (all skippable — user said they'd disable scatter/jitter):
- `DynamicShapeModule` — jitters size, angle, roundness
- `DynamicTransparencyModule` — jitters opacity/flow
- `SpreadModule` — scatter/spray
- `PatternModule` — texture overlay

### Known Bug: `endStroke()` blend mode
`endStroke()` merges the stroke onto `oriCanvas` using default `source-over`, ignoring the `blendMode` setting. For `destination-out` erasing, the live preview works but the merge paints instead of erases. **Fix: ~2 line patch** to apply `blendMode` in `endStroke()`.

### Known Issue: `BrushImager` is a stub
The `createCustomImage` method is a no-op. Unfinished feature. Not needed — we generate our own brush tip canvases.

### What we build on top
- **Hardness slider** → generates radial gradient canvas → `brush.loadImage(canvas)`
- **Flood fill** → `q-floodfill` npm package or ~50 lines of scanline fill
- **Selection rect** → clip canvas region before painting
- **MaskOverlay UI** — toolbar (size, hardness, flow sliders), cursor preview, tool switching
- **Mask layer management** — separate canvas composited over the image via `destination-out` or as alpha channel

### API Summary
```typescript
const brush = new Brush(canvas, {
  size: 20,        // brush diameter
  opacity: 1,      // per-stroke cap
  flow: 0.8,       // per-stamp alpha
  spacing: 0.25,   // 25% of size between stamps
  roundness: 1,    // 1 = circle
  angle: 0,
  color: '#000000',
});
brush.blendMode = 'destination-out'; // for erasing
brush.loadImage(softBrushTipCanvas);  // custom tip for hardness

// In pointer event handlers:
brush.putPoint(x, y, event.pressure);
brush.render();  // starts rAF loop

// On pointerup:
brush.finalizeStroke();

// Undo/redo:
brush.undo();
brush.redo();
```

### Strengths
- Photoshop-correct flow/opacity model
- Custom brush tip = full hardness control (radial gradient trick)
- Zero dependencies, ~800 lines TypeScript, <10KB bundled
- Framework-agnostic, takes any canvas
- Clean API — caller owns pointer events and UI entirely
- Built-in undo/redo
- MIT license, semi-active (June 2024)

### Weaknesses
- One known bug (endStroke blend mode — easy patch)
- Small community (14 stars)
- 8-bit Canvas 2D precision (may show banding on very large soft brushes — usually fine for masking)
- No layers, selection, flood fill — build on top
- BrushImager stub (irrelevant, we make our own tips)

### Source
- GitHub: https://github.com/DQLean/Easy-Brush

---

## Option E: Roll Your Own (Canvas API)

**What it is**: Build everything from scratch using browser Canvas API

### How soft brushes work (industry standard — confirmed by Photopea, Krita, GIMP sources)
1. **Stamp a brush tip** (radial gradient circle) along the stroke path at regular intervals
2. **Hardness** controls gradient falloff: 100% = solid circle, 0% = linear falloff from center
3. **Flow** = per-stamp opacity
4. **Opacity** = per-stroke maximum cap (composite stroke to temp canvas)
5. **Spacing** = distance between stamps, typically 10-25% of brush diameter
6. Input points smoothed via quadratic curves or Catmull-rom splines

### Verdict
Easy-Brush already implements all of this correctly. Rolling your own would duplicate ~800 lines of already-written, tested TypeScript. Not recommended unless Easy-Brush proves fundamentally unsuitable.

---

## Option F: Hybrid — Klecks Full-Page + Easy-Brush Inline

**What it is**: Easy-Brush for inline masking, Klecks for power editing

### Concept
- For masking (erase brush, paint bucket, selection fill), use Easy-Brush in a `MaskOverlay` component — follows the existing `CropOverlay` pattern, stays in the workspace
- For serious multi-layer editing, launch Klecks in full-page takeover mode
- Both store the mask as base64 PNG on `ImageNode`

### Advantages
- Inline masking is fast — no context switch for quick edits
- Klecks available for power users who need layers/blending
- No embedding headaches (Klecks gets full page, Easy-Brush is just a canvas)

---

## Exhaustive npm/GitHub Search — No Hidden Gems

A thorough search across 10+ npm terms ("canvas brush", "paint brush", "brush engine", "canvas paint", "freehand drawing", "canvas eraser", "stamp brush", "brush stroke", etc.) and multiple GitHub queries confirmed:

**The niche of "give me a canvas, here are configurable soft brushes with stamping" is genuinely underserved on npm.** Easy-Brush is essentially the only standalone library that exists in this space.

### Everything else found (and why it doesn't help)

**Simple line-drawing (no stamping, no soft brushes):**
- `atrament` — well-maintained (5.9KB), smooth adaptive-width lines via `lineTo()`. Draw/erase/fill modes. But no brush stamping, no custom tips, no softness control.
- `canvas-free-drawing` — TypeScript, ~11KB. Basic freehand. Not a brush engine.
- `signature_pad` — popular (474 dependents), variable-width Bezier curves. Designed for signatures, not painting.

**React-coupled (can't extract easily):**
- `react-artboard` — has airbrush, watercolor, paintbrush tools in TypeScript. Interesting but tools are React hooks, not true stamp-based rendering. Last updated ~2 years ago.

**Full apps (not extractable as libraries):**
- `DPaint-js` — impressive Deluxe Paint clone (900+ stars, active). But a complete application, not a library.
- `SkyBrush` — embeddable painting widget. Dead (2021), no real brush stamping.
- `painterro` — image annotation widget (~2K downloads/week). Basic line drawing for annotations.

**Dead projects not on npm:**
- `WickBrush` — interesting physics-based smoothing with pluggable brush tips. Dead (2021), JavaScript only, not on npm.
- `brushes.js` — preset variety brushes (charcoal, marker, etc.). Dead (2021), not on npm.

**Fabric.js-dependent and abandoned:**
- `fabric-brush` — crayon, ink, marker, spray. v0.0.1, 6 years old.
- `@arch-inc/fabricjs-psbrush` — pressure-sensitive. 4+ years inactive.

**Utilities (not brush engines):**
- `lazy-brush` — coordinate smoothing math only. Draws nothing.

### Conclusion
Easy-Brush, glbrush.js (unmaintained), and rolling your own are the entire field. Easy-Brush is the clear winner for a maintained, lightweight, framework-agnostic brush engine with the features we need.

---

## Photopea — NOT usable

**Status**: Fully proprietary. Ivan Kutskir has explicitly stated "It is not open-source."

Cannot extract, copy, or reuse any Photopea code. Ivan has published some MIT utility libraries (UZIP.js, UTIF.js, Typr.js) but nothing related to brush/painting engines.

**Useful as reference only** — confirmed that Photopea uses the same stamp-along-path technique as everyone else, with WebGL for compositing (15x faster than CPU).

---

## Useful Utility Libraries

| Library | What it does | Stars | License |
|---------|-------------|-------|---------|
| **perfect-freehand** | Smooth pressure-sensitive stroke outlines (1.2KB) | High | MIT |
| **croquis.js** | Stroke stabilization, Photoshop-like input smoothing | 231 | MIT/Apache |
| **gonnavis/brush** | Evenly-spaced stamp events along stroke path | Small | — |
| **q-floodfill** | TypeScript flood fill algorithm, zero deps | — | — |

---

## Reference: How the Pros Do It

### Photopea (Ivan Kutskir) — proprietary, reference only
- Layer pixel data stored in **WebGL memory**
- All blend modes composited via WebGL
- Brushes work by **stamping copies of the brush tip** along the stroke path
- 2048x1152 canvas + 10 layers: 850ms CPU-only → **55ms with WebGL** (15x)
- ~100K+ lines of JS by one developer

### SIGGRAPH 2024: Ciallo — GPU-Accelerated Brush Strokes
- Academic paper on GPU brush rendering theory by Shen Ciao
- Interesting concepts (prefix-sum stamp placement, fragment shader quadratic solving) but **no practical library or usable code** — it's a tutorial/demo, not a tool
- Source: https://github.com/ShenCiao/brush-rendering-tutorial (TypeScript + GLSL, Three.js)

### Drawpile — GPLv3, study only
- Full Qt/C++ paint app compiled to **WebAssembly** for web client
- Paint engine ("drawdance") written in C with persistent/immutable data structures
- Web client: https://web.drawpile.net

---

## Comparison Matrix

| Feature | Klecks | glbrush.js | Easy-Brush | Roll Own | Hybrid (D+A) |
|---------|--------|------------|------------|----------|---------------|
| Hard brush | Yes | Yes | Yes (native) | Easy | Yes |
| Soft brush (hardness) | Eraser only | Yes (16-bit) | **Yes (custom tip)** | Medium | Yes |
| Flood fill | Yes | No | No (add ~50 lines) | ~50 lines | Yes |
| Selection tools | Yes (4 types) | No | No (add rect clip) | Medium | Yes |
| Layers | Yes (16) | Yes | No | Medium | Klecks only |
| Pressure sensitivity | Yes | Yes | Yes (caller-driven) | Easy | Yes |
| UI included | Yes (full) | No | No | No | Partial |
| Integration ease | Full-page only | Library | **Library (any canvas)** | Native | Mixed |
| Bundle size | ~250KB gzip | Unknown | **<10KB** | 0KB | ~260KB |
| Maintained | Active | Stale (2019) | Semi (2024) | N/A | Both |
| Dev effort | Low | High | **Medium** | High | Medium |
| Brush quality | Good | Best (16-bit) | Good (8-bit) | OK | Good |
| Known bugs | None for us | Unknown | 1 (easy fix) | N/A | 1 (easy fix) |

---

## Option G: RunPaint — OUR OWN PAINT APP (CHOSEN APPROACH)

**What it is**: A full paint application already built by the user at `/run/media/system/4TBDrive/Chris/series/RunPaint`. Same tech stack (React + TypeScript + Vite). Custom stamp-based brush engine with no external dependencies.

### Why this wins over everything else

RunPaint already has everything we researched and more — implemented, tested, and working:

| What we need | RunPaint has it? | Easy-Brush? | Notes |
|---|---|---|---|
| Stamp-based brush engine | Yes (292 lines) | Yes | Same technique — both stamp along path |
| Hardness/softness | Yes (`innerRatio = hardness²`, radial gradient, 3x radius expansion) | Via custom tip only | RunPaint's is built-in and tuned |
| Eraser (`destination-out`) | Yes | Buggy (endStroke ignores blendMode) | RunPaint works correctly |
| Flood fill | Yes (stack-based BFS, tolerance) | No — must add separately | Already done |
| Rectangle selection | Yes (marching ants) | No | Already done |
| Polygon selection | Yes (click-to-close, 3+ points) | No | Already done |
| Move tool | Yes (moves selected content) | No | Already done |
| Pressure sensitivity | Yes (normalized 0.5-1.0 range) | Yes (caller-driven) | Both work |
| Spacing control | Yes (0.05-2.0, distance-based) | Yes | Both work |
| Layer system | Yes (multi-layer, opacity, visibility, compositing) | No | Already done |
| Undo/redo | Yes (30 snapshots, ImageData) | Yes (10 snapshots) | RunPaint has more |
| Color picker | Yes (HSV wheel + SV square, hex input, recent colors) | No | Already done |
| Brush picker UI | Yes (size presets, sliders for all params) | No | Already done |
| Zoom/pan | Yes (0.1-5x, touch support) | No | Already done |
| Keyboard shortcuts | Yes (B, E, G, M, V, [, ], Ctrl+Z, etc.) | No | Already done |

**No external painting library needed.** The brush engine uses pure Canvas 2D — the same stamp-along-path technique confirmed by our research as the industry standard (Photoshop, Krita, GIMP, Photopea all do this).

### Source code breakdown

| File | Lines | Purpose | Reusable? |
|------|-------|---------|-----------|
| `brushes.ts` | 292 | Stamp-based brush rendering, hardness/spacing, flood fill | Direct extraction |
| `historyManager.ts` | 83 | Undo/redo with ImageData snapshots | Direct extraction |
| `layerManager.ts` | 86 | Layer compositing, checkerboard, PNG export | Adapt for mask layers |
| `PaintCanvas.tsx` | 540 | Canvas interaction, pointer events, selection, viewport | Refactor into MaskOverlay |
| `PaintApp.tsx` | 309 | State container, tool management, keyboard shortcuts | Reference for state design |
| `BrushPicker.tsx` | 160 | Brush settings panel (size, opacity, hardness, spacing) | Restyle for LayoutManager |
| `ColorPicker.tsx` | 358 | HSV color wheel + SV square | Restyle for LayoutManager |
| `LayerPanel.tsx` | 118 | Layer management UI | Optional — may not need for basic masking |
| `Toolbar.tsx` | 205 | Top bar and left sidebar UI | Restyle for LayoutManager |
| `types.ts` | — | BrushType, ToolType, Layer, Selection types | Direct extraction |

### What needs adapting

1. **Canvas size** — hardcoded 1080x1440, needs to match the image being masked
2. **MaskOverlay component** — adapt `PaintCanvas.tsx` into the `CropOverlay` pattern (full-screen editing mode with apply/cancel)
3. **Coordinate integration** — align mask canvas with workspace zoom/pan transforms
4. **Serialization** — export mask as `maskDataUrl` (base64 PNG) on `ImageNode`, save/load in .layout files
5. **Scope control** — primary use is masking (eraser on image), but architecture supports full painting if expanded later

### 8-bit precision note
Canvas 2D uses 8-bit color channels. Large soft brushes could theoretically show banding. For masking (monochrome alpha), this is almost never visible. If ever needed, fix is generating a higher-res brush tip and downscaling — not a rewrite.

---

## Final Decision

**Option G (RunPaint adaptation)** — use our own existing paint app as the foundation.

- Zero new dependencies
- Every tool we need already exists and works
- Same tech stack (React + TypeScript + Vite)
- We own the code completely
- Primary use: mask editing (erase parts of images)
- Expandable: full painting capabilities available since the engine supports it
- Mask data stored as base64 PNG on `ImageNode` — saves/loads in .layout files
