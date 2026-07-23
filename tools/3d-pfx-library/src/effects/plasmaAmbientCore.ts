import * as THREE from 'three'

export function createPfxPlasmaAmbientCoreGeometry(): THREE.BufferGeometry {
  const base = new THREE.DodecahedronGeometry(0.5, 0)
  const geometry = base.index ? base.toNonIndexed() : base
  geometry.scale(0.86, 1.12, 0.92)
  geometry.rotateY(0.32)
  geometry.rotateZ(-0.12)
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const palette: ReadonlyArray<readonly [number, number, number]> = [
    [0.2, 0.72, 1],
    [0.5, 0.94, 1],
    [0.08, 0.38, 0.94],
    [0.88, 1, 1],
  ]
  const colors: number[] = []
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const face = Math.floor(vertex / 3)
    const color = palette[(face * 3 + Math.floor(face / 2)) % palette.length]!
    colors.push(...color)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPlasmaAmbientGeometry'] = 'single-draw-faceted-contained-nucleus'
  geometry.userData['pfxPlasmaAmbientDrawCalls'] = 1
  geometry.userData['pfxPlasmaAmbientClosedCore'] = true
  geometry.userData['pfxPlasmaAmbientFacetPaletteSize'] = palette.length
  if (geometry !== base) base.dispose()
  return geometry
}

export function createPfxPlasmaAmbientCoreMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#0878d8',
    emissiveIntensity: 1.35,
    roughness: 0.24,
    metalness: 0.08,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxPlasmaAmbientMaterial'] = 'faceted-contained-plasma'
  return material
}
