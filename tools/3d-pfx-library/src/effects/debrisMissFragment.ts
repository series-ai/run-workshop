import * as THREE from 'three'

export function createPfxDebrisMissFragmentGeometry(): THREE.BufferGeometry {
  const fragments = [
    { center: [-0.08, 0.1, 0.02], radius: 0.18, scale: [1.25, 0.72, 0.92], rotation: [0.2, 0.45, 0.12] },
    { center: [-0.32, 0.27, 0.14], radius: 0.15, scale: [1.08, 0.82, 1.2], rotation: [0.72, 0.18, 0.48] },
    { center: [-0.52, 0.13, -0.24], radius: 0.14, scale: [1.3, 0.68, 0.88], rotation: [0.38, 0.92, 0.24] },
    { center: [-0.72, 0.4, 0.29], radius: 0.12, scale: [0.9, 1.18, 0.82], rotation: [0.86, 0.34, 0.67] },
    { center: [-0.91, 0.2, -0.36], radius: 0.1, scale: [1.22, 0.76, 1.05], rotation: [0.54, 1.12, 0.36] },
    { center: [-1.08, 0.08, 0.18], radius: 0.09, scale: [1.36, 0.64, 0.9], rotation: [0.28, 0.62, 0.92] },
    { center: [-1.22, 0.31, 0.42], radius: 0.08, scale: [0.88, 1.24, 1.08], rotation: [1.04, 0.4, 0.58] },
  ] as const
  const positions: number[] = []
  const colors: number[] = []
  const palette: ReadonlyArray<readonly [number, number, number]> = [
    [0.95, 0.72, 0.38],
    [0.78, 0.52, 0.26],
    [1, 0.84, 0.52],
    [0.62, 0.4, 0.22],
  ]
  for (const [fragmentIndex, fragment] of fragments.entries()) {
    const base = fragmentIndex % 2 === 0
      ? new THREE.TetrahedronGeometry(fragment.radius, 0)
      : new THREE.OctahedronGeometry(fragment.radius, 0)
    const source = base.index ? base.toNonIndexed() : base
    source.scale(fragment.scale[0], fragment.scale[1], fragment.scale[2])
    source.rotateX(fragment.rotation[0])
    source.rotateY(fragment.rotation[1])
    source.rotateZ(fragment.rotation[2])
    source.translate(fragment.center[0], fragment.center[1], fragment.center[2])
    const sourcePositions = source.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      positions.push(sourcePositions.getX(vertex), sourcePositions.getY(vertex), sourcePositions.getZ(vertex))
      const face = Math.floor(vertex / 3)
      const color = palette[(fragmentIndex + face) % palette.length]!
      colors.push(...color)
    }
    source.dispose()
    if (source !== base) base.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxDebrisMissGeometry'] = 'single-draw-closed-directional-rock-skip'
  geometry.userData['pfxDebrisMissDrawCalls'] = 1
  geometry.userData['pfxDebrisMissClosedFaces'] = true
  geometry.userData['pfxDebrisMissFragmentCount'] = fragments.length
  geometry.userData['pfxDebrisMissShapeVocabulary'] = 2
  geometry.userData['pfxDebrisMissTrajectorySpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxDebrisMissDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}

export function createPfxDebrisMissFragmentMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#6b3512',
    emissiveIntensity: 0.38,
    roughness: 0.68,
    metalness: 0.04,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxDebrisMissMaterial'] = 'rough-faceted-earth-stone'
  return material
}
