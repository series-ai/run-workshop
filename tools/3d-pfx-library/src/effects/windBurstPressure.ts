import * as THREE from 'three'

export function createPfxWindBurstPressureGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const anchors: number[] = []
  const seeds: number[] = []
  const lanes: number[] = []
  const anchor = new THREE.Vector3(-0.72, 0, 0)
  const stationCount = 9
  const crossSectionSides = 8
  const gustBodyCount = 9
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, seed: number, lane: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      anchors.push(anchor.x, anchor.y, anchor.z)
      seeds.push(seed)
      lanes.push(lane)
    }
  }
  const appendTube = (lane: number) => {
    const seed = lane / (gustBodyCount - 1)
    const isCore = lane === 0
    const ringPoints: THREE.Vector3[][] = []
    for (let station = 0; station < stationCount; station += 1) {
      const t = station / (stationCount - 1)
      const eased = t * t * (3 - 2 * t)
      const angle = (lane - 1) / 8 * Math.PI * 2 + eased * (0.78 + (lane % 3) * 0.12)
      const radialEnvelope = isCore
        ? 0
        : 0.1 + t * (0.78 + (lane % 2) * 0.18) + Math.sin(t * Math.PI) * (0.34 + (lane % 3) * 0.035)
      const center = isCore
        ? new THREE.Vector3(-0.82 + t * 2.4, 0.04 * Math.sin(t * Math.PI * 2), 0)
        : new THREE.Vector3(
          -0.68 + t * 3.82,
          Math.cos(angle) * radialEnvelope * 1.18 + (lane % 2 ? 0.08 : -0.06),
          Math.sin(angle) * radialEnvelope * 1.32,
        )
      const taper = isCore
        ? 0.13 + Math.sin(t * Math.PI) * 0.17
        : 0.075 + Math.sin(t * Math.PI) * (0.11 + (lane % 3) * 0.012) + (1 - t) * 0.025
      const ring: THREE.Vector3[] = []
      for (let side = 0; side < crossSectionSides; side += 1) {
        const theta = side / crossSectionSides * Math.PI * 2
        const verticalRadius = taper * (isCore ? 1.05 : 0.82)
        const depthRadius = taper * (isCore ? 1.05 : 1.34)
        ring.push(new THREE.Vector3(
          center.x + Math.cos(theta) * taper * 0.2,
          center.y + Math.cos(theta) * verticalRadius,
          center.z + Math.sin(theta) * depthRadius,
        ))
      }
      ringPoints.push(ring)
    }
    for (let station = 0; station < stationCount - 1; station += 1) {
      for (let side = 0; side < crossSectionSides; side += 1) {
        const nextSide = (side + 1) % crossSectionSides
        const a = ringPoints[station]![side]!
        const b = ringPoints[station + 1]![side]!
        const c = ringPoints[station + 1]![nextSide]!
        const d = ringPoints[station]![nextSide]!
        pushTriangle(a, b, c, seed, lane)
        pushTriangle(a, c, d, seed, lane)
      }
    }
    const startCenter = ringPoints[0]!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / crossSectionSides)
    const endCenter = ringPoints[stationCount - 1]!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / crossSectionSides)
    for (let side = 0; side < crossSectionSides; side += 1) {
      const nextSide = (side + 1) % crossSectionSides
      pushTriangle(startCenter, ringPoints[0]![nextSide]!, ringPoints[0]![side]!, seed, lane)
      pushTriangle(endCenter, ringPoints[stationCount - 1]![side]!, ringPoints[stationCount - 1]![nextSide]!, seed, lane)
    }
  }
  for (let lane = 0; lane < gustBodyCount; lane += 1) appendTube(lane)
  const coreCenter = new THREE.Vector3(-0.68, 0, 0)
  const coreRadius = 0.14
  const corePoints = [
    new THREE.Vector3(coreRadius, 0, 0), new THREE.Vector3(-coreRadius, 0, 0),
    new THREE.Vector3(0, coreRadius, 0), new THREE.Vector3(0, -coreRadius, 0),
    new THREE.Vector3(0, 0, coreRadius), new THREE.Vector3(0, 0, -coreRadius),
  ].map((point) => point.add(coreCenter))
  const coreFaces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] as const
  for (const [a, b, c] of coreFaces) pushTriangle(corePoints[a]!, corePoints[b]!, corePoints[c]!, 0, 0)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxWindBurstAnchor', new THREE.Float32BufferAttribute(anchors, 3))
  geometry.setAttribute('pfxWindBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxWindBurstLane', new THREE.Float32BufferAttribute(lanes, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWindBurstDrawCalls'] = 1
  geometry.userData['pfxWindBurstClosedFaces'] = true
  geometry.userData['pfxWindBurstWorldSpaceVolume'] = true
  geometry.userData['pfxWindBurstBillboardCount'] = 0
  geometry.userData['pfxWindBurstGustBodyCount'] = gustBodyCount
  geometry.userData['pfxWindBurstPathStationCount'] = stationCount
  geometry.userData['pfxWindBurstCrossSectionSides'] = crossSectionSides
  geometry.userData['pfxWindBurstDepthLaneCount'] = gustBodyCount
  geometry.userData['pfxWindBurstAxialPressureCore'] = true
  geometry.userData['pfxWindBurstDirectionalAxis'] = [1, 0.08, 0]
  geometry.userData['pfxWindBurstTopology'] = 'closed-tapered-helical-airfoil-tubes'
  geometry.userData['pfxWindBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxWindBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxWindBurstWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxWindBurstDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxWindBurstHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxWindBurstPressureMaterial(
  opacity: number,
  primaryColor = '#dff9ff',
  secondaryColor = '#72cde8',
  density = 0.58,
  styleEdgeHardness = 0.52,
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
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxWindBurstAnchor;
      attribute float pfxWindBurstSeed;
      attribute float pfxWindBurstLane;
      varying vec3 vWindNormal;
      varying vec3 vWindViewPosition;
      varying vec3 vWindPosition;
      varying float vWindSeed;
      varying float vWindLane;
      varying float vWindLife;
      void main() {
        float pressureRelease = smoothstep(0.025 + pfxWindBurstSeed * 0.012, 0.24 + pfxWindBurstSeed * 0.025, uCycle);
        float helicalUnfurl = pressureRelease * pressureRelease;
        float curlRecovery = smoothstep(0.34, 0.72, uCycle);
        vec3 local = position - pfxWindBurstAnchor;
        float initialTwist = (1.0 - helicalUnfurl) * (0.82 + pfxWindBurstSeed * 0.64);
        mat2 rotation = mat2(cos(initialTwist), -sin(initialTwist), sin(initialTwist), cos(initialTwist));
        local.yz = rotation * local.yz;
        local.x *= mix(0.45, 1.0, pressureRelease);
        local.yz *= mix(0.55, 1.0, helicalUnfurl);
        local.y += sin(local.x * 1.8 + pfxWindBurstSeed * 11.0) * curlRecovery * 0.08;
        local.z += cos(local.x * 1.45 + pfxWindBurstSeed * 9.0) * curlRecovery * 0.07;
        vec3 transformed = pfxWindBurstAnchor + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.yz = rotation * rotatedNormal.yz;
        vWindNormal = normalize(normalMatrix * rotatedNormal);
        vWindViewPosition = viewPosition.xyz;
        vWindPosition = transformed;
        vWindSeed = pfxWindBurstSeed;
        vWindLane = pfxWindBurstLane;
        vWindLife = (0.56 + pressureRelease * 0.44) * (1.0 - smoothstep(0.66, 0.86, uCycle));
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
      varying vec3 vWindNormal;
      varying vec3 vWindViewPosition;
      varying vec3 vWindPosition;
      varying float vWindSeed;
      varying float vWindLane;
      varying float vWindLife;
      void main() {
        vec3 normal = normalize(vWindNormal);
        vec3 viewDirection = normalize(-vWindViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float pressureFresnel = pow(1.0 - facing, mix(1.25, 2.5, uStyleEdgeHardness));
        float directionalSheen = pow(max(0.0, dot(normal, normalize(vec3(-0.36, 0.82, 0.44)))), 3.0);
        float compressedAirRefraction = 0.5 + 0.5 * sin(vWindPosition.x * 7.0 + vWindPosition.y * 4.2 - vWindPosition.z * 3.6 + vWindSeed * 13.0);
        float longitudinalFlowFilament = pow(0.5 + 0.5 * sin(vWindPosition.x * 4.4 + vWindSeed * 17.0), 7.0);
        float axialCore = 1.0 - step(0.5, vWindLane);
        float laneDepth = fract(vWindLane * 0.173 + 0.21);
        vec3 controlledWindColor = mix(uSecondaryColor * 0.58, uPrimaryColor, facing * 0.42 + directionalSheen * 0.36 + pressureFresnel * 0.32);
        controlledWindColor += uPrimaryColor * pressureFresnel * mix(0.28, 0.5, uDensity);
        controlledWindColor += uSecondaryColor * compressedAirRefraction * 0.14;
        controlledWindColor += uPrimaryColor * longitudinalFlowFilament * (0.13 + pressureFresnel * 0.12);
        controlledWindColor *= 0.82 + laneDepth * 0.18 + axialCore * 0.34;
        float releaseFlash = 1.0 + exp(-pow((uCycle - 0.22) / 0.13, 2.0)) * 0.42;
        float compactPreSwirlGlow = 1.0 - smoothstep(0.0, 0.15, uCycle);
        float decayFlowMemory = smoothstep(0.5, 0.72, uCycle) * pressureFresnel;
        controlledWindColor *= 1.0 + compactPreSwirlGlow * 1.35 + decayFlowMemory * 0.22;
        float alpha = uOpacity * vWindLife * (0.32 + facing * 0.28 + pressureFresnel * 0.32 + axialCore * 0.12 + compactPreSwirlGlow * 0.38);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(controlledWindColor * releaseFlash, clamp(alpha, 0.0, 0.88));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxWindBurstMaterial'] = true
  material.userData['pfxWindBurstMaterialRole'] = 'pressure'
  material.userData['pfxWindBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxWindBurstMaterialProfile'] = 'refractive-helical-compressed-air-volume'
  return material
}
