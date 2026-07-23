import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxCurseConeLifecycle(cycle: number): {
  energy: number
  reach: number
  grip: number
  erosion: number
  stage: 'seed' | 'propagate' | 'grip' | 'erode' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const seed = smooth(phase / 0.1)
    return { energy: roundMetric(0.48 + seed * 0.36), reach: roundMetric(0.12 + seed * 0.24), grip: 0, erosion: 0, stage: 'seed' }
  }
  if (phase < 0.36) {
    const propagate = smooth((phase - 0.1) / 0.26)
    return { energy: roundMetric(0.84 + propagate * 0.16), reach: roundMetric(0.42 + propagate * 0.58), grip: roundMetric(propagate * 0.48), erosion: 0, stage: 'propagate' }
  }
  if (phase < 0.68) {
    const grip = smooth((phase - 0.36) / 0.32)
    return { energy: roundMetric(1 - grip * 0.12), reach: 1, grip: roundMetric(0.74 + grip * 0.26), erosion: roundMetric(grip * 0.26), stage: 'grip' }
  }
  if (phase < 0.86) {
    const erosion = smooth((phase - 0.68) / 0.18)
    return { energy: roundMetric(0.72 - erosion * 0.58), reach: roundMetric(1 - erosion * 0.22), grip: roundMetric(1 - erosion * 0.64), erosion: roundMetric(0.66 + erosion * 0.34), stage: 'erode' }
  }
  return { energy: 0, reach: 0, grip: 0, erosion: 1, stage: 'rest' }
}

export function createPfxCurseConeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const pathCount = 7
  const segmentsPerPath = 3
  const endpointBarbCount = 4
  const source = new THREE.Vector3(-0.82, 0, 0)
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    form: 0 | 1 | 2,
    seed: number,
    paletteIndex: number,
  ) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(source.x, source.y, source.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }
  const appendThorn = (start: THREE.Vector3, end: THREE.Vector3, form: 1 | 2, seed: number, paletteIndex: number) => {
    const direction = end.clone().sub(start)
    const primitive = new THREE.CylinderGeometry(form === 2 ? 0.012 : 0.026, form === 2 ? 0.068 : 0.105, direction.length(), 3, 1, false)
    const matrix = new THREE.Matrix4().compose(
      start.clone().add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
      new THREE.Vector3(1, 1, 1),
    )
    appendPrimitive(primitive, matrix, form, seed, paletteIndex)
    primitive.dispose()
  }

  const depthLanes = [-0.66, -0.33, 0, 0.33, 0.66] as const
  const endpoints = [
    new THREE.Vector3(1, -0.68, depthLanes[1]),
    new THREE.Vector3(1.02, -0.44, depthLanes[4]),
    new THREE.Vector3(0.98, -0.18, depthLanes[0]),
    new THREE.Vector3(1.06, 0.04, depthLanes[2]),
    new THREE.Vector3(1, 0.29, depthLanes[3]),
    new THREE.Vector3(0.96, 0.51, depthLanes[0]),
    new THREE.Vector3(1.02, 0.7, depthLanes[4]),
  ] as const
  endpoints.forEach((endpoint, pathIndex) => {
    const points = [source.clone()]
    for (let node = 1; node <= segmentsPerPath; node += 1) {
      const progress = node / segmentsPerPath
      const twist = Math.sin(progress * Math.PI * 2 + pathIndex * 1.37) * (0.1 - progress * 0.025)
      points.push(new THREE.Vector3(
        THREE.MathUtils.lerp(source.x, endpoint.x, progress),
        endpoint.y * progress + twist,
        endpoint.z * progress + Math.cos(progress * Math.PI * 1.5 + pathIndex) * (0.08 - progress * 0.02),
      ))
    }
    for (let segment = 0; segment < segmentsPerPath; segment += 1) {
      appendThorn(points[segment]!, points[segment + 1]!, 1, pathIndex / pathCount, pathIndex % 3 === 0 ? 2 : 1)
    }
  })

  ;[0, 2, 4, 6].forEach((pathIndex, barbIndex) => {
    const endpoint = endpoints[pathIndex]!
    const hook = endpoint.clone().add(new THREE.Vector3(
      -0.2,
      pathIndex < 3 ? -0.16 : 0.16,
      (barbIndex % 2 === 0 ? 1 : -1) * 0.13,
    ))
    appendThorn(endpoint, hook, 2, 0.18 + barbIndex * 0.22, 2)
  })

  const knot = new THREE.OctahedronGeometry(1, 0)
  appendPrimitive(
    knot,
    new THREE.Matrix4().compose(
      source,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0.4, -0.18)),
      new THREE.Vector3(0.24, 0.29, 0.27),
    ),
    0,
    0.5,
    0,
  )
  knot.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxCurseConeOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxCurseConeForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxCurseConeSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxCurseConePaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.1, 0, 0), 1.35)
  geometry.userData['pfxCurseConeDrawCalls'] = 1
  geometry.userData['pfxCurseConeClosedFaces'] = true
  geometry.userData['pfxCurseConeBillboardCount'] = 0
  geometry.userData['pfxCurseConePathCount'] = pathCount
  geometry.userData['pfxCurseConeSegmentsPerPath'] = segmentsPerPath
  geometry.userData['pfxCurseConeEndpointBarbCount'] = endpointBarbCount
  geometry.userData['pfxCurseConeSourceKnotCount'] = 1
  geometry.userData['pfxCurseConeDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxCurseConeThornBaseRadius'] = 0.105
  geometry.userData['pfxCurseConeThornTipRadius'] = 0.026
  geometry.userData['pfxCurseConeSourceKnotSpan'] = 0.58
  geometry.userData['pfxCurseConeAttackAxis'] = 'positive-x'
  geometry.userData['pfxCurseConeSilhouetteProfile'] = 'source-knot-to-broad-twisted-seven-thorn-fan'
  geometry.userData['pfxCurseConePalette'] = 'void-violet-curse-magenta-cold-lilac'
  geometry.userData['pfxCurseConeAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxCurseConeTriangleCount'] = positions.length / 9
  geometry.userData['pfxCurseConeWidthSpan'] = 2.08
  geometry.userData['pfxCurseConeHeightSpan'] = 1.54
  geometry.userData['pfxCurseConeDepthSpan'] = 1.5
  return geometry
}

export function createPfxCurseConeMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxCurseConeOrigin;
      attribute float pfxCurseConeForm;
      attribute float pfxCurseConeSeed;
      attribute float pfxCurseConePaletteIndex;
      varying vec3 vCurseNormal;
      varying vec3 vCurseViewPosition;
      varying float vCurseForm;
      varying float vCursePaletteIndex;
      varying float vCurseLife;
      varying float vCurseSeed;
      void main() {
        float knotMask = 1.0 - step(0.5, pfxCurseConeForm);
        float thornMask = step(0.5, pfxCurseConeForm) * (1.0 - step(1.5, pfxCurseConeForm));
        float barbMask = step(1.5, pfxCurseConeForm);
        float cursePropagation = smoothstep(0.02 + pfxCurseConeSeed * 0.025, 0.34, uCycle);
        float thornGrip = smoothstep(0.26, 0.54, uCycle);
        float curseErosion = smoothstep(0.62, 0.84, uCycle);
        vec3 local = position - pfxCurseConeOrigin;
        float twistAngle = (pfxCurseConeSeed - 0.5) * cursePropagation * 0.64;
        float twistSine = sin(twistAngle);
        float twistCosine = cos(twistAngle);
        local.yz = mat2(twistCosine, -twistSine, twistSine, twistCosine) * local.yz;
        vec3 thornPosition = pfxCurseConeOrigin + local * vec3(mix(0.06, 1.0, cursePropagation), mix(0.28, 1.0, cursePropagation), mix(0.28, 1.0, cursePropagation));
        thornPosition.x += thornGrip * pfxCurseConeSeed * 0.035;
        vec3 barbPosition = pfxCurseConeOrigin + local * vec3(mix(0.04, 1.0, smoothstep(0.18, 0.5, uCycle)), mix(0.2, 1.0, thornGrip), mix(0.2, 1.0, thornGrip));
        vec3 knotPosition = pfxCurseConeOrigin + local * mix(0.28, 1.0, smoothstep(0.01, 0.12, uCycle));
        vec3 transformed = knotPosition * knotMask + thornPosition * thornMask + barbPosition * barbMask;
        float birth = smoothstep(0.004 + pfxCurseConeSeed * 0.012, 0.06 + pfxCurseConeSeed * 0.02, uCycle);
        float retire = 1.0 - smoothstep(0.72, 0.86, uCycle);
        vCurseLife = birth * retire * (1.0 - curseErosion * pfxCurseConeSeed * 0.22);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vCurseNormal = normalize(normalMatrix * normal);
        vCurseViewPosition = viewPosition.xyz;
        vCurseForm = pfxCurseConeForm;
        vCursePaletteIndex = pfxCurseConePaletteIndex;
        vCurseSeed = pfxCurseConeSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vCurseNormal;
      varying vec3 vCurseViewPosition;
      varying float vCurseForm;
      varying float vCursePaletteIndex;
      varying float vCurseLife;
      varying float vCurseSeed;
      void main() {
        vec3 normal = normalize(vCurseNormal);
        vec3 viewDirection = normalize(-vCurseViewPosition);
        vec3 keyLight = normalize(vec3(-0.3, 0.82, 0.48));
        float voidBody = 0.46 + max(0.0, dot(normal, keyLight)) * 0.5;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float lilacEdge = rim * rim;
        float specular = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        specular *= specular;
        specular *= specular;
        float knotMask = 1.0 - step(0.5, vCurseForm);
        float barbMask = step(1.5, vCurseForm);
        vec3 voidViolet = vec3(0.075, 0.025, 0.16);
        vec3 cursePurple = vec3(0.42, 0.12, 0.72);
        vec3 curseMagenta = vec3(0.78, 0.18, 0.82);
        vec3 coldLilac = vec3(0.74, 0.58, 1.0);
        vec3 cursePalette = mix(cursePurple, curseMagenta, step(1.5, vCursePaletteIndex));
        cursePalette = mix(cursePalette, voidViolet, knotMask);
        vec3 pigment = cursePalette * voidBody * (0.9 + vCurseSeed * 0.16);
        pigment += coldLilac * lilacEdge * mix(0.3, 0.5, barbMask);
        pigment += curseMagenta * specular * mix(0.3, 0.52, barbMask);
        float coverage = vCurseLife * mix(0.98, 0.9, barbMask);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxCurseConeMaterial'] = true
  material.userData['pfxCurseConeMaterialProfile'] = 'void-violet-thorn-fan-with-magenta-grip-and-lilac-edges'
  material.userData['pfxCurseConeFragmentTranscendentalOps'] = 0
  material.userData['pfxCurseConeAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
