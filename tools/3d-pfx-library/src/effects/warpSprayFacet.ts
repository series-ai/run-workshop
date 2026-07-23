import * as THREE from 'three'

export function createPfxWarpSprayFacetGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const palette = [
    new THREE.Color('#e8fbff'),
    new THREE.Color('#76cfff'),
    new THREE.Color('#a98cff'),
  ] as const
  const layout = [
    { position: [-0.98, 0.12, -0.42], angle: 1.42, length: 0.32, palette: 0 },
    { position: [-0.68, 0.62, 0.18], angle: 0.82, length: 0.26, palette: 1 },
    { position: [-0.18, 0.78, -0.16], angle: 0.18, length: 0.24, palette: 2 },
    { position: [0.46, 0.66, 0.42], angle: -0.48, length: 0.3, palette: 0 },
    { position: [0.96, 0.18, -0.34], angle: -1.14, length: 0.34, palette: 1 },
    { position: [0.72, -0.48, 0.16], angle: -2.12, length: 0.27, palette: 2 },
    { position: [0.12, -0.64, -0.42], angle: -2.72, length: 0.25, palette: 0 },
    { position: [-0.54, -0.46, 0.38], angle: 2.74, length: 0.29, palette: 1 },
  ] as const
  const primitive = new THREE.TetrahedronGeometry(1, 0)
  const rawPositions = primitive.getAttribute('position')
  const rawNormals = primitive.getAttribute('normal')
  for (const facet of layout) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...facet.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(facet.angle * 0.16, 0.24, facet.angle)),
      new THREE.Vector3(facet.length, 0.075, 0.12),
    )
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    const color = palette[facet.palette]
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      const glint = vertexIndex % 3 === 0 ? 1 : 0.82
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      colors.push(color.r * glint, color.g * glint, color.b * glint)
    }
  }
  primitive.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWarpSprayDrawCalls'] = 1
  geometry.userData['pfxWarpSprayClosedFaces'] = true
  geometry.userData['pfxWarpSprayBillboardCount'] = 0
  geometry.userData['pfxWarpSprayFacetCount'] = layout.length
  geometry.userData['pfxWarpSprayDepthLaneCount'] = 4
  geometry.userData['pfxWarpSpraySilhouetteProfile'] = 'eight-tangential-space-facets-orbiting-across-four-depth-lanes'
  geometry.userData['pfxWarpSprayPalette'] = 'warp-cyan-cold-lilac-ivory-glint'
  geometry.userData['pfxWarpSprayAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxWarpSprayTriangleCount'] = positions.length / 9
  geometry.userData['pfxWarpSprayWidthSpan'] = 2.18
  geometry.userData['pfxWarpSprayHeightSpan'] = 1.58
  geometry.userData['pfxWarpSprayDepthSpan'] = 1.08
  return geometry
}

export function createPfxWarpSprayFacetMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#2f9dff',
    emissiveIntensity: 0.48,
    roughness: 0.28,
    metalness: 0.12,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxWarpSprayFacetMaterial'] = 'cold-cyan-faceted-space-displacement'
  material.userData['pfxWarpSprayAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
