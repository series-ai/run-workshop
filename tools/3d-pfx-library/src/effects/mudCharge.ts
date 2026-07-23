import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxMudChargeLifecycle(cycle: number): {
  energy: number
  radius: number
  compression: number
  stage: 'gather' | 'spiral' | 'compress' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const gather = smooth(phase / 0.1)
    return {
      energy: roundMetric(0.42 + gather * 0.43),
      radius: roundMetric(1 - gather * 0.16),
      compression: 0,
      stage: 'gather',
    }
  }
  if (phase < 0.4) {
    const spiral = smooth((phase - 0.1) / 0.3)
    return {
      energy: roundMetric(0.85 + spiral * 0.13),
      radius: roundMetric(0.84 - spiral * 0.56),
      compression: roundMetric(spiral * 0.3),
      stage: 'spiral',
    }
  }
  if (phase < 0.72) {
    const compress = smooth((phase - 0.4) / 0.38)
    return {
      energy: roundMetric(0.98 - compress * 0.04),
      radius: roundMetric(0.28 - compress * 0.2),
      compression: roundMetric(0.74 + compress * 0.26),
      stage: 'compress',
    }
  }
  return { energy: 0, radius: 0, compression: 1, stage: 'rest' }
}

export function createPfxMudChargeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const anchors: number[] = []
  const targets: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const paletteIndices: number[] = []
  const clodCount = 14
  const coreLobeCount = 3
  const groundHeaveCount = 3
  const depthLanes = [-0.9, -0.45, 0, 0.45, 0.9] as const
  const elements: Array<{
    anchor: THREE.Vector3
    target: THREE.Vector3
    scale: THREE.Vector3
    seed: number
    form: 0 | 1 | 2
    paletteIndex: number
  }> = []
  const coreTargets = [
    new THREE.Vector3(-0.22, 0.5, 0.02),
    new THREE.Vector3(0.16, 0.62, 0.17),
    new THREE.Vector3(0.15, 0.4, -0.2),
  ] as const

  for (let clod = 0; clod < clodCount; clod += 1) {
    const seed = ((clod * 19) % 31) / 31
    const angle = (clod / clodCount) * Math.PI * 2 + (clod % 3) * 0.22
    const radius = 1.22 + (clod % 4) * 0.12
    const size = 0.095 + (clod % 5) * 0.02
    elements.push({
      anchor: new THREE.Vector3(
        Math.cos(angle) * radius,
        0.26 + (clod % 5) * 0.4,
        Math.sin(angle) * radius + depthLanes[clod % depthLanes.length] * 0.18,
      ),
      target: coreTargets[clod % coreTargets.length]!.clone().multiplyScalar(0.78 + (clod % 2) * 0.18),
      scale: new THREE.Vector3(size * (1.12 + seed * 0.3), size * (0.82 + (clod % 3) * 0.12), size),
      seed,
      form: 0,
      paletteIndex: clod % 4,
    })
  }
  coreTargets.forEach((target, index) => {
    elements.push({
      anchor: target.clone(),
      target: target.clone(),
      scale: new THREE.Vector3(0.58 - index * 0.045, 0.47 + index * 0.03, 0.52 - index * 0.03),
      seed: 0.18 + index * 0.29,
      form: 1,
      paletteIndex: index,
    })
  })
  const heaveLayout: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.62, 0.02, -0.48, 0.24],
    [0.02, 0.01, 0.38, 0.29],
    [0.66, 0.03, -0.2, 0.23],
  ]
  heaveLayout.forEach(([x, y, z, size], index) => {
    const anchor = new THREE.Vector3(x, y, z)
    elements.push({
      anchor,
      target: anchor.clone().multiplyScalar(0.72),
      scale: new THREE.Vector3(size * 1.18, size * 0.72, size),
      seed: 0.24 + index * 0.27,
      form: 2,
      paletteIndex: index % 2 === 0 ? 2 : 1,
    })
  })

  const clodVertices = [
    new THREE.Vector3(1.06, 0, 0), new THREE.Vector3(-0.88, 0, 0),
    new THREE.Vector3(0, 1.08, 0), new THREE.Vector3(0, -0.78, 0),
    new THREE.Vector3(0, 0, 0.94), new THREE.Vector3(0, 0, -1.04),
  ] as const
  const clodFaces: ReadonlyArray<readonly [number, number, number]> = [
    [2, 0, 4], [2, 4, 1], [2, 1, 5], [2, 5, 0],
    [3, 4, 0], [3, 1, 4], [3, 5, 1], [3, 0, 5],
  ]
  const heaveVertices = [
    new THREE.Vector3(-1, -0.08, -0.38), new THREE.Vector3(-1, -0.08, 0.38),
    new THREE.Vector3(-1, 0.02, 0.31), new THREE.Vector3(-1, 0.02, -0.31),
    new THREE.Vector3(-0.04, -0.1, -0.58), new THREE.Vector3(-0.04, -0.1, 0.58),
    new THREE.Vector3(-0.04, 0.42, 0.45), new THREE.Vector3(-0.04, 0.42, -0.45),
    new THREE.Vector3(1.18, -0.06, -0.08), new THREE.Vector3(1.18, -0.06, 0.08),
    new THREE.Vector3(1.18, 0.02, 0.06), new THREE.Vector3(1.18, 0.02, -0.06),
  ] as const
  const heaveFaces: Array<readonly [number, number, number]> = [
    [0, 1, 2], [0, 2, 3], [8, 10, 9], [8, 11, 10],
  ]
  for (const [left, right] of [[0, 4], [4, 8]] as const) {
    heaveFaces.push(
      [left, right, right + 1], [left, right + 1, left + 1],
      [left + 1, right + 1, right + 2], [left + 1, right + 2, left + 2],
      [left + 2, right + 2, right + 3], [left + 2, right + 3, left + 3],
      [left + 3, right + 3, right], [left + 3, right, left],
    )
  }
  for (const [elementIndex, element] of elements.entries()) {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      -0.38 + element.seed * 0.76,
      -0.62 + element.seed * 1.24,
      element.form === 2 ? -0.16 + (elementIndex % 3) * 0.14 : element.seed * 1.9,
      'YXZ',
    ))
    const sourceVertices = element.form === 2 ? heaveVertices : clodVertices
    const sourceFaces = element.form === 2 ? heaveFaces : clodFaces
    const localVertices = sourceVertices.map((vertex) => vertex.clone().multiply(element.scale).applyQuaternion(rotation))
    for (const [a, b, c] of sourceFaces) {
      const faceNormal = new THREE.Vector3()
        .subVectors(localVertices[b]!, localVertices[a]!)
        .cross(new THREE.Vector3().subVectors(localVertices[c]!, localVertices[a]!))
        .normalize()
      for (const vertexIndex of [a, b, c]) {
        const point = localVertices[vertexIndex]!
        positions.push(point.x, point.y, point.z)
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z)
        anchors.push(element.anchor.x, element.anchor.y, element.anchor.z)
        targets.push(element.target.x, element.target.y, element.target.z)
        seeds.push(element.seed)
        forms.push(element.form)
        paletteIndices.push(element.paletteIndex)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxMudChargeAnchor', new THREE.Float32BufferAttribute(anchors, 3))
  geometry.setAttribute('pfxMudChargeTarget', new THREE.Float32BufferAttribute(targets, 3))
  geometry.setAttribute('pfxMudChargeSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxMudChargeForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxMudChargePaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.72, 0), 2.5)
  geometry.userData['pfxMudChargeDrawCalls'] = 1
  geometry.userData['pfxMudChargeClosedFaces'] = true
  geometry.userData['pfxMudChargeBillboardCount'] = 0
  geometry.userData['pfxMudChargeClodCount'] = clodCount
  geometry.userData['pfxMudChargeCoreLobeCount'] = coreLobeCount
  geometry.userData['pfxMudChargeGroundHeaveCount'] = groundHeaveCount
  geometry.userData['pfxMudChargeDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxMudChargeGroundedOrigin'] = true
  geometry.userData['pfxMudChargeSilhouetteProfile'] = 'helical-clods-into-compressed-trefoil-core'
  geometry.userData['pfxMudChargePalette'] = 'wet-umber-clay-sunlit-earth'
  geometry.userData['pfxMudChargeAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxMudChargeTriangleCount'] = positions.length / 9
  geometry.userData['pfxMudChargeGatherWidthSpan'] = 2.92
  geometry.userData['pfxMudChargeGatherHeightSpan'] = 1.86
  geometry.userData['pfxMudChargeGatherDepthSpan'] = 2.78
  return geometry
}

export function createPfxMudChargeMaterial(
  opacity: number,
  burst = false,
  darkColor = '#52220d',
  wetColor = '#9e471a',
  brightColor = '#c76321',
  highlightColor = '#e69940',
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uBurst: { value: burst ? 1 : 0 },
      uDeepUmber: { value: new THREE.Color(darkColor) },
      uWetClay: { value: new THREE.Color(wetColor) },
      uRedEarth: { value: new THREE.Color(brightColor) },
      uSunlitEarth: { value: new THREE.Color(highlightColor) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uBurst;
      attribute vec3 pfxMudChargeAnchor;
      attribute vec3 pfxMudChargeTarget;
      attribute float pfxMudChargeSeed;
      attribute float pfxMudChargeForm;
      attribute float pfxMudChargePaletteIndex;
      varying vec3 vMudNormal;
      varying vec3 vMudViewPosition;
      varying float vMudForm;
      varying float vMudPaletteIndex;
      varying float vMudLife;
      varying float vMudSeed;
      vec3 rotateMudAroundY(vec3 value, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return vec3(value.x * cosine + value.z * sine, value.y, -value.x * sine + value.z * cosine);
      }
      void main() {
        float isCore = step(0.5, pfxMudChargeForm) * (1.0 - step(1.5, pfxMudChargeForm));
        float isGround = step(1.5, pfxMudChargeForm);
        float isClod = 1.0 - max(isCore, isGround);
        float convergenceProgress = smoothstep(0.025 + pfxMudChargeSeed * 0.018, 0.5, uCycle);
        float helicalConvergence = mix(convergenceProgress, 1.0 - convergenceProgress, uBurst);
        float compressionPulse = smoothstep(0.34, 0.58, uCycle);
        float groundHeave = smoothstep(0.015, 0.2, uCycle) * (1.0 - smoothstep(0.64, 0.78, uCycle));
        float helixAngle = pfxMudChargeSeed * 6.2831853 + helicalConvergence * 5.4;
        float orbitRadius = (1.0 - helicalConvergence) * (0.18 + pfxMudChargeSeed * 0.18);
        vec3 helixOffset = vec3(cos(helixAngle) * orbitRadius, (1.0 - helicalConvergence) * 0.08, sin(helixAngle) * orbitRadius);
        vec3 clodCenter = mix(pfxMudChargeAnchor, pfxMudChargeTarget, helicalConvergence) + helixOffset;
        float coreScale = mix(0.42, 1.04, smoothstep(0.04, 0.52, uCycle)) * (1.0 + compressionPulse * 0.08);
        vec3 clodLocal = rotateMudAroundY(position, helixAngle * (0.35 + pfxMudChargeSeed * 0.35));
        vec3 coreLocal = position * vec3(1.0 + compressionPulse * 0.08, 1.0 - compressionPulse * 0.12, 1.0 + compressionPulse * 0.08) * coreScale;
        vec3 groundLocal = position * vec3(0.56 + groundHeave * 0.58, 0.18 + groundHeave * 0.82, 0.56 + groundHeave * 0.48);
        vec3 transformed = (clodLocal + clodCenter) * isClod;
        transformed += (coreLocal + pfxMudChargeTarget) * isCore;
        transformed += (groundLocal + mix(pfxMudChargeAnchor, pfxMudChargeTarget, helicalConvergence * 0.35)) * isGround;
        float birth = smoothstep(0.006 + pfxMudChargeSeed * 0.02, 0.075 + pfxMudChargeSeed * 0.025, uCycle);
        float retire = 1.0 - smoothstep(0.67, 0.78, uCycle);
        vMudLife = birth * retire;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vMudNormal = normalize(normalMatrix * rotateMudAroundY(normal, helixAngle * isClod * 0.24));
        vMudViewPosition = viewPosition.xyz;
        vMudForm = pfxMudChargeForm;
        vMudPaletteIndex = pfxMudChargePaletteIndex;
        vMudSeed = pfxMudChargeSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uDeepUmber;
      uniform vec3 uWetClay;
      uniform vec3 uRedEarth;
      uniform vec3 uSunlitEarth;
      varying vec3 vMudNormal;
      varying vec3 vMudViewPosition;
      varying float vMudForm;
      varying float vMudPaletteIndex;
      varying float vMudLife;
      varying float vMudSeed;
      void main() {
        vec3 normal = normalize(vMudNormal);
        vec3 viewDirection = normalize(-vMudViewPosition);
        vec3 keyLight = normalize(vec3(-0.38, 0.82, 0.42));
        float earthFacet = 0.55 + max(0.0, dot(normal, keyLight)) * 0.52;
        float wetFacet = pow(max(0.0, dot(normal, normalize(keyLight + viewDirection))), 10.0);
        vec3 deepUmber = uDeepUmber;
        vec3 wetClay = uWetClay;
        vec3 redEarth = uRedEarth;
        vec3 sunlitEarth = uSunlitEarth;
        vec3 clayPalette = mix(deepUmber, wetClay, step(0.5, vMudPaletteIndex));
        clayPalette = mix(clayPalette, redEarth, step(1.5, vMudPaletteIndex));
        clayPalette = mix(clayPalette, sunlitEarth, step(2.5, vMudPaletteIndex));
        float coreMask = step(0.5, vMudForm) * (1.0 - step(1.5, vMudForm));
        float groundMask = step(1.5, vMudForm);
        vec3 packedEarth = mix(wetClay, deepUmber, 0.46 + vMudSeed * 0.08);
        vec3 pigment = clayPalette * earthFacet;
        pigment = mix(pigment, packedEarth * (0.9 + earthFacet * 0.18), coreMask);
        pigment = mix(pigment, mix(deepUmber, redEarth, 0.42) * earthFacet, groundMask * 0.78);
        pigment *= 0.9 + vMudSeed * 0.16;
        pigment += vec3(1.0, 0.74, 0.42) * wetFacet * mix(0.32, 0.82, coreMask);
        float coverage = vMudLife * mix(0.98, 0.9, groundMask);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxMudChargeMaterial'] = true
  material.userData['pfxMudChargeMaterialProfile'] = 'wet-faceted-clods-with-packed-earth-core'
  material.userData['pfxMudChargeBurstMode'] = burst
  material.userData['pfxMudChargeFragmentTranscendentalOps'] = 0
  material.userData['pfxMudChargeAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
