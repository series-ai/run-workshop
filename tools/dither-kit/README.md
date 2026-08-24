# dither-kit

Engine-agnostic GPU dithering core, extracted from
[Dither Playground](../../games/dither-playground/). Pure TypeScript with zero
runtime dependencies: a typed config becomes a uniform map plus a single GLSL
fragment shader implementing 7 dithering algorithms (Bayer 2/4/8, blue noise,
halftone dot/line/diamond, crosshatch, stipple), 10 retro palettes, and 18
named presets. Shipped as TypeScript source — no build step.

## Usage

Add it as a file: dependency:

```json
"dither-kit": "file:../../tools/dither-kit"
```

Then feed the uniforms and shader into your post-processing pipeline:

```ts
import {
  getDitherUniforms,
  DITHER_FRAGMENT_SHADER,
  PRESET_GAMEBOY_CLASSIC,
  type DitherEffectConfig,
} from 'dither-kit';

const uniforms = getDitherUniforms(PRESET_GAMEBOY_CLASSIC.config);
// → Record<string, { value: number | Float32Array }> matching the uniforms
//   declared in DITHER_FRAGMENT_SHADER (mainImage-style fragment, as used by
//   the `postprocessing` Effect API; adapt for raw WebGL/three as needed).
```

For a React Three Fiber + `postprocessing` bridge, see
`games/dither-playground/src/dither/DitherPostProcess.tsx`.

## Public API

- `getDitherUniforms(config)` / `updateDitherUniforms(uniforms, dt)` —
  uniform generation and per-frame time advance.
- `DITHER_FRAGMENT_SHADER` — the fragment shader string.
- `GPU_DITHER_ALGORITHMS`, `MAX_COMPARE_CELLS` — algorithm list and compare
  grid capacity.
- Types: `DitherEffectConfig`, `GpuDitherAlgorithm`, `CompareCellAlgorithm`,
  `CompareGridConfig`, `ResolveMaskConfig`, `PalettePreset`, `DitherPreset`,
  `PresetCategory`.
- Palettes: `PALETTE_*_RAW` (10), `PALETTE_PRESETS`.
- Presets: `PRESET_*` (18), `ALL_PRESETS`, `PRESET_CATEGORIES`, `DEFAULT_*`
  slider defaults.

## Commands

- `npm test` — unit tests (uniforms, shader contents, presets)
- `npm run typecheck` — strict tsc, no emit
