import * as THREE from 'three'

export function createPfxShieldFragmentGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const rootColor: readonly [number, number, number] = [0.92, 0.99, 1]
  const shoulderColor: readonly [number, number, number] = [0.24, 0.82, 1]
  const tipColor: readonly [number, number, number] = [0.03, 0.34, 0.68]
  const fragments = [
    { direction: [1, 0.18, 0.12], length: 0.92, width: 0.13 },
    { direction: [-0.82, 0.42, 0.3], length: 0.72, width: 0.11 },
    { direction: [0.24, 0.88, -0.38], length: 0.78, width: 0.1 },
    { direction: [-0.3, -0.82, 0.46], length: 0.86, width: 0.14 },
    { direction: [0.34, 0.16, 0.93], length: 0.82, width: 0.09 },
    { direction: [-0.48, -0.24, -0.84], length: 0.9, width: 0.12 },
    { direction: [0.6, -0.66, -0.32], length: 0.68, width: 0.1 },
    { direction: [-0.62, 0.24, 0.74], length: 0.74, width: 0.095 },
    { direction: [0.44, 0.68, 0.58], length: 0.58, width: 0.08 },
  ] as const
  const push = (point: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    push(a, aColor)
    push(b, bColor)
    push(c, cColor)
  }
  const worldUp = new THREE.Vector3(0, 1, 0)
  const worldDepth = new THREE.Vector3(0, 0, 1)
  const rootRadii: number[] = []
  for (const [index, fragment] of fragments.entries()) {
    const direction = new THREE.Vector3(...fragment.direction).normalize()
    const reference = Math.abs(direction.dot(worldUp)) > 0.82 ? worldDepth : worldUp
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
    const rootRadius = 0.3 + (index % 4) * 0.035
    rootRadii.push(rootRadius)
    const root = direction.clone().multiplyScalar(rootRadius)
    const shoulderCenter = direction.clone().multiplyScalar(
      rootRadius + (fragment.length - rootRadius) * 0.48,
    )
    const tip = direction.clone().multiplyScalar(fragment.length)
    const phase = index * 0.47
    const shoulder = Array.from({ length: 4 }, (_, side) => {
      const angle = phase + side * Math.PI * 0.5
      return shoulderCenter.clone()
        .addScaledVector(tangent, Math.cos(angle) * fragment.width)
        .addScaledVector(bitangent, Math.sin(angle) * fragment.width * 0.72)
    })
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4
      triangle(root, shoulder[side]!, shoulder[next]!, rootColor, shoulderColor, shoulderColor)
      triangle(tip, shoulder[next]!, shoulder[side]!, tipColor, shoulderColor, shoulderColor)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShieldFragmentDrawCalls'] = 1
  geometry.userData['pfxShieldFragmentCount'] = fragments.length
  geometry.userData['pfxShieldFragmentClosedFaces'] = true
  geometry.userData['pfxShieldFragmentRadialOctants'] = 8
  geometry.userData['pfxShieldFragmentDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxShieldFragmentMinimumRootRadius'] = Math.min(...rootRadii)
  return geometry
}

export function createPfxShieldFragmentMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.DoubleSide,
    emissive: '#0b7fbd',
    emissiveIntensity: 0.48,
    roughness: 0.28,
    metalness: 0.08,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxShieldFragmentMaterial'] = 'closed-faceted-cyan-crystal'
  return material
}
