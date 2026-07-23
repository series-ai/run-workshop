import * as THREE from 'three'

export function createPfxRewardChargeGeometry(): THREE.BufferGeometry {
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

  const core = new THREE.OctahedronGeometry(1, 0)
  const coreOrigin = new THREE.Vector3(0, 0, 0)
  appendPrimitive(core, new THREE.Matrix4().compose(
    coreOrigin,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0.36, 0.1)),
    new THREE.Vector3(0.34, 0.42, 0.32),
  ), coreOrigin, 0, 0.5, 3)
  core.dispose()

  const gimbal = new THREE.TorusGeometry(0.72, 0.045, 4, 18)
  const gimbalRotations = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI * 0.5, 0, Math.PI / 8),
    new THREE.Euler(0, Math.PI * 0.5, -Math.PI / 8),
  ] as const
  gimbalRotations.forEach((rotation, index) => appendPrimitive(gimbal, new THREE.Matrix4().compose(
    coreOrigin,
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1),
  ), coreOrigin, 1, index / 3, index === 0 ? 1 : 2))
  gimbal.dispose()

  const intakeArrow = new THREE.ConeGeometry(0.11, 0.48, 4, 1, false)
  const up = new THREE.Vector3(0, 1, 0)
  for (let index = 0; index < 12; index += 1) {
    const plane = Math.floor(index / 4)
    const angle = index % 4 * Math.PI * 0.5 + plane * 0.18
    const origin = plane === 0
      ? new THREE.Vector3(Math.cos(angle) * 1.04, Math.sin(angle) * 1.04, -0.3)
      : plane === 1
        ? new THREE.Vector3(Math.cos(angle) * 1.04, 0.18, Math.sin(angle) * 1.04)
        : new THREE.Vector3(0.26, Math.cos(angle) * 1.04, Math.sin(angle) * 1.04)
    const direction = origin.clone().normalize().negate()
    appendPrimitive(intakeArrow, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromUnitVectors(up, direction),
      new THREE.Vector3(index % 2 === 0 ? 1.08 : 0.86, index % 3 === 0 ? 1.16 : 0.92, 0.78),
    ), origin, 2, index / 12, index % 4 === 0 ? 3 : 1)
  }
  intakeArrow.dispose()

  const gem = new THREE.OctahedronGeometry(1, 0)
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4
    const origin = new THREE.Vector3(Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, index % 2 === 0 ? 0.42 : -0.42)
    appendPrimitive(gem, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.18, index * 0.3, index * -0.14)),
      new THREE.Vector3(0.12, 0.17, 0.11),
    ), origin, 3, index / 4, 3)
  }
  gem.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxRewardChargeOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxRewardChargeForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxRewardChargeSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxRewardChargePaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.42)
  geometry.userData['pfxRewardChargeDrawCalls'] = 1
  geometry.userData['pfxRewardChargeClosedFaces'] = true
  geometry.userData['pfxRewardChargeBillboardCount'] = 0
  geometry.userData['pfxRewardChargeStoredValueCoreCount'] = 1
  geometry.userData['pfxRewardChargeGimbalCount'] = gimbalRotations.length
  geometry.userData['pfxRewardChargeIntakeArrowCount'] = 12
  geometry.userData['pfxRewardChargeEscrowGemCount'] = 4
  geometry.userData['pfxRewardChargeDepthLaneCount'] = 3
  geometry.userData['pfxRewardChargeAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxRewardChargeMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxRewardChargeOrigin;
      attribute float pfxRewardChargeForm;
      attribute float pfxRewardChargeSeed;
      attribute float pfxRewardChargePaletteIndex;
      varying vec3 vRewardNormal;
      varying vec3 vRewardViewPosition;
      varying float vRewardForm;
      varying float vRewardPaletteIndex;
      varying float vRewardStored;
      void main() {
        float gatherProgress = smoothstep(0.02, 0.76, uCycle);
        float releaseSnap = smoothstep(0.84, 0.98, uCycle);
        float intakeForm = step(1.5, pfxRewardChargeForm) * (1.0 - step(2.5, pfxRewardChargeForm));
        float gemForm = step(2.5, pfxRewardChargeForm);
        float coreForm = 1.0 - step(0.5, pfxRewardChargeForm);
        vec3 local = position - pfxRewardChargeOrigin;
        vec3 animatedOrigin = pfxRewardChargeOrigin;
        animatedOrigin *= mix(1.18, 0.7, gatherProgress);
        animatedOrigin *= mix(1.0, 1.42, releaseSnap * (intakeForm + gemForm));
        float chargePulse = 1.0 - abs(fract(uCycle * 2.0 + pfxRewardChargeSeed * 0.14) * 2.0 - 1.0);
        float localScale = 1.0 + coreForm * gatherProgress * 0.18 + chargePulse * (0.025 + gemForm * 0.05);
        vec3 transformed = animatedOrigin + local * localScale;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vRewardNormal = normalize(normalMatrix * normal);
        vRewardViewPosition = viewPosition.xyz;
        vRewardForm = pfxRewardChargeForm;
        vRewardPaletteIndex = pfxRewardChargePaletteIndex;
        vRewardStored = gatherProgress * (1.0 - releaseSnap * 0.72);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vRewardNormal;
      varying vec3 vRewardViewPosition;
      varying float vRewardForm;
      varying float vRewardPaletteIndex;
      varying float vRewardStored;
      void main() {
        vec3 normal = normalize(vRewardNormal);
        vec3 viewDirection = normalize(-vRewardViewPosition);
        vec3 keyLight = normalize(vec3(-0.28, 0.84, 0.46));
        float diffuse = 0.34 + max(0.0, dot(normal, keyLight)) * 0.64;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float coreForm = 1.0 - step(0.5, vRewardForm);
        float gimbalForm = step(0.5, vRewardForm) * (1.0 - step(1.5, vRewardForm));
        float intakeForm = step(1.5, vRewardForm) * (1.0 - step(2.5, vRewardForm));
        float gemForm = step(2.5, vRewardForm);
        float storedValue = coreForm * 0.62 + gimbalForm * 0.34 + intakeForm * 0.24 + gemForm * 0.46;
        vec3 vaultBrown = vec3(0.28, 0.11, 0.012);
        vec3 deepGold = vec3(0.72, 0.31, 0.025);
        vec3 chargeGold = vec3(1.0, 0.66, 0.06);
        vec3 escrowIvory = vec3(1.0, 0.95, 0.64);
        vec3 rewardPalette = mix(vaultBrown, deepGold, step(0.5, vRewardPaletteIndex));
        rewardPalette = mix(rewardPalette, chargeGold, step(1.5, vRewardPaletteIndex));
        rewardPalette = mix(rewardPalette, escrowIvory, step(2.5, vRewardPaletteIndex));
        vec3 pigment = rewardPalette * diffuse;
        pigment += chargeGold * storedValue * vRewardStored * 0.5;
        pigment += escrowIvory * (rim * rim) * (0.14 + coreForm * 0.48 + gemForm * 0.38);
        float coverage = 0.78 + coreForm * 0.16 + gemForm * 0.06;
        gl_FragColor = vec4(pigment, coverage * uOpacity);
      }
    `,
  })
  material.userData['pfxRewardChargeMaterial'] = true
  material.userData['pfxRewardChargeFragmentTranscendentalOps'] = 0
  material.userData['pfxRewardChargeAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
