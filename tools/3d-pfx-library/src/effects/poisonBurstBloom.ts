import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxPoisonBurstBloomGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendGeometry = (source: THREE.BufferGeometry, center: THREE.Vector3, seed: number, form: number) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }

  const core = new THREE.SphereGeometry(1, 14, 8)
  core.scale(0.72, 0.78, 0.66)
  core.translate(0, 0.52, 0)
  appendGeometry(core, new THREE.Vector3(0, 0.52, 0), 0.5, 0)

  const vaporLobeCount = 16
  const lobeCenters = [
    [-0.72, 0.36, 0.12], [0.68, 0.42, -0.08],
    [-0.48, 0.62, -0.64], [0.52, 0.68, 0.68],
    [-0.18, 0.82, 0.46], [0.22, 0.9, -0.5],
    [-0.74, 1.0, -0.26], [0.72, 1.08, 0.3],
    [-0.42, 1.18, 0.2], [0.46, 1.24, -0.22],
    [-0.12, 1.36, -0.52], [0.16, 1.42, 0.56],
    [-0.58, 1.42, 0.06], [0.56, 1.5, -0.04],
    [-0.22, 1.62, 0.14], [0.24, 1.68, -0.12],
  ] as const
  for (let lobe = 0; lobe < vaporLobeCount; lobe += 1) {
    const seed = ((lobe * 53 + 17) % 109) / 109
    const layer = lobe % 4
    const angle = lobe * 2.39996 + layer * 0.21
    const authoredCenter = lobeCenters[lobe]!
    const center = new THREE.Vector3(authoredCenter[0], authoredCenter[1], authoredCenter[2])
    const lobeGeometry = new THREE.SphereGeometry(1, 11, 7)
    const taper = THREE.MathUtils.clamp(0.66 - center.y * 0.19, 0.31, 0.56)
    lobeGeometry.scale(taper * (0.92 + (lobe % 3) * 0.08), taper * (0.9 + ((lobe + 2) % 4) * 0.07), taper * (0.88 + ((lobe + 1) % 3) * 0.09))
    lobeGeometry.rotateY(angle * 0.42)
    lobeGeometry.translate(center.x, center.y, center.z)
    appendGeometry(lobeGeometry, center, seed, 1 + layer)
  }

  const groundLobeCount = 8
  for (let lobe = 0; lobe < groundLobeCount; lobe += 1) {
    const seed = ((lobe * 37 + 9) % 101) / 101
    const angle = lobe / groundLobeCount * Math.PI * 2 + (seed - 0.5) * 0.32
    const center = new THREE.Vector3(Math.cos(angle) * (0.62 + (lobe % 3) * 0.1), 0.03 + (lobe % 2) * 0.025, Math.sin(angle) * (0.58 + ((lobe + 1) % 3) * 0.1))
    const groundLobe = new THREE.SphereGeometry(1, 8, 4)
    groundLobe.scale(0.42 + (lobe % 3) * 0.06, 0.12 + (lobe % 2) * 0.035, 0.32 + ((lobe + 1) % 3) * 0.055)
    groundLobe.translate(center.x, center.y, center.z)
    appendGeometry(groundLobe, center, seed, 5)
  }

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxPoisonBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxPoisonBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxPoisonBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPoisonBurstBloomDrawCalls'] = 1
  geometry.userData['pfxPoisonBurstBloomClosedFaces'] = true
  geometry.userData['pfxPoisonBurstBloomWorldSpaceVolume'] = true
  geometry.userData['pfxPoisonBurstBloomSmoothNormals'] = true
  geometry.userData['pfxPoisonBurstBloomBillboardCount'] = 0
  geometry.userData['pfxPoisonBurstCoreCount'] = 1
  geometry.userData['pfxPoisonBurstVaporLobeCount'] = vaporLobeCount
  geometry.userData['pfxPoisonBurstGroundLobeCount'] = groundLobeCount
  geometry.userData['pfxPoisonBurstDepthLayerCount'] = 8
  geometry.userData['pfxPoisonBurstAsymmetricVolume'] = true
  geometry.userData['pfxPoisonBurstSilhouette'] = 'balanced-vertical-cauliflower-plume'
  geometry.userData['pfxPoisonBurstOnsetProfile'] = 'readable-swollen-toxin-seed'
  geometry.userData['pfxPoisonBurstOnsetCoreScale'] = 1.12
  geometry.userData['pfxPoisonBurstDecayProfile'] = 'multi-lobe-dissolution-no-isolated-core'
  geometry.userData['pfxPoisonBurstTopology'] = 'welded-core-and-overlapping-toxic-vapor-lobes'
  geometry.userData['pfxPoisonBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxPoisonBurstBloomTriangleCount'] = positions.length / 9
  geometry.userData['pfxPoisonBurstBloomWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxPoisonBurstBloomDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxPoisonBurstBloomHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxPoisonBurstBloomMaterial(
  opacity: number,
  primaryColor = '#6b2a8e',
  secondaryColor = '#9cff57',
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
      attribute vec3 pfxPoisonBurstCenter;
      attribute float pfxPoisonBurstSeed;
      attribute float pfxPoisonBurstForm;
      varying vec3 vPoisonNormal;
      varying vec3 vPoisonViewPosition;
      varying vec3 vPoisonLocalPosition;
      varying float vPoisonSeed;
      varying float vPoisonForm;
      varying float vPoisonLife;
      void main() {
        float toxicRupture = smoothstep(0.045 + pfxPoisonBurstSeed * 0.012, 0.3 + pfxPoisonBurstSeed * 0.025, uCycle);
        float vaporDispersal = smoothstep(0.43, 0.82, uCycle);
        vec3 local = position - pfxPoisonBurstCenter;
        float lobeForm = step(0.5, pfxPoisonBurstForm);
        float groundForm = step(4.5, pfxPoisonBurstForm);
        float vaporForm = lobeForm * (1.0 - groundForm);
        vec3 onsetScale = mix(vec3(1.04, 1.12, 1.04), vec3(0.55, 0.68, 0.55), lobeForm);
        local *= mix(onsetScale, vec3(1.0), toxicRupture);
        local.xz *= 1.0 + sin(uCycle * 13.0 + pfxPoisonBurstSeed * 23.0) * 0.055 * lobeForm;
        vec3 center = pfxPoisonBurstCenter * mix(lobeForm > 0.5 ? 0.24 : 0.92, 1.0, toxicRupture);
        center.x += sin(pfxPoisonBurstSeed * 19.0) * vaporDispersal * (0.12 + pfxPoisonBurstForm * 0.025);
        center.y += vaporDispersal * (0.05 + pfxPoisonBurstSeed * 0.24);
        center.z += cos(pfxPoisonBurstSeed * 17.0) * vaporDispersal * 0.14;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vPoisonNormal = normalize(normalMatrix * normal);
        vPoisonViewPosition = viewPosition.xyz;
        vPoisonLocalPosition = local;
        vPoisonSeed = pfxPoisonBurstSeed;
        vPoisonForm = pfxPoisonBurstForm;
        float reveal = (1.0 - lobeForm) * 0.92 + vaporForm * (0.14 + toxicRupture * 0.86) + groundForm * (0.52 + toxicRupture * 0.48);
        float rapidLobeRetire = 1.0 - smoothstep(0.46 + pfxPoisonBurstSeed * 0.018, 0.62 + pfxPoisonBurstSeed * 0.07, uCycle);
        float coreRetire = 1.0 - smoothstep(0.46, 0.57, uCycle);
        float groundRetire = 1.0 - smoothstep(0.6 + pfxPoisonBurstSeed * 0.01, 0.76 + pfxPoisonBurstSeed * 0.025, uCycle);
        float multiLobeDissolution = (1.0 - lobeForm) * coreRetire + vaporForm * rapidLobeRetire + groundForm * groundRetire;
        vPoisonLife = reveal * multiLobeDissolution;
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
      varying vec3 vPoisonNormal;
      varying vec3 vPoisonViewPosition;
      varying vec3 vPoisonLocalPosition;
      varying float vPoisonSeed;
      varying float vPoisonForm;
      varying float vPoisonLife;
      void main() {
        vec3 normal = normalize(vPoisonNormal);
        vec3 viewDirection = normalize(-vPoisonViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float toxicDensity = pow(max(facing, 0.02), mix(0.62, 1.35, uStyleEdgeHardness));
        float sicklyRim = pow(1.0 - facing, mix(1.3, 3.0, uStyleEdgeHardness));
        float filledPoisonResidue = step(4.5, vPoisonForm);
        float authoredRim = sicklyRim * (1.0 - filledPoisonResidue);
        float bruiseBands = 0.5 + 0.5 * sin(vPoisonLocalPosition.y * 9.0 + vPoisonLocalPosition.x * 7.0 + vPoisonSeed * 21.0);
        float solidToxicFill = 0.72 + toxicDensity * 0.22;
        float toxicSeedVeins = pow(bruiseBands, 5.0) * (1.0 - smoothstep(0.08, 0.3, uCycle));
        float onsetToxinPulse = 1.0 - smoothstep(0.0, 0.18, uCycle);
        vec3 bruisePigment = mix(uPrimaryColor * 0.48, uPrimaryColor * 1.12, bruiseBands);
        vec3 vaporColor = mix(bruisePigment, uSecondaryColor * 0.92, authoredRim * (0.46 + uDensity * 0.28));
        vaporColor = mix(vaporColor, uPrimaryColor * 0.72, filledPoisonResidue * 0.36);
        vaporColor += mix(uSecondaryColor, vec3(0.92, 1.0, 0.62), 0.32) * pow(max(0.0, dot(normal, normalize(vec3(0.3, 0.88, -0.2)))), 4.2) * 0.36;
        vaporColor += uSecondaryColor * toxicSeedVeins * (0.48 + onsetToxinPulse * 0.24);
        vaporColor *= 0.82 + toxicDensity * 0.24 + (vPoisonForm > 2.5 ? 0.08 : 0.0);
        float porousBreakup = smoothstep(0.54, 0.75, uCycle) * (0.5 + 0.5 * sin(vPoisonSeed * 31.0 + vPoisonLocalPosition.y * 14.0));
        float alpha = uOpacity * vPoisonLife * (solidToxicFill + authoredRim * 0.08 + filledPoisonResidue * 0.1 + onsetToxinPulse * 0.08) * (1.0 - porousBreakup * 0.34);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vaporColor, clamp(alpha, 0.0, 0.9));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxPoisonBurstMaterial'] = true
  material.userData['pfxPoisonBurstMaterialRole'] = 'bloom'
  material.userData['pfxPoisonBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPoisonBurstMaterialProfile'] = 'bruised-vapor-volume-with-sickly-rim'
  return material
}
