import * as THREE from 'three'

export function createPfxJumpBeamGeometry(): THREE.BufferGeometry {
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
    form: 0 | 1 | 2 | 3,
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

  const ring = new THREE.TorusGeometry(1, 0.055, 4, 20)
  const ringLayouts = [
    { radius: 0.9, height: 0.04, squash: 1 },
    { radius: 0.62, height: 0.13, squash: 0.88 },
  ] as const
  ringLayouts.forEach((layout, index) => {
    const origin = new THREE.Vector3(0, layout.height, 0)
    appendPrimitive(ring, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, index * Math.PI / 8)),
      new THREE.Vector3(layout.radius, layout.radius, layout.radius * layout.squash),
    ), origin, 0, index * 0.5, index === 0 ? 1 : 2)
  })
  ring.dispose()

  const vane = new THREE.ConeGeometry(0.17, 0.62, 4, 1, false)
  for (let index = 0; index < 9; index += 1) {
    const progress = index / 8
    const angle = index * 1.42
    const radius = THREE.MathUtils.lerp(0.5, 0.23, progress)
    const origin = new THREE.Vector3(
      Math.cos(angle) * radius,
      0.38 + progress * 1.88,
      Math.sin(angle) * radius,
    )
    appendPrimitive(vane, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.cos(angle) * 0.22,
        -angle + Math.PI * 0.25,
        Math.sin(angle) * -0.22,
      )),
      new THREE.Vector3(THREE.MathUtils.lerp(1.12, 0.72, progress), THREE.MathUtils.lerp(1.0, 0.72, progress), 0.72),
    ), origin, 1, progress, index % 3 === 0 ? 2 : 0)
  }
  vane.dispose()

  const liftSpine = new THREE.CylinderGeometry(0.065, 0.15, 2.34, 3, 1, false)
  const liftSpineOrigin = new THREE.Vector3(0, 1.28, 0)
  appendPrimitive(liftSpine, new THREE.Matrix4().compose(
    liftSpineOrigin,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 6, 0)),
    new THREE.Vector3(1, 1, 1),
  ), liftSpineOrigin, 1, 0.5, 1)
  liftSpine.dispose()

  const liftArrow = new THREE.ConeGeometry(0.2, 0.48, 3, 1, false)
  const arrowLayouts = [
    { height: 0.72, radius: 0.74, angle: 0.2 },
    { height: 1.38, radius: 0.62, angle: 2.3 },
    { height: 2.02, radius: 0.48, angle: 4.35 },
  ] as const
  arrowLayouts.forEach((layout, index) => {
    const origin = new THREE.Vector3(
      Math.cos(layout.angle) * layout.radius,
      layout.height,
      Math.sin(layout.angle) * layout.radius,
    )
    appendPrimitive(liftArrow, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -layout.angle, 0)),
      new THREE.Vector3(1, 1, 0.72),
    ), origin, 2, index / arrowLayouts.length, 3)
  })
  liftArrow.dispose()

  const crown = new THREE.TorusGeometry(0.38, 0.06, 4, 16)
  const crownOrigin = new THREE.Vector3(0, 2.62, 0)
  appendPrimitive(crown, new THREE.Matrix4().compose(
    crownOrigin,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, Math.PI / 12)),
    new THREE.Vector3(1, 1, 0.82),
  ), crownOrigin, 3, 0.5, 3)
  crown.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxJumpBeamOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxJumpBeamForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxJumpBeamSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxJumpBeamPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 1.72)
  geometry.userData['pfxJumpBeamDrawCalls'] = 1
  geometry.userData['pfxJumpBeamClosedFaces'] = true
  geometry.userData['pfxJumpBeamBillboardCount'] = 0
  geometry.userData['pfxJumpBeamInductionRingCount'] = ringLayouts.length
  geometry.userData['pfxJumpBeamHelicalVaneCount'] = 9
  geometry.userData['pfxJumpBeamLiftArrowCount'] = arrowLayouts.length
  geometry.userData['pfxJumpBeamLiftSpineCount'] = 1
  geometry.userData['pfxJumpBeamCrownApertureCount'] = 1
  geometry.userData['pfxJumpBeamAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxJumpBeamMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxJumpBeamOrigin;
      attribute float pfxJumpBeamForm;
      attribute float pfxJumpBeamSeed;
      attribute float pfxJumpBeamPaletteIndex;
      varying vec3 vJumpNormal;
      varying vec3 vJumpViewPosition;
      varying vec3 vJumpLocal;
      varying float vJumpForm;
      varying float vJumpPaletteIndex;
      varying float vJumpPulse;
      void main() {
        float updraftAdvance = fract(uCycle + pfxJumpBeamSeed * 0.18);
        float liftPulse = 1.0 - abs(updraftAdvance * 2.0 - 1.0);
        float movingForm = step(0.5, pfxJumpBeamForm) * (1.0 - step(2.5, pfxJumpBeamForm));
        vec3 local = position - pfxJumpBeamOrigin;
        vec3 animatedOrigin = pfxJumpBeamOrigin;
        animatedOrigin.y += movingForm * liftPulse * (0.05 + pfxJumpBeamSeed * 0.06);
        vec3 transformed = animatedOrigin + local * vec3(1.0 - movingForm * liftPulse * 0.035, 1.0 + movingForm * liftPulse * 0.09, 1.0 - movingForm * liftPulse * 0.035);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vJumpNormal = normalize(normalMatrix * normal);
        vJumpViewPosition = viewPosition.xyz;
        vJumpLocal = transformed;
        vJumpForm = pfxJumpBeamForm;
        vJumpPaletteIndex = pfxJumpBeamPaletteIndex;
        vJumpPulse = liftPulse;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      varying vec3 vJumpNormal;
      varying vec3 vJumpViewPosition;
      varying vec3 vJumpLocal;
      varying float vJumpForm;
      varying float vJumpPaletteIndex;
      varying float vJumpPulse;
      void main() {
        vec3 normal = normalize(vJumpNormal);
        vec3 viewDirection = normalize(-vJumpViewPosition);
        vec3 keyLight = normalize(vec3(-0.3, 0.84, 0.46));
        float diffuse = 0.32 + max(0.0, dot(normal, keyLight)) * 0.64;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float ringForm = 1.0 - step(0.5, vJumpForm);
        float vaneForm = step(0.5, vJumpForm) * (1.0 - step(1.5, vJumpForm));
        float arrowForm = step(1.5, vJumpForm) * (1.0 - step(2.5, vJumpForm));
        float crownForm = step(2.5, vJumpForm);
        float ascendingBand = 1.0 - smoothstep(0.045, 0.14, abs(fract(vJumpLocal.y / 2.85 - uCycle * 0.82) - 0.5));
        vec3 deepLiftBlue = vec3(0.025, 0.13, 0.36);
        vec3 launchBlue = vec3(0.06, 0.48, 1.0);
        vec3 updraftCyan = vec3(0.28, 0.84, 1.0);
        vec3 crownIvory = vec3(0.86, 0.98, 1.0);
        vec3 jumpPalette = mix(deepLiftBlue, launchBlue, step(0.5, vJumpPaletteIndex));
        jumpPalette = mix(jumpPalette, updraftCyan, step(1.5, vJumpPaletteIndex));
        jumpPalette = mix(jumpPalette, crownIvory, step(2.5, vJumpPaletteIndex));
        vec3 pigment = jumpPalette * diffuse;
        pigment += updraftCyan * ascendingBand * (0.22 + vaneForm * 0.46 + ringForm * 0.22);
        pigment += crownIvory * (rim * rim) * (0.2 + arrowForm * 0.42 + crownForm * 0.52);
        pigment += launchBlue * vJumpPulse * vaneForm * 0.16;
        float coverage = 0.82 + ringForm * 0.08 + arrowForm * 0.08 + crownForm * 0.1;
        gl_FragColor = vec4(pigment, coverage * uOpacity);
      }
    `,
  })
  material.userData['pfxJumpBeamMaterial'] = true
  material.userData['pfxJumpBeamFragmentTranscendentalOps'] = 0
  material.userData['pfxJumpBeamAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
