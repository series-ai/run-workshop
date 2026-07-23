import * as THREE from 'three'

export function createPfxSnowBurstPowderGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const layers: number[] = []
  const pushPrimitive = (
    source: THREE.BufferGeometry,
    center: THREE.Vector3,
    scale: THREE.Vector3,
    seed: number,
    form: number,
    layer: number,
    rotation = new THREE.Quaternion(),
  ) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    const sourceNormals = nonIndexed.getAttribute('normal')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      const normal = new THREE.Vector3().fromBufferAttribute(sourceNormals, vertex)
      normal.set(normal.x / scale.x, normal.y / scale.y, normal.z / scale.z).normalize().applyQuaternion(rotation)
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      const shade = 0.72 + seed * 0.26
      colors.push(shade * 0.72, shade * 0.9, shade)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
      layers.push(layer)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }

  const pushMiniRosette = (center: THREE.Vector3, size: number, seed: number, form: number, layer: number, grounded = false) => {
    const baseRotation = grounded
      ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
      : new THREE.Quaternion()
    for (let bar = 0; bar < 3; bar += 1) {
      const rotation = baseRotation.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bar * Math.PI / 3),
      )
      pushPrimitive(
        new THREE.CylinderGeometry(1, 1, 2, 4, 1, false),
        center,
        new THREE.Vector3(size * 0.16, size, size * 0.16),
        seed,
        form,
        layer,
        rotation,
      )
    }
    pushPrimitive(
      new THREE.CylinderGeometry(1, 1, 2, 4, 1, false),
      center,
      new THREE.Vector3(size * 0.13, size * 0.58, size * 0.13),
      seed,
      form,
      layer,
      grounded
        ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
        : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
    )
    pushPrimitive(
      new THREE.OctahedronGeometry(1, 0),
      center,
      new THREE.Vector3(size * 0.25, size * 0.25, size * 0.25),
      seed,
      form,
      layer,
    )
  }

  const granuleCount = 18
  const powderElevations = [-0.55, 0.25, 0.65, -0.3, 0.4, -0.7] as const
  for (let granule = 0; granule < granuleCount; granule += 1) {
    const seed = ((granule * 29 + 7) % 97) / 97
    const layer = granule % 6
    const shell = Math.floor(granule / 6)
    const sector = granule % 6
    const radius = [0.55, 1.15, 1.75][shell]!
    const elevation = powderElevations[sector]!
    const horizontal = Math.sqrt(1 - elevation * elevation)
    const angle = sector / 6 * Math.PI * 2 + shell * 0.31
    const jitter = ((granule * 17) % 13) / 13 - 0.5
    const center = new THREE.Vector3(
      Math.cos(angle) * radius * horizontal * 0.95 + jitter * 0.12,
      elevation * radius * 0.72 + jitter * 0.08,
      Math.sin(angle) * radius * horizontal * 1.18 - jitter * 0.1,
    )
    const size = 0.065 + (granule % 4) * 0.008
    pushMiniRosette(center, size, seed, 0, layer / 5)
  }

  const groundRosettes = [
    [-0.66, -0.66, -0.22, 0.1], [-0.4, -0.65, 0.24, 0.085], [-0.14, -0.67, -0.34, 0.11],
    [0.14, -0.65, 0.3, 0.09], [0.42, -0.67, -0.18, 0.105], [0.68, -0.65, 0.2, 0.08],
  ] as const
  for (const [groundIndex, [x, y, z, size]] of groundRosettes.entries()) {
    pushMiniRosette(
      new THREE.Vector3(x, y, z),
      size,
      0.1 + groundIndex * 0.14,
      2,
      groundIndex / (groundRosettes.length - 1),
      true,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxSnowBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxSnowBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSnowBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxSnowBurstLayer', new THREE.Float32BufferAttribute(layers, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSnowBurstPowderDrawCalls'] = 1
  geometry.userData['pfxSnowBurstPowderClosedFaces'] = true
  geometry.userData['pfxSnowBurstPowderGranuleCount'] = granuleCount
  geometry.userData['pfxSnowBurstPowderGranuleTopology'] = 'closed-mini-six-arm-prism-rosettes'
  geometry.userData['pfxSnowBurstPowderMiniRosetteArmCount'] = 6
  geometry.userData['pfxSnowBurstPowderMiniRosetteDepthSpineCount'] = 1
  geometry.userData['pfxSnowBurstPowderLobeCount'] = 0
  geometry.userData['pfxSnowBurstPowderCellsPerLobe'] = 0
  geometry.userData['pfxSnowBurstPowderCellCount'] = 0
  geometry.userData['pfxSnowBurstPowderCrystalClusterCount'] = 0
  geometry.userData['pfxSnowBurstPowderCloudLobeCount'] = 0
  geometry.userData['pfxSnowBurstPowderRadialShellCount'] = 3
  geometry.userData['pfxSnowBurstPowderAngularSectorCount'] = 6
  geometry.userData['pfxSnowBurstPowderOnsetVolumeSpread'] = 0.42
  geometry.userData['pfxSnowBurstGroundContactCount'] = groundRosettes.length
  geometry.userData['pfxSnowBurstGroundContactTopology'] = 'six-arm-grounded-prism-rosettes'
  geometry.userData['pfxSnowBurstPowderDepthLayerCount'] = 6
  geometry.userData['pfxSnowBurstPowderBillboardCount'] = 0
  geometry.userData['pfxSnowBurstPowderTopology'] = 'closed-mini-rosettes-and-grounded-prism-rosettes'
  geometry.userData['pfxSnowBurstPowderTriangleCount'] = positions.length / 9
  geometry.userData['pfxSnowBurstPowderWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxSnowBurstPowderDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxSnowBurstPowderHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxSnowBurstPowderMaterial(
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
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSnowBurstCenter;
      attribute float pfxSnowBurstSeed;
      attribute float pfxSnowBurstForm;
      attribute float pfxSnowBurstLayer;
      varying vec3 vPowderColor;
      varying vec3 vPowderNormal;
      varying vec3 vPowderViewPosition;
      varying vec3 vPowderPosition;
      varying float vPowderSeed;
      varying float vPowderForm;
      varying float vPowderLayer;
      varying float vPowderDecay;
      void main() {
        float burstExpansion = smoothstep(0.06, 0.3, uCycle);
        float gravityDrift = smoothstep(0.26, 0.72, uCycle);
        vec3 local = position - pfxSnowBurstCenter;
        float spin = burstExpansion * (0.22 + pfxSnowBurstSeed * 0.45);
        mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
        local.xz = rotation * local.xz;
        float powderInflation = pfxSnowBurstForm > 0.5
          ? mix(0.62, 1.0 + gravityDrift * 0.14, burstExpansion)
          : mix(0.36, 1.0, burstExpansion);
        float powderOnsetVolumeSpread = pfxSnowBurstForm > 0.5 ? 0.28 : 0.42;
        vec3 center = pfxSnowBurstCenter * mix(powderOnsetVolumeSpread, 1.0, burstExpansion);
        float powderGroundSeekingDrift = gravityDrift * gravityDrift * mix(1.45, 2.3, pfxSnowBurstSeed);
        center.y -= powderGroundSeekingDrift;
        center.x += sin(gravityDrift * 4.8 + pfxSnowBurstSeed * 17.0) * gravityDrift * mix(0.18, 0.38, pfxSnowBurstSeed);
        center.z += cos(gravityDrift * 4.1 + pfxSnowBurstSeed * 11.0) * gravityDrift * 0.2;
        if (pfxSnowBurstForm > 1.5) {
          center = pfxSnowBurstCenter;
          powderInflation = mix(0.28, 1.0, smoothstep(0.08, 0.28, uCycle));
        }
        vec3 transformed = center + local * powderInflation;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vPowderColor = color;
        vPowderNormal = normalize(normalMatrix * normal);
        vPowderViewPosition = viewPosition.xyz;
        vPowderPosition = transformed;
        vPowderSeed = pfxSnowBurstSeed;
        vPowderForm = pfxSnowBurstForm;
        vPowderLayer = pfxSnowBurstLayer;
        vPowderDecay = 1.0 - smoothstep(pfxSnowBurstForm > 0.5 ? 0.58 : 0.7, 0.86, uCycle);
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
      varying vec3 vPowderColor;
      varying vec3 vPowderNormal;
      varying vec3 vPowderViewPosition;
      varying vec3 vPowderPosition;
      varying float vPowderSeed;
      varying float vPowderForm;
      varying float vPowderLayer;
      varying float vPowderDecay;
      void main() {
        vec3 normal = normalize(vPowderNormal);
        vec3 viewDirection = normalize(-vPowderViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float powderNoise = 0.5 + 0.5 * sin(dot(vPowderPosition, vec3(4.2, 3.3, 3.7)) + vPowderSeed * 29.0);
        float powderNoiseB = 0.5 + 0.5 * sin(dot(vPowderPosition, vec3(-7.1, 5.8, 6.4)) - vPowderSeed * 17.0);
        float powderNoiseC = 0.5 + 0.5 * sin(dot(vPowderPosition, vec3(9.2, -8.4, 5.1)) + vPowderSeed * 11.0);
        float powderWisps = powderNoise * 0.46 + powderNoiseB * 0.32 + powderNoiseC * 0.22;
        float powderVolume = smoothstep(0.08, 0.82, facing) * (0.68 + powderWisps * 0.32);
        float powderBackscatter = pow(max(0.0, dot(normal, normalize(vec3(-0.34, 0.82, 0.46)))), 2.0);
        float granuleGlint = pow(max(0.0, sin(vPowderSeed * 43.0 + uCycle * 15.7079633)), 12.0);
        float powderOnset = 0.48 + smoothstep(0.0, 0.15, uCycle) * 0.52;
        vec3 controlledPowderColor = mix(uSecondaryColor, uPrimaryColor, facing * 0.46 + powderBackscatter * 0.34 + vPowderLayer * 0.12);
        if (vPowderForm > 1.5) {
          float groundContactRadiance = 2.8 + powderBackscatter * 0.54;
          gl_FragColor = vec4(uPrimaryColor * groundContactRadiance, uOpacity * powderOnset * smoothstep(0.1, 0.42, vPowderDecay) * 0.9);
          return;
        }
        controlledPowderColor += uPrimaryColor * granuleGlint * mix(0.2, 0.38, uStyleEdgeHardness);
        controlledPowderColor *= 0.86 + vPowderColor.b * 0.16;
        float decayCrystalReadability = mix(1.8, 1.0, vPowderDecay);
        controlledPowderColor *= decayCrystalReadability;
        gl_FragColor = vec4(controlledPowderColor, uOpacity * powderOnset * smoothstep(0.1, 0.42, vPowderDecay) * (0.42 + facing * 0.36 + powderVolume * 0.1));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxSnowBurstMaterial'] = true
  material.userData['pfxSnowBurstMaterialRole'] = 'powder'
  material.userData['pfxSnowBurstControlBinding'] = 'primary-secondary-density-style'
  return material
}
