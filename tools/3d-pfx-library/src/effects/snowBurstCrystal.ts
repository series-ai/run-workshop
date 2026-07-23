import * as THREE from 'three'

export function createPfxSnowBurstCrystalGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  let activeCenter = new THREE.Vector3()
  let activeDirection = new THREE.Vector3(0, 1, 0)
  let activeSeed = 0
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    const cool = THREE.MathUtils.clamp(shade, 0, 1.15)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(cool * 0.78, cool * 0.93, cool)
      centers.push(activeCenter.x, activeCenter.y, activeCenter.z)
      seeds.push(activeSeed)
      directions.push(activeDirection.x, activeDirection.y, activeDirection.z)
    }
  }
  const appendTriangularPrism = (
    halfLength: number,
    radius: number,
    rotation: THREE.Quaternion,
    centerOffset = new THREE.Vector3(),
  ) => {
    const points: THREE.Vector3[] = []
    for (const x of [-halfLength, halfLength]) {
      for (let corner = 0; corner < 3; corner += 1) {
        const theta = corner / 3 * Math.PI * 2 + Math.PI / 6
        points.push(new THREE.Vector3(x, Math.cos(theta) * radius, Math.sin(theta) * radius))
      }
    }
    for (const point of points) point.applyQuaternion(rotation).add(activeCenter).add(centerOffset)
    const faces = [[0, 2, 1], [3, 4, 5], [0, 1, 4], [0, 4, 3], [1, 2, 5], [1, 5, 4], [2, 0, 3], [2, 3, 5]] as const
    for (const [a, b, c] of faces) pushTriangle(points[a]!, points[b]!, points[c]!, 0.8 + ((a + b + c) % 3) * 0.09)
  }
  const appendCore = (radius: number, rotation: THREE.Quaternion) => {
    const points = [
      new THREE.Vector3(radius, 0, 0), new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, radius, 0), new THREE.Vector3(0, -radius, 0),
      new THREE.Vector3(0, 0, radius), new THREE.Vector3(0, 0, -radius),
    ].map((point) => point.applyQuaternion(rotation).add(activeCenter))
    const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] as const
    for (const [a, b, c] of faces) pushTriangle(points[a]!, points[b]!, points[c]!, 1.02)
  }

  const crystalCount = 12
  const orientationClassCount = 6
  const dendriteSizes = [0.23, 0.245, 0.26, 0.275, 0.29] as const
  const branchOrigins = [0.45, 0.42, 0.5, 0.38, 0.56] as const
  const branchAngles = [0.56, 0.5, 0.68, 0.82, 0.96] as const
  const armLengthPatterns = [[1, 0.72, 0.88], [1, 1, 1], [0.84, 1, 0.76], [1, 0.82, 1], [0.78, 1, 0.9]] as const
  const orientationPairs = [[0.18, 0.22], [0.26, 0.38], [0.34, 0.16], [0.22, 0.5], [0.4, 0.3], [0.3, 0.6]] as const
  const secondaryPlaneScale = 0.72
  const radialCenters = [
    [-0.32, -0.3, -0.4], [0.38, -0.18, 0.35], [0, 0.08, 0], [0.25, 0.42, -0.45],
    [-0.95, 0.05, 0.45], [-0.5, 0.85, -0.72], [0.62, -0.85, -0.5], [1, 0.2, 0.64],
    [-1.55, -0.2, -1.18], [-0.75, 1.3, 1.22], [0.78, 0.95, -1.55], [1.5, -0.12, 1.48],
  ] as const
  for (let crystal = 0; crystal < crystalCount; crystal += 1) {
    const shell = Math.floor(crystal / 4)
    activeCenter = new THREE.Vector3(...radialCenters[crystal]!)
    activeDirection = activeCenter.clone().normalize()
    activeSeed = ((crystal * 11 + 3) % crystalCount) / crystalCount
    const variant = (crystal * 2 + shell) % dendriteSizes.length
    const hierarchyScale = crystal === 2 ? 1.25 : 0.94 + (crystal % 3) * 0.04
    const size = dendriteSizes[variant]! * (shell === 0 ? 1.02 : shell === 1 ? 0.9 : 0.8) * hierarchyScale
    const orientation = crystal % orientationClassCount
    const [tiltX, tiltY] = orientationPairs[orientation]!
    const plane = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, tiltY, 0)).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), crystal * 0.17),
    )
    for (let bar = 0; bar < 3; bar += 1) {
      const rotation = plane.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bar * Math.PI / 3),
      )
      appendTriangularPrism(size * armLengthPatterns[variant]![bar]!, size * 0.15, rotation)
    }
    {
      const branchTierCount = variant === 3 ? 2 : 1
      for (let tier = 0; tier < branchTierCount; tier += 1) {
        for (let arm = 0; arm < 6; arm += 1) {
          const armAngle = arm * Math.PI / 3
          const origin = new THREE.Vector3(Math.cos(armAngle), Math.sin(armAngle), 0)
            .multiplyScalar(size * (branchOrigins[variant]! + tier * 0.26))
            .applyQuaternion(plane)
          for (const branchSign of [-1, 1]) {
            const branchAngle = armAngle + branchSign * (branchAngles[variant]! - tier * 0.14)
            const halfLength = size * (0.3 + variant * 0.03 - tier * 0.035)
            const branchDirection = new THREE.Vector3(Math.cos(branchAngle), Math.sin(branchAngle), 0)
            const branchCenter = origin.clone().add(branchDirection.clone().multiplyScalar(halfLength).applyQuaternion(plane))
            const rotation = plane.clone().multiply(
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), branchAngle),
            )
            appendTriangularPrism(halfLength, size * (0.085 + variant * 0.008), rotation, branchCenter)
          }
        }
      }
    }
    const secondaryPlanes = [
      plane.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
      plane.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)),
    ]
    for (const depthPlane of secondaryPlanes) {
      for (let bar = 0; bar < 3; bar += 1) {
        const rotation = depthPlane.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bar * Math.PI / 3),
        )
        appendTriangularPrism(size * secondaryPlaneScale, size * 0.055, rotation)
      }
      for (let arm = 0; arm < 6; arm += 1) {
        const armAngle = arm * Math.PI / 3
        const origin = new THREE.Vector3(Math.cos(armAngle), Math.sin(armAngle), 0)
          .multiplyScalar(size * 0.46)
          .applyQuaternion(depthPlane)
        for (const branchSign of [-1, 1]) {
          const branchAngle = armAngle + branchSign * (0.54 + variant * 0.055)
          const halfLength = size * (0.18 + variant * 0.015)
          const branchDirection = new THREE.Vector3(Math.cos(branchAngle), Math.sin(branchAngle), 0)
          const branchCenter = origin.clone().add(branchDirection.clone().multiplyScalar(halfLength).applyQuaternion(depthPlane))
          const rotation = depthPlane.clone().multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), branchAngle),
          )
          appendTriangularPrism(halfLength, size * 0.068, rotation, branchCenter)
        }
      }
    }
    appendCore(size * 0.22, plane)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxSnowBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxSnowBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSnowBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSnowBurstDrawCalls'] = 1
  geometry.userData['pfxSnowBurstClosedFaces'] = true
  geometry.userData['pfxSnowBurstWorldSpaceVolume'] = true
  geometry.userData['pfxSnowBurstBillboardCount'] = 0
  geometry.userData['pfxSnowBurstCrystalCount'] = crystalCount
  geometry.userData['pfxSnowBurstCentralNucleusCount'] = 1
  geometry.userData['pfxSnowBurstCrystalArmCount'] = 6
  geometry.userData['pfxSnowBurstBranchedArmPairCount'] = 12
  geometry.userData['pfxSnowBurstDendriteVariantCount'] = dendriteSizes.length
  geometry.userData['pfxSnowBurstArmLengthPatternCount'] = armLengthPatterns.length
  geometry.userData['pfxSnowBurstPlainStellarVariantCount'] = 0
  geometry.userData['pfxSnowBurstDualBranchTierVariantCount'] = 1
  geometry.userData['pfxSnowBurstPerpendicularDepthBraceCount'] = 0
  geometry.userData['pfxSnowBurstPerpendicularDendritePlaneCount'] = crystalCount * 2
  geometry.userData['pfxSnowBurstSecondaryDendritePlanesPerCrystal'] = 2
  geometry.userData['pfxSnowBurstPerpendicularDendriteBranchCount'] = 12
  geometry.userData['pfxSnowBurstSecondaryPlaneScale'] = secondaryPlaneScale
  geometry.userData['pfxSnowBurstDirectedUpwardFan'] = false
  geometry.userData['pfxSnowBurstRadialShellCount'] = 3
  geometry.userData['pfxSnowBurstAngularSectorCount'] = crystalCount
  geometry.userData['pfxSnowBurstOrientationClassCount'] = orientationClassCount
  geometry.userData['pfxSnowBurstRadialEmitter'] = true
  geometry.userData['pfxSnowBurstDepthLayerCount'] = 12
  geometry.userData['pfxSnowBurstOnsetVolumeSpread'] = 0.68
  geometry.userData['pfxSnowBurstTopology'] = 'closed-branched-six-arm-crystal-prisms'
  geometry.userData['pfxSnowBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxSnowBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxSnowBurstWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSnowBurstDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSnowBurstHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxSnowBurstCrystalMaterial(
  opacity: number,
  primaryColor = '#edfaff',
  secondaryColor = '#5bbde8',
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
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSnowBurstCenter;
      attribute float pfxSnowBurstSeed;
      attribute vec3 pfxSnowBurstDirection;
      varying vec3 vCrystalColor;
      varying vec3 vCrystalNormal;
      varying vec3 vCrystalViewPosition;
      varying float vCrystalSeed;
      varying float vCrystalDecay;
      varying float vCrystalDepthCue;
      void main() {
        float burstExpansion = smoothstep(0.035, 0.22, uCycle);
        float gravityDrift = smoothstep(0.24, 0.68, uCycle);
        float delayedBurst = smoothstep(pfxSnowBurstSeed * 0.028, 0.16 + pfxSnowBurstSeed * 0.035, uCycle);
        float spin = burstExpansion * (0.36 + pfxSnowBurstSeed * 0.68) + gravityDrift * (0.18 + pfxSnowBurstSeed * 0.24);
        mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        vec3 local = position - pfxSnowBurstCenter;
        local.xy = rotation * local.xy;
        float crystalScale = mix(0.94, 1.0, delayedBurst) * (1.0 - gravityDrift * 0.12);
        vec3 center = pfxSnowBurstCenter * mix(0.68, 1.0, burstExpansion);
        center += pfxSnowBurstDirection * sin(burstExpansion * 3.1415927) * 0.16;
        float groundSeekingDrift = gravityDrift * gravityDrift * (1.5 + pfxSnowBurstSeed * 1.6);
        center.y -= groundSeekingDrift;
        center.x += sin(gravityDrift * 5.2 + pfxSnowBurstSeed * 19.0) * gravityDrift * (0.22 + pfxSnowBurstSeed * 0.16);
        center.z += cos(gravityDrift * 4.4 + pfxSnowBurstSeed * 13.0) * gravityDrift * 0.18;
        vec3 transformed = center + local * crystalScale;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 rotatedNormal = normal;
        rotatedNormal.xy = rotation * rotatedNormal.xy;
        vCrystalColor = color;
        vCrystalNormal = normalize(normalMatrix * rotatedNormal);
        vCrystalViewPosition = viewPosition.xyz;
        vCrystalSeed = pfxSnowBurstSeed;
        vCrystalDecay = 1.0 - smoothstep(0.48, 0.72, uCycle);
        vCrystalDepthCue = clamp(pfxSnowBurstCenter.z / 2.8 + 0.5, 0.0, 1.0);
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
      varying vec3 vCrystalColor;
      varying vec3 vCrystalNormal;
      varying vec3 vCrystalViewPosition;
      varying float vCrystalSeed;
      varying float vCrystalDecay;
      varying float vCrystalDepthCue;
      void main() {
        vec3 normal = normalize(vCrystalNormal);
        vec3 viewDirection = normalize(-vCrystalViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float frostRim = pow(1.0 - facing, mix(1.4, 2.6, uStyleEdgeHardness));
        float crystalFacet = 0.5 + 0.5 * abs(dot(normal, normalize(vec3(0.38, 0.86, 0.34))));
        float prismaticGlint = pow(max(0.0, sin(vCrystalSeed * 37.0 + uCycle * 18.8495559)), 10.0);
        float onsetReadability = smoothstep(vCrystalSeed * 0.018 - 0.05, vCrystalSeed * 0.018 + 0.005, uCycle);
        float onsetReveal = onsetReadability;
        vec3 deepIceFacet = mix(uSecondaryColor * 0.34, uSecondaryColor * 0.82, crystalFacet);
        vec3 controlledCrystalColor = mix(deepIceFacet, uPrimaryColor, pow(facing, 1.35) * 0.58 + crystalFacet * 0.24);
        vec3 prismaticHueShift = mix(vec3(0.48, 0.78, 1.0), vec3(0.82, 0.72, 1.0), fract(vCrystalSeed * 5.17));
        controlledCrystalColor = mix(controlledCrystalColor, prismaticHueShift, frostRim * 0.24);
        controlledCrystalColor *= 0.78 + vCrystalColor.b * 0.24;
        controlledCrystalColor += uPrimaryColor * prismaticGlint * mix(0.18, 0.36, uDensity);
        controlledCrystalColor += uSecondaryColor * frostRim * mix(0.2, 0.38, uStyleEdgeHardness);
        float accentCrystal = smoothstep(0.78, 0.96, fract(vCrystalSeed * 7.13));
        controlledCrystalColor += vec3(1.0, 0.78, 0.42) * prismaticGlint * accentCrystal * 0.42;
        float heroCrystalHighlight = 1.0 - smoothstep(0.035, 0.13, abs(vCrystalSeed - 0.0833333));
        float centralNucleusHighlight = heroCrystalHighlight * (0.82 + prismaticGlint * 0.18);
        controlledCrystalColor *= mix(0.74, 1.1, vCrystalDepthCue) * (1.0 + centralNucleusHighlight * 0.42);
        float decayIceRadiance = mix(2.0, 1.0, vCrystalDecay);
        controlledCrystalColor *= decayIceRadiance;
        float burstFlash = 0.78 + exp(-pow((uCycle - 0.2) / 0.12, 2.0)) * 0.22;
        float onsetBrightness = 1.0 + (1.0 - smoothstep(0.0, 0.16, uCycle)) * 0.72;
        float cleanCrystalFade = smoothstep(0.12, 0.48, vCrystalDecay);
        gl_FragColor = vec4(controlledCrystalColor * burstFlash * onsetBrightness, uOpacity * onsetReveal * cleanCrystalFade * (0.72 + facing * 0.25));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxSnowBurstMaterial'] = true
  material.userData['pfxSnowBurstMaterialRole'] = 'crystal'
  material.userData['pfxSnowBurstControlBinding'] = 'primary-secondary-density-style'
  return material
}
