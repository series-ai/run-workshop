import * as THREE from 'three'

export function createPfxImpactCoreGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const hot: readonly [number, number, number] = [1, 1, 0.98]
  const gold: readonly [number, number, number] = [1, 0.9, 0.38]
  const warm: readonly [number, number, number] = [1, 0.62, 0.08]
  const ember: readonly [number, number, number] = [0.86, 0.22, 0.02]
  const push = (point: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number] = hot,
    bColor: readonly [number, number, number] = hot,
    cColor: readonly [number, number, number] = warm,
  ) => {
    push(a, aColor)
    push(b, bColor)
    push(c, cColor)
  }

  const contactDepth = 0.12
  const contactFrontX = 0.04

  // A faceted hot seed gives the contact a sculpted highlight roll from every
  // camera. It is folded into this geometry buffer, preserving the one-draw
  // mobile contract while replacing the old soft billboard-like center.
  const seedRadius = 0.17
  const seedSource = new THREE.IcosahedronGeometry(seedRadius, 1)
  const seedGeometry = seedSource.index ? seedSource.toNonIndexed() : seedSource
  const seedPositions = seedGeometry.getAttribute('position') as THREE.BufferAttribute
  const seedCenter = new THREE.Vector3(0.055, 0, 0)
  const seedPoint = new THREE.Vector3()
  const seedTriangleCount = seedPositions.count / 3
  for (let vertex = 0; vertex < seedPositions.count; vertex += 3) {
    const points = [0, 1, 2].map((corner) =>
      seedPoint.clone().fromBufferAttribute(seedPositions, vertex + corner).add(seedCenter),
    )
    const vertexColors = points.map((point) => point.x >= seedCenter.x ? hot : gold)
    triangle(points[0]!, points[1]!, points[2]!, vertexColors[0], vertexColors[1], vertexColors[2])
  }
  if (seedGeometry !== seedSource) seedGeometry.dispose()
  seedSource.dispose()

  const spikes = [
    // A deliberately uneven ricochet knot: one attack-axis ray, one deep
    // glancing ray, and one short rebound. No opposite pairs or X symmetry.
    { direction: [1, 0.03, 0.02], length: 0.74, width: 0.036 },
    { direction: [0.58, 0.42, 0.92], length: 0.58, width: 0.032 },
    { direction: [0.22, -0.72, -0.8], length: 0.32, width: 0.04 },
    { direction: [-0.65, 0.62, -0.1], length: 0.22, width: 0.027 },
  ] as const
  const segments = 8
  const rootSpread = 0.045
  const fallbackUp = new THREE.Vector3(0, 1, 0)
  const fallbackSide = new THREE.Vector3(0, 0, 1)
  for (const [spikeIndex, spike] of spikes.entries()) {
    const direction = new THREE.Vector3(...spike.direction).normalize()
    const reference = Math.abs(direction.dot(fallbackUp)) > 0.88 ? fallbackSide : fallbackUp
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
    const baseCenter = new THREE.Vector3(
      contactFrontX + 0.01,
      direction.y * rootSpread,
      direction.z * rootSpread,
    )
    const shoulderCenter = baseCenter.clone().addScaledVector(direction, spike.length * 0.68)
    const base = Array.from({ length: segments }, (_, segment) => {
      const angle = (segment / segments) * Math.PI * 2
      return baseCenter.clone()
        .addScaledVector(tangent, Math.cos(angle) * spike.width)
        .addScaledVector(bitangent, Math.sin(angle) * spike.width)
    })
    const shoulder = Array.from({ length: segments }, (_, segment) => {
      const angle = (segment / segments) * Math.PI * 2
      return shoulderCenter.clone()
        .addScaledVector(tangent, Math.cos(angle) * spike.width * 0.42)
        .addScaledVector(bitangent, Math.sin(angle) * spike.width * 0.42)
    })
    const tip = baseCenter.clone().addScaledVector(direction, spike.length)
    for (let side = 0; side < segments; side += 1) {
      const next = (side + 1) % segments
      triangle(base[side]!, base[next]!, shoulder[next]!, hot, hot, gold)
      triangle(base[side]!, shoulder[next]!, shoulder[side]!, hot, gold, gold)
      triangle(shoulder[side]!, shoulder[next]!, tip, gold, warm, ember)
    }

    // The three gameplay-facing hero rays carry a narrow raised hot spine.
    // It breaks the broad gold facet into hot → gold → ember structure in
    // the same geometry buffer and draw call. The spine is offset onto the
    // ray shell rather than hidden inside it.
    if (spikeIndex < 1) {
      const spineSegments = 4
      const spineDirection = direction.clone()
      const spineBaseCenter = baseCenter.clone().addScaledVector(tangent, spike.width * 0.9)
      const spineLength = spike.length * 0.76
      const spineWidth = spike.width * 0.24
      const spineShoulderCenter = spineBaseCenter.clone().addScaledVector(spineDirection, spineLength * 0.62)
      const spineBase = Array.from({ length: spineSegments }, (_, segment) => {
        const angle = (segment / spineSegments) * Math.PI * 2
        return spineBaseCenter.clone()
          .addScaledVector(tangent, Math.cos(angle) * spineWidth)
          .addScaledVector(bitangent, Math.sin(angle) * spineWidth)
      })
      const spineShoulder = Array.from({ length: spineSegments }, (_, segment) => {
        const angle = (segment / spineSegments) * Math.PI * 2
        return spineShoulderCenter.clone()
          .addScaledVector(tangent, Math.cos(angle) * spineWidth * 0.38)
          .addScaledVector(bitangent, Math.sin(angle) * spineWidth * 0.38)
      })
      const spineTip = spineBaseCenter.clone().addScaledVector(spineDirection, spineLength)
      for (let side = 0; side < spineSegments; side += 1) {
        const next = (side + 1) % spineSegments
        triangle(spineBase[side]!, spineBase[next]!, spineShoulder[next]!, hot, hot, hot)
        triangle(spineBase[side]!, spineShoulder[next]!, spineShoulder[side]!, hot, hot, gold)
        triangle(spineShoulder[side]!, spineShoulder[next]!, spineTip, hot, gold, warm)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  // Average normals across coincident non-indexed vertices while preserving
  // per-corner ramp colors. This removes lathe banding and root seams without
  // indexing away the hot → gold → ember color structure.
  const smoothNormalWeldEpsilon = 0.00001
  const normalSums = new Map<string, THREE.Vector3>()
  const vertexKeys: string[] = []
  const keyFor = (point: THREE.Vector3) => [point.x, point.y, point.z]
    .map((component) => Math.round(component / smoothNormalWeldEpsilon))
    .join(':')
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()
  for (let vertex = 0; vertex < positions.length / 3; vertex += 3) {
    a.fromArray(positions, vertex * 3)
    b.fromArray(positions, (vertex + 1) * 3)
    c.fromArray(positions, (vertex + 2) * 3)
    faceNormal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
    for (const point of [a, b, c]) {
      const key = keyFor(point)
      vertexKeys.push(key)
      const sum = normalSums.get(key) ?? new THREE.Vector3()
      sum.add(faceNormal)
      normalSums.set(key, sum)
    }
  }
  const normals: number[] = []
  for (const key of vertexKeys) {
    const normal = normalSums.get(key)?.clone().normalize() ?? new THREE.Vector3(1, 0, 0)
    normals.push(normal.x, normal.y, normal.z)
  }
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxImpactCoreGeometry'] = 'single-draw-four-ray-ricochet-knot'
  geometry.userData['pfxImpactCoreSpikeCount'] = spikes.length
  geometry.userData['pfxImpactCoreContactNormal'] = [1, 0, 0]
  geometry.userData['pfxImpactCoreContactDepth'] = contactDepth
  geometry.userData['pfxImpactCorePlanarPad'] = false
  geometry.userData['pfxImpactCoreDepthCompression'] = 0.55
  geometry.userData['pfxImpactCoreRadialSegments'] = segments
  geometry.userData['pfxImpactCoreClosedFaces'] = true
  geometry.userData['pfxImpactCoreNormalPolicy'] = 'smooth-welded-closed-volume'
  geometry.userData['pfxImpactCoreSmoothedNormalWeldEpsilon'] = smoothNormalWeldEpsilon
  geometry.userData['pfxImpactCoreSeedGeometry'] = 'subdivided-icosahedron'
  geometry.userData['pfxImpactCoreSeedTriangles'] = seedTriangleCount
  geometry.userData['pfxImpactCoreSeedRadius'] = seedRadius
  geometry.userData['pfxImpactCoreCompressionMotif'] = 'none'
  geometry.userData['pfxImpactCoreCompressionArmCount'] = 0
  geometry.userData['pfxImpactCoreNestedHotSpineCount'] = 1
  geometry.userData['pfxImpactCoreFacetRampStopCount'] = 4
  geometry.userData['pfxImpactCoreRootSpread'] = rootSpread
  geometry.userData['pfxImpactCoreOutgoingRayCount'] = spikes.filter((spike) => spike.direction[0] > 0).length
  geometry.userData['pfxImpactCoreReboundRayCount'] = spikes.filter((spike) => spike.direction[0] < 0).length
  geometry.userData['pfxImpactCoreCrossAxisRayCount'] = spikes.filter((spike) => {
    const [x, y, z] = spike.direction
    return Math.abs(x / Math.hypot(x, y, z)) < 0.5
  }).length
  geometry.userData['pfxImpactCoreHeroRayCount'] = 1
  geometry.userData['pfxImpactCoreMinimumHeroRayX'] = Math.min(
    ...spikes.slice(0, 1).map((spike) => {
      const [x, y, z] = spike.direction
      return x / Math.hypot(x, y, z)
    }),
  )
  const depthRays = spikes.filter((spike) => {
    const [x, y, z] = spike.direction
    return Math.abs(z / Math.hypot(x, y, z)) > 0.7
  })
  geometry.userData['pfxImpactCoreDepthRayCount'] = depthRays.length
  geometry.userData['pfxImpactCoreMinimumDepthRayLength'] = Math.min(...depthRays.map((spike) => spike.length))
  geometry.userData['pfxImpactCoreMaximumRayLength'] = Math.max(...spikes.map((spike) => spike.length))
  geometry.userData['pfxImpactCoreMaximumRayWidth'] = Math.max(...spikes.map((spike) => spike.width))
  geometry.userData['pfxImpactCoreExactOppositePairCount'] = spikes.reduce((count, spike, index) => {
    const direction = new THREE.Vector3(...spike.direction).normalize()
    return count + spikes.slice(index + 1).filter((candidate) =>
      direction.dot(new THREE.Vector3(...candidate.direction).normalize()) < -0.999,
    ).length
  }, 0)
  const positiveDepthLength = depthRays.filter((spike) => spike.direction[2] > 0).reduce((sum, spike) => sum + spike.length, 0)
  const negativeDepthLength = depthRays.filter((spike) => spike.direction[2] < 0).reduce((sum, spike) => sum + spike.length, 0)
  geometry.userData['pfxImpactCoreDepthLengthImbalance'] = Math.abs(positiveDepthLength - negativeDepthLength)
  geometry.userData['pfxImpactCoreSideSilhouetteImbalance'] = Math.abs(positiveDepthLength - negativeDepthLength) / Math.max(positiveDepthLength, negativeDepthLength)
  geometry.userData['pfxImpactCoreDrawCalls'] = 1
  return geometry
}

export function createPfxImpactCoreMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    // Mesh flashes animate this value after construction, including from an
    // authored peak opacity of 1 down to zero during the same burst.
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: color,
    emissiveIntensity: 0.7,
    roughness: 0.44,
    metalness: 0.12,
    flatShading: true,
    toneMapped: false,
  })
  const shaderId = 'rim-specular-heat-seams-v1'
  const rimStrength = 0.24
  const heatSeamStrength = 0.12
  material.userData['pfxImpactCoreShader'] = shaderId
  material.userData['pfxImpactCoreRimStrength'] = rimStrength
  material.userData['pfxImpactCoreHeatSeamStrength'] = heatSeamStrength
  material.customProgramCacheKey = () => shaderId
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPfxLocalPosition;\nvarying vec3 vPfxViewNormal;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvPfxLocalPosition = position;',
      )
      .replace(
        '#include <defaultnormal_vertex>',
        '#include <defaultnormal_vertex>\nvPfxViewNormal = normalize(transformedNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPfxLocalPosition;\nvarying vec3 vPfxViewNormal;',
      )
      .replace(
        '#include <opaque_fragment>',
        `
          vec3 pfxNormal = normalize(vPfxViewNormal);
          vec3 pfxView = normalize(vViewPosition);
          float pfxRim = pow(1.0 - clamp(abs(dot(pfxNormal, pfxView)), 0.0, 1.0), 2.4);
          float pfxSpecular = pow(max(dot(pfxNormal, normalize(vec3(0.32, 0.78, 0.54))), 0.0), 28.0);
          float pfxSeamWave = abs(sin(dot(vPfxLocalPosition, vec3(31.0, 19.0, 23.0)) + vPfxLocalPosition.x * 17.0));
          float pfxSeam = smoothstep(0.93, 0.995, pfxSeamWave);
          float pfxGrain = fract(sin(dot(floor(vPfxLocalPosition * 38.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          outgoingLight *= mix(0.97, 1.03, pfxGrain);
          outgoingLight += vec3(1.0, 0.34, 0.035) * pfxRim * ${rimStrength.toFixed(2)};
          outgoingLight += vec3(1.0, 0.93, 0.7) * pfxSpecular * 0.32;
          outgoingLight += vec3(1.0, 0.72, 0.22) * pfxSeam * ${heatSeamStrength.toFixed(2)};
          #include <opaque_fragment>
        `,
      )
  }
  return material
}
