/**
 * Runtime proof for the showcase's composition path (needs `npm run build:pack`):
 * a RUN part rebinds to the PN skeleton, and a PN clip moves it rigidly with
 * its bone; a RUN clip resolves every track on PN and RUN rigs.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnimationMixer, Matrix4, PropertyBinding, SkinnedMesh, Vector3, type Object3D } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { OUT_DIR, PIRATE_AVATAR_GLB, pirateModelsDir, STAGE_DIR } from '../paths'
import { loadGltfWithoutTextures } from './loadGltf'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

const CHAR = join(STAGE_DIR, 'run-voxel-fantasy/3D/characters')
const PARTS = join(CHAR, 'avatar/fantasy-avatar-parts.glb')
const SKIN = join(CHAR, 'characters-skins/fantasy-characters-skins-elf-ranger.glb')
const META = JSON.parse(readFileSync(join(OUT_DIR, 'meta/fantasy/fantasy-avatar-parts.json'), 'utf8')) as { parts: { nodeName: string }[]; avatarClips: string[] }

function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = []
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) out.push(o as SkinnedMesh)
  })
  return out
}

function dominantBone(mesh: SkinnedMesh, i: number): number {
  const idx = mesh.geometry.getAttribute('skinIndex')
  const w = mesh.geometry.getAttribute('skinWeight')
  let best = 0
  for (let k = 1; k < 4; k += 1) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k
  return idx.getComponent(i, best)
}

/** Vertex position expressed in its dominant bone's frame, after skinning. */
function inBoneFrame(mesh: SkinnedMesh, i: number): Vector3 {
  const p = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)
  const bone = mesh.skeleton.bones[dominantBone(mesh, i)]!
  return p.applyMatrix4(new Matrix4().copy(bone.matrixWorld).invert())
}

let pn: GLTF
let parts: GLTF
let skin: GLTF

beforeAll(async () => {
  if (!existsSync(PARTS) || !existsSync(SKIN)) throw new Error(`build the fantasy pack first: ${PARTS}`)
  ;[pn, parts, skin] = await Promise.all([
    loadGltfWithoutTextures(join(pirateModelsDir(), PIRATE_AVATAR_GLB)),
    loadGltfWithoutTextures(PARTS),
    loadGltfWithoutTextures(SKIN),
  ])
}, 60_000)

describe('RUN parts on the PN skeleton', () => {
  it('rebinds every part and moves rigidly with its bone under a PN clip', () => {
    const pnSkeleton = skinnedMeshes(pn.scene)[0]!.skeleton
    const meshes = skinnedMeshes(parts.scene)
    // GLTFLoader sanitizes node names (spaces → underscores), for PN parts too.
    expect(meshes.map((m) => m.name).sort()).toEqual(META.parts.map((p) => PropertyBinding.sanitizeNodeName(p.nodeName)).sort())
    for (const mesh of meshes) {
      expect(mesh.skeleton.bones.map((b) => b.name)).toEqual(pnSkeleton.bones.map((b) => b.name))
      mesh.skeleton.boneInverses.forEach((inv, i) => {
        const diff = inv.elements.map((v, k) => Math.abs(v - pnSkeleton.boneInverses[i]!.elements[k]!))
        expect(Math.max(...diff)).toBeLessThan(1e-4)
      })
      mesh.bind(pnSkeleton, mesh.bindMatrix)
      pn.scene.add(mesh)
    }
    pn.scene.updateMatrixWorld(true)
    const samples = meshes.flatMap((mesh) => [0, 7, 42].filter((i) => i < mesh.geometry.getAttribute('position').count).map((i) => ({ mesh, i })))
    const rest = samples.map(({ mesh, i }) => ({ local: inBoneFrame(mesh, i), world: mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld) }))

    const walk = pn.animations.find((clip) => clip.name === '04_Walk')!
    const mixer = new AnimationMixer(pn.scene)
    mixer.clipAction(walk).play()
    mixer.update(0.37)
    pn.scene.updateMatrixWorld(true)

    let moved = 0
    samples.forEach(({ mesh, i }, n) => {
      expect(inBoneFrame(mesh, i).distanceTo(rest[n]!.local)).toBeLessThan(1e-4)
      if (mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(rest[n]!.world) > 1e-3) moved += 1
    })
    expect(moved).toBeGreaterThan(samples.length / 3)
  })
})

describe('clips across rigs', () => {
  const unresolved = (root: Object3D, clipTracks: { name: string }[]) =>
    clipTracks.filter((track) => !PropertyBinding.findNode(root, PropertyBinding.parseTrackName(track.name).nodeName))

  it('plays RUN clips on the PN rig and PN clips on the RUN skin', () => {
    expect(parts.animations.map((c) => c.name).sort()).toEqual([...META.avatarClips].sort())
    for (const clip of parts.animations) expect(unresolved(pn.scene, clip.tracks)).toEqual([])
    for (const clip of pn.animations) expect(unresolved(skin.scene, clip.tracks)).toEqual([])
    for (const clip of parts.animations) expect(unresolved(skin.scene, clip.tracks)).toEqual([])
  })

  it('deforms the RUN skin with a PN clip', () => {
    const mesh = skinnedMeshes(skin.scene)[0]!
    const count = mesh.geometry.getAttribute('position').count
    const world = () => {
      skin.scene.updateMatrixWorld(true)
      return Array.from({ length: count }, (_, i) => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld))
    }
    const before = world()
    const mixer = new AnimationMixer(skin.scene)
    mixer.clipAction(pn.animations.find((c) => c.name === '05_Run')!).play()
    mixer.update(0.2)
    const after = world()
    const largest = Math.max(...after.map((p, i) => p.distanceTo(before[i]!)))
    expect(largest).toBeGreaterThan(0.02)
  })
})
