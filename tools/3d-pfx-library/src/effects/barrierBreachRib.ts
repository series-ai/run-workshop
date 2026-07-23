import * as THREE from 'three'

export function createPfxBarrierBreachRibGeometry(): THREE.BufferGeometry {
  const outward = new THREE.Vector3(0.78, 0.18, 0.6).normalize()
  const tangentA = new THREE.Vector3(0, 1, 0)
    .addScaledVector(outward, -outward.y)
    .normalize()
  const tangentB = new THREE.Vector3().crossVectors(outward, tangentA).normalize()
  const point = (distance: number, offsetA: number, offsetB: number): readonly [number, number, number] =>
    outward.clone().multiplyScalar(distance)
      .addScaledVector(tangentA, offsetA)
      .addScaledVector(tangentB, offsetB)
      .toArray() as [number, number, number]
  const ribSpecs = [
    { offsetA: 0.18, offsetB: 0.02, length: 0.42, bendA: 0.05, bendB: 0.04, width: 0.05 },
    { offsetA: -0.15, offsetB: 0.06, length: 0.31, bendA: -0.04, bendB: 0.08, width: 0.04 },
    { offsetA: 0.02, offsetB: 0.17, length: 0.5, bendA: 0.08, bendB: 0.03, width: 0.055 },
    { offsetA: 0.05, offsetB: -0.16, length: 0.36, bendA: -0.02, bendB: -0.07, width: 0.035 },
  ] as const
  const ribs = ribSpecs.map((spec) => ({
    root: point(0, spec.offsetA, spec.offsetB),
    mid: point(spec.length * 0.48, spec.offsetA + spec.bendA * 0.55, spec.offsetB + spec.bendB * 0.55),
    tip: point(spec.length, spec.offsetA + spec.bendA, spec.offsetB + spec.bendB),
    width: spec.width,
    length: spec.length,
  }))
  const positions: number[] = []
  const colors: number[] = []
  const rootColor: readonly [number, number, number] = [1, 0.08, 0.14]
  const middleColor: readonly [number, number, number] = [0.8, 0.03, 0.04]
  const tipColor: readonly [number, number, number] = [0.25, 0.01, 0.08]
  const facetSides = 7
  const tipWidthRatio = 0.28
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...aColor, ...bColor, ...cColor)
  }

  for (const [ribIndex, rib] of ribs.entries()) {
    const centers = [new THREE.Vector3(...rib.root), new THREE.Vector3(...rib.mid), new THREE.Vector3(...rib.tip)]
    const widths = [rib.width * 0.85, rib.width, rib.width * tipWidthRatio]
    const ringColors = [rootColor, middleColor, tipColor] as const
    const rings = centers.map((center, centerIndex) => {
      const previous = centers[Math.max(0, centerIndex - 1)]!
      const next = centers[Math.min(centers.length - 1, centerIndex + 1)]!
      const direction = next.clone().sub(previous).normalize()
      const reference = Math.abs(direction.y) > 0.86 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
      const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
      const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
      return Array.from({ length: facetSides }, (_, sideIndex) => {
        const angle = ribIndex * 0.31 + sideIndex / facetSides * Math.PI * 2
        return center.clone()
          .addScaledVector(tangent, Math.cos(angle) * widths[centerIndex]!)
          .addScaledVector(bitangent, Math.sin(angle) * widths[centerIndex]!)
      })
    })
    for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
      for (let sideIndex = 0; sideIndex < facetSides; sideIndex += 1) {
        const nextSide = (sideIndex + 1) % facetSides
        pushTriangle(rings[ringIndex]![sideIndex]!, rings[ringIndex + 1]![sideIndex]!, rings[ringIndex]![nextSide]!, ringColors[ringIndex]!, ringColors[ringIndex + 1]!, ringColors[ringIndex]!)
        pushTriangle(rings[ringIndex]![nextSide]!, rings[ringIndex + 1]![sideIndex]!, rings[ringIndex + 1]![nextSide]!, ringColors[ringIndex]!, ringColors[ringIndex + 1]!, ringColors[ringIndex + 1]!)
      }
    }
    for (let sideIndex = 0; sideIndex < facetSides; sideIndex += 1) {
      const nextSide = (sideIndex + 1) % facetSides
      pushTriangle(centers[0]!, rings[0]![nextSide]!, rings[0]![sideIndex]!, rootColor, rootColor, rootColor)
      pushTriangle(centers[2]!, rings[2]![sideIndex]!, rings[2]![nextSide]!, tipColor, tipColor, tipColor)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxBarrierBreachGeometry'] = 'single-draw-closed-faceted-energy-ribs'
  geometry.userData['pfxBarrierBreachDrawCalls'] = 1
  geometry.userData['pfxBarrierBreachClosedFaces'] = true
  geometry.userData['pfxBarrierBreachRibCount'] = ribs.length
  geometry.userData['pfxBarrierBreachFacetSides'] = facetSides
  geometry.userData['pfxBarrierBreachTipWidthRatio'] = tipWidthRatio
  geometry.userData['pfxBarrierBreachCoreVertexCount'] = 0
  geometry.userData['pfxBarrierBreachInteriorStrutCount'] = 0
  geometry.userData['pfxBarrierBreachPalette'] = 'shield-crimson-strain-violet'
  geometry.userData['pfxBarrierBreachDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  const rootYs = ribs.map((rib) => rib.root[1])
  geometry.userData['pfxBarrierBreachRootSpan'] = Math.max(...rootYs) - Math.min(...rootYs)
  geometry.userData['pfxBarrierBreachSharedRoot'] = false
  geometry.userData['pfxBarrierBreachOutwardAlignment'] = Math.min(...ribs.map((rib) =>
    new THREE.Vector3(...rib.tip).sub(new THREE.Vector3(...rib.root)).normalize().dot(outward),
  ))
  const ribLengths = ribs.map((rib) => rib.length)
  geometry.userData['pfxBarrierBreachLengthVariance'] = Math.max(...ribLengths) - Math.min(...ribLengths)
  return geometry
}

export function createPfxBarrierBreachRibMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    emissive: '#7d0a18',
    emissiveIntensity: 1.25,
    roughness: 0.24,
    metalness: 0.08,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxMaterial'] = 'barrier-low-health-faceted-breach-ribs'
  return material
}
