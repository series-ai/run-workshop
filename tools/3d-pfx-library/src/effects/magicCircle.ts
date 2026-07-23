import * as THREE from 'three'

export function createPfxMagicCircleGeometry(
  color: THREE.ColorRepresentation = '#74d7ff',
  style: 'standard' | 'curse-binding' = 'standard',
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const alphas: number[] = []
  const base = new THREE.Color(color)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.72)
  const arcane = base.clone().lerp(new THREE.Color('#c58cff'), 0.42)
  const push = (point: THREE.Vector3, value: THREE.Color, alpha: number) => {
    const visibleValue = style === 'curse-binding'
      ? value.clone().multiplyScalar(0.28 + alpha * 0.72)
      : value
    positions.push(point.x, point.y, point.z)
    colors.push(visibleValue.r, visibleValue.g, visibleValue.b)
    alphas.push(alpha)
  }
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, value: THREE.Color, alpha = 1) => {
    push(a, value, alpha)
    push(b, value, alpha)
    push(c, value, alpha)
  }
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    value: THREE.Color,
    alpha = 1,
  ) => {
    triangle(a, b, c, value, alpha)
    triangle(a, c, d, value, alpha)
  }
  const groundY = 0.018
  const addAnnulus = (innerRadius: number, outerRadius: number, value: THREE.Color, alpha = 1, segments = 48) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = (segment / segments) * Math.PI * 2
      const a1 = ((segment + 1) / segments) * Math.PI * 2
      quad(
        new THREE.Vector3(Math.cos(a0) * innerRadius, groundY, Math.sin(a0) * innerRadius),
        new THREE.Vector3(Math.cos(a1) * innerRadius, groundY, Math.sin(a1) * innerRadius),
        new THREE.Vector3(Math.cos(a1) * outerRadius, groundY, Math.sin(a1) * outerRadius),
        new THREE.Vector3(Math.cos(a0) * outerRadius, groundY, Math.sin(a0) * outerRadius),
        value,
        alpha,
      )
    }
  }
  const addGroundStroke = (start: THREE.Vector2, end: THREE.Vector2, width: number, value: THREE.Color) => {
    const direction = end.clone().sub(start).normalize()
    const normal = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(width * 0.5)
    const glowNormal = normal.clone().multiplyScalar(3.2)
    quad(
      new THREE.Vector3(start.x + glowNormal.x, groundY - 0.002, start.y + glowNormal.y),
      new THREE.Vector3(end.x + glowNormal.x, groundY - 0.002, end.y + glowNormal.y),
      new THREE.Vector3(end.x - glowNormal.x, groundY - 0.002, end.y - glowNormal.y),
      new THREE.Vector3(start.x - glowNormal.x, groundY - 0.002, start.y - glowNormal.y),
      value,
      0.1,
    )
    quad(
      new THREE.Vector3(start.x + normal.x, groundY, start.y + normal.y),
      new THREE.Vector3(end.x + normal.x, groundY, end.y + normal.y),
      new THREE.Vector3(end.x - normal.x, groundY, end.y - normal.y),
      new THREE.Vector3(start.x - normal.x, groundY, start.y - normal.y),
      value,
      0.92,
    )
  }
  const addPolygon = (radius: number, rotation: number, value: THREE.Color) => {
    const points = [0, 1, 2].map((index) => {
      const angle = rotation + (index / 3) * Math.PI * 2
      return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius)
    })
    for (let edge = 0; edge < points.length; edge += 1) {
      addGroundStroke(points[edge]!, points[(edge + 1) % points.length]!, 0.026, value)
    }
  }
  const addUprightStroke = (
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    start: THREE.Vector2,
    end: THREE.Vector2,
    width: number,
    value: THREE.Color,
  ) => {
    const direction = end.clone().sub(start).normalize()
    const normal = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(width * 0.5)
    const point = (source: THREE.Vector2) => center.clone()
      .addScaledVector(tangent, source.x)
      .add(new THREE.Vector3(0, source.y, 0))
    const radial = center.clone().setY(0).normalize().multiplyScalar(width * 0.55)
    const a = point(start.clone().add(normal))
    const b = point(end.clone().add(normal))
    const c = point(end.clone().sub(normal))
    const d = point(start.clone().sub(normal))
    const backA = a.clone().sub(radial)
    const backB = b.clone().sub(radial)
    const backC = c.clone().sub(radial)
    const backD = d.clone().sub(radial)
    const frontA = a.clone().add(radial)
    const frontB = b.clone().add(radial)
    const frontC = c.clone().add(radial)
    const frontD = d.clone().add(radial)
    quad(frontA, frontB, frontC, frontD, value, 0.96)
    quad(backD, backC, backB, backA, value, 0.72)
    quad(frontA, backA, backB, frontB, value, 0.56)
    quad(frontB, backB, backC, frontC, value, 0.56)
    quad(frontC, backC, backD, frontD, value, 0.56)
    quad(frontD, backD, backA, frontA, value, 0.56)
  }
  const addWitnessObelisk = (
    angle: number,
    radius: number,
    height: number,
    halfWidth: number,
    leanTangent: number,
    leanRadial: number,
    value: THREE.Color,
  ) => {
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const center = radial.clone().multiplyScalar(radius).setY(groundY)
    const depth = halfWidth * 0.72
    const corner = (tangentScale: number, radialScale: number, y: number, lean = 0) => center.clone()
      .addScaledVector(tangent, tangentScale)
      .addScaledVector(radial, radialScale)
      .addScaledVector(tangent, leanTangent * lean)
      .addScaledVector(radial, leanRadial * lean)
      .setY(y)
    const bottom = [
      corner(-halfWidth, -depth, groundY),
      corner(halfWidth, -depth, groundY),
      corner(halfWidth, depth, groundY),
      corner(-halfWidth, depth, groundY),
    ]
    const shoulderY = groundY + height * 0.76
    const shoulder = [
      corner(-halfWidth * 0.7, -depth * 0.7, shoulderY, 0.76),
      corner(halfWidth * 0.7, -depth * 0.7, shoulderY, 0.76),
      corner(halfWidth * 0.7, depth * 0.7, shoulderY, 0.76),
      corner(-halfWidth * 0.7, depth * 0.7, shoulderY, 0.76),
    ]
    const apex = center.clone()
      .addScaledVector(tangent, leanTangent + halfWidth * 0.16)
      .addScaledVector(radial, leanRadial)
      .setY(groundY + height)
    for (let face = 0; face < 4; face += 1) {
      const next = (face + 1) % 4
      const faceColor = face === 2 ? pale : face % 2 === 0 ? value : value.clone().multiplyScalar(0.58)
      quad(bottom[face]!, bottom[next]!, shoulder[next]!, shoulder[face]!, faceColor, face === 2 ? 0.96 : 0.78)
      triangle(shoulder[face]!, shoulder[next]!, apex, faceColor, face === 2 ? 1 : 0.82)
    }
    const strokeCenter = center.clone().addScaledVector(radial, depth * 1.04)
    addUprightStroke(
      strokeCenter,
      tangent,
      new THREE.Vector2(-halfWidth * 0.35, height * 0.18),
      new THREE.Vector2(halfWidth * 0.32, height * 0.62),
      Math.max(0.018, halfWidth * 0.2),
      pale,
    )
  }

  addAnnulus(0.8, 0.97, base, 0.1)
  addAnnulus(0.86, 0.91, pale, 0.96)
  addAnnulus(0.5, 0.62, arcane, 0.09)
  addAnnulus(0.55, 0.575, base, 0.9)
  for (let segment = 0; segment < 48; segment += 1) {
    const a0 = (segment / 48) * Math.PI * 2
    const a1 = ((segment + 1) / 48) * Math.PI * 2
    triangle(
      new THREE.Vector3(0, groundY - 0.004, 0),
      new THREE.Vector3(Math.cos(a0) * 0.5, groundY - 0.004, Math.sin(a0) * 0.5),
      new THREE.Vector3(Math.cos(a1) * 0.5, groundY - 0.004, Math.sin(a1) * 0.5),
      base,
      0.055,
    )
  }
  addPolygon(0.45, Math.PI / 2, arcane)
  addPolygon(0.45, -Math.PI / 2, arcane)
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = (spoke / 8) * Math.PI * 2
    addGroundStroke(
      new THREE.Vector2(Math.cos(angle) * 0.18, Math.sin(angle) * 0.18),
      new THREE.Vector2(Math.cos(angle) * 0.51, Math.sin(angle) * 0.51),
      0.014,
      spoke % 2 === 0 ? pale : base,
    )
  }
  for (let rune = 0; rune < 12; rune += 1) {
    const angle = (rune / 12) * Math.PI * 2
    const radial = new THREE.Vector2(Math.cos(angle), Math.sin(angle))
    const tangent = new THREE.Vector2(-Math.sin(angle), Math.cos(angle))
    const center = radial.clone().multiplyScalar(0.71)
    const local = (tangentOffset: number, radialOffset: number) => center.clone()
      .addScaledVector(tangent, tangentOffset)
      .addScaledVector(radial, radialOffset)
    const value = rune % 3 === 0 ? arcane : rune % 2 === 0 ? pale : base
    addGroundStroke(local(-0.045, -0.075), local(-0.045, 0.075), 0.018, value)
    addGroundStroke(local(-0.05, 0.04), local(0.055, rune % 2 === 0 ? 0.075 : 0), 0.016, value)
    addGroundStroke(local(-0.01, -0.01), local(0.052, -0.075), 0.014, value)
  }
  if (style === 'curse-binding') {
    const witnesses = [
      { angle: 0.12, radius: 0.94, height: 0.82, halfWidth: 0.12, leanTangent: 0.18, leanRadial: -0.08 },
      { angle: 1.48, radius: 1.08, height: 0.42, halfWidth: 0.085, leanTangent: -0.12, leanRadial: 0.1 },
      { angle: 2.7, radius: 0.76, height: 0.7, halfWidth: 0.125, leanTangent: 0.08, leanRadial: -0.18 },
      { angle: 4.18, radius: 1.14, height: 0.5, halfWidth: 0.09, leanTangent: 0.16, leanRadial: 0.12 },
      { angle: 5.5, radius: 0.68, height: 0.9, halfWidth: 0.135, leanTangent: -0.2, leanRadial: -0.1 },
    ]
    witnesses.forEach((witness, index) => {
      addWitnessObelisk(
        witness.angle,
        witness.radius,
        witness.height,
        witness.halfWidth,
        witness.leanTangent,
        witness.leanRadial,
        index % 2 === 0 ? arcane : base,
      )
    })
  } else {
    for (let rune = 0; rune < 6; rune += 1) {
      const angle = (rune / 6) * Math.PI * 2 + Math.PI / 6
      const center = new THREE.Vector3(Math.cos(angle) * 0.89, groundY, Math.sin(angle) * 0.89)
      const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
      const value = rune % 2 === 0 ? pale : arcane
      addUprightStroke(center, tangent, new THREE.Vector2(-0.07, 0.03), new THREE.Vector2(-0.07, 0.34), 0.022, value)
      addUprightStroke(center, tangent, new THREE.Vector2(-0.07, 0.3), new THREE.Vector2(0.09, 0.19), 0.02, value)
      addUprightStroke(center, tangent, new THREE.Vector2(-0.02, 0.16), new THREE.Vector2(0.08, 0.06), 0.018, value)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData = style === 'curse-binding'
    ? { pfxGeometry: 'curse-binding-seal', witnessCount: 5, asymmetricWitnesses: true, leaningWitnessCount: 5 }
    : { pfxGeometry: 'magic-circle', witnessCount: 6, asymmetricWitnesses: false }
  return geometry
}

export function createPfxMagicCircleMaterial(
  opacity: number,
  style: 'standard' | 'curse-binding' = 'standard',
): THREE.Material {
  if (style === 'curse-binding') {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#32104a',
      emissiveIntensity: 0.62,
      opacity,
      transparent: true,
      vertexColors: true,
      flatShading: true,
      roughness: 0.28,
      metalness: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
    material.userData = { pfxMaterial: 'curse-binding-faceted-standard' }
    return material
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
varying float vShade;
void main() {
  vColor = color;
  vAlpha = alpha;
  vShade = 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragmentShader: /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
varying float vShade;
void main() {
  gl_FragColor = vec4(vColor * 1.32 * vShade, vAlpha * uOpacity);
}
`,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
