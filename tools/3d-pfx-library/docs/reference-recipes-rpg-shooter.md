# VFX Reference Recipes — Fantasy RPG & Modern Shooter Genres

Companion to `reference-recipes.md`. Research compiled from GDC talks,
RealtimeVFX threads, studio tech blogs, and production tutorials, mapped to
this library's tuning vocabulary. Lifetimes in seconds, sizes as multiples of
a nominal effect radius R.

---

# GENRE A — Medieval / Fantasy RPG

## A1. Sword Slash Arc + Hit Impact

**Sources**
- Venom Slash breakdown (ring mesh + scrolling noise): https://realtimevfx.com/t/venom-slash-breakdown-of-the-effect-included/18903
- Mesh-based sword slashes: https://realtimevfx.com/t/mesh-based-sword-slashes/28342
- Julian Love, GDC 2013 "The VFX of Diablo": https://www.youtube.com/watch?v=UJI7vPiu-g4
- Stylized Hit Impact FX in UE5 Niagara: https://www.youtube.com/watch?v=Po4yBFHL-P4
- pimen Battle VFX hit sparks (6–8 frames ≈ 0.3–0.5 s at 12–15 fps): https://pimen.itch.io/battle-vfx-hit-spark

**Slash (~0.35 s):**
1. **Core crescent** — our `arc-sweep` shader (or crescent sprite), additive, single burst, life 0.18–0.25. Size fast-in: 0.3R → 1.2R by 20% of life → 1.3R at death (motion in alpha, not scale). White-hot first 25% → held hue.
2. **Smear echo** — crescent, alpha blend, delay 0.03, count 1, life 0.3, size 1.4R constant, alpha peaks 30% then erodes. Held color only — the afterimage.
3. **Speed lines** — thin streaks, additive, count 6–10 along the arc, stretch 3–6×, arc-tangent direction, drag 4–6, gravity 0, life 0.15–0.2, size 1 → 0.
4. **Micro-glints** — 4-point stars, additive, 3–5 at blade-tip path, life 0.15, size 0.15R → 0.

**Hit impact (~0.4 s, on contact):**
1. Flash sphere, life 0.06–0.08 (1–2 frames), 0.5R.
2. Impact star — starburst sprite, life 0.12, size 0.2R → 0.8R by 40% → 0.9R.
3. Hit sparks — 8–12 streaks, cone off surface, stretch 4×, gravity 0.5–1, drag 2–3, life 0.25–0.4, white-hot → orange held.
4. Shockwave ring, life 0.2–0.25, 0.1R → 1.2R, alpha 0.6 → 0.
5. Dust kiss — 2–3 soft puffs, alpha, delay 0.04, life 0.4, 0.3R → 0.7R, alpha 0.2.

**2D vs 3D** — Hades ships flat painted arcs; a camera-facing crescent reads correctly from iso/ortho. In free-camera 3D, lock the crescent to the swing plane or keep life ≤0.25 s so the cheat is invisible.

## A2. Blood / Gore Hit Feedback (Stylized)

**Sources**
- RealtimeVFX blood thread: https://realtimevfx.com/t/im-working-on-some-blood-stuff/496
- Vefects Blood VFX: https://vefects.itch.io/blood-vfx-unreal-engine
- Stylized Blood VFX pack (splatter + drips + mist, 3–5 layers): https://www.fab.com/listings/42fdcfc8-1346-4bb0-a538-feccb3860b92
- Hades effects behind-the-scenes: https://80.lv/articles/a-behind-the-scenes-look-at-the-effects-in-hades

**Construction (~0.7 s):**
1. **Directional spray** — droplet-cluster sprites (3–4 variants), **alpha blend, never additive** (additive blood turns pink and vanishes on bright ground), count 10–16, cone 40–60° along hit direction, gravity 1.5–2, drag 0.5, life 0.4–0.6, stretch 1.5–2×, size 0.1R → 0.15R. Bright arterial red 20% → dark maroon held.
2. **Mist puff** — soft sprite, alpha, delay 0.02, count 2–3, life 0.3, 0.3R → 0.6R, alpha 0.3 → 0, dark red.
3. **Chunk accents (gore tier)** — irregular blobs, alpha, 4–6, gravity 2, spin, life 0.5.
4. **Rim flash** — tiny additive white-red flash at wound, life 0.08, 0.2R — the stylized "hit connected" read (Hades pairs dark fluid with a bright 1-frame accent).
5. **Ground pool** — pulse disc, dark red, delay 0.15, life 1.5–3, 0.2R → 0.5R fast then hold, slow fade (decal substitute).

**2D vs 3D** — Pure billboards; only the pool disc is 3D. In ortho top-down, exaggerate gravity so drops fall "down-screen."

## A3. Holy Smite / Divine Pillar

**Sources**
- Divine Smite breakdown: https://www.therookies.co/projects/51434
- Holy Light Attack UE5: https://realtimevfx.com/t/holy-light-attack-ue5-vfx/25781
- Holy Swords Storm tutorial (polar swirl + descending beam): https://80.lv/articles/a-detailed-tutorial-on-how-to-create-enhanced-holy-vfx-effect-in-ue5
- WoW Consecration recreation: https://realtimevfx.com/t/world-of-warcraft-vfx-recreation-with-ue4/12106

**Construction (0.2 s anticipation → 0.4 s pillar → 1.2 s dissipation):**
1. **Anticipation glyph** — pulse disc, gold, life 0.25, scale 1R → 0.6R (contracts = "charging"), alpha 0 → 0.7.
2. **Pillar core** — tall beam sprite, additive, delay 0.2, 1–2 crossed, stretch 8–12× vertical, life 0.4, width 0.15R → 0.45R by 30% → 0.1R (snap in, fatten, collapse to a thread). White-hot → warm gold held.
3. **Flash sphere** at impact, delay 0.2, life 0.08, 0.8R.
4. **Shockwave ring**, ground, delay 0.22, life 0.3, 0.2R → 1.6R, gold.
5. **Dust/light wisps** — soft puffs, alpha, delay 0.25, 6–8 radial low cone, drag 3, life 0.8, warm gray-gold.
6. **Rising motes** — dots/stars, additive, delay 0.3, window 0.8, 12–18, gravity −0.3, drag 2, life 1.0–1.5, size 0.05R → 0, gold.
7. **Bloom volume** swell, delay 0.2, life 0.6.

**2D vs 3D** — Pillar (vertical) + ring (horizontal) + disc (ground) = instant depth in 3D. 2D: ring becomes an ellipse sprite, pillar a flat flare — WoW shipped that and it reads.

## A4. Poison Cloud + Drip

**Sources**
- Stylized dissolve/erosion fundamentals: https://torchinsky.me/stylized-vfx-unity-01/
- Diablo 3 noise-multiply technique: `((Tex1.A * Tex2.A * 2) * Tex3.A * 2) * Tex4.A`, octaves 0.5/1.0/2.0, randomized pan speeds: https://jangafx.com/insights/diablo-3-vfx-experiments
- Stylized Smoke VFX Graph: https://www.youtube.com/watch?v=dPJQuD93-Ks

**Construction (looping):**
1. **Cloud body** — 3 eroded puff variants, alpha blend, continuous, 6–10 alive, spawn across area, life 1.8–2.5, random phase, slow drift, drag 4, gravity −0.05. Size 0.5R → 0.9R → 0.7R. Per-sprite alpha ≤0.35 — density from stacking. Sickly bright green briefly → dark olive held.
2. **Toxic core glow** — bloom volume, pulsing 0.4R ↔ 0.55R, period ~1.4 s, lime, alpha 0.25.
3. **Bubbles** — dots, additive, 2–4/s, gravity −0.4, life 0.6–0.9, size 0.06R → 0.09R → 0 (pop = shrink fast last 10%).
4. **Drips** — droplets, alpha, 1–2/s from underside, gravity 1.2, stretch 2× vertical, life 0.4, dark green.
5. **Ground stain** — pulse disc, dark green, persistent, slow pulse.

**2D vs 3D** — Diablo 3 poison is billboards + noise multiply. Never additive for the body — poison reads by occluding.

## A5. Frost Nova + Ice Shatter

**Sources**
- Gabriel Aguiar Ice Attack: https://www.artstation.com/artwork/RWAqA / https://www.youtube.com/watch?v=gfOaGvNQ28U
- Frost Grenade breakdown: https://realtimevfx.com/t/frost-grenade/6047
- Ice Shader (fresnel + noise): https://www.youtube.com/watch?v=Gym5JWHgjkk

**Nova (~0.9 s):**
1. Flash sphere, ice-white/cyan, 0.07, 0.5R.
2. **Shockwave ring**, ground, life 0.3, 0.15R → 1.8R, cyan-white, alpha 0.9 → 0 — the gameplay read; fastest, brightest element.
3. **Frost floor** — pulse disc, delay 0.05, life 1.2, 0.2R → 1.5R by 25% then hold, pale blue, slow fade (frozen-ground residue).
4. **Ice spikes** — shard sprites, alpha with baked additive edge, delay 0.05, 8–12 in a radial ring, oriented outward-up, stretch 2–3×, low speed (they scale, not travel), life 0.5; size 0 → 1 in 15% (spike pop), hold, → 0 last 20%.
5. **Snow mist** — puffs, alpha, delay 0.1, 6–8 radial, drag 3, life 0.7, white-blue, alpha 0.25.
6. **Crystal glints** — stars, additive, delay 0.15, window 0.4, 8–12 on the disc, life 0.2 each, 0.08R → 0, white.

**Shatter (~0.6 s):** flash 0.06 + 15–25 angular shards (alpha, sphere burst, gravity 1.5, drag 0.5, spin, stretch 1.5×, life 0.5–0.8, white glint first 15% → ice blue held) + 3–4 ice dust puffs + 6 glint stars.

**2D vs 3D** — Ring+disc+spike triad is ground-plane 3D; in ortho replace spikes with a painted radial-spike frame (Hades' Demeter). Shatter is billboards everywhere.

## A6. Arcane Missile Trails

**Sources**
- CGHOW Arcane Projectile (core orb + wavy ribbons + shed sparks): https://cghow.com/create-an-arcane-projectile-vfx-in-unreal-engine-5-niagara-tutorial%F0%9F%94%AE%E2%9C%A8%F0%9F%8C%80/
- Magic Missile WIP (head/trail/impact staging): https://realtimevfx.com/t/magic-missile-wip/4474
- Kodeco Unity VFX projectile staging: https://www.kodeco.com/23120977-vfx-in-unity-getting-started

**Construction (dropped-sprite trail):**
1. **Core orb** — hard circle, additive, attached, size 0.12R pulsing ±20% at ~8 Hz, white-hot.
2. **Glow halo** — soft circle, additive, attached, 0.3R, alpha 0.4, violet held.
3. **Trail smoke** — the ribbon substitute: 25–40 sprites/s along the path, near-zero inherited velocity, **drag 8+** (stop dead), gravity 0, life 0.35–0.5, size 0.1R → 0.02R (taper = ribbon read), additive, hot violet → deep purple. Stretch 1.5× along direction tightens the line.
4. **Shed sparks** — dots, additive, 8–12/s, cone 30° off path, gravity 0.3, drag 2, life 0.4, 0.04R → 0.
5. **Impact** — flash 0.07 + starburst 0.15 + 10 radial sparks (gravity 0.5, drag 3, life 0.3) + ring 0.2 s, 0.1R → 0.8R.

**2D vs 3D** — Keep emission ≥25/s or trail overlap breaks in 3D. In 2D halve counts and lean on the halo.

## A7. Level-Up Pillar / Burst

**Sources**
- Level Up effect thread: https://realtimevfx.com/t/level-up-effect-for-when-your-character-is-evolving/20387
- GDC "World of Warcraft VFX Pillars": https://gdcvault.com/play/1029418/Visual-Effects-Summit-World-of
- WoW VFX overview (80.lv): https://80.lv/articles/world-of-warcraft-vfx-overview-from-luis-aguas

**Construction (0.1 s pre-flash → 0.2 s burst → 1.5 s linger):**
1. **Pre-glow** at feet, life 0.12, 0.3R → 0.6R, gold.
2. **Flash sphere**, delay 0.1, life 0.08, 0.7R + bloom swell 0.5.
3. **Pillar** — 2 crossed beams, additive, delay 0.12, life 0.7, stretch 10×, width 0.35R → 0.15R, gold, alpha hold to 40% then out.
4. **Shockwave ring**, ground, delay 0.12, life 0.35, 0.2R → 2R.
5. **Radial burst sparks** — 16–24 stars/dots, additive, sphere burst biased up, drag 3, gravity −0.1, life 0.6, 0.08R → 0.
6. **Rising motes/glyphs** — 15–20 in a cylinder around the character, additive, delay 0.25, window 0.8, gravity −0.5, drag 2, life 1.2–1.8, alpha in-out.
7. **Pulse disc** afterglow, delay 0.2, life 1.5.

**2D vs 3D** — Character-attached spawn volume matters more than camera dimension; 2D collapses to flat flare + screen-space mote column.

## A8. Loot Beam + Rarity Glints

**Sources**
- Gabriel Aguiar Loot Drop (5 rarity tiers from 1 graph): https://www.youtube.com/watch?v=Qig-g9EzND4
- Loot Drop thread: https://realtimevfx.com/t/made-some-loot-drop-effects-with-only-1-vfx-graph/15050

**Construction (looping; rarity scales counts/colors, not structure):**
1. **Landing burst** (once) — flash 0.06 + ring 0.25 s 0.1R → 1R + 8 sparks, rarity color. Beams need a birth accent or players miss the drop.
2. **Beam** — 2 crossed soft beams, additive, stretch 6–10×, width 0.12R (common) → 0.3R (legendary), alpha 0.35, sine pulse period 1.5 s, rarity color with white-hot base near ground.
3. **Ground disc** — pulsing 0.4R ↔ 0.5R, period 1.2 s, alpha 0.4.
4. **Rising sparkles** — 2/s (common) → 8/s (legendary), 0.25R cylinder, gravity −0.35, drag 2, life 1.2, 0.05R → 0.
5. **Hero glint** — 4-point star at the item, one every 1.5–2.5 s, life 0.35, size 0 → 0.25R → 0, white. The intermittent ping pulls the eye across a busy screen.

**2D vs 3D** — Crossed planes prevent edge-on vanishing in 3D; single flat beam is Diablo-authentic in ortho.

## A9. Torch / Brazier Fire Loop

**Sources**
- Loop stylized fire: https://realtimevfx.com/t/loop-stylized-fire/3946
- Simon Trümpler "One Circle Texture" fire: https://simont.artstation.com/projects/2xyxzK
- Diablo 3 noise-multiply fire: https://jangafx.com/insights/diablo-3-vfx-experiments
- Dark Souls bonfire recreation: https://www.therookies.co/entries/44071

**Construction (looping):**
1. **Flame body** — 3–4 eroded teardrop variants, additive, 3–5 alive, spawn 0.1R disc, gravity −1.2 (buoyancy), drag 1, life 0.5–0.8, random phase. Size 0.5 → 1.0 at 40% → 0.15 (pinch out at top). White-yellow 25% → orange → deep red held. Per-particle random pan on 2 multiplied noise octaves = licking motion without flipbooks.
2. **Core hot spot** — soft circle, additive, static at base, 0.25R, alpha 0.5, flicker ±15% at ~10 Hz.
3. **Embers** — dots, additive, 1–3/s, gravity −0.5, drag 1.5 + lateral jitter, life 0.8–1.4, 0.03R → 0.
4. **Smoke** — puffs, alpha, 1–2/s spawned 0.5R above base, gravity −0.3, drag 2, life 1.5–2.2, 0.2R → 0.5R, alpha 0.15 → 0, dark gray.
5. **Glow** — bloom volume, ±10% flicker, warm orange.

**2D vs 3D** — Fire is billboards everywhere in production. Keep flame count odd (3 or 5) so the loop never reads symmetric.

## A10. Resurrection / Revive

**Sources**
- Resurrection Spell (UE4): https://www.artstation.com/artwork/8e84WR
- pimen Holy Spell (start/loop/hit frame structure): https://pimen.itch.io/holy-spell-effect

**Construction (0.8 s gather → 0.1 s flash → 1.5 s bloom-off):**
1. **Summoning circle** — pulse disc under body, gold-white, scale 0 → 1.2R in 0.3, breathing alpha.
2. **Gathering motes** — 20–30 dots, additive, window 0.7, spawned at 1.5R with inward velocity, drag 1, life 0.6, size grows as they approach.
3. **Rising column wisps** — 6–8 soft wisps, alpha, delay 0.2, gravity −0.8, drag 1.5, life 0.9, stretch 2.5× vertical, warm white, alpha 0.3.
4. **Rez flash** — flash sphere at chest, delay 0.8, life 0.09, 0.9R + bloom swell 0.8.
5. **Shockwave ring**, delay 0.8, life 0.3, 0.2R → 1.8R, white-gold.
6. **Ascending burst** — 14–20 stars, additive, delay 0.82, cone up 30°, gravity −0.2, drag 2.5, life 1.2, 0.1R → 0.
7. **Lingering motes** — as A7 layer 6, delay 0.9, life 1.5.

**2D vs 3D** — The *timeline* (gather → snap → release) carries the meaning; 2D collapses to circle + column + flash and still reads.

---

# GENRE B — Modern Shooters

## B1. Muzzle Flashes (Rifle / Pistol / Suppressed)

**Sources**
- RealtimeVFX muzzle flash thread (BF1/JC4 artists: billboards, 1–2 frames, 4–8 random variants, split core + directional flames, fresnel fade, separate 1P/3P): https://realtimevfx.com/t/wondering-how-good-muzzle-flashes-are-made/13540
- Klemen Lozar motion-vector frame blending: https://www.klemenlozar.com/frame-blending-with-motion-vectors/
- CGHOW muzzle flash: https://cghow.com/unreal-engine-muzzle-flash-tutorial/
- Riot VALORANT shaders & clarity: https://technology.riotgames.com/news/valorant-shaders-and-gameplay-clarity

**Rifle (per shot; flash portion 0.06 s):**
1. **Flash sphere** at muzzle, life 0.05, 0.35R, white-yellow — doubles as the fake muzzle light.
2. **Core flash** — circular flame sprite, additive, 4–8 variants random per shot, count 1, life 0.05–0.07 (**1–2 frames; longer = flamethrower**), size 0.5R fixed (no growth — a pop, not a bloom), hot white → orange.
3. **Directional spikes** — elongated flame sprites, additive, 2–3 (1 forward, 1–2 side), stretch 3–5×, life 0.05, random variant + roll.
4. **Smoke wisp** — puff, alpha, delay 0.04, 1–2, forward drift, drag 2, gravity −0.15, life 0.4–0.8, 0.1R → 0.35R, alpha 0.2 → 0, warm gray.
5. **Muzzle sparks** (heavy calibers) — 3–6 dot streaks, additive, forward cone 20°, stretch 4×, gravity 0.8, drag 2, life 0.2.

**Variants** — Pistol: 1 spike or none, core 0.3R, rounder variants. Suppressed: **no core, no spikes** — flash sphere 0.15R at 0.03 s, one smoke puff at doubled alpha and life 1.0, 1–2 tiny sparks; smoke-forward, not light-forward. Fresnel-fade the flash so edge-on billboards don't show as cards.

**2D vs 3D** — Separate 1P and 3P tunings (practitioner-confirmed: one system never serves both). Flash lives so briefly that billboard vs mesh is irrelevant — spend fidelity on texture variants and randomization.

## B2. Bullet Impacts Per Material

**Sources**
- ActionVFX bullet hits (real-footage timing): https://www.actionvfx.com/collections/bullet-hits-stock-footage
- Bullet Impact VFX pack (per-material variants): https://www.fab.com/listings/43bdd657-063d-4ece-8e1b-f131a9d1d406
- UE community wiki projectile FX: https://unrealcommunity.wiki/projectile-visual-effects-900bey6t

**Shared skeleton (0.05 s flash / 0.5 s debris / 1.5 s dust — three timescales):**
1. Impact flash — small additive sprite, life 0.04, 0.1R.
2. Debris burst — material-specific, reflect cone off surface normal ±30°.
3. Dust puff — material-colored, alpha, hangs.
4. Optional pulse disc as decal substitute, life 3–5 s.

**Concrete**: 6–10 gray-tan chips, gravity 2, drag 0.5, life 0.4–0.6 + 2–3 tan-gray puffs, life 0.8–1.2, 0.15R → 0.4R, alpha 0.35; sparks only 2–3, dim. Dust dominates.
**Metal**: 8–15 streaks, additive, white-yellow → orange, stretch 4–8×, gravity 1, drag 1.5, life 0.3–0.5 **with a couple of 0.7 s outliers that arc and die — the outliers sell it**; 1 tiny gray wisp; no chips.
**Dirt**: 10–16 dark clumps, gravity 2.2, life 0.5, vertical plume bias; 3–4 brown puffs, life 1.2–1.8, taller than wide, alpha 0.4.
**Wood**: 5–8 pale splinters, stretch 3×, spin, gravity 1.8, life 0.5–0.7; 1–2 pale puffs; 2–3 dim sparks acceptable.

**2D vs 3D** — Material identity = color + timescale ratio (sparks fast / chips medium / dust slow), not geometry.

## B3. Tracer Rounds

**Sources**
- Hitscan tracer thread (scrolling beam, every 3rd–4th shot): https://realtimevfx.com/t/need-advice-on-how-to-create-a-hit-scan-tracer-bullet-effect-using-beams-in-ue4/3876
- Bullet trails thread: https://realtimevfx.com/t/help-how-to-make-semi-realistic-bullet-trails/21954
- The art of tracer fire: https://beforesandafters.com/2022/11/01/the-art-of-tracer-fire/

**Construction (per round):**
1. **Tracer streak** — 1 capsule/streak sprite, additive, life 0.06–0.12, **stretch 15–30×** along velocity, width 0.03–0.05R, white-hot core → orange (western) or green (opfor) held, alpha 1 → 0 linear.
2. **Fading afterline** (heavy weapons) — same sprite, alpha blend, delay 0.02, life 0.2, width 0.06R, alpha 0.25 → 0.
3. **Muzzle-end pop** — dot, additive, life 0.04.

Tracers every 3rd–4th shot only (full-rate reads as lasers). ±0.5° jitter per tracer keeps automatic fire alive.

**2D vs 3D** — A velocity-stretched billboard IS the reference implementation. Stretch along world velocity so tracers foreshorten toward/away from camera.

## B4. Frag Grenade Explosion

**Sources**
- Beyond-FX "First Playable Grenade Explosion" series: https://blog.beyond-fx.com/articles/episode-3-making-a-spark-burst-learn-with-us-first-playable-grenade-explosion-bfx-u
- VFX Apprentice Booms & Blasts: https://www.vfxapprentice.com/courses/booms-and-blasts

**Construction (flash 0.08 / fire 0.4 / dust 1.5 / smoke 4):**
1. **Flash sphere**, life 0.07, 1R, white → yellow + bloom spike 0.3.
2. **Shockwave ring**, ground, life 0.2–0.3, 0.2R → 2.5R, alpha 0.7 → 0.
3. **Shrapnel streaks** — 10–16, additive, sphere burst biased up/out, very fast, stretch 6–10×, gravity 0.6, drag 1, life 0.25–0.45, white-hot → orange — the "spokes" that read as frag rather than fuel.
4. **Fireball** — 3–6 eroded flame puffs, additive, spawn 0.3R sphere, drag 3, life 0.3–0.5, size 0.4R → 0.9R by 50% → 0.7R, white → orange → dark red.
5. **Dust wall** — 8–12 dirt-gray puffs, alpha, delay 0.05, radial ring at ground level, drag 2.5, life 1–2, size 0.5R → 1.2R, alpha 0.4 → 0. The horizontal expansion grounds the blast.
6. **Debris** — 10–15 chips, alpha, cone up 50°, gravity 2.5, drag 0.3, life 0.8–1.2, spin.
7. **Smoke column** — 4–6 dark puffs, alpha, **delay 0.3**, window 0.5, stacked above center, gravity −0.25, drag 3, life 2.5–4, size 0.6R → 1.4R, near-black → gray held. Tactically load-bearing — marks "a grenade went off here" for seconds.

**2D vs 3D** — 3D: column + dust wall + ring = three axes. 2D top-down: cut the column to 2 puffs; dust wall + ring carry it.

## B5. Smoke Grenade Volumetric Plume

**Sources**
- Riot VALORANT clarity (hard gameplay sphere + cosmetic wispy shell — canonical no-sim architecture): https://technology.riotgames.com/news/valorant-shaders-and-gameplay-clarity
- Valorant sphere smoke analysis: https://outscal.com/web-story/valorant-sphere-smoke-system
- CS2 voxel smoke recreation (density/timing reference): https://github.com/lolgube010/DX11-TGA-Portfolio-CS2-Smoke

**Construction (deploy 1.5 s → hold 10–20 s → dissipate 2 s):**
1. **Occluder core** — solid sphere primitive, smoke-gray, scale 0 → 0.85R over 1.2 s ease-out. Gameplay occlusion is a solid primitive at one draw call; particles are cosmetic.
2. **Shell puffs** — 12–20 large eroded puffs, alpha, on a 0.8–1R shell, random phase, near-zero velocity, drag 10, life 2–3 with re-emission, size breathing 0.5R ↔ 0.65R, per-sprite alpha 0.2–0.3 (opacity from stacking). Variants + random roll kill tiling.
3. **Deploy burst** — 6–8 fast puffs, radial, drag 4, life 0.8.
4. **Canister jet** — sparks + white wisp, first 1.5 s, upward cone.
5. **Skirt** — 4–6 darker puffs at the ground ring, life 3, barely moving.
6. **Dissipate** — stop re-emission; alpha out over 2 s; core scales down 15% while fading (shrink-and-thin, never pop).

**2D vs 3D** — The most 3D-dependent effect here; sorting artifacts between shell puffs are the classic failure. Mitigate with low per-sprite alpha + near-identical color. 2D: one layer of 8 large puffs in a disc.

## B6. Flashbang

**Sources**
- techarthub Flashbang VFX (post material driven by LoS/distance/view angle): https://forums.unrealengine.com/t/techarthub-flashbang-vfx/2604251
- UE5 flashbang tutorial: https://dev.epicgames.com/community/learning/tutorials/eJkZ/unreal-engine-5-flashbang-tutorial

**World-side (0.6 s; the blind is a fullscreen overlay outside the particle system):**
1. **Flash sphere**, life 0.12 (longer than gunfire — this IS the payload), 1.5R, pure white.
2. **Bloom volume** spike, life 0.5, intensity 3–4× any other effect — flashbang must be the brightest thing the library can emit.
3. **Star glint** — huge 4/6-point star, additive, life 0.25, size 0.3R → 2R → 0, white.
4. **Shockwave ring**, life 0.2, 0.2R → 2R.
5. **Sparks** — 8–12 white streaks, gravity 1, drag 2, life 0.3.
6. **Smoke poof** — 2–3 small gray puffs, delay 0.1, life 1.2 — token only.

Screen-side: white fullscreen quad, alpha 1 → 0 over 2–4 s ease-out, scaled by distance + view angle + line-of-sight.

## B7. Blood Hit Markers (Shooter)

**Sources**
- Vefects Blood VFX: https://vefects.itch.io/blood-vfx-unreal-engine
- Stylized blood Niagara pack: https://www.fab.com/listings/42fdcfc8-1346-4bb0-a538-feccb3860b92

**Construction (0.35 s — much shorter/smaller than RPG gore):**
1. **Exit spray** — 6–10 droplet clusters, alpha, cone 30° continuing bullet direction (through-target), gravity 2, drag 0.5, life 0.3–0.4, stretch 2×, dark red, 0.06R → 0.
2. **Entry mist** — 1–2 small puffs at hit point, alpha, life 0.2–0.3, 0.12R → 0.25R, deep red.
3. **Hit accent** — one tiny bright red-white sprite, additive, life 0.06, 0.08R — the competitive "you hit" ping carries the information, not the fluid.
4. No decals/pools in comp modes; PvE adds the A2 pool.

## B8. Shell Casing Ejection

**Sources**
- Shooter Tutorial ejection port setup: https://kolosdev.com/shooter-tutorial-weapon-audio-visual-system-pistol/
- UE ejection with rotation-stop detail: https://www.youtube.com/watch?v=0ex8suqimP8

**Construction (per shot, 1 particle):**
1. **Casing** — brass capsule sprite (2–3 rotation variants), alpha, count 1, right-up-back cone ~40° ±15°, speed 2–3 m/s ±30%, **gravity 1 (real 9.8-equivalent — casings are the one effect where real gravity reads right)**, drag 0.1, life 0.7–1.0, fast spin, size constant 0.02–0.03R.
2. **Brass glint** — additive star dot on the same trajectory, alpha 0 except two 0.05 s pulses at random life points (fakes light catching tumbling brass — 80% of the read).
3. **Port smoke** — one wisp, alpha, life 0.3, drifting up.

No collision: kill just below floor height via lifetime, or fade last 15%. Never more than 1 per shot; piles are decals.

## B9. C4 / Breach Charges

**Sources**
- R6 Siege hard breach design notes: https://rainbowsix.fandom.com/wiki/Hard_Breach_Charge
- Beyond-FX grenade series: https://blog.beyond-fx.com/articles/episode-1-setting-up-your-unreal-project-learn-with-us-first-playable-grenade-explosion-bfx-u

**Construction (1.0 s arm → 0.1 s blast → 3 s dust):**
1. **Arming blink** — red dot + pulse disc, 2 Hz accelerating to 8 Hz over the last 0.5 s.
2. **Wall flash** — flattened flash/pulse disc on the surface, life 0.08, 1.2R, oriented to wall normal.
3. **Directional blast cone** — the C4 signature: everything cones *away from the wall*. 12–18 shrapnel streaks, cone 60° off normal, stretch 8×, life 0.3.
4. **Shockwave ring** in the wall plane — 0.2R → 1.5R, life 0.25 — the wall "blowing out."
5. **Dense dust wall** — 10–14 concrete puffs, alpha, cone off normal, drag 2, life 2–3.5, size 0.6R → 1.4R, alpha 0.5 → 0. Briefly blocks vision through the hole (tactical beat).
6. **Debris chunks** — 12–20, gravity 2.5, life 1, spin, concrete color.
7. **Smoke curl** — 3–4 dark puffs, delay 0.4, gravity −0.2, life 3–4, hugging the breach top.

## B10. Molotov / Incendiary Ground Fire

**Sources**
- CS2 molotov mechanics (outward spread from impact): https://cs2pulse.com/how-cs2-molotov-works/
- Loop stylized fire: https://realtimevfx.com/t/loop-stylized-fire/3946

**Construction (0.2 s break → 0.5 s spread → 7 s burn → 1.5 s dieout):**
1. **Bottle break** — 6–8 glass glints, additive, life 0.2, gravity 1.5 + small flash 0.05.
2. **Ignition whoosh** — 3–4 flame puffs, additive, radial low cone, drag 3, life 0.4, 0.3R → 0.7R, white-yellow → orange.
3. **Fire pool** — pulse disc, ground, fire-orange alpha 0.25, scale 0.2R → 1R over 0.5 s (the "spread" read), life = burn duration, radius pulsing.
4. **Flame carpet** — A9 flame layer replicated: 10–16 flames alive, scattered in the pool (bias density to rim — fuel burns at the spill edge), life 0.4–0.7 each, gravity −1.2, size 0.5 → 1 → 0.15, random phase.
5. **Black smoke column** — 4–6 dark puffs, alpha, 1.5/s, above pool, gravity −0.3, life 2–3, 0.4R → 1R, **near-black (petrol smoke is the darkest in the genre — distinguishes molotov from frag at a glance)**.
6. **Embers** — 3–5/s, additive dots, gravity −0.4 + lateral jitter, life 1–1.5.
7. **Heat glow** — bloom volume, flicker ±15% at ~8 Hz.
8. **Dieout** — pool 1R → 0.3R over 1.5 s, flame spawns contract with it; smoke persists 2 s after last flame.

---

# Cross-Cutting Principles — Fantasy RPG

Sources: [Diablo VFX GDC](https://www.youtube.com/watch?v=UJI7vPiu-g4), [LoL VFX Style Guide (Riot PDF)](https://nexus.leagueoflegends.com/wp-content/uploads/2017/10/VFX_Styleguide_final_public_hidpjqwx7lqyx0pjj3ss.pdf), [JangaFX Diablo 3 analysis](https://jangafx.com/insights/diablo-3-vfx-experiments), [ExileCon PoE effects talk](https://www.youtube.com/watch?v=KxXJn1DOuzw), [Hades FX](https://80.lv/articles/a-behind-the-scenes-look-at-the-effects-in-hades).

1. **Anticipation → climax → dissipation, roughly 10/20/70 of duration.** Skipping anticipation feels weightless; skipping long dissipation feels cheap.
2. **One hot frame.** White occupies only the first 15–25% of any layer's life; the held color carries identity.
3. **Additive for energy, alpha for matter.** The single most common amateur tell is additive-everything.
4. **The Diablo multiply trick replaces simulation:** `noise1 × noise2 × 2` with per-particle randomized pan speeds at octaves 0.5/1/2 = "boiling" on a static billboard. Highest-value shader upgrade for a no-GPU-sim runtime.
5. **Meshes for silhouettes, sprites for fill.** Ground rings communicate gameplay radius; ring timing ≤0.3 s, 8–10× start scale.
6. **Rarity/power scales counts and color, not structure.** One recipe, tier multipliers on count/size/rate/hue.
7. **Readability over realism at isometric distance:** fewer, bigger, better-drawn sprites.

# Cross-Cutting Principles — Modern Shooter

Sources: [muzzle flash thread](https://realtimevfx.com/t/wondering-how-good-muzzle-flashes-are-made/13540), [VALORANT clarity](https://technology.riotgames.com/news/valorant-shaders-and-gameplay-clarity), [Klemen Lozar](https://www.klemenlozar.com/frame-blending-with-motion-vectors/), [Beyond-FX grenade series](https://blog.beyond-fx.com/articles/episode-1-setting-up-your-unreal-project-learn-with-us-first-playable-grenade-explosion-bfx-u).

1. **Three timescales in every combat effect: ~0.05 s flash / ~0.5 s debris / 2–5 s atmosphere.** One shared lifetime = cartoon puff.
2. **Flashes live 1–2 frames** (0.03–0.08 s, no size growth). Duration, not brightness, is what makes flashes look wrong.
3. **Randomize or die:** 4–8 sprite variants, random roll, 30% size/speed jitter, tracers every 3rd–4th shot. Hash the burst-cycle counter into variant selection.
4. **Gameplay occlusion is a primitive, cosmetics are particles** (Valorant smoke architecture).
5. **Separate 1P and 3P tunings** — expose a per-recipe scale/offset profile.
6. **Material identity = color + debris ratio, not shape.** 4–6 parameters differ per material — a recipe-variant system.
7. **Fake the lighting:** bloom volume + flash sphere ARE the lighting model; flashbang gets a 3–4× intensity ceiling so hierarchy is preserved.
8. **Smoke persistence is gameplay:** frag column 3–4 s, smoke grenade 10–20 s, molotov black column for the burn. Lifetime is a design parameter.
