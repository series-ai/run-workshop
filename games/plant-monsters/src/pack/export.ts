import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { loadKit, Tot, type Kit, type Species, type TotOptions } from '../promo/kit'
import type { MonsterAnim } from '../body/anims'
import { buildPot, POTS } from '../body/pots'
import { PROPS } from '../props/props'
import { MEMBERS, look, age, SIZE } from './cast'
import { bakeLimbs, bakeTints } from './bake'
import { mergeMeshes } from './merge'

/**
 * The Terra Tots pack exporter (pack/index.html). Builds every character, bakes every procedural clip into keyframe
 * tracks (nodes and limb bones, the leaves' follow-through, and the props a clip uses, shown and hidden by scale),
 * bakes the shader-only looks into textures, merges the meshes (one skinned mesh per material, each original mesh a
 * bone) and posts each GLB to pack/server.py. Also exports every pot in every colourway, the props and the pests.
 *
 *   ?only=characters|pots|props   ?name=<file stem>   (defaults to everything)
 *
 * Run it in Chrome on the GPU (headless: --use-angle=metal --enable-gpu): the limb markings' noise comes out different on
 * the software renderer.
 */

const Q = new URLSearchParams(location.search)
const SAVE = Q.get('save') ?? 'http://127.0.0.1:8798'
const FPS = 30
const log = (s: string) => {
  document.body.insertAdjacentHTML('beforeend', `<div>${s}</div>`)
  console.log(s)
}

/** Every clip and its length (seconds): whole cycles, so looping clips loop cleanly. One-shots play once. */
const CLIPS: [MonsterAnim, number, boolean][] = [
  // [anim, seconds, loops]
  ['idle', 3.2, true], ['walk', 1.3, true], ['waddle', 0.95, true], ['scamper', 0.96, true], ['strut', 1.15, true],
  ['sneak', 1.8, true], ['lurch', 2.3, true], ['trudge', 1.9, true], ['run', 0.88, true], ['carry', 1.4, true],
  ['hop', 1.9, true], ['hops', 3.2, true], ['shake', 2.6, true], ['wiggle', 1.76, true], ['twist', 2.0, true],
  ['spin', 2.2, true], ['cuddle', 5, true], ['rubhands', 2.857, true], ['bellyrub', 2.222, true], ['slide', 3.4, true],
  ['hide', 5.2, true], ['pickup', 5.2, true], ['sit', 7.854, true], ['sitkick', 7.854, true], ['sitlazy', 6.981, true],
  ['scruffup', 1.7, false], ['scruff', 5.0, true], ['scruffdown', 4.0, false], ['swing', 0, true],
]

/** The ten cast members plus the uncast plants, each with a pot and limbs. */
interface Character { file: string; o: TotOptions }
const EXTRAS: [Species, string, string, number][] = [
  // species, file, pot, colourway
  ['albo', 'monstera-albo', 'pinstripe', 1], ['whitefusion', 'calathea-white-fusion', 'belly', 0], ['frydek', 'alocasia-frydek-variegata', 'scales', 0],
  ['zzvar', 'zz-variegata', 'hex', 0], ['pothos', 'marble-queen-pothos', 'crackle', 1], ['cebu', 'cebu-blue-pothos', 'egg', 2],
  ['neon', 'neon-pothos', 'wavy', 2], ['blackvelvet', 'alocasia-black-velvet', 'gem', 3], ['cylindrical', 'cylindrical-snake-plant', 'cylinder', 1],
  ['snake', 'snake-plant', 'speckle', 0], ['peacelily', 'peace-lily', 'classic', 0], ['bop', 'bird-of-paradise', 'tulip', 0], ['zz', 'zz-plant', 'ribbed', 2],
]
const CHARACTERS: Character[] = [
  ...MEMBERS.map((m, k) => ({ file: m.name.toLowerCase(), o: { species: m.sp, age: age(m.sp), ...m.o, seed: k + 11 } })),
  ...EXTRAS.map(([sp, file, pot, cw], k) => ({ file, o: { species: sp, age: age(sp), size: SIZE[sp] ?? 1, ...look(k + 3), pot, cw, seed: k + 40 } })),
]

// ------------------------------------------------------------------ baking
interface Sample { p: Float32Array; q: Float32Array; s: Float32Array }

/** Pose the tot at clip time t (with its leaves' follow-through), making sure hidden props read as scale 0. */
function nodesOf(root: THREE.Object3D) {
  const out: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o !== root) out.push(o)
  })
  return out
}
function visibleInTree(o: THREE.Object3D, root: THREE.Object3D) {
  for (let x: THREE.Object3D | null = o; x && x !== root; x = x.parent) if (!x.visible) return false
  return true
}

function record(tot: Tot, nodes: THREE.Object3D[], anim: MonsterAnim, dur: number, loops: boolean): Sample[] {
  const n = Math.max(2, Math.round(dur * FPS) + 1)
  const frames: Sample[] = nodes.map(() => ({ p: new Float32Array(n * 3), q: new Float32Array(n * 4), s: new Float32Array(n * 3) }))
  // a fresh leaf spring state, then (for loops) one cycle of pre-roll so the leaves are already swaying at frame 0
  tot.monster.group.userData.leaf = undefined
  const t0 = loops ? dur : 0
  if (loops) for (let i = 0; i < n - 1; i++) tot.pose(i / FPS, anim)
  for (let i = 0; i < n; i++) {
    tot.pose(t0 + i / FPS, anim)
    nodes.forEach((o, k) => {
      const f = frames[k]
      f.p.set([o.position.x, o.position.y, o.position.z], i * 3)
      const prev = i > 0 ? new THREE.Quaternion().fromArray(f.q, (i - 1) * 4) : null
      const q = o.quaternion.clone()
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w) // keep the track continuous
      f.q.set([q.x, q.y, q.z, q.w], i * 4)
      const on = o.visible // hidden props become scale 0 (glTF has no visibility)
      f.s.set(on ? [o.scale.x, o.scale.y, o.scale.z] : [0, 0, 0], i * 3)
    })
  }
  return frames
}

function differs(a: Float32Array, rest: number[], eps: number) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - rest[i % rest.length]) > eps) return true
  return false
}

/** Every other key (and always the last, so loops close). */
function every2(times: Float32Array, values: Float32Array, size: number): [Float32Array, Float32Array] {
  const keep = [...times.keys()].filter((i) => i % 2 === 0 || i === times.length - 1)
  const v = new Float32Array(keep.length * size)
  keep.forEach((i, k) => v.set(values.subarray(i * size, i * size + size), k * size))
  return [Float32Array.from(keep, (i) => times[i]), v]
}

/** Build the clip: a track for every node that moves away from its rest pose in this clip. */
function toClip(name: string, nodes: THREE.Object3D[], rest: Sample[], frames: Sample[], dur: number) {
  const n = frames[0].p.length / 3
  const times = new Float32Array(n).map((_, i) => Math.min(dur, i / FPS))
  const tracks: THREE.KeyframeTrack[] = []
  nodes.forEach((o, k) => {
    const f = frames[k]
    const r = rest[k]
    if (differs(f.p, [...r.p], 1e-5)) tracks.push(new THREE.VectorKeyframeTrack(`${o.uuid}.position`, times, f.p))
    if (differs(f.q, [...r.q], 1e-5) && differs(f.q, [...r.q].map((v) => -v), 1e-5)) {
      // a leaf's own spring is smooth and small: every other frame is plenty (keeps the files small)
      if (o.userData.leafSpring) tracks.push(new THREE.QuaternionKeyframeTrack(`${o.uuid}.quaternion`, ...every2(times, f.q, 4)))
      else tracks.push(new THREE.QuaternionKeyframeTrack(`${o.uuid}.quaternion`, times, f.q))
    }
    if (differs(f.s, [...r.s], 1e-5)) tracks.push(new THREE.VectorKeyframeTrack(`${o.uuid}.scale`, times, f.s))
  })
  return new THREE.AnimationClip(name, dur, tracks)
}

/** Unique, readable node names (loaders bind clips to nodes by name). */
function nameNodes(root: THREE.Object3D) {
  const seen = new Map<string, number>()
  root.traverse((o) => {
    const base = (o.name || ((o as THREE.Bone).isBone ? 'bone' : (o as THREE.Mesh).isMesh ? 'mesh' : 'node')).replace(/[^A-Za-z0-9_-]/g, '_')
    const c = seen.get(base) ?? 0
    seen.set(base, c + 1)
    o.name = c ? `${base}_${c}` : base
  })
}

async function exportGLB(obj: THREE.Object3D, clips: THREE.AnimationClip[] = []) {
  const ex = new GLTFExporter()
  return (await ex.parseAsync(obj, { binary: true, animations: clips, onlyVisible: false, trs: true })) as ArrayBuffer
}

async function save(path: string, data: ArrayBuffer | string) {
  const r = await fetch(`${SAVE}/file/${path}`, { method: 'POST', body: data })
  if (!r.ok) throw new Error(`save ${path}: ${r.status}`)
}

async function exportCharacter(kit: Kit, c: Character) {
  const tot = new Tot(kit, c.o)
  const root = tot.root
  root.updateMatrixWorld(true)
  // build every prop a clip uses (seed pod, couch, sweat, the hanger and hook) so they're part of the model
  for (const [anim] of CLIPS) tot.pose(0.5, anim)
  bakeLimbs(root)
  bakeTints(root)
  // everything but the limbs into one skinned mesh per material (hidden props are baked as scale 0, so they can join
  // too); bind with nothing collapsed, the clips set every scale anyway
  root.traverse((o) => {
    if (o !== root && Math.min(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z)) < 1e-4) o.scale.set(1, 1, 1)
  })
  mergeMeshes(root)
  nameNodes(root)
  const nodes = nodesOf(root)
  // the rest pose: standing idle at t = 0, props hidden (scale 0)
  tot.monster.group.userData.leaf = undefined
  tot.pose(0, 'idle')
  const rest: Sample[] = record(tot, nodes, 'idle', 0.0, false).map((f) => ({ p: f.p.slice(0, 3), q: f.q.slice(0, 4), s: f.s.slice(0, 3) }))
  const clips: THREE.AnimationClip[] = []
  for (const [anim, d, loops] of CLIPS) {
    let dur = d
    if (anim === 'swing') {
      // one full swing: the period depends on the rope length and the pot (see swingFrame)
      const H = tot.monster.pot.height
      const D = H + 0.5 + 0.45
      dur = (Math.PI * 2) / (Math.sqrt(9.8 / (D * 1.6)) * 1.25)
    }
    const frames = record(tot, nodes, anim, dur, loops)
    clips.push(toClip(anim, nodes, rest, frames, dur))
  }
  // back to rest for the export: idle at t = 0, every hidden prop at scale 0 and "visible" (glTF has no visibility)
  tot.monster.group.userData.leaf = undefined
  tot.pose(0, 'idle')
  for (const o of nodes) if (!o.visible) (o.scale.set(0, 0, 0), (o.visible = true))
  const glb = await exportGLB(root, clips)
  await save(`characters/${c.file}.glb`, glb)
  log(`${c.file}: ${clips.length} clips, ${clips.reduce((s, x) => s + x.tracks.length, 0)} tracks, ${(glb.byteLength / 1e6).toFixed(1)} MB`)
}

async function exportPots() {
  for (const def of POTS) {
    for (let cw = 0; cw < def.colourways.length; cw++) {
      const built = buildPot(def, cw)
      const g = new THREE.Group()
      g.add(built.group)
      g.scale.setScalar(1.6)
      nameNodes(g)
      const slug = def.colourways[cw].name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await save(`pots/${def.id}-${slug}.glb`, await exportGLB(g))
    }
    log(`pot ${def.id}: ${def.colourways.length} colourways`)
  }
}

async function exportProps() {
  for (const p of PROPS) {
    for (let cw = 0; cw < p.colourways.length; cw++) {
      const g = new THREE.Group()
      g.add(p.build(cw))
      g.scale.setScalar(1.6)
      nameNodes(g)
      const dir = p.group === 'pests' ? 'pests' : 'props'
      const stem = p.id.replace(/^pest-/, '')
      await save(`${dir}/${stem}${p.colourways.length > 1 ? `-${cw + 1}` : ''}.glb`, await exportGLB(g))
    }
  }
  log(`props: ${PROPS.length}`)
}

async function main() {
  const only = Q.get('only')
  const name = Q.get('name')
  try {
    if (!only || only === 'characters') {
      const kit = await loadKit()
      for (const c of CHARACTERS) if (!name || c.file === name) await exportCharacter(kit, c)
    }
    if (!only || only === 'pots') await exportPots()
    if (!only || only === 'props') await exportProps()
    document.title = 'DONE'
  } catch (e) {
    log(`ERROR ${(e as Error).stack}`)
    document.title = 'ERROR'
  }
}
main()
