# Reference-derived layer recipes

External references (Unity, Godot, Unreal, three.js, realtimevfx.com) mined for
how production-quality effects are layered, and the synthesized recipes we
implement in `AUTHORED_EFFECT_RECIPES`. Comp material is cited for technique
attribution only; all sprites we ship are CC0 (Kenney Particle Pack) and all
code is ours.

Conventions: layers listed back-to-front (draw order). "over distance" =
world-space spawn along the travel path. All fire/energy sprites are grayscale
atlas slices tinted by the 3-stop ramp (hot → base → tail), which matches the
gradient-mapping practice in the JangaFX fireball series.

## Fireball (projectile)

Sources: Gabriel Aguiar fireball spell tutorial (youtube -P09r-ALN38); URP fire
projectile walkthrough (youtube VpllBs22rHU); JangaFX realistic fireball series
(realtimevfx.com/t/6545); three.quarks muzzle example (API-shape corroboration).

1. **Glow halo** — 1 persistent soft-glow sprite, additive, 2.5–3× core size,
   `#ff8830 @ .35 → #ff5510 @ .2 → 0`, ±10% sine pulse. One sprite that doubles
   perceived brightness of everything over it.
2. **Fire shell** — flame sprites, additive, ~15/s loop, life 0.35–0.7, spawn in
   r≈0.15 sphere, size 0.8–1.1, random rotation 0–360° + spin ±20°/s,
   size-over-life 0.6→1.0(peak 30%)→0, ramp `#fff → #ffcc55 → #802200 → 0`.
3. **Fire core** — same sprite, ~10/s, life 0.25–0.5, size 0.6, brightness ×1.5,
   ramp pinned hot `#fff → #ffe9a0 → #ff9020 → 0`. Smaller, shorter, brighter.
4. **Ember trail** — star/spark sprites, additive, over distance ~10/unit, life
   0.5–1.5, size 0.05–0.4 (big variance), backward cone + wobble, ramp
   `#ffd080 → #ff6a00 → 0`.
5. **Sparks** — velocity-stretched (≈2×), additive, over distance ~6/unit, size
   0.05–0.15, speed 4–7 backward 10° cone, gravity 0.05–0.1, life 0.4–0.8.
6. **Smoke wisps** — normal blend, drawn under additive layers, over distance
   ~5/unit, delayed ~0.1s behind head, life 0.8–1.5, grows 0.5→1.6, slow spin,
   ramp `#5a4038 @ .5 → #33302e @ .35 → 0`.

Key tricks: hot-line core inside a wobbly dim shell; distance-based emission
for the wake; big low-alpha halo ≈ free bloom. Mobile: 40–60 live particles;
cap smoke first (overdraw hog).

## Muzzle flash

Sources: realtimevfx.com/t/13540 (pro thread — "flash on screen 1–2 frames
max"); Gabriel Aguiar VFX-graph muzzle flash (youtube sgBbnF3r60U).

Whole effect ≤0.15s; everything bursts at t=0:

1. **Glow flash** — 1 soft sprite, additive, burst, life 0.06–0.1, ~2× flash
   length, `#fff6d0 → #ffa030 → 0`, alpha-only decay.
2. **Core flash card** — flame/streak sprite along barrel, burst 1, life
   0.05–0.15 random, size GROWS 0.4→1.0 in first 40% (never shrinks), length
   ±40%/shot, brightness ×0.6–1.5/shot, random roll/flip per shot.
3. **Side-spike star** — 4–6 small streaks radial around barrel, life 0.05–0.1,
   50% spawn probability (some shots have no star).
4. **Sparks** — burst 6–12, velocity-stretched, speed 8–15 in 15° forward cone,
   life 0.15–0.4, high drag, slight gravity. Exaggerate past realism.
5. **Smoke puff** — 1–2 sprites, normal blend, delayed ~0.04s, grows 0.3→1.0,
   life 0.4–0.8, ramp `#c8c0b8 @ .4 → #909090 @ .25 → 0`.

Per-shot randomization (rotation, length, brightness, star on/off, sprite
choice) is mandatory — identical repeated flashes are the biggest quality kill.

## Force field / energy shield

Sources: Cyanilux forcefield breakdown (cyanilux.com); Daniel Ilett energy
shield (danielilett.com 2023-02-09); Godot energy-shield-with-impact (MIT,
godotshaders.com); storyprogramming force-shield-hits; Gabriel Aguiar shield
(youtube hTJqo1HeEOs).

1. **Shield surface** — sphere, additive ShaderMaterial, front faces,
   depthWrite off. Fresnel `pow(1-dot(N,V), 5)` (range 3–8), HDR-overdriven
   color (~×2.5) so only the rim saturates; center nearly invisible
   (`alpha ≈ fresnel + hex×0.15`). Optional scrolled hex pattern multiplied in;
   surface "breathing" `mix(0.6, 1.0, noise(uv.y + t×0.2))`.
2. **Impact ripples** — `vec4 uHits[6]` ring buffer (object-space pos + age).
   Difference-of-smoothsteps ring (border 0.05–0.08) expanding with age,
   *bright outer ring + darker inner ring*, intensity (1−age), ring color
   pushed toward white. Optional radial vertex wobble `sin(age×10 − d×8)`
   damped by (1−age). Full-shield flash +0.3 emissive decaying over 120ms.
3. **Idle particles** — 8–15 small glow motes orbiting the surface, additive,
   alpha 0.4, slow drift; 1–2 electric-arc sprites teleporting to random
   surface points every 0.4–0.8s, alive 3–4 frames.
4. **Impact particles** — burst 10–16 stretched sparks in a hemisphere off the
   surface, white → shield color → 0 over 0.25–0.4s, + one 1-frame glow flash.

Mobile: skip refraction/depth-intersection; shield = 1 draw call + 1 instanced
particle draw.

## Lightning / electric arc

Sources: Drilian midpoint-displacement article (drilian.com 2009 — canonical);
three.js LightningStrike example (MIT, r128); realtimevfx.com/t/3936 pro
critique thread; Gabriel Aguiar chain lightning (youtube eSqoJVdGbxM).

1. **Bolt ribbon** — midpoint displacement, 5–6 generations (32–64 points),
   initial perpendicular offset 0.15–0.25×length, halved per generation;
   camera-facing triangle strip, width tapering 1.0→0.2. One additive material
   with core+glow baked into the cross-section ramp (white-hot middle 30%,
   colored glow to edges).
2. **Branches** — 2–4 splits: direction ±15–30°, length ×0.7, width ×0.5,
   brightness ×0.4–0.5; always fork once just before the impact end.
3. **Flicker** — hard re-rolls every 2–3 frames (never morph smoothly), 4–6
   shuffles per strike then fade; two overlapping bolts offset ~1/6s each
   living ~1/3s. Afterimage = previous polyline at 30–40% brightness, ×1.5
   width, fading 100–150ms — same shape, dimmer.
4. **Impact** — 1-frame white flash + 8–12 stretched sparks (mix fast
   pink/white no-gravity + slower blue with gravity), life 0.2–0.35s.
5. **Rhythm** — strike, pause, pop-pop, pause: follow-ups at 60–70% scale.
   Constant flicker reads as fizzle, not power.

Mobile: preallocate ribbon buffers (DynamicDrawUsage); ≤3 draw calls total.

## Explosion (grenade scale)

Sources: Unity Standard Assets Explosion prefab — serialized YAML decoded
layer-by-layer (9 emitters + light; mirrored in Brackeys/MultiplayerFPS repo);
realtimevfx.com/t/16021 expert critique; Unity manual "A Simple Explosion";
80.lv stylized explosion breakdowns.

R = fireball max radius. All layers spawn t=0 (stagger via lifetime/emission
windows, never start delays — per the shipped prefab):

1. **Flash** — 1–2 glow sprites, additive, life 0.1–0.15s, 2.5R, alpha 1→0
   fast. Bright, huge, very short — "hangs out too long" is the #1 critique.
2. **Shockwave** — single flat ring/disc mesh, scale 0→10–15R ease-out in
   0.4–1.0s, alpha holds ~18% of life then fades. `#fff → #A4876D → 0`.
   Must visibly outrun everything else.
3. **Fireball** — 3–8 flame sprites, size curve **0.02 → 0.87 @ 35% → 0.03**
   (violent growth then dissipate), rotation ±180°/s, punch-then-stall drag,
   ramp `#fff → #FFF3DD @13% → #A99A84` (fire turns grey/black in place —
   the fire→smoke handoff), alpha 0→1@13%→0.
4. **Sparks** — 40–80 stretched streaks, additive, speed ~20R/s in GROUPED
   JETS (not uniform radial), gravity ×1–1.5 ("sparks fall faster"), life
   1–2s, alpha holds to 88% then snaps out, ramp white → gold `#FFD065` @21%
   → `#FF3B00` → `#522010`.
5. **Debris** — 20–30 chunks, normal blend, speed ~17R/s 45° up-cone,
   gravity 1, ballistic arcs, life 2–3s; trails = stationary dropped
   glow/smoke puffs, not ribbons.
6. **Dust wall** — 4–6 big warm-grey wisps, normal blend, launched fast then
   HARD clamp (75→15, dampen 1 — pressure punch then stall), life 3s,
   grows 0→1, ramp `#CABAB0 → #BAAB9D → #CBB6AA`.
7. **Smoke** — normal blend, peak alpha only ~0.25, **emission window 0→2s
   (not a burst!)** so it keeps appearing after fire dies and lingers to ~4s,
   near-zero speed, size 0.5→1.0, slow spin.

Consensus laws: first 3 stages (flash/shockwave/fireball) complete in the
first 15–30% of the effect, smoke/dust drag out the remaining 70% (ease-out
sensation); additive for hot + normal for cool, white family + dark family
simultaneously for value contrast; low per-sprite alpha on smoke (density from
overlap); grouped jets + randomized size/rotation/lifetime kill the mechanical
look; overdraw (sprite size), not count, is the mobile budget.

## Portal (idle loop)

Sources: Cyanilux portal breakdown (cyanilux.com); Godot 2D swirling vortex
portal (MIT, godotshaders.com); Codrops TSL glass-sphere vortex; Kevin Leroy
RealtimeVFX Sketch #2 portal (realtimevfx.com/t/1249).

Back-to-front, WoW value order (dark under bright):

1. **Dark backing disc** — normal blend, near-black center of the portal hue
   (`#12041f`-ish), slightly larger than the swirl. Sells the "hole" and gives
   additive layers contrast.
2. **Swirl body** — disc + custom shader, additive: polar UV, inward suction
   `dist += t×0.35`, spiral `angle += dist×2.5` (or log-polar
   `angle = -log2(dist)×k` for galaxy arms), `pow(noise, 3)` for crisp arms,
   oscillating twist `smoothstep(0,.5,.5-dist)×8×sin(t×0.7)`, edge
   `smoothstep(0.5, 0.4, dist)`, radial ramp hot-center → saturated mid → dark
   rim, HDR ×3 center.
3. **Counter-rotating swirl copy** — 0.85× scale, opposite spiral sign, 0.6×
   speed, 40% opacity, hue-shifted. Two counter-scrolling layers = boiling.
4. **Rim ring** — brightest element (HDR ×2–3), rotation 0.25 rad/s, radial
   breathing ±5% @ 0.7 Hz.
5. **Inward-spiraling motes** — 20–30 twinkle billboards spawned on the rim,
   orbit ~1.2 rad/s while radius shrinks to 0 over 1.2–1.8s, size 1→0.3,
   ramp rim→core→white.
6. **Ambient sparkles** — 6–10 twinkles inside 0.8× radius, 0.6–1s pop in/out.

Mobile: bake noise to texture (no runtime FBM); tunnel/second-swirl are first
cuts; never multi-camera parallax.

## Teleport (exit ~0.9s; entry mirrored)

Sources: Godot teleport shader (CC0, godotshaders.com); Travis H + NickR
RealtimeVFX Sketch #35 entries; WoW mirroring practice (80.lv Luis Aguas).

- t 0.00–0.25 **gather**: 15–20 motes on a 0.8u foot ring orbit inward+up
  (helix) toward chest; ground disc fades in, shrinks 1.2→0.8×; cool cyan.
- t 0.20–0.30 **dissolve begins**: `n = noise(uv×60) × uv.y;
  alpha = step(prog, n)` plus a second `step(prog−0.08, n)` band as the HDR
  edge glow (over-1 cyan) — bottom-up wipe over 0.5–0.75s.
- t 0.30–0.40 **FLASH**: one glow billboard scale 0.3→2.5 in 0.1s, alpha 1→0,
  plus 4–6 radial stretched streaks the same frame.
- t 0.35–0.70 **beam**: vertical cross-planes, bright-center gradient,
  scale-y 0→3u in 0.1s, hold 0.15, out 0.25; UV scrolls up 2–3 u/s.
- t 0.40–0.90 **residuals**: 10–15 sparkles up/out with gravity −1.5, plus 2–3
  normal-blend smoke wisps rising ~1s.

Entry mirrors exit exactly (same palette; beam first, un-dissolve top-down,
sparkles fall). The 2-step noise band IS the glowing dissolve edge; everything
brightest lives inside a 0.15s window.

## Healing aura (loop, 2.0s cadence)

Sources: RealtimeVFX healing feedback thread (t/6617 — "activation, buildup,
release, aftermath"; calm = few, soft, slow, ≤1 Hz); CGHOW UE5 heal spell
(helical rise); 80.lv WoW VFX overview (value-order layering, mirroring,
greyscale check).

1. **Ground disc** — additive alpha ~0.35, rotation 0.1 rad/s, breathing ±4%
   @ 0.5 Hz.
2. **Pulse ring** — every 2.0s: scale 0.4→1.3u over 0.9s, alpha 0.8→0. This is
   the "release" beat — the moment the heal happens.
3. **Rising motes** — 8–12 billboards, rise 0.5–0.7 u/s, sine wobble ±0.06u,
   life 1.6–2.2s, size 0.6→1→0 (GROW then dissolve — a shrink curve reads as
   damage), ramp white-gold → gold → 0; emission ×2 for 0.3s at each pulse.
4. **Helix accents** — 4–6 motes, orbit radius 0.45u @ 1.0 rad/s, rise 0.5 u/s.
   One strand, not a tornado.
5. **Body glow** — 1 large soft billboard, alpha 0.2→0.35 breathing synced to
   the pulse.
6. **Sprinkles** — 3–5 twinkles, 0.5s pop, only during 0.4s after each pulse.

Calm rules are law: ≤25 particles, no hard edges, nothing faster than the
pulse. Test 10 simultaneous auras (WoW practice).

## Melee hit impact (anime hit spark)

Sources: 80.lv Zelda-style combat VFX (Soenke Seidel); 80.lv Trail & Impact
VFX (Guillermo Rossell); realtimevfx.com/t/11286 hit-spark critique; pimen
Battle VFX frame data; VFX Apprentice / Jason Keyser LoL tips; GDQuest juicy
attack (verbatim hit-stop numbers).

Budget 0.35–0.5s; 80% of the energy in the first 0.15s:

1. **Core flash** — 1 sprite, additive, life 0.08–0.12s, size punches IN
   (1.4×→1.0 by t=0.3, then →0), ramp white → `#FFD34D` → `#FF5A1F`, random
   roll per hit. Only element allowed pure white.
2. **Spark streaks** — 8–14 velocity-stretched, 360° fan ±15° jitter, speed
   6–10 with HEAVY drag (sparks leap then STOP — defined stopping points),
   gravity ~0, life 0.15–0.35s, size-over-life 1→0.2, white→yellow→orange/red.
   2–3 hero sparks at 1.5× size.
3. **Shockwave ring** — ring mesh, life 0.2–0.25s, scale 0.2→1.0 strong
   ease-out, alpha 0.9→0, THIN (thick rings read as donuts). Heavy hits: second
   ring delayed 0.05s, 1.3× larger.
4. **Pillars/spikes** (explosive hits) — 2–4 static stretched streaks at fixed
   angles, scale-in 0.05s, gone by t=0.15.
5. **Lingering embers** — 3–5 tiny dots, life 0.3–0.5s, slow rise, flickery
   alpha. The sparse "processing" tail.
6. **Dark smoke kicks** (optional) — 2–3 normal-blend wisps behind everything.

Slash arc = curved quad strip (60–120° ring arc) with gradient scrolling along
arc UV, life 0.15–0.25s, alpha eroding from tail; 2 crossed strips = X-slash.
Value discipline: one dominant hue, support layers in the 20–85% value band.

## Smoke puff (one-shot) — most-corroborated recipe

Sources: GDQuest DustRun.tscn (verbatim shipped values, MIT);
gamedevcheatsheet.com presets; Unity Learn burst tutorial.

- **8–12 big sprites** (not many small), normal blend, burst explosiveness ~1.
- Spawn ring r ≈ 0.1–0.3× character width; radial+up 1–2 m/s ±40%, wide flat
  spread, **gravity 0**, strong drag (v≈0 by t=0.5). Life 0.35–0.6s.
- **Size GROWS: (0, 0.35) → (0.9, 1.0) → (1.0, 0.85)** — ~3× over life; never
  shrink dust to zero, fade while large.
- Alpha: ~5% in, hold, last 25% out; peak only 0.5–0.7. Brightest at spawn →
  greyer. Tint to surface.
- Random roll 0–360° + slow spin 60–120°/s ±70% (hides sprite reuse).
- Ground ring for dash/heavy landing: scale 0.3→1.2 in 0.2s, alpha 0.6→0.

## Looping smoke (campfire/chimney)

Sources: Niagara sprite-smoke how-to (Epic first-party values); Defold
fire_and_smoke example; gamedevcheatsheet campfire preset.

- Fire: additive, 15–30/s, life 0.8–1.5s, up 1–2 m/s cone 15°, size SHRINKS
  1→0, yellow-white→orange→deep red.
- Smoke: normal blend, **~⅓ the fire rate (5–10/s)**, spawned OFFSET ABOVE the
  flames with 0.5±0.3s start delay, life 2–4s (much longer), up 0.4–1 m/s with
  gentle upward ACCELERATION, base size variance 1–2.7× (kills the conveyor
  look), grows 0.5→1, peak alpha only 0.3–0.5 ±0.3.
- Heat glow underlay: 1 persistent soft billboard, alpha 0.2, ±10% pulse ~3 Hz.

## Pickup sparkle / coin collect

Sources: Unity Learn collectable burst; juicy-breakout source (Juice it or
Lose it demo); Gabriel Aguiar loot drop (rarity scaling); Roblox Emit(N)
convention.

- Phase 0: scale-punch the object itself 1.0→1.3→0 back-ease ~0.15s, same
  frame as the burst. Instant `Emit(N)`, never "on for 0.5s".
- **Glow flash** — 1 sprite, 1.5–2× coin, scale 0.6→1.0, alpha 0.8→0, 0.15s.
- **Star burst** — 8–14 star sprites, 360° or up-cone ±70°, speed 2.5–5,
  **gravity 6–10** (arc up and rain down = "coins", zero-g = "magic"), life
  0.25–0.5s, size bump 1.0→1.15@0.3→0, spin ±180°/s, ⅓ get twinkle alpha dip,
  white→gold `#FFC93C`→amber.
- **Micro-dots** — 6–10 tiny dots, speed 1–2, life 0.2–0.3s. Cheap gap fill.
- **Ring pulse** — rare pickups only (scale-of-importance).
- **Fly-to-UI streak** — 1–3 stretched dots, ease-IN tween 0.3–0.45s along a
  1-control-point bezier; counter tick + punch on arrival; stagger 30–50ms.

Loot-on-ground idle: crossed gradient beam quads (alpha→0 at top, 10°/s spin)
+ ground disc + 2–4/s rising twinkles; rarity scales color/width/rate only.

## Cross-cutting principles (all recipes)

1. Buildup → climax → aftermath on every layer; ease-out expo on anything
   expanding, ease-in on anything arriving.
2. Fast birth, slow death: energy in the first 20%, time in the last 50% with
   only 1–2 sparse elements.
3. **One white per effect** — a single focal element gets full brightness.
4. Bold silhouettes over noise — at 0.3s lifetimes, texture detail is mush.
5. If it feels long, it's way too long — when in doubt cut lifetimes 30%.
6. Mobile: fill-rate is the constraint. Big soft glows are the overdraw
   killers — cap at ~2 screen-equivalent additive layers; degrade counts
   before layers; one atlas + one material per blend mode.
