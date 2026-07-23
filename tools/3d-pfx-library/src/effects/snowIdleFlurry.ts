import * as THREE from 'three'

export function createPfxSnowIdleFlurryGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const layers: number[] = []
  let activeCenter = new THREE.Vector3()
  let activeSeed = 0
  let activeLayer = 0
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(shade * 0.82, shade * 0.96, shade, shade * 0.82, shade * 0.96, shade, shade * 0.82, shade * 0.96, shade)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      centers.push(activeCenter.x, activeCenter.y, activeCenter.z)
      seeds.push(activeSeed)
      layers.push(activeLayer)
    }
  }
  const appendTriangularPrism = (
    halfLength: number,
    radius: number,
    rotation: THREE.Quaternion,
    centerOffset = new THREE.Vector3(),
  ) => {
    const local: THREE.Vector3[] = []
    for (const x of [-halfLength, halfLength]) {
      for (let corner = 0; corner < 3; corner += 1) {
        const theta = corner / 3 * Math.PI * 2 + Math.PI / 6
        local.push(new THREE.Vector3(x, Math.cos(theta) * radius, Math.sin(theta) * radius))
      }
    }
    for (const point of local) point.applyQuaternion(rotation).add(activeCenter).add(centerOffset)
    const faces = [[0, 2, 1], [3, 4, 5], [0, 1, 4], [0, 4, 3], [1, 2, 5], [1, 5, 4], [2, 0, 3], [2, 3, 5]] as const
    for (const [a, b, c] of faces) pushTriangle(local[a]!, local[b]!, local[c]!, 0.82 + ((a + b + c) % 3) * 0.08)
  }
  const appendCore = (radius: number, rotation: THREE.Quaternion) => {
    const points = [
      new THREE.Vector3(radius, 0, 0), new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, radius, 0), new THREE.Vector3(0, -radius, 0),
      new THREE.Vector3(0, 0, radius), new THREE.Vector3(0, 0, -radius),
    ].map((point) => point.applyQuaternion(rotation).add(activeCenter))
    const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] as const
    for (const [a, b, c] of faces) pushTriangle(points[a]!, points[b]!, points[c]!, 0.96)
  }
  const flakeCount = 12
  const orientationClassCount = 6
  const flakeSizes = [0.055, 0.064, 0.073, 0.082, 0.091] as const
  const branchSpreads = [0.46, 0.58, 0.69, 0.8, 0.92] as const
  const branchOrigins = [0.44, 0.5, 0.56, 0.62, 0.68] as const
  const branchLengths = [0.13, 0.16, 0.19, 0.22, 0.25] as const
  const orientationPairs = [[0.65, 0.55], [0.65, 0.75], [0.75, 0.65], [0.75, 0.85], [0.85, 0.65], [0.95, 0.65]] as const
  const reviewDirections = [
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(Math.sin(0.72), 0, Math.cos(0.72)),
  ]
  const minimumReviewProjection = Math.min(...orientationPairs.flatMap(([x, y]) => {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, 0)),
    )
    return reviewDirections.map((direction) => Math.abs(normal.dot(direction)))
  }))
  for (let flake = 0; flake < flakeCount; flake += 1) {
    activeSeed = ((flake * 5) % flakeCount) / flakeCount
    activeCenter = new THREE.Vector3(
      -1.72 + ((flake * 7) % flakeCount) / (flakeCount - 1) * 3.44 + Math.sin(flake * 1.3) * 0.08,
      -0.58 + ((flake * 11) % flakeCount) / (flakeCount - 1) * 3.35,
      -1.28 + ((flake * 13) % flakeCount) / (flakeCount - 1) * 2.56,
    )
    activeLayer = THREE.MathUtils.clamp((activeCenter.z + 1.28) / 2.56, 0, 1)
    const orientation = flake % orientationClassCount
    const [tiltX, tiltY] = orientationPairs[orientation]!
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, tiltY, 0)).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), flake * 0.29),
    )
    const dendriteVariant = flake % flakeSizes.length
    const size = flakeSizes[dendriteVariant]!
    for (let bar = 0; bar < 3; bar += 1) {
      const rotation = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bar * Math.PI / 3))
      appendTriangularPrism(size, size * 0.18, rotation)
    }
    const depthPlane = tilt.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
    )
    for (let brace = 0; brace < 3; brace += 1) {
      const rotation = depthPlane.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), brace * Math.PI / 3),
      )
      appendTriangularPrism(size * 0.68, size * 0.13, rotation)
    }
    for (let arm = 0; arm < 6; arm += 1) {
      const armAngle = arm * Math.PI / 3
      const branchSpread = branchSpreads[dendriteVariant]!
      const branchOrigin = new THREE.Vector3(Math.cos(armAngle), Math.sin(armAngle), 0)
        .multiplyScalar(size * branchOrigins[dendriteVariant]!)
        .applyQuaternion(tilt)
      for (const branchSign of [-1, 1]) {
        const branchAngle = armAngle + branchSign * branchSpread
        const branchDirection = new THREE.Vector3(Math.cos(branchAngle), Math.sin(branchAngle), 0)
        const branchHalfLength = size * branchLengths[dendriteVariant]!
        const branchCenter = branchOrigin.clone().add(
          branchDirection.clone().multiplyScalar(branchHalfLength).applyQuaternion(tilt),
        )
        const branchRotation = tilt.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), branchAngle),
        )
        appendTriangularPrism(branchHalfLength, size * 0.11, branchRotation, branchCenter)
      }
    }
    for (let arm = 0; arm < 6; arm += 1) {
      const armAngle = arm * Math.PI / 3
      const branchSpread = branchSpreads[dendriteVariant]!
      const branchOrigin = new THREE.Vector3(Math.cos(armAngle), Math.sin(armAngle), 0)
        .multiplyScalar(size * (branchOrigins[dendriteVariant]! - 0.1))
        .applyQuaternion(depthPlane)
      for (const branchSign of [-1, 1]) {
        const branchAngle = armAngle + branchSign * branchSpread
        const branchDirection = new THREE.Vector3(Math.cos(branchAngle), Math.sin(branchAngle), 0)
        const branchHalfLength = size * (branchLengths[dendriteVariant]! * 0.68)
        const branchCenter = branchOrigin.clone().add(
          branchDirection.clone().multiplyScalar(branchHalfLength).applyQuaternion(depthPlane),
        )
        const branchRotation = depthPlane.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), branchAngle),
        )
        appendTriangularPrism(branchHalfLength, size * 0.09, branchRotation, branchCenter)
      }
    }
    appendCore(size * 0.25, tilt)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxSnowCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxSnowSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSnowLayer', new THREE.Float32BufferAttribute(layers, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSnowIdleDrawCalls'] = 1
  geometry.userData['pfxSnowIdleClosedFaces'] = true
  geometry.userData['pfxSnowIdleWorldSpaceVolume'] = true
  geometry.userData['pfxSnowIdleBillboardCount'] = 0
  geometry.userData['pfxSnowIdleFlakeCount'] = flakeCount
  geometry.userData['pfxSnowIdleFlakeArmCount'] = 6
  geometry.userData['pfxSnowIdleDendriteVariantCount'] = flakeSizes.length
  geometry.userData['pfxSnowIdleFlakeScaleClassCount'] = flakeSizes.length
  geometry.userData['pfxSnowIdleBranchedArmPairCount'] = 12
  geometry.userData['pfxSnowIdleCrystalTierCount'] = 2
  geometry.userData['pfxSnowIdleDepthBraceCount'] = 6
  geometry.userData['pfxSnowIdleDepthBranchedArmPairCount'] = 12
  geometry.userData['pfxSnowIdleOrientationClassCount'] = orientationClassCount
  geometry.userData['pfxSnowIdleVolumetricOrientationSpread'] = true
  geometry.userData['pfxSnowIdleDepthScaleGradient'] = true
  geometry.userData['pfxSnowIdleReviewAngleSafeOrientations'] = true
  geometry.userData['pfxSnowIdleDecorrelatedEmitterLayout'] = true
  geometry.userData['pfxSnowIdleDetachedMagicSparkleCount'] = 0
  geometry.userData['pfxSnowIdleMaximumFlakeRadius'] = Math.max(...flakeSizes)
  geometry.userData['pfxSnowIdleMinimumReviewProjection'] = minimumReviewProjection
  geometry.userData['pfxSnowIdleFacetedRodRadiusRatio'] = 0.18
  geometry.userData['pfxSnowIdleTriangleCount'] = positions.length / 9
  geometry.userData['pfxSnowIdleWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSnowIdleDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSnowIdleHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxSnowIdleFlurryMaterial(
  opacity: number,
  primaryColor = '#edfaff',
  secondaryColor = '#bfeeff',
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
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSnowCenter;
      attribute float pfxSnowSeed;
      attribute float pfxSnowLayer;
      varying vec3 vSnowColor;
      varying vec3 vSnowNormal;
      varying vec3 vSnowViewPosition;
      varying float vSnowLayer;
      varying float vSnowSeed;
      varying float vSnowVisibility;
      void main() {
        vec3 local = position - pfxSnowCenter;
        float fallProgress = fract(pfxSnowSeed + uCycle * (0.34 + pfxSnowLayer * 0.12));
        float spin = uCycle * 6.2831853 * (0.35 + pfxSnowLayer * 0.28) + pfxSnowSeed * 19.0;
        mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        local.xy = rotation * local.xy;
        float depthScale = 0.72 + pfxSnowLayer * 0.52;
        local *= depthScale;
        vec3 center = pfxSnowCenter;
        center.y = mix(2.55, -0.72, fallProgress);
        center.x += sin(fallProgress * 6.2831853 + pfxSnowSeed * 17.0) * (0.13 + pfxSnowLayer * 0.12);
        center.z += cos(fallProgress * 4.8 + pfxSnowSeed * 13.0) * 0.08;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSnowColor = color;
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = rotation * rotatedNormal.xy;
        vSnowNormal = normalize(normalMatrix * rotatedNormal);
        vSnowViewPosition = viewPosition.xyz;
        vSnowLayer = pfxSnowLayer;
        vSnowSeed = pfxSnowSeed;
        float weatherWave = 0.5 - 0.5 * cos(uCycle * 6.2831853);
        float weatherDensity = 0.55 + weatherWave * 0.43;
        vSnowVisibility = smoothstep(pfxSnowSeed - 0.12, pfxSnowSeed + 0.1, weatherDensity);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vSnowColor;
      varying vec3 vSnowNormal;
      varying vec3 vSnowViewPosition;
      varying float vSnowLayer;
      varying float vSnowSeed;
      varying float vSnowVisibility;
      uniform float uCycle;
      void main() {
        vec3 normal = normalize(vSnowNormal);
        vec3 viewDirection = normalize(-vSnowViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float frostRim = (1.0 - facing) * (1.0 - facing);
        float aerialDepthFade = 0.72 + vSnowLayer * 0.24;
        float weatherDensity = 0.55 + (0.5 - 0.5 * cos(uCycle * 6.2831853)) * 0.43;
        float crystalGlint = pow(max(0.0, sin(uCycle * 12.5663706 + vSnowSeed * 31.0)), 8.0) * (0.35 + frostRim * 0.65);
        float iceFacet = 0.56 + 0.44 * abs(dot(normal, normalize(vec3(0.42, 0.81, 0.39))));
        vec3 controlledSnowColor = mix(uSecondaryColor, uPrimaryColor, iceFacet * 0.62 + facing * 0.22 + frostRim * 0.16);
        vec3 snowCrystal = controlledSnowColor;
        snowCrystal *= 0.94 + vSnowColor.b * 0.06;
        snowCrystal += uSecondaryColor * frostRim * mix(0.16, 0.3, uStyleEdgeHardness) + uPrimaryColor * crystalGlint * mix(0.22, 0.36, uDensity);
        gl_FragColor = vec4(snowCrystal, uOpacity * aerialDepthFade * (0.82 + facing * 0.16) * vSnowVisibility * mix(0.88, 1.0, uDensity));
      }
    `,
  })
  material.userData['pfxSnowIdleMaterial'] = 'closed-six-arm-world-space-flurry'
  material.userData['pfxSnowIdleControlBinding'] = 'primary-secondary-density-style'
  return material
}
