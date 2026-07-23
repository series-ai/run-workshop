import * as THREE from 'three'

export function createPfxBarrierColumnGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
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
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const panel = new THREE.BoxGeometry(0.68, 2.1, 0.075)
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2
    appendPrimitive(panel, new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(angle) * 0.38, 1.12, Math.cos(angle) * 0.38),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
      new THREE.Vector3(1, 1, 1),
    ), 0, index / 6, 0)
  }
  panel.dispose()

  const brace = new THREE.BoxGeometry(0.115, 2.34, 0.115)
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2 + Math.PI / 6
    appendPrimitive(brace, new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(angle) * 0.7, 1.19, Math.cos(angle) * 0.7),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, index % 2 === 0 ? 0.035 : -0.035)),
      new THREE.Vector3(1, 1, 1),
    ), 1, index / 6, 1)
  }
  brace.dispose()

  const rail = new THREE.TorusGeometry(0.66, 0.055, 4, 12)
  const railHeights = [0.08, 0.58, 1.12, 1.66, 2.2] as const
  railHeights.forEach((height, index) => appendPrimitive(rail, new THREE.Matrix4().compose(
    new THREE.Vector3(0, height, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, index % 2 === 0 ? 0 : Math.PI / 6)),
    new THREE.Vector3(1, 1, 1),
  ), 2, index / railHeights.length, 2))
  rail.dispose()

  const pylon = new THREE.ConeGeometry(0.1, 0.28, 4, 1, false)
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2 + Math.PI / 6
    appendPrimitive(pylon, new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(angle) * 0.7, 2.4, Math.cos(angle) * 0.7),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0)),
      new THREE.Vector3(1, 1, 1),
    ), 3, index / 6, 3)
  }
  pylon.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxBarrierColumnForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxBarrierColumnSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxBarrierColumnPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.25, 0), 1.6)
  geometry.userData['pfxBarrierColumnDrawCalls'] = 1
  geometry.userData['pfxBarrierColumnClosedFaces'] = true
  geometry.userData['pfxBarrierColumnBillboardCount'] = 0
  geometry.userData['pfxBarrierColumnPanelCount'] = 6
  geometry.userData['pfxBarrierColumnBraceCount'] = 6
  geometry.userData['pfxBarrierColumnEnergyRailCount'] = railHeights.length
  geometry.userData['pfxBarrierColumnCrownPylonCount'] = 6
  geometry.userData['pfxBarrierColumnAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxBarrierColumnMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute float pfxBarrierColumnForm;
      attribute float pfxBarrierColumnSeed;
      attribute float pfxBarrierColumnPaletteIndex;
      varying vec3 vBarrierNormal;
      varying vec3 vBarrierViewPosition;
      varying vec3 vBarrierLocal;
      varying float vBarrierForm;
      varying float vBarrierPaletteIndex;
      varying float vBarrierPulse;
      void main() {
        float sentinelPulse = 1.0 - abs(fract(uCycle + pfxBarrierColumnSeed * 0.14) * 2.0 - 1.0);
        vec3 transformed = position;
        float crownForm = step(2.5, pfxBarrierColumnForm);
        transformed.y += crownForm * sentinelPulse * 0.035;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vBarrierNormal = normalize(normalMatrix * normal);
        vBarrierViewPosition = viewPosition.xyz;
        vBarrierLocal = transformed;
        vBarrierForm = pfxBarrierColumnForm;
        vBarrierPaletteIndex = pfxBarrierColumnPaletteIndex;
        vBarrierPulse = sentinelPulse;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      varying vec3 vBarrierNormal;
      varying vec3 vBarrierViewPosition;
      varying vec3 vBarrierLocal;
      varying float vBarrierForm;
      varying float vBarrierPaletteIndex;
      varying float vBarrierPulse;
      void main() {
        vec3 normal = normalize(vBarrierNormal);
        vec3 viewDirection = normalize(-vBarrierViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.82, 0.46));
        float diffuse = 0.34 + max(0.0, dot(normal, keyLight)) * 0.62;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float braceForm = step(0.5, vBarrierForm);
        float railForm = step(1.5, vBarrierForm);
        float ascendingScan = 1.0 - smoothstep(0.055, 0.16, abs(fract(vBarrierLocal.y / 2.7 - uCycle) - 0.5));
        vec3 deepBarrierBlue = vec3(0.035, 0.18, 0.42);
        vec3 defensiveBlue = vec3(0.08, 0.42, 0.9);
        vec3 railCyan = vec3(0.28, 0.82, 1.0);
        vec3 crownIvory = vec3(0.62, 0.9, 1.0);
        vec3 barrierPalette = mix(deepBarrierBlue, defensiveBlue, step(0.5, vBarrierPaletteIndex));
        barrierPalette = mix(barrierPalette, railCyan, step(1.5, vBarrierPaletteIndex));
        barrierPalette = mix(barrierPalette, crownIvory, step(2.5, vBarrierPaletteIndex));
        float energy = railForm * (0.24 + ascendingScan * 0.76) + braceForm * rim * 0.32 + vBarrierPulse * 0.08;
        vec3 pigment = barrierPalette * (diffuse + 0.16) + railCyan * energy;
        pigment += defensiveBlue * ascendingScan * (1.0 - railForm) * 0.34;
        pigment += crownIvory * rim * railForm * 0.18;
        float coverage = mix(0.72, 0.96, braceForm) + railForm * ascendingScan * 0.04;
        gl_FragColor = vec4(pigment, clamp(coverage, 0.0, 1.0) * uOpacity);
      }
    `,
  })
  material.userData['pfxBarrierColumnMaterial'] = true
  material.userData['pfxBarrierColumnFragmentTranscendentalOps'] = 0
  material.userData['pfxBarrierColumnAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
