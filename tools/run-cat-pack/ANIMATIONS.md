# Cat pack — animations

Cats have their own skeleton and their own clips, in `scripts/cat_anims.py`. Nothing is shared with the dogs.
Every clip is baked onto all six builds when they're built.

**Style:** transitions are snappy (0.25–0.4 s, eased so most of the move happens early), which hides the legs'
in-between poses. Loaf and sleep are cartoony on purpose: the legs shrink right up into the body.

**Planted feet (IK).** Paws are pinned to the floor by a 2-bone IK in the side plane:
- **Back legs:** planted in everything except sits, loafs and lying down, where the rump is on the floor.
- **Front legs:** planted unless lifted on purpose (groom, knead, jumps).
- **Gaits:** walk, trot, run and sneak are built from paw paths. A paw stays planted while it slides back along
  the floor, then swings forward in an arc. The cycles are in place, so the game moves the cat at
  stride / (duty × period).
- **Reaching:** if a planted paw can't reach, the body is lowered onto it. Sits lean forward up to 30° and
  then round the back (the chest bends down, the neck lifts the head level), so long-bodied and short-legged
  builds still sit upright-ish.
- **Sitting hind legs:** folded under by IK (`_tuck`): the long thigh lies forward along the floor as the
  haunch, the shin drops back to the heel, and the hock and paw lie flat. Sits rest on the rump and belly.
- **Self-check:** each bake prints `PLANT clip=…`, the worst distance of a planted paw from its footprint (body
  lengths). Every clip on every build is within 0.008.
- **Timing:** the bake sets Blender's scene to 30 fps. It used to export at the default 24 fps, which played every
  clip 25% slow.

**Tail and ears.**
- **Tail:** 8 bones, so it can wave, lash, curl into a question mark and bat at the tip.
- **Ears:** two ear bones (no skin) whose rotation the viewer copies onto the ear parts. They're used for flicks,
  swivels and flattened "airplane" ears.
- **Floor tails:** when sitting, loafing, lying, sleeping or flopped, the tail is laid along the floor in world
  space (`_tf`, `lay_tail`). It follows a path seen from above: from behind the rump, round it on a circle just
  wider than the body, then forward along the side (`bend` × 3 degrees of wrap). Each bone aims at its point on
  the path, and the slope changes at most 30° per bone, so the tail arcs down from the rump instead of folding.
  Bones are aimed without building up twist, which would pinch the skinned tail. The tip can lift and tap, and
  swishes ripple along the floor. Standing tails stay above the floor on every frame.

**Breathing and eyes.**
- **Breathing:** the torso is skinned to two leaf bones, `spine_breath` and `chest_breath`. Their scale swells
  the ribs and belly, so the cat breathes without the body rocking. Every idle breathes, slower and deeper
  when asleep.
- **Eyes:** a `lids` bone with no skin. Its Y scale squashes the head's `eyes` object (1 = open, about 0.12 =
  shut), the way the ear bones drive the ears. The viewer copies it each frame and a game should do the
  same. Used for blinks, sleep, half-shut contentment and squeezed eyes in stretches.

**Reviewing:** serve `tools/` and use the review sheet. Several clips on one cat:
`kit/index.html?review=sit,loaf,lie_down&breeds=Domestic%20Shorthair%20(ginger)&n=10`. One clip across builds:
`?review=sit&breeds=Maine%20Coon,Munchkin,…&n=8`. `&cam=q&rot=1.0` gives a three-quarter view and `&cam=top`
looks down from above. Saved sheets are in `concepts/review-*.png`.

Status: 🟨 first pass (checked on review sheets, needs your eye) · ⬜ to do

| | Clip | Loop | Notes |
|---|---|---|---|
| 🟨 | idle | ✓ | breathing, snappy looks left / back / a head tilt with the ears swivelling after, blinks, the tail waving |
| 🟨 | walk / trot | ✓ | planted paw paths |
| 🟨 | run | ✓ | rotary gallop timed to the footfalls: back humped just before the hind paws land, stretched flat as the fronts reach; two short flights; nose up off the hind push, down onto the fronts; head held level; swinging paws fold, curl and reach; the tail trails |
| 🟨 | sneak | ✓ | crouched stalk, legs bend at the joints (IK) |
| 🟨 | sit → sit_idle → sit_to_stand | | upright sit, haunches tucked; tail wrapped round the paws, just the tip lifting and tapping; looks about, blink, ear flick |
| 🟨 | slow_blink | | sitting: the cat "I love you", eyes close slowly, hold, open, head dips |
| 🟨 | head_tilt | | sitting: a curious tilt right over, ears forward, a re-tilt the other way |
| 🟨 | paw_swipe | | sitting: the right paw comes up and bats down at something twice |
| 🟨 | loaf → loaf_idle → loaf_to_stand | | legs tuck into the body; eyes half shut with a slow blink; the tail sweeps along the floor, tip curling and tapping; ears swivel |
| 🟨 | lie_down → lie_idle → lie_to_stand | | sphinx; the tail tip thumps on the floor; looks round, blink |
| 🟨 | knead_lie | ✓ | lying: front paws taking turns to push into the blanket, eyes nearly shut |
| 🟨 | sleep → sleep_idle → wake | | curled into a C (head and rump to the same side), eyes shut, tail round to the head; slow deep breaths, an ear twitch and a dreaming tip flick. Wake: ear flick, groggy head lift and blinks, a big lying stretch with the front legs long on the floor, then sphinx |
| 🟨 | flop → flop_idle | | on its side, legs loose; breathing, the tail sweeping along the floor, a slow blink, the top paw kneading the air |
| 🟨 | stretch | | play bow: front paws far forward, chest to the floor, rump up, eyes squeezed; a push further; then a back leg out |
| 🟨 | groom | ✓ | sitting, the paw held out in front of the mouth (IK target), head licking, eyes half shut; tail stays wrapped |
| 🟨 | knead | ✓ | standing: front paws taking turns with a small lift and a press, toes spreading, shoulders sinking into each push |
| 🟨 | wiggle | ✓ | crouched butt wiggle, back paws paddling |
| 🟨 | pounce | | frame by frame: sink, a wiggle that speeds up with the head locked on the target, dead still, explosive push, an arcing leap (body stretched, paws reaching, the tail countering the body's pitch), front paws pin first, the back end catches up, then crouched over the catch with the tail lashing |
| 🟨 | jump | | the same anticipation, a higher leap, and a landing |
| 🟨 | arch | | spooked: up on its toes, humped mid-back, tail straight up and puffed, ears flat |
| 🟨 | tail_flick / tail_swish / tail_wave / tail_question / tail_bat / tail_quiver | some | flick (the top third whips over and back, twice), annoyed lashing, slow seaweed wave, question mark (up tall, top hooks over, holds), bat (held low, hard strikes side to side with the tip lagging), quiver (straight up, the top shivering) |
| 🟨 | scratch_ear | ✓ | sitting, the hind leg swings out and up the side to the ear and scratches; the head tips to meet it (posed by hand and stretched a little, cartoony) |
| ⬜ | yawn, meow | | need an opening mouth on the head parts |
| ⬜ | headbutt / rub, roll over, turn on the spot, ledge jumps | | |
