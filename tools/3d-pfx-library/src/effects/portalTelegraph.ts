import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxPortalTelegraphLifecycle(cycle: number): {
  energy: number
  urgency: number
  aperture: number
  arrival: number
  stage: 'mark' | 'countdown' | 'breach' | 'arrival' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const mark = smooth(phase / 0.12)
    return { energy: roundMetric(0.4 + mark * 0.42), urgency: roundMetric(0.08 + mark * 0.18), aperture: roundMetric(mark * 0.16), arrival: 0, stage: 'mark' }
  }
  if (phase < 0.44) {
    const countdown = smooth((phase - 0.12) / 0.32)
    return { energy: roundMetric(0.82 + countdown * 0.18), urgency: roundMetric(0.34 + countdown * 0.66), aperture: roundMetric(0.2 + countdown * 0.4), arrival: 0, stage: 'countdown' }
  }
  if (phase < 0.72) {
    const breach = smooth((phase - 0.44) / 0.28)
    return { energy: 1, urgency: 1, aperture: roundMetric(0.68 + breach * 0.32), arrival: roundMetric(breach * 0.52), stage: 'breach' }
  }
  if (phase < 0.9) {
    const arrival = smooth((phase - 0.72) / 0.18)
    return { energy: roundMetric(0.94 - arrival * 0.76), urgency: roundMetric(1 - arrival * 0.58), aperture: 1, arrival: roundMetric(0.72 + arrival * 0.28), stage: 'arrival' }
  }
  return { energy: 0, urgency: 0, aperture: 0, arrival: 0, stage: 'rest' }
}

export function createPfxPortalTelegraphGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const appendPrimitive = (primitive: THREE.BufferGeometry, matrix: THREE.Matrix4, form: 0 | 1 | 2 | 3, seed: number, paletteIndex: number) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(0, 0, 0)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const boundary = new THREE.TorusGeometry(0.96, 0.06, 4, 16)
  appendPrimitive(boundary, new THREE.Matrix4().makeRotationX(Math.PI * 0.5), 0, 0.5, 1)
  boundary.dispose()

  const throat = new THREE.CylinderGeometry(0.64, 0.72, 0.07, 12, 1, false)
  appendPrimitive(throat, new THREE.Matrix4().makeTranslation(0, -0.055, 0), 1, 0.5, 0)
  throat.dispose()

  const wedge = new THREE.TetrahedronGeometry(1, 0)
  for (let wedgeIndex = 0; wedgeIndex < 8; wedgeIndex += 1) {
    const angle = (wedgeIndex / 8) * Math.PI * 2
    const radius = 0.7
    appendPrimitive(
      wedge,
      new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(angle) * radius, 0.055, Math.sin(angle) * radius),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle + Math.PI * 0.5, 0)),
        new THREE.Vector3(0.12, 0.07, 0.22),
      ),
      2,
      wedgeIndex / 8,
      wedgeIndex % 2 === 0 ? 2 : 1,
    )
  }
  wedge.dispose()

  const pylon = new THREE.CylinderGeometry(0.025, 0.075, 0.52, 3, 1, false)
  for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
    const angle = (pylonIndex / 4) * Math.PI * 2
    appendPrimitive(
      pylon,
      new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(angle) * 1.02, 0.24, Math.sin(angle) * 1.02),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, pylonIndex % 2 === 0 ? 0.1 : -0.1)),
        new THREE.Vector3(1, 1, 1),
      ),
      3,
      pylonIndex / 4,
      3,
    )
  }
  pylon.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxPortalTelegraphOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxPortalTelegraphForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxPortalTelegraphSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxPortalTelegraphPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.08, 0), 1.25)
  geometry.userData['pfxPortalTelegraphDrawCalls'] = 1
  geometry.userData['pfxPortalTelegraphClosedFaces'] = true
  geometry.userData['pfxPortalTelegraphBillboardCount'] = 0
  geometry.userData['pfxPortalTelegraphBoundaryCount'] = 1
  geometry.userData['pfxPortalTelegraphApertureCount'] = 1
  geometry.userData['pfxPortalTelegraphCountdownWedgeCount'] = 8
  geometry.userData['pfxPortalTelegraphCardinalPylonCount'] = 4
  geometry.userData['pfxPortalTelegraphWorldPlane'] = 'xz-ground-plane'
  geometry.userData['pfxPortalTelegraphSilhouetteProfile'] = 'stable-outer-danger-boundary-recessed-throat-eight-inward-wedges-and-four-raised-pylons'
  geometry.userData['pfxPortalTelegraphPalette'] = 'void-purple-warning-violet-cold-lilac-arrival-ivory'
  geometry.userData['pfxPortalTelegraphAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxPortalTelegraphTriangleCount'] = positions.length / 9
  geometry.userData['pfxPortalTelegraphWidthSpan'] = 2.2
  geometry.userData['pfxPortalTelegraphDepthSpan'] = 2.2
  geometry.userData['pfxPortalTelegraphHeightSpan'] = 0.72
  return geometry
}

export function createPfxPortalTelegraphMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxPortalTelegraphOrigin;
      attribute float pfxPortalTelegraphForm;
      attribute float pfxPortalTelegraphSeed;
      attribute float pfxPortalTelegraphPaletteIndex;
      varying vec3 vPortalNormal;
      varying vec3 vPortalViewPosition;
      varying float vPortalForm;
      varying float vPortalPaletteIndex;
      varying float vPortalLife;
      varying float vPortalSeed;
      void main() {
        float boundaryForm = 1.0 - step(0.5, pfxPortalTelegraphForm);
        float apertureForm = step(0.5, pfxPortalTelegraphForm) * (1.0 - step(1.5, pfxPortalTelegraphForm));
        float wedgeForm = step(1.5, pfxPortalTelegraphForm) * (1.0 - step(2.5, pfxPortalTelegraphForm));
        float pylonForm = step(2.5, pfxPortalTelegraphForm);
        float boundaryHold = smoothstep(0.004, 0.035, uCycle);
        float countdownConvergence = smoothstep(0.08 + pfxPortalTelegraphSeed * 0.035, 0.58, uCycle);
        float apertureBreach = smoothstep(0.42, 0.74, uCycle);
        vec3 local = position - pfxPortalTelegraphOrigin;
        vec3 boundaryPosition = pfxPortalTelegraphOrigin + local;
        vec3 aperturePosition = pfxPortalTelegraphOrigin + local * vec3(mix(0.18, 1.0, apertureBreach), mix(0.3, 1.0, apertureBreach), mix(0.18, 1.0, apertureBreach));
        vec3 wedgePosition = pfxPortalTelegraphOrigin + local * vec3(mix(1.0, 0.48, countdownConvergence), 1.0, mix(1.0, 0.48, countdownConvergence));
        vec3 pylonPosition = pfxPortalTelegraphOrigin + local * vec3(1.0, mix(0.22, 1.0, countdownConvergence), 1.0);
        vec3 transformed = boundaryPosition * boundaryForm + aperturePosition * apertureForm + wedgePosition * wedgeForm + pylonPosition * pylonForm;
        float retire = 1.0 - smoothstep(0.82, 0.91, uCycle);
        float arrivalFlash = smoothstep(0.68, 0.77, uCycle) * (1.0 - smoothstep(0.82, 0.9, uCycle));
        vPortalLife = boundaryHold * retire * (boundaryForm + wedgeForm + pylonForm) + max(apertureBreach * retire, arrivalFlash) * apertureForm;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vPortalNormal = normalize(normalMatrix * normal);
        vPortalViewPosition = viewPosition.xyz;
        vPortalForm = pfxPortalTelegraphForm;
        vPortalPaletteIndex = pfxPortalTelegraphPaletteIndex;
        vPortalSeed = pfxPortalTelegraphSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vPortalNormal;
      varying vec3 vPortalViewPosition;
      varying float vPortalForm;
      varying float vPortalPaletteIndex;
      varying float vPortalLife;
      varying float vPortalSeed;
      void main() {
        vec3 normal = normalize(vPortalNormal);
        vec3 viewDirection = normalize(-vPortalViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.8, 0.48));
        float apertureForm = step(0.5, vPortalForm) * (1.0 - step(1.5, vPortalForm));
        float pylonForm = step(2.5, vPortalForm);
        float diffuse = 0.4 + max(0.0, dot(normal, keyLight)) * 0.56;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float warningEdge = rim * rim;
        float arrivalGlint = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        arrivalGlint *= arrivalGlint;
        arrivalGlint *= arrivalGlint;
        vec3 voidPurple = vec3(0.045, 0.012, 0.11);
        vec3 warningViolet = vec3(0.46, 0.12, 0.86);
        vec3 coldLilac = vec3(0.72, 0.52, 1.0);
        vec3 arrivalIvory = vec3(1.0, 0.88, 0.72);
        vec3 portalPalette = mix(warningViolet, coldLilac, step(1.5, vPortalPaletteIndex));
        portalPalette = mix(portalPalette, voidPurple, apertureForm * 0.78);
        portalPalette = mix(portalPalette, arrivalIvory, pylonForm * 0.38);
        vec3 pigment = portalPalette * diffuse * (0.92 + vPortalSeed * 0.12);
        pigment += coldLilac * warningEdge * mix(0.32, 0.16, apertureForm);
        pigment += arrivalIvory * arrivalGlint * mix(0.28, 0.52, pylonForm);
        float coverage = vPortalLife * mix(0.92, 0.98, pylonForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxPortalTelegraphMaterial'] = true
  material.userData['pfxPortalTelegraphMaterialProfile'] = 'void-purple-aperture-with-warning-violet-boundary-cold-lilac-wedges-and-ivory-arrival-glints'
  material.userData['pfxPortalTelegraphFragmentTranscendentalOps'] = 0
  material.userData['pfxPortalTelegraphAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
