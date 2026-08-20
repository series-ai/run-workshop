export interface CocosParticlePlist {
  textureFileName: string
  maxParticles: number
  duration: number
  life: number
  lifeVariance: number
  speed: number
  speedVariance: number
  angle: number
  angleVariance: number
  gravityY: number
  startSize: number
  startSizeVariance: number
  finishSize: number
  sourceVarianceX: number
  sourceVarianceY: number
  additive: boolean
  startColor: [number, number, number]
  startColorAlpha: number
  finishColorAlpha: number
}

function readNumber(xml: string, key: string, fallback = 0): number {
  const match = xml.match(new RegExp(`<key>${key}</key>\\s*<(?:integer|real)>(-?[\\d.eE+]+)</(?:integer|real)>`))
  return match ? Number.parseFloat(match[1]) : fallback
}

function readString(xml: string, key: string): string {
  const match = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))
  return match?.[1] ?? ''
}

export function isCocosParticlePlist(xml: string): boolean {
  return xml.includes('<key>maxParticles</key>') && !xml.includes('<key>frames</key>')
}

export function parseCocosParticlePlist(xml: string): CocosParticlePlist {
  if (!isCocosParticlePlist(xml)) throw new Error('Plist is not a Cocos particle emitter')
  const dest = readNumber(xml, 'blendFuncDestination', 771)
  return {
    textureFileName: readString(xml, 'textureFileName'),
    maxParticles: Math.max(1, Math.round(readNumber(xml, 'maxParticles', 1))),
    duration: readNumber(xml, 'duration', -1),
    life: Math.max(0.05, readNumber(xml, 'particleLifespan', 1)),
    lifeVariance: Math.max(0, readNumber(xml, 'particleLifespanVariance', 0)),
    speed: readNumber(xml, 'speed', 0),
    speedVariance: Math.max(0, readNumber(xml, 'speedVariance', 0)),
    angle: readNumber(xml, 'angle', 0),
    angleVariance: readNumber(xml, 'angleVariance', 0),
    gravityY: readNumber(xml, 'gravityy', 0),
    startSize: Math.max(1, readNumber(xml, 'startParticleSize', 16)),
    startSizeVariance: Math.max(0, readNumber(xml, 'startParticleSizeVariance', 0)),
    finishSize: readNumber(xml, 'finishParticleSize', 0),
    sourceVarianceX: Math.max(0, readNumber(xml, 'sourcePositionVariancex', 0)),
    sourceVarianceY: Math.max(0, readNumber(xml, 'sourcePositionVariancey', 0)),
    additive: dest === 1,
    startColor: [
      readNumber(xml, 'startColorRed', 1),
      readNumber(xml, 'startColorGreen', 1),
      readNumber(xml, 'startColorBlue', 1),
    ],
    startColorAlpha: readNumber(xml, 'startColorAlpha', 1),
    finishColorAlpha: readNumber(xml, 'finishColorAlpha', 1),
  }
}
