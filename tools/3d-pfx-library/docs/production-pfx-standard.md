# Production PFX Standard

This is the acceptance standard for the R3F PFX library. It defines what
"high quality" means, how quality is proven, and how the 500-effect catalog is
improved without trading gameplay clarity or mobile performance for spectacle.

The target is one cohesive, genre-neutral stylized visual language. The
catalog's named styles are adaptations of that language, not separate quality
standards and not color swaps presented as new effects.

## Acceptance contract

| Taxonomy rank | Required grade | Required evidence |
| ---: | :---: | --- |
| 1-50 | A+ | Independent 12-dimension visual review, nine lifecycle/angle captures, reduced-motion proof, and passing iOS plus Android real-device profiles |
| 51-500 | A | The same evidence set; only the weighted visual-production threshold differs |

An A+ requires a weighted score of at least 4.7/5. An A requires at least 4/5.
Both grades require every visual dimension to score at least 4/5. A high
average cannot compensate for an unreadable silhouette, missing decay,
unverified reduced motion, or a failed device profile. A grade written into a
preset, implementation note, or generated dossier is not acceptance evidence.

The 12 visual dimensions are semantic identity, gameplay readability, volume
and depth, multi-angle resilience, silhouette and composition, temporal arc
and decay, material and shader quality, mesh structure and emitter quality,
CC0 asset integration, distinctiveness and ring discipline, scale and visual
hierarchy, and overall production polish. Mobile readiness is separately
non-compensable.

## The visual canon

### 1. Tell the gameplay truth first

The player must understand ownership, origin, direction, area, timing, and
danger before appreciating decoration. The footprint of a telegraph matches
the gameplay volume. A projectile's head and travel direction remain legible.
An impact locates contact. A pickup reward points back to the collected item.
Cosmetic layers may enrich the event but may not move or obscure its gameplay
boundary.

This follows Riot's separation of gameplay, value, color, shape, and timing in
the [League VFX Style Guide](https://nexus.leagueoflegends.com/en-us/2017/10/dev-leagues-vfx-style-guide/)
and VALORANT's separation of strict gameplay volumes from scalable cosmetic
layers in [Shaders and Gameplay Clarity](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity).

### 2. Match visual intensity to gameplay importance

Screen area, contrast, luminance, motion, duration, and sound hooks form an
intensity budget. Common ambient loops sit below ordinary actions; ordinary
actions sit below high-value hits; ultimate-scale or victory moments own the
largest budget. A low-value effect that visually outbids a high-value event is
a defect even when attractive in isolation.

### 3. Author a complete temporal sentence

Every effect has a readable anticipation or onset, a decisive peak, and a
motivated dissipation. The peak coincides with the gameplay event. Energy does
not pop into or out of existence accidentally. Residue loses energy through
scale, opacity, velocity, fragmentation, cooling color, or gravity. Loops have
an authored inhale/exhale or circulation rhythm and avoid obvious synchronized
resets. This applies Riot's emphasis on timing and impact and Unity's treatment
of shape, color, volume, speed, and timing in the
[Unity 6 VFX Graph guide](https://unity.com/blog/unity-6-vfx-graph-ebook).

### 4. Build one focal read, then support it

Use a three-level hierarchy:

1. focal event: the hit, core, edge, or readable gameplay boundary;
2. supporting body: volume, trail, shockwave, smoke, or field explaining the
   event;
3. accents: sparse sparks, motes, embers, fragments, or distortion.

Support layers must reinforce the focal read rather than become equal-weight
noise. Uniform particle size, evenly distributed brightness, and every layer
peaking together are production defects.

### 5. Design silhouette before texture

At gameplay scale and in grayscale, the effect still reads as its named
event. Directional events use directional mass. Radial events use controlled
asymmetry. Fields have an unmistakable boundary. Trails taper. Smoke has large,
medium, and small forms. Six-point starbursts, identical rings, and triangular
cards are primitives, not finished identities.

### 6. Prove volume from multiple cameras

World-space effects must survive front, three-quarter, and side views. Combine
camera-facing particles with optional oriented meshes, ribbons, shells, arcs, or
spatially separated emitters. A particle-only rig is valid when seeded spawn
lanes, per-particle orientation, and depth offsets preserve the silhouette from
all three cameras. Avoid flat cards that reveal themselves at side angles and
intersecting geometry that only works from the authoring camera.
Screen-space effects are exempt from world-volume construction but still need
layered depth cues and safe-area proof.

### Particle-first construction default

Meshes are a means, not a quality target. For short-lived bursts, begin with a
two-to-five-layer particle stack using shared atlas sprites, analytic motion,
and point or spatially authored spawning. Add a custom mesh only when a
semantic boundary, persistent volume, or material response cannot be expressed
by the particle renderer. A mesh may support a focal read; it must not replace
the layered stack merely to satisfy the `mesh structure and emitter quality`
dimension. Instanced sprite quads are the particle renderer's draw primitive
and do not count as a custom closed-mesh surface.

Before visual review, every particle-first recipe should have deterministic
checks for its draw-call and live-particle budgets, provenance, blend/death
rule, debris stretch, and front/three-quarter/side readability. These checks
turn the craft guide into an authoring gate instead of post-hoc advice.

### 7. Give materials physical and thematic roles

Core, body, edge, smoke, debris, and residue should not share one undifferentiated
additive treatment. Use additive blending for scarce energy accents, alpha or
premultiplied treatments for bodies and smoke, opaque/cutout treatment for
matter, and distortion only where its gameplay cost is justified. Texture
detail follows form and motion; it does not substitute for them. Clamp hot
cores so color survives bloom and mobile tone mapping.

### 8. Use controlled, seeded variation

Variation in spawn, size, rotation, velocity, lifetime, and phase prevents
mechanical repetition. It must be deterministic for capture, replay, tests,
and debugging. Preserve the stable gameplay silhouette while varying cosmetic
detail. Loops stagger clocks; bursts preserve their decisive shared beat.

### 9. Make every effect genuinely distinct

An effect must differ from nearby catalog entries in at least three non-color
dimensions: silhouette, motion, topology/emitter layout, material response,
timing, spatial role, or residue behavior. Palette, label, and particle-count
changes alone do not create a distinct effect. Repeated shared defects should
be fixed in the shared primitive before local recipes are polished.

### 10. Scale cosmetics, never gameplay information

LOD and reduced-motion variants retain origin, boundary, direction, timing,
and hit confirmation. They may reduce density, turbulence, flipbook rate,
secondary trails, distortion, and minor accents. They may not shrink a danger
area, hide a projectile head, remove a hit beat, or change the perceived event
time. Riot's [Art EDU VFX curriculum](https://www.riotgames.com/en/artedu/visual-effects)
frames the same discipline as restraint, clarity, and thematic cohesion.

## Cohesive neutral-stylized language

The default language uses clean readable masses, decisive silhouettes,
controlled gradients, restrained emissive peaks, large/medium/small shape
rhythm, and slightly exaggerated timing. It is stylized enough to remain clear
on a small screen but neutral enough to adapt to casual, fantasy, sci-fi, or
modern contexts.

Style adaptations may change edge language, surface breakup, motion cadence,
geometry, and material response. They must preserve the same gameplay read and
quality floor. A valid adaptation changes at least three non-color dimensions.
Color-only profiles are variants, not styles.

## Mobile production canon

The floor is real hardware from the 2022 model year or later on both required
platforms. The reference floor is iPhone SE (3rd generation) for mobile Safari
and Pixel 6a for Chrome Android: Apple identifies the former as introduced in
2022 in its [technical specifications](https://support.apple.com/en-ie/111866),
and Google identifies the latter as a 2022 phone in its
[Pixel hardware specifications](https://support.google.com/pixelphone/answer/7158570?p=specs&rd=1).
Newer devices may supplement but may not replace floor-device proof. Every raw
capture records the exact model and model year.

Passing evidence requires:

- sustained 60 FPS for at least 180 seconds at canonical tier concurrency;
- p95 frame time at or below 15 ms and worst frame at or below 25 ms, leaving
  headroom inside a 16.7 ms display interval;
- no shader-compilation stalls or material-frame hitches during the measured
  interval;
- nominal thermal state and no sustained memory growth above 1 MB;
- screenshot-readback overdraw evidence, draw-call and live-particle counts,
  CPU main-thread time, GPU time when available, memory, DPR, viewport, browser,
  OS, touch capability, and exact capture URL intent;
- the shared capped-DPR runtime policy and the effect's canonical concurrency.

Measure isolated effects and representative concurrent gameplay. Profile on
device, not only in desktop emulation. Capture cold-start shader compilation
separately from warmed steady state; neither may be hidden. Unreal's Niagara
guidance likewise recommends representative gameplay measurement, per-platform
effect types, culling, pooling, and emitter-count reduction:
[scalability and best practices](https://dev.epicgames.com/documentation/unreal-engine/scalability-and-best-practices-for-niagara),
[effect-type budgeting](https://dev.epicgames.com/documentation/en-us/unreal-engine/performance-budgeting-using-effect-types-in-niagara-for-unreal-engine),
and [measuring Niagara performance](https://dev.epicgames.com/documentation/en-us/unreal-engine/measuring-performance-in-niagara).

### Runtime construction rules

- Prefer shared instanced renderers, geometry, materials, and texture atlases;
  Unity documents the draw-call benefit of
  [particle-system GPU instancing](https://docs.unity3d.com/es/2019.4/Manual/PartSysInstancing.html).
- Pool frequently spawned systems and allocate typed arrays outside the frame
  loop. No per-particle React nodes or per-frame object churn.
- Bound spawn counts, lifetime, screen coverage, transparency layers, and
  overdraw. A cheap shader can still be expensive across large overlapping
  quads.
- Cull by visibility, distance, importance, and tier. Stop simulation when a
  hidden effect cannot affect gameplay.
- Keep gameplay-critical layers in the cheapest tier; shed distortion,
  secondary smoke, embers, and decorative trails first.
- Compile and warm shader/material variants before the measured gameplay path
  where the product allows it.
- Treat alpha fill rate, draw calls, CPU simulation, GPU vertex work, memory,
  and thermal behavior as separate budgets. Passing one does not excuse
  failing another.

The instanced sprite approach in
[wawa-vfx](https://github.com/wass08/wawa-vfx) is an MIT-licensed reference,
not acceptance evidence. External textures, meshes, and code must be CC0, MIT,
or equivalently permissive for this project, with source URL, license, author,
local derivative path, and modifications recorded. Never infer a license from
availability. Generated or procedural assets record their generator and seed.

## Evidence protocol

For every effect, the durable ledger points to:

- nine isolated captures: onset, peak, and decay from front, three-quarter,
  and side cameras;
- a representative gameplay-context capture proving scale, hierarchy, and
  clutter behavior;
- reduced-motion evidence captured through the shipped setting;
- an independent peer review with all 12 dimension scores, confidence,
  findings, and pass/rework verdict;
- raw mobile Safari and Chrome Android profile artifacts from qualifying
  devices;
- provenance for every external asset or borrowed implementation technique;
- before/after evidence for the current remediation iteration.

The implementer may produce captures and describe intent but may not award the
acceptance grade. A review is independent only when its actor/runtime is not
the implementation actor. Missing, malformed, stale, duplicate, or mismatched
evidence fails closed. Contact sheets, dossiers, templates, code-derived
metadata, and local Chromium telemetry are work aids, not approval.

## Continuous improvement loop

Each iteration is a small, reviewable experiment:

1. Assemble the latest valid evidence into the single 500-effect ledger.
2. Compute the target gap and group repeated defect keys.
3. Select the highest-leverage systemic defect; otherwise select the
   highest-ranked blocked effect.
4. Write a behavioral RED test or deterministic validator for the objective
   part of the change before implementation.
5. Improve one shared primitive or one small, coherent recipe family.
6. Run unit/type/build checks, capture before/after visual evidence, obtain an
   independent review, and run local performance diagnostics.
7. Run qualifying real-device profiles for any changed render path before
   granting performance pass.
8. Reassemble the ledger and compare it with the prior immutable snapshot.
9. Continue only on strict convergence; record the decision and next work item.

Convergence means at least one of these improved without any accepted effect
regressing: target passes increased, blocker count decreased, worst visual
score increased, weighted score increased, systemic defects decreased, or
minimum performance headroom increased. Any regression fails the iteration.
No movement is a plateau and requires a different hypothesis; repeated
plateaus or a genuine art/device-access blocker are surfaced to the user.

The loop is complete only when all 500 rows pass their rank target and both
real-device gates. "Most effects pass," local-only telemetry, a generated
quality score, or an unreviewed screenshot never completes the goal.
