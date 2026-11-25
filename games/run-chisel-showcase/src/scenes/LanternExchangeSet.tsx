import exchange from '@chisel/contracts/data/lantern-exchange.json'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Quaternion, SRGBColorSpace, Vector3 } from 'three'

function exchangeSign() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot draw the Lantern Exchange sign.')

  ctx.fillStyle = '#1b2729'
  ctx.fillRect(0, 0, 768, 224)
  ctx.strokeStyle = '#714d36'
  ctx.lineWidth = 6
  ctx.strokeRect(9, 9, 750, 206)
  ctx.fillStyle = '#c37644'
  ctx.fillRect(31, 31, 163, 162)
  ctx.fillStyle = '#1f2929'
  for (const outline of exchange.stamp) {
    ctx.beginPath()
    outline.forEach(([x, y], index) => {
      const px = 112 + x! * 110
      const py = 112 - y! * 110
      if (index === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#eac292'

  ctx.font = '700 52px system-ui'
  ctx.fillText('LANTERN EXCHANGE', 218, 105, 515)
  ctx.fillStyle = '#82aaa1'
  ctx.font = '600 27px monospace'
  ctx.fillText('SERVICE HALL   /   P09', 221, 158)
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  return map
}

const CANOPY_CORNERS = [
  { left: -2.26, right: 0.87, z: -2.39, y: 3.83, sag: 0.0 },
  { left: -1.94, right: 1.76, z: -3.59, y: 3.66, sag: 0.18 },
  { left: -0.98, right: 3.24, z: -5.09, y: 3.98, sag: 0.0 },
] as const

function canopyGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  const cloth = [new Color('#406463'), new Color('#3e5b62'), new Color('#836e59')]
  const point = (row: number, fraction: number): number[] => {
    const { left, right, z, y, sag } = CANOPY_CORNERS[row]!
    return [
      left + (right - left) * fraction,
      y - Math.sin(fraction * Math.PI) * sag,
      z,
    ]
  }
  const geometry = new BufferGeometry()
  for (let row = 0; row < CANOPY_CORNERS.length - 1; row++) {
    for (let strip = 0; strip < 6; strip++) {
      const a = point(row, strip / 6)
      const b = point(row, (strip + 1) / 6)
      const c = point(row + 1, strip / 6)
      const d = point(row + 1, (strip + 1) / 6)
      const tint = cloth[strip === 5 ? 2 : strip % 2]!
      for (let vertex = 0; vertex < 6; vertex++) colors.push(tint.r, tint.g, tint.b)
      positions.push(...a, ...c, ...b, ...b, ...c, ...d)
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

const REAR_FACADES = [
  { left: -6.7, width: 2.9, height: 7.2, z: -12.8, color: '#2d3f49', crown: 0.35 },
  { left: -4.0, width: 2.2, height: 9.1, z: -14.8, color: '#293d48', crown: 0.95 },
  { left: -1.8, width: 2.6, height: 6.3, z: -12.1, color: '#303e45', crown: 0.31 },
  { left: 0.9, width: 2.4, height: 7.8, z: -14.8, color: '#334650', crown: 1.22 },
  { left: 3.1, width: 3.5, height: 6.9, z: -13.2, color: '#2a3e47', crown: 0.52 },
]

function rearFacadeGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  type Point = readonly [number, number, number]
  const quad = (a: Point, b: Point, c: Point, d: Point, color: string) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d)
    const tint = new Color(color)
    for (let vertex = 0; vertex < 6; vertex++) colors.push(tint.r, tint.g, tint.b)
  }
  const band = (left: number, bottom: number, width: number, height: number, z: number, color: string, farZ = z) => {
    const right = left + width
    const top = bottom + height
    quad([left, bottom, z], [right, bottom, farZ], [right, top, farZ], [left, top, z], color)
  }
  for (const { left, width, height, z, color, crown } of REAR_FACADES) {
    const passage = left === -1.8
    const base = passage ? 2.85 : 0
    const right = left + width
    const rear = z - 1.65
    band(left, base, width, height - base, z, color)
    band(left, 0, 0, height, rear, '#253440', z)
    band(right, 0, 0, height, z, '#24323b', rear)
    quad([left, height, z], [right, height, z], [right, height, rear], [left, height, rear], '#3b4e56')
    if (passage) {
      band(left, 0, 0.28, base, z, '#303640')
      band(left + width - 0.31, 0, 0.31, base, z, '#303640')
      band(left + 0.28, base - 0.23, width - 0.59, 0.12, z + 0.01, '#b08169')
      const jamb = left + 0.28
      const opposite = right - 0.31
      band(jamb, 0, 0, base - 0.23, z, '#766880', z - 1.15)
      band(opposite, 0, 0, base - 0.23, z - 1.15, '#594c60', z)
      const ceiling = base - 0.23
      quad([jamb, ceiling, z], [jamb, ceiling, z - 1.7], [opposite, ceiling, z - 1.7],
        [opposite, ceiling, z], '#4e465a')
      const strip = ceiling - 0.008
      quad([jamb + 0.16, strip, z - 0.19], [jamb + 0.16, strip, z - 1.55],
        [jamb + 0.24, strip, z - 1.55], [jamb + 0.24, strip, z - 0.19], '#bda293')
      band(left + 0.26, 0, 0.67, 3.71, z - 1.15, '#71657e', z - 4.9)
      band(left + 0.16, 0, 0.59, 0.40, z + 0.03, '#303441', z - 4.9)
      band(left + 0.17, 1.45, 0.46, 0.16, z + 0.03, '#cfb29e', z - 2.74)
      band(left + 0.32, 1.90, 0.12, 0.72, z - 0.86, '#a48a9d', z - 1.54)
      band(left + 0.57, 1.90, 0.12, 0.72, z - 2.38, '#a48a9d', z - 3.07)
      const innerGate = z - 3.25
      band(left + 0.62, 0.12, 0.22, 2.30, innerGate, '#cfab81')
      band(left + 1.94, 0.12, 0.22, 2.30, innerGate, '#cfab81')
      band(left + 0.62, 2.42, 1.54, 0.25, innerGate, '#edc696')
      band(left + 0.77, 0.44, 0.075, 1.91, innerGate + 0.015, '#ffe7b7')
      band(left + 1.94, 0.44, 0.075, 1.91, innerGate + 0.015, '#ffe7b7')
      band(left + 0.77, 2.48, 1.25, 0.085, innerGate + 0.015, '#ffe7b7')
      band(left + 0.88, 0.14, 1.02, 1.13, z - 7.1, '#243948')
      band(left + 1.52, 1.27, 0.42, 1.69, z - 7.1, '#617283')
    }
    const penthouse = left + width * 0.19
    const penthouseWidth = width * 0.56
    band(penthouse, height, penthouseWidth, crown, z - 0.44, '#425961')
    band(penthouse + penthouseWidth, height, 0, crown, z - 0.44, '#2c4149', rear)
    band(penthouse - 0.07, height + crown - 0.09, penthouseWidth + 0.14, 0.12, z - 0.40, '#49606a')
    band(left + 0.04, 0, 0.32, height - 0.28, z + 0.008, '#263238')
    for (let row = 0; row < 5; row++) {
      const y = height - 0.84 - row * 0.82
      if (y < base + 0.25) continue
      band(left + 0.48, y, width - 0.64, 0.18, z + 0.01, '#20282d')
      for (let bay = 0; bay < 3; bay++) {
        if ((row + bay) % 4 === 1) continue
        const pitch = (width - 0.64) / 3
        band(left + 0.54 + bay * pitch, y + 0.035, pitch - 0.12, 0.10, z + 0.02,
          (row + bay) % 3 === 0 ? '#826c56' : '#506f70')
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

const PAVEMENT_LIGHTS = [
  { x: -1.24, z: -2.37, width: 0.70, length: 1.68, tint: '#66cfcc', opacity: 0.28 },
  { x: 1.25, z: 0.15, width: 0.71, length: 1.26, tint: '#e89b60', opacity: 0.29 },
  { x: -0.42, z: -4.57, width: 0.67, length: 1.54, tint: '#a778ba', opacity: 0.31 },
  { x: -0.84, z: -9.24, width: 0.91, length: 2.15, tint: '#d79fc9', opacity: 0.44 },
  { x: -0.92, z: -12.00, width: 0.84, length: 1.91, tint: '#d0afce', opacity: 0.49 },
  { x: -0.94, z: -14.72, width: 0.75, length: 2.15, tint: '#d1b4a2', opacity: 0.66 },
  { x: -0.57, z: -16.21, width: 0.69, length: 1.34, tint: '#ffd6a0', opacity: 0.77 },
]

function pavementLightGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  for (const { x, z, width, length, tint, opacity } of PAVEMENT_LIGHTS) {
    const { r, g, b } = new Color(tint)
    for (let facet = 0; facet < 8; facet++) {
      const start = facet * Math.PI / 4
      const end = start + Math.PI / 4
      positions.push(x, 0.13, z)
      positions.push(x + width * Math.cos(end), 0.13, z + length * Math.sin(end))
      positions.push(x + width * Math.cos(start), 0.13, z + length * Math.sin(start))
      colors.push(r, g, b, opacity, r, g, b, 0, r, g, b, 0)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4))
  return geometry
}

const CANOPY_CABLES = [
  [[-2.26, 3.83, -2.39], [-2.60, 4.26, -2.39]],
  [[0.87, 3.83, -2.39], [3.48, 4.21, -3.35]],
  [[-0.98, 3.98, -5.09], [-2.51, 4.22, -5.69]],
  [[3.24, 3.98, -5.09], [3.68, 4.16, -4.89]],
] as const

export function LanternExchangeSet() {
  const sign = useMemo(exchangeSign, [])
  const canopy = useMemo(canopyGeometry, [])
  const rear = useMemo(rearFacadeGeometry, [])
  const reflectedLight = useMemo(pavementLightGeometry, [])
  const cables = useMemo(() => CANOPY_CABLES.map(([start, end]) => {
    const a = new Vector3(...start)
    const b = new Vector3(...end)
    const direction = b.clone().sub(a)
    const length = direction.length()
    return {
      length,
      position: a.lerp(b, 0.5),
      orientation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
    }
  }), [])
  useEffect(() => () => {
    sign.dispose()
    canopy.dispose()
    rear.dispose()
    reflectedLight.dispose()
  }, [canopy, rear, reflectedLight, sign])

  return (
    <group>
      <mesh geometry={rear}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <mesh geometry={reflectedLight}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={canopy}>
        <meshStandardMaterial vertexColors side={DoubleSide} roughness={1} />
      </mesh>
      {cables.map(({ length, position, orientation }) => (
        <mesh key={position.x} position={position} quaternion={orientation}>
          <cylinderGeometry args={[0.019, 0.019, length, 6]} />
          <meshStandardMaterial color="#a89570" roughness={0.75} />
        </mesh>
      ))}
      <group position={[-0.62, 3.12, -4.10]} scale={0.65}>
        <mesh>
          <boxGeometry args={[2.56, 0.79, 0.12]} />
          <meshStandardMaterial color="#394245" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0, 0.062]}>
          <planeGeometry args={[2.49, 0.73]} />
          <meshBasicMaterial map={sign} color="#bfb4a0" toneMapped={false} />
        </mesh>
        {[-0.91, 0.91].map((x) => (
          <mesh key={x} position={[x, -0.58, -0.17]}>
            <boxGeometry args={[0.07, 0.56, 0.24]} />
            <meshStandardMaterial color="#555447" />
          </mesh>
        ))}
      </group>
    </group>
  )
}
