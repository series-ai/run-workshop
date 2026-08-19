export interface SpriteSheetFrame {
  name: string
  /** Atlas pixel origin, top-left. */
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  /** GL UV bottom-left + size, with flipY textures. */
  u: number
  v: number
  du: number
  dv: number
}

export interface SpriteSheetClip {
  id: string
  frames: SpriteSheetFrame[]
  /** True when frames are a time sequence, false when they are size/shape variants. */
  animated: boolean
}

export interface SpriteSheet {
  textureWidth: number
  textureHeight: number
  textureFileName: string
  frames: SpriteSheetFrame[]
  clips: SpriteSheetClip[]
}

export type SpriteSheetBlend = 'cutout' | 'additive' | 'alpha'
export type SpriteSheetAnchor = 'ground' | 'character' | 'weather'
export type SpriteSheetBillboard = 'camera' | 'horizontal'

export interface SpriteSheetEmitter {
  clipId?: string
  count: number
  life: { min: number; max: number }
  size: { min: number; max: number }
  speed: { min: number; max: number }
  gravity: number
  radius: number
  height?: number
  fps: number
  loop: boolean
  blend: SpriteSheetBlend
  lumaAlpha: boolean
  /** Use clip frames as variants instead of playing them in time. */
  variantMode?: boolean
  /** Spawn on the ground plane and keep the billboard sitting on it. */
  grounded?: boolean
  anchor?: SpriteSheetAnchor
  billboard?: SpriteSheetBillboard
  /** Treat a wide stamp as a tall streak (rain). */
  verticalStreak?: boolean
  /** RGB tint. Default white. */
  color?: [number, number, number]
  /** Multiplies coverage. Cocos startColorAlpha. */
  opacity?: number
  /** Fade in and out across life, matching Cocos color-over-life. */
  fadeOverLife?: boolean
}

export interface SpriteSheetParticle {
  emitter: number
  clip: number
  frame: number
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  roll: number
}
