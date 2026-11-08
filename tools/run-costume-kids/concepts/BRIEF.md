# Costume concept brief (shared by every costume agent)

You build cute low-poly CONCEPT blockouts of kids in Halloween costumes for a
kids' dress-up game. Work only in tools/run-costume-kids/concepts. Write only
your own costume files `costumes/<slug>.py` (and their renders). Do NOT edit
bobble.py, blockout.py, props.py, gallery.py, lineup.py, kids.py or any other
costume file (other agents work next to you), and do not edit
anything outside this package.

## Read first
- `bobble.py`: the shared "Bobble" kid: a giant rounded-cube head (~2/3 of the
  height) on a tiny body (chunky shoes, stub legs, short boxy torso, short
  arms, mitten hands). `body(...)` (colours and parts switchable), constants
  HEAD, HEAD_Z, TOP, HIP, TW, TH, TD, FOOT, MITT, ARM_DROP, `hand_points()`,
  `kid_head()`, `octa()`, SKIN, SKIN_TONES, `render_costume`, `run`.
- `blockout.py`: primitives `box` (with bevel), `ball`, `can` (n-gon
  cylinder/cone, r2 for a cone), `limb` (a bar between two points),
  `hand_mitt`, `face` (eyes with shine, cheeks, a smile), `head_cube`.
  Blender units, z up, ground z = 0, the kid faces -y.
- `costumes/props.py`: `bucket(at, full)`, the pumpkin candy bucket on a mitten.
- Reference costumes the user LOVES. Copy the file structure (imports,
  `build()`, `run({...})` at the bottom) and match the quality:
  - `costumes/ghost.py`, `costumes/hot-dog.py`, `costumes/cardboard-robot.py`
  - `costumes/inflatable-trex.py` and `costumes/reverse-mermaid.py` show the
    "face window": the kid's face looks out of a window in a big costume body,
    with a big head shape on top. Reuse the idea (copy their `face_window` code
    into your file) for suits where the kid is inside something.
  - `costumes/mummy.py`, `costumes/dracula.py`, `costumes/hamilton.py`,
    `costumes/cat-onesie.py`, `costumes/werewolf.py`, `costumes/ned-kelly.py`
  - `costumes/renders/*-sheet.png` show how they look.

## Style rules
- **Shape language:** big ROUNDED CUBES (boxes with generous bevels), chunky
  and exaggerated. Few big shapes, one huge readable costume silhouette.
- **Colour:** flat, bright and saturated, chosen to read in a small thumbnail.
- **Body:** every costume keeps the SAME Bobble body underneath: same shoe,
  leg, torso and mitten sizes and positions. A costume may replace the head
  with its headpiece, but the head stays giant.
- **Skin:** draw every bit of kid skin (face, mitts, bare legs) in `SKIN`,
  never another skin colour. The renderer swaps SKIN for other tones.
- **Hair:** use the base kid hair only where it helps. Hair may be dropped or
  hidden under the costume.
- **Kid in a costume:** a kid's face or mitts show somewhere, so it reads as a
  kid in a costume. The exceptions are full creatures the brief says otherwise
  for.
- **Bucket:** give the costume the pumpkin bucket in one mitten (full or empty)
  where it fits naturally; skip it if both hands are busy.
- **Cute, funny, kid-appropriate. Nothing sexualised:** these are little kids,
  and "sexy X" jokes are played as harmless sight gags. No real people's
  names, no brand logos or trademarks. Parody characters are generic
  archetypes.
- **Framing:** keep it in frame. The camera is fixed: ortho 6.6 centred at
  z = 2.4. Wide or tall costumes (riding, two-person) may call
  `render_costume(slug, build, out, ortho=8.5, target_z=3.0)` themselves
  instead of `run`, but prefer the default.

## Render and check
From concepts:

    $BLENDER -b --factory-startup --python costumes/<slug>.py -- concepts/costumes/renders

This writes `out/<slug>-34.png`, `-front.png`, `-side.png` and `-sheet.png`.
LOOK at the sheet with the Read tool after every change. Iterate until the
costume is clearly cute, readable at thumbnail size and on brief (usually
2–4 rounds). Fix floating parts, parts poking through, and shapes that read
as something else.

## Final report
One line per costume (the design), plus anything you're unsure about. Keep it
short.

## Round 3 rules (art lead, these override anything above)
- **The head is always the standard Bobble head.** Same size (HEAD) and same
  place (centre HEAD_Z, face at `face(0, HEAD_Z - HEAD*0.05, -HEAD*0.46, HEAD)`)
  in EVERY costume. Either the kid's own head cube shows (`kid_head` /
  `head_cube` at the standard spot), or a hood, helmet or mask ENCLOSES that
  exact head box (at least HEAD*1.04 wide, HEAD*0.96 deep, HEAD*0.94 tall).
  The blank base body (`costumes/mannequin.py`) must feel like it fits inside
  every costume, even big suits.
- **No porthole faces.** A small face in a hole in a big costume is out. The
  face is full size: the kid's head pokes out of the costume, or the face
  shows in a hood opening about as wide as the face (at least HEAD*0.8).
- **Silhouette comes from exaggerated headwear.** Huge hats, crowns,
  helmets, crests, horns and hair. The benchmark is Marie Antoinette's tower
  of hair. Push size and boldness well past realistic: every costume should
  read from its outline alone. Body suits can grow around the base body
  too, but never shrink the head.
- **Fit check after every render:** `python3 costumes/fitcheck.py <slug>`
  (add the ortho as a second arg, e.g. `8.5`, if your costume renders with a
  custom ortho) writes `out/<slug>-fit.png`: your front and 3/4 views with
  the mannequin outline in red. The head outline must sit exactly on your
  kid's head (or inside the hood/helmet). LOOK at it.
- Before your first edit of an existing costume, copy it to
  `costumes/archive/<slug>.r2.py` (skip if that file already exists).
- **Battery:** run Blender with `nice -n 15`, one render at a time.
- **Only held props.** Nothing may sit next to the kid on the ground or float
  beside them unless the kid holds it in a mitt or it is part of the worn
  costume (attached to the body or head). These kids animate (walk, run,
  jump), so loose props can't follow. Carried things go in a mitt.
- **No transparency, no glass.** Every material is plain opaque Principled
  (no Alpha below 1, no Transparent BSDF, no blended render method). Glass
  parts (helmet bowls, domes, globes, visors) are left out entirely; other
  see-through ideas become opaque shapes. Emission is fine.

## Round 4: tag every piece with its rig part
The toy rig attaches each piece rigidly to one part. Don't make it guess:
build every piece inside `with part("..."):` (from blockout.py, available
through `from bobble import *`). Parts: `root`, `body` (hips), `chest`,
`head`, `arm.l`/`arm.r`, `hand.l`/`hand.r` (the mitt), `prop.l`/`prop.r`,
`leg.l`/`leg.r`, `foot.l`/`foot.r`; `arm`, `hand`, `prop`, `leg`, `foot`
without a side take the side they sit on. Left (`.l`) is +x.
- `body()`, `kid_head()`, `bucket()` and `mount()` tag themselves; inner
  blocks win, so wrap anything else.
- **Details go with what they're on**: stripes, buttons, trims, spikes,
  sparkles, a hat's stars all take the part of the thing they decorate.
- **A held prop is ONE `prop` block** (or one `mount`): handle, head,
  blade, hilt, bristles, everything, so it never splits.
- Hats, hair, hoods, ears, helmets, crests, horns, beards: `head`.
  Capes and backpacks: `chest`. Skirts, robes, tails, suits: `body`.
  Ground-touching costume hems/tails that must not dip: `root`.
- Check: `$BLENDER -b --factory-startup --python rig/untagged.py -- <slug>`
  must report every piece tagged; `rig/anchors_view.py` renders the kid
  coloured by part (look at it); `rig/export_glb.py` and `rig/scrub.py`.
