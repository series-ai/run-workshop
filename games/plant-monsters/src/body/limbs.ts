import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { BuiltPot } from './pots'
import { skinMaterial, type SkinPattern } from './skinPattern'

/**
 * The monster's body: the pot is the torso; legs come out of the bottom, arms out of the sides.
 * Each limb is one smooth rigged mesh (scripts/limbs_blender.py): arm = upper -> fore -> hand (a fist), leg = thigh ->
 * shin -> foot (nub toes). Limbs are the same size on every pot so the character stays consistent; each pot only gives
 * the anchor points (shoulders on its wall, hips under its base). Right-side meshes; the left side is mirrored.
 * Units are pot units (kit scale: the Classic Pot is ~0.66 tall).
 */

export interface BodyParts {
  arm: THREE.Object3D
  leg: THREE.Object3D
  /** Hip to sole, and shoulder to fist tip, in the rest pose. */
  legDrop: number
  armDrop: number
}

export interface BodyOptions {
  skin?: string
  /** Length multipliers (1 = default): legs stretch thigh + shin, arms stretch upper arm + forearm. */
  legLength?: number
  armLength?: number
  /** Two-colour skin pattern on the limbs (see skinPattern.ts), its colour, coverage 0..1 and a seed. */
  pattern?: SkinPattern
  patternColor?: string
  patternAmount?: number
  seed?: number
  /** Mix and match: a different marking (and colour) per limb, overriding `pattern` / `patternColor`. */
  limbs?: Partial<Record<LimbName, { pattern?: SkinPattern; color?: string }>>
}

export type LimbName = 'armL' | 'armR' | 'legL' | 'legR'

export interface Limb {
  root: THREE.Object3D
  bones: Record<string, THREE.Bone>
  rest: Record<string, THREE.Quaternion>
  side: number
  /** Legs: rest joint positions in the limb's own space (hip at the origin), for the knee solver. */
  knee?: THREE.Vector3
  ankle?: THREE.Vector3
  /** Legs: where the top of the leg is pinned, in the pot's space. */
  hip?: THREE.Vector3
  /** How much further down the end of the limb reaches after stretching (rest pose). */
  stretch: number
}

export interface Monster {
  group: THREE.Group
  pot: BuiltPot
  /** Where the pot's base sits inside `group`. */
  potOffset: number
  arms: Limb[]
  legs: Limb[]
  /** Outward lift of the arms (radians) chosen so the hands end at knee height on this pot. */
  armLift: number
  /** Plant socket on the soil, riding on the pot: put the plant in here and it bobs, leans and waggles with the body. */
  socket: THREE.Group
  /** Hip to sole in the rest pose (after any stretching). */
  legDrop: number
}

/** Hip sits this far up inside the pot's base. */
const HIP_IN = 0.04
/** Fist tip height above the ground (about the knees, like the concept). */
const FIST_HEIGHT = 0.2

const partsPromises = new Map<string, Promise<BodyParts>>()
/** Load the rigged arm + leg from `base` (default set; '/assets/body/skin' = the clean-topology build). */
export function loadBodyParts(base = '/assets/body'): Promise<BodyParts> {
  let partsPromise = partsPromises.get(base)
  partsPromise ??= (async () => {
    const loader = new GLTFLoader()
    const load = async (url: string, darkTop: number) => {
      const root = (await loader.loadAsync(url)).scene
      root.traverse((o) => {
        const m = o as THREE.SkinnedMesh
        if (!m.isSkinnedMesh) return
        // soft shading like the pots: darker up under the pot, lighter toward the hands and feet
        const g = m.geometry
        const p = g.getAttribute('position')
        const c = new Float32Array(p.count * 3)
        for (let i = 0; i < p.count; i++) {
          const k = 0.8 + 0.25 * THREE.MathUtils.smoothstep(-p.getY(i) / darkTop, 0, 1) // spread over the whole limb: no banding
          c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k
        }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3))
        m.frustumCulled = false
      })
      const box = new THREE.Box3().setFromObject(root)
      return { root, drop: -box.min.y }
    }
    const [arm, leg] = await Promise.all([load(`${base}/arm.glb`, 0.6), load(`${base}/leg.glb`, 0.45)])
    return { arm: arm.root, leg: leg.root, armDrop: arm.drop, legDrop: leg.drop }
  })()
  partsPromises.set(base, partsPromise)
  return partsPromise
}

/**
 * Clone a rigged limb, optionally stretching its two long segments (k1: thigh / upper arm, k2: shin / forearm).
 * The stretch is done in the rest pose: every vertex slides down the chain by how far along each segment it sits, the
 * joints move with it, and the skeleton is re-bound. So the segment lengthens evenly (no squashed joints) and bending,
 * walking and the knee solver all keep working on the new proportions.
 */
function makeLimb(src: THREE.Object3D, side: number, mat: THREE.Material, k1 = 1, k2 = 1): Limb {
  const root = SkeletonUtils.clone(src)
  const bones: Record<string, THREE.Bone> = {}
  const rest: Record<string, THREE.Quaternion> = {}
  let mesh: THREE.SkinnedMesh | null = null
  const chain: THREE.Bone[] = []
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bones[o.name] = o as THREE.Bone
      rest[o.name] = o.quaternion.clone()
      chain.push(o as THREE.Bone)
    }
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh = o as THREE.SkinnedMesh
      mesh.material = mat
    }
  })
  let stretch = 0
  if (mesh && (k1 !== 1 || k2 !== 1) && chain.length >= 3) {
    const m = mesh as THREE.SkinnedMesh
    root.updateMatrixWorld(true)
    const [b0, b1, b2] = chain // depth-first: top bone, middle, end
    const toMesh = m.matrixWorld.clone().invert()
    const P0 = b0.getWorldPosition(new THREE.Vector3())
    const P1 = b1.getWorldPosition(new THREE.Vector3())
    const P2 = b2.getWorldPosition(new THREE.Vector3())
    const d1 = P1.clone().sub(P0).multiplyScalar(k1 - 1)
    const d2 = P2.clone().sub(P1).multiplyScalar(k2 - 1)
    stretch = -(d1.y + d2.y)
    // stretch the mesh (in its own space)
    const p0 = P0.clone().applyMatrix4(toMesh)
    const p1 = P1.clone().applyMatrix4(toMesh)
    const p2 = P2.clone().applyMatrix4(toMesh)
    const m1 = d1.clone().transformDirection(toMesh).multiplyScalar(d1.length())
    const m2 = d2.clone().transformDirection(toMesh).multiplyScalar(d2.length())
    const s1 = p1.clone().sub(p0)
    const s2 = p2.clone().sub(p1)
    m.geometry = m.geometry.clone()
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const t1 = THREE.MathUtils.clamp(v.clone().sub(p0).dot(s1) / s1.lengthSq(), 0, 1)
      const t2 = THREE.MathUtils.clamp(v.clone().sub(p1).dot(s2) / s2.lengthSq(), 0, 1) * (t1 > 0.999 ? 1 : 0)
      v.addScaledVector(m1, t1).addScaledVector(m2, t2)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    pos.needsUpdate = true
    m.geometry.computeBoundingSphere()
    // move the joints and re-bind the skeleton to the new rest pose
    b1.position.copy(b0.worldToLocal(P1.clone().add(d1)))
    b1.updateMatrixWorld(true)
    b2.position.copy(b1.worldToLocal(P2.clone().add(d1).add(d2)))
    root.updateMatrixWorld(true)
    m.skeleton.calculateInverses()
    m.bind(m.skeleton, m.matrixWorld)
  }
  // left side: mirror (three flips the face winding for negative scale, so it still shades correctly)
  if (side < 0) root.scale.x = -1
  // rest joint positions (legs use them for the knee solver)
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const at = (n: string) => (bones[n] ? bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : undefined)
  const knee = at('shin')
  const ankle = at('foot')
  // big chunky fists and feet, like the concept (scaled about the wrist / ankle)
  bones.hand?.scale.setScalar(1.3)
  bones.foot?.scale.setScalar(1.12)
  return { root, bones, rest, side, knee, ankle, stretch }
}

/** Rotate a bone away from its rest pose by Euler angles in its own frame. */
export function pose(l: Limb, bone: string, x: number, z = 0) {
  const b = l.bones[bone]
  if (!b) return
  b.quaternion.copy(l.rest[bone]).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z)))
}

export function buildMonster(pot: BuiltPot, parts: BodyParts, opts: BodyOptions = {}): Monster {
  // one material per limb so each gets its own patch of the pattern (left and right don't mirror each other)
  const seed = opts.seed ?? 0
  const NAMES: LimbName[] = ['legL', 'legR', 'armL', 'armR']
  const mat = (k: number) => {
    const own = opts.limbs?.[NAMES[k]]
    return skinMaterial({
      skin: opts.skin ?? '#8fae8c',
      pattern: own?.pattern ?? opts.pattern,
      patternColor: own?.color ?? opts.patternColor,
      amount: opts.patternAmount,
      seed: seed * 4 + k,
    })
  }
  const kL = opts.legLength ?? 1
  const kA = opts.armLength ?? 1
  const group = new THREE.Group()

  // legs: the top of each leg is pinned just inside the pot's base (they ride with the pot: bob, sway, lean), spaced to
  // the pot's foot; the knees take up the difference to the ground
  const hipX = THREE.MathUtils.clamp(pot.bottomRadius * 0.45, 0.13, 0.2)
  const legs = [-1, 1].map((side, i) => makeLimb(parts.leg, side, mat(i), kL, kL))
  // hip to sole after stretching (the ankle moved down by the stretch)
  const legDrop = parts.legDrop + legs[0].stretch
  const potOffset = legDrop - HIP_IN
  pot.group.position.y = potOffset
  group.add(pot.group)
  legs.forEach((l, i) => {
    const side = i === 0 ? -1 : 1
    l.hip = new THREE.Vector3(side * hipX, HIP_IN, 0) // in the pot's space
    l.root.position.set(side * hipX, legDrop, 0)
    group.add(l.root)
  })

  // arms: the shoulder sits well inside the wall at ~60% height (lower on shallow pots) and the arm flares out, so the
  // hands hang clear of the pot; the arm lifts further as needed so the hands end at knee height on any pot.
  // Arms are children of the pot so they ride along with its bob, rock and lean.
  const arms = [-1, 1].map((side, i) => makeLimb(parts.arm, side, mat(2 + i), kA, kA))
  const armDrop = parts.armDrop + arms[0].stretch
  const yS = Math.min(pot.height * 0.6, pot.height - 0.08)
  const rS = pot.radiusAt(yS)
  // longer arms hang lower (by their extra length) instead of lifting out; they only lift to clear the ground
  const drop = potOffset + yS - Math.max(0.05, FIST_HEIGHT - arms[0].stretch)
  // capped: on very shallow pots (the bowl) the hands may hang a bit lower rather than the arms going out like wings
  const armLift = drop >= armDrop ? 0 : Math.min(0.45, Math.acos(THREE.MathUtils.clamp(drop / armDrop, 0.2, 1)))
  arms.forEach((l, i) => {
    const side = i === 0 ? -1 : 1
    l.root.position.set(side * (rS - 0.06), yS, -0.01)
    l.root.userData.limb = true // not part of the pot (props that fit the pot's surface skip these)
    pot.group.add(l.root)
  })
  const socket = new THREE.Group()
  socket.position.y = pot.soilY
  socket.userData.limb = true
  pot.group.add(socket)
  const m: Monster = { group, pot, potOffset, arms, legs, armLift, socket, legDrop }
  return m
}
