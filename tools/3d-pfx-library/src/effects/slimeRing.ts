import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSlimeRingLifecycle(cycle: number): {
  energy: number
  radius: number
  adhesion: number
  bubble: number
  stage: 'spread' | 'adhere' | 'bubble' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const spread = smooth(phase / 0.1)
    return {
      energy: roundMetric(0.48 + spread * 0.38),
      radius: roundMetric(0.2 + spread * 0.48),
      adhesion: roundMetric(0.12 + spread * 0.48),
      bubble: roundMetric(spread * 0.08),
      stage: 'spread',
    }
  }
  if (phase < 0.4) {
    const adhere = smooth((phase - 0.1) / 0.3)
    return {
      energy: roundMetric(0.86 + adhere * 0.12),
      radius: roundMetric(0.68 + adhere * 0.32),
      adhesion: roundMetric(0.72 + adhere * 0.28),
      bubble: roundMetric(0.08 + adhere * 0.48),
      stage: 'adhere',
    }
  }
  if (phase < 0.74) {
    const bubble = smooth((phase - 0.4) / 0.34)
    return {
      energy: roundMetric(0.98 - bubble * 0.04),
      radius: 1,
      adhesion: 1,
      bubble: roundMetric(0.72 + bubble * 0.28),
      stage: 'bubble',
    }
  }
  return { energy: 0, radius: 0, adhesion: 1, bubble: 0, stage: 'rest' }
}

export function createPfxSlimeRingGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const centers: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const segmentCount = 20
  const bubbleCrownCount = 6
  const ringSections: Array<{
    outerTop: THREE.Vector3
    innerTop: THREE.Vector3
    outerBottom: THREE.Vector3
    innerBottom: THREE.Vector3
  }> = []
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const angle = (segment / segmentCount) * Math.PI * 2
    const outerRadius = 1.08 + (((segment * 7) % 5) - 2) * 0.035 + (segment % 6 === 0 ? 0.08 : 0)
    const innerRadius = 0.62 + (((segment * 11) % 4) - 1.5) * 0.035 + (segment % 5 === 0 ? 0.1 : 0)
    const topY = 0.045 + ((segment * 3) % 4) * 0.018
    const bottomY = -0.085 - (segment % 3) * 0.008
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    ringSections.push({
      outerTop: radial.clone().multiplyScalar(outerRadius).setY(topY),
      innerTop: radial.clone().multiplyScalar(innerRadius).setY(topY + (segment % 2) * 0.012),
      outerBottom: radial.clone().multiplyScalar(outerRadius * 0.98).setY(bottomY),
      innerBottom: radial.clone().multiplyScalar(innerRadius * 1.02).setY(bottomY + 0.012),
    })
  }
  const appendFace = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    center: THREE.Vector3,
    form: 0 | 1,
    seed: number,
    paletteIndex: number,
    smoothCenter?: THREE.Vector3,
  ) => {
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()
    for (const point of [a, b, c]) {
      positions.push(point.x, point.y, point.z)
      const vertexNormal = smoothCenter ? point.clone().sub(smoothCenter).normalize() : normal
      normals.push(vertexNormal.x, vertexNormal.y, vertexNormal.z)
      centers.push(center.x, center.y, center.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
  }
  const origin = new THREE.Vector3()
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const current = ringSections[segment]!
    const next = ringSections[(segment + 1) % segmentCount]!
    const seed = segment / segmentCount
    const paletteIndex = segment % 5 === 0 ? 2 : 1
    appendFace(current.outerTop, current.innerTop, next.innerTop, origin, 0, seed, paletteIndex)
    appendFace(current.outerTop, next.innerTop, next.outerTop, origin, 0, seed, paletteIndex)
    appendFace(current.outerBottom, next.innerBottom, current.innerBottom, origin, 0, seed, paletteIndex)
    appendFace(current.outerBottom, next.outerBottom, next.innerBottom, origin, 0, seed, paletteIndex)
    appendFace(current.outerTop, next.outerTop, next.outerBottom, origin, 0, seed, paletteIndex)
    appendFace(current.outerTop, next.outerBottom, current.outerBottom, origin, 0, seed, paletteIndex)
    appendFace(current.innerTop, next.innerBottom, next.innerTop, origin, 0, seed, paletteIndex)
    appendFace(current.innerTop, current.innerBottom, next.innerBottom, origin, 0, seed, paletteIndex)
  }

  const bubbleSegments = [1, 4, 7, 11, 14, 18] as const
  const bubbleVertices = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ] as const
  const bubbleFaces: ReadonlyArray<readonly [number, number, number]> = [
    [2, 0, 4], [2, 4, 1], [2, 1, 5], [2, 5, 0],
    [3, 4, 0], [3, 1, 4], [3, 5, 1], [3, 0, 5],
  ]
  bubbleSegments.forEach((segment, bubbleIndex) => {
    const angle = (segment / segmentCount) * Math.PI * 2
    const radius = 0.81 + (bubbleIndex % 2) * 0.09
    const size = 0.105 + (bubbleIndex % 3) * 0.035
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.08 + size * 0.32, Math.sin(angle) * radius)
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      0.18 + bubbleIndex * 0.11,
      bubbleIndex * 0.37,
      -0.14 + bubbleIndex * 0.08,
    ))
    const localVertices = bubbleVertices.map((vertex) => vertex.clone()
      .multiply(new THREE.Vector3(size * 1.34, size * 0.72, size * 1.24))
      .applyQuaternion(rotation)
      .add(center))
    for (const [a, b, c] of bubbleFaces) {
      appendFace(
        localVertices[a]!,
        localVertices[b]!,
        localVertices[c]!,
        center,
        1,
        0.12 + bubbleIndex * 0.15,
        2,
        center,
      )
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxSlimeRingCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxSlimeRingForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxSlimeRingSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSlimeRingPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.08, 0), 1.3)
  geometry.userData['pfxSlimeRingDrawCalls'] = 1
  geometry.userData['pfxSlimeRingClosedFaces'] = true
  geometry.userData['pfxSlimeRingBillboardCount'] = 0
  geometry.userData['pfxSlimeRingSegmentCount'] = segmentCount
  geometry.userData['pfxSlimeRingBubbleCrownCount'] = bubbleCrownCount
  geometry.userData['pfxSlimeRingWorldPlane'] = 'xz-grounded'
  geometry.userData['pfxSlimeRingIrregularInnerBites'] = true
  geometry.userData['pfxSlimeRingSilhouetteProfile'] = 'broken-viscous-annulus-with-bubble-crowns'
  geometry.userData['pfxSlimeRingPalette'] = 'lime-chartreuse-deep-teal'
  geometry.userData['pfxSlimeRingAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxSlimeRingTriangleCount'] = positions.length / 9
  geometry.userData['pfxSlimeRingRadialThickness'] = 0.46
  geometry.userData['pfxSlimeRingWidthSpan'] = 2.28
  geometry.userData['pfxSlimeRingDepthSpan'] = 2.2
  geometry.userData['pfxSlimeRingHeightSpan'] = 0.42
  return geometry
}

export function createPfxSlimeRingMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxSlimeRingCenter;
      attribute float pfxSlimeRingForm;
      attribute float pfxSlimeRingSeed;
      attribute float pfxSlimeRingPaletteIndex;
      varying vec3 vSlimeNormal;
      varying vec3 vSlimeViewPosition;
      varying float vSlimeForm;
      varying float vSlimePaletteIndex;
      varying float vSlimeLife;
      varying float vSlimeSeed;
      void main() {
        float isBubble = step(0.5, pfxSlimeRingForm);
        float viscousSpread = mix(0.22, 1.0, smoothstep(0.01, 0.34, uCycle));
        float stickyAdhesion = smoothstep(0.08, 0.42, uCycle);
        float bubbleCrown = smoothstep(0.22 + pfxSlimeRingSeed * 0.08, 0.56, uCycle);
        vec3 bodyPosition = position;
        bodyPosition.xz *= viscousSpread;
        bodyPosition.y *= mix(1.42, 0.86, stickyAdhesion);
        vec3 bubbleLocal = position - pfxSlimeRingCenter;
        float bubbleBreath = 0.72 + bubbleCrown * (0.3 + sin(uCycle * 9.424778 + pfxSlimeRingSeed * 6.2831853) * 0.04);
        vec3 bubbleCenter = pfxSlimeRingCenter;
        bubbleCenter.xz *= viscousSpread;
        bubbleCenter.y = mix(0.035, pfxSlimeRingCenter.y, bubbleCrown);
        vec3 bubblePosition = bubbleCenter + bubbleLocal * vec3(bubbleBreath, mix(0.24, bubbleBreath, bubbleCrown), bubbleBreath);
        vec3 transformed = mix(bodyPosition, bubblePosition, isBubble);
        float birth = smoothstep(0.005 + pfxSlimeRingSeed * 0.012, 0.065 + pfxSlimeRingSeed * 0.02, uCycle);
        float retire = 1.0 - smoothstep(0.63, 0.74, uCycle);
        vSlimeLife = birth * retire;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSlimeNormal = normalize(normalMatrix * normal);
        vSlimeViewPosition = viewPosition.xyz;
        vSlimeForm = pfxSlimeRingForm;
        vSlimePaletteIndex = pfxSlimeRingPaletteIndex;
        vSlimeSeed = pfxSlimeRingSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vSlimeNormal;
      varying vec3 vSlimeViewPosition;
      varying float vSlimeForm;
      varying float vSlimePaletteIndex;
      varying float vSlimeLife;
      varying float vSlimeSeed;
      void main() {
        vec3 normal = normalize(vSlimeNormal);
        vec3 viewDirection = normalize(-vSlimeViewPosition);
        vec3 keyLight = normalize(vec3(-0.36, 0.84, 0.4));
        float stickyBody = 0.6 + max(0.0, dot(normal, keyLight)) * 0.46;
        float wetMeniscus = pow(1.0 - abs(dot(normal, viewDirection)), 2.4);
        float wetSpecular = pow(max(0.0, dot(normal, normalize(keyLight + viewDirection))), 14.0);
        vec3 deepTeal = vec3(0.025, 0.16, 0.09);
        vec3 slimeGreen = vec3(0.14, 0.58, 0.08);
        vec3 chartreuse = vec3(0.42, 0.82, 0.12);
        vec3 limeHighlight = vec3(0.82, 1.0, 0.5);
        vec3 slimePalette = mix(deepTeal, slimeGreen, step(0.5, vSlimePaletteIndex));
        slimePalette = mix(slimePalette, chartreuse, step(1.5, vSlimePaletteIndex));
        vec3 pigment = slimePalette * stickyBody * (0.92 + vSlimeSeed * 0.1);
        pigment += limeHighlight * wetMeniscus * mix(0.38, 0.56, vSlimeForm);
        pigment += vec3(0.94, 1.0, 0.72) * wetSpecular * mix(0.58, 0.82, vSlimeForm);
        pigment = mix(pigment, mix(slimeGreen, chartreuse, 0.46) * stickyBody, vSlimeForm * 0.2);
        float coverage = vSlimeLife * mix(0.86, 0.92, vSlimeForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxSlimeRingMaterial'] = true
  material.userData['pfxSlimeRingMaterialProfile'] = 'wet-lime-annulus-with-integrated-bubbles'
  material.userData['pfxSlimeRingFragmentTranscendentalOps'] = 0
  material.userData['pfxSlimeRingAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
