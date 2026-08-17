export type BurgerShopTextureId =
  | 'poof-01'
  | 'poof-02'
  | 'smoke'
  | 'ring'
  | 'mask-01'
  | 'flies'
  | 'food-scraps'
  | 'sparkle'
  | 'star-01'
  | 'star-02'
  | 'sign'
  | 'arrow'
  | 'glow'
  | 'coin'
  | 'sunshine'
  | 'confetti'

export type BurgerShopBillboard = 'camera' | 'horizontal' | 'vertical' | 'mesh'
export type BurgerShopBlend = 'cutout' | 'additive' | 'alpha'
export type BurgerShopShape =
  | { kind: 'sphere'; radius: number }
  | { kind: 'hemisphere'; radius: number }
  | { kind: 'cone'; angle: number; radius: number; length?: number }
  | { kind: 'cone-volume'; angle: number; radius: number; length: number }
  | { kind: 'box'; size: [number, number, number] }
  | { kind: 'rectangle'; size: [number, number] }
  | { kind: 'point' }

export interface BurgerShopRange {
  min: number
  max: number
}

export interface BurgerShopEmitter {
  name: string
  texture: BurgerShopTextureId
  sheet: { columns: number; rows: number }
  billboard: BurgerShopBillboard
  blend: BurgerShopBlend
  duration: number
  looping: boolean
  delay?: number
  life: BurgerShopRange
  speed: BurgerShopRange
  size: BurgerShopRange
  gravity: number
  rate: number
  rateOverDistance?: number
  burst?: BurgerShopRange
  shape: BurgerShopShape
  sizeOverLife?: [number, number]
  sizeCurve?: { t: number; v: number }[]
  rotateOverLife?: boolean
  startRotation?: BurgerShopRange
  noise?: BurgerShopRange
  trailLife?: number
  lumaAlpha?: boolean
  color: number[][]
  localEuler?: [number, number, number]
  localPosition?: [number, number, number]
  localScale?: [number, number, number]
  minHeight?: number
}

export interface BurgerShopRecipe {
  id: string
  label: string
  unityPrefab: string
  duration: number
  looping: boolean
  emitters: BurgerShopEmitter[]
}

export interface BurgerShopParticle {
  emitter: number
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
  spin: number
  color: [number, number, number, number]
  sheetIndex: number
}

export const BURGER_SHOP_WORLD_SCALE = 0.24
export const BURGER_SHOP_GRAVITY = 9.81
