# Anthro kit: species and parts

One shared body (rig, clothes, animations) with swappable parts. Every head is the same
skull plus a species snout, nose, face markings and extras, so every eye style and
hairstyle fits every head. A species is a recipe: head, ears, tail, feet, hair, eyes
and colours (`scripts/parts.py`, `SPECIES`). The kit GLB carries every part; the editor
(`viewer/index.html`) shows one of each kind.

Build: `Blender -b --factory-startup -t 1 --python scripts/build.py -- wolf kit/anthro-kit-B.glb --variant B`
(add `--render out/review --lineup` for the species board, `out/species-board.png`).

## Built (23)

| Species | Snout | Ears | Tail | Feet | Extras / markings |
|---|---|---|---|---|---|
| wolf | dog | wolf | wolf | paws | white muzzle |
| husky | dog | wolf | wolf | paws | husky mask |
| fox | fox (narrow) | fox (big) | fox (white tip) | paws | |
| dog | lab (broad) | lop | wolf | paws | |
| cat | cat (short) | cat | cat (thin) | paws | |
| tiger | big cat | round | tiger (banded) | paws | head stripes |
| lion | big cat | round | lion (tuft) | paws | mane |
| bunny | bunny | bunny (long) | bunny (puff) | paws | |
| deer | deer | deer (sideways) | deer (flag) | cloven hooves | antlers |
| horse | horse (long) | horse | horse (hair) | hooves | mane, blaze |
| goat | goat | deer | deer | cloven hooves | curled horns, beard |
| bear | bear | round | bear (stub) | paws | light snout |
| raccoon | raccoon | round | raccoon (ringed) | paws | bandit mask |
| red panda | raccoon | round | red panda (ringed) | paws | face patches |
| otter | otter (flat, wide) | small | otter (tapered) | paws | whisker pads |
| hyena | hyena | round | hyena | paws | dark snout, back mane |
| mouse | mouse | big round | mouse (thin) | paws | |
| kangaroo | kangaroo | tall | kangaroo (thick) | paws | |
| bat | bat (pug, leaf nose) | bat (huge) | bat | paws | |
| dragon | dragon | fins | dragon (spines) | reptile | horns, head spikes |
| lizard | lizard | none | lizard | reptile | head spikes |
| shark | shark | none | shark (fluke) | paws | head fin |
| bird | beak | none | bird (feather fan) | talons | feather crest |

## Parts

- **Heads:** 23 (one per species above).
- **Ears:** wolf, fox, cat, round, big_round, small, bunny, tall, horse, deer, bat, lop, fin, none.
- **Tails:** 20 shapes plus none.
- **Feet:** paws, hooves, cloven hooves, talons, reptile.
- **Hair:** crest, mohawk, swoop, long, none.
- **Eyes:** almond, round, sharp, sleepy, happy, slit, dot.
- **Teeth:** fangs, buck, shark, tusks, snaggle, none. Each style is built for every snout shape
  (`teeth_<style>__<snout>`), and the editor shows the one matching the chosen head. Defaults: buck
  (bunny, mouse), fangs (bat, tiger, hyena, dragon), shark (shark).
- **Cheeks:** spiky (pointed tufts), round (puffy rounded lobes), fin (a three-spined frill), none. They sit on
  the shared skull, so every style fits every head. Defaults: round (bunny, mouse, bear, otter, red panda),
  fin (dragon, shark), none (lizard, bird), spiky (everyone else).
- **Chest tuft:** a recipe flag (`tuft`). It is off for shark, dragon and lizard.

## Next up

- **Fandom species:** sergal (wedge head), protogen (visor head), kobold, gryphon, avali.
- **Canines and felines:** coyote, jackal, dingo; cheetah, leopard and snow leopard (spot markings need a body pattern pass).
- **Others:** skunk, squirrel, possum, ferret, panda, sheep, cow, pig, unicorn (horse plus a horn extra).
- **Body markings:** stripes, spots and socks painted over the whole body, not just the head.
- **Hands:** talon and scaly hands to match the reptile and bird feet.

## Animations

Baked into the kit GLB (24 fps), playable in the editor's Animation buttons. Every clip keys every bone,
so switching clips never leaves a jaw open or an arm raised.

- **Locomotion** (`scripts/gait.py`, foot-plant solver): walk, trot (a bound), sprint (all-out: deep lean,
  short contacts, long flights, heels to the rump, big foot flex and arm pump), gallop (the paws land
  one-two, then one long flight per stride; the arms pull together).
- **Actions** (`scripts/actions.py`, pose to pose with per-channel tracks so moves overlap; the leg IK keeps
  paws planted, or stepping, every frame):
  - Attacks: `slash_r`, `slash_l`, `slash_combo` (right then left), `maul` (two-paw overhead slam), `bite`
    (rear back with the mouth open, lunge, chomp, head shake). Slashes and the maul have swing trails.
  - Voice: `bark` (two lunging barks a second, loops), `roar` (gather, rear up, arms wide, jaw wide, trembling hold).
  - Reactions: `hurt` (flinch), `death` (hit, stagger back two steps with the arms wheeling, then a stiff
    topple under gravity with the arms flung back, a slam that bounces the body and kicks the legs up, lie still).
  - Movement: `jump` (crouch, push, high ballistic air, one knee up to the chest a beat before the other, land).
  - Social: `wave` (two quick wrist flicks, then two big elbow swings; loops), `wave_princess` (paw up by the
    head, turning at the wrist; loops).
  - Interaction: `pickup` (spot it, squat, hand to the floor, grab, rise and hold it below the snoot),
    `collect` (snatch it out to the side, hug it in, a little hop of joy), `interact` (reach out and press
    twice), `gather` (low squat, the paws taking turns to pluck and toss; loops), `type` (standing at a
    keyboard, tapping in turn, one big Enter; loops).
  - Sitting (seat top 0.46 m; the editor shows a stool): `sit_down`, `sit_idle` (loops), `sit_up`, and seated
    `sit_type`, `sit_eat` (snack up under the snoot, chomp, chew), `sit_talk` (jaw syllables, gestures, a nod).
  - All fours: `fours_down`, `fours_idle` (loops), `fours_up` (unrolls hips-first). The hands are solved onto
    the floor in 3D, palms down, under the shoulders.
  - Other: `idle`, `tpose`.
- **Swing trails:** `species.json` lists each clip's trail windows (`trails`: clip -> [{bone: "L"|"R", start,
  end}] in seconds) and which clips loop (`loops`). The editor draws them as a blue blade with a hot edge,
  like the pfx library's `slash-trail`; a game can attach its own FX to the same windows.
- **Jaw:** every head is cut along its mouth line (`parts.split_jaw`). The lower jaw rides the `jaw` bone,
  and both halves are capped with dark faces, so an open mouth reads as a mouth on every species. Tusks
  ride the jaw; the other teeth stay on the upper jaw.

Review tools: `node scripts/clipsheet.mjs out.png "Roar:0,0.4,0.8" --cam side|34|front|head|wide` (contact
sheets from the editor), `GAIT_DUMP=… build` then `python3 scripts/gaitcheck.py` (per-frame gait audit),
`node scripts/check-editor.mjs` (every editor control).

## Packaging (the asset library's Furries Unleashed)

```sh
Blender -b --factory-startup -t 1 --python scripts/build.py -- wolf kit/anthro-kit-B.glb --variant B --pack /tmp/fu-raw
cd pack && npm install && node pack.mjs /tmp/fu-raw <leaf>   # characters/, kit/ (+ furrykit.js), Readme, License
node pack/gallery.mjs <leaf>/Previews                           # gallery sheets (serve this folder on :8000)
node scripts/cover.mjs out/cover-render.png && python3 scripts/cover_title.py out/cover-render.png promo/
```

`pack/test.html?leaf=<leaf>` loads the packed files the way a game would and reports any errors.
