import * as THREE from 'three'

export function createPfxEmberFragmentGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const hot: readonly [number, number, number] = [1, 0.62, 0.05]
  const gold: readonly [number, number, number] = [1, 0.28, 0.005]
  const orange: readonly [number, number, number] = [0.9, 0.055, 0.001]
  const coal: readonly [number, number, number] = [0.16, 0.001, 0]
  const fragments = [
    { origin: [0.02, 0, 0.02], direction: [0.92, 0.86, 0.24], length: 1.06, width: 0.09 },
    { origin: [-0.02, 0.01, -0.03], direction: [-0.78, 1, 0.32], length: 0.94, width: 0.08 },
    { origin: [0.04, -0.02, 0], direction: [0.24, 0.92, 0.88], length: 0.88, width: 0.078 },
    { origin: [-0.04, 0.02, 0.01], direction: [-0.32, 0.78, -0.96], length: 0.82, width: 0.074 },
    { origin: [0.01, -0.015, -0.04], direction: [0.82, 0.44, -0.72], length: 0.72, width: 0.068 },
    { origin: [-0.03, -0.01, 0.04], direction: [-0.88, 0.52, 0.64], length: 0.68, width: 0.066 },
    { origin: [0.035, 0.025, 0.03], direction: [0.46, 1.08, -0.38], length: 0.62, width: 0.06 },
    { origin: [-0.025, -0.02, -0.02], direction: [-0.42, 0.98, 0.46], length: 0.58, width: 0.058 },
    { origin: [0.015, 0.02, -0.035], direction: [0.98, 0.38, 0.52], length: 0.52, width: 0.055 },
    { origin: [-0.035, 0, 0.025], direction: [-0.68, 0.34, -0.82], length: 0.48, width: 0.052 },
    { origin: [0.025, -0.01, 0.035], direction: [0.12, 0.72, 1], length: 0.44, width: 0.05 },
    { origin: [-0.015, 0.025, -0.03], direction: [-0.16, 0.68, -1], length: 0.4, width: 0.048 },
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
  for (const fragment of fragments) {
    const direction = new THREE.Vector3(...fragment.direction).normalize()
    const reference = Math.abs(direction.dot(worldUp)) > 0.86 ? worldDepth : worldUp
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
    // Distance and shape are separate: the previous version extruded each
    // coal all the way from the origin, fusing them into a red spike star.
    // These closed bipyramids sit out on their rays as individual matter.
    const center = new THREE.Vector3(...fragment.origin).addScaledVector(direction, fragment.length * 0.82)
    const radius = fragment.width * 0.62
    const halfLength = fragment.width * 1.1
    const rear = center.clone().addScaledVector(direction, -halfLength)
    const tip = center.clone().addScaledVector(direction, halfLength)
    const equator = Array.from({ length: 4 }, (_, index) => {
      const angle = Math.PI * 0.18 + index * Math.PI * 0.5
      return center.clone()
        .addScaledVector(tangent, Math.cos(angle) * radius)
        .addScaledVector(bitangent, Math.sin(angle) * radius)
    })
    for (let side = 0; side < equator.length; side += 1) {
      const next = (side + 1) % equator.length
      triangle(rear, equator[next]!, equator[side]!, orange, hot, gold)
      triangle(equator[side]!, equator[next]!, tip, gold, hot, coal)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const normalizedDirections = fragments.map((fragment) => new THREE.Vector3(...fragment.direction).normalize())
  geometry.userData['pfxEmberFragmentGeometry'] = 'single-draw-closed-ballistic-hot-coals'
  geometry.userData['pfxEmberFragmentDrawCalls'] = 1
  geometry.userData['pfxEmberFragmentCount'] = fragments.length
  geometry.userData['pfxEmberFragmentDepthCrossingCount'] = normalizedDirections.filter((direction) => Math.abs(direction.z) > 0.55).length
  geometry.userData['pfxEmberFragmentClosedFaces'] = true
  return geometry
}

export function createPfxEmberFragmentMaterial(
  opacity: number,
  _color: THREE.ColorRepresentation,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    // Vertex colors carry the heat ramp; multiplying them by the recipe's
    // orange tint crushed every face into one saturated red value.
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  material.userData['pfxEmberFragmentMaterial'] = 'solid-faceted-hot-coal-ramp'
  return material
}
