import * as THREE from 'three'

export function createPfxWindPressureGeometry(radialSegments = 8, axialSegments = 24): THREE.BufferGeometry {
  const radial = Math.max(6, Math.floor(radialSegments))
  const axial = Math.max(16, Math.floor(axialSegments))
  const tipRadius = 0.01
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const paths: Array<{ width: number; points: Array<[number, number, number]> }> = [
    { width: 1, points: [[-1.48, 0.3, -0.1], [-0.88, 0.46, -0.08], [-0.24, 0.34, -0.02], [0.4, 0.12, 0.04], [1.08, 0.2, 0.1]] },
    { width: 0.86, points: [[-1.4, -0.04, 0.2], [-0.78, 0.03, 0.24], [-0.16, 0.06, 0.15], [0.46, 0.03, 0.05], [1.14, -0.06, 0.12]] },
    { width: 0.78, points: [[-1.3, -0.32, -0.16], [-0.72, -0.22, -0.2], [-0.12, -0.14, -0.1], [0.48, -0.04, 0], [1.02, -0.16, 0.16]] },
  ]
  const cool = new THREE.Color('#9aadaf')
  const hot = new THREE.Color('#f0f5f2')

  // The gust body is an elliptical pressure shell: broad and soft at the
  // intake, sharply compressed at contact. A slight vertical/depth drift
  // keeps it volumetric from oblique cameras without obscuring its direction.
  const shellRadial = Math.max(12, radial * 2)
  const shellAxial = Math.max(18, axial)
  const shellStart = positions.length / 3
  for (let ring = 0; ring <= shellAxial; ring += 1) {
    const t = ring / shellAxial
    const eased = t * t * (3 - 2 * t)
    const x = THREE.MathUtils.lerp(-1.42, 0.38, t)
    const centerY = 0.04 + Math.sin(t * Math.PI) * 0.035
    const centerZ = Math.sin(t * Math.PI) * 0.045
    const radiusY = THREE.MathUtils.lerp(0.52, 0.115, eased)
    const radiusZ = THREE.MathUtils.lerp(0.39, 0.1, eased)
    const shellColor = cool.clone().lerp(hot, Math.pow(t, 2.2) * 0.9)
    for (let side = 0; side < shellRadial; side += 1) {
      const angle = (side / shellRadial) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      positions.push(x, centerY + cos * radiusY, centerZ + sin * radiusZ)
      const normal = new THREE.Vector3(0.22, cos / radiusY, sin / radiusZ).normalize()
      normals.push(normal.x, normal.y, normal.z)
      colors.push(shellColor.r, shellColor.g, shellColor.b)
      uvs.push(t, side / shellRadial)
    }
  }
  for (let ring = 0; ring < shellAxial; ring += 1) {
    for (let side = 0; side < shellRadial; side += 1) {
      const next = (side + 1) % shellRadial
      const a = shellStart + ring * shellRadial + side
      const b = shellStart + ring * shellRadial + next
      const c = shellStart + (ring + 1) * shellRadial + next
      const d = shellStart + (ring + 1) * shellRadial + side
      indices.push(a, d, b, b, d, c)
    }
  }

  for (const [streamIndex, path] of paths.entries()) {
    const curve = new THREE.CatmullRomCurve3(path.points.map((point) => new THREE.Vector3(...point)), false, 'centripetal')
    const centers = Array.from({ length: axial + 1 }, (_, index) => curve.getPoint(index / axial))
    const tangents = Array.from({ length: axial + 1 }, (_, index) => curve.getTangent(index / axial).normalize())
    const preferredWidth = streamIndex === 1 ? new THREE.Vector3(0, 0.55, 1) : new THREE.Vector3(0, 1, streamIndex === 2 ? 0.28 : -0.12)
    let transportedAxis = preferredWidth.clone().addScaledVector(tangents[0]!, -preferredWidth.dot(tangents[0]!)).normalize()
    const vertexStart = positions.length / 3
    for (let ring = 0; ring <= axial; ring += 1) {
      const t = ring / axial
      const tangent = tangents[ring]!
      if (ring > 0) {
        const projected = transportedAxis.clone().addScaledVector(tangent, -transportedAxis.dot(tangent))
        if (projected.lengthSq() > 1e-6) transportedAxis = projected.normalize()
      }
      const width = tipRadius + Math.pow(Math.sin(Math.PI * t), 0.72) * 0.074 * path.width
      const faceNormal = new THREE.Vector3().crossVectors(tangent, transportedAxis).normalize()
      const brightness = 0.2 + Math.pow(Math.sin(Math.PI * t), 2.2) * 0.8
      const color = cool.clone().lerp(hot, brightness)
      for (const side of [-1, 1] as const) {
        const point = centers[ring]!.clone().addScaledVector(transportedAxis, width * side)
        positions.push(point.x, point.y, point.z)
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z)
        colors.push(color.r, color.g, color.b)
        uvs.push(t, 1 + streamIndex + (side + 1) * 0.25)
      }
    }
    for (let ring = 0; ring < axial; ring += 1) {
      const a = vertexStart + ring * 2
      const b = a + 1
      const c = vertexStart + (ring + 1) * 2 + 1
      const d = vertexStart + (ring + 1) * 2
      indices.push(a, d, b, b, d, c)
    }
  }

  // An open toroidal pressure crescent replaces a generic luminous core. It
  // is edge-on from the primary view but exposes a broad compressed-air
  // cross-section when the camera looks down the travel axis.
  const crescentArc = Math.PI * 1.3
  const crescentSegments = 30
  const crescentSides = Math.max(6, radial)
  const crescentStart = positions.length / 3
  const crescentRadius = 0.43
  const crescentTube = 0.028
  for (let segment = 0; segment <= crescentSegments; segment += 1) {
    const t = segment / crescentSegments
    const theta = -crescentArc * 0.5 + t * crescentArc
    const radialY = Math.cos(theta)
    const radialZ = Math.sin(theta)
    for (let side = 0; side < crescentSides; side += 1) {
      const phi = (side / crescentSides) * Math.PI * 2
      const axialNormal = Math.cos(phi)
      const ringNormal = Math.sin(phi)
      const ringRadius = crescentRadius + ringNormal * crescentTube
      positions.push(
        0.38 + axialNormal * crescentTube,
        0.045 + radialY * ringRadius,
        radialZ * ringRadius,
      )
      normals.push(axialNormal, radialY * ringNormal, radialZ * ringNormal)
      const brightness = 0.52 + Math.sin(t * Math.PI) * 0.48
      const color = cool.clone().lerp(hot, brightness)
      colors.push(color.r, color.g, color.b)
      uvs.push(t, 5 + side / crescentSides)
    }
  }
  for (let segment = 0; segment < crescentSegments; segment += 1) {
    for (let side = 0; side < crescentSides; side += 1) {
      const next = (side + 1) % crescentSides
      const a = crescentStart + segment * crescentSides + side
      const b = crescentStart + segment * crescentSides + next
      const c = crescentStart + (segment + 1) * crescentSides + next
      const d = crescentStart + (segment + 1) * crescentSides + side
      indices.push(a, d, b, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWindPressureGeometry'] = 'single-draw-pressure-wedge-with-swept-streamlines'
  geometry.userData['pfxWindPressureStreamCount'] = paths.length
  geometry.userData['pfxWindPressureStreamProfile'] = 'parallel-swept-ribbons'
  geometry.userData['pfxWindPressureShell'] = 'wide-tail-to-contact-wedge'
  geometry.userData['pfxWindPressureFlowAxis'] = [1, 0.08, 0.04]
  geometry.userData['pfxWindPressureTaperedEnds'] = true
  geometry.userData['pfxWindPressureContactCore'] = 'open-pressure-crescent'
  geometry.userData['pfxWindPressureCrescentArc'] = crescentArc
  geometry.userData['pfxWindPressureCrescentTube'] = crescentTube
  geometry.userData['pfxWindPressureTipRadius'] = tipRadius
  geometry.userData['pfxWindPressureDrawCalls'] = 1
  return geometry
}

export function createPfxWindPressureMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      void main() {
        vColor = color;
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 1.35);
        float body = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x));
        float isCrescent = step(4.0, vUv.y);
        float isStream = step(1.0, vUv.y) * (1.0 - isCrescent);
        float shellAlpha = mix(0.02 + rim * 0.1, 0.08 + rim * 0.15, body);
        float alpha = mix(shellAlpha, 0.52 + rim * 0.28, isStream);
        alpha = mix(alpha, 0.18 + rim * 0.34, isCrescent);
        vec3 shaded = uColor * vColor * (0.72 + rim * 0.78 + body * 0.24);
        gl_FragColor = vec4(shaded, alpha * uOpacity);
      }
    `,
  })
}
