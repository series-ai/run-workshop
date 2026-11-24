# Dog pack — animations

Every dog shares one skeleton (same bone names on all 21 builds), so each clip
is authored once and plays on every breed. Poses are solved per build at bake
time (`scripts/solver.py`): paws have foot targets (planted, folded flat, stepped
under the shoulder...) solved every frame with two-bone IK, so they stay put or
step instead of sliding; the body is placed in leg-length units (a sit puts the
rump on the floor and the front legs straight out of the chest on a Great Dane
and a dachshund alike); heads can stay level while the body tilts; bones blend
the short way round between keys; neck, head and tail trail the body a little
(follow-through); and the dog is set on the floor every frame, head, ears and
tail included.

Liveliness: the big moves get anticipation (a happy butt-wiggle and a gather
before sitting or lying down, a dip before a spin, a lean before a roll),
accelerate into contact, overshoot and settle. Gaits bounce off the floor.

Quick iteration: `build_dog.py <build> kit/builds-dev/<build>.glb --only sit,lie_down`
bakes just those clips; `kit/?dev=1&review=...` shows them (other builds fall back
to `kit/builds/`).

Status: ⬜ to do · 🟨 first pass (playable, reviewed on the shepherd only) · ✅ reviewed across builds

Review any clip across breeds with the kit viewer's review sheet, e.g.
`kit/?review=sit` (row per breed) or `kit/?review=walk,trot,run&breeds=Pug` (row per clip);
add `&toy=1` to simulate the held toy, `&cam=top|front` or `&yaw=-35` for other angles,
`&tilt=35` to look from above, `&fit=1` to blow every dog up to the same size and `&times=0.6` for one moment, breeds side by side.

Prop protocol for engines: the `jaw` bone's rotation opens the head part's jaw; the `grip`
bone's scale is 1 while the mouth holds the toy (`socket_mouth`) and 0 when it lets go.
When grip drops to 0, give the toy the mouth's velocity (that's what makes `toss` throw it).
`balance_treat`: the treat sits on `socket_nose` until 1.6 s, then flies up into the mouth,
caught when grip goes back to 1 (1.95 s). Clips start at t = 0 (30 fps).

## Rig foundation (needed first)

| | Item | Notes |
|---|---|---|
| ✅ | Shared skeleton | root, hips, spine, chest, neck, head, jaw; per leg: shoulder/thigh, elbow/stifle, wrist/hock, paw; tail ×3; ear ×2 |
| ✅ | Skin weights | generated from the body's own rings (we know which ring belongs to which bone), coat shells copy weights from the body |
| ✅ | Parts on bones | head part on `head`, ears on the head, tail part on the tail bones |
| ✅ | Jaw | lower jaw as its own piece hinged under the muzzle (open mouth for bark, pant, catch, pick up, eat) |
| ✅ | `socket_mouth` | toy anchor between the jaws, so anything held follows the head and jaw |
| ✅ | `socket_nose` | on top of the snout, for balancing a treat |
| ✅ | Viewer playback | clip picker, loop/blend, toy attach toggle |

## Clips

### Idle & poses
| | Clip | Loop | Notes |
|---|---|---|---|
| ✅ | idle | ✓ | breathing, small weight shifts, ear flicks, slow tail |
| ✅ | idle_happy | ✓ | panting, fast tail wag, bouncy weight |
| ✅ | sit | | wiggle, weight back, drop (back toes stay, hocks fold flat), chest pops up, settle |
| ✅ | sit_idle | ✓ | |
| ✅ | sit_to_stand | | |
| ✅ | lie_down | | wiggle, sit, walk the front paws out, settle with a sigh; front legs tucked, shoulders up |
| ✅ | lie_idle | ✓ | |
| ✅ | lie_to_stand | | |
| ✅ | sleep_curl | ✓ | lying flat and curved round, chin down on the floor between the front paws, tail wrapped round; slow breathing |
| ✅ | lie_to_sleep | | lie, turn the head round, curve in and lay the head down between the paws, sigh |
| ✅ | sleep_side | ✓ | flopped on its side, body still, just breathing; paws twitch in a dream |
| 🟨 | head_tilt | | the classic "huh?" |

### Tricks
| | Clip | Loop | Notes |
|---|---|---|---|
| ✅ | play_bow | | crouch, pounce into the bow, bounce in it wagging, pop up |
| ✅ | stretch | | down-dog with toe stretchies, then forward into the back-leg stretch (all paws stay put) |
| 🟨 | shake_paw | | from sit, offers a front paw |
| ✅ | roll_over | | lean and look, flop, squirm on its back with legs paddling, over, push up, head shake |
| 🟨 | play_dead | | "bang!" flinch, collapse with a bounce, top legs droop to the floor, guilty tail wag |
| 🟨 | spin | | dip, head leads, body curves into the turn, accelerate, overshoot, hop |
| ✅ | speak | | bark from sit |
| 🟨 | stand_hind | | up on hind legs, front paws dangling |
| 🟨 | crawl | ✓ | belly low, front paws reaching in turn (in place) |
| 🟨 | shy | | lying, chin down, paw over the muzzle |
| 🟨 | balance_treat | | treat on the nose (`socket_nose`), hold still, flip and catch |

### Toys & items
| | Clip | Loop | Notes |
|---|---|---|---|
| ✅ | pick_up | | paws planted, neck then chest down until the mouth reaches the floor (every build), jaw, grip |
| ✅ | carry_idle | ✓ | holding item, head slightly high |
| 🟨 | carry_walk | ✓ | walk with item |
| ✅ | put_down | | head down (same solve as pick_up), jaw opens, item detaches to the floor |
| ✅ | drop_it | | from sit/stand: jaw opens, item falls |
| ✅ | jump_catch | | leap, head snaps up, jaw closes on the item at the top |
| 🟨 | catch_standing | | quick head snap without jumping |
| 🟨 | tug | ✓ | braced back on planted paws, head shakes side to side |
| 🟨 | chew | ✓ | lying, front legs out, head down chewing the toy between the paws |
| 🟨 | toss | | wind up, flick, let go (toy keeps the mouth's speed) |
| 🟨 | shake_toy | | violent "kill the toy" head shake |

### Locomotion
| | Clip | Loop | Notes |
|---|---|---|---|
| ✅ | walk | ✓ | root motion |
| ✅ | trot | ✓ | bouncy: airborne between diagonal pushes |
| ✅ | run | ✓ | gallop, front legs reaching well forward |
| 🟨 | sneak | ✓ | low and slow, head down in line with the back |
| 🟨 | walk_back | ✓ | |
| 🟨 | turn_left / turn_right | | 90° in place, stepping (root yaw) |
| 🟨 | jump_up / jump_down | | onto / off a ledge 0.25 dog-space units high (root rises / falls) |
| 🟨 | land | | absorb a drop |
| 🟨 | zoomies | ✓ | tucked-butt sprint |

### Everyday dog stuff
| | Clip | Loop | Notes |
|---|---|---|---|
| ✅ | sniff | ✓ | nose to the ground on every build, sweeping |
| 🟨 | dig | ✓ | rump up, back paws planted, front paws scoop and rake back in turn |
| ✅ | shake_off | | wet-dog shake, head to tail wave |
| 🟨 | shake_big | | full-body shake: brace, twist hard nose to tail, slowing wobbles, stand tall |
| 🟨 | scratch_ear | | from sit: body curls toward the raised back leg, fast kicks |
| 🟨 | yawn | | head back, jaw all the way open, quiver, snap shut, smack |
| 🟨 | sneeze | | wrinkle up and back, then throw the whole neck and head down, head shake |
| ⬜ | lick | | needs a tongue part |
| ✅ | eat | ✓ | head down in a bowl (mouth solved to bowl height on every build), chomping |
| ✅ | drink | ✓ | lapping |
| 🟨 | pee | | leg lift (optional) |

### Emotions & reactions
| | Clip | Loop | Notes |
|---|---|---|---|
| 🟨 | excited_bounce | ✓ | front-end hops with the front legs tucking, back paws planted |
| 🟨 | greet | | whole-body wiggle, tail helicopter |
| 🟨 | happy | ✓ | paws planted, rump swinging, panting, tail going |
| 🟨 | sad | ✓ | head low, tail tucked, ears back |
| 🟨 | scared | ✓ | cowering low and backing off, rump tucked, tail clamped, nervous glance back |
| 🟨 | growl | ✓ | stiff, lip up (jaw), tail high |
| 🟨 | howl | | sit, muzzle pointed at the sky, jaw open |
| 🟨 | get_pet | ✓ | leans in, eyes closed (head tilt), tail wag |
| 🟨 | receive_treat | | head reaches, jaw snaps, chews, happy |
| 🟨 | nudge | | pushes with nose |

## Build order

1. **Rig foundation** — skeleton, weights, parts on bones, mouth/nose sockets, viewer playback.
2. **Core poses** — idle, sit (+ idle, + stand), lie down (+ idle, + stand), play bow, down-dog stretch with toe stretchies.
3. **Toys** — jaw, pick up, carry, put down, drop it, jump & catch.
4. **Rest** — sleep curl, sleep side, yawn.
5. **Locomotion** — walk, trot, run, turns.
6. Everything else, in whatever order the game needs.
