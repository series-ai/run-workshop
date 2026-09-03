import { describe, expect, it } from 'vitest'
import { Group, Mesh, MeshStandardMaterial } from 'three'
import { buildAvatarScene } from './PirateAvatar'
import type { AvatarSelection } from './composeAvatar'

function createMockAvatarSource(): Group {
  const root = new Group()
  root.name = 'armature'

  // Single primitive mesh: species 1
  const species1 = new Mesh(undefined, new MeshStandardMaterial({ name: 'Skin-Material' }))
  species1.name = 'species_1'
  root.add(species1)

  // Multi-primitive mesh: species 14 Group with 4 child SkinnedMeshes
  const species14 = new Group()
  species14.name = 'species_14'
  const prim0 = new Mesh(undefined, new MeshStandardMaterial({ name: 'Ghost-Material' }))
  prim0.name = 'model-7.001'
  const prim1 = new Mesh(undefined, new MeshStandardMaterial({ name: 'Ghost-Glass2' }))
  prim1.name = 'model-7.001_1'
  const prim2 = new Mesh(undefined, new MeshStandardMaterial({ name: 'Ghost-Glow' }))
  prim2.name = 'model-7.001_2'
  const prim3 = new Mesh(undefined, new MeshStandardMaterial({ name: 'PN-Material' }))
  prim3.name = 'model-7.001_3'
  species14.add(prim0, prim1, prim2, prim3)
  root.add(species14)

  // Top part: tops 6
  const tops6 = new Mesh(undefined, new MeshStandardMaterial({ name: 'PN-Material' }))
  tops6.name = 'tops_6'
  root.add(tops6)

  // Bottom part: bottoms 5
  const bottoms5 = new Mesh(undefined, new MeshStandardMaterial({ name: 'PN-Material' }))
  bottoms5.name = 'bottoms_5'
  root.add(bottoms5)

  // Shoes part: shoes 5
  const shoes5 = new Mesh(undefined, new MeshStandardMaterial({ name: 'PN-Material' }))
  shoes5.name = 'shoes_5'
  root.add(shoes5)

  // Face part: face 4
  const face4 = new Mesh(undefined, new MeshStandardMaterial({ name: 'PN-Material' }))
  face4.name = 'face_4'
  root.add(face4)

  return root
}

describe('buildAvatarScene', () => {
  it('preserves all child primitives of a multi-primitive part like species 14', () => {
    const source = createMockAvatarSource()
    const selection: AvatarSelection = {
      species: 14,
      face: 4,
      tops: 6,
      bottoms: 5,
      shoes: 5,
    }

    const scene = buildAvatarScene(source, selection)

    // Verify species_14 group and all 4 child meshes remain in the scene
    const species14 = scene.getObjectByName('species_14')
    expect(species14).toBeDefined()
    expect(species14?.children.length).toBe(4)
    expect(species14?.getObjectByName('model-7.001')).toBeDefined()
    expect(species14?.getObjectByName('model-7.001_1')).toBeDefined()
    expect(species14?.getObjectByName('model-7.001_2')).toBeDefined()
    expect(species14?.getObjectByName('model-7.001_3')).toBeDefined()

    // Unselected species 1 must be pruned
    expect(scene.getObjectByName('species_1')).toBeUndefined()
  })

  it('tints Skin-Material when present', () => {
    const source = createMockAvatarSource()
    const selection: AvatarSelection = {
      species: 1,
      face: 4,
      tops: 6,
      bottoms: 5,
      shoes: 5,
      skinColor: '#7fffd4',
    }

    const scene = buildAvatarScene(source, selection)

    const species1 = scene.getObjectByName('species_1') as Mesh
    expect(species1).toBeDefined()
    const material = species1.material as MeshStandardMaterial
    expect(material.color.getHexString()).toBe('7fffd4')
  })

  it('assigns proper renderOrder layers to base body, clothing, and face decals', () => {
    const source = createMockAvatarSource()
    const selection: AvatarSelection = {
      species: 1,
      face: 4,
      tops: 6,
      bottoms: 5,
      shoes: 5,
    }

    const scene = buildAvatarScene(source, selection)

    const species1 = scene.getObjectByName('species_1') as Mesh
    const tops6 = scene.getObjectByName('tops_6') as Mesh
    const bottoms5 = scene.getObjectByName('bottoms_5') as Mesh
    const shoes5 = scene.getObjectByName('shoes_5') as Mesh
    const face4 = scene.getObjectByName('face_4') as Mesh

    // Base body rendered deepest, clothing in middle, face decals on top
    expect(species1.renderOrder).toBeLessThan(bottoms5.renderOrder)
    expect(bottoms5.renderOrder).toBeLessThan(shoes5.renderOrder)
    expect(shoes5.renderOrder).toBeLessThan(tops6.renderOrder)
    expect(tops6.renderOrder).toBeLessThan(face4.renderOrder)
  })
})
