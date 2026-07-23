# VFX Reference Recipes — Casual/Puzzle & Space Genres

Companion to `reference-recipes.md`. Research compiled from GDC talks, RealtimeVFX
threads, studio tech blogs, and production tutorials, mapped to this library's
tuning vocabulary: per-layer `sprite / blend / delay / window / countScale /
speedScale / gravity / drag / size [from,mid,to] / stretch / ramp`, plus
burst-synced mesh primitives (`flash / shockwave / pulse / bloom`) and the
custom mesh shaders (`fresnel-shell / vortex-swirl / arc-sweep`). Lifetimes in
seconds, sizes as multiples of the effect's base radius.

---

# GENRE A — Casual / Puzzle Mobile

## A1. Match-Clear Pop / Burst

**Sources**
- Royal Match / Toon Blast VFX analysis: https://medium.com/@ekinmelissezer/game-analysis-for-royal-match-and-toon-blast-9c4bff8ef48b — "small fragments scatter and fall away… subtle but adds weight to each match"; per-obstacle-type debris
- Game-feel numeric recipes: https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/ — 20–30 particles max, initial velocity 200–400 px/s, total life 0.5–1.0 s, flash 50–100 ms
- Godot Candy Crush clone, particle episode: https://www.youtube.com/watch?v=j26_9O6Hg1g
- Unity Gem Hunter Match (official match-3 VFX sample): https://unity.com/blog/engine-platform/2d-puzzle-match-3-sample-gem-hunter-match
- "Juice it or lose it" (Jonasson & Purho, GDC 2012): https://www.youtube.com/watch?v=Fy0aCDmgnxg

**Construction** (total effect ≤ 0.6 s; one burst cycle)
1. **Flash sphere (mesh primitive)** — delay 0, life 0.08–0.10 s. Scale 0.3→1.2× tile size, alpha 1→0 linear. Tile-colored, additive. Below 30 ms is imperceptible, above 150 ms reads blurry.
2. **Pop core** — 1 sprite, soft radial glow, additive. Delay 0, window 0.02 s, life 0.25 s. Size curve 0.4× → 1.3× (peak at 25% life) → 0. Color ramp: white-hot 15% → tile color held. Speed 0.
3. **Shard debris** — 8–12 sprites, chunky fragment sprite, **alpha blend** (debris should occlude, not glow). Delay 0.03 s, window 0.05 s, life 0.45–0.6 s. Speed: radial 1.5–3× tile/s, gravity −4 to −6 tile/s² (they must FALL — the signature Royal Match read), drag low (0.5). Size 1× → 0.8 → 0.4, random spin.
4. **Sparkle accents** — 4–6 sprites, 4-point star, additive. Delay 0.05 s, window 0.1 s, life 0.35 s. Speed 0.8× radial, gravity −1, size 0.3 → 0.6 → 0 (grow-then-die = twinkle). White→tile color.

**2D vs 3D** — Pure billboard/flat effect; orthographic-friendly. Depth faked by layer order and gravity giving a "table plane" read. On ortho cameras replace flash sphere with a pulse disc.

## A2. Cascade Sparkle Trails (falling/combo gems)

**Sources**
- Royal Match analysis (rocket "leaves a bright trail of light and sparks"): https://medium.com/@ekinmelissezer/game-analysis-for-royal-match-and-toon-blast-9c4bff8ef48b
- Godot Candy Crush animated effects episode: https://www.youtube.com/watch?v=KQjBdK3Isog
- HypeHype star-burst particle recipe: https://learn.hypehype.com/art-and-assets/particle-effects/creating-particle-effects — star sprite, particle age 0.75, amount 10, size animates 3.0→0.0

**Construction** (loop while gem falls; the trail is a shed-particle trail)
1. **Shed motes** — continuous window at ~25–40 particles/s per falling gem, soft-dot sprite, additive. Life 0.4 s. Emit with tiny random radial speed 0.1–0.3 and **drag high (2–3)** so they stall immediately; the gem's motion paints the trail. Gravity −0.5. Size 0.35× gem → 0.2 → 0, alpha fades last 60%. White-hot 20% → gem color held.
2. **Twinkle stars** — 1 in 4 shed particles uses a 4-point star sprite, life 0.6 s, size 0.15 → 0.45 → 0. Additive, hue toward white.
3. **Landing puff** (burst on settle) — 5–6 dot sprites, additive, life 0.3 s, hemispherical up-spread speed 1× tile/s, gravity −3, size 0.3 → 0.5 → 0.

**2D vs 3D** — Reads best flat. The "trail" trick without ribbons: high emission rate (spacing < half sprite width) + near-zero particle velocity + short life. Additive, no depth-write, so overlapping motes sum into a streak.

## A3. Tile-Break Confetti

**Sources**
- Confetti FX asset breakdown (Directional / Explosion / Fountain archetypes): https://styly.cc/tips/introduction-to-unity-asset-confettifx-bubu/ and https://assetstore.unity.com/packages/vfx/particles/confetti-fx-82497
- 2D confetti particle tutorial: https://www.youtube.com/watch?v=Zl-oZLLcK9g

**Construction** (single burst, 0.9–1.2 s; the long tail differentiates confetti from a pop)
1. **Confetti flakes** — 15–25 small rectangle sprites (3–5 palette colors), **alpha blend, unlit flat color** — confetti must NOT glow. Window 0.04 s. Life 0.9–1.2 s. Cone-up burst 2–4× tile/s. Gravity −3 to −4 with **drag high (1.5–2.5)** — the drag/gravity combo produces "shoot up fast, flutter down slow." Size constant 0.15–0.25× tile, no fade until last 25%. Fake tumble: per-particle spin + mixed edge-on/face-on sprite variants.
2. **Break flash (pulse disc)** — life 0.1 s, tile-sized, tile-colored, additive, alpha 0.6→0.
3. **Dust poof** — 3–4 soft-cloud sprites, alpha at 30% opacity, life 0.5 s, size 0.6 → 1.1 → 1.3 with alpha 0.3→0, speed 0.3 radial, no gravity.

**2D vs 3D** — The 3D variant's only addition is two-sided flakes; for billboards, sine scale-X wobble is the cheap equivalent.

## A4. Booster Charge + Activation (Rocket / Bomb / Rainbow)

**Sources**
- Royal Match analysis (rocket trail, TNT ripple, Light Ball pre-glow telegraph): https://medium.com/@ekinmelissezer/game-analysis-for-royal-match-and-toon-blast-9c4bff8ef48b
- Match-3 booster VFX references: https://www.artstation.com/artwork/eWVzD, https://www.artstation.com/artwork/Qn96n8, https://www.artstation.com/artwork/B3XKJ4
- Match3 Game Effect Collection: https://assetstore.unity.com/packages/vfx/particles/fire-explosions/match3-game-effect-collection-273272

**Charge (0.3–0.5 s pre-telegraph):**
1. **Converging motes** — 8–10 dot sprites, additive. Emit at radius 1.2× tile with inward radial velocity ~2.5 tile/s, life tuned to die at center (~0.45 s). Size 0.2 → 0.3 → 0.05. White→booster color.
2. **Pulsing glow (bloom volume)** — life = charge window, sine-pulsed alpha 0.3↔0.7 at 3 Hz, size 1.1× tile.

**Rocket activation (~0.4 s across the board):**
3. **Head flash sphere** — life 0.08 s, 1.5× tile, white.
4. **Exhaust trail** — shed trail at 60/s, life 0.3 s, additive streak, stretch 2–3×, size 0.5 → 0.3 → 0, white-hot 30% → orange held.
5. **Per-tile hit bursts** — A1 recipe at 60% scale, staggered 0.03 s/tile so destruction visibly *chases* the rocket.

**Bomb/TNT (~0.5 s):**
6. **Flash sphere** — life 0.1 s, scale 0.5→2.5 tiles, white→orange.
7. **Shockwave ring** — delay 0.02 s, life 0.35 s, radius 0.3→2.5 tiles, alpha 0.8→0.
8. **Fire puffs** — 10–14 cloud sprites, additive, delay 0.05 s, window 0.08, life 0.4 s, radial 3 tile/s with drag 2, size 0.6 → 1.0 → 0.2, white→orange→deep red.
9. **Debris** — A1 layer 3 at 2× count, speed 4–5 tile/s, gravity −6.

**Rainbow/color-bomb (0.6 s):**
10. **Charge swirl** — 12 star sprites, additive, circle emission with tangential velocity, hue-cycled, life 0.5 s.
11. **Bloom volume** — life 0.3 s, 3× tile, white, plus per-target sparkle trails staggered 0.04 s.

**2D vs 3D** — Boosters are where casual games spend "premium" feel budget, achieved through *sequencing* (charge → flash → wave → staggered pops), not volumetric complexity.

## A5. Star-Reward Bursts

**Sources**
- HypeHype "Star Burst" (full numeric recipe): https://learn.hypehype.com/art-and-assets/particle-effects/creating-particle-effects — age 0.75 s, burst amount 10, effect duration 0.0625 s, size 3.0 → 0.0
- mo.js burst tutorial: https://mojs.github.io/tutorials/burst/ — even 360° placement, radius 0→100, stagger(0,100 ms), elastic scale easing, opacity 1→0

**Construction** (star slams into slot; ~0.8 s)
1. **Impact flash (pulse disc)** — life 0.1 s, 1.5× star, gold, additive, alpha 0.9→0.
2. **Star burst** — 10 four-point-star sprites, additive. Delay 0.02 s, window 0.06 s. Life 0.75 s. Radial 2.5×/s with drag 1.5, gravity −1.5. Size **0.5× → 0.25 → 0** — stars are born big and die shrinking; do NOT grow them. White-hot 10% → gold held.
3. **Ring echo (shockwave)** — delay 0.05 s, life 0.3 s, radius 0.5→2×, gold, alpha 0.5→0.
4. **Lingering twinkles** — 4 sprites, delay 0.25 s, window 0.3 s (the late window makes it "rewarding" not "explosive"), life 0.4 s, near-zero speed, size 0.1 → 0.3 → 0.

**2D vs 3D** — Screen-space overlay. Even angular spacing reads "designed," random spacing reads "debris" — use even distribution ±8° jitter for reward bursts.

## A6. Goal-Complete Celebration (confetti cannons, fireworks)

**Sources**
- Royal Match analysis ("trumpets sound and fireworks explode"): https://medium.com/@ekinmelissezer/game-analysis-for-royal-match-and-toon-blast-9c4bff8ef48b
- Confetti FX archetypes: https://styly.cc/tips/introduction-to-unity-asset-confettifx-bubu/
- Unity victory confetti: https://www.youtube.com/watch?v=fUIy7smuebI, https://www.youtube.com/watch?v=Iw5EAfeATXU

**Construction** (2.0–2.5 s choreography of A3/A5)
1. **Corner cannons ×2** — Directional confetti from bottom corners, aimed 60–70° inward. 40–60 flakes each, launch 6–8× tile/s, gravity −3, drag 2 (flutter 1.5–2 s). Second cannon delayed **0.15 s** — the stagger is load-bearing.
2. **Firework shells ×3** — riser (1 stretched additive sprite, life 0.4 s, up 5×/s, stretch 3×, sparkle shed) + burst at apex: 24–36 dots, additive, radial 3×/s, drag 2.5, gravity −1.5, life 0.9 s, size 0.2 → 0.15 → 0 with alpha flicker last 30%, white → shell color → dim ember. Shells at 0.3 / 0.7 / 1.1 s, alternating screen thirds.
3. **Bloom volume** — behind UI, warm gold alpha 0.15, sine pulse.
4. **Star/coin payoff** — chain into A5/A7 from ~1.2 s.

**2D vs 3D** — Fireworks benefit from a slight camera-facing Z spread; on ortho fake the far side by making 30% of shell particles smaller/dimmer.

## A7. Juicy UI Feedback (button bursts, coin fly-to-counter)

**Sources**
- Coin-fly construction (curved path, ~1 s despawn): https://medium.com/@trisledinh/unity-how-to-create-effect-coin-fly-in-less-than-15-minutes-9a2e7f72aff2
- Game-feel numbers (flash 50–100 ms, ≤20–30 particles, 3–5 feedback events/s ceiling): https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/
- mo.js micro-interaction bursts: https://mojs.github.io/tutorials/burst/

**Button press (≤0.35 s, ≤10 particles — restraint is the spec):**
1. **Press ring (shockwave)** — life 0.25 s, radius 0.8→1.4× button, alpha 0.5→0, accent color.
2. **Corner sparks** — 5–6 dot/star sprites, additive, window 0.03 s, life 0.3 s, radial 1.5×/s, drag 2, size 0.15 → 0.1 → 0, even angular spacing.
3. Ordering: haptic+sound at t=0, flash at +20 ms, particles at +50 ms.

**Coin fly-to-counter (per coin ~0.6–0.8 s):**
1. **Coin sprites** — 5–12 coin billboards, alpha. Phase 1: burst scatter (radial 1–2×/s, drag 3, stall in 0.15 s). Phase 2: scripted per-instance lerp along a quadratic bezier (control point 25% perpendicular), 0.4–0.5 s, ease-in, staggered 0.04–0.06 s.
2. **Per-coin micro-trail** — 10–15 additive soft dots/s, life 0.25 s, size 0.3 coin → 0, gold.
3. **Counter hit** — pulse disc on the counter (0.12 s, 1.3×), number ticks +1 with 1.15× punch-scale, tiny 3-spark burst. Per-arrival feedback makes the counter "eat" the coins.

**2D vs 3D** — Strictly screen-space. The coin flight is transform animation; only the scatter pop and trails are particles.

## Genre A — Cross-Cutting Principles

1. **Sequence beats simultaneity.** flash (0.05–0.1 s) → burst (0.2–0.5 s) → settle/fall (0.4–1.2 s), layer delays 0.02–0.05 s. Staggered chains read as *events*; simultaneous everything reads as noise.
2. **Restraint numbers:** 20–30 particles per event max, 3–5 feedback events/s, flashes 50–100 ms. Casual VFX die from clutter before cheapness.
3. **Two blend populations:** additive for light (flashes, sparkles, rings), alpha/unlit for matter (debris, confetti, dust). The matter layer falling under gravity (−3 to −6, drag 1.5–2.5) gives casual effects their weight.
4. **Gravity + drag is the genre's physics signature** — fast launch, hard stall, slow flutter-fall. Almost no casual effect uses linear un-dragged motion.
5. **Color discipline:** white-hot first 10–30% of life, then the payload color held; palette matches the tile/booster that caused it.
6. **Everything is 2D-readable.** Assume orthographic; pulse discs and rings instead of spheres; layer ordering instead of depth.

---

# GENRE B — Space RTS / Space Shooters

## B1. Engine Exhaust Trails (ion / plasma)

**Sources**
- Rocket Thruster Exhaust FX (12 Niagara archetypes, local-space sim): https://www.unrealengine.com/marketplace/en-US/product/rocket-thruster-exhaust-fx
- Thruster Exhaust VFX Pro: https://www.unrealengine.com/marketplace/ja/product/thruster-vfx/questions?lang=en-US
- Unity stretched-billboard mode: https://docs.unity3d.com/Manual/PartSysRendererModule.html
- Homeworld engine-trail discussion: https://forum.thegamecreators.com/thread/47307
- UE spaceship exhaust trail tutorial: https://www.youtube.com/watch?v=9BGUyx4e5vE

**Construction** (looping; per nozzle)
1. **Hot core** — 1–2 overlapping billboards pinned at nozzle, soft radial glow, additive, life 0.1 s respawn (flicker ±20% size). Size 1.0–1.3× nozzle, white-blue (ion) or white-orange (plasma). Zero velocity.
2. **Exhaust plume** — 30–60/s, streak sprite, additive, life 0.4–0.7 s. Rear-axis 3–5 diam/s, spread ±5°, **stretch 2–4×** (the whole plume read is stretch, not count). Size 0.8 → 0.5 → 0.1; white 10% → cyan held (ion) / white → orange → smoke-red (plasma). No gravity, drag 0.
3. **Trail streamer (Homeworld-style)** — 20–30/s at nozzle in world space, near-zero velocity, drag 3 (instant stall), life 1.5–3 s, stretch 1.5 aligned to ship velocity at spawn, additive at alpha 0.15–0.25, size 0.6 → 0.4 → 0. The ship's motion draws the line. Scale life with ship speed to avoid dotted gaps.
4. **Spark shed** (damaged/afterburner) — 6–10/s, tiny dots, life 0.6 s, ±15° rear cone, drag 1, flicker.
5. **Bloom volume** — one per nozzle, constant, 2× nozzle, engine color alpha 0.2.

**2D vs 3D** — In 3D the stretch axis must be world-velocity-aligned or the plume collapses viewed from behind; when view is axis-aligned, fade the plume and boost core glow (from-behind reads as a hot disc). In 2D, a fixed rear-pointing layer with sine-jittered size.

## B2. Laser Bolt + Beam Impacts

**Sources**
- CGHOW projectile hit (sphere core + rays + two glows + debris + sparks + decal; 2.3 s hero timing): https://cghow.com/ue4-niagara-projectile-2/
- Laser beam breakdown (Daniil Shmelkov): https://www.artstation.com/artwork/kQyYBd
- Stylized laser beam (Gabriel Aguiar): https://www.youtube.com/watch?v=_SaBXY-Ejqo
- RealtimeVFX laser tips: https://realtimevfx.com/t/realtime-vfx-tutorials-laser-animation-and-interaction-tips/26534

**Bolt:** core (hard capsule sprite, additive, stretch 3–5×, white, travels with entity) + halo (soft glow, 2.5× core, bolt color, alpha 0.6) + muzzle burst (flash 0.05 s + 4–6 sparks, cone ±30°, life 0.15 s).

**Impact (0.3–0.5 s; scale hero timing down ~5× for gameplay):**
1. **Impact flash sphere** — life 0.08 s, 2× bolt width, white→bolt color.
2. **Radial + soft glow pair** — tight radial 1×→1.5 and large soft 2.5×→3; both additive, life 0.2 s, alpha →0.
3. **Sparks** — 8–12 dot/streaks, additive, window 0.03 s, life 0.3–0.5 s ±40%, reflected hemisphere 3–6×/s, stretch 2–3, gravity 0, drag 0.8, size 0.2 → 0.15 → 0.
4. **Scorch shards** — 4–6 dark fragments, alpha, life 0.4 s, speed 1.5×/s, drag 1.5 — gives the hit "matter."

**Beam variant:** core = stretched quad scaled to hit distance, UV-scroll or pulse alpha 8–12 Hz; halo quad 2.5× width at 30%; looping sparks 20/s + respawned pulse disc at hit point. Windup 0.15 s small glow before full width — beams need anticipate/fire/fade states.

**2D vs 3D** — Bolts are billboards even in AAA. Impacts inherit surface normal in 3D; mirror incoming velocity in 2D. Beams in 3D want two crossed quads.

## B3. Shield Hits (hex ripple)

**Sources**
- **Poimandres R3F flow shield (native to our stack):** https://pmnd.rs/blog/creating-flow-shield/ — sphere [1.8, 64, 64]; fresnel `pow(1.0 - dot(vNormal, vViewDir), uFresnelPower) * uFresnelStrength`; hex grid via object-space triplanar with hexFade seam mask; ripple `ringR = min(elapsed * uHitRingSpeed, uHitMaxRadius)` with brightness `smoothstep(uHitRingWidth, 0.0, abs(dist + noiseD - ringR))` using **geodesic distance**; base #26aeff → damage red; dual-octave noise at t, t*0.6, t*0.4; transparent, depthWrite:false, AdditiveBlending; fixed MAX_HITS ring buffer.
- UE4 force shield thread: https://realtimevfx.com/t/ue4-force-shield-material/6003
- Unity VFX Graph shield: https://www.youtube.com/watch?v=IZAzckJaSO8

**Construction** (mesh-led; particles are garnish)
1. **Shield bubble** — our `fresnel-shell` shader. Idle: fresnel rim (power ~3, face-on alpha ≈0.05, rim ≈0.4), faint pattern, cyan.
2. **Hit ripple** — ring expanding from hit point over 0.4–0.6 s to 60–90° arc, width ~10% of max radius, brightness 3–4× base, toward red with damage. Billboard fallback: pulse disc tangent at hit + second disc delayed 0.08 s at 60% (double-ring reads as ripple).
3. **Hit flash** — flash sphere at impact, life 0.06 s, 0.5× ship, white-cyan.
4. **Hex shards** — 8–12 hex sprites, additive, window 0.04 s, life 0.5 s, tangent-plane outward 1–2 radii/s, drag 1.5, size 0.15 → 0.1 → 0, cyan→white flicker.
5. **Failure state** — alpha spike to 1 over 0.1 s, sphere scale 1→0.85 over 0.2 s while 20–30 shards burst omnidirectionally, 3×/s, life 0.8 s.

**2D vs 3D** — 2D flattens to ellipse ring + expanding hit ring + hex sparkles; fresnel rim becomes a rim-gradient ellipse sprite. Additive + no depth-write is essential so the shield never occludes the ship.

## B4. Ship Explosions (flash → debris → gas shell → embers)

**Sources**
- Star Citizen explosion pipeline: https://80.lv/articles/vfx-of-star-citizen-working-on-explosions — 32-bit temperature gradient remap; 5-direction lighting bake; optical-flow frame blending
- Star Citizen breakdown thread: https://realtimevfx.com/t/star-citizen-explosion-vfx-breakdown/632 — "easy for fire to bloom out all the detail"
- Stylized explosion breakdown: https://realtimevfx.com/t/stylized-explosion/11742
- GDC VFX Bootcamp Rapid Talks: https://www.gdcvault.com/play/1024299/Visual-Effects-Bootcamp-Rapid
- GDC "Zip! Thwack! Ping!" (jitter event timing by ms): https://www.gdcvault.com/play/1025417/Visual-Effects-Bootcamp-Zip-Thwack

**Construction** (fighter ~1.6 s; capital ×2–3 lifetimes + staggered hull sub-explosions)
1. **Pre-flash** — life 0.06 s, 2× ship, pure white. Hides the sprite handoff.
2. **Shockwave ring** — delay 0.02 s, life 0.4 s, radius 0.2→3× ship, alpha 0.7→0, camera-facing (vacuum shockwave is a stylization).
3. **Fireball core** — 6–10 cloud sprites, additive, delay 0.03 s, window 0.06 s, life 0.5 s. Radial 1.5 ship/s, drag 2.5. Size 0.5 → 1.4 → 1.6. Temperature ramp: white 10% → yellow 25% → orange 60% → deep red held.
4. **Expanding gas shell** — 10–16 soft clouds, **alpha blend**, delay 0.15 s, window 0.1 s, life 1.0–1.4 s. Radial 2 ship/s, drag 1 (keeps drifting — vacuum). Size 0.8 → 1.8 → 2.2, alpha peak 0.35 at 30% → 0. Orange-lit smoke → cool grey held. Drifting *without gravity* is the genre signature.
5. **Debris chunks** — 10–20 dark hull-shard sprites, alpha, delay 0.05 s, life 1.5–2.5 s. Speed 2–4 ship/s, **zero gravity, zero drag** — straight ballistic lines say "space." Stretch 1.5 for fast chunks. 30% get ember micro-trails.
6. **Sparks** — 20–30 streaks, additive, life 0.6–1.0 s, 4–6 ship/s, stretch 3, drag 0.3, white→orange, flicker last 40%.
7. **Lingering embers** — 8–12 dots, additive, **delay 0.4 s**, window 0.5 s, life 1.5–2 s, drift 0.2–0.5, sine flicker 4–6 Hz, deep orange→red. The late layer makes it feel like it *happened somewhere*.
8. **Bloom volume** — life 0.5 s, 3× ship, orange, alpha 0.4→0.
9. **Secondary pops** (capitals) — 2–4 half-scale reruns of 1+3 at hull offsets, delays 0.2–0.9 s, jittered tens of ms.

**2D vs 3D** — Our equivalent of lit flipbooks: 2–3 noise-cloud variants + strong ramp + bloom. 3D: spread clouds in a shell, size-by-depth. 2D: collapse 3+4 into one plane, lean on ring + debris lines. Keep fireball additive alpha ≤0.7 or bloom flattens the detail.

## B5. Warp / Hyperspace Jump

**Sources**
- UE5 lightspeed FX (cylinder emitter tunnel, axial velocity, stretch, shorter lifetimes = faster read): https://sol-o-mon.art/fx-challenge-creating-a-lightspeed-effect-in-unreal-engine-5-5-3/
- Gabriel Aguiar warp drive: https://www.youtube.com/watch?v=VsGG5JYlqIU and https://www.youtube.com/watch?v=4hlCOUoc6aQ
- RealtimeVFX warp thread: https://realtimevfx.com/t/unity-vfx-graph-warp-speed-effect/14195

**Ship-exits variant (1.1 s, three phases):**
- *Charge (0–0.4 s):* converging streaks — 15–20 streaks, additive, ring 2 ship-lengths ahead, inward 4×/s, stretch 4, life 0.35 s, blue-white; focal bloom at nose 0.3→0.8× ship, alpha 0→0.7.
- *Jump flash (0.4–0.5 s):* flash sphere 0.1 s, 3× ship, white; ship transform stretch scale-Z 1→6 over 0.08 s then to 0. Departure streak: 1 long billboard along exit vector, life 0.25 s, length 8× ship, white→blue.
- *Residue (0.5–1.1 s):* collapse ring — radius 1.5→0.2× ship (contracting, inverted from explosions), alpha 0.6→0, blue; sparkle residue 10–15 dots, drift, flicker, cyan.

**Travel-tunnel variant (player POV):** cylinder-shell emission around camera, radius 1.2–2× FOV width, particles spawned ahead with high axial velocity (20–40 u/s), stretch 6–10×, life 0.3–0.5 s, 100–200 alive, additive white-blue with 10% warm accents; fresnel-faded tunnel cylinder at alpha 0.1.

**2D vs 3D** — The jump phases work flat: white silhouette flash + horizontal departure streak. Tunnel is inherently 3D; 2D equivalent = full-screen horizontal streaks or FTL's white fade + starfield swap.

## B6. Missile Smoke Corkscrew Trails

**Sources**
- Itano Circus (canonical corkscrew swarms): https://macross.fandom.com/wiki/Itano_Circus, https://en.wikipedia.org/wiki/Ichir%C5%8D_Itano
- Niagara spiral technique: https://www.youtube.com/watch?v=fLir7lS9ygs, https://cghow.com/spiral-burst-fx-in-ue5-niagara-tutorial/

**Construction** (per missile; trail persists 1.5–2.5 s)
1. **Missile motion (transform-level):** helix offset `r(t)·(cos(ωt)·U + sin(ωt)·V)` around flight vector, r 0.5–1.5 missile-lengths, ω 2–4 rad/s, per-missile random phase + handedness. Swarms: 5–15 missiles with individually randomized r/ω/phase and 0.05–0.1 s staggered launches.
2. **Smoke puff trail** — 30–50/s at tail, **alpha blend** clouds, near-zero velocity, drag 3, life 1.5–2.5 s. Size **grows 0.3 → 0.8 → 1.0** with alpha 0.5 → 0.25 → 0 — expanding-fading puffs make the corkscrew read as a drawn line. White-grey → pale grey held; first 10% warm.
3. **Motor flare** — additive glow at tail, 0.6× missile, flicker ±25% at ~15 Hz + 10/s tiny sparks.
4. **Launch** — flash 0.06 s + 6–8 puffs, lateral pop, drag 2.5.
5. **Impact** — B4 at 40% scale, skip gas shell, double sparks.

**2D vs 3D** — Puffs beat ribbons here even where ribbons exist (billboard volume reads from any angle). 2D: collapse helix to a sine offset (amplitude 0.5–1 lengths, 2–3 Hz). Alpha-blend the smoke or crossing swarm trails blow out to white.

## B7. EMP Bursts

**Sources**
- Ring pulse material construction: https://techarthub.com/unreal-engine-ring-pulse/
- Grenade EMP VFX pack: https://www.unrealengine.com/marketplace/en-US/product/grenade-emp-vfx
- Electric implosion/explosion (Unity): https://www.youtube.com/watch?v=uR2jcU3x3kU

**Construction** (0.9 s; blue-white electric identity)
1. **Implosion pre-beat** — 10–12 dots, additive, window 0.15 s, life 0.25 s, **inward** (emit at 1.5× radius, 6×/s toward center), cyan. The suck-in makes the pulse feel caused.
2. **Detonation flash** — delay 0.25 s, life 0.08 s, 1.5×, white-cyan.
3. **Primary shockwave ring** — delay 0.25 s, life 0.5 s, radius 0.1→4×, alpha 0.9→0, noisy-edged ring variants, electric blue.
4. **Echo rings** — 2 more at delays 0.33 / 0.41 s, 70% / 45% alpha, 85% speed — triple-pulse cadence reads "EMP."
5. **Arc flickers** — 10–14 lightning-bolt sprite variants, additive, window 0.3 s, life 0.08–0.12 s each (the shortness IS electricity), on the expanding circumference, random rotation/flip, white-core cyan.
6. **Residual sparks** — 8–10 dots, delay 0.4 s, life 0.6 s, drift, flicker 8 Hz, blue.
7. **Victim feedback** — pulse disc per disabled ship + 3–5 hull arc flickers for 0.5–1 s, then engine glow off.

**2D vs 3D** — Ring-language, naturally 2D. In 3D orient primary ring to game plane, add one camera-facing echo for grazing angles.

## B8. Nebula Ambient Dust

**Sources**
- Unity ambient dust (start speed 0.03, size 0.05, "most minuscule values you can afford"): https://dennisse-pd.medium.com/creating-dust-particles-in-unity-3d-f8a59d871555
- Ambient particles w/ VFX Graph: https://www.youtube.com/watch?v=NGELU_dDc_Y

**Construction** (looping, camera-attached; the job is parallax + scale)
1. **Near motes** — 40–80 alive, tiny soft dots, additive 15–25% alpha, sphere ~1.5× frustum, life 6–10 s, ease-in 20% / ease-out 30% (never pop at boundaries), speed 0.02–0.05 u/s, sine drift. Size 0.02–0.05 constant.
2. **Far haze billboards** — 6–12 large nebula-cloud sprites, alpha 4–8%, life 20–30 s or static, size 10–30 u, palette-tinted, rotation 0.5°/s.
3. **Twinkle layer** — 10–15 star dots, additive, life 2–4 s, alpha 0 → 0.5 → 0 sine, zero velocity.
4. **Local reaction** — ships passing emit a wake burst: 10–15 particles, life 1 s, pushed 0.5 u laterally, drag 2.

**2D vs 3D** — 3D: 2–3 mote layers at different depths = free parallax. 2D: hand-scroll 3 layers at 0.2× / 0.5× / 0.9× camera speed. Ambient layers that register consciously are overtuned.

## Genre B — Cross-Cutting Principles

1. **Space physics = no gravity, low drag, long lives.** Debris flies ballistically; gas shells drift and linger. The *absence* of stall-and-fall is the genre read. Reserve drag for smoke puffs and deliberate stalls.
2. **Temperature ramp is the universal color law:** white → yellow → orange → red → dark, compressed into the first 30% of life. Swapping the ramp turns fire into plasma into ion without touching sprites.
3. **Every event is flash-first:** a 0.05–0.1 s white flash opens every impact, launch, explosion, jump. It sells energy and masks spawn seams.
4. **Additive layers bloom out detail:** cap stacked additive alpha ~0.7 and always pair additive light with an alpha-blended matter layer or effects read as weightless glow.
5. **Stretch is the speed channel.** Velocity-aligned stretch (2–10×) carries all motion legibility; shed-particle trails (high rate, near-zero velocity, high drag) replace ribbons everywhere.
6. **Multi-stage timing with jitter:** chains at 0.2–0.9 s offsets with tens-of-ms jitter — metronomic chains read fake. Late layers (embers +0.4 s, echo rings +0.08 s) make effects consequential.
7. **3D reads come from three cheats:** shell-distributed cloud sprites, one mesh primitive per event, depth-scaled ambient dust. Everything else stays a billboard — same as the AAA references.
