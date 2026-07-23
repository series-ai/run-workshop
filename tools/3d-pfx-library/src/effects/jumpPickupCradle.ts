import * as THREE from 'three'

export function createPfxJumpPickupCradleGeometry(
  color: THREE.ColorRepresentation = '#ffcf4d',
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const base = new THREE.Color(color)
  const shadow = base.clone().multiplyScalar(0.38)
  const body = base.clone().multiplyScalar(0.82)
  const highlight = base.clone().lerp(new THREE.Color('#ffffff'), 0.72)
  const push = (point: THREE.Vector3, value: THREE.Color) => {
    positions.push(point.x, point.y, point.z)
    colors.push(value.r, value.g, value.b)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, value: THREE.Color) => {
    push(a, value)
    push(b, value)
    push(c, value)
  }
  const coilTurns = 2.25
  const coilSegments = 18
  const tubeSides = 5
  const rings: THREE.Vector3[][] = []
  for (let segment = 0; segment <= coilSegments; segment += 1) {
    const progress = segment / coilSegments
    const angle = progress * coilTurns * Math.PI * 2 + 0.24
    const rx = 0.44 - progress * 0.08
    const rz = 0.3 - progress * 0.045
    const center = new THREE.Vector3(Math.cos(angle) * rx, 0.06 + progress * 0.55, Math.sin(angle) * rz)
    const radial = new THREE.Vector3(Math.cos(angle) / rx, 0, Math.sin(angle) / rz).normalize()
    const tangent = new THREE.Vector3(-Math.sin(angle) * rx, 0.55 / (coilTurns * Math.PI * 2), Math.cos(angle) * rz).normalize()
    const binormal = new THREE.Vector3().crossVectors(tangent, radial).normalize()
    const tubeRadius = 0.055 + (1 - progress) * 0.008
    const ring: THREE.Vector3[] = []
    for (let side = 0; side < tubeSides; side += 1) {
      const tubeAngle = (side / tubeSides) * Math.PI * 2
      ring.push(
        center.clone()
          .addScaledVector(radial, Math.cos(tubeAngle) * tubeRadius)
          .addScaledVector(binormal, Math.sin(tubeAngle) * tubeRadius),
      )
    }
    rings.push(ring)
  }
  for (let segment = 0; segment < coilSegments; segment += 1) {
    for (let side = 0; side < tubeSides; side += 1) {
      const next = (side + 1) % tubeSides
      const value = side === 0 ? highlight : side < 3 ? body : shadow
      triangle(rings[segment]![side]!, rings[segment + 1]![side]!, rings[segment + 1]![next]!, value)
      triangle(rings[segment]![side]!, rings[segment + 1]![next]!, rings[segment]![next]!, value)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    pfxGeometry: 'jump-pickup-launch-cradle',
    coilTurns,
    coilSegments,
    tubeSides,
  }
  return geometry
}

export function createPfxJumpPickupCradleMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.MeshStandardMaterial {
  const base = new THREE.Color(color)
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: base.clone().multiplyScalar(0.62),
    emissiveIntensity: 0.96,
    roughness: 0.26,
    metalness: 0.24,
    flatShading: true,
    transparent: true,
    opacity,
    depthWrite: true,
    side: THREE.DoubleSide,
  })
  material.userData = { pfxMaterial: 'jump-pickup-shaded-launch-cradle' }
  return material
}
