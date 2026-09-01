/**
 * Renders a composed Pirate Nation avatar.
 *
 * The art file holds every part mesh bound to one shared rig. This component
 * loads it once, clones the rig per avatar, keeps only the selected parts,
 * tints the skin and hair materials, and plays a named clip.
 */
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import {
  AnimationMixer,
  Color,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  type Group,
  type Object3D,
} from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  AVATAR_MODEL_PATH,
  type AvatarAnimationName,
} from './avatarCatalog.generated'
import {
  DEFAULT_HAIR_COLOR,
  DEFAULT_SKIN_COLOR,
  resolveThreePartNodes,
  type AvatarSelection,
} from './composeAvatar'

/** Material name to the selection field that recolors it. */
const TINT_MATERIAL_FIELDS = {
  'Skin-Material': 'skinColor',
  'Hair-Material': 'hairColor',
} as const satisfies Record<string, keyof AvatarSelection>

/**
 * The source rig faces +X: face plates sit at x ≈ 0.08 while the body spreads
 * along z. The Unity client turned this to camera with a +90 degree yaw. Unity
 * is left-handed and three.js is right-handed, so the same turn is -90 here.
 */
export const AVATAR_FORWARD_YAW = -Math.PI / 2

export interface PirateAvatarProps {
  selection: AvatarSelection
  /** Clip to play. Omit to leave the avatar in bind pose. */
  animation?: AvatarAnimationName
  /** Resolved URL of the avatar glb. */
  modelUrl: string
  scale?: number
  /** Yaw in radians. Defaults to the upstream forward correction. */
  rotationY?: number
}

/** Path of the avatar model inside the pack, for the caller's resolver. */
export const PIRATE_AVATAR_ASSET_PATH = AVATAR_MODEL_PATH

/** Scene name of the avatar root, so a camera rig can find and frame it. */
export const PIRATE_AVATAR_ROOT_NAME = 'pirate-avatar'

function isRenderable(object: Object3D): object is Mesh | SkinnedMesh {
  return (object as Mesh).isMesh === true
}

const KNOWN_SLOT_PREFIXES = new Set([
  'species',
  'ears',
  'bottoms',
  'shoes',
  'tops',
  'back',
  'face',
  'eyebrow',
  'facialhair',
  'hair',
  'eyewear',
  'headwear',
])

function getPartPrefix(object: Object3D, root: Object3D): string {
  let curr: Object3D | null = object
  while (curr && curr !== root) {
    if (curr.name) {
      const normalized = curr.name.replace(/_/g, ' ').trim().toLowerCase()
      const prefix = normalized.split(' ')[0]
      if (prefix && KNOWN_SLOT_PREFIXES.has(prefix)) {
        return prefix
      }
    }
    curr = curr.parent
  }
  return ''
}

/**
 * Physical 12-tier layering hierarchy matching anatomical depth.
 * Every slot receives a distinct renderOrder and negative polygonOffset
 * so that coplanar voxel shells never compete in the depth buffer.
 */
interface LayerConfig {
  renderOrder: number
  offsetFactor: number
  offsetUnits: number
}

function getLayerConfig(prefix: string): LayerConfig {
  switch (prefix) {
    case 'species':
      // Base body mesh: rendered underneath all clothing layers
      return { renderOrder: 0, offsetFactor: 10.0, offsetUnits: 10.0 }
    case 'ears':
      // Side head attachments: sit on side of skull beneath hair
      return { renderOrder: 1, offsetFactor: 8.0, offsetUnits: 8.0 }
    case 'bottoms':
      // Pants / bottoms: rendered over body, but underneath shoes/boots cuffs and top tails
      return { renderOrder: 2, offsetFactor: 6.0, offsetUnits: 6.0 }
    case 'shoes':
      // Shoes / boots: cuffs wrap over pant legs
      return { renderOrder: 3, offsetFactor: 4.0, offsetUnits: 4.0 }
    case 'tops':
      // Tops / shirts / coats: hem hangs over pants waistband
      return { renderOrder: 4, offsetFactor: 2.0, offsetUnits: 2.0 }
    case 'back':
      // Back items / capes / backpacks / weapons: worn over tops
      return { renderOrder: 5, offsetFactor: 0.0, offsetUnits: 0.0 }
    case 'face':
      // Base face plate decal: eyes, mouth, face paint
      return { renderOrder: 6, offsetFactor: -4.0, offsetUnits: -4.0 }
    case 'eyebrow':
      // Eyebrows: layered over base face decal
      return { renderOrder: 7, offsetFactor: -8.0, offsetUnits: -8.0 }
    case 'hair':
      // 3D hair and bangs: sits on skull over forehead and eyebrows
      return { renderOrder: 8, offsetFactor: -12.0, offsetUnits: -12.0 }
    case 'facialhair':
      // 3D beards, mustaches, and face coverings (gas masks): layered over cheeks, jaw, and hair sides
      return { renderOrder: 9, offsetFactor: -16.0, offsetUnits: -16.0 }
    case 'eyewear':
      // Glasses, goggles, eyepatches: worn over face, eyes, and hair sides
      return { renderOrder: 10, offsetFactor: -20.0, offsetUnits: -20.0 }
    case 'headwear':
      // Hats, helmets, bandanas, crowns: sit on top of head, hair, and eyewear straps
      return { renderOrder: 11, offsetFactor: -24.0, offsetUnits: -24.0 }
    default:
      return { renderOrder: 4, offsetFactor: 0.0, offsetUnits: 0.0 }
  }
}

/**
 * Clones the rig and drops every part the selection leaves out.
 *
 * Removing rather than hiding keeps the scene graph proportional to the
 * avatar instead of to the 326-part source file.
 */
export function buildAvatarScene(source: Group, selection: AvatarSelection): Group {
  const root = cloneSkeleton(source) as Group
  const keep = new Set(resolveThreePartNodes(selection))

  const discard: Object3D[] = []
  root.traverse((object) => {
    if (isRenderable(object)) {
      let isKept = false
      let curr: Object3D | null = object
      while (curr && curr !== root) {
        if (keep.has(curr.name)) {
          isKept = true
          break
        }
        curr = curr.parent
      }
      if (!isKept) discard.push(object)
    }
  })
  for (const object of discard) object.removeFromParent()

  const skinColor = new Color(selection.skinColor ?? DEFAULT_SKIN_COLOR)
  const hairColor = new Color(selection.hairColor ?? DEFAULT_HAIR_COLOR)

  root.traverse((object) => {
    if (!isRenderable(object)) return
    // Match Unity IPFSAvatarMaterialController: disable internal sub-mesh shadow casting
    // to prevent shadow map self-shadow acne on coplanar voxel shells.
    object.castShadow = false
    object.receiveShadow = true

    const prefix = getPartPrefix(object, root)
    const layer = getLayerConfig(prefix)

    object.renderOrder = layer.renderOrder

    // Clone materials so tinting one avatar never bleeds into another,
    // and apply polygonOffset per layer to eliminate depth-buffer z-fighting.
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const tinted = materials.map((material) => {
      const field = TINT_MATERIAL_FIELDS[material.name as keyof typeof TINT_MATERIAL_FIELDS]
      const copy = material.clone() as MeshStandardMaterial
      if (field) {
        copy.color = field === 'skinColor' ? skinColor.clone() : hairColor.clone()
      }
      copy.polygonOffset = true
      copy.polygonOffsetFactor = layer.offsetFactor
      copy.polygonOffsetUnits = layer.offsetUnits
      return copy
    })
    object.material = Array.isArray(object.material) ? tinted : tinted[0]!
  })

  return root
}

export function PirateAvatar({
  selection,
  animation,
  modelUrl,
  scale = 1,
  rotationY = AVATAR_FORWARD_YAW,
}: PirateAvatarProps) {
  const { scene, animations } = useGLTF(modelUrl)

  const avatar = useMemo(
    () => buildAvatarScene(scene as Group, selection),
    [scene, selection],
  )

  // Direct AnimationMixer bound to the active cloned avatar instance.
  // Re-creates when avatar changes so rolling or changing traits never freezes animation.
  const mixer = useMemo(() => new AnimationMixer(avatar), [avatar])

  useEffect(() => {
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(avatar)
    }
  }, [mixer, avatar])

  useFrame((_, delta) => {
    mixer.update(delta)
  })

  useEffect(() => {
    if (!animation) return
    const clip = animations.find((c) => c.name === animation)
    if (!clip) {
      throw new Error(
        `Pirate Nation avatar has no animation "${animation}". ` +
          `Available: ${animations.map((a) => a.name).join(', ')}`,
      )
    }
    const action = mixer.clipAction(clip)
    action.reset().fadeIn(0.2).play()
    return () => {
      action.fadeOut(0.2)
    }
  }, [mixer, animations, animation])

  useEffect(() => {
    ;(window as unknown as { __testAvatar?: Group }).__testAvatar = avatar
  }, [avatar])

  return (
    <group name={PIRATE_AVATAR_ROOT_NAME} scale={scale} rotation={[0, rotationY, 0]}>
      <primitive object={avatar} />
    </group>
  )
}
