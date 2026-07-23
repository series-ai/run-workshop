import * as THREE from 'three'

export function createPfxDebrisReleaseFragmentGeometry(): THREE.BufferGeometry {
  const fragments = [
    { center: [-0.1, 0.08, 0.05], radius: 0.28, scale: [1.15, 1, 1.05], rotation: [0.18, 0.42, 0.12], shape: 'hero' },
    { center: [-0.55, 0.3, 0.28], radius: 0.2, scale: [1.25, 0.9, 1.05], rotation: [0.7, 0.2, 0.46], shape: 'slab' },
    { center: [-1.05, 0.58, -0.35], radius: 0.17, scale: [0.78, 1.3, 0.72], rotation: [0.36, 0.94, 0.22], shape: 'splinter' },
    { center: [-1.55, 0.28, 0.55], radius: 0.15, scale: [1.15, 0.9, 1], rotation: [0.88, 0.32, 0.66], shape: 'chunk' },
    { center: [-0.85, 0.78, 0.05], radius: 0.14, scale: [1.3, 0.76, 0.9], rotation: [0.52, 1.1, 0.34], shape: 'slab' },
    { center: [-1.35, 0.65, -0.1], radius: 0.12, scale: [0.7, 1.45, 0.62], rotation: [1.02, 0.38, 0.56], shape: 'splinter' },
    { center: [-1.7, 0.08, -0.55], radius: 0.13, scale: [1.15, 0.82, 1.05], rotation: [0.26, 0.64, 0.9], shape: 'chunk' },
    { center: [-2, 0.22, 0.38], radius: 0.1, scale: [1.25, 0.82, 0.95], rotation: [0.82, 0.74, 0.28], shape: 'slab' },
    { center: [-0.72, 0.45, 0.72], radius: 0.11, scale: [0.72, 1.35, 0.7], rotation: [0.46, 0.26, 1.04], shape: 'splinter' },
  ] as const
  const palette: ReadonlyArray<readonly [number, number, number]> = [
    [0.19, 0.11, 0.06],
    [0.43, 0.27, 0.14],
    [0.68, 0.47, 0.25],
    [0.92, 0.78, 0.55],
    [0.52, 0.34, 0.19],
  ]
  const positions: number[] = []
  const colors: number[] = []
  for (const [fragmentIndex, fragment] of fragments.entries()) {
    const base = fragment.shape === 'hero'
      ? new THREE.DodecahedronGeometry(fragment.radius, 0)
      : fragment.shape === 'slab'
      ? new THREE.DodecahedronGeometry(fragment.radius, 0)
      : fragment.shape === 'splinter'
      ? new THREE.IcosahedronGeometry(fragment.radius, 0)
      : new THREE.DodecahedronGeometry(fragment.radius, 0)
    const basePositions = base.getAttribute('position')
    for (let vertex = 0; vertex < basePositions.count; vertex += 1) {
      const x = basePositions.getX(vertex)
      const y = basePositions.getY(vertex)
      const z = basePositions.getZ(vertex)
      const radialWarp = 1 + Math.sin(
        x / fragment.radius * 4.7
        + y / fragment.radius * 3.1
        + z / fragment.radius * 5.3
        + fragmentIndex * 1.73,
      ) * 0.2
      const familyShear = fragment.shape === 'splinter'
        ? y * 0.2
        : fragment.shape === 'slab'
        ? z * 0.12
        : fragment.shape === 'chunk'
        ? -y * 0.1
        : z * 0.08
      basePositions.setXYZ(
        vertex,
        x * radialWarp + familyShear,
        y * (2 - radialWarp) + (fragment.shape === 'hero' ? x * 0.06 : 0),
        z * (0.94 + (radialWarp - 1) * 0.72) + (fragment.shape === 'chunk' ? x * 0.12 : 0),
      )
    }
    basePositions.needsUpdate = true
    base.computeVertexNormals()
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
      colors.push(...palette[(fragmentIndex * 2 + face) % palette.length]!)
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
  geometry.userData['pfxDebrisReleaseGeometry'] = 'single-draw-closed-parallax-rock-field'
  geometry.userData['pfxDebrisReleaseDrawCalls'] = 1
  geometry.userData['pfxDebrisReleaseClosedFaces'] = true
  geometry.userData['pfxDebrisReleaseFragmentCount'] = fragments.length
  geometry.userData['pfxDebrisReleaseShapeVocabulary'] = new Set(fragments.map((fragment) => fragment.shape)).size
  geometry.userData['pfxDebrisReleaseTrajectorySpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxDebrisReleaseDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxDebrisReleaseHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  const projectedAreas = fragments
    .map((fragment) => fragment.radius * fragment.radius * fragment.scale[0] * fragment.scale[1])
    .sort((a, b) => b - a)
  geometry.userData['pfxDebrisReleaseHeroAreaRatio'] = projectedAreas[0]! / projectedAreas[1]!
  geometry.userData['pfxDebrisReleaseDirectionalBias'] = fragments.slice(1).filter((fragment) => fragment.center[0] < -0.35).length / (fragments.length - 1)
  const luminances = palette.map((color) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722)
  geometry.userData['pfxDebrisReleaseValueRange'] = Math.max(...luminances) - Math.min(...luminances)
  geometry.userData['pfxDebrisReleaseWarpAmplitude'] = 0.2
  geometry.userData['pfxDebrisReleaseFarthestCenterRadius'] = Math.max(...fragments.map((fragment) => Math.hypot(...fragment.center)))
  geometry.userData['pfxDebrisReleaseDirectionalFanRatio'] = geometry.userData['pfxDebrisReleaseTrajectorySpan'] / geometry.userData['pfxDebrisReleaseHeightSpan']
  return geometry
}

export function createPfxDebrisReleaseFragmentMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#57351d',
    emissiveIntensity: 0.2,
    roughness: 0.68,
    metalness: 0.025,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxDebrisReleaseMaterial'] = 'rough-earth-fracture-face-stone'
  return material
}
