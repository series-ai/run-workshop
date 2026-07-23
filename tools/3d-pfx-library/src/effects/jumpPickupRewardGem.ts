import * as THREE from 'three'

export function createPfxJumpPickupRewardGemGeometry(
  color: THREE.ColorRepresentation = '#fff4c2',
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const base = new THREE.Color(color)
  const values = [
    base.clone().multiplyScalar(0.46),
    base.clone().multiplyScalar(0.72),
    base.clone(),
    base.clone().lerp(new THREE.Color('#ffffff'), 0.72),
  ]
  const top = new THREE.Vector3(0, 0.52, 0)
  const bottom = new THREE.Vector3(0, -0.42, 0)
  const shoulder: THREE.Vector3[] = []
  const waist: THREE.Vector3[] = []
  for (let segment = 0; segment < 6; segment += 1) {
    const angle = (segment / 6) * Math.PI * 2 + 0.22
    shoulder.push(new THREE.Vector3(Math.cos(angle) * 0.38, 0.1, Math.sin(angle) * 0.24))
    waist.push(new THREE.Vector3(Math.cos(angle) * 0.24, -0.16, Math.sin(angle) * 0.16))
  }
  const push = (point: THREE.Vector3, value: THREE.Color) => {
    positions.push(point.x, point.y, point.z)
    colors.push(value.r, value.g, value.b)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, value: THREE.Color) => {
    push(a, value)
    push(b, value)
    push(c, value)
  }
  for (let face = 0; face < 6; face += 1) {
    const next = (face + 1) % 6
    triangle(top, shoulder[face]!, shoulder[next]!, values[(face + 2) % 4]!)
    triangle(shoulder[face]!, waist[face]!, waist[next]!, values[(face + 1) % 4]!)
    triangle(shoulder[face]!, waist[next]!, shoulder[next]!, values[(face + 3) % 4]!)
    triangle(bottom, waist[next]!, waist[face]!, values[face % 4]!)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    pfxGeometry: 'jump-pickup-faceted-reward-gem',
    facetCount: 24,
  }
  return geometry
}

export function createPfxJumpPickupRewardGemMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.MeshStandardMaterial {
  const base = new THREE.Color(color)
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: base.clone().multiplyScalar(0.34),
    emissiveIntensity: 1.28,
    roughness: 0.14,
    metalness: 0.32,
    flatShading: true,
    transparent: true,
    opacity,
    depthWrite: true,
  })
  material.userData = { pfxMaterial: 'jump-pickup-faceted-reward-gem' }
  return material
}
