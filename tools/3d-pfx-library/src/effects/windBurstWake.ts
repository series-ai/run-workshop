import * as THREE from 'three'

export function createPfxWindBurstWakeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const anchors: number[] = []
  const seeds: number[] = []
  const lanes: number[] = []
  const wakeWispCount = 18
  const pathStationCount = 5
  const crossSectionSides = 6
  const anchor = new THREE.Vector3(-0.72, 0, 0)
  const pushVertex = (point: THREE.Vector3, seed: number, lane: number) => {
    positions.push(point.x, point.y, point.z)
    anchors.push(anchor.x, anchor.y, anchor.z)
    seeds.push(seed)
    lanes.push(lane)
  }
  for (let wisp = 0; wisp < wakeWispCount; wisp += 1) {
    const seed = wisp / (wakeWispCount - 1)
    const lane = wisp % 6
    const shell = Math.floor(wisp / 6)
    const t = 0.12 + seed * 0.88
    const angle = lane / 6 * Math.PI * 2 + t * 1.15 + shell * 0.22
    const radial = 0.54 + Math.sin(t * Math.PI) * 0.64 + shell * 0.08
    const centerX = -0.62 + t * 3.65
    const halfLength = 0.22 + (wisp % 4) * 0.055
    const rings: THREE.Vector3[][] = []
    for (let station = 0; station < pathStationCount; station += 1) {
      const progress = station / (pathStationCount - 1)
      const longitudinal = (progress - 0.5) * halfLength * 2
      const curlAngle = angle + (progress - 0.5) * (0.38 + (wisp % 3) * 0.05)
      const curlRadius = radial + Math.sin(progress * Math.PI) * (0.045 + (wisp % 3) * 0.012)
      const center = new THREE.Vector3(
        centerX + longitudinal,
        Math.cos(curlAngle) * curlRadius * 1.04,
        Math.sin(curlAngle) * curlRadius * 1.18,
      )
      const taper = 0.018 + Math.sin(progress * Math.PI) * (0.032 + (wisp % 3) * 0.006)
      const ring: THREE.Vector3[] = []
      for (let side = 0; side < crossSectionSides; side += 1) {
        const theta = side / crossSectionSides * Math.PI * 2
        ring.push(new THREE.Vector3(
          center.x + Math.cos(theta) * taper * 0.18,
          center.y + Math.cos(theta) * taper,
          center.z + Math.sin(theta) * taper * 1.25,
        ))
      }
      rings.push(ring)
    }
    for (let station = 0; station < pathStationCount - 1; station += 1) {
      for (let side = 0; side < crossSectionSides; side += 1) {
        const nextSide = (side + 1) % crossSectionSides
        for (const point of [rings[station]![side]!, rings[station + 1]![side]!, rings[station + 1]![nextSide]!]) pushVertex(point, seed, lane)
        for (const point of [rings[station]![side]!, rings[station + 1]![nextSide]!, rings[station]![nextSide]!]) pushVertex(point, seed, lane)
      }
    }
    const startCenter = rings[0]!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / crossSectionSides)
    const endCenter = rings[pathStationCount - 1]!.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / crossSectionSides)
    for (let side = 0; side < crossSectionSides; side += 1) {
      const nextSide = (side + 1) % crossSectionSides
      for (const point of [startCenter, rings[0]![nextSide]!, rings[0]![side]!]) pushVertex(point, seed, lane)
      for (const point of [endCenter, rings[pathStationCount - 1]![side]!, rings[pathStationCount - 1]![nextSide]!]) pushVertex(point, seed, lane)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxWindBurstAnchor', new THREE.Float32BufferAttribute(anchors, 3))
  geometry.setAttribute('pfxWindBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxWindBurstLane', new THREE.Float32BufferAttribute(lanes, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWindBurstWakeDrawCalls'] = 1
  geometry.userData['pfxWindBurstWakeClosedFaces'] = true
  geometry.userData['pfxWindBurstWakeWispCount'] = wakeWispCount
  geometry.userData['pfxWindBurstWakeDepthLaneCount'] = 6
  geometry.userData['pfxWindBurstWakeBillboardCount'] = 0
  geometry.userData['pfxWindBurstWakePathStationCount'] = pathStationCount
  geometry.userData['pfxWindBurstWakeCrossSectionSides'] = crossSectionSides
  geometry.userData['pfxWindBurstWakeTopology'] = 'closed-tapered-curved-vapor-tubes'
  geometry.userData['pfxWindBurstWakeTriangleCount'] = positions.length / 9
  geometry.userData['pfxWindBurstWakeWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxWindBurstWakeDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxWindBurstWakeHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxWindBurstWakeMaterial(
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
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxWindBurstAnchor;
      attribute float pfxWindBurstSeed;
      attribute float pfxWindBurstLane;
      varying vec3 vWakeNormal;
      varying vec3 vWakeViewPosition;
      varying float vWakeSeed;
      varying float vWakeLane;
      varying float vWakeLife;
      void main() {
        float pressureRelease = smoothstep(0.055 + pfxWindBurstSeed * 0.035, 0.3 + pfxWindBurstSeed * 0.04, uCycle);
        float helicalUnfurl = pressureRelease * pressureRelease;
        vec3 local = position - pfxWindBurstAnchor;
        float twist = (1.0 - helicalUnfurl) * (0.7 + pfxWindBurstSeed * 0.85);
        mat2 rotation = mat2(cos(twist), -sin(twist), sin(twist), cos(twist));
        local.yz = rotation * local.yz;
        local.x *= mix(0.25, 1.0, pressureRelease);
        local.yz *= mix(0.32, 1.0, helicalUnfurl);
        vec3 transformed = pfxWindBurstAnchor + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.yz = rotation * rotatedNormal.yz;
        vWakeNormal = normalize(normalMatrix * rotatedNormal);
        vWakeViewPosition = viewPosition.xyz;
        vWakeSeed = pfxWindBurstSeed;
        vWakeLane = pfxWindBurstLane;
        vWakeLife = (0.22 + pressureRelease * 0.78) * (1.0 - smoothstep(0.58 + pfxWindBurstSeed * 0.06, 0.84, uCycle));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vWakeNormal;
      varying vec3 vWakeViewPosition;
      varying float vWakeSeed;
      varying float vWakeLane;
      varying float vWakeLife;
      void main() {
        vec3 normal = normalize(vWakeNormal);
        vec3 viewDirection = normalize(-vWakeViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float wakeEdgeGlint = pow(1.0 - facing, mix(1.0, 2.1, uStyleEdgeHardness));
        float wakeBackscatter = pow(max(0.0, dot(normal, normalize(vec3(-0.28, 0.88, 0.38)))), 2.0);
        float wakeDepthTint = fract(vWakeLane * 0.217 + vWakeSeed * 0.43);
        vec3 controlledWakeColor = mix(uSecondaryColor, uPrimaryColor, wakeEdgeGlint * 0.5 + wakeBackscatter * 0.38 + wakeDepthTint * 0.12);
        controlledWakeColor *= 1.15 + wakeEdgeGlint * 0.72 + mix(0.0, 0.24, uDensity);
        float alpha = uOpacity * vWakeLife * (0.34 + facing * 0.24 + wakeEdgeGlint * 0.38);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledWakeColor, clamp(alpha, 0.0, 0.82));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxWindBurstMaterial'] = true
  material.userData['pfxWindBurstMaterialRole'] = 'wake'
  material.userData['pfxWindBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxWindBurstMaterialProfile'] = 'additive-curved-vapor-wisps'
  return material
}
