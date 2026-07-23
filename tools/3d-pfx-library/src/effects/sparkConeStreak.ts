import * as THREE from 'three'

export function createPfxSparkConeStreakGeometry(): THREE.BufferGeometry {
  const axis = new THREE.Vector3(1, 0.18, 0.08).normalize()
  const side = axis.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
  const up = side.clone().cross(axis).normalize()
  const coreHot: readonly [number, number, number] = [1, 1, 0.82]
  const hot: readonly [number, number, number] = [1, 0.86, 0.42]
  const body: readonly [number, number, number] = [1, 0.4, 0.035]
  const cool: readonly [number, number, number] = [0.62, 0.06, 0.005]
  const positions: number[] = []
  const colors: number[] = []
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...aColor, ...bColor, ...cColor)
  }

  const createRing = (
    center: THREE.Vector3,
    basisA: THREE.Vector3,
    basisB: THREE.Vector3,
    radius: number,
    phase: number,
  ) => Array.from({ length: 4 }, (_, corner) => {
    const angle = corner / 4 * Math.PI * 2 + phase
    return center.clone()
      .addScaledVector(basisA, Math.cos(angle) * radius)
      .addScaledVector(basisB, Math.sin(angle) * radius)
  })

  for (let index = 0; index < 18; index += 1) {
    const azimuth = index * 2.399963229728653
    const polar = 0.08 + ((index * 7) % 17) / 16 * 0.48
    const direction = axis.clone().multiplyScalar(Math.cos(polar))
      .addScaledVector(side, Math.cos(azimuth) * Math.sin(polar))
      .addScaledVector(up, Math.sin(azimuth) * Math.sin(polar))
      .normalize()
    const headDistance = 0.78 + ((index * 11) % 19) / 18 * 0.92
    const tailDistance = 0.1 + ((index * 5) % 7) * 0.02
    const bendDirection = side.clone().multiplyScalar(Math.cos(azimuth + 0.83))
      .addScaledVector(up, Math.sin(azimuth + 0.83))
      .normalize()
    const bendAmount = 0.075 + (index % 5) * 0.022
    const headCenter = direction.clone().multiplyScalar(headDistance)
    const innerMidCenter = direction.clone().multiplyScalar(headDistance * 0.34).addScaledVector(bendDirection, bendAmount * 0.72)
    const outerMidCenter = direction.clone().multiplyScalar(headDistance * 0.68).addScaledVector(bendDirection, bendAmount)
    const tailCenter = direction.clone().multiplyScalar(tailDistance)
    const basisA = direction.clone().cross(Math.abs(direction.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
    const basisB = direction.clone().cross(basisA).normalize()
    const tailWidth = 0.052 + (index % 3) * 0.008
    const innerMidWidth = 0.041 + (index % 4) * 0.004
    const outerMidWidth = 0.026 + (index % 4) * 0.003
    const headWidth = 0.012 + (index % 2) * 0.004
    const phase = index * 0.31
    const rings = [
      createRing(tailCenter, basisA, basisB, tailWidth, phase),
      createRing(innerMidCenter, basisA, basisB, innerMidWidth, phase + 0.14),
      createRing(outerMidCenter, basisA, basisB, outerMidWidth, phase + 0.29),
      createRing(headCenter, basisA, basisB, headWidth, phase + 0.43),
    ]
    const ringColors = [hot, hot, body, cool] as const
    for (let segment = 0; segment < rings.length - 1; segment += 1) {
      const from = rings[segment]!
      const to = rings[segment + 1]!
      for (let sideIndex = 0; sideIndex < 4; sideIndex += 1) {
        const next = (sideIndex + 1) % 4
        pushTriangle(from[sideIndex]!, to[sideIndex]!, to[next]!, ringColors[segment]!, ringColors[segment + 1]!, ringColors[segment + 1]!)
        pushTriangle(from[sideIndex]!, to[next]!, from[next]!, ringColors[segment]!, ringColors[segment + 1]!, ringColors[segment]!)
      }
    }
    pushTriangle(rings[0]![3]!, rings[0]![2]!, rings[0]![0]!, hot, hot, hot)
    pushTriangle(rings[0]![2]!, rings[0]![1]!, rings[0]![0]!, hot, hot, hot)
    pushTriangle(rings[3]![0]!, rings[3]![1]!, rings[3]![2]!, cool, cool, cool)
    pushTriangle(rings[3]![0]!, rings[3]![2]!, rings[3]![3]!, cool, cool, cool)
    if (index % 3 !== 0) {
      const headRadius = 0.026 + ((index * 3) % 7) * 0.0065
      const headVertices = [
        headCenter.clone().addScaledVector(direction, headRadius * 1.4),
        headCenter.clone().addScaledVector(direction, -headRadius * 1.4),
        headCenter.clone().addScaledVector(basisA, headRadius),
        headCenter.clone().addScaledVector(basisA, -headRadius),
        headCenter.clone().addScaledVector(basisB, headRadius),
        headCenter.clone().addScaledVector(basisB, -headRadius),
      ]
      const headFaces = [
        [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
        [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
      ] as const
      for (const [a, b, c] of headFaces) {
        pushTriangle(headVertices[a]!, headVertices[b]!, headVertices[c]!, body, cool, cool)
      }
    }
  }

  const coreCenter = axis.clone().multiplyScalar(0.065)
  const coreRadius = 0.145
  const coreVertices = [
    coreCenter.clone().addScaledVector(axis, coreRadius * 1.4),
    coreCenter.clone().addScaledVector(axis, -coreRadius),
    coreCenter.clone().addScaledVector(side, coreRadius),
    coreCenter.clone().addScaledVector(side, -coreRadius),
    coreCenter.clone().addScaledVector(up, coreRadius),
    coreCenter.clone().addScaledVector(up, -coreRadius),
  ]
  const coreFaces = [
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
  ] as const
  for (const [a, b, c] of coreFaces) {
    pushTriangle(coreVertices[a]!, coreVertices[b]!, coreVertices[c]!, coreHot, coreHot, hot)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSparkConeGeometry'] = 'single-draw-curved-hot-packets-with-ignition-core'
  geometry.userData['pfxSparkConeDrawCalls'] = 1
  geometry.userData['pfxSparkConeClosedFaces'] = true
  geometry.userData['pfxSparkConeStreakCount'] = 18
  geometry.userData['pfxSparkConeHeadCount'] = 12
  geometry.userData['pfxSparkConeTrajectorySpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSparkConeDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSparkConeCrossSectionSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxSparkConeRadialContinuity'] = true
  geometry.userData['pfxSparkConeCurvedSegments'] = true
  geometry.userData['pfxSparkConeIgnitionCore'] = true
  geometry.userData['pfxSparkConeReviewOrientation'] = 'side-camera-axial-front-camera-lateral'
  geometry.userData['pfxSparkConeMaxHeadDistance'] = 1.7
  geometry.userData['pfxSparkConeMinTailDistance'] = 0.1
  geometry.userData['pfxSparkConeMaxTailDistance'] = 0.22
  geometry.userData['pfxSparkConeRootWidth'] = 0.052
  geometry.userData['pfxSparkConeMinHeadRadius'] = 0.026
  geometry.userData['pfxSparkConeMaxHeadRadius'] = 0.065
  geometry.userData['pfxSparkConeDistinctHeadDistances'] = 18
  geometry.userData['pfxSparkConeSideCameraAxisDot'] = axis.x
  geometry.userData['pfxSparkConeIgnitionCoreRadius'] = coreRadius
  return geometry
}

export function createPfxSparkConeStreakMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vSparkColor;
      varying vec3 vSparkNormal;
      void main() {
        vSparkColor = color;
        vSparkNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vSparkColor;
      varying vec3 vSparkNormal;
      void main() {
        vec3 normal = normalize(vSparkNormal);
        vec3 facetLight = normalize(vec3(0.36, 0.78, 0.51));
        float facing = abs(dot(normal, facetLight));
        float edgeLift = pow(1.0 - abs(normal.z), 2.0) * 0.12;
        vec3 emissiveColor = vSparkColor * (0.58 + facing * 0.42 + edgeLift);
        emissiveColor += vSparkColor * vSparkColor * 0.28;
        gl_FragColor = vec4(emissiveColor, uOpacity);
      }
    `,
  })
  material.userData['pfxSparkConeMaterial'] = 'vertex-emissive-depth-writing-facet-shader'
  return material
}
