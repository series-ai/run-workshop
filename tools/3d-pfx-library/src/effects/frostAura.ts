import * as THREE from 'three'

export function createPfxFrostAuraGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const motionStrengths: number[] = []
  const motionPhases: number[] = []
  let activeMotionStrength = 0
  let activeMotionPhase = 0
  const white: readonly [number, number, number] = [0.76, 0.96, 1]
  const pale: readonly [number, number, number] = [0.48, 0.86, 1]
  const cyan: readonly [number, number, number] = [0.2, 0.68, 0.88]
  const blue: readonly [number, number, number] = [0.055, 0.34, 0.62]
  const deep: readonly [number, number, number] = [0.018, 0.14, 0.3]
  const palette = [white, pale, cyan, blue] as const
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
    motionStrengths.push(activeMotionStrength, activeMotionStrength, activeMotionStrength)
    motionPhases.push(activeMotionPhase, activeMotionPhase, activeMotionPhase)
  }
  const pushQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    nearColor: readonly [number, number, number],
    farColor: readonly [number, number, number],
  ) => {
    pushTriangle(a, b, c, nearColor, nearColor, farColor)
    pushTriangle(a, c, d, nearColor, farColor, farColor)
  }

  const rimeCrescentSegments = 5
  const plateAngles = Array.from(
    { length: rimeCrescentSegments + 1 },
    (_, index) => -2.7 + index / rimeCrescentSegments * 2.35,
  )
  for (let plateIndex = 0; plateIndex < rimeCrescentSegments; plateIndex += 1) {
    activeMotionStrength = 0
    activeMotionPhase = plateIndex / rimeCrescentSegments
    const angleA = plateAngles[plateIndex]!
    const angleB = plateAngles[plateIndex + 1]!
    const innerA = 0.46 + (plateIndex % 2) * 0.028
    const innerB = 0.46 + ((plateIndex + 1) % 2) * 0.028
    const outerA = 0.67 + (plateIndex % 3) * 0.025
    const outerB = 0.67 + ((plateIndex + 1) % 3) * 0.025
    const footprint = [
      new THREE.Vector3(Math.cos(angleA) * innerA, 0, Math.sin(angleA) * innerA),
      new THREE.Vector3(Math.cos(angleB) * innerB, 0, Math.sin(angleB) * innerB),
      new THREE.Vector3(Math.cos(angleB) * outerB, 0, Math.sin(angleB) * outerB),
      new THREE.Vector3(Math.cos(angleA) * outerA, 0, Math.sin(angleA) * outerA),
    ]
    const bottom = footprint.map((point) => point.clone().setY(0.005))
    const topHeight = 0.027 + (plateIndex % 3) * 0.006
    const top = footprint.map((point, index) => point.clone().setY(topHeight + (index >= 2 ? 0.01 : 0)))
    const topColor = plateIndex % 2 === 0 ? pale : cyan
    pushQuad(top[0]!, top[1]!, top[2]!, top[3]!, cyan, topColor)
    pushQuad(bottom[3]!, bottom[2]!, bottom[1]!, bottom[0]!, deep, deep)
    pushQuad(bottom[0]!, bottom[1]!, top[1]!, top[0]!, deep, blue)
    pushQuad(bottom[1]!, bottom[2]!, top[2]!, top[1]!, deep, cyan)
    pushQuad(bottom[2]!, bottom[3]!, top[3]!, top[2]!, deep, blue)
    pushQuad(bottom[3]!, bottom[0]!, top[0]!, top[3]!, deep, cyan)
  }

  const helicalTurns = 1.25
  const helixStrands = 2
  const segmentsPerStrand = 12
  const helixSegments = Array.from({ length: helixStrands * segmentsPerStrand }, (_, segmentIndex) => {
    const strand = Math.floor(segmentIndex / segmentsPerStrand)
    const strandIndex = segmentIndex % segmentsPerStrand
    const progress = strandIndex / (segmentsPerStrand - 1)
    const angle = -2.5 + progress * Math.PI * 2 * helicalTurns + strand * Math.PI
    return {
      angle,
      centerY: 0.3 + progress * 1.14 + strand * 0.035,
      radius: 0.45 + (strandIndex % 3) * 0.018 + strand * 0.014,
      span: [0.38, 0.56, 0.78, 0.98][strandIndex % 4]!,
      halfHeight: [0.04, 0.068, 0.052, 0.095][strandIndex % 4]!,
      depth: [0.05, 0.03, 0.04][(strandIndex + strand) % 3]!,
      phase: (progress + strand * 0.5) % 1,
    }
  })
  helixSegments.forEach((segment, segmentIndex) => {
    activeMotionStrength = 0.72 + (segmentIndex % 3) * 0.09
    activeMotionPhase = segment.phase
    const startAngle = segment.angle - segment.span * 0.5
    const endAngle = segment.angle + segment.span * 0.5
    const start = new THREE.Vector3(
      Math.cos(startAngle) * segment.radius,
      segment.centerY - 0.052,
      Math.sin(startAngle) * segment.radius,
    )
    const end = new THREE.Vector3(
      Math.cos(endAngle) * segment.radius,
      segment.centerY + 0.052,
      Math.sin(endAngle) * segment.radius,
    )
    const direction = end.clone().sub(start).normalize()
    const outward = new THREE.Vector3(Math.cos(segment.angle), 0, Math.sin(segment.angle))
    outward.addScaledVector(direction, -outward.dot(direction)).normalize()
    const vertical = direction.clone().cross(outward).normalize()
    const outer = outward.clone().multiplyScalar(segment.depth)
    const inner = outward.clone().multiplyScalar(-segment.depth * 0.82)
    const up = vertical.clone().multiplyScalar(segment.halfHeight)
    const shoulderStart = start.clone().lerp(end, 0.16)
    const shoulderEnd = start.clone().lerp(end, 0.84)
    const startCross = [
      shoulderStart.clone().add(outer).add(up),
      shoulderStart.clone().add(outer).sub(up),
      shoulderStart.clone().add(inner),
    ]
    const endCross = [
      shoulderEnd.clone().add(outer).add(up),
      shoulderEnd.clone().add(outer).sub(up),
      shoulderEnd.clone().add(inner),
    ]
    const midCenter = start.clone().lerp(end, 0.5)
    const midCross = [
      midCenter.clone().addScaledVector(outer, 1.22).addScaledVector(up, 0.82),
      midCenter.clone().addScaledVector(outer, 1.14).addScaledVector(up, -1.08),
      midCenter.clone().addScaledVector(inner, 1.16).addScaledVector(up, 0.12),
    ]
    const startTip = start.clone().addScaledVector(outward, segment.depth * 0.12)
    const endTip = end.clone().addScaledVector(outward, segment.depth * 0.12)
    const bright = segmentIndex % 3 === 0 ? white : pale
    const body = segmentIndex % 2 === 0 ? cyan : pale
    pushTriangle(startTip, startCross[1]!, startCross[0]!, white, blue, bright)
    pushTriangle(startTip, startCross[2]!, startCross[1]!, white, deep, blue)
    pushTriangle(startTip, startCross[0]!, startCross[2]!, white, bright, deep)
    pushQuad(startCross[0]!, startCross[1]!, midCross[1]!, midCross[0]!, bright, body)
    pushQuad(midCross[0]!, midCross[1]!, endCross[1]!, endCross[0]!, white, cyan)
    pushQuad(startCross[1]!, startCross[2]!, midCross[2]!, midCross[1]!, blue, cyan)
    pushQuad(midCross[1]!, midCross[2]!, endCross[2]!, endCross[1]!, cyan, pale)
    pushQuad(startCross[2]!, startCross[0]!, midCross[0]!, midCross[2]!, deep, body)
    pushQuad(midCross[2]!, midCross[0]!, endCross[0]!, endCross[2]!, blue, bright)
    pushTriangle(endTip, endCross[0]!, endCross[1]!, white, bright, cyan)
    pushTriangle(endTip, endCross[1]!, endCross[2]!, white, cyan, deep)
    pushTriangle(endTip, endCross[2]!, endCross[0]!, white, deep, bright)
  })

  const crustPieces = [
    { angle: -2.2, y: 0.38, radius: 0.39, length: 0.24, width: 0.1, sides: 5 },
    { angle: -0.72, y: 0.55, radius: 0.42, length: 0.18, width: 0.085, sides: 4 },
    { angle: 0.82, y: 0.72, radius: 0.4, length: 0.28, width: 0.11, sides: 5 },
    { angle: 2.08, y: 0.9, radius: 0.43, length: 0.21, width: 0.095, sides: 4 },
    { angle: -1.42, y: 1.12, radius: 0.41, length: 0.26, width: 0.105, sides: 5 },
    { angle: 0.18, y: 1.34, radius: 0.39, length: 0.19, width: 0.09, sides: 4 },
  ] as const
  crustPieces.forEach((piece, pieceIndex) => {
    activeMotionStrength = 0.58 + (pieceIndex % 3) * 0.1
    activeMotionPhase = pieceIndex / crustPieces.length
    const outward = new THREE.Vector3(Math.cos(piece.angle), 0, Math.sin(piece.angle))
    const tangent = new THREE.Vector3(-Math.sin(piece.angle), 0, Math.cos(piece.angle))
    const center = outward.clone().multiplyScalar(piece.radius).setY(piece.y)
    const axis = outward.clone().multiplyScalar(0.76)
      .addScaledVector(tangent, pieceIndex % 2 === 0 ? 0.24 : -0.2)
      .setY(0.36 + (pieceIndex % 2) * 0.16)
      .normalize()
    const basisA = axis.clone().cross(Math.abs(axis.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
    const basisB = axis.clone().cross(basisA).normalize()
    const head = center.clone().addScaledVector(axis, piece.length * 0.62)
    const tail = center.clone().addScaledVector(axis, -piece.length * 0.38)
    const ring = Array.from({ length: piece.sides }, (_, corner) => {
      const angle = corner / piece.sides * Math.PI * 2 + pieceIndex * 0.37
      const irregular = 0.78 + ((corner + pieceIndex) % 3) * 0.11
      return center.clone()
        .addScaledVector(basisA, Math.cos(angle) * piece.width * irregular)
        .addScaledVector(basisB, Math.sin(angle) * piece.width * (0.72 + (corner % 2) * 0.16))
    })
    for (let face = 0; face < piece.sides; face += 1) {
      const next = (face + 1) % piece.sides
      const faceColor = palette[(face + pieceIndex) % palette.length]!
      const nextColor = palette[(face + pieceIndex + 1) % palette.length]!
      pushTriangle(head, ring[face]!, ring[next]!, white, faceColor, nextColor)
      pushTriangle(tail, ring[next]!, ring[face]!, blue, nextColor, faceColor)
    }
  })

  const branchedClusters = [
    { angle: -1.82, y: 0.48, radius: 0.38 },
    { angle: 0.56, y: 0.82, radius: 0.39 },
    { angle: 2.38, y: 1.15, radius: 0.38 },
  ] as const
  branchedClusters.forEach((cluster, clusterIndex) => {
    const outward = new THREE.Vector3(Math.cos(cluster.angle), 0, Math.sin(cluster.angle))
    const tangent = new THREE.Vector3(-Math.sin(cluster.angle), 0, Math.cos(cluster.angle))
    const root = outward.clone().multiplyScalar(cluster.radius).setY(cluster.y)
    for (let branch = 0; branch < 3; branch += 1) {
      activeMotionStrength = 0.62 + branch * 0.1
      activeMotionPhase = (clusterIndex * 3 + branch) / 9
      const axis = outward.clone().multiplyScalar(0.58)
        .addScaledVector(tangent, (branch - 1) * 0.52)
        .setY([0.72, 0.22, -0.24][branch]!)
        .normalize()
      const length = 0.19 + ((clusterIndex + branch) % 3) * 0.04
      const width = 0.055 + ((clusterIndex * 2 + branch) % 3) * 0.009
      const tip = root.clone().addScaledVector(axis, length)
      const basisA = axis.clone().cross(Math.abs(axis.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
      const basisB = axis.clone().cross(basisA).normalize()
      const baseRing = Array.from({ length: 4 }, (_, corner) => {
        const angle = corner / 4 * Math.PI * 2 + clusterIndex * 0.28
        return root.clone()
          .addScaledVector(basisA, Math.cos(angle) * width)
          .addScaledVector(basisB, Math.sin(angle) * width * 0.78)
      })
      for (let face = 0; face < baseRing.length; face += 1) {
        const next = (face + 1) % baseRing.length
        const faceColor = palette[(face + branch + clusterIndex) % palette.length]!
        pushTriangle(tip, baseRing[face]!, baseRing[next]!, white, faceColor, pale)
      }
      pushTriangle(baseRing[0]!, baseRing[3]!, baseRing[2]!, deep, blue, cyan)
      pushTriangle(baseRing[0]!, baseRing[2]!, baseRing[1]!, deep, cyan, blue)
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxFrostMotion', new THREE.Float32BufferAttribute(motionStrengths, 1))
  geometry.setAttribute('pfxFrostPhase', new THREE.Float32BufferAttribute(motionPhases, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxFrostAuraGeometry'] = 'single-draw-broken-rime-crescent-with-closed-faceted-double-helix'
  geometry.userData['pfxFrostAuraDrawCalls'] = 1
  geometry.userData['pfxFrostAuraClosedFaces'] = true
  geometry.userData['pfxFrostAuraWorldSpaceVolume'] = true
  geometry.userData['pfxFrostAuraGrounded'] = true
  geometry.userData['pfxFrostAuraCrystalCount'] = 0
  geometry.userData['pfxFrostAuraRimePlateCount'] = 1
  geometry.userData['pfxFrostAuraRimeCrescentSegments'] = rimeCrescentSegments
  geometry.userData['pfxFrostAuraRimeOuterRadius'] = 0.72
  geometry.userData['pfxFrostAuraSupportLayer'] = 'broken-ground-rime-crescent'
  geometry.userData['pfxFrostAuraAirborneChipCount'] = 0
  geometry.userData['pfxFrostAuraHelixSegmentCount'] = helixSegments.length
  geometry.userData['pfxFrostAuraGlintMoteCount'] = 0
  geometry.userData['pfxFrostAuraHelicalTurns'] = helicalTurns
  geometry.userData['pfxFrostAuraHelixStrands'] = helixStrands
  geometry.userData['pfxFrostAuraHelixPointedEnds'] = true
  geometry.userData['pfxFrostAuraHelixCrossSectionFaces'] = 3
  geometry.userData['pfxFrostAuraHelixLengthClasses'] = 4
  geometry.userData['pfxFrostAuraHelixAxialFacetBands'] = 2
  geometry.userData['pfxFrostAuraHelixSpanRatio'] = Math.max(...helixSegments.map((segment) => segment.span)) / Math.min(...helixSegments.map((segment) => segment.span))
  geometry.userData['pfxFrostAuraHelixHeightRatio'] = Math.max(...helixSegments.map((segment) => segment.halfHeight)) / Math.min(...helixSegments.map((segment) => segment.halfHeight))
  geometry.userData['pfxFrostAuraCrustPieceCount'] = crustPieces.length
  geometry.userData['pfxFrostAuraCrustTopologyKinds'] = new Set(crustPieces.map((piece) => piece.sides)).size
  geometry.userData['pfxFrostAuraBranchedClusterCount'] = branchedClusters.length
  geometry.userData['pfxFrostAuraClusterBranchCount'] = branchedClusters.length * 3
  const torsoHeights = helixSegments.map((segment) => segment.centerY).sort((left, right) => left - right)
  geometry.userData['pfxFrostAuraTorsoBanding'] = true
  geometry.userData['pfxFrostAuraTorsoMinY'] = torsoHeights[0]
  geometry.userData['pfxFrostAuraTorsoMaxY'] = torsoHeights.at(-1)
  geometry.userData['pfxFrostAuraMaximumVerticalGap'] = torsoHeights.slice(1).reduce(
    (largestGap, height, index) => Math.max(largestGap, height - torsoHeights[index]!),
    0,
  )
  geometry.userData['pfxFrostAuraHollowCenterRadius'] = Math.min(...helixSegments.map((segment) => segment.radius))
  geometry.userData['pfxFrostAuraBrokenCrown'] = true
  geometry.userData['pfxFrostAuraAsymmetric'] = true
  geometry.userData['pfxFrostAuraDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxFrostAuraWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxFrostAuraHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxFrostAuraMaterial(
  opacity: number,
  primaryColor = '#8ee8ff',
  secondaryColor = '#e8fbff',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vFrostColor;
      varying vec3 vFrostNormal;
      varying vec3 vFrostViewPosition;
      varying vec3 vFrostObjectPosition;
      varying float vFrostHeight;
      attribute float pfxFrostMotion;
      attribute float pfxFrostPhase;
      uniform float uCycle;
      void main() {
        float motionWave = sin((uCycle + pfxFrostPhase) * 6.2831853);
        float crossWave = cos((uCycle * 0.63 + pfxFrostPhase) * 6.2831853);
        vec3 transformed = position;
        float orbitAngle = uCycle * 6.2831853 * pfxFrostMotion;
        float orbitCos = cos(orbitAngle);
        float orbitSin = sin(orbitAngle);
        transformed.xz = mat2(orbitCos, -orbitSin, orbitSin, orbitCos) * transformed.xz;
        transformed.xz *= 1.0 + motionWave * pfxFrostMotion * 0.045;
        transformed.y += motionWave * (0.025 + pfxFrostMotion * 0.105);
        transformed.x += crossWave * pfxFrostMotion * 0.045;
        transformed.z += motionWave * pfxFrostMotion * 0.035;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vFrostColor = color;
        vFrostNormal = normalize(normalMatrix * normal);
        vFrostViewPosition = viewPosition.xyz;
        vFrostObjectPosition = transformed;
        vFrostHeight = transformed.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vFrostColor;
      varying vec3 vFrostNormal;
      varying vec3 vFrostViewPosition;
      varying vec3 vFrostObjectPosition;
      varying float vFrostHeight;
      void main() {
        vec3 normal = normalize(vFrostNormal);
        vec3 viewDirection = normalize(-vFrostViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.88, 0.31));
        vec3 glintLight = normalize(vec3(0.62, 0.42, 0.66));
        float facing = max(dot(normal, keyLight), 0.0);
        float fresnelBase = 1.0 - abs(dot(normal, viewDirection));
        float fresnel = fresnelBase * fresnelBase * mix(0.76, 1.18, uStyleEdgeHardness);
        float rime = 1.0 - smoothstep(0.055, 0.34, vFrostHeight);
        float crystalGlint = smoothstep(0.8, 0.96, max(dot(normal, glintLight), 0.0));
        float iceTransmission = smoothstep(0.12, 0.88, fresnelBase);
        float transmissionWindow = smoothstep(0.24, 0.82, iceTransmission);
        float causticWave = abs(sin(dot(vFrostObjectPosition, vec3(8.0, 15.0, 6.0)) + uCycle * 6.2831853));
        float internalCaustic = smoothstep(0.78, 0.98, causticWave) * (0.34 + iceTransmission * 0.66);
        vec3 controlledFrostColor = mix(vFrostColor, uPrimaryColor, 0.48);
        vec3 frost = controlledFrostColor * (0.46 + facing * 0.62);
        frost += uPrimaryColor * fresnel * 0.72;
        frost += uSecondaryColor * rime * mix(0.24, 0.46, uDensity);
        frost += controlledFrostColor * controlledFrostColor * 0.24;
        frost = mix(frost, mix(uPrimaryColor, uSecondaryColor, 0.42), transmissionWindow * 0.24);
        frost += uSecondaryColor * crystalGlint * 0.78;
        frost += uPrimaryColor * internalCaustic * mix(0.48, 0.78, uDensity);
        float thinIceAlpha = 0.72 + facing * 0.2 + (1.0 - transmissionWindow) * 0.06;
        gl_FragColor = vec4(frost, uOpacity * thinIceAlpha);
      }
    `,
  })
  material.userData['pfxFrostAuraMaterial'] = 'faceted-rime-crown-cold-fresnel'
  material.userData['pfxFrostAuraControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxFrostAuraTransmissionModel'] = 'view-dependent-thin-ice-window'
  return material
}
