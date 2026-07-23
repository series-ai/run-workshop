import * as THREE from 'three'

export function createPfxPickupBurstGeometry(): THREE.BufferGeometry {
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

  const token = new THREE.OctahedronGeometry(1, 0)
  const tokenOrigin = new THREE.Vector3(0, 0.18, 0)
  appendPrimitive(token, new THREE.Matrix4().compose(
    tokenOrigin,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.36, 0.12)),
    new THREE.Vector3(0.28, 0.36, 0.23),
  ), tokenOrigin, 0, 0.5, 3)
  token.dispose()

  const depthLanes = [-0.34, 0, 0.34] as const
  const ray = new THREE.ConeGeometry(0.1, 0.68, 4, 1, false)
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2 + (index % 2 === 0 ? -0.06 : 0.08)
    const radius = index % 3 === 0 ? 0.82 : 0.68
    const origin = new THREE.Vector3(
      Math.cos(angle) * radius,
      0.18 + Math.sin(angle) * radius,
      depthLanes[index % depthLanes.length]!,
    )
    appendPrimitive(ray, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index % 2 === 0 ? 0.12 : -0.12, -Math.PI * 0.5 + angle)),
      new THREE.Vector3(index % 2 === 0 ? 1.2 : 0.86, index % 3 === 0 ? 1.18 : 0.9, 0.72),
    ), origin, 1, index / 10, index % 3 === 0 ? 3 : 1)
  }
  ray.dispose()

  const gem = new THREE.OctahedronGeometry(1, 0)
  for (let index = 0; index < 6; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const row = Math.floor(index / 2)
    const origin = new THREE.Vector3(
      side * (0.28 + row * 0.12),
      0.66 + row * 0.28,
      depthLanes[(index + 1) % depthLanes.length]!,
    )
    appendPrimitive(gem, new THREE.Matrix4().compose(
      origin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.16, index * 0.33, index * 0.11)),
      new THREE.Vector3(0.11 + row * 0.018, 0.16 + row * 0.022, 0.1),
    ), origin, 2, index / 6, index % 3 === 0 ? 3 : 2)
  }
  gem.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxPickupBurstOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxPickupBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxPickupBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxPickupBurstPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.24, 0), 1.45)
  geometry.userData['pfxPickupBurstDrawCalls'] = 1
  geometry.userData['pfxPickupBurstClosedFaces'] = true
  geometry.userData['pfxPickupBurstBillboardCount'] = 0
  geometry.userData['pfxPickupBurstReceiptTokenCount'] = 1
  geometry.userData['pfxPickupBurstTokenProfile'] = 'faceted-octahedron'
  geometry.userData['pfxPickupBurstPayoutRayCount'] = 10
  geometry.userData['pfxPickupBurstRewardGemCount'] = 6
  geometry.userData['pfxPickupBurstDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxPickupBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  return geometry
}

export function createPfxPickupBurstMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxPickupBurstOrigin;
      attribute float pfxPickupBurstForm;
      attribute float pfxPickupBurstSeed;
      attribute float pfxPickupBurstPaletteIndex;
      varying vec3 vPickupNormal;
      varying vec3 vPickupViewPosition;
      varying float vPickupForm;
      varying float vPickupPaletteIndex;
      varying float vPickupLife;
      void main() {
        float attack = smoothstep(0.0, 0.16, uCycle);
        float release = 1.0 - smoothstep(0.58, 0.96, uCycle);
        float payoutLife = attack * release;
        float rayForm = step(0.5, pfxPickupBurstForm) * (1.0 - step(1.5, pfxPickupBurstForm));
        float gemForm = step(1.5, pfxPickupBurstForm);
        vec3 local = position - pfxPickupBurstOrigin;
        vec3 animatedOrigin = pfxPickupBurstOrigin;
        animatedOrigin.xy *= mix(0.22, 1.0, smoothstep(0.04 + pfxPickupBurstSeed * 0.035, 0.3 + pfxPickupBurstSeed * 0.055, uCycle));
        animatedOrigin.y += gemForm * smoothstep(0.12, 0.72, uCycle) * (0.12 + pfxPickupBurstSeed * 0.28);
        float localScale = mix(0.18, 1.0, attack) * mix(1.0, 0.72, gemForm * uCycle);
        localScale *= mix(1.0, 1.0 + payoutLife * 0.14, rayForm);
        vec3 transformed = animatedOrigin + local * localScale;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vPickupNormal = normalize(normalMatrix * normal);
        vPickupViewPosition = viewPosition.xyz;
        vPickupForm = pfxPickupBurstForm;
        vPickupPaletteIndex = pfxPickupBurstPaletteIndex;
        vPickupLife = payoutLife;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vPickupNormal;
      varying vec3 vPickupViewPosition;
      varying float vPickupForm;
      varying float vPickupPaletteIndex;
      varying float vPickupLife;
      void main() {
        vec3 normal = normalize(vPickupNormal);
        vec3 viewDirection = normalize(-vPickupViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.82, 0.46));
        float diffuse = 0.36 + max(0.0, dot(normal, keyLight)) * 0.62;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float tokenForm = 1.0 - step(0.5, vPickupForm);
        float rayForm = step(0.5, vPickupForm) * (1.0 - step(1.5, vPickupForm));
        float gemForm = step(1.5, vPickupForm);
        float rewardReceipt = tokenForm * 0.52 + rayForm * 0.34 + gemForm * 0.42;
        vec3 amberShadow = vec3(0.34, 0.15, 0.015);
        vec3 payoutGold = vec3(1.0, 0.56, 0.035);
        vec3 rewardYellow = vec3(1.0, 0.84, 0.16);
        vec3 receiptIvory = vec3(1.0, 0.98, 0.76);
        vec3 pickupPalette = mix(amberShadow, payoutGold, step(0.5, vPickupPaletteIndex));
        pickupPalette = mix(pickupPalette, rewardYellow, step(1.5, vPickupPaletteIndex));
        pickupPalette = mix(pickupPalette, receiptIvory, step(2.5, vPickupPaletteIndex));
        vec3 pigment = pickupPalette * diffuse;
        pigment += rewardYellow * rewardReceipt * vPickupLife * 0.44;
        pigment += receiptIvory * (rim * rim) * (0.16 + tokenForm * 0.46 + gemForm * 0.28);
        float coverage = vPickupLife * (0.76 + tokenForm * 0.18 + gemForm * 0.06);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, coverage * uOpacity);
      }
    `,
  })
  material.userData['pfxPickupBurstMaterial'] = true
  material.userData['pfxPickupBurstFragmentTranscendentalOps'] = 0
  material.userData['pfxPickupBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
