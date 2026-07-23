import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { createPfxSlimeRingGeometry } from './slimeRing'

export function createPfxAcidSpawnLifecycle(cycle: number): {
  energy: number
  aperture: number
  crown: number
  drain: number
  stage: 'seed' | 'erupt' | 'drain' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const seed = smooth(phase / 0.1)
    return { energy: roundMetric(0.48 + seed * 0.4), aperture: roundMetric(0.18 + seed * 0.48), crown: roundMetric(seed * 0.18), drain: 0, stage: 'seed' }
  }
  if (phase < 0.38) {
    const erupt = smooth((phase - 0.1) / 0.28)
    return { energy: roundMetric(0.88 + erupt * 0.12), aperture: roundMetric(0.66 + erupt * 0.34), crown: roundMetric(0.72 + erupt * 0.28), drain: 0, stage: 'erupt' }
  }
  if (phase < 0.74) {
    const drain = smooth((phase - 0.38) / 0.36)
    return { energy: roundMetric(1 - drain * 0.08), aperture: 1, crown: roundMetric(1 - drain * 0.82), drain: roundMetric(0.46 + drain * 0.54), stage: 'drain' }
  }
  return { energy: 0, aperture: 0, crown: 0, drain: 1, stage: 'rest' }
}

export function createPfxAcidSpawnGeometry(): THREE.BufferGeometry {
  const geometry = createPfxSlimeRingGeometry()
  geometry.setAttribute('pfxAcidSpawnCenter', geometry.getAttribute('pfxSlimeRingCenter'))
  geometry.setAttribute('pfxAcidSpawnForm', geometry.getAttribute('pfxSlimeRingForm'))
  geometry.setAttribute('pfxAcidSpawnSeed', geometry.getAttribute('pfxSlimeRingSeed'))
  geometry.setAttribute('pfxAcidSpawnPaletteIndex', geometry.getAttribute('pfxSlimeRingPaletteIndex'))
  geometry.deleteAttribute('pfxSlimeRingCenter')
  geometry.deleteAttribute('pfxSlimeRingForm')
  geometry.deleteAttribute('pfxSlimeRingSeed')
  geometry.deleteAttribute('pfxSlimeRingPaletteIndex')
  geometry.userData['pfxAcidSpawnDrawCalls'] = 1
  geometry.userData['pfxAcidSpawnClosedFaces'] = true
  geometry.userData['pfxAcidSpawnBillboardCount'] = 0
  geometry.userData['pfxAcidSpawnPoolSegmentCount'] = 20
  geometry.userData['pfxAcidSpawnRisingCrownCount'] = 6
  geometry.userData['pfxAcidSpawnWorldPlane'] = 'xz-grounded'
  geometry.userData['pfxAcidSpawnSilhouetteProfile'] = 'corrosive-aperture-with-asymmetric-rising-crowns'
  geometry.userData['pfxAcidSpawnPalette'] = 'chartreuse-lime-toxic-teal'
  geometry.userData['pfxAcidSpawnAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxAcidSpawnTriangleCount'] = geometry.getAttribute('position').count / 3
  geometry.userData['pfxAcidSpawnWidthSpan'] = 2.28
  geometry.userData['pfxAcidSpawnDepthSpan'] = 2.2
  geometry.userData['pfxAcidSpawnPeakHeightSpan'] = 1.32
  return geometry
}

export function createPfxAcidSpawnMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxAcidSpawnCenter;
      attribute float pfxAcidSpawnForm;
      attribute float pfxAcidSpawnSeed;
      attribute float pfxAcidSpawnPaletteIndex;
      varying vec3 vAcidNormal;
      varying vec3 vAcidViewPosition;
      varying float vAcidForm;
      varying float vAcidPaletteIndex;
      varying float vAcidLife;
      varying float vAcidSeed;
      void main() {
        float isCrown = step(0.5, pfxAcidSpawnForm);
        float corrosiveSpread = mix(0.18, 1.0, smoothstep(0.01, 0.28, uCycle));
        float eruptionCrown = smoothstep(0.06 + pfxAcidSpawnSeed * 0.04, 0.32, uCycle) * (1.0 - smoothstep(0.46, 0.72, uCycle));
        float drainBack = smoothstep(0.38, 0.72, uCycle);
        vec3 poolPosition = position;
        poolPosition.xz *= corrosiveSpread;
        poolPosition.y *= 0.76 + eruptionCrown * 0.24;
        vec3 crownLocal = position - pfxAcidSpawnCenter;
        float crownWidth = 0.82 + eruptionCrown * 0.24;
        crownLocal *= vec3(crownWidth, 0.48 + eruptionCrown * 2.7, crownWidth);
        crownLocal.x += crownLocal.y * (pfxAcidSpawnSeed - 0.46) * eruptionCrown * 0.72;
        crownLocal.z += crownLocal.y * (0.54 - pfxAcidSpawnSeed) * eruptionCrown * 0.56;
        vec3 crownCenter = pfxAcidSpawnCenter;
        crownCenter.xz *= corrosiveSpread;
        crownCenter.y = 0.055 + eruptionCrown * (0.12 + pfxAcidSpawnSeed * 0.24) - drainBack * 0.05;
        crownCenter.x += sin(pfxAcidSpawnSeed * 12.56637 + uCycle * 6.2831853) * eruptionCrown * 0.04;
        crownCenter.z += cos(pfxAcidSpawnSeed * 9.424778 + uCycle * 6.2831853) * eruptionCrown * 0.035;
        vec3 transformed = mix(poolPosition, crownCenter + crownLocal, isCrown);
        float birth = smoothstep(0.004 + pfxAcidSpawnSeed * 0.012, 0.065 + pfxAcidSpawnSeed * 0.02, uCycle);
        float retire = 1.0 - smoothstep(0.64, 0.74, uCycle);
        vAcidLife = birth * retire;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vAcidNormal = normalize(normalMatrix * normal);
        vAcidViewPosition = viewPosition.xyz;
        vAcidForm = pfxAcidSpawnForm;
        vAcidPaletteIndex = pfxAcidSpawnPaletteIndex;
        vAcidSeed = pfxAcidSpawnSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vAcidNormal;
      varying vec3 vAcidViewPosition;
      varying float vAcidForm;
      varying float vAcidPaletteIndex;
      varying float vAcidLife;
      varying float vAcidSeed;
      void main() {
        vec3 normal = normalize(vAcidNormal);
        vec3 viewDirection = normalize(-vAcidViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.86, 0.38));
        float toxicBody = 0.64 + max(0.0, dot(normal, keyLight)) * 0.44;
        float corrosiveMeniscus = pow(1.0 - abs(dot(normal, viewDirection)), 2.2);
        float causticSpecular = pow(max(0.0, dot(normal, normalize(keyLight + viewDirection))), 12.0);
        vec3 toxicTeal = vec3(0.02, 0.3, 0.13);
        vec3 acidGreen = vec3(0.2, 0.78, 0.08);
        vec3 chartreuse = vec3(0.68, 1.0, 0.16);
        vec3 hotLime = vec3(0.9, 1.0, 0.5);
        vec3 acidPalette = mix(toxicTeal, acidGreen, step(0.5, vAcidPaletteIndex));
        acidPalette = mix(acidPalette, chartreuse, step(1.5, vAcidPaletteIndex));
        vec3 pigment = acidPalette * toxicBody * (0.92 + vAcidSeed * 0.12);
        pigment += hotLime * corrosiveMeniscus * mix(0.32, 0.56, vAcidForm);
        pigment += vec3(0.96, 1.0, 0.76) * causticSpecular * mix(0.54, 0.84, vAcidForm);
        float coverage = vAcidLife * mix(0.86, 0.94, vAcidForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxAcidSpawnMaterial'] = true
  material.userData['pfxAcidSpawnMaterialProfile'] = 'corrosive-chartreuse-pool-with-rising-crowns'
  material.userData['pfxAcidSpawnFragmentTranscendentalOps'] = 0
  material.userData['pfxAcidSpawnAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
