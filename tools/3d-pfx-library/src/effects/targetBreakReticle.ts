import * as THREE from 'three'

export function createPfxTargetBreakReticleGeometry(
  color: THREE.ColorRepresentation = '#72d9ff',
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const base = new THREE.Color(color)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.7)
  const shadow = base.clone().multiplyScalar(0.38)
  const push = (point: THREE.Vector3, value: THREE.Color) => {
    positions.push(point.x, point.y, point.z)
    colors.push(value.r, value.g, value.b)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, value: THREE.Color) => {
    push(a, value)
    push(b, value)
    push(c, value)
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, value: THREE.Color) => {
    triangle(a, b, c, value)
    triangle(a, c, d, value)
  }
  const radialSegments = 48
  for (let segment = 0; segment < radialSegments; segment += 1) {
    // Four small gaps make the ring read as an acquisition reticle rather
    // than a decorative halo and leave visual room for the cardinal brackets.
    const cardinalPhase = segment % (radialSegments / 4)
    if (cardinalPhase <= 1 || cardinalPhase >= radialSegments / 4 - 1) continue
    const a0 = (segment / radialSegments) * Math.PI * 2
    const a1 = ((segment + 1) / radialSegments) * Math.PI * 2
    const inner = 0.67
    const outer = 0.72
    quad(
      new THREE.Vector3(Math.cos(a0) * inner, Math.sin(a0) * inner, 0),
      new THREE.Vector3(Math.cos(a0) * outer, Math.sin(a0) * outer, 0),
      new THREE.Vector3(Math.cos(a1) * outer, Math.sin(a1) * outer, 0),
      new THREE.Vector3(Math.cos(a1) * inner, Math.sin(a1) * inner, 0),
      segment % 3 === 0 ? pale : base,
    )
  }
  const bracketCount = 4
  for (let bracket = 0; bracket < bracketCount; bracket += 1) {
    const angle = bracket * Math.PI * 0.5
    const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0)
    const corner = radial.clone().multiplyScalar(0.82)
    const halfWidth = 0.17
    const thickness = 0.035
    const inner = corner.clone().addScaledVector(radial, -0.19)
    const outer = corner.clone().addScaledVector(radial, 0.02)
    quad(
      outer.clone().addScaledVector(tangent, -halfWidth),
      outer.clone().addScaledVector(tangent, -halfWidth + thickness),
      inner.clone().addScaledVector(tangent, -halfWidth + thickness),
      inner.clone().addScaledVector(tangent, -halfWidth),
      pale,
    )
    quad(
      inner.clone().addScaledVector(tangent, -halfWidth),
      inner.clone().addScaledVector(tangent, halfWidth),
      inner.clone().addScaledVector(radial, thickness).addScaledVector(tangent, halfWidth),
      inner.clone().addScaledVector(radial, thickness).addScaledVector(tangent, -halfWidth),
      base,
    )
    // Recessed registration tick gives the bracket a second value band.
    const tickCenter = radial.clone().multiplyScalar(0.91)
    quad(
      tickCenter.clone().addScaledVector(tangent, -0.055),
      tickCenter.clone().addScaledVector(tangent, 0.055),
      tickCenter.clone().addScaledVector(radial, 0.018).addScaledVector(tangent, 0.055),
      tickCenter.clone().addScaledVector(radial, 0.018).addScaledVector(tangent, -0.055),
      shadow,
    )
  }
  const cancellationBars = 2
  for (const diagonal of [-1, 1]) {
    const start = new THREE.Vector3(-0.34, diagonal * -0.34, 0)
    const end = new THREE.Vector3(0.34, diagonal * 0.34, 0)
    const direction = end.clone().sub(start).normalize()
    const normal = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar(0.022)
    quad(
      start.clone().add(normal),
      end.clone().add(normal),
      end.clone().sub(normal),
      start.clone().sub(normal),
      pale,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxTargetBreakReticleGeometry'] = 'single-draw-segmented-lock-and-clear-wave'
  geometry.userData['pfxTargetBreakReticleDrawCalls'] = 1
  geometry.userData['pfxTargetBreakReticleBracketCount'] = bracketCount
  geometry.userData['pfxTargetBreakReticleRadialSegments'] = radialSegments
  geometry.userData['pfxTargetBreakReticleCancellationBars'] = cancellationBars
  return geometry
}

export function createPfxTargetBreakReticleMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxTargetBreakReticleMaterial'] = 'luminous-segmented-ground-lock'
  return material
}
