import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxGhostTrailLifecycle(cycle: number): {
  energy: number
  reach: number
  haunt: number
  dissolve: number
  stage: 'summon' | 'surge' | 'haunt' | 'dissolve' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const summon = smooth(phase / 0.1)
    return { energy: roundMetric(0.44 + summon * 0.42), reach: roundMetric(0.12 + summon * 0.24), haunt: 0, dissolve: 0, stage: 'summon' }
  }
  if (phase < 0.36) {
    const surge = smooth((phase - 0.1) / 0.26)
    return { energy: roundMetric(0.86 + surge * 0.14), reach: roundMetric(0.42 + surge * 0.58), haunt: roundMetric(surge * 0.46), dissolve: 0, stage: 'surge' }
  }
  if (phase < 0.7) {
    const haunt = smooth((phase - 0.36) / 0.34)
    return { energy: roundMetric(1 - haunt * 0.2), reach: 1, haunt: roundMetric(0.72 + haunt * 0.28), dissolve: roundMetric(haunt * 0.3), stage: 'haunt' }
  }
  if (phase < 0.88) {
    const dissolve = smooth((phase - 0.7) / 0.18)
    return { energy: roundMetric(0.7 - dissolve * 0.62), reach: roundMetric(1 - dissolve * 0.28), haunt: roundMetric(1 - dissolve * 0.54), dissolve: roundMetric(0.68 + dissolve * 0.32), stage: 'dissolve' }
  }
  return { energy: 0, reach: 0, haunt: 0, dissolve: 1, stage: 'rest' }
}

export function createPfxGhostTrailGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const veilStrandCount = 7
  const segmentsPerStrand = 3
  const soulMoteCount = 5
  const lead = new THREE.Vector3(0.72, 0.08, 0)
  const appendPrimitive = (primitive: THREE.BufferGeometry, matrix: THREE.Matrix4, form: 0 | 1 | 2, seed: number, paletteIndex: number) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(lead.x, lead.y, lead.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }
  const appendVeil = (start: THREE.Vector3, end: THREE.Vector3, seed: number, paletteIndex: number) => {
    const direction = end.clone().sub(start)
    const veil = new THREE.CylinderGeometry(0.012, 0.062, direction.length(), 3, 1, false)
    const matrix = new THREE.Matrix4().compose(
      start.clone().add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
      new THREE.Vector3(1, 1, 1),
    )
    appendPrimitive(veil, matrix, 1, seed, paletteIndex)
    veil.dispose()
  }

  const mask = new THREE.IcosahedronGeometry(1, 0)
  appendPrimitive(
    mask,
    new THREE.Matrix4().compose(lead, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0.2, -0.08)), new THREE.Vector3(0.3, 0.42, 0.22)),
    0,
    0.5,
    0,
  )
  mask.dispose()

  const jaw = new THREE.OctahedronGeometry(1, 0)
  appendPrimitive(
    jaw,
    new THREE.Matrix4().compose(
      new THREE.Vector3(lead.x - 0.015, lead.y - 0.3, lead.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.18, 0)),
      new THREE.Vector3(0.2, 0.22, 0.17),
    ),
    0,
    0.45,
    0,
  )
  ;[-0.12, 0.12].forEach((z, eyeIndex) => {
    appendPrimitive(
      jaw,
      new THREE.Matrix4().compose(
        new THREE.Vector3(lead.x + 0.23, lead.y + 0.12, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.2, eyeIndex === 0 ? -0.18 : 0.18)),
        new THREE.Vector3(0.055, 0.038, 0.032),
      ),
      2,
      0.35 + eyeIndex * 0.3,
      3,
    )
  })
  jaw.dispose()

  const depthLanes = [-0.56, -0.28, 0, 0.28, 0.56] as const
  const endpoints = [
    new THREE.Vector3(-1.7, -0.52, depthLanes[1]),
    new THREE.Vector3(-1.62, -0.3, depthLanes[4]),
    new THREE.Vector3(-1.76, -0.08, depthLanes[0]),
    new THREE.Vector3(-1.68, 0.1, depthLanes[2]),
    new THREE.Vector3(-1.72, 0.28, depthLanes[3]),
    new THREE.Vector3(-1.58, 0.48, depthLanes[0]),
    new THREE.Vector3(-1.66, 0.62, depthLanes[4]),
  ] as const
  endpoints.forEach((endpoint, strandIndex) => {
    const points = [lead.clone()]
    for (let node = 1; node <= segmentsPerStrand; node += 1) {
      const progress = node / segmentsPerStrand
      const bend = (1 - progress) * 0.12
      points.push(new THREE.Vector3(
        THREE.MathUtils.lerp(lead.x, endpoint.x, progress),
        THREE.MathUtils.lerp(lead.y, endpoint.y, progress) + (strandIndex % 2 === 0 ? bend : -bend),
        THREE.MathUtils.lerp(lead.z, endpoint.z, progress) + ((strandIndex % 3) - 1) * bend,
      ))
    }
    for (let segment = 0; segment < segmentsPerStrand; segment += 1) {
      appendVeil(points[segment]!, points[segment + 1]!, strandIndex / veilStrandCount, strandIndex % 3 === 0 ? 2 : 1)
    }
  })

  const mote = new THREE.OctahedronGeometry(1, 0)
  ;[
    [-0.2, 0.56, -0.38], [-0.56, -0.42, 0.42], [-0.92, 0.36, 0.56], [-1.24, -0.18, -0.52], [-1.5, 0.18, 0.08],
  ].forEach(([x, y, z], moteIndex) => {
    appendPrimitive(
      mote,
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(moteIndex * 0.32, moteIndex * 0.44, -0.18)),
        new THREE.Vector3(0.07 + moteIndex * 0.008, 0.12 + moteIndex * 0.012, 0.07 + moteIndex * 0.006),
      ),
      2,
      moteIndex / soulMoteCount,
      3,
    )
  })
  mote.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxGhostTrailOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxGhostTrailForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxGhostTrailSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxGhostTrailPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-0.45, 0.05, 0), 1.75)
  geometry.userData['pfxGhostTrailDrawCalls'] = 1
  geometry.userData['pfxGhostTrailClosedFaces'] = true
  geometry.userData['pfxGhostTrailBillboardCount'] = 0
  geometry.userData['pfxGhostTrailLeadMaskCount'] = 1
  geometry.userData['pfxGhostTrailJawCount'] = 1
  geometry.userData['pfxGhostTrailSoulEyeCount'] = 2
  geometry.userData['pfxGhostTrailVeilStrandCount'] = veilStrandCount
  geometry.userData['pfxGhostTrailSegmentsPerStrand'] = segmentsPerStrand
  geometry.userData['pfxGhostTrailSoulMoteCount'] = soulMoteCount
  geometry.userData['pfxGhostTrailDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxGhostTrailMotionAxis'] = 'positive-x-with-negative-x-wake'
  geometry.userData['pfxGhostTrailSilhouetteProfile'] = 'faceted-lead-mask-with-seven-tapered-depth-veils-and-five-soul-motes'  // secret-scan: allow (false positive: "mask-with..." slug, not a key)
  geometry.userData['pfxGhostTrailPalette'] = 'abyss-blue-spectral-cyan-cold-lilac-ivory-glint'
  geometry.userData['pfxGhostTrailAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxGhostTrailTriangleCount'] = positions.length / 9
  geometry.userData['pfxGhostTrailLengthSpan'] = 2.56
  geometry.userData['pfxGhostTrailHeightSpan'] = 1.28
  geometry.userData['pfxGhostTrailDepthSpan'] = 1.24
  return geometry
}

export function createPfxGhostTrailMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) }, uCycle: { value: 0 } },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxGhostTrailOrigin;
      attribute float pfxGhostTrailForm;
      attribute float pfxGhostTrailSeed;
      attribute float pfxGhostTrailPaletteIndex;
      varying vec3 vGhostNormal;
      varying vec3 vGhostViewPosition;
      varying float vGhostForm;
      varying float vGhostPaletteIndex;
      varying float vGhostLife;
      varying float vGhostSeed;
      void main() {
        float maskForm = 1.0 - step(0.5, pfxGhostTrailForm);
        float veilForm = step(0.5, pfxGhostTrailForm) * (1.0 - step(1.5, pfxGhostTrailForm));
        float moteForm = step(1.5, pfxGhostTrailForm);
        float spectralSummon = smoothstep(0.004, 0.035, uCycle);
        float processionSurge = smoothstep(0.012 + pfxGhostTrailSeed * 0.004, 0.08, uCycle);
        float veilDissolve = smoothstep(0.68, 0.87, uCycle);
        vec3 local = position - pfxGhostTrailOrigin;
        vec3 maskPosition = pfxGhostTrailOrigin + local * mix(0.65, 1.0, spectralSummon);
        maskPosition.x += processionSurge * 0.08;
        vec3 veilPosition = pfxGhostTrailOrigin + local * vec3(mix(0.05, 1.0, processionSurge), mix(0.28, 1.0, processionSurge), mix(0.28, 1.0, processionSurge));
        veilPosition.y += (pfxGhostTrailSeed - 0.5) * processionSurge * 0.06;
        vec3 motePosition = pfxGhostTrailOrigin + local * mix(0.12, 1.0, processionSurge);
        motePosition.y += processionSurge * pfxGhostTrailSeed * 0.1;
        vec3 transformed = maskPosition * maskForm + veilPosition * veilForm + motePosition * moteForm;
        float maskLife = spectralSummon * (1.0 - smoothstep(0.72, 0.88, uCycle));
        float veilLife = smoothstep(0.008, 0.045, uCycle) * (1.0 - veilDissolve * (0.76 + pfxGhostTrailSeed * 0.24));
        float moteLife = smoothstep(0.025 + pfxGhostTrailSeed * 0.02, 0.12, uCycle) * (1.0 - smoothstep(0.7, 0.88, uCycle));
        vGhostLife = maskLife * maskForm + veilLife * veilForm + moteLife * moteForm;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vGhostNormal = normalize(normalMatrix * normal);
        vGhostViewPosition = viewPosition.xyz;
        vGhostForm = pfxGhostTrailForm;
        vGhostPaletteIndex = pfxGhostTrailPaletteIndex;
        vGhostSeed = pfxGhostTrailSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vGhostNormal;
      varying vec3 vGhostViewPosition;
      varying float vGhostForm;
      varying float vGhostPaletteIndex;
      varying float vGhostLife;
      varying float vGhostSeed;
      void main() {
        vec3 normal = normalize(vGhostNormal);
        vec3 viewDirection = normalize(-vGhostViewPosition);
        vec3 keyLight = normalize(vec3(-0.38, 0.78, 0.48));
        float maskForm = 1.0 - step(0.5, vGhostForm);
        float soulForm = step(1.5, vGhostForm);
        float diffuse = 0.42 + max(0.0, dot(normal, keyLight)) * 0.54;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float ectoplasmRim = rim * rim;
        float soulGlint = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        soulGlint *= soulGlint;
        soulGlint *= soulGlint;
        vec3 abyssBlue = vec3(0.015, 0.045, 0.095);
        vec3 spectralCyan = vec3(0.12, 0.76, 0.92);
        vec3 coldLilac = vec3(0.55, 0.48, 1.0);
        vec3 ivoryGlint = vec3(0.88, 1.0, 1.0);
        vec3 spectralPalette = mix(spectralCyan, coldLilac, step(1.5, vGhostPaletteIndex));
        spectralPalette = mix(spectralPalette, abyssBlue, maskForm * 0.7);
        spectralPalette = mix(spectralPalette, ivoryGlint, soulForm * 0.55);
        vec3 pigment = spectralPalette * diffuse * (0.9 + vGhostSeed * 0.14);
        pigment += coldLilac * ectoplasmRim * mix(0.36, 0.22, soulForm);
        pigment += ivoryGlint * soulGlint * mix(0.28, 0.58, soulForm);
        float coverage = vGhostLife * mix(0.94, 1.0, soulForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxGhostTrailMaterial'] = true
  material.userData['pfxGhostTrailMaterialProfile'] = 'abyssal-faceted-mask-with-cyan-ectoplasm-veils-lilac-edges-and-ivory-soul-glints'  // secret-scan: allow (false positive: "mask-with..." slug, not a key)
  material.userData['pfxGhostTrailFragmentTranscendentalOps'] = 0
  material.userData['pfxGhostTrailAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
