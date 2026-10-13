import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { pose, type Limb, type Monster } from './limbs'
import { ceilingHook, hanger, HANGER_ANGLES, rope, type HangerKind } from '../props/props'

/**
 * Monster animations: playful, a bit toddler and a bit dog. Every animation is a function of time that returns a Frame
 * (how the pot moves, what each leg and arm does, how lively the leaves are); `poseMonster` applies it.
 *
 *  - legs: 'plant' (feet on the ground at targets, solved with a knee IK so planted feet never slide), 'fk' (posed
 *    joint angles: dangling off a couch), 'tuck' (pulled up inside the pot)
 *  - arms: FK swing angles, optionally blended toward an IK target (hands reach a point: belly rubs, hugs, brow wipes)
 *  - walks are generated from personality numbers (stride, rock, bounce, limp, arm carriage...), so they travel at
 *    exactly the speed their planted feet push
 *
 * Coordinates for arm targets are "side-normalised" pot space: x outward from the arm's own side (negative = across the
 * body), y up from the pot's base, z forward.
 */

// ---------------------------------------------------------------------------------------------------------------
// Frame

interface ArmFrame {
  /** FK: swing forward/back (- = forward / up), spread out from the body (added to the pot's arm lift), elbow (- = bent). */
  upper: number
  spread: number
  fore: number
  /** Optional IK target for the wrist (side-normalised pot space) and how much to blend toward it (0..1). */
  target?: THREE.Vector3
  w?: number
  /** Elbow pole (side-normalised, relative to the shoulder): where the elbow points. */
  pole?: THREE.Vector3
  /** FK arm length (1 = rest): stretches the upper arm and forearm (rubber hose), for gestures driven by angles. */
  len?: number
  /** Rubber-hose reach: the arm may stretch up to this factor (1 = no stretch) to get the hand to its target. */
  stretch?: number
  /** How straight the arm ends up when it reaches (fraction of its full length): lower keeps the elbow bent. */
  bend?: number
  /** 0..1: pull the arm in inside the pot (hide). */
  tuck?: number
  /** Extra hand rotation after reaching (radians, about the hand's own x and z): e.g. lay the palm flat. */
  hand?: [number, number]
  /** The target is in the monster's body space (floor at y = 0, side-normalised x) instead of the pot's. */
  body?: boolean
  /** Put the centre of the fist on the target (instead of the wrist): for holding things. */
  fist?: boolean
  /** Target from the arm's relaxed (FK) wrist position, in the pot's side-normalised space: for gestures that must
   *  start and end exactly at the hanging pose. */
  fromRest?: (rest: THREE.Vector3) => THREE.Vector3
}

type LegFrame =
  | { mode: 'plant'; z: number; lift: number; x?: number }
  | { mode: 'fk'; thigh: number; shin: number; foot: number; splay?: number }
  | { mode: 'tuck'; amount: number }

interface Frame {
  /** Pot base offset from standing (y), side shift (x), forward (z); lean (pitch, + = forward), roll, yaw. */
  y: number
  x: number
  z: number
  pitch: number
  roll: number
  yaw: number
  /** Pot squash & stretch (1 = rest). */
  squash: number
  /** Whole-body turn (spins). */
  spin: number
  legs: [LegFrame, LegFrame] // [left, right]
  /** Feet planted this far out from the hips (1 = under the hips). */
  width: number
  /** Hips forward (sitting on a couch edge). */
  hipZ: number
  arms: [ArmFrame, ArmFrame] // [left, right]
  /** Skip the arms' pot-clearance push for this frame (FK gestures that pass in front of the pot on purpose). */
  noClear?: boolean
  /** Leaf spring damping (default 4.5; higher = leaves settle faster). */
  leafDamp?: number
  /** Leaf liveliness: amplitude and frequency. */
  waggle: number
  waggleRate: number
  /** Travel speed (pot units / s) for walks. */
  speed: number
  /** Props: couch under the pot, sweat drops on the rim, water flung off. */
  couch?: number
  /** Hanging from a ceiling hook in a pot hanger: the hanger kind (drawn by the fx). */
  hang?: HangerKind
  sweat?: number
  fling?: number
  /** A little held thing (seed pod): 1 = between the hands, 0 = resting on the ground where they pick it up. */
  held?: number
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const TAU = Math.PI * 2

function base(): Frame {
  return {
    y: 0, x: 0, z: 0, pitch: 0, roll: 0, yaw: 0, squash: 1, spin: 0,
    legs: [{ mode: 'plant', z: 0, lift: 0 }, { mode: 'plant', z: 0, lift: 0 }],
    width: 1, hipZ: 0,
    arms: [{ upper: 0, spread: 0.2, fore: -0.18 }, { upper: 0, spread: 0.2, fore: -0.18 }],
    waggle: 0.035, waggleRate: 1.3, speed: 0,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Keyframes: [time 0..1, value, easing into this key]

type Ease = 'io' | 'in' | 'out' | 'lin'
type Keys = ([number, number] | [number, number, Ease])[]
function key(k: Keys, u: number) {
  for (let i = 0; i < k.length - 1; i++)
    if (u <= k[i + 1][0]) {
      const x = THREE.MathUtils.clamp((u - k[i][0]) / Math.max(1e-6, k[i + 1][0] - k[i][0]), 0, 1)
      const e = k[i + 1][2] ?? 'io'
      const f = e === 'in' ? x * x * x : e === 'out' ? 1 - (1 - x) ** 3 : e === 'lin' ? x : x * x * x * (x * (x * 6 - 15) + 10)
      return THREE.MathUtils.lerp(k[i][1], k[i + 1][1], f)
    }
  return k[k.length - 1][1]
}
/** Smooth 0 -> 1 -> 0 window over [a, b] with soft edges `e`. */
const win = (u: number, a: number, b: number, e = 0.06) => THREE.MathUtils.smoothstep(u, a, a + e) * (1 - THREE.MathUtils.smoothstep(u, b - e, b))

// ---------------------------------------------------------------------------------------------------------------
// Walks: one generator, many personalities

interface Gait {
  label: string
  period: number // seconds per cycle (two steps)
  stance: number // fraction of a cycle a foot is down
  stride: number // step length
  lift: number // foot height in the swing
  width?: number // stance width (1 = under the hips)
  crouch?: number // knees stay bent this much
  bob?: number // body rise over each planted foot
  lean?: number // forward lean (- = chest out)
  roll?: number // side-to-side rock
  sway?: number // weight shift side to side
  yaw?: number // hip twist
  limp?: number // 0..1: one leg drags (lurch)
  armSwing?: number
  armUp?: number // arm carriage (- = held forward / up)
  spread?: number // arms out from the body
  elbow?: number // elbow bend (+ = more bent)
  elbowSwing?: number
  waggle?: number
  hopBob?: number // extra bounce while both feet are up
  flight?: number // runs: the body rises while both feet are off the ground
}

export const GAITS = {
  idle: { label: 'idle', period: 3.2, stance: 1, stride: 0, lift: 0, crouch: 0.012, bob: 0.006, sway: 0.012, armSwing: 0.04, elbow: 0.18 },
  walk: { label: 'walk', period: 1.3, stance: 0.62, stride: 0.2, lift: 0.07, crouch: 0.02, bob: 0.014, lean: 0.04, roll: 0.04, sway: 0.05, armSwing: 0.32, elbow: 0.3, waggle: 0.07 },
  waddle: { label: 'waddle (toddler)', period: 0.95, stance: 0.62, stride: 0.1, lift: 0.055, width: 1.4, crouch: 0.035, bob: 0.012, lean: -0.04, roll: 0.15, sway: 0.06, yaw: 0.08, armSwing: 0.12, spread: 0.6, elbow: 0.35, waggle: 0.1 },
  scamper: { label: 'scamper (excited toddler)', period: 0.48, stance: 0.55, stride: 0.13, lift: 0.07, width: 1.15, crouch: 0.02, bob: 0.03, lean: 0.1, roll: 0.06, armSwing: 0.45, armUp: -0.7, spread: 0.45, elbow: 0.6, elbowSwing: 0.3, waggle: 0.14 },
  strut: { label: 'strut (proud)', period: 1.15, stance: 0.62, stride: 0.36, lift: 0.09, crouch: 0.075, bob: 0.025, lean: -0.17, roll: 0.07, sway: 0.04, yaw: 0.22, armSwing: 0.85, spread: 0.35, elbow: 0.15, waggle: 0.1 },
  sneak: { label: 'sneak (tiptoe)', period: 1.8, stance: 0.66, stride: 0.16, lift: 0.12, crouch: 0.07, bob: 0.006, lean: 0.14, roll: 0.02, armSwing: 0.05, armUp: -0.95, spread: 0.32, elbow: 1.5, waggle: 0.03 },
  lurch: { label: 'lurch (slow, heavy)', period: 2.3, stance: 0.7, stride: 0.22, lift: 0.05, limp: 0.85, crouch: 0.07, bob: 0.03, lean: 0.22, roll: 0.1, sway: 0.06, yaw: 0.06, armSwing: 0.14, armUp: 0.08, spread: 0.0, elbow: 0.04, waggle: 0.09 },
  trudge: { label: 'trudge (tired)', period: 1.9, stance: 0.68, stride: 0.12, lift: 0.025, crouch: 0.02, bob: 0.02, lean: 0.2, roll: 0.06, armSwing: 0.1, armUp: 0.1, spread: 0.05, elbow: 0.0, waggle: 0.03 },
  run: { label: 'run', period: 0.44, stance: 0.32, stride: 0.42, lift: 0.17, crouch: 0.05, bob: 0, flight: 0.05, lean: 0.28, roll: 0.03, yaw: 0.1, armSwing: 1.0, elbow: 1.45, elbowSwing: 0.2, waggle: 0.18 },
  carry: { label: 'carry something (pick up & walk)', period: 1.4, stance: 0.64, stride: 0.16, lift: 0.06, crouch: 0.03, bob: 0.016, lean: -0.05, roll: 0.05, sway: 0.05, armSwing: 0, elbow: 0.6, waggle: 0.07 },
} satisfies Record<string, Gait>

function gait(g: Gait, t: number, curvatureX = 0): Frame {
  const f = base()
  const moving = g.stride > 0
  let c = (t / g.period) % 1
  // limp: the cycle speeds up through one step and drags through the other
  if (g.limp) c = (c - (g.limp * 0.07 * Math.sin(TAU * c)) / 1 + 1) % 1
  const s = Math.sin(TAU * c)
  f.width = g.width ?? 1
  f.pitch = g.lean ?? 0
  // body rises over each planted foot (twice a cycle)
  const twice = 0.5 - 0.5 * Math.cos(2 * TAU * c)
  f.y = -(g.crouch ?? 0) + (g.bob ?? 0) * (moving ? twice : 0.5 + 0.5 * Math.sin(t * 2))
  // hopBob: a little hop off the planted foot each step
  const hop = g.hopBob ? g.hopBob * Math.max(0, Math.sin(2 * TAU * c - 0.6)) ** 2 : 0
  f.y += hop
  // runs: up in the flight between steps, down at mid-stance
  if (g.flight && moving) f.y += g.flight * 0.5 * (1 + Math.cos(2 * TAU * (c - (g.stance + 0.5) / 2)))
  // lurch: the body drops heavily onto the good leg each cycle
  if (g.limp) f.y -= g.limp * 0.035 * Math.max(0, Math.sin(TAU * c + 0.4)) ** 3
  f.roll = -(g.roll ?? 0) * s - (g.limp ?? 0) * 0.06 * Math.max(0, s)
  f.x = (g.sway ?? 0) * (moving ? s : Math.sin(t * 0.8))
  f.yaw = (g.yaw ?? 0) * s
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const p = (c + (side > 0 ? 0 : 0.5)) % 1
    let z = 0
    let lift = 0
    const stride = g.stride * (1 - side * curvatureX)
    if (moving) {
      if (p < g.stance) z = stride / 2 - stride * (p / g.stance)
      else {
        const u = (p - g.stance) / (1 - g.stance)
        z = -stride / 2 + stride * THREE.MathUtils.smootherstep(u, 0, 1)
        // the dragging leg barely lifts
        lift = g.lift * Math.sin(Math.PI * u) * (g.limp && side < 0 ? 1 - g.limp * 0.75 : 1)
        // the dragging foot scuffs forward late and slow
        if (g.limp && side < 0) z = -stride / 2 + stride * Math.pow(THREE.MathUtils.smootherstep(u, 0, 1), 1.8)
      }
    }
    f.legs[i] = { mode: 'plant', z, lift: lift + hop * 0.9 }
  }
  const swing = moving ? s : Math.sin(t * 1.6) * 0.5
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const a = swing * side * (g.armSwing ?? 0.3)
    f.arms[i] = {
      upper: (g.armUp ?? 0) + a,
      spread: 0.2 + (g.spread ?? 0) + (g.limp ? 0.05 * Math.sin(TAU * c * 2) : 0),
      fore: -(g.elbow ?? 0.2) - (g.elbowSwing ?? 0.2) * Math.max(0, -a),
    }
  }
  if (!moving) idleLife(f, t)
  f.waggle = g.waggle ?? 0.04
  f.waggleRate = moving ? 2 / g.period : 1.3
  f.speed = moving ? g.stride / (g.stance * g.period) : 0
  return f
}

/** Idle personality: look around (the pot is the head), tilt curiously, shift weight foot to foot, fidget the hands.
 *  Built from slow incommensurate cycles so it never visibly repeats; the feet stay planted. */
function idleLife(f: Frame, t: number) {
  const look = key([[0, 0], [0.08, 0.32], [0.28, 0.32], [0.36, -0.28], [0.55, -0.28], [0.62, 0], [1, 0]], (t / 7.3) % 1)
  f.yaw = look
  f.roll = 0.07 * look + 0.015 * Math.sin(t * 0.8)
  f.pitch = 0.03 * Math.sin(t * 0.55) - 0.04 * Math.abs(look)
  const shift = Math.sin(t * 0.7)
  f.x = 0.03 * shift
  f.squash = 1 + 0.006 * Math.sin(t * 2)
  f.legs = [{ mode: 'plant', z: 0, lift: 0 }, { mode: 'plant', z: 0, lift: 0 }] // feet stay put
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    f.arms[i].upper = 0.05 * Math.sin(t * 1.3 + side)
    f.arms[i].spread = 0.2 + 0.04 * Math.sin(t * 0.9 + side * 2)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Actions

type ActionFn = (m: Monster, t: number) => Frame

/** Wrist targets on the front of the pot at height y (fraction of the pot), x across (side-normalised). */
function onBelly(m: Monster, yFrac: number, x: number, out = 0.08) {
  const y = m.pot.height * yFrac
  return V(x, y, m.pot.radiusAt(y) + out)
}

const AIR = { from: 0.36, to: 0.66, height: 0.4, tuck: 0.14 }
/** Centre of a fist in body space: a little way past the wrist, along the forearm. */
const FIST = 0.1
function fistCenter(m: Monster, l: Limb, out = new THREE.Vector3()) {
  const w = m.group.worldToLocal(l.bones.hand.getWorldPosition(new THREE.Vector3()))
  const e = m.group.worldToLocal(l.bones.fore.getWorldPosition(new THREE.Vector3()))
  return out.copy(w).addScaledVector(w.clone().sub(e).normalize(), FIST)
}
/**
 * Held by the back of the rim (the scruff), in three parts the game can chain: 'up' (grabbed, a squash and a stretch
 * up off the floor, then it starts protesting), 'held' (a seamless loop: gentle alternating kicks that tip the pot,
 * which swings like a pendulum from the grip, arms paddling, leaves only a little lively) and 'down' (lowered, then
 * dropped the last bit: a heavy plop with a big squash, a rebound, a settle). In the viewer 'up' and 'down' loop with
 * a pause so they can be watched.
 */
const SCRUFF_H = 0.45 // how high it's held (body units)
function heldPose(m: Monster, t: number, f: Frame, up: number, lift: number, kickAmt: number, swing?: { pitch: number; vel: number }) {
  const H = m.pot.height
  const r = m.pot.radiusAt(H)
  const kp = t * TAU * 1.6
  const kL = Math.sin(kp) * kickAmt
  const kR = Math.sin(kp + Math.PI) * kickAmt
  // pendulum pitch: either the settled hang (with the kicks pushing it), or a given swing (being picked up)
  const pitch = swing ? swing.pitch : 0.38 * up + up * (-0.07 * Math.sin(kp - 0.9) * kickAmt + 0.02 * Math.sin(t * 1.3))
  const roll = up * (0.13 * Math.sin(kp - 0.7) * kickAmt + 0.025 * Math.sin(t * 1.1))
  // rotate about the grip P = (0, H, -r) at the back of the rim: offset the base so the grip stays put
  const dz = -r - (-r * Math.cos(pitch) - H * Math.sin(pitch))
  const dy = H - (-r * Math.sin(pitch) + H * Math.cos(pitch))
  f.pitch = pitch
  f.roll = roll
  f.z = dz
  f.x = H * Math.sin(roll)
  f.y = lift + dy + H * (1 - Math.cos(roll))
  // the legs lag the swing: as the pot swings one way they trail the other (follow-through), then catch up
  const lag = swing ? -0.55 * swing.vel : 0
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const k = i === 0 ? kL : kR
    const thigh = (-0.42 * k + lag) * up
    const shin = (0.25 * Math.max(0, -k) + 0.25 * Math.max(0, -lag)) * up
    f.legs[i] = up > 0.01 ? { mode: 'fk', thigh, shin, foot: (0.2 * k + 0.3 * lag) * up, splay: -0.22 * up } : { mode: 'plant', z: 0, lift: 0 }
    const paddle = Math.sin(kp + i * Math.PI + 1.2) * kickAmt
    // long arms swinging big, back and forth (elbows nearly straight)
    f.arms[i] = { upper: (0.95 * paddle + 0.6 * lag) * up, spread: 0.25 + (0.45 * kickAmt + 0.15 * Math.abs(paddle)) * up, fore: -0.12 - 0.08 * Math.abs(paddle) * up }
  }
  f.waggle = 0.025 + 0.025 * kickAmt * up // the plant stays fairly stiff
  f.waggleRate = 3
  f.leafDamp = 8
}
/** Hanging planter geometry (body units): the hanger's ring above the rim, the rope to the hook, how high it hangs. */
const HANG = { top: 0.5, rope: 0.45, base: 0.62 }
/** Which hanger a monster swings in and how long its rope is: set `m.group.userData.hang` (the viewer's picker does). */
export interface HangSetup { kind: HangerKind; rope: number }
export function hangSetup(m: Monster): HangSetup {
  return { kind: 'macrame', rope: HANG.rope, ...(m.group.userData.hang as Partial<HangSetup> | undefined) }
}
/**
 * Like a kid on a swing: the pot hangs in a hanger from a ceiling hook and swings back and forth (a pendulum about the
 * hook); the legs pump, stretched out in front on the forward swing and tucked back on the back swing, little feet
 * kicking; the hands hold the two front cords; the leaves trail the swing.
 */
function swingFrame(m: Monster, t: number): Frame {
  const f = base()
  const H = m.pot.height
  const { kind, rope } = hangSetup(m)
  const D = H + HANG.top + rope // base -> hook
  const w = Math.sqrt(9.8 / (D * 1.6)) * 1.25 // a longer rope swings slower
  const ph = t * w
  const A = 0.34
  const phi = A * Math.sin(ph) // + = swinging back (base moves to -z)
  const pivotY = HANG.base + D
  f.pitch = phi
  f.y = pivotY - D * Math.cos(phi) - m.potOffset
  f.z = -D * Math.sin(phi)
  f.hang = kind
  // legs: forward and straight at the front of the swing, tucked back under at the back (pumping), feet kicking
  const fwd = Math.max(0, -Math.sin(ph)) // 1 at the front peak
  const bk = Math.max(0, Math.sin(ph))
  for (const i of [0, 1]) {
    const kick = 0.12 * Math.sin(t * 9 + i * Math.PI) * (0.4 + 0.6 * fwd)
    f.legs[i] = { mode: 'fk', thigh: -0.25 - 0.85 * fwd + 0.35 * bk + kick, shin: 0.2 + 1.0 * bk - 0.15 * fwd, foot: 0.2 - 0.3 * fwd + 0.2 * bk, splay: -0.08 }
  }
  // hands on the front cords, a little way up from the rim
  const R = m.pot.rimRadius + 0.012
  const fr = 0.3
  for (const i of [0, 1]) {
    const a = HANGER_ANGLES[0] // the right arm's cord (side-normalised: the left arm mirrors it)
    f.arms[i] = {
      upper: -0.4, spread: 0.2, fore: -0.6,
      target: V(Math.sin(a) * R * (1 - fr), H + HANG.top * fr, Math.cos(a) * R * (1 - fr)), fist: true, w: 1, pole: V(1.0, -0.6, 0.3), stretch: 1.8, bend: 0.8,
    }
  }
  f.noClear = true
  f.waggle = 0.04
  f.waggleRate = 2
  f.leafDamp = 5
  return f
}

/** A damped pendulum settling from 0 to `target` from time 0: angle and angular velocity. */
function settle(target: number, tau: number, w = 3.4, zeta = 1.5) {
  if (tau <= 0) return { pitch: 0, vel: 0 }
  const e = Math.exp(-zeta * tau)
  const c = Math.cos(w * tau)
  const sn = Math.sin(w * tau)
  return { pitch: target * (1 - e * (c + (zeta / w) * sn)), vel: target * e * sn * (w + (zeta * zeta) / w) }
}
function scruffFrame(m: Monster, t: number, part: 'up' | 'held' | 'down'): Frame {
  const f = base()
  if (part === 'held') {
    heldPose(m, t, f, 1, SCRUFF_H, 0.75)
    return f
  }
  if (part === 'up') {
    // SURPRISE: snatched up quickly; the pot tips forward hard, overshoots and pops back up a little before it finds
    // its hang; the legs fling forward a lot, then back a lot, and go straight into the protest kicks; the arms fly up
    // and wave; the leaves whip around (their most dramatic moment). (The viewer loops this every 4 s.)
    const T = 4
    const tt = t % T
    const lift = SCRUFF_H * THREE.MathUtils.smootherstep(tt, 0.12, 0.5)
    const up = THREE.MathUtils.smoothstep(lift, 0, SCRUFF_H * 0.4)
    const sw = settle(0.38, tt - 0.15, 4.2, 1.1) // underdamped: a big forward tip, overshoot, a pop back up
    const kick = 0.85 * THREE.MathUtils.smoothstep(tt, 0.55, 0.85)
    heldPose(m, t, f, up, lift, kick, { pitch: sw.pitch * up, vel: sw.vel * up * 1.9 })
    // arms: thrown up in surprise and waving, then easing into the held swing
    const surprise = win(tt, 0.15, 1.7, 0.25)
    for (const i of [0, 1]) {
      const wave = Math.sin(t * 9 + i * 1.7)
      const a = f.arms[i]
      f.arms[i] = {
        upper: THREE.MathUtils.lerp(a.upper, -1.5 + 0.5 * wave, surprise),
        spread: THREE.MathUtils.lerp(a.spread, 0.9 + 0.25 * wave, surprise),
        fore: THREE.MathUtils.lerp(a.fore, -0.35 - 0.25 * Math.max(0, wave), surprise),
      }
    }
    f.squash = key([[0, 1], [0.03, 0.92], [0.08, 1.1], [0.16, 1.02], [0.3, 1], [1, 1]], tt / T)
    const whip = Math.exp(-Math.max(0, tt - 0.15) * 1.4) * (tt > 0.1 ? 1 : 0)
    f.waggle = 0.03 + 0.28 * whip
    f.waggleRate = 7
    f.leafDamp = 3 + 5 * (1 - whip)
    return f
  }
  // PUT DOWN: still protesting... then let go, all at once: it drops the whole way under gravity (the pot swinging
  // level and the legs straightening as it falls), lands heavy, the knees take the hit (squash), and it fights for its
  // balance: the pot rocks, the arms fly out and windmill to catch it, the knees pump; it slowly steadies and stands up.
  const T = 4.0
  const tt = t % T
  const tRel = 0.45 // let go
  const g = 26 // gravity (body units / s^2): a quick, heavy drop
  const fall = Math.max(0, tt - tRel)
  const lift = Math.max(0, SCRUFF_H - 0.5 * g * fall * fall)
  const tLand = tRel + Math.sqrt((2 * SCRUFF_H) / g)
  const falling = tt >= tRel && tt < tLand
  const fu = falling ? (tt - tRel) / (tLand - tRel) : tt >= tLand ? 1 : 0 // 0..1 through the fall
  const level = 1 - THREE.MathUtils.smoothstep(fu, 0, 0.85) // the pot swings level as it drops
  const snap = THREE.MathUtils.smoothstep(fall, 0, 0.07) // legs and arms whip straight in the first instant of the fall
  heldPose(m, t, f, 1 - fu, lift, 0.85 * (1 - snap), { pitch: 0.38 * level, vel: 0 })
  // legs: kicking until the let-go, then straightening down fast as it falls (then the feet follow the body down)
  if (snap >= 1) f.legs = [{ mode: 'plant', z: 0, lift }, { mode: 'plant', z: 0, lift }]
  else for (const lf of f.legs) if (lf.mode === 'fk') ((lf.thigh *= 1 - snap), (lf.shin *= 1 - snap), (lf.foot *= 1 - snap), (lf.splay = (lf.splay ?? 0) * (1 - snap)))
  const land = tt - tLand
  if (land > 0) {
    // knees absorb the hit fast, then a slow rise back to standing
    // the knees spring: down hard, back up past standing (a little pop), and settle fast: a damped spring
    const absorb = -0.21 * Math.exp(-land * 5.5) * Math.sin(land * 19.6)
    // balance: the pot rocks side to side and a little forward/back, dying away
    const rock = Math.exp(-land * 1.6)
    const roll = 0.16 * rock * Math.sin(land * 7.5)
    f.y = absorb + 0.03 * rock * Math.max(0, Math.sin(land * 15)) // the knees pump a bit
    f.roll = roll
    f.pitch = 0.07 * rock * Math.sin(land * 5.5 + 1)
    f.x = -0.04 * rock * Math.sin(land * 7.5)
    f.squash = 1 + 1.4 * absorb // squashed as the knees go down, stretched on the pop back up
    // arms fly out and windmill against the rock to catch the balance, settling down as it steadies
    for (const i of [0, 1]) {
      const side = i === 0 ? -1 : 1
      const fling = THREE.MathUtils.smoothstep(land, 0, 0.12) // they fly out from the hanging pose, not snap there
      const catchUp = fling * rock * (0.8 + 0.5 * side * Math.sin(land * 7.5))
      f.arms[i] = { upper: -0.5 * fling * rock * Math.sin(land * 6 + i * 2), spread: 0.2 + catchUp, fore: -0.18 - 0.2 * fling * rock }
    }
    f.legs = [{ mode: 'plant', z: 0, lift: 0 }, { mode: 'plant', z: 0, lift: 0 }]
    // the leaves get one good bounce from the landing, then settle quickly (damping ramps up after the hit)
    f.waggle = (0.025 + 0.1 * Math.exp(-land * 5)) * (1 - THREE.MathUtils.smoothstep(land, 1.0, 2.0)) // ...and end perfectly still
    f.waggleRate = 5
    f.leafDamp = 4 + 9 * THREE.MathUtils.smoothstep(land, 0.15, 0.7)
  } else {
    f.squash = 1
  }
  return f
}


/** Where the seed pod rests (body space) and where it's held (in front of the belly): the fists close on its sides. */
function podSpots(m: Monster) {
  const H = m.pot.height
  const rest = V(0, POD_REST, m.pot.bottomRadius + 0.34)
  const hold = V(0, m.potOffset + 0.42 * H, m.pot.radiusAt(0.42 * H) + 0.3)
  return { rest, hold }
}
/** Both fists on the pod's sides at body-space point p (x side-normalised: each fist sits just outside the pod). */
function gripArm(p: THREE.Vector3): ArmFrame {
  return { upper: -0.3, spread: 0.2, fore: -0.5, target: V(POD_REST + 0.06, p.y, p.z), body: true, fist: true, w: 1, pole: V(1.0, -0.3, -0.4), stretch: 1.8, bend: 0.85 }
}



/** Sitting on the couch: happy dangling, impatient kicking, or a lazy slump. */
function sitFrame(m: Monster, t: number, mood: 'happy' | 'impatient' | 'lazy'): Frame {
  const f = base()
  const seat = 0.3
  f.couch = seat
  f.y = seat - m.potOffset
  f.hipZ = m.pot.bottomRadius * 0.7
  const rate = mood === 'impatient' ? 8 : mood === 'lazy' ? 1.1 : 3.2
  const amp = mood === 'impatient' ? 1.25 : mood === 'lazy' ? 0.35 : 1
  for (const i of [0, 1]) {
    const kick = Math.max(0, Math.sin(t * rate + i * Math.PI)) ** (mood === 'impatient' ? 1 : 2)
    f.legs[i] = { mode: 'fk', thigh: -0.95 - 0.35 * kick * amp, shin: 0.75 - 0.6 * kick * amp, foot: 0.15 - 0.2 * kick }
  }
  if (mood === 'impatient') {
    // fidgety: jiggling with the kicks, bouncing the hands on the cushion, looking about
    const k = Math.sin(t * rate)
    f.pitch = -0.02 + 0.03 * Math.abs(k)
    f.roll = 0.05 * k
    f.yaw = 0.25 * key([[0, 0], [0.2, 0.6], [0.45, 0.6], [0.55, -0.6], [0.85, -0.6], [1, 0]], (t / 4) % 1)
    f.squash = 1 + 0.02 * Math.abs(k)
    f.arms = [0, 1].map((i) => ({ upper: -0.15 - 0.12 * Math.max(0, Math.sin(t * rate * 0.5 + i * Math.PI)), spread: 0.55, fore: -0.3 })) as [ArmFrame, ArmFrame]
    f.waggle = 0.12
    f.waggleRate = 4
  } else if (mood === 'lazy') {
    // slumped back into the cushion, arms flopped out wide, slow deep breaths
    f.y -= 0.03
    f.pitch = -0.24 + 0.015 * Math.sin(t * 0.9)
    f.roll = 0.05
    f.squash = 0.97 + 0.015 * Math.sin(t * 0.9)
    f.arms = [{ upper: 0.25, spread: 0.95, fore: -0.05 }, { upper: 0.25, spread: 0.95, fore: -0.05 }]
    f.waggle = 0.02
  } else {
    f.pitch = -0.05 + 0.02 * Math.sin(t * 1.1)
    f.roll = 0.03 * Math.sin(t * 0.9)
    f.squash = 1 + 0.008 * Math.sin(t * 2)
    f.arms = [{ upper: -0.15, spread: 0.55, fore: -0.25 }, { upper: -0.15, spread: 0.55, fore: -0.25 }]
    f.waggle = 0.04
  }
  return f
}

/** Blend two frames (numbers and planted feet; arm IK targets blend too). */
function lerpFrame(a: Frame, b: Frame, w: number): Frame {
  if (w <= 0) return a
  if (w >= 1) return b
  const L = THREE.MathUtils.lerp
  const f: Frame = { ...a }
  for (const k of ['y', 'x', 'z', 'pitch', 'roll', 'yaw', 'squash', 'spin', 'width', 'hipZ', 'waggle', 'waggleRate', 'speed'] as const) f[k] = L(a[k], b[k], w)
  f.legs = [0, 1].map((i) => {
    const la = a.legs[i]
    const lb = b.legs[i]
    if (la.mode === 'plant' && lb.mode === 'plant') return { mode: 'plant', z: L(la.z, lb.z, w), lift: L(la.lift, lb.lift, w) }
    return w < 0.5 ? la : lb
  }) as [LegFrame, LegFrame]
  f.arms = [0, 1].map((i) => {
    const x = a.arms[i]
    const y = b.arms[i]
    return { ...(w < 0.5 ? x : y), upper: L(x.upper, y.upper, w), spread: L(x.spread, y.spread, w), fore: L(x.fore, y.fore, w), w: L(x.target ? x.w ?? 1 : 0, y.target ? y.w ?? 1 : 0, w), target: y.target ?? x.target }
  }) as [ArmFrame, ArmFrame]
  return f
}

const ACTIONS: Record<string, { label: string; fn: ActionFn }> = {
  hop: {
    label: 'hop',
    fn: (_m, t) => {
      const u = (t / 1.9) % 1
      const f = base()
      f.y = key([[0, 0], [0.24, -0.13], [0.3, -0.13], [0.36, 0.0, 'in'], [0.66, 0.0], [0.72, -0.11, 'out'], [0.8, 0.02], [0.87, -0.025], [0.94, 0.006], [1, 0]], u)
      let lift = 0
      if (u > AIR.from && u < AIR.to) {
        const x = (u - AIR.from) / (AIR.to - AIR.from)
        const arc = 4 * x * (1 - x)
        f.y += AIR.height * arc
        lift = Math.max(0, AIR.height * arc - AIR.tuck * Math.sin(Math.PI * x))
      }
      f.z = -key([[0, 0], [0.24, 0.04], [0.36, 0], [1, 0]], u)
      f.pitch = key([[0, 0], [0.24, 0.24], [0.36, -0.08, 'in'], [0.6, -0.04], [0.66, 0.06], [0.74, 0.2, 'out'], [0.88, 0], [1, 0]], u)
      f.squash = key([[0, 1], [0.24, 0.9], [0.3, 0.9], [0.38, 1.1], [0.5, 1.02], [0.66, 1.03], [0.72, 0.86, 'out'], [0.8, 1.04], [0.87, 0.97], [0.94, 1.01], [1, 1]], u)
      f.legs = [{ mode: 'plant', z: 0, lift }, { mode: 'plant', z: 0, lift }]
      const arm: ArmFrame = {
        upper: key([[0, 0], [0.24, 0.75], [0.3, 0.8], [0.42, -0.35], [0.62, -0.25], [0.74, 0.25], [0.9, 0], [1, 0]], u),
        fore: key([[0, -0.18], [0.24, -0.15], [0.42, -0.04], [0.62, -0.08], [0.74, -0.5], [0.9, -0.2], [1, -0.18]], u),
        spread: key([[0, 0.2], [0.24, 0.05], [0.44, 1.9], [0.6, 1.7], [0.76, 0.25], [0.9, 0.2], [1, 0.2]], u),
      }
      f.arms = [arm, { ...arm }]
      f.waggle = 0.16 * (0.3 + win(u, 0.3, 0.9, 0.1))
      f.waggleRate = 9
      return f
    },
  },
  hops: {
    label: 'hop hop hop',
    fn: (_m, t) => {
      // three hops in a row: small, small, BIG; then a squashy landing and a settle
      const T = 3.2
      const u = (t / T) % 1
      const f = base()
      const HOPS: [number, number, number][] = [[0.12, 0.24, 0.16], [0.3, 0.42, 0.2], [0.5, 0.7, 0.42]] // from, to, height
      let y = key([[0, 0], [0.08, -0.1], [0.12, -0.06], [0.24, -0.06], [0.27, -0.08], [0.3, -0.06], [0.42, -0.06], [0.46, -0.13], [0.5, -0.04], [0.7, -0.04], [0.75, -0.13, 'out'], [0.84, 0.02], [0.9, -0.02], [1, 0]], u)
      let lift = 0
      let air = 0
      for (const [a, b, h] of HOPS) {
        if (u > a && u < b) {
          const x = (u - a) / (b - a)
          y += h * 4 * x * (1 - x)
          lift = Math.max(0, h * 4 * x * (1 - x) - 0.1 * h * Math.sin(Math.PI * x) * 2)
          air = Math.sin(Math.PI * x) * (h / 0.42)
        }
      }
      f.y = y
      f.squash = key([[0, 1], [0.08, 0.9], [0.12, 1.06], [0.24, 0.92], [0.3, 1.06], [0.42, 0.9], [0.46, 0.88], [0.52, 1.12], [0.7, 1.03], [0.75, 0.85, 'out'], [0.84, 1.04], [0.92, 0.98], [1, 1]], u)
      f.pitch = key([[0, 0], [0.08, 0.14], [0.12, -0.05], [0.24, 0.1], [0.3, -0.05], [0.44, 0.18], [0.52, -0.08], [0.7, 0.05], [0.76, 0.2], [0.9, 0], [1, 0]], u)
      f.legs = [{ mode: 'plant', z: 0, lift }, { mode: 'plant', z: 0, lift }]
      const up = Math.max(air, key([[0, 0], [0.5, 0], [0.56, 1], [0.66, 1], [0.74, 0.2], [1, 0]], u))
      const arm: ArmFrame = { upper: 0.3 * (1 - up) - 0.35 * up, spread: 0.2 + 1.6 * up, fore: -0.25 + 0.15 * up }
      f.arms = [arm, { ...arm }]
      f.waggle = 0.08 + 0.12 * air
      f.waggleRate = 8
      return f
    },
  },

  swing: { label: 'swing (hanging planter)', fn: (m, t) => swingFrame(m, t) },
  scruffup: { label: 'scruff: picked up', fn: (m, t) => scruffFrame(m, t, 'up') },
  scruff: { label: 'scruff: held (protest loop)', fn: (m, t) => scruffFrame(m, t, 'held') },
  scruffdown: { label: 'scruff: put down (plop)', fn: (m, t) => scruffFrame(m, t, 'down') },


  pickup: {
    label: 'pick up',
    fn: (m, t) => {
      const u = (t / 5.2) % 1
      const f = base()
      // reach down to the pod (0-0.18), close on it (0.18-0.26), stand up lifting it (0.26-0.4), hold it close with a
      // happy bounce (0.4-0.74), bend down and set it back (0.74-0.84), let go (0.84-0.88), stand (0.88-1).
      // The fists are anchored on the pod's sides the whole time they touch it, so it never slides in the hands.
      const down = key([[0, 0], [0.18, 1], [0.26, 1], [0.4, 0], [0.74, 0], [0.84, 1], [0.88, 1], [1, 0]], u)
      const holding = u > 0.4 && u < 0.74 ? 1 : 0
      const bounce = holding * Math.abs(Math.sin((u - 0.4) * Math.PI * 6)) * 0.02
      f.y = -0.15 * down + bounce
      f.z = -0.05 * down
      f.pitch = 0.5 * down
      f.squash = 1 + bounce * 0.8
      const { rest, hold } = podSpots(m)
      const lift = key([[0, 0], [0.26, 0], [0.4, 1], [0.74, 1], [0.84, 0], [1, 0]], u)
      const p = rest.clone().lerp(hold, lift).add(V(0, bounce, 0))
      const reach = key([[0, 0], [0.16, 1], [0.88, 1], [0.98, 0], [1, 0]], u)
      for (const i of [0, 1]) f.arms[i] = { ...gripArm(p), w: reach }
      f.held = THREE.MathUtils.smoothstep(u, 0.2, 0.26) * (1 - THREE.MathUtils.smoothstep(u, 0.82, 0.88))
      f.waggle = 0.06 + 0.06 * holding
      return f
    },
  },
  shake: {
    label: 'shake off (like a dog)',
    fn: (m, t) => {
      const u = (t / 2.6) % 1
      const f = base()
      // brace, then a fast twisting shake that builds and dies away, then a happy little settle
      const env = key([[0, 0], [0.14, 0], [0.3, 1, 'out'], [0.55, 0.8], [0.72, 0, 'in'], [1, 0]], u)
      const HZ = 4.6
      const w = Math.sin(t * TAU * HZ)
      f.width = 1.3
      f.y = key([[0, 0], [0.12, -0.06], [0.72, -0.05], [0.8, 0.02], [0.9, 0], [1, 0]], u)
      f.yaw = 0.55 * env * w
      f.roll = 0.12 * env * Math.sin(t * TAU * HZ + 0.8)
      f.pitch = key([[0, 0], [0.12, 0.08], [0.72, 0.06], [0.82, -0.08], [0.92, 0], [1, 0]], u)
      f.squash = key([[0, 1], [0.12, 0.93], [0.72, 0.95], [0.8, 1.06], [0.9, 1], [1, 1]], u)
      // arms flop loosely, flung out by the shake, lagging behind it
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        const lag = Math.sin(t * TAU * HZ - 1.2 + side * 0.5)
        f.arms[i] = { upper: 0.3 * env * lag, spread: 0.25 + 0.8 * env * (0.5 + 0.5 * lag * side), fore: -0.25 - 0.35 * env * (0.5 + 0.5 * lag) }
      }
      f.waggle = 0.05 + 0.45 * env
      f.waggleRate = 9
      f.fling = env
      void m
      return f
    },
  },
  wiggle: {
    label: 'dance: waggle',
    fn: (_m, t) => {
      // a bouncy happy-dog waggle: hips wag side to side on every beat with a twist, the body bounces down on the
      // beat, it sways across over four beats stepping foot to foot, hands up in the air swaying with it
      const beat = 0.44
      const b = t / beat
      const f = base()
      const bounce = Math.abs(Math.sin(Math.PI * b)) // up between beats, down on the beat
      const wag = Math.sin(TAU * b) // one wag per beat
      const sway = Math.sin((Math.PI * b) / 2) // across and back over four beats
      f.y = -0.07 + 0.06 * bounce
      f.squash = 0.94 + 0.08 * bounce
      f.roll = 0.2 * wag
      f.yaw = 0.16 * Math.sin(TAU * b + 0.9)
      f.x = 0.07 * sway
      f.pitch = 0.04 * Math.cos(TAU * b)
      f.width = 1.2
      // the foot on the side it's swaying away from lifts on alternate beats
      const step = Math.max(0, Math.sin(Math.PI * b)) * 0.05
      const leftTurn = Math.floor(b) % 2 === 0
      f.legs = [{ mode: 'plant', z: 0.01, lift: leftTurn ? step : 0 }, { mode: 'plant', z: 0.01, lift: leftTurn ? 0 : step }]
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        f.arms[i] = { upper: -2.3 + 0.15 * bounce, spread: 0.62 + 0.3 * sway * side, fore: -0.35 - 0.25 * Math.max(0, wag * side) }
      }
      f.waggle = 0.16
      f.waggleRate = 1 / beat
      return f
    },
  },
  twist: {
    label: 'dance: twist',
    fn: (_m, t) => {
      // isolations: snap the hips to one side, hold, snap to the other, hold. A little overshoot on each hit, the
      // knees pop as it lands each twist, arms counter-twist on the same hits
      const b = t / 0.5
      const bi = Math.floor(b)
      const x = b - bi
      const A = 0.42
      const from = bi % 2 ? A : -A
      const back = (v: number) => 1 + 2.7 * (v - 1) ** 3 + 1.7 * (v - 1) ** 2 // ease-out with overshoot
      const hit = x < 0.36 ? back(x / 0.36) : 1
      const yaw = from + (-from - from) * hit
      const f = base()
      f.width = 1.25
      f.yaw = yaw
      const pop = x < 0.36 ? Math.sin((Math.PI * x) / 0.36) : 0
      f.y = -0.06 - 0.035 * pop - 0.03 * (0.5 + 0.5 * Math.cos((TAU * t) / 4))
      f.roll = 0.04 * (yaw / A)
      f.squash = 1 - 0.03 * pop
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        f.arms[i] = { upper: 0.5 * side * (yaw / A), spread: 1.0, fore: -0.75 }
      }
      f.legs = [{ mode: 'plant', z: 0.025 * (yaw / A), lift: 0 }, { mode: 'plant', z: -0.025 * (yaw / A), lift: 0 }]
      f.waggle = 0.12
      f.waggleRate = 4
      return f
    },
  },
  spin: {
    label: 'dance: twirl',
    fn: (_m, t) => {
      const u = (t / 2.2) % 1
      const f = base()
      // wind up (crouch, twist back, arms across), spring into a quick ballistic hop and whip a full turn in the air
      // at full speed with the arms tucked in, land squashed and fling the arms out: ta-da
      const air0 = 0.28
      const air1 = 0.5
      f.y = key([[0, 0], [0.22, -0.13], [air0, -0.02, 'in'], [air1, 0], [0.55, -0.11, 'out'], [0.7, 0.015], [0.8, 0], [1, 0]], u)
      if (u > air0 && u < air1) {
        const x = (u - air0) / (air1 - air0)
        f.y += 0.24 * 4 * x * (1 - x)
      }
      const inAir = u > air0 && u < air1 ? Math.sin(Math.PI * (u - air0) / (air1 - air0)) : 0
      f.yaw = key([[0, 0], [0.22, -0.6], [0.3, 0.15], [0.4, 0], [1, 0]], u)
      f.spin = TAU * key([[0, 0], [0.26, 0], [air0 + 0.01, 0.05, 'in'], [air1 - 0.01, 0.95, 'lin'], [0.56, 1, 'out'], [1, 1]], u)
      f.squash = key([[0, 1], [0.22, 0.87], [0.3, 1.1], [0.46, 1.03], [0.55, 0.86, 'out'], [0.68, 1.04], [0.8, 1], [1, 1]], u)
      f.pitch = key([[0, 0], [0.22, 0.16], [0.3, -0.06], [0.5, 0], [0.55, 0.12], [0.7, -0.06], [1, 0]], u)
      f.legs = [{ mode: 'plant', z: 0, lift: 0.14 * inAir }, { mode: 'plant', z: 0, lift: 0.14 * inAir }]
      const tuck = key([[0, 0], [0.22, 0], [0.3, 1], [0.48, 1], [0.54, 0], [1, 0]], u)
      const tada = key([[0, 0], [0.5, 0], [0.58, 1], [0.84, 1], [1, 0]], u)
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        const across = key([[0, 0], [0.22, 0.5 * side], [0.3, 0], [1, 0]], u)
        f.arms[i] = { upper: -0.3 * tuck - 0.6 * tada + across, spread: 0.2 - 0.1 * tuck + 1.3 * tada, fore: -0.2 - 1.1 * tuck }
      }
      f.waggle = 0.06
      f.waggleRate = 6
      return f
    },
  },
  sit: { label: 'sit on the couch', fn: (m, t) => sitFrame(m, t, 'happy') },
  sitkick: { label: 'sit: impatient kicking', fn: (m, t) => sitFrame(m, t, 'impatient') },
  sitlazy: { label: 'sit: lazy slump', fn: (m, t) => sitFrame(m, t, 'lazy') },
  cuddle: {
    label: 'cuddle up (self hug)',
    fn: (m, t) => {
      const f = base()
      const u = (t / 5) % 1
      // legs pull up inside and the pot settles; the arms wrap round the pot with the elbows bent and out at the
      // sides (shoulders stay put, the arms stretch a little to get round) and squeeze; it rocks, snug
      const tuck = key([[0, 0], [0.12, 1], [0.9, 1], [1, 0]], u) // (how far into the hug; it stays standing)
      const rock = Math.sin(t * 1.4)
      f.roll = 0.1 * rock * tuck
      f.pitch = 0.05 * tuck
      const squeeze = 0.5 + 0.5 * Math.sin(t * 2.8)
      f.squash = 1 - 0.04 * squeeze * tuck
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        f.arms[i] = {
          upper: -0.3, spread: 0.2, fore: -0.9,
          target: onBelly(m, 0.44, 0.33 - 0.03 * squeeze, 0.0), // wrists at the front-sides, close in: hands flat on the pot either side of the middle
          w: tuck,
          pole: V(1.3, -0.15, -0.7),
          stretch: 2.2,
          bend: 0.72,
          hand: [-0.9, 0], // turn the hand so the palm lies flat on the pot
        }
      }
      f.waggle = 0.04
      return f
    },
  },
  rubhands: {
    label: 'rub hands (eager)',
    fn: (m, t) => {
      const f = base()
      // hands together in front, elbows bent and out, rubbing slowly back and forth; up on its toes with each rub
      const r = Math.sin(t * TAU * 1.4)
      f.y = 0.01 + 0.012 * Math.abs(r)
      f.pitch = 0.08
      f.roll = 0.03 * r
      for (const i of [0, 1]) {
        const side = i === 0 ? -1 : 1
        f.arms[i] = {
          upper: -0.4, spread: 0.2, fore: -0.9,
          target: onBelly(m, 0.62 + 0.045 * r * side, 0.2, 0.26), // fists pressed together in the middle (a touch of overlap is fine)
          w: 1, pole: V(1.2, -0.5, -0.5), stretch: 2.2, bend: 0.74,
        }
      }
      f.waggle = 0.06
      f.waggleRate = 2.8
      return f
    },
  },
  bellyrub: {
    label: 'rub belly (hungry)',
    fn: (m, t) => {
      const f = base()
      // belly out, one hand slowly circling the belly (elbow bent, out to the side), the other resting on the side
      const c = t * TAU * 0.45
      f.pitch = -0.1
      f.roll = 0.04 * Math.sin(c)
      f.x = 0.02 * Math.sin(c)
      f.squash = 1 + 0.01 * Math.sin(c * 2)
      f.arms = [
        { upper: 0.08 + 0.04 * Math.sin(c), spread: 0.12, fore: -0.25 }, // relaxed, down at the side
        { upper: -0.3, spread: 0.2, fore: -0.9, target: onBelly(m, 0.38 + 0.07 * Math.sin(c), 0.24 + 0.06 * Math.cos(c), 0.0), w: 1, pole: V(1.3, -0.3, -0.6), stretch: 1.8, bend: 0.76 },
      ]
      f.waggle = 0.04
      return f
    },
  },






  slide: {
    label: 'baseball slide',
    fn: (m, t) => {
      const T = 3.4
      const u = (t / T) % 1
      // run up, drop back onto the pot's bottom edge with the legs out in front, slide along the floor (slowing),
      // one arm up, then hop back up to standing
      const run = gait(GAITS.run, t)
      const r = m.pot.bottomRadius
      const lean = 0.75
      const slideF = base()
      slideF.pitch = -lean
      slideF.y = r * Math.sin(lean) + 0.01 - m.potOffset
      slideF.legs = [{ mode: 'plant', z: 0.34, lift: 0 }, { mode: 'plant', z: 0.3, lift: 0.01 }]
      slideF.arms = [{ upper: 0.7, spread: 0.5, fore: -0.3 }, { upper: -2.7, spread: 0.3, fore: -0.25 }]
      slideF.squash = 0.97
      slideF.waggle = 0.08
      slideF.leafDamp = 9
      slideF.waggleRate = 6
      const stand = base()
      // blend run -> slide -> stand -> run
      const toSlide = THREE.MathUtils.smoothstep(u, 0.3, 0.4)
      const toStand = THREE.MathUtils.smoothstep(u, 0.74, 0.86)
      let f = lerpFrame(run, slideF, toSlide)
      f = lerpFrame(f, stand, toStand)
      if (u < 0.06) f = lerpFrame(stand, run, THREE.MathUtils.smoothstep(u, 0, 0.06)) // set off again from standing
      // speed: running, then the slide bleeds it off, standing still while getting up
      const vRun = run.speed
      const x = THREE.MathUtils.clamp((u - 0.34) / 0.36, 0, 1)
      f.speed = u < 0.34 ? vRun * (u < 0.06 ? u / 0.06 : 1) : u < 0.7 ? vRun * (1 - x) ** 1.6 : 0
      // little hop up when getting back on its feet
      f.y += 0.06 * win(u, 0.76, 0.88, 0.05)
      return f
    },
  },
  hide: {
    label: 'hide in the pot',
    fn: (m, t) => {
      const T = 5.2
      const u = (t / T) % 1
      const f = base()
      // limbs sucked in, the pot drops and wobbles round like a settling top, sits still... then it shivers, springs
      // up into the air, arms and legs burst out like a starfish at the top, lands squashed and does a little ta-da
      const air0 = 0.74
      const air1 = 0.86
      const tuck = key([[0, 0], [0.1, 1, 'in'], [0.735, 1], [0.755, 0, 'out'], [1, 0]], u) // out as it takes off
      const inAir = u > air0 && u < air1
      const x = inAir ? (u - air0) / (air1 - air0) : 0
      const arc = inAir ? 4 * x * (1 - x) : 0
      f.legs = tuck > 0.02 ? [{ mode: 'tuck', amount: tuck }, { mode: 'tuck', amount: tuck }] : [{ mode: 'plant', z: 0, lift: Math.max(0, 0.38 * arc - 0.06) }, { mode: 'plant', z: 0, lift: Math.max(0, 0.38 * arc - 0.06) }]
      // grounded (legs in): the pot sits on the floor; in the air it rises from there and the legs drop out under it
      const base0 = -m.potOffset * tuck
      f.y = base0 + 0.38 * arc + key([[0, 0], [0.86, 0], [0.9, -0.1, 'out'], [0.95, 0.02], [1, 0]], u)
      const s = Math.max(0, u - 0.11) * T
      const amp = u > 0.11 && u < 0.66 ? 0.2 * Math.exp(-s * 1.6) : 0
      const ph = s * TAU * 1.6
      const shiver = win(u, 0.67, 0.74, 0.015) * Math.sin(t * TAU * 14) * 0.06
      f.roll = amp * Math.sin(ph) + shiver
      f.pitch = amp * Math.cos(ph)
      f.squash = key([[0, 1], [0.08, 1.04], [0.12, 0.9, 'out'], [0.2, 1.03], [0.28, 1], [0.67, 1], [0.725, 0.88], [0.76, 1.14], [0.82, 1.03], [0.86, 1], [0.89, 0.84, 'out'], [0.94, 1.05], [1, 1]], u)
      // arms: tucked, then flung wide and up at the top of the jump (starfish), then a ta-da
      const star = key([[0, 0], [0.735, 0], [0.775, 1], [0.86, 0.9], [0.92, 0.6], [1, 0]], u)
      for (const i of [0, 1]) f.arms[i] = { upper: -0.5 * star, spread: 0.2 + 1.7 * star, fore: -0.1, tuck: tuck }
      f.waggle = 0.03 + amp * 0.6 + 0.2 * star
      f.waggleRate = inAir ? 8 : 3
      return f
    },
  },

}

// ---------------------------------------------------------------------------------------------------------------
// Catalogue

export type MonsterAnim = keyof typeof GAITS | keyof typeof ACTIONS
export const ANIMS: { group: string; items: [string, string][] }[] = [
  { group: 'walks', items: Object.entries(GAITS).map(([k, g]) => [k, g.label]) },
  { group: 'actions', items: Object.entries(ACTIONS).map(([k, a]) => [k, a.label]) },
]

export function frameFor(m: Monster, t: number, anim: MonsterAnim, curvature = 0): Frame {
  // curvature (1/radius) x the hip's distance from the centre line = how much shorter / longer each foot's steps are
  if (anim === 'carry') {
    const f = gait(GAITS.carry, t, curvature * Math.abs(m.legs[1].hip!.x))
    // both hands hold the thing in front of the belly, a hand's width apart, bobbing with the steps
    const bob = Math.sin((2 * TAU * t) / GAITS.carry.period)
    const { hold } = podSpots(m)
    for (const i of [0, 1]) f.arms[i] = gripArm(hold.clone().add(V(0, 0.02 * bob, 0))) // the same grip as the pick up's hold
    f.held = 1
    return f
  }
  if (anim in GAITS) return gait(GAITS[anim as keyof typeof GAITS], t, curvature * Math.abs(m.legs[1].hip!.x))
  return (ACTIONS[anim] ?? ACTIONS.hop).fn(m, t)
}

// ---------------------------------------------------------------------------------------------------------------
// Applying a frame

function solveLeg(l: Limb, z: number, y: number) {
  const K = l.knee!
  const A = l.ankle!
  const L1 = K.length()
  const L2 = A.clone().sub(K).length()
  const a1 = Math.atan2(K.z, -K.y)
  const a2 = Math.atan2(A.z - K.z, -(A.y - K.y))
  const d = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-4, Math.hypot(z, y)))
  const phi = Math.atan2(z, -y)
  const hipIn = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
  const kneeIn = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1))
  const t1 = phi + hipIn // knee forward
  const t2 = t1 - (Math.PI - kneeIn)
  const thigh = -(t1 - a1)
  const shin = -(t2 - t1 - (a2 - a1))
  pose(l, 'thigh', thigh)
  pose(l, 'shin', shin)
  pose(l, 'foot', -(thigh + shin)) // sole flat on the ground
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _qp = new THREE.Quaternion()
const _s = new THREE.Vector3()
/** Position / quaternion of a bone in its limb's root space (the mirror lives on the root, so this space is unmirrored). */
function inRoot(l: Limb, o: THREE.Object3D, inv: THREE.Matrix4) {
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  _m.multiplyMatrices(inv, o.matrixWorld).decompose(p, q, _s)
  return { p, q }
}
/** Rotate bone `b` so that its child at `from` points at `to` (both in root space). */
function aim(l: Limb, b: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3, inv: THREE.Matrix4) {
  const head = inRoot(l, b, inv)
  const qb = head.q
  const qp = b.parent ? inRoot(l, b.parent, inv).q : new THREE.Quaternion()
  const d = new THREE.Quaternion().setFromUnitVectors(from.clone().sub(head.p).normalize(), to.clone().sub(head.p).normalize())
  b.quaternion.copy(_qp.copy(qp).invert().multiply(d).multiply(_q.copy(qb)))
  b.updateMatrixWorld(true)
}

/** Two-bone arm IK: move the wrist to `target` (pot space, side-normalised) with the elbow toward `pole`. */
function reach(m: Monster, l: Limb, target: THREE.Vector3, pole: THREE.Vector3, w: number, stretch = 1, bend = 0.97, clear = true) {
  const up = l.bones.upper
  const fore = l.bones.fore
  const hand = l.bones.hand
  if (!up || !fore || !hand || w <= 0) return
  // remember the FK pose: the result is blended from it by w (rotation by rotation), so a partial reach is a true
  // in-between pose, never the solver's elbow at a small weight (that was the pop)
  const qUp0 = up.quaternion.clone()
  const qFore0 = fore.quaternion.clone()
  l.root.updateMatrixWorld(true)
  const inv = l.root.matrixWorld.clone().invert()
  const toRoot = (v: THREE.Vector3) => new THREE.Vector3(v.x * l.side, v.y, v.z).applyMatrix4(m.pot.group.matrixWorld).applyMatrix4(inv)
  const Tfull = toRoot(target)
  // rubber-hose stretch: lengthen the forearm and upper arm (move the elbow and wrist joints down their bones) just
  // enough to reach, blended in with the reach weight; the shoulder stays where it is
  if (stretch > 1) {
    const S0 = inRoot(l, up, inv).p
    const L = inRoot(l, fore, inv).p.distanceTo(S0) + inRoot(l, hand, inv).p.distanceTo(inRoot(l, fore, inv).p)
    const k = 1 + (THREE.MathUtils.clamp(Tfull.distanceTo(S0) / (L * bend), 1, stretch) - 1) * w
    fore.position.copy(fore.userData.p0).multiplyScalar(k)
    hand.position.copy(hand.userData.p0).multiplyScalar(k)
    l.root.updateMatrixWorld(true)
  }
  const S = inRoot(l, up, inv).p
  const E = inRoot(l, fore, inv).p
  const W = inRoot(l, hand, inv).p
  const T = Tfull.clone()
  // keep the wrist reachable and outside the pot: pull it into the arm's reach, and if that lands inside the pot
  // (short arms on a big belly), slide it out to the surface; repeat so both hold
  {
    const r2p = m.pot.group.matrixWorld.clone().invert().multiply(l.root.matrixWorld)
    const p2r = r2p.clone().invert()
    const reachMax = (E.distanceTo(S) + W.distanceTo(E)) * 0.97
    for (let k = 0; k < (clear ? 4 : 1); k++) {
      const off = T.clone().sub(S)
      if (off.length() > reachMax) T.copy(S).addScaledVector(off.normalize(), reachMax)
      const tp = T.clone().applyMatrix4(r2p)
      const r = Math.hypot(tp.x, tp.z)
      const need = m.pot.radiusAt(THREE.MathUtils.clamp(tp.y, 0, m.pot.height)) + 0.09
      if (!clear || tp.y < -0.05 || tp.y > m.pot.height + 0.05 || r >= need) break
      tp.x *= need / Math.max(1e-4, r)
      tp.z *= need / Math.max(1e-4, r)
      T.copy(tp.applyMatrix4(p2r))
    }
  }
  const shoulderPot = l.root.position.clone()
  const P = toRoot(new THREE.Vector3(shoulderPot.x * l.side, shoulderPot.y, shoulderPot.z).add(pole))
  const L1 = E.distanceTo(S)
  const L2 = W.distanceTo(E)
  const dir = T.clone().sub(S)
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4)
  dir.normalize()
  const v = P.clone().sub(S)
  v.addScaledVector(dir, -v.dot(dir)).normalize()
  const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
  // keep the elbow outside the pot: if it would end up inside the wall, swing it round the shoulder-target line toward
  // the outside until it clears (a few steps)
  const rootToPot = m.pot.group.matrixWorld.clone().invert().multiply(l.root.matrixWorld)
  const potToRoot = rootToPot.clone().invert()
  let E2 = S.clone().addScaledVector(dir, L1 * Math.cos(a)).addScaledVector(v, L1 * Math.sin(a))
  for (let k = 0; k < (clear ? 6 : 0); k++) {
    const ep = E2.clone().applyMatrix4(rootToPot)
    const r = Math.hypot(ep.x, ep.z)
    const need = m.pot.radiusAt(THREE.MathUtils.clamp(ep.y, 0, m.pot.height)) + 0.07
    if (ep.y < 0 || ep.y > m.pot.height + 0.05 || r >= need) break
    const outPot = new THREE.Vector3(ep.x, 0, ep.z).normalize().multiplyScalar(need - r + 0.02).add(ep)
    const out = outPot.applyMatrix4(potToRoot).sub(S)
    out.addScaledVector(dir, -out.dot(dir)).normalize()
    v.lerp(out, 0.6).normalize()
    E2 = S.clone().addScaledVector(dir, L1 * Math.cos(a)).addScaledVector(v, L1 * Math.sin(a))
  }
  aim(l, up, E, E2, inv)
  const E3 = inRoot(l, fore, inv).p
  const W3 = inRoot(l, hand, inv).p
  aim(l, fore, W3, S.clone().addScaledVector(dir, d), inv)
  void E3
  if (w < 1) {
    up.quaternion.copy(qUp0.slerp(up.quaternion.clone(), w))
    fore.quaternion.copy(qFore0.slerp(fore.quaternion.clone(), w))
    l.root.updateMatrixWorld(true)
  }
}

const _w = new THREE.Vector3()
/** Is the arm's elbow or wrist inside the pot (with a skin margin)? */
function inPot(m: Monster, l: Limb) {
  l.root.updateMatrixWorld(true)
  // (measured on the joints; the margin covers the arm's thickness)
  for (const b of [l.bones.fore, l.bones.hand]) {
    if (!b) continue
    const p = m.pot.group.worldToLocal(b.getWorldPosition(_w))
    // only joints below the shoulder can be in the wall (raised arms are up over the rim, opening them more would
    // swing them over the top)
    if (p.y > 0 && p.y < l.root.position.y && Math.hypot(p.x, p.z) < m.pot.radiusAt(p.y) + 0.04) return true
  }
  return false
}

/** Squash & stretch the pot meshes about the base (not the arms); plant and arms ride the rim. */
function squashPot(m: Monster, k: number) {
  for (const c of m.pot.group.children) {
    if (c === m.socket || m.arms.some((l) => l.root === c) || c.userData.fx) continue
    c.scale.set(1 + (1 - k) * 0.6, k, 1 + (1 - k) * 0.6)
    const y0: number = (c.userData.y0 ??= c.position.y) // the soil sits up at the rim: keep it there
    c.position.y = y0 * k
  }
  m.socket.position.y = m.pot.soilY * k
  for (const l of m.arms) l.root.position.y = (l.root.userData.y0 ??= l.root.position.y) * k
}

// --- props --------------------------------------------------------------------------------------------------------

/** The seed pod's size (x the base model) and its resting height on the floor (its radius). */
const POD_SCALE = 2
const POD_REST = 0.075 * 0.85 * POD_SCALE

interface Fx { hang?: { key: string; on: THREE.Group; hook: THREE.Group }; couch: THREE.Group; sweat: THREE.Mesh[]; drops: THREE.Mesh[]; thing: THREE.Group; ground: THREE.Vector3 | null }
function fx(m: Monster): Fx {
  if (m.group.userData.fx) return m.group.userData.fx as Fx
  const couch = new THREE.Group()
  const fabric = new THREE.MeshStandardMaterial({ color: '#8fb1b8', roughness: 0.95 })
  const fabric2 = new THREE.MeshStandardMaterial({ color: '#7a9da5', roughness: 0.95 })
  const seat = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.3, 1.0, 3, 0.08), fabric)
  seat.name = 'seat'
  const back = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.75, 0.28, 3, 0.1), fabric2)
  back.name = 'back'
  couch.add(seat, back)
  couch.visible = false
  m.group.add(couch)
  const dropGeo = new THREE.SphereGeometry(0.045, 10, 8)
  dropGeo.translate(0, 0.018, 0)
  const water = new THREE.MeshStandardMaterial({ color: '#9ad4f0', roughness: 0.15, transparent: true, opacity: 0.85 })
  const sweat = [0, 1].map((i) => {
    const d = new THREE.Mesh(dropGeo, water)
    d.scale.set(0.8, 1.25, 0.8)
    d.userData.fx = true
    d.position.set(i ? -0.12 : 0.1, m.pot.height - 0.06 - i * 0.03, m.pot.rimRadius + 0.02)
    m.pot.group.add(d)
    return d
  })
  const drops = Array.from({ length: 10 }, () => {
    const d = new THREE.Mesh(dropGeo, water)
    d.visible = false
    m.group.add(d)
    return d
  })
  // the held thing: a round seed pod with a little sprout
  const thing = new THREE.Group()
  const pod = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: '#f1e3b4', roughness: 0.7 })) // pale, so it reads against any pot
  pod.scale.set(1, 0.85, 1)
  const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: '#6fae5c', roughness: 0.7 }))
  sprout.scale.set(0.7, 1.5, 0.7)
  sprout.position.set(0.015, 0.075, 0)
  sprout.rotation.z = -0.4
  thing.add(pod, sprout)
  thing.visible = false
  m.group.add(thing)
  const out = { couch, sweat, drops, thing, ground: null as THREE.Vector3 | null }
  m.group.userData.fx = out
  return out
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function applyFx(m: Monster, f: Frame, t: number) {
  const e = fx(m)
  // the hanging planter: hanger + rope ride on the pot (they swing with it), the hook stays on the ceiling
  const hs = hangSetup(m)
  const key = `${f.hang}:${hs.rope}`
  if (f.hang && e.hang?.key !== key) {
    if (e.hang) (m.pot.group.remove(e.hang.on), m.group.remove(e.hang.hook))
    const on = new THREE.Group()
    const H = m.pot.height
    const hg = hanger(f.hang, { ...m.pot, group: m.pot.group }, HANG.top)
    const r = rope(hs.rope)
    r.position.y = H + HANG.top + hs.rope
    on.add(hg, r)
    on.userData.fx = true
    m.pot.group.add(on)
    const hook = ceilingHook()
    hook.position.y = HANG.base + H + HANG.top + hs.rope + 0.17
    m.group.add(hook)
    e.hang = { key, on, hook }
  }
  if (e.hang) e.hang.on.visible = e.hang.hook.visible = !!f.hang
  // held thing: between the fists while held, otherwise resting on the ground where it gets picked up
  e.thing.visible = f.held !== undefined
  if (f.held !== undefined) {
    const mid = fistCenter(m, m.arms[0]).add(fistCenter(m, m.arms[1])).multiplyScalar(0.5) // locked between the fists
    const ground = podSpots(m).rest
    e.thing.position.copy(ground).lerp(mid, THREE.MathUtils.clamp(f.held, 0, 1))
    e.thing.scale.setScalar(POD_SCALE)
  }
  // couch: seat under the pot, front edge at the hips, back rest behind
  e.couch.visible = f.couch !== undefined
  if (f.couch !== undefined) {
    const h = f.couch
    const seat = e.couch.getObjectByName('seat') as THREE.Mesh
    const back = e.couch.getObjectByName('back') as THREE.Mesh
    const depth = 1.0
    seat.position.set(0, h / 2, f.hipZ - depth / 2 - 0.04) // front edge just behind the hips
    back.position.set(0, h + 0.3, f.hipZ - depth + 0.1)
  }
  for (const d of e.sweat) d.visible = (f.sweat ?? 0) > 0.05
  for (const d of e.sweat) d.scale.setScalar(Math.max(0.01, f.sweat ?? 0)).multiply(V(0.8, 1.25, 0.8))
  // flung drops: little arcs off the pot while shaking / flicking
  const fl = f.fling ?? 0
  e.drops.forEach((d, i) => {
    const life = 0.6
    const ph = (t / life + hash(i)) % 1
    d.visible = fl > 0.15
    if (!d.visible) return
    const a = hash(i + 7) * TAU
    const r = m.pot.rimRadius + ph * 0.7
    d.position.set(Math.cos(a) * r, m.potOffset + m.pot.height * (0.6 + 0.3 * hash(i + 3)) + ph * 0.3 - ph * ph * 0.9, Math.sin(a) * r)
    d.scale.setScalar((1 - ph) * fl)
  })
}

// --- leaves -------------------------------------------------------------------------------------------------------

/**
 * Leaves with follow-through: each leaf stem is a damped spring driven by the pot's motion (they lag when it lurches,
 * bounce after landings, trail behind spins) plus a gentle living sway (`f.waggle`, `f.waggleRate`).
 */
interface LeafState { t: number; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; springs: Map<THREE.Object3D, number[]> }
function waggle(m: Monster, f: Frame, t: number) {
  const st: LeafState = (m.group.userData.leaf ??= { t, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, springs: new Map() })
  m.socket.updateMatrixWorld(true)
  const pos = new THREE.Vector3().setFromMatrixPosition(m.socket.matrixWorld)
  const q = new THREE.Quaternion()
  m.socket.getWorldQuaternion(q)
  const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
  let dt = t - st.t
  const reset = dt <= 0 || dt > 0.1
  if (reset) dt = 1 / 60
  const vel = reset ? st.vel.clone() : pos.clone().sub(st.pos).divideScalar(dt)
  const acc = reset ? new THREE.Vector3() : vel.clone().sub(st.vel).divideScalar(dt)
  let dyaw = yaw - st.yaw
  dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
  const yawRate = reset ? 0 : dyaw / dt
  st.t = t
  st.pos.copy(pos)
  st.vel.copy(vel)
  st.yaw = yaw
  // acceleration in the socket's frame: leaves tip against it (inertia)
  const local = acc.clone().applyQuaternion(q.clone().invert())
  const still = dt === 1 / 60 && reset
  let k = 0
  for (const holder of m.socket.children)
    for (const plant of holder.children)
      for (const part of plant.children) {
        const q0: THREE.Quaternion = (part.userData.q0 ??= part.quaternion.clone())
        const p = k++ * 1.7
        const sp = st.springs.get(part) ?? [0, 0, 0, 0, 0, 0]
        // stiffer and faster for small parts, slower and floppier for big ones: vary by index
        const stiff = 90 + 50 * Math.sin(p * 2.3) ** 2
        const damp = f.leafDamp ?? 4.5
        const sway = [f.waggle * Math.sin(t * f.waggleRate * 2.1 + p * 0.7), f.waggle * 0.7 * Math.sin(t * f.waggleRate * 1.6 + p * 1.3), 0]
        const drive = [THREE.MathUtils.clamp(-local.z * 0.012, -0.5, 0.5) + THREE.MathUtils.clamp(local.y * 0.01, -0.4, 0.4) * (0.6 + 0.4 * Math.sin(p)), THREE.MathUtils.clamp(local.x * 0.012, -0.5, 0.5), THREE.MathUtils.clamp(-yawRate * 0.06, -0.6, 0.6)]
        if (!still)
          for (let a = 0; a < 3; a++) {
            const target = sway[a] + drive[a]
            const accA = stiff * (target - sp[a]) - damp * sp[3 + a]
            sp[3 + a] += accA * dt
            sp[a] += sp[3 + a] * dt
            sp[a] = THREE.MathUtils.clamp(sp[a], -0.7, 0.7)
          }
        st.springs.set(part, sp)
        part.quaternion.copy(q0).premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sp[0], sp[2], sp[1])))
      }
}

/**
 * Pose the monster for time `t` (seconds) and return its travel speed (pot units / s): move the monster forward (+Z) at
 * that speed and its planted feet stay put. `curvature` (1 / turn radius, toward +X) keeps feet planted on curves.
 */
export function poseMonster(m: Monster, t: number, anim: MonsterAnim, curvature = 0): number {
  return applyPose(m, t, anim, curvature)
}

function applyPose(m: Monster, t: number, anim: MonsterAnim, curvature: number): number {
  const f = frameFor(m, t, anim, curvature)
  const pg = m.pot.group
  m.group.rotation.y = f.spin
  pg.position.set(f.x, m.potOffset + f.y, f.z)
  pg.rotation.set(f.pitch, f.yaw, f.roll, 'YXZ')
  pg.updateMatrix()
  pg.updateMatrixWorld(true)
  squashPot(m, f.squash)
  // legs
  const hip = new THREE.Vector3()
  m.legs.forEach((l, i) => {
    const lf = f.legs[i]
    const side = l.side
    hip.copy(l.hip!).add(V(0, 0, f.hipZ)).applyMatrix4(pg.matrix)
    l.root.position.copy(hip)
    l.root.rotation.set(0, 0, 0)
    l.root.scale.set(side, 1, 1)
    if (lf.mode === 'tuck') {
      // pull the leg up into the pot: shrink and rise (the pot's closed base hides it)
      const r = lf.amount
      l.root.scale.set(side * (1 - 0.6 * r), 1 - 0.85 * r, 1 - 0.6 * r)
      l.root.position.y += 0.06 * r
      for (const b of ['thigh', 'shin', 'foot']) pose(l, b, 0)
      return
    }
    if (lf.mode === 'fk') {
      // follow the pot's lean so the legs stay attached naturally
      l.root.rotation.set(f.pitch, 0, 0)
      pose(l, 'thigh', lf.thigh, lf.splay ?? 0)
      pose(l, 'shin', lf.shin)
      pose(l, 'foot', lf.foot)
      return
    }
    const restX = l.hip!.x * f.width + (lf.x ?? 0)
    const H = hip.y
    const roll = -Math.atan2(hip.x - restX, H)
    l.root.rotation.z = roll
    const ankleH = m.legDrop + l.ankle!.y
    solveLeg(l, lf.z + l.ankle!.z - hip.z, -(H / Math.cos(roll) - ankleH - lf.lift))
  })
  // arms: FK, then optionally reach toward a target
  pg.updateMatrixWorld(true)
  m.arms.forEach((l, i) => {
    const a = f.arms[i]
    // shoulders stay put on the pot (they ride its squash); joints back to their rest lengths before any stretch
    const p0: THREE.Vector3 = (l.root.userData.p0 ??= l.root.position.clone())
    const tk = a.tuck ?? 0
    // tucked arms shrink and pull in through the wall (the pot hides them)
    l.root.position.set(p0.x * (1 - 0.35 * tk), p0.y * f.squash, p0.z)
    l.root.rotation.set(0, 0, 0)
    l.root.scale.set(l.side * (1 - 0.85 * tk), 1 - 0.85 * tk, 1 - 0.85 * tk)
    for (const b of [l.bones.fore, l.bones.hand]) if (b) b.position.copy((b.userData.p0 ??= b.position.clone())).multiplyScalar(a.len ?? 1)
    l.root.updateMatrixWorld(true)
    pose(l, 'upper', a.upper, -(m.armLift + a.spread))
    pose(l, 'fore', a.fore)
    pose(l, 'hand', 0)
    // swinging arms never pass through the pot: open the arm out a little at a time until elbow and hand clear it
    if ((!a.target || (a.w ?? 1) < 0.5) && tk < 0.05 && !f.noClear) {
      if (inPot(m, l)) {
        // smallest extra opening that clears the pot (bisection: changes smoothly from frame to frame, no pops)
        let lo = 0
        let hi = 1.2
        for (let k = 0; k < 9; k++) {
          const mid = (lo + hi) / 2
          pose(l, 'upper', a.upper, -(m.armLift + a.spread + mid))
          if (inPot(m, l)) lo = mid
          else hi = mid
        }
        pose(l, 'upper', a.upper, -(m.armLift + a.spread + hi))
      }
    }
    if (a.fromRest && (a.w ?? 1) > 0.001) {
      l.root.updateMatrixWorld(true)
      const wp = m.pot.group.worldToLocal(l.bones.hand.getWorldPosition(new THREE.Vector3()))
      a.target = a.fromRest(V(wp.x * l.side, wp.y, wp.z))
    }
    if (a.target && (a.w ?? 1) > 0.001) {
      // body-space targets -> the pot's space (side-normalised x both ways)
      const toPot = (v: THREE.Vector3) => {
        const g = m.group.localToWorld(V(v.x * l.side, v.y, v.z))
        const p = m.pot.group.worldToLocal(g)
        return V(p.x * l.side, p.y, p.z)
      }
      const want = a.body ? toPot(a.target) : a.target.clone()
      let aim = want.clone()
      reach(m, l, aim, a.pole ?? V(0.4, -0.2, -0.6), a.w ?? 1, a.stretch ?? 1, a.bend ?? 0.97, !f.noClear)
      if (a.fist) {
        // aim the fist, not the wrist: shift the target by the wrist-to-fist offset and solve again (converges fast)
        for (let k = 0; k < 2; k++) {
          const w0 = m.group.worldToLocal(l.bones.hand.getWorldPosition(new THREE.Vector3()))
          const off = fistCenter(m, l).sub(w0)
          const wp = toPot(V(w0.x * l.side, w0.y, w0.z))
          const fp = toPot(V((w0.x + off.x) * l.side, w0.y + off.y, w0.z + off.z))
          aim = want.clone().sub(fp.sub(wp))
          pose(l, 'upper', a.upper, -(m.armLift + a.spread))
          pose(l, 'fore', a.fore)
          pose(l, 'hand', 0)
          for (const bn of [l.bones.fore, l.bones.hand]) if (bn) bn.position.copy(bn.userData.p0)
          reach(m, l, aim, a.pole ?? V(0.4, -0.2, -0.6), a.w ?? 1, a.stretch ?? 1, a.bend ?? 0.97, !f.noClear)
        }
      }
    }
    if (a.hand) pose(l, 'hand', a.hand[0] * (a.w ?? 1), a.hand[1] * (a.w ?? 1))
  })
  applyFx(m, f, t)
  waggle(m, f, t)
  return f.speed
}
