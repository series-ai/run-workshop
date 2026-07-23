# How to Make Great PFX

A self-contained craft guide for real-time particle effects. Everything here
is technique, not asset: the guide references only CC0 art (the Kenney
Particle Pack) and MIT-licensed software (three.js / React Three Fiber), and
every rule was earned by building and reviewing effects in this library. It
ships with the set and can be redistributed with it.

The one-sentence version: **a great effect is a short, layered sentence of
light — a bright decisive peak, supported by two to five subordinate layers,
that starts on the gameplay beat and loses its energy on purpose.**

## 1. Anatomy: effects are stacks, not emitters

No single emitter reads as "production quality." Every strong effect is a
stack of specialized layers, each doing one job, drawn back to front:

| Layer | Job | Typical settings |
| --- | --- | --- |
| Smoke / residue | Body, aftermath, contrast bed for bright layers | alpha blend, slow, grows over life, longest-lived |
| Halo / glow | Fuses the stack into one silhouette; fake bloom | one big soft additive sprite, 2.5–3× core size, low alpha (0.2–0.35) |
| Shell / body | The recognizable mass (flame, magic, liquid) | additive or alpha, mid life, size peaks ~30% into life |
| Core / hot line | The brightness center; what the eye locks onto | additive, smaller + shorter-lived + ~1.5× brighter than the shell |
| Sparks / embers | Kinetic energy, direction, sparkle | additive, small, fast, high count variance in size |
| Debris / chunks | Physical consequence | alpha blend, gravity, rotation, **no velocity stretch** |
| Ring / shockwave | Punctuation mark at the impact instant | one quad, hot birth, rapid growth with eased-out curve |
| Flash card | The single-frame "hit" exclamation | 1–3 frames at full brightness, then gone |

Most effects need four to six of these, not all eight. The fastest quality
win on a flat-looking effect is almost never "more particles" — it is adding
the missing layer (usually the halo, the flash, or the smoke bed) or fixing
the death rule of an existing one (§3).

A large, soft, low-alpha halo behind everything is the cheapest trick in this
guide: one sprite particle that doubles the perceived brightness and cohesion
of every layer drawn over it. When additive layers overlap so much they bleach
to white-cream, do the opposite — cut overlap at the source and let a single
halo particle fuse the silhouette instead.

### Particle-first is the default

For a short burst, start with two to five specialized particle layers: a focal
event, a supporting body or halo, and restrained accents. Use shared atlas
sprites and analytic motion before reaching for custom geometry. A custom mesh
is justified only when it supplies a semantic boundary, persistent volume, or
material response that particles cannot carry; it is optional, not a proxy for
quality. If the effect is particle-only, prove depth with seeded spawn lanes,
oriented particles, and front/three-quarter/side captures. The `<mesh>` object
used to draw instanced sprite quads is an implementation primitive, not a
closed-mesh art surface.

Recipe review should check the objective rules before anyone judges taste:
particle count, draw calls, source/license provenance, blend-mode death behavior,
and zero velocity stretch on debris. This keeps a visually attractive but
structurally expensive or physically misleading pass from becoming the new
baseline.

## 2. Timing: the temporal sentence

Every effect is anticipation → peak → dissipation, and the peak lands exactly
on the gameplay beat (the frame of contact, the frame the coin is collected).

- **Anticipation** is optional and short (0–120 ms): a converging shimmer, a
  brightening pre-glow. Skip it for reactive effects like hits.
- **The peak is one decisive moment**, not a plateau. Flash cards and rings
  fire here. A peak that "fades in" reads as mush; birth at or near full
  intensity, decay from there.
- **Dissipation is where quality lives.** Energy must visibly go somewhere:
  scale growth with cooling color (smoke), gravity and tumble (debris),
  velocity decay (sparks), shrink-while-bright (additive cores). Nothing may
  simply stop or vanish at constant brightness.

Practical numbers that keep reading well: flashes 80–150 ms, impact rings
150–300 ms, spark showers 400–800 ms, smoke 800–1500 ms. Stagger layer
lifetimes so the effect sheds layers as it dies — the flash is gone before
the sparks peak, the sparks are gone while the smoke still drifts. An effect
whose every layer dies on the same frame looks like a video being paused.

Two timing traps found the hard way:

- **All layers must share one clock.** If mesh layers and sprite layers run
  at different time scales, the flash never co-fires with the burst it is
  supposed to punctuate, and the effect reads as two unrelated events.
- **Very short layers need dense verification sampling.** A 130 ms flash is
  invisible to a 250 ms screenshot cadence; reviewers will report the layer
  as absent when it is merely between samples (§9).

## 3. Blend modes have opposite death rules

This is the single most load-bearing rule in the guide, and violating it
produces the most common failure in amateur effects: the dim, mustard-colored
transit where a bright element crossfades through ugliness on its way out.

- **Additive layers die by scale, at full alpha.** An additive sprite at 40%
  alpha over a mid-dark background no longer adds "dimmer fire" — it adds a
  desaturated khaki smear, because dim warm light mixed additively over cool
  backgrounds lands in the muddy middle of the color wheel. So: keep additive
  elements at full brightness and shrink them to zero, then kill the particle
  outright once it drops below ~40% of birth scale. Never alpha-fade an
  additive layer to zero.
- **Alpha-blended layers die by fade, at stable-or-growing scale.** Smoke
  that shrinks as it fades reads as being sucked backward in time; smoke that
  grows while fading reads as dispersing. Size envelopes on alpha-blended
  residue should follow fade-*in* only — grow to full size, then let opacity
  do all the dying.
- **Kill on the effective result, not one input.** A particle whose alpha
  and scale both decay can pass a "scale > 40%" check forever while sitting
  at 1% alpha. The despawn gate must consider effective brightness
  (alpha × luminance × coverage), or dead particles linger as corpse flecks.

Related floor discipline: any curve that eases opacity toward zero must
actually reach zero. An envelope that asymptotes at 1–2% alpha leaves a
permanent field of dim ghost particles that reviewers will spot on the third
frame even when authors miss it for weeks.

## 4. Color: ramps, not tints

Flat-tinted particles are the number-one tell of a cheap effect. Energy has
temperature structure: hottest at the center and birth, cooling toward the
edges and death.

- **Author grayscale sprites and map them through a 3-stop ramp** (hot →
  base → tail). This keeps one sprite reusable across every palette in the
  set and guarantees internal gradient structure. A white-hot line inside a
  wobblier, dimmer shell is what makes fire read as fire.
- **The ramp applies across the sprite, not just across the particle's
  lifetime.** Tinting an entire flame card a single per-particle color
  produces flat construction-paper cutouts; the gradient must exist within
  each sprite's own luminance range.
- **Cool the corpse.** Ember orange → deep red → near-black is a dissipation
  cue as strong as any motion. Alpha-blended residue should end darker and
  less saturated than it began.
- **Respect the background.** Warm additive layers over cool dark scenes need
  a luminance floor enforced in the shader — below it, tint tweaking cannot
  rescue the khaki mix (§3), and above it, everything reads. Test every
  effect over the darkest and lightest backgrounds it will ship against.
- **One accent hue per effect.** A fireball is orange with a yellow-white
  core; adding a blue rim light and green sparks makes it a carnival, not a
  fireball. Save hue contrast for effects whose *meaning* is dual (e.g. a
  poison-fire hybrid).

## 5. Shape and silhouette

- **Score screen-space UI as screen-space UI.** A HUD damage vignette must be
  invariant under world-camera changes; identical front, three-quarter, and
  side captures are proof that its clip-space contract holds, not evidence of
  a failed flat card. Its depth comes from foreground/background separation,
  overlapping opacity bands, and edge-to-center hierarchy. Penalize seams,
  center occlusion, camera-dependent scale, and weak perimeter composition —
  never the absence of world parallax that the effect must not have.
- **Know your camera before choosing burst geometry.** For a frontal or
  near-frontal camera, radial bursts must live in the screen plane (a circle
  in X/Y with slight depth jitter). A hemisphere or X/Z ground dome hides
  half its energy behind foreshortening and reads as a weak, lopsided puff.
- **Velocity stretch is for fast, hot things only** — sparks and tracers, at
  around 2× elongation. Never put it on debris: gravity aligns every chunk's
  velocity within a few frames, and stretched debris collapses into a single
  smeared direction. Debris tumbles; it does not streak.
- **Stretch must decay with launch speed, not current speed.** Gravity
  re-accelerates dying sparks, and if stretch tracks current velocity the
  spent sparks re-elongate into parallel falling bars.
- **Audit every sprite sheet cell before binding it.** A cell that contains a
  whole pre-drawn fan of sparks, when spawned twenty times as "individual
  particles," produces twenty identical overlapping fans — the classic
  "one-sided spark fan" bug. Single glyph per quad; if the source art is a
  multi-glyph sheet, cut it or generate procedural single-glyph cells
  instead. And check what the cell actually depicts: a lightning scribble
  bound where a flash card belongs will defeat every downstream tuning pass.
- **Mirroring only diversifies asymmetric art.** UV-flipping a radially
  symmetric sprite is a no-op; buy variation with rotation, scale spread, and
  ramp jitter instead.

## 6. Randomness that looks random

Uniform RNG produces clumps, and clumped particles read as a bug, not chaos.

- **Stratify angles.** For burst azimuths, use golden-angle spacing or
  jittered strata rather than independent uniform draws — full coverage with
  organic irregularity, no accidental gaps.
- **Distrust your generator's low bits.** Cheap LCG-style seeded generators
  correlate consecutive low-bit draws; consecutive particles get visibly
  related angles and speeds. Take the high bits, or hash the index.
- **Beware modular patterns in derived attributes.** Assigning lifetimes by
  anything of the form `(i * k) % n` means the survivors at any moment are
  angle-correlated (every nth particle), so a dying burst degenerates into a
  regular polygon of stragglers. Randomize lifetime independently of index.
- **Vary size more than you think.** A 3–8× size range between the smallest
  and largest spark in one burst is normal in effects that read as rich;
  uniform-size particles read as confetti even when everything else is right.

## 7. Physics that lies well

- **Remember that gravity is an acceleration.** On long-lived or looping
  particles it compounds: a mote given a gentle upward "drift" tuned as
  acceleration climbs off-screen within a few loops. Tune drift as a
  velocity, and reserve acceleration for arcs you actually want.
- **Drag sells mass.** Sparks that decelerate hard feel like sparks; debris
  that keeps its momentum feels like stone. Matching drag to implied material
  does more than any texture choice.
- **Loops must be stationary in aggregate.** For ambient/looping effects,
  verify the long-run bounding box is stable — per-particle motion plus
  respawn placement must not produce net migration.

## 8. Readability and restraint

- **The gameplay truth comes first.** Origin, direction, area, and timing of
  the event must survive the decoration. If a cosmetic layer moves or
  obscures the effect's gameplay boundary, cut the layer.
- **Intensity is a budget.** Screen area, contrast, motion, and duration
  should scale with gameplay importance. An idle ambient loop that outshines
  the ultimate ability is a defect even if it is beautiful in isolation.
- **Every ring is a claim of impact.** Shockwave rings are so effective that
  overuse flattens the whole set; reserve them for genuine punctuation, and
  give each one hot birth, a per-effect tint, and visible eased growth. A
  ring that peaks at 15% opacity is paying the overdraw cost of a ring while
  delivering the impact of none.

## 9. Verify with instruments and hostile eyes

The failure mode of every PFX author is self-certification: you have watched
the effect two hundred times and can no longer see it.

- **Capture film strips, not impressions.** Render fixed-interval frame
  strips of birth, peak, and death, and review the strip. Corpse particles,
  frozen residue, and popping layers are obvious in a strip and invisible at
  60 fps. Use dense strips (60–100 ms) for any layer shorter than ~200 ms.
- **Instrument before theorizing.** When a burst looks lopsided, dump the
  per-layer emission histograms (azimuth, speed, lifetime) before touching
  the shader. One numeric dump settles "is it the RNG or the rendering?"
  arguments that visual staring never will.
- **Review against references at the same craft tier you are targeting**, and
  have the review done by eyes that did not author the effect. Grade
  silhouette, temporal arc, color discipline, and readability separately —
  a high average must not excuse a failing dimension.
- **Compare rest frames.** Two captures taken after the effect should be over
  must be pixel-identical; any static difference is a despawn leak.
- **Use the lifecycle contract that matches the semantic type.** Bursts need a
  clean anticipation/action/recovery sentence and a true rest frame. A
  persistent status loop instead needs an always-legible baseline, controlled
  modulation, and a seamless repeat; grading it down for not disappearing is
  grading the wrong product behavior.

## 10. Performance: overdraw is the enemy

Particle *count* is rarely the mobile bottleneck; *overdraw* is. A handful of
huge, stacked, low-alpha quads costs more than a hundred small sparks.

- Budget roughly 40–60 live particles per hero effect on mobile; cap smoke
  layers first, since large soft alpha-blended quads are the overdraw hogs.
- Prefer one big halo sprite to real bloom post-processing when targeting
  low-end devices — it is the same visual statement at a fraction of the
  cost.
- Shrink additive particles instead of fading them (§3): correct *and*
  cheaper, since a shrinking quad rasterizes fewer fragments every frame.
- Pool and reuse particle buffers; per-effect allocation churn shows up as
  frame hitches long before raw draw cost does.

## Quick diagnostic table

| Symptom | Likely cause | Fix section |
| --- | --- | --- |
| Dim mustard/khaki smears during fade | Additive layer alpha-fading out | §3 |
| Permanent faint flecks after effect ends | Alpha floor never reaches zero, or kill gate checks the wrong input | §3, §9 |
| Flat "paper cutout" flames | Per-particle tint instead of an intra-sprite ramp | §4 |
| Everything bleaches to cream at the peak | Additive over-stacking | §1, §4 |
| One-sided or fan-shaped "radial" burst | Multi-glyph sprite cells, or correlated RNG | §5, §6 |
| Dying burst leaves a regular polygon of stragglers | Index-modular lifetimes | §6 |
| Debris smears into parallel streaks | Velocity stretch on debris / stretch tracking current speed | §5 |
| Weak, lopsided burst on a frontal camera | X/Z dome geometry instead of screen-plane radial | §5 |
| Ambient loop slowly drifts off-screen | Drift tuned as acceleration | §7 |
| Flash layer "missing" in review | Layer clock desync, or sampling coarser than the flash | §2, §9 |
| Rich effect turns to mush at a distance | No halo fusing the silhouette; peak is a plateau | §1, §2 |
