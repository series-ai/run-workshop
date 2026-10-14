# Plant Monster Game: Asset List

Derived from [DESIGN.md](DESIGN.md). Each asset has an ID for tracking in
asset-bot, a source, and a priority.

**Source** says how the asset gets made:

- **Generate**: produced with asset-bot (image, 3D or audio).
- **Download**: an existing, licensed asset (for example a Google Font).
- **In-engine**: built in code (CSS, shader, particles or procedural animation),
  so nothing needs generating.

**Priority**: **P0** is needed for the core loop (plant → wake → care → age up).
**P1** is polish. **P2** waits on an open design decision.

Items marked _(proposal)_ fill a gap in the design doc and need sign-off.

---

## 0. Style anchor

Generate this first. Every later image and 3D asset uses it as a reference so
the set stays consistent.

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `style-anchor` | Key art: the plant-shop room with 2–3 monsters | Generate (image) | P0 | Paper-craft terrarium, rainy afternoon, warm lamp light. Soft rounded shapes, muted naturals, the doc's palette. Becomes the asset-bot art style reference. |

## 1. Monsters (3D)

The bodies are eyeless pillow blobs. One mesh per type covers every age,
because age is a scale change (0.18× → 1.1×). The head plant is a separate
mesh so it can grow by stage and be swapped for elders.

Pipeline: 2D concept → 4-view turnaround → 3D mesh. The blobs have no skeleton,
so animation is procedural in-engine (squash and stretch, bob, wobble) rather
than rigged.

### Bodies

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `monster-mochi-body` | Mochi body | Generate (concept → 3D) | P0 | Forest green. _(proposal)_ Squat and round, like a rice cake. |
| `monster-fern-body` | Fern body | Generate (concept → 3D) | P0 | Garden green. _(proposal)_ Taller teardrop shape. |
| `monster-wiggly-body` | Wiggly body | Generate (concept → 3D) | P0 | Olive with amber accents. _(proposal)_ Long and squishy, like a caterpillar bean. |
| `monster-spike-body` | Spike body | Generate (concept → 3D) | P0 | Dark forest with teal accents. _(proposal)_ Soft rounded nubs, nothing pointed. |

### Head plants

_(proposal)_ Three growth stages per type: **sprout** (seedling, pup), **young**
(teen) and **full** (adult). The elder version is listed under P2 below.

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `plant-mochi-{sprout,young,full}` | Mochi plant ×3 | Generate (3D) | P0 | _(proposal)_ Clover or round-leaf succulent rosette. |
| `plant-fern-{sprout,young,full}` | Fern plant ×3 | Generate (3D) | P0 | Unfurling fern fiddleheads into fronds. |
| `plant-wiggly-{sprout,young,full}` | Wiggly plant ×3 | Generate (3D) | P0 | _(proposal)_ Curly vine tendril with an amber bud or flower. |
| `plant-spike-{sprout,young,full}` | Spike plant ×3 | Generate (3D) | P0 | _(proposal)_ Soft, rounded cactus or aloe with teal tips. No sharp spines. |
| `plant-{type}-elder` | Elder plant ×4 | Generate (3D) | P2 | Waits on "distinct look for elders". Could be a bloom, seed head or autumn colors. |

### Seeds

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `seed-{mochi,fern,wiggly,spike}` | Seed ×4 | Generate (3D) | P0 | One per type, tinted with that type's green and accent. Shown floating under the finger and sitting in the pot after planting. |

## 2. World (3D)

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `room-shell` | Room: floor, walls, two windows | Generate (3D) or in-engine | P0 | Sand wood floor, pale petal walls. Open on the camera sides so rotation works. Could also be simple geometry with generated textures. |
| `tex-floor-sandwood` | Sand wood floor texture | Generate (image) | P0 | Tileable. |
| `tex-wall-petal` | Pale petal wall texture | Generate (image) | P1 | Tileable, subtle paper grain. |
| `water-zone` | Water basin or pond | Generate (3D) + in-engine water shader | P0 | The blue drinking area. _(proposal)_ A shallow ceramic basin or indoor pond. |
| `pot-terracotta` | Planting pot | Generate (3D) | P0 | Earthy, rounded. _(open)_ How many pots, and should they vary in size or color? |
| `pot-variants` | 2–3 more pot styles | Generate (3D) | P1 | Glazed ceramic, woven basket, etc. |
| `prop-lamp` | Warm floor or table lamp | Generate (3D) | P0 | The main warm light source in the scene. |
| `prop-armchair` | Armchair | Generate (3D) | P1 | Furnishing. |
| `prop-rug` | Round rug | Generate (3D) | P1 | Furnishing. |
| `prop-shelf` | Plant shelf | Generate (3D) | P1 | Holds decorative potted plants. |
| `prop-side-table` | Side table | Generate (3D) | P1 | Furnishing. |
| `prop-decor-plants` | 3–4 decorative house plants | Generate (3D) | P1 | Background dressing. Must read clearly as non-monsters. |
| `prop-watering-can` | Watering can | Generate (3D) | P1 | Only needed if watering is a player action. |
| `window-rain` | Rain on window glass | In-engine (shader) | P1 | Rainy-afternoon mood. |
| `pot-glow-ring` | Pulsing green target ring | In-engine (shader) | P0 | Planting flow, step 3. |
| `lighting` | Afternoon window light and lamp | In-engine | P0 | Warm key light from the windows plus the lamp. |

## 3. UI (2D)

Panels, buttons, need bars, age badges and the seed grid are all CSS built from
the doc's spec (translucent blur, 6px corners, peach press-down buttons), so
they are not generated.

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `font-nunito` | Nunito 600/700/800 | Download (Google Fonts, OFL) | P0 | Use `font-variant-numeric: tabular-nums` for HUD digits. |
| `card-{mochi,fern,wiggly,spike}` | Seed card art ×4 | Generate (image) | P0 | For the 2×2 seed grid. Seed plus a hint of the adult monster on a Moss Shadow card. |
| `icon-plant-button` | 🌱 button icon | Generate (image) or emoji | P0 | The emoji works as a placeholder. A custom icon would match the style better. |
| `icon-need-{…}` | Need icons | Generate (image) | P0 | _(open)_ The doc mentions need bars but not which needs exist. Water is implied. Hunger, light or happiness are candidates. |
| `icon-age-{seedling,pup,teen,adult,elder}` | Age badge glyphs ×5 | Generate (image) or CSS | P1 | Badge colors come from the doc. A glyph is optional. |
| `ui-panel-texture` | Subtle paper grain overlay | Generate (image) | P1 | Optional paper-craft touch on panels. |
| `app-icon` | App icon | Generate (image) | P1 | _(open)_ Needs a game title. |
| `logo` | Title wordmark | Generate (image) | P2 | _(open)_ Needs a game title. |

## 4. VFX

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `fx-sprite-sheet` | Leaf, droplet, sparkle, petal and heart-leaf sprites | Generate (image) | P2 | Shared particle textures. |
| `fx-watering` | Watering particles | In-engine | P2 | Open in the doc. |
| `fx-age-up` | Age-up burst | In-engine | P2 | Open in the doc. |
| `fx-happy` | Happiness particles | In-engine | P2 | Open in the doc. |
| `fx-plant-puff` | Soil puff on planting | In-engine | P1 | Pairs with the planting thud. |

## 5. Animation (procedural, in-engine)

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `anim-wake` | Wake from seed | In-engine | P0 | Pairs with the wake chime. |
| `anim-walk` | Hop or squish locomotion, per type | In-engine | P0 | Movement carries personality, so each type moves differently. |
| `anim-drink` | Drink at the water zone | In-engine | P0 | |
| `anim-age-up` | Grow to the next stage | In-engine | P0 | Scale tween plus a head-plant swap. |
| `anim-idle-{stage}` | Idle per age stage | In-engine | P2 | Open in the doc. |
| `anim-critical` | Droop or wilt when a need is critical | In-engine | P1 | Pairs with the rustle sound. |

## 6. Audio

The doc's sound direction is a draft, so treat these as first-pass.

| ID | Asset | Source | Pri | Notes |
|---|---|---|---|---|
| `music-main` | Main loop | Generate (music) | P1 | Soft vibraphone and plucks, cozy, seamless loop. |
| `amb-room` | Room tone with light rain | Generate (SFX) | P1 | Loop. |
| `sfx-plant-thud` | Planting thud | Generate (SFX) | P0 | Gentle, soft soil. |
| `sfx-wake-chime` | Monster wakes | Generate (SFX) | P0 | Chime. |
| `sfx-age-up` | Age-up rising tones | Generate (SFX) | P0 | Warm. _(proposal)_ One per stage, each pitched a bit higher. |
| `sfx-rustle-critical` | Critical-need rustle | Generate (SFX) | P1 | Loopable. |
| `sfx-ui-tap` | Button press | Generate (SFX) | P0 | Soft pluck. |
| `sfx-seed-pickup` | Pick up a seed | Generate (SFX) | P0 | |
| `sfx-seed-cancel` | Seed returns to the grid | Generate (SFX) | P1 | |
| `sfx-drink` | Monster drinks | Generate (SFX) | P1 | |
| `sfx-squish-step` | Footstep or hop | Generate (SFX) | P1 | 2–3 variants. |
| `sfx-water-pour` | Watering | Generate (SFX) | P2 | Depends on the watering mechanic. |

---

## Open questions that block generation

1. **Head plants**: are the proposed plants right (Mochi clover or succulent,
   Fern fronds, Wiggly tendril, Spike soft cactus)?
2. **Needs**: which needs are there? This decides the need icons.
3. **Pots**: how many, and is there one style or several?
4. **Game title**: needed for the app icon and logo.
5. **Elders**: what makes them look distinct? Blocks the four elder plants.

## Suggested generation order

1. `style-anchor`, then register it as the asset-bot art style.
2. Four monster concepts (body plus full plant) for approval before any 3D.
3. Monster bodies, head plants and seeds in 3D.
4. P0 world assets (room, floor, water, pot, lamp).
5. P0 UI art (seed cards, icons) and P0 SFX.
6. P1, then P2 once the open questions are settled.
