import * as THREE from 'three'

export function createPfxIceImpactChipGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const pivots: number[] = []
  const revealOrders: number[] = []
  const activePivot = new THREE.Vector3()
  let activeRevealOrder = 0
  const white: readonly [number, number, number] = [0.95, 1, 1]
  const pale: readonly [number, number, number] = [0.55, 0.9, 1]
  const cyan: readonly [number, number, number] = [0.16, 0.61, 0.88]
  const blue: readonly [number, number, number] = [0.035, 0.25, 0.58]
  const palette = [white, pale, cyan, blue] as const
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      pivots.push(activePivot.x, activePivot.y, activePivot.z)
      revealOrders.push(activeRevealOrder)
    }
  }
  const chips = [
    { center: [0.15, 0.78, 0.18], axis: [0.28, 0.92, 0.26], length: 0.34, width: 0.085, sides: 4 },
    { center: [-0.42, 0.58, 0.28], axis: [-0.7, 0.58, 0.42], length: 0.3, width: 0.075, sides: 3 },
    { center: [0.46, 0.48, -0.22], axis: [0.72, 0.56, -0.4], length: 0.38, width: 0.09, sides: 4 },
    { center: [-0.18, 0.92, -0.36], axis: [-0.22, 0.78, -0.58], length: 0.27, width: 0.07, sides: 3 },
    { center: [0.62, 0.26, 0.12], axis: [0.88, 0.38, 0.18], length: 0.32, width: 0.08, sides: 4 },
    { center: [-0.58, 0.28, -0.18], axis: [-0.86, 0.42, -0.28], length: 0.29, width: 0.075, sides: 3 },
    { center: [0.05, 0.38, 0.52], axis: [0.08, 0.5, 0.86], length: 0.35, width: 0.082, sides: 4 },
  ] as const
  chips.forEach((chip, chipIndex) => {
    const center = new THREE.Vector3(...chip.center)
    activePivot.copy(center)
    activeRevealOrder = 0.3 + chipIndex * 0.09
    const axis = new THREE.Vector3(...chip.axis).normalize()
    const basisA = axis.clone().cross(Math.abs(axis.y) > 0.88 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
    const basisB = axis.clone().cross(basisA).normalize()
    const head = center.clone().addScaledVector(axis, chip.length * 0.58)
    const tail = center.clone().addScaledVector(axis, -chip.length * 0.42)
    const ring = Array.from({ length: chip.sides }, (_, corner) => {
      const angle = corner / chip.sides * Math.PI * 2 + chipIndex * 0.37
      const radius = chip.width * (0.78 + ((corner + chipIndex * 2) % 3) * 0.11)
      return center.clone()
        .addScaledVector(basisA, Math.cos(angle) * radius)
        .addScaledVector(basisB, Math.sin(angle) * radius * (0.72 + (corner % 2) * 0.18))
    })
    for (let face = 0; face < chip.sides; face += 1) {
      const next = (face + 1) % chip.sides
      const faceColor = palette[(face + chipIndex) % palette.length]!
      const nextColor = palette[(face + chipIndex + 1) % palette.length]!
      pushTriangle(head, ring[face]!, ring[next]!, white, faceColor, nextColor)
      pushTriangle(tail, ring[next]!, ring[face]!, blue, nextColor, faceColor)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxIcePivot', new THREE.Float32BufferAttribute(pivots, 3))
  geometry.setAttribute('pfxIceRevealOrder', new THREE.Float32BufferAttribute(revealOrders, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxIceImpactChipGeometry'] = 'single-draw-seven-closed-asymmetric-ballistic-ice-chips'
  geometry.userData['pfxIceImpactChipDrawCalls'] = 1
  geometry.userData['pfxIceImpactChipCount'] = chips.length
  geometry.userData['pfxIceImpactChipClosedFaces'] = true
  geometry.userData['pfxIceImpactChipWorldSpaceVolume'] = true
  geometry.userData['pfxIceImpactChipAsymmetric'] = true
  geometry.userData['pfxIceImpactChipDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}
