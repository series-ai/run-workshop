import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, Vector3 } from 'three'

const WIDTH = 512
const HEIGHT = 256

function ease(lo: number, hi: number, value: number) {
  const fraction = Math.min(1, Math.max(0, (value - lo) / (hi - lo)))
  return fraction * fraction * (3 - 2 * fraction)
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount
}

function gridValue(x: number, z: number) {
  const hash = Math.imul(x, 374761393) + Math.imul(z, 668265263)
  return (Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) / 0xffffffff
}

function cloudNoise(x: number, z: number) {
  const u = Math.floor(x)
  const v = Math.floor(z)
  const across = ease(0, 1, x - u)
  const along = ease(0, 1, z - v)
  return mix(
    mix(gridValue(u, v), gridValue(u + 1, v), across),
    mix(gridValue(u, v + 1), gridValue(u + 1, v + 1), across),
    along,
  )
}

function channels(color: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16))
}

export function createLevelSky(zenith: string, horizon: string, sunPosition: [number, number, number]) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the level sky texture.')

  const image = context.createImageData(WIDTH, HEIGHT)
  const top = channels(zenith)
  const low = channels(horizon)
  const sun = new Vector3(...sunPosition).normalize()

  for (let row = 0; row < HEIGHT; row++) {
    const altitude = Math.PI * (0.5 - (row + 0.5) / HEIGHT)
    const y = Math.sin(altitude)
    const radius = Math.cos(altitude)
    const colorMix = ease(-0.02, 0.82, y)
    const cloudFade = ease(0.015, 0.31, y) * (1 - 0.55 * ease(0.65, 0.98, y))
    const depth = 1 / (0.48 + Math.max(0, y))
    const cloudHeight = Math.max(0, y)

    for (let col = 0; col < WIDTH; col++) {
      const angle = 2 * Math.PI * ((col + 0.5) / WIDTH - 0.5)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const u = (0.91 * x + 0.41 * z) * depth
      const v = (0.91 * z - 0.41 * x) * depth
      const broad = cloudNoise(u * 2.6 + 3.5, v * 5.2 + 4.2)
      const edge = cloudNoise(u * 8.2 + 4.6, v * 12.7 - 1.9)
      const wisps = cloudNoise(u * 15.3 - 7.3, v * 26.1 + 2.4)
      const cloud = ease(0.49, 0.75, broad * 0.7 + edge * 0.23 + wisps * 0.07) * cloudFade
      const sunAngle = x * sun.x + y * sun.y + z * sun.z
      const glow = ease(0.91, 1, sunAngle) * (0.21 + 0.11 * cloudHeight)
      const litCloud = 0.49 + 0.20 * ease(-0.1, 0.93, sunAngle) + 0.12 * edge
      const offset = (row * WIDTH + col) * 4
      for (let channel = 0; channel < 3; channel++) {
        const azure = mix(low[channel]!, top[channel]!, colorMix)
        const haze = mix(low[channel]!, 248 - channel * 4, litCloud)
        image.data[offset + channel] = mix(mix(azure, haze, cloud * 0.65), 253 - channel * 6, glow)
      }
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas, EquirectangularReflectionMapping)
  texture.colorSpace = SRGBColorSpace
  return texture
}
