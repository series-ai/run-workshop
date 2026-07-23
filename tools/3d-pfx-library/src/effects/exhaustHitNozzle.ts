import * as THREE from 'three'

export function createPfxExhaustHitNozzleGeometry(): THREE.BufferGeometry {
  const sources: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }> = []
  const body = new THREE.CylinderGeometry(0.19, 0.24, 0.48, 12, 2, false).toNonIndexed()
  body.rotateZ(Math.PI / 2)
  body.translate(-0.2, 0, 0)
  sources.push({ geometry: body, color: new THREE.Color('#29445b') })
  const outlet = new THREE.TorusGeometry(0.24, 0.045, 8, 24).toNonIndexed()
  outlet.rotateY(Math.PI / 2)
  outlet.translate(0.045, 0, 0)
  sources.push({ geometry: outlet, color: new THREE.Color('#86d8ff') })
  const rear = new THREE.TorusGeometry(0.19, 0.026, 7, 20).toNonIndexed()
  rear.rotateY(Math.PI / 2)
  rear.translate(-0.43, 0, 0)
  sources.push({ geometry: rear, color: new THREE.Color('#477b9d') })
  const finCount = 4
  for (let fin = 0; fin < finCount; fin += 1) {
    const angle = (fin / finCount) * Math.PI * 2
    const geometry = new THREE.BoxGeometry(0.34, 0.055, 0.14).toNonIndexed()
    geometry.rotateX(angle)
    geometry.translate(-0.22, Math.cos(angle) * 0.235, Math.sin(angle) * 0.235)
    sources.push({ geometry, color: new THREE.Color(fin % 2 === 0 ? '#3d6e8f' : '#31546f') })
  }
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  for (const source of sources) {
    const position = source.geometry.getAttribute('position')
    const normal = source.geometry.getAttribute('normal')
    const uv = source.geometry.getAttribute('uv')
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index))
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index))
      uvs.push(uv.getX(index), uv.getY(index))
      colors.push(source.color.r, source.color.g, source.color.b)
    }
    source.geometry.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxExhaustHitNozzleGeometry'] = 'single-draw-closed-finned-axial-outlet'
  geometry.userData['pfxExhaustHitNozzleDrawCalls'] = 1
  geometry.userData['pfxExhaustHitNozzleClosedGeometry'] = true
  geometry.userData['pfxExhaustHitNozzleAxis'] = [1, 0, 0]
  geometry.userData['pfxExhaustHitNozzleFinCount'] = finCount
  return geometry
}

export function createPfxExhaustHitNozzleMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#0a3b5e',
    emissiveIntensity: 0.18,
    roughness: 0.2,
    metalness: 0.72,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxExhaustHitNozzleMaterial'] = 'finned-blue-metal-with-hot-outlet-rim'
  return material
}
