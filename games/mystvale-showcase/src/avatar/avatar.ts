import { AVATAR_LAYERS, type AvatarAppearance, type AvatarLayerDef } from '../catalog'

export interface ResolvedLayer {
  def: AvatarLayerDef
  slot: string
  path: string
  tint?: string
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, '')
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function applyTintToImageData(data: Uint8ClampedArray, hexColor: string): void {
  const { r: tr, g: tg, b: tb } = hexToRgb(hexColor)
  const normR = tr / 255
  const normG = tg / 255
  const normB = tb / 255

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const grey = data[i] // Greyscale source has r == g == b
    data[i] = Math.round(grey * normR)
    data[i + 1] = Math.round(grey * normG)
    data[i + 2] = Math.round(grey * normB)
  }
}

export function resolveAvatarLayers(appearance: AvatarAppearance): ResolvedLayer[] {
  const resolved: ResolvedLayer[] = []

  for (const [slot, layerId] of Object.entries(appearance.selections)) {
    if (!layerId) continue
    const def = AVATAR_LAYERS.find((l) => l.id === layerId)
    if (!def) continue

    let tint: string | undefined
    if (def.tintable) {
      if (slot === 'body') tint = appearance.tints.skin
      else if (slot === 'hair') tint = appearance.tints.hair
      else if (slot === 'clothes') tint = appearance.tints.clothes
      else if (slot === 'eyes') tint = appearance.tints.eyes
    }

    resolved.push({
      def,
      slot,
      path: def.path,
      tint,
    })
  }

  // Sort by zIndex ascending so bottom layers draw first
  return resolved.sort((a, b) => a.def.zIndex - b.def.zIndex)
}

const RANDOM_SKIN_COLORS = ['#fbd4b4', '#ffd1b3', '#d08b5b', '#ae5d29', '#613318', '#7b4b28']
const RANDOM_HAIR_COLORS = ['#2b2d42', '#5c3a21', '#8d5b4c', '#e0a96d', '#f4a261', '#e76f51', '#457b9d']
const RANDOM_CLOTHES_COLORS = ['#4a7c59', '#2a9d8f', '#e76f51', '#f4a261', '#457b9d', '#6d597a']

export function generateRandomAppearance(): AvatarAppearance {
  const hairs = AVATAR_LAYERS.filter((l) => l.slot === 'hair')
  const clothes = AVATAR_LAYERS.filter((l) => l.slot === 'clothes')
  const eyes = AVATAR_LAYERS.filter((l) => l.slot === 'eyes')
  const accessories = AVATAR_LAYERS.filter((l) => l.slot === 'accessories')

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const maybePick = <T>(arr: T[]): T | undefined => (Math.random() > 0.3 ? pick(arr) : undefined)

  return {
    selections: {
      body: 'body-greyscale',
      eyes: pick(eyes).id,
      clothes: pick(clothes).id,
      hair: pick(hairs).id,
      accessories: maybePick(accessories)?.id,
    },
    tints: {
      skin: pick(RANDOM_SKIN_COLORS),
      hair: pick(RANDOM_HAIR_COLORS),
      eyes: '#264653',
      clothes: pick(RANDOM_CLOTHES_COLORS),
    },
  }
}
