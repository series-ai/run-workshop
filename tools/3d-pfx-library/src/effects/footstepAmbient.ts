import * as THREE from 'three'

export function createPfxFootstepAmbientGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    origin: THREE.Vector3,
    form: 0 | 1 | 2,
    seed: number,
    paletteIndex: number,
  ) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let index = 0; index < rawPositions.count; index += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, index).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, index).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(origin.x, origin.y, origin.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const sole = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false)
  const clod = new THREE.TetrahedronGeometry(0.13, 0)
  const wakeFin = new THREE.ConeGeometry(0.11, 0.42, 3, 1, false)
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
    const side = stepIndex % 2 === 0 ? -1 : 1
    const seed = stepIndex / 4
    const stepZ = -1.0 + stepIndex * 0.55
    const yaw = side * 0.13
    const heelOrigin = new THREE.Vector3(side * 0.32, 0.045, stepZ)
    const toeOrigin = new THREE.Vector3(side * 0.32, 0.052, stepZ + 0.25)
    appendPrimitive(sole, new THREE.Matrix4().compose(
      heelOrigin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(0.2, 0.07, 0.24),
    ), heelOrigin, 0, seed, 0)
    appendPrimitive(sole, new THREE.Matrix4().compose(
      toeOrigin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(0.25, 0.065, 0.2),
    ), toeOrigin, 0, seed, 1)

    for (let clodIndex = 0; clodIndex < 2; clodIndex += 1) {
      const clodOrigin = new THREE.Vector3(
        side * (0.62 + clodIndex * 0.12),
        0.12 + clodIndex * 0.055,
        stepZ + 0.06 + clodIndex * 0.18,
      )
      appendPrimitive(clod, new THREE.Matrix4().compose(
        clodOrigin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(seed * 1.7, yaw + clodIndex * 0.5, clodIndex * 0.4)),
        new THREE.Vector3(1, 0.72, 0.84),
      ), clodOrigin, 1, seed + clodIndex * 0.07, clodIndex === 0 ? 1 : 2)
    }

    const finOrigin = new THREE.Vector3(side * 0.32, 0.13, stepZ - 0.3)
    appendPrimitive(wakeFin, new THREE.Matrix4().compose(
      finOrigin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, yaw, 0)),
      new THREE.Vector3(1, 1, 0.75),
    ), finOrigin, 2, seed, 2)
  }
  sole.dispose()
  clod.dispose()
  wakeFin.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxFootstepAmbientOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxFootstepAmbientForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxFootstepAmbientSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxFootstepAmbientPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.12, -0.05), 1.55)
  geometry.userData['pfxFootstepAmbientDrawCalls'] = 1
  geometry.userData['pfxFootstepAmbientClosedFaces'] = true
  geometry.userData['pfxFootstepAmbientBillboardCount'] = 0
  geometry.userData['pfxFootstepAmbientStepImpressionCount'] = 4
  geometry.userData['pfxFootstepAmbientHeelToePieceCount'] = 8
  geometry.userData['pfxFootstepAmbientKickedClodCount'] = 8
  geometry.userData['pfxFootstepAmbientWakeFinCount'] = 4
  geometry.userData['pfxFootstepAmbientAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxFootstepAmbientMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxFootstepAmbientOrigin;
      attribute float pfxFootstepAmbientForm;
      attribute float pfxFootstepAmbientSeed;
      attribute float pfxFootstepAmbientPaletteIndex;
      varying vec3 vFootstepNormal;
      varying vec3 vFootstepViewPosition;
      varying float vFootstepForm;
      varying float vFootstepPaletteIndex;
      varying float vFootstepPulse;
      void main() {
        float cadenceAdvance = fract(uCycle * 1.7 + pfxFootstepAmbientSeed);
        float stepPulse = 1.0 - abs(cadenceAdvance * 2.0 - 1.0);
        float airborneForm = step(0.5, pfxFootstepAmbientForm);
        vec3 local = position - pfxFootstepAmbientOrigin;
        vec3 animatedOrigin = pfxFootstepAmbientOrigin;
        animatedOrigin.y += airborneForm * stepPulse * (0.04 + pfxFootstepAmbientSeed * 0.08);
        vec3 transformed = animatedOrigin + local * vec3(1.0 + (1.0 - airborneForm) * stepPulse * 0.08, 1.0, 1.0 + (1.0 - airborneForm) * stepPulse * 0.08);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vFootstepNormal = normalize(normalMatrix * normal);
        vFootstepViewPosition = viewPosition.xyz;
        vFootstepForm = pfxFootstepAmbientForm;
        vFootstepPaletteIndex = pfxFootstepAmbientPaletteIndex;
        vFootstepPulse = stepPulse;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vFootstepNormal;
      varying vec3 vFootstepViewPosition;
      varying float vFootstepForm;
      varying float vFootstepPaletteIndex;
      varying float vFootstepPulse;
      void main() {
        vec3 normal = normalize(vFootstepNormal);
        vec3 viewDirection = normalize(-vFootstepViewPosition);
        vec3 keyLight = normalize(vec3(-0.42, 0.86, 0.3));
        float diffuse = 0.34 + max(0.0, dot(normal, keyLight)) * 0.62;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float groundCompression = 1.0 - step(0.5, vFootstepForm);
        float clodForm = step(0.5, vFootstepForm) * (1.0 - step(1.5, vFootstepForm));
        float finForm = step(1.5, vFootstepForm);
        vec3 packedEarth = vec3(0.2, 0.125, 0.055);
        vec3 warmDust = vec3(0.58, 0.39, 0.17);
        vec3 dryEdge = vec3(0.78, 0.62, 0.35);
        vec3 contactIvory = vec3(0.94, 0.82, 0.58);
        vec3 groundPalette = mix(packedEarth, warmDust, step(0.5, vFootstepPaletteIndex));
        groundPalette = mix(groundPalette, dryEdge, step(1.5, vFootstepPaletteIndex));
        vec3 pigment = groundPalette * diffuse;
        pigment += dryEdge * rim * (0.16 + clodForm * 0.28 + finForm * 0.34);
        pigment += contactIvory * groundCompression * vFootstepPulse * 0.22;
        float coverage = 0.78 + groundCompression * 0.12 + clodForm * 0.06 + finForm * 0.04;
        gl_FragColor = vec4(pigment, coverage * uOpacity);
      }
    `,
  })
  material.userData['pfxFootstepAmbientMaterial'] = true
  material.userData['pfxFootstepAmbientFragmentTranscendentalOps'] = 0
  material.userData['pfxFootstepAmbientAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
