# Bean kit: boxy-tall, rigged and animated

Everything is procedural (Blender + Python, no mesh generators):

| Script | Builds |
| --- | --- |
| `kit/boxykit.py` | static kit parts (`kit/boxy-kit/`) |
| `kit/rig/beanrig.py` | this folder: every part skinned to one skeleton, plus all clips |
| `kit/rig/clips.py` | the clip library (pure Python, one function per clip) |
| `kit/rig/check_loops.py` | loop seams and pops in every clip |
| `kit/clipcheck.py` | static clothing clipping across part combinations |

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup --python rig/beanrig.py -- rigged anim            # base.glb + clips.json
$B -b --factory-startup --python rig/beanrig.py -- rigged parts           # every other part
$B -b --factory-startup --python rig/beanrig.py -- /tmp/rs strips walk run  # Workbench frame strips
python3 rig/check_loops.py
```

Preview: serve `kit/` (`python3 -m http.server 5231 --bind 127.0.0.1`) and open `anim-viewer/`.

## Mobile build

`rig/beanrig.py` builds at `BEAN_RES` (the default 0.3 is mobile; 1 is the hi-res concept build). Garments are
an outer shell plus rim only. A dressed figure is about 4.7–7.5k triangles (it was 70k).
`node scripts/compress.mjs mobile` writes `mobile/`: meshopt-compressed, 16-bit rotations, rest tracks dropped,
0.71 MB for the whole kit (base.glb with all clips is 258 KB). `--verify mobile` compares every clip pose
(worst 0.005°). three.js needs `loader.setMeshoptDecoder(MeshoptDecoder)`. The viewer loads `mobile/`;
add `?hi` for `rigged/`.

## Files

| File | Contents |
| --- | --- |
| `glb/base.glb` | body (a two-part toy: the top half steps in 1.5 cm at a hard V part line) + chunky limbs, the skeleton, **all 70 clips** |
| `glb/face-*.glb` | art-toy face marks (material `mark`) |
| `glb/screen.glb` | gadget screen; swap `faces/*.png` into the `screen` material's emissive map, tint with emissive colour |
| `glb/top-*.glb` | hoodie, puffer vest and coveralls (a chest-high jumpsuit with a front zip, collar, pocket and pant legs over the leg posts; `top-hoodie-screen` = the hood cut for the screen). Garments are **solid**: the outer surface plus a rim sunk into the body, so you can't see inside them from any angle |
| `glb/head-<bucket\|beanie>.glb`, `glb/head-<...>-screen.glb` | solid hats that follow the bean's squared section; the `-screen` versions sit above the screen face, the others just above art-face eyes |
| `glb/num-1-body.glb`, `glb/num-2-body.glb` | jersey number plates on the **bare body only**, front and back (the back is mirrored to read correctly from behind; both sides share the slot materials), under the seam (a top covers them; show a plate only when no top is worn). `num-1` has one slot (material `num`), `num-2` has two (`numL`, `numR`) |
| `numbers/num-0..9.png` | digit textures: a white glyph with a dark outline and alpha. Set a slot material's map to the digit, tint it with the material colour, `alphaTest = 0.5` |
| `glb/topper-<sprout\|crown\|antenna\|horns\|flower\|halo>.glb` | head ornaments (material `topper`, plus fixed gold/chrome details); worn only with no hat and no hood |
| `glb/prop-<kind>.glb` | toy weapons on `grip.R` (`kit.json` `weapons`): sidearms `blaster`, `raygun`, `revolver`; long guns `smg`, `rifle`, `sniper`, `shotgun`, `launcher` (drum grenade launcher), `soaker`, `plasma`; heavies `bazooka` (held by the front grip, the tube runs back over the shoulder) and `minigun`. Chunky bevelled toy plastic, toy proportions (short, fat, one oversized feature each), 0.7–1.9k triangles. Materials `weapon`, `weapon-trim`, `weapon-dark` (recolour), plus fixed `weapon-metal`, `weapon-glow`, `weapon-tank`. Built by `rig/weapons.py` |
| `kit.json` | part lists, colour slots → material names, defaults |
| `clips.json` | per clip: duration, frames, loop, tags |

Every part GLB carries the same skeleton, so a part is attached by rebinding its skinned meshes to the
base's bones by name (three.js):

```js
part.traverse(m => {
  if (!m.isSkinnedMesh) return;
  const bones = m.skeleton.bones.map(b => base.getObjectByName(b.name));
  m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
  baseRig.add(m);
});
```

Recolour by material name (`body`, `arms`, `hands`, `legs`, `feet`, `mark`, `top`/`belt`, `hat`,
`scarf`/`pack`/`print`, `bezel`). One `AnimationMixer` on the base drives every attached part.

## Skeleton

`root` (ground) > `hips` (centre of mass) > `spine` (waist) > `chest` > `arm.L/R` > `hand.L/R` > `grip.L/R`, and
`hips` > `leg.L/R` > `foot.L/R`. All bones point up in rest. Weights are rigid per piece, like a vinyl toy:
limbs ride their bones, sleeves ride the arm, and the body and everything on it blend from spine to chest by height.
Clips move `root` for root motion (dive, knockback, stumble, jumps); zero its x/z to play in place.

## Clips (70, `*` = one-shot)

- **Idle:** idle, idle-look
- **Move:** walk, walk-back, strafe-left, strafe-right, run, sprint, sneak, crouch-idle
- **Jump:** jump\*, jump-start\*, jump-air, jump-land\*, double-jump\*, fall, dive\*
- **Obstacle course:** belly-slide, get-up\*, splat\*, stumble\*, tumble, climb, hang, push, carry, balance, whoa\*, swim
- **Hits:** knockback\*, hit\*, spin-out\*
- **Shooter:** aim, shoot\*, shoot-auto, run-aim, walk-aim, reload\*, throw\*, punch\*, death\*, respawn\*
- **Celebrate:** victory, cheer, jumping-jacks, wave, wave-big, celebrate-backflip\*
- **Dance:** dance-bob, dance-disco, dance-spin, dance-robot, dance-floss, dance-hop
- **Social:** bow\*, taunt, thumbs-up\*, yes\*, no\*
- **Emotions:** sad, sigh\*, cry, defeat\*, sit, sleep, shrug\*, laugh, angry, scared, think

Chains that line up: jump-start → jump-air → jump-land; dive / splat → belly-slide → get-up; death → respawn.

## How the clips are made

The principles and the authoring workflow live in the `procedural-animation` skill
(`.claude/skills/procedural-animation/`). `rig/snap.py` scores every clip for floatiness.


Motion with weight is simulated: gravity is a stiff game-feel 30 m/s², so jumps, flips, dives and
knockbacks follow true ballistic arcs with constant air speed. Deaths and falls are a rigid block tipping
over its base edge under gravity, so it teeters, accelerates, slams down and bounces. Impacts stop dead with a
1-2 frame squash, anticipation lasts about 0.1 s, and one-shot moves use a fast-out curve (no slow-in).


`rig/clips.py` defines every clip as a function of time. `rig/beanrig.py` bakes them with three passes:

- **Ground lock.** Every frame, the lowest point of the figure is put on the floor. Feet plant, lying and
  sitting poses rest on the ground, and a crouch is the legs retracting (the body drops with them).
  Allowing for a typical top, the contact uses a shell 5 cm out from the body, so a bare figure lying down
  sits about 6 cm up.
- **Airborne arcs.** Jump frames ride above a line between the grounded frames on either side, and never dip
  through the floor. Climb, hang, swim, fall, jump-air and double-jump are free: the game owns their height.
- **Overlap.** The chest, arms and hands sample the clip slightly in the past, so they trail the body.
  Aiming clips keep the gun arm steady.

Walks and runs use a foot-plant solver. The stance foot slides back at a constant speed, flat and rolling
heel to toe, and the swing leaves and lands at that speed. `clips.json` gives each gait the ground speed that
keeps its feet still (`speed`, m/s): walk 0.4, run 1.89, sprint 3.12, sneak 0.18, strafe 0.54,
walk-back -0.29, push 0.2, carry 0.33. Every one-shot that isn't terminal (death, splat, defeat, dive,
the jump pieces) starts and ends at the idle pose, so it blends both ways.

## Checks

- `rig/check_loops.py`: **0 problems.** Every loop's last frame equals its first, and there are no pops,
  except the deliberate snaps in dance-robot, throw and punch.
- `rig/beanrig.py -- <dir> audit`: per clip, it reports floor penetration, hovering, planted-foot skating,
  stance-speed error and hands inside the body. Standing clips hold their feet still. Feet only travel in
  clips that move the body on purpose: knockback, stumble, tumble, spins, getting up, sitting down. Gait
  speeds match within 0.05 m/s.
- `rig/beanrig.py -- <dir> strips <clip ...>`: 3/4 and side frame strips for review.
- `clipcheck.py`: the clothing layers are clean in the rest pose.
- `rig/beanrig.py -- <dir> weapons [kind ...]`: renders every weapon held in the aim pose (3/4, side, back) and
  reports the worst share of the weapon inside the body across the shooter clips (0% while aiming; reload tucks
  stocks into the chest, up to 13%).

Arms are short and stubby by design, so overhead poses put the hands at about head height, in a V.
