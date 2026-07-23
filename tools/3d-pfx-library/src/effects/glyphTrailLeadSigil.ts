import * as THREE from 'three'

export function createPfxGlyphTrailLeadSigilGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const palette = [
    [0.48, 0.96, 1],
    [0.35, 0.88, 1],
    [0.24, 0.48, 1],
    [0.48, 0.28, 0.94],
  ] as const
  const rearTip = new THREE.Vector3(-0.46, 0.02, -0.02)
  const frontTip = new THREE.Vector3(0.44, -0.015, 0.025)
  const makeRing = (x: number, radius: number, phase: number) => Array.from({ length: 8 }, (_, index) => {
    const angle = index / 8 * Math.PI * 2 + phase
    const irregular = radius * (0.88 + (index % 3) * 0.08)
    return new THREE.Vector3(x, Math.cos(angle) * irregular, Math.sin(angle) * irregular * (0.9 + (index % 2) * 0.12))
  })
  const rearRing = makeRing(-0.2, 0.27, 0.1)
  const frontRing = makeRing(0.18, 0.23, 0.34)
  const pushFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...color, ...color, ...color)
  }
  for (let face = 0; face < 8; face += 1) {
    const next = (face + 1) % 8
    pushFace(rearTip, rearRing[next]!, rearRing[face]!, palette[(face + 3) % palette.length]!)
    pushFace(rearRing[face]!, rearRing[next]!, frontRing[next]!, palette[face % palette.length]!)
    pushFace(rearRing[face]!, frontRing[next]!, frontRing[face]!, palette[(face + 1) % palette.length]!)
    pushFace(frontTip, frontRing[face]!, frontRing[next]!, palette[(face + 2) % palette.length]!)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxRuneOrder', new THREE.Float32BufferAttribute(new Array(positions.length / 3).fill(0), 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxGlyphTrailLeadGeometry'] = 'closed-faceted-twisted-octagonal-arcane-nib'
  geometry.userData['pfxGlyphTrailLeadDrawCalls'] = 1
  geometry.userData['pfxGlyphTrailLeadClosedVolume'] = true
  geometry.userData['pfxGlyphTrailLeadWorldSpaceVolume'] = true
  geometry.userData['pfxGlyphTrailLeadWriteOrder'] = 0
  geometry.userData['pfxGlyphTrailLeadFaceCount'] = positions.length / 9
  geometry.userData['pfxGlyphTrailLeadDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}
