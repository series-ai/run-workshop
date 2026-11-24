# RUN dice animals

A stacking-friendly pack of cute animals built as dice, plus regular dice,
a tintable plain cube, terrain cubes and puzzle pieces (buttons, fans,
conveyors and friends). Each is an animated GLB (rigid parts
on a node hierarchy with TRS clips, no skinning), so they play in three.js and
any glTF engine.

```
models/    one GLB per animal, prop and puzzle piece
stills/    a 3/4 still of each, lineups, the expression sheet
viewer/    a little three.js page to click through models and clips
scripts/   the Blender build scripts (dice.py animals, props.py props)
```

Preview: from this folder run `python3 -m http.server 8794` and open
http://127.0.0.1:8794/viewer/ (it loads three.js from unpkg). ↑ ↓ step
through clips, ← → through models; there are loop, speed and tint controls.

Build (Blender 5.1, headless; from this folder):

```
Blender -b --factory-startup -t 1 --python scripts/dice.py -- models [animal ...]   # FACES=1 also writes expression stills
Blender -b --factory-startup -t 1 --python scripts/props.py -- models [prop ...]
Blender -b --factory-startup -t 1 --python scripts/strip.py -- models/sheep.glb review.png 10 roll drop spin   # review strip
Blender -b --factory-startup -t 1 --python scripts/reel.py -- models/sheep.glb reel roll drop spin_start+spin_loop+spin_end
```

The scripts write `<name>.glb` and `<name>-34.png` into the output folder;
move the stills into `stills/`. Then slim the animation (drops keys that
linear interpolation already reproduces, and channels no clip ever moves;
plain Python, poses stay within 1e-4):

```
python3 scripts/slim.py models/*.glb
```

`models/` stays plain glTF. The copies that ship (the asset library) are
meshopt-compressed, which needs the decoder at load time
(`loader.setMeshoptDecoder(MeshoptDecoder)` in three.js):

```
npm install
node scripts/compress.mjs <out dir> models/*.glb
``` `bobble.py` and `blockout.py` are the shared
primitives from the Bobble kids concepts (rounded boxes, balls, cans, limbs).

## Animals

Every animal is the same 2 × 2 × 2 cube on tiny nub feet (2.16 tall with the
feet), so they stack on a grid. The top stays flat: ears, wings and horns
sit on the sides or lie flat, and markings are flat paint.

Animals (47), all exported at the same size (scale them in code if you want
small ones):

- Farm: cow, pig, sheep, horse, donkey, goat, chicken, hen, rooster, chick,
  duck (a mallard), goose, turkey, bunny, dog, mouse
- Cats: cat (orange tabby), cat_grey, cat_black, cat_tuxedo, cat_calico,
  cat_siamese
- Field and pond: frog, fox, raccoon, hedgehog, turtle (the die is the shell, a head pokes out),
  skunk
- Owls: owl, owl_barn (heart face)
- Bears: bear (brown), bear_black, bear_polar, bear_sun, bear_teddy, panda
- Wild: lion, tiger, moose, elephant, giraffe, zebra, monkey,
  koala, penguin, hippo, crocodile

Odd shapes on purpose, for game rules: the hedgehog's spines and the
turtle's rounded shell mean nothing sits well on them; the crocodile's snout sticks out
into the cell in front.

Stacking rule: nothing rises above the top *inside the die's footprint*.
Ears that lean out past the side edges (cat, fox, raccoon) and tails behind
the back (rooster, turkey) can rise higher.

## Props (`props.py`)

The same cube, sitting flat on the ground (no feet), so props and animals
stack on one grid. Same rounded edges.

- Regular dice: `die_white` (red 1), `die_red`, `die_wood`. Opposite faces add up
  to 7 (front 1, back 6, top 2, bottom 5, right 3, left 4); the pips have a
  little shine like the animals' eyes. Clips: `roll_in`, `roll`, `roll_side`,
  `drop`, `place`, `tap`, `spin`, `spin_start` / `spin_loop` / `spin_end`.
- Plain cube: `cube`, white, one material. Tint it any colour in code by
  setting its material colour (everything is flat colour, no textures).
- Terrain: `grass` (a clean grass cap over dirt, tufts and two flowers),
  `dirt`, `rock`, `sand`, `snow` (a pillowy snow cap over stone, icicles),
  `ice`, `water` (a lighter top rolling over in soft wave crests, bubbles, highlights), `crate`, `hay`, `brick`, `bush`.
- Plain and terrain cubes: `place`, `drop`, `land`, `tap`.

## Puzzle pieces (`puzzle.py`)

Each fits one die cell (2 x 2 footprint) in the same soft style, so dice roll,
drop and get pushed onto them. Parts a game may want to recolour are their
own nodes (`cap`, `platter`, the `flag_*` segments).

| Piece | Clips |
|---|---|
| `button` | `idle`, `press` (squashes down with a bounce), `held` (loop), `release` (pops back up) |
| `fan` | `off`, `spin_up`, `on` (loop: blades and rising puffs), `spin_down`; the speeds match at the joins |
| `conveyor` | `run` (loop: chevrons ride the belt forward, -Y), `stop` |
| `spring` | `idle`, `boing` (compress, launch, wobble out) |
| `gate` | `closed`, `open` (the bars sink into the floor slot with a clank), `opened`, `close` |
| `goal_flag` | `wave` (loop) |
| `turntable` | `idle`, `turn_left`, `turn_right` (a quarter turn with a little overshoot) |
| `portal` | `swirl` (loop): a standing ring doorway a die can roll through; the swirl inside spins, sparkles drift off |
| `ramp` | none: a gentle wedge two cells long (about 27°) up to one die's height; it fills the cell it ends on and the cell in front |

Rotate a piece in the game to point it (a sideways fan, a conveyor going
left).

```
Blender -b --factory-startup -t 1 --python scripts/puzzle.py -- models [piece ...]
```

## Nodes

```
root
  foot_fl, foot_fr, foot_bl, foot_br   the nub feet (foot_l, foot_r on the birds): ride the die, step on walk and run, never squash
  body                         the cube, markings, cheeks (pivot: bottom centre)
    eye_l, eye_r               open eyes: widen, squint, blink, look
    happy_*, line_*, x_*, spiral_*    drawn eyes that replace them: ^ (happy), closed lines (sleepy), X (oof), spirals (dizzy, they turn)
    brow_l, brow_r             brows: raise and tilt
    mouth_smile                the little 'w' smile (shown at rest)
    mouth_oh, mouth_grin, mouth_sad, mouth_wavy   other mouths
    nose                       the little nose (sheep, goat, cat, dog, mouse; the bunny's never moves, it has no mouth): rises when the mouth is 'oh'
    sweat                      a sweat drop (scared)
    ear_l, ear_r               ears (wings on the birds)
    tail
```

A part in several colours carries them as vertex colours (`COLOR_0`) on
one shared `colors` material, so each node is one draw call; single-colour
parts (and the puzzle's `cap` and `platter`) keep a material per colour.

Everything but the open eyes and the smile is hidden at rest. Birds have
no mouth nodes (the beak stays put). Hidden parts are scaled to 0.001; an
expression shows a part by scaling it to 1.

On mobile, skip the hidden parts: a part scaled to 0.001 is invisible but
the engine still draws it (and its shadow), about half of an animal's draw
calls. In three.js, after `mixer.update()`:

```js
model.traverse(o => { o.visible = o.scale.x > 0.01; });
```

The viewer does this (`cullHidden`).

## Expressions

`neutral`, `playful`, `surprised` (worried brows, wide eyes, 'oh'),
`scared` (small eyes, steep brows, wavy mouth, sweat drop), `happy` (^ eyes,
grin), `excited`, `oof` (X eyes, 'oh'), `dizzy` (turning spiral eyes, wavy
mouth), `sleepy` (closed lines), `sad` (see `expressions-sheep.png`). They are keyed
into the clips; a game can also set them directly by scaling the face nodes.

## Clips (30 fps)

| Clip | Frames | Loop | What |
|---|---|---|---|
| `idle` | 60 | yes | breathe, glance left and right, blink, ear twitch |
| `walk` | 32 | yes | in place: a waddle from edge to edge, the feet stepping |
| `run` | 20 | yes | in place: leaning forward, bounding, the feet pattering |
| `hop` | 26 | yes | bounce move: crouch, snap up, ballistic arc, heavy landing |
| `jump` | 48 | no | a deep crouch, a big launch, a high arc with the feet tucked, front edge first, slap, clatter |
| `excited` | 46 | yes | hop, hop, then a wound-up big jump with a full twist; ears perked |
| `waggle` | 30 | yes | ears (wings) flap back and forth, playful face |
| `happy` | 50 | no | a hop, then a big hop with a full turn |
| `tap` | 22 | no | a quick squash-hop reaction to a tap or selection |
| `land` | 30 | no | falls from 3 onto its front edge, slaps flat, big squash |
| `place` | 32 | no | lifted, set down faster and faster onto an edge, slapped flat, a little rock (snapping onto a stack) |
| `drop` | 56 | no | a long fall from 5 high, hits on a corner, slams flat, then clatters: clack, clack, tk-tk-tk, each rock smaller and quicker |
| `squish` | 44 | no | something lands on top: one big squash, held, then a jelly wobble out |
| `roll` | 95 | no | lean back, then four heavy quarter tips forward, slamming flat between them; ends 4 cubes forward |
| `roll_side` | 95 | no | the same, sideways |
| `roll_in` | 61 | no | thrown in like a die onto a table: flies in tumbling, rolls on fast with a clack at every face, slows, clatters, stops on its spot facing front |
| `spin_start` | 38 | no | crouch and counter-twist, pop onto a corner, spin up to full speed |
| `spin_loop` | 24 | yes | spinning like a top on the corner, for as long as you like |
| `spin_end` | 80 | no | slows, wobbles wider, tips over faster and faster, slams flat facing front, clatters |
| `spin` | 166 | no | the whole thing in one clip: start, two loops, end |
| `teeter_in` | 30 | no | tipped up onto one edge, overshoots, catches itself |
| `teeter_loop` | 60 | yes | balanced on the edge, wobbling and catching itself; scared, ears flailing |
| `teeter_out` | 40 | no | loses its balance, drops back flat, clatters |
| `sleep` | 120 | yes | stays flat on its base (fine in a stack): eyes shut, slow gentle breathing, one short snore and a tiny ear twitch per loop |
| `sad` | 120 | yes | slow: a long sigh in, a deflating sigh out, a sniffle |

`spin_start` → `spin_loop` → `spin_end` and `teeter_in` → `teeter_loop` →
`teeter_out` chain seamlessly (glTF has no loop markers inside a clip, so a
"loop in the middle" is three clips): play the loop as long as you like.

Root motion: `roll` ends exactly 4 cubes (8 units) forward (−Y in Blender,
+Z in glTF), `roll_side` 4 cubes to the die's right (−X in both). Both end upright and
facing front, so the game moves the die's origin by that much when the clip
ends. `roll_in` starts 12 units behind (+Y) and up in the air and ends on the
origin. `walk` and `run` are in place (the game moves the die). Every other
clip starts and ends on the spot.

Ears are spring-driven: they chase each clip's target angle and get thrown
by the die's vertical acceleration, so they lag on take-off, float in the air
and flop on landings and slams.
