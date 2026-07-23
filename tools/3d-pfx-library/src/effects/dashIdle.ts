import * as THREE from 'three'

export function createPfxDashIdleGeometry(): THREE.BufferGeometry {
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

  const depthLanes = [-0.42, -0.14, 0.14, 0.42] as const
  const chevron = new THREE.ConeGeometry(0.2, 0.68, 4, 1, false)
  for (let index = 0; index < 6; index += 1) {
    const row = index % 3
    const origin = new THREE.Vector3(-1.0 + row * 0.48, (index < 3 ? 0.22 : -0.22) + row * 0.025, depthLanes[(index + row) % depthLanes.length]!)
    appendPrimitive(chevron, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI * 0.5 + (index < 3 ? 0.12 : -0.12))),
      new THREE.Vector3(1, 1, 0.72),
    ), origin, 0, index / 6, index % 3 === 0 ? 1 : 0)
  }
  chevron.dispose()

  const rail = new THREE.BoxGeometry(1.7, 0.075, 0.09)
  for (let index = 0; index < 2; index += 1) {
    const origin = new THREE.Vector3(0.1, index === 0 ? 0.34 : -0.34, index === 0 ? 0.16 : -0.16)
    appendPrimitive(rail, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index === 0 ? -0.08 : 0.08, 0)),
      new THREE.Vector3(1, 1, 1),
    ), origin, 1, index, 2)
  }
  rail.dispose()

  const core = new THREE.OctahedronGeometry(1, 1)
  const coreOrigin = new THREE.Vector3(0.86, 0, 0)
  appendPrimitive(core, new THREE.Matrix4().compose(
    coreOrigin,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0.28, 0.1)),
    new THREE.Vector3(0.22, 0.32, 0.24),
  ), coreOrigin, 2, 0.5, 3)
  core.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxDashIdleOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxDashIdleForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxDashIdleSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxDashIdlePaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-0.05, 0, 0), 1.5)
  geometry.userData['pfxDashIdleDrawCalls'] = 1
  geometry.userData['pfxDashIdleClosedFaces'] = true
  geometry.userData['pfxDashIdleBillboardCount'] = 0
  geometry.userData['pfxDashIdleSweptChevronCount'] = 6
  geometry.userData['pfxDashIdleForwardRailCount'] = 2
  geometry.userData['pfxDashIdleLaunchCoreCount'] = 1
  geometry.userData['pfxDashIdleDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxDashIdleAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxDashIdleMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxDashIdleOrigin;
      attribute float pfxDashIdleForm;
      attribute float pfxDashIdleSeed;
      attribute float pfxDashIdlePaletteIndex;
      varying vec3 vDashNormal;
      varying vec3 vDashViewPosition;
      varying vec3 vDashLocal;
      varying float vDashForm;
      varying float vDashPaletteIndex;
      varying float vDashReadiness;
      void main() {
        float readinessCompression = 1.0 - abs(fract(uCycle + pfxDashIdleSeed * 0.055) * 2.0 - 1.0);
        float chevronForm = 1.0 - step(0.5, pfxDashIdleForm);
        float coreForm = step(1.5, pfxDashIdleForm);
        vec3 local = position - pfxDashIdleOrigin;
        vec3 animatedOrigin = pfxDashIdleOrigin;
        animatedOrigin.x += chevronForm * readinessCompression * (0.12 + pfxDashIdleSeed * 0.1);
        animatedOrigin.x += coreForm * readinessCompression * 0.025;
        vec3 transformed = animatedOrigin + local * mix(1.0, 1.0 + readinessCompression * 0.08, coreForm);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vDashNormal = normalize(normalMatrix * normal);
        vDashViewPosition = viewPosition.xyz;
        vDashLocal = transformed;
        vDashForm = pfxDashIdleForm;
        vDashPaletteIndex = pfxDashIdlePaletteIndex;
        vDashReadiness = readinessCompression;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vDashNormal;
      varying vec3 vDashViewPosition;
      varying vec3 vDashLocal;
      varying float vDashForm;
      varying float vDashPaletteIndex;
      varying float vDashReadiness;
      void main() {
        vec3 normal = normalize(vDashNormal);
        vec3 viewDirection = normalize(-vDashViewPosition);
        vec3 keyLight = normalize(vec3(-0.28, 0.78, 0.56));
        float diffuse = 0.34 + max(0.0, dot(normal, keyLight)) * 0.62;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float railForm = step(0.5, vDashForm) * (1.0 - step(1.5, vDashForm));
        float coreForm = step(1.5, vDashForm);
        float directionalWake = smoothstep(-1.3, 0.9, vDashLocal.x) * (0.18 + vDashReadiness * 0.42);
        vec3 deepVelocityBlue = vec3(0.025, 0.13, 0.34);
        vec3 dashBlue = vec3(0.08, 0.48, 1.0);
        vec3 railCyan = vec3(0.34, 0.86, 1.0);
        vec3 launchIvory = vec3(0.86, 0.98, 1.0);
        vec3 dashPalette = mix(deepVelocityBlue, dashBlue, step(0.5, vDashPaletteIndex));
        dashPalette = mix(dashPalette, railCyan, step(1.5, vDashPaletteIndex));
        dashPalette = mix(dashPalette, launchIvory, step(2.5, vDashPaletteIndex));
        vec3 pigment = dashPalette * diffuse;
        pigment += railCyan * directionalWake * (0.22 + railForm * 0.46);
        pigment += launchIvory * (rim * rim) * (0.18 + coreForm * 0.5);
        float coverage = 0.82 + railForm * 0.1 + coreForm * 0.08;
        gl_FragColor = vec4(pigment, coverage * uOpacity);
      }
    `,
  })
  material.userData['pfxDashIdleMaterial'] = true
  material.userData['pfxDashIdleFragmentTranscendentalOps'] = 0
  material.userData['pfxDashIdleAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
