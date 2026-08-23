/**
 * Renders a composed Pirate Nation avatar.
 *
 * The art file holds every part mesh bound to one shared rig. This component
 * loads it once, clones the rig per avatar, keeps only the selected parts,
 * tints the skin and hair materials, and plays a named clip.
 */
import { useAnimations, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import {
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

/**
 * Clones the rig and drops every part the selection leaves out.
 *
 * Removing rather than hiding keeps the scene graph proportional to the
 * avatar instead of to the 326-part source file.
 */
function buildAvatarScene(source: Group, selection: AvatarSelection): Group {
  const root = cloneSkeleton(source) as Group
  const keep = new Set(resolveThreePartNodes(selection))

  const discard: Object3D[] = []
  root.traverse((object) => {
    if (isRenderable(object) && !keep.has(object.name)) discard.push(object)
  })
  for (const object of discard) object.removeFromParent()

  const skinColor = new Color(selection.skinColor ?? DEFAULT_SKIN_COLOR)
  const hairColor = new Color(selection.hairColor ?? DEFAULT_HAIR_COLOR)

  root.traverse((object) => {
    if (!isRenderable(object)) return
    object.castShadow = true
    object.receiveShadow = true

    // Clone materials so tinting one avatar never bleeds into another.
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const tinted = materials.map((material) => {
      const field = TINT_MATERIAL_FIELDS[material.name as keyof typeof TINT_MATERIAL_FIELDS]
      if (!field) return material

      const copy = material.clone() as MeshStandardMaterial
      copy.color = field === 'skinColor' ? skinColor.clone() : hairColor.clone()
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
  const group = useRef<Group>(null)

  const avatar = useMemo(
    () => buildAvatarScene(scene as Group, selection),
    [scene, selection],
  )

  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    if (!animation) return
    const action = actions[animation]
    if (!action) {
      throw new Error(
        `Pirate Nation avatar has no animation "${animation}". ` +
          `Available: ${Object.keys(actions).join(', ')}`,
      )
    }
    action.reset().fadeIn(0.2).play()
    return () => {
      action.fadeOut(0.2)
    }
  }, [actions, animation])

  return (
    <group
      ref={group}
      name={PIRATE_AVATAR_ROOT_NAME}
      scale={scale}
      rotation={[0, rotationY, 0]}
      dispose={null}
    >
      <primitive object={avatar} />
    </group>
  )
}

export function preloadPirateAvatar(modelUrl: string): void {
  useGLTF.preload(modelUrl)
}
