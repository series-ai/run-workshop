# INKLINE Showcase UI Contract

**Specification:** T4 Showcase UI (`.plans/inkline.html`)  
**Package:** `games/inkline-showcase`  
**Date:** 2026-09-24  
**Design Aesthetic:** Editorial industrial design-tool (`#eeece5` warm off-white, `#151716` charcoal, `#d45538` burnt orange).

---

## 1. Module Ownership & Boundary Discipline

Per the project instructions, the UI subsystem exclusively owns:
- `src/App.tsx`
- `src/styles.css`
- `src/components/UI*.tsx`
- `docs/ui-contract.md`

`src/main.tsx`, `src/types.ts`, `src/components/Stage.tsx`, and `src/runtime/` are strictly owned by the coordinator and runtime workers. No package changes, fake fallbacks, or any direct state mutations are permitted.

---

## 2. Stage Component Integration Contract

The 3D canvas viewport is mounted via `<Stage />`:

```tsx
import { Stage } from './components/Stage'

<Stage
  settings={settings}       // StageSettings
  manifest={manifest}       // PackManifest (or empty manifest boundary fallback)
  onStats={handleStats}     // (stats: StageStats) => void
/>
```

### StageSettings Contract
```ts
export interface StageSettings {
  mode: ViewMode              // 'overview' | 'assets' | 'avatars' | 'animations' | 'effects' | 'district' | 'combat' | 'parkour' | 'performance'
  districtLayout: 'district' | 'service-yard' | 'roof-works'
  ambientEffects: boolean
  modelId: string             // Selected model or avatar preset id
  animationId: string         // Selected animation clip id
  effectId: string            // Selected VFX preset id
  avatar: AvatarConfig        // Current avatar customization config
  camera: CameraMode          // 'perspective' | 'side' | 'top' | 'third-person'
  playing: boolean            // Animation playback state
  speed: number               // Animation playback rate (0.25 - 2.0)
  wireframe: boolean          // Wireframe rendering flag
  outlines: boolean           // Inked contour lines toggle
  figureCount: number         // Figure count in performance scene (1 - 100, default 20)
  effectCount: number         // Active effect bursts in performance scene (0 - 40, default 10)
  quality: 'mobile' | 'high'  // Rendering quality pass toggle
  trigger: number             // Incremented to fire/pulse selected VFX
  reset: number               // Incremented to reset stage/camera/position
}
```

- All setting modifications use **immutable state updates** (`setSettings(prev => ({ ...prev, ...updates }))`).
- No unsupported properties (e.g. `density`) are added to settings.

---

## 3. Procedural Effects Catalog Contract

Imported directly from `./runtime/effects`:

```ts
import { EFFECTS } from './runtime/effects'
```

Each effect conforms to:
```ts
export interface EffectEntry {
  id: string
  label: string
  category: string
  duration: number
  description: string
}
```

- VFX triggers increment `settings.trigger`.
- Effect stroke highlights render using `settings.avatar.accent`.

---

## 4. Interactive Input Bus (`inkline-input`)

Combat and parkour interactive scenes listen to native window CustomEvents:

```ts
export type InputAction =
  | 'left'
  | 'right'
  | 'forward'
  | 'back'
  | 'jump'
  | 'attack'
  | 'dash'
  | 'reset'

window.dispatchEvent(
  new CustomEvent('inkline-input', {
    detail: { action: InputAction, pressed: boolean }
  })
)
```

- **Touch Controls:** On-screen D-Pad and action buttons attach `onPointerDown` (`pressed: true`) and `onPointerUp` / `onPointerCancel` / `onPointerLeave` (`pressed: false`).
- **Keyboard Mappings:** WASD / Arrow Keys (movement), Space (jump), J (attack), Shift (dash), R (reset). Hardware keyboard events are owned by the Stage; touch UI emits identical CustomEvents.
- **HUD Telemetry:** Realtime display of `stats.score` and `stats.message`.

---

## 5. Avatar Configuration & Strict Validation

```ts
export interface AvatarConfig {
  preset: string
  color: string
  accent: string
  height: number
  thickness: number
  headScale: number
  headwear: 'none' | 'cap' | 'headband' | 'beanie' | 'visor' | 'helmet'
  equipment: string | null
}
```

### Constraints & Invariants
- **12 Presets:** `stick-standard`, `stick-runner`, `stick-fighter`, `stick-tall`, `stick-compact`, `stick-heavy`, `stick-scout`, `stick-acrobat`, `stick-worker`, `stick-agent`, `stick-striker`, `stick-sentinel`.
- **Height Bounds:** `0.85` to `1.15` (clamped).
- **Thickness Bounds:** `0.70` to `1.30` (clamped).
- **Head Ratio Bounds:** `0.80` to `1.20` (clamped).
- **Equipment:** Filtered from manifest props matching categories `weapons`, `sports`, `sci-fi`, or tagged `held`.
- **Storage:** Persisted safely to `localStorage` under `inkline_avatar_v1` with `try/catch` and consolidated schema validation.
- **Export / Import:** Clean JSON export; import validates schema using `runtime/physics.ts validateAvatar` against the catalog and displays explicit error feedback on failure.

---

## 6. Manifest Loading & Error Boundaries

- URL: `./assets/manifest.json`.
- Validated with boundary guard `isPackManifest(data)`.
- Stage renders ONLY after manifest has loaded and passed validation.
- Visible loading overlays and runtime error overlays (from StageStats and manifest loading) provide honest telemetry and reset/retry actions without claiming nonexistent procedural fallback.
- Model catalog provides search, category filtering, polycount sorting, and pagination (18 items/page) to prevent loading hundreds of images simultaneously.

---

## 7. Performance & Diagnostics Telemetry

- **No Fake Data:** FPS, frame time, draw calls, triangles, geometries, and textures display real values from `StageStats`. No stats are displayed until the first telemetry frame arrives.
- **Android Target Disclaimer:** Explicitly marks the 60 FPS 720p target with 20 figures and 10 effects as **UNVERIFIED on physical Android hardware**, avoiding false claims.
- **Measured Benchmark Export:** Generates downloadable JSON captures with active settings, browser user agent, viewport dimensions, and verified/unverified status tags.

---

## 8. Layout & Accessibility Standards

- **Desktop (1440px):** 3 columns (slim rail navigation, dominant live 3D viewport, compact inspector). Header mode title and subtitle are kept concise to prevent multi-line overflow.
- **Mobile (390px):** Usable live 3D stage canvas paired with compact scrollable inspector and horizontal tab navigation.
- **Accessibility:**
  - High contrast ratios meeting WCAG AA standards.
  - Visible focus indicators (`:focus-visible` with 2px offset).
  - Keyboard focus containment and Escape closing for all modal dialogs.
  - Tactile active press response (`transform: translateY(1px)`).
  - Reduced-motion queries disable all animations (`@media (prefers-reduced-motion: reduce)`).
  - Clean inline SVG icons without external dependencies.
