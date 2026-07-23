import * as THREE from 'three'
import { createPfxIceImpactChipGeometry } from './iceImpactChip'

export function createPfxIceImpactGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const pivots: number[] = []
  const revealOrders: number[] = []
  const groundMasks: number[] = []
  const activePivot = new THREE.Vector3()
  let activeRevealOrder = 0
  let activeGroundMask = 0
  const white: readonly [number, number, number] = [0.96, 1, 1]
  const pale: readonly [number, number, number] = [0.57, 0.9, 1]
  const cyan: readonly [number, number, number] = [0.18, 0.63, 0.9]
  const blue: readonly [number, number, number] = [0.045, 0.31, 0.64]
  const deep: readonly [number, number, number] = [0.015, 0.12, 0.31]
  const palette = [white, pale, cyan, blue, deep] as const
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...aColor, ...bColor, ...cColor)
    for (let vertex = 0; vertex < 3; vertex += 1) {
      pivots.push(activePivot.x, activePivot.y, activePivot.z)
      revealOrders.push(activeRevealOrder)
      groundMasks.push(activeGroundMask)
    }
  }
  const pushQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    nearColor: readonly [number, number, number],
    farColor: readonly [number, number, number],
  ) => {
    pushTriangle(a, b, c, nearColor, nearColor, farColor)
    pushTriangle(a, c, d, nearColor, farColor, farColor)
  }

  const heroShards = [
    { base: [-0.05, 0.035, 0.02], direction: [0.82, 0.55, 0.16], length: 1.45, width: 0.22, sides: 5 },
    { base: [0.01, 0.03, -0.03], direction: [0.42, 0.54, -0.73], length: 0.92, width: 0.17, sides: 4 },
    { base: [-0.06, 0.03, 0.04], direction: [-0.05, 0.98, 0.18], length: 0.82, width: 0.14, sides: 4 },
    { base: [0.02, 0.025, 0.02], direction: [0.05, 0.22, 0.98], length: 1.28, width: 0.17, sides: 4 },
    { base: [-0.05, 0.025, -0.02], direction: [-0.52, 0.7, -0.48], length: 0.72, width: 0.13, sides: 3 },
  ] as const
  const detailShards = [
    { base: [0.24, 0.055, 0.18], direction: [0.62, 0.55, 0.56], length: 0.3, width: 0.07, sides: 3 },
    { base: [-0.26, 0.06, 0.16], direction: [-0.72, 0.5, 0.48], length: 0.26, width: 0.065, sides: 3 },
    { base: [0.18, 0.045, -0.25], direction: [0.4, 0.48, -0.78], length: 0.32, width: 0.075, sides: 3 },
    { base: [-0.2, 0.05, -0.2], direction: [-0.58, 0.62, -0.52], length: 0.24, width: 0.06, sides: 3 },
  ] as const
  const shards = [...heroShards, ...detailShards]
  shards.forEach((shard, shardIndex) => {
    activeGroundMask = 0
    const base = new THREE.Vector3(...shard.base)
    activePivot.copy(base)
    activeRevealOrder = [0, 0.34, 0.08, 0.48, 0.24, 0.42, 0.56, 0.66, 0.74][shardIndex]!
    const axis = new THREE.Vector3(...shard.direction).normalize()
    const basisA = axis.clone().cross(Math.abs(axis.y) > 0.88 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
    const basisB = axis.clone().cross(basisA).normalize()
    const root = base.clone().addScaledVector(axis, -0.035)
    const isDetailShard = shardIndex >= heroShards.length
    const rootRingCenter = base.clone().addScaledVector(axis, shard.length * 0.12)
    const shoulderRingCenter = base.clone().addScaledVector(axis, shard.length * (isDetailShard ? 0.62 : 0.72))
    const tip = base.clone()
      .addScaledVector(axis, shard.length)
      .addScaledVector(basisA, (shardIndex % 2 === 0 ? 1 : -1) * shard.width * 0.18)
      .addScaledVector(basisB, ((shardIndex % 3) - 1) * shard.width * 0.1)
    const ringAt = (center: THREE.Vector3, radiusScale: number, phaseOffset: number) => Array.from({ length: shard.sides }, (_, corner) => {
      const angle = corner / shard.sides * Math.PI * 2 + shardIndex * 0.31 + phaseOffset
      const irregular = 0.76 + ((corner * 5 + shardIndex * 3) % 4) * 0.09
      return center.clone()
        .addScaledVector(basisA, Math.cos(angle) * shard.width * irregular * radiusScale)
        .addScaledVector(basisB, Math.sin(angle) * shard.width * (0.68 + (corner % 2) * 0.18) * radiusScale)
    })
    const rootRing = ringAt(rootRingCenter, 1, 0)
    const shoulderRing = ringAt(shoulderRingCenter, isDetailShard ? 0.42 : 0.58, 0.12)
    for (let face = 0; face < shard.sides; face += 1) {
      const next = (face + 1) % shard.sides
      const faceColor = palette[(face + shardIndex) % 4]!
      const nextColor = palette[(face + shardIndex + 1) % 4]!
      pushQuad(rootRing[face]!, rootRing[next]!, shoulderRing[next]!, shoulderRing[face]!, faceColor, nextColor)
      pushTriangle(tip, shoulderRing[face]!, shoulderRing[next]!, white, faceColor, nextColor)
      pushTriangle(root, rootRing[next]!, rootRing[face]!, deep, nextColor, faceColor)
    }
  })

  const primaryPlates = [-2.55, -1.25, -0.62, -0.2, 0.18, 0.58, 1.36].map((angle, plateIndex) => ({
    angle,
    outerRadius: [0.52, 0.66, 0.96, 1.18, 0.82, 1.02, 0.58][plateIndex]!,
    halfWidth: [0.18, 0.13, 0.19, 0.17, 0.12, 0.2, 0.14][plateIndex]!,
    innerRadius: 0.008 + (plateIndex % 3) * 0.006,
    fork: false,
  }))
  const branchFissures = [
    { angle: -2.05, outerRadius: 0.78, halfWidth: 0.075, innerRadius: 0.34, fork: true },
    { angle: -0.92, outerRadius: 0.86, halfWidth: 0.07, innerRadius: 0.43, fork: true },
    { angle: 0.42, outerRadius: 0.9, halfWidth: 0.08, innerRadius: 0.4, fork: true },
    { angle: 1.02, outerRadius: 0.74, halfWidth: 0.065, innerRadius: 0.31, fork: true },
  ]
  const groundPlates = [...primaryPlates, ...branchFissures]
  groundPlates.forEach(({ angle, outerRadius, halfWidth, innerRadius, fork }, plateIndex) => {
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const innerCenter = direction.clone().multiplyScalar(innerRadius)
    const outerCenter = direction.clone().multiplyScalar(outerRadius)
    const innerLeft = innerCenter.clone().addScaledVector(tangent, halfWidth * 0.52)
    const innerRight = innerCenter.clone().addScaledVector(tangent, -halfWidth * 0.52)
    const outerBias = (plateIndex % 2 === 0 ? 1 : -1) * halfWidth * (0.18 + plateIndex * 0.035)
    const outerHalfWidth = halfWidth * (0.18 + (plateIndex % 3) * 0.035)
    const outerLeft = outerCenter.clone().addScaledVector(tangent, outerBias + outerHalfWidth)
    const outerRight = outerCenter.clone().addScaledVector(tangent, outerBias - outerHalfWidth)
    const bottomY = 0.005
    const topY = (fork ? 0.026 : 0.045) + (plateIndex % 3) * 0.008
    const bottom = [innerLeft, innerRight, outerRight, outerLeft].map((point) => point.clone().setY(bottomY))
    const top = [innerLeft, innerRight, outerRight, outerLeft].map((point, index) => point.clone().setY(topY + (index >= 2 ? 0.018 : 0)))
    const topColor = plateIndex % 2 === 0 ? pale : cyan
    activePivot.set(0, bottomY, 0)
    activeRevealOrder = 0.18 + plateIndex * 0.075
    activeGroundMask = 1
    pushQuad(top[0]!, top[1]!, top[2]!, top[3]!, cyan, topColor)
    pushQuad(bottom[3]!, bottom[2]!, bottom[1]!, bottom[0]!, deep, deep)
    pushQuad(bottom[0]!, bottom[1]!, top[1]!, top[0]!, deep, blue)
    pushQuad(bottom[1]!, bottom[2]!, top[2]!, top[1]!, deep, cyan)
    pushQuad(bottom[2]!, bottom[3]!, top[3]!, top[2]!, deep, blue)
    pushQuad(bottom[3]!, bottom[0]!, top[0]!, top[3]!, deep, cyan)
  })

  // Keep the ballistic breakup silhouette while paying a single material draw:
  // copy the closed chip triangles into this buffer before normals are rebuilt.
  const embeddedChipGeometry = createPfxIceImpactChipGeometry()
  const embeddedChipPositions = embeddedChipGeometry.getAttribute('position')
  const embeddedChipColors = embeddedChipGeometry.getAttribute('color')
  const embeddedChipPivots = embeddedChipGeometry.getAttribute('pfxIcePivot')
  const embeddedChipRevealOrders = embeddedChipGeometry.getAttribute('pfxIceRevealOrder')
  for (let vertex = 0; vertex < embeddedChipPositions.count; vertex += 1) {
    positions.push(
      embeddedChipPositions.getX(vertex),
      embeddedChipPositions.getY(vertex),
      embeddedChipPositions.getZ(vertex),
    )
    colors.push(
      embeddedChipColors.getX(vertex),
      embeddedChipColors.getY(vertex),
      embeddedChipColors.getZ(vertex),
    )
    pivots.push(
      embeddedChipPivots.getX(vertex),
      embeddedChipPivots.getY(vertex),
      embeddedChipPivots.getZ(vertex),
    )
    revealOrders.push(embeddedChipRevealOrders.getX(vertex))
    groundMasks.push(0)
  }
  embeddedChipGeometry.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxIcePivot', new THREE.Float32BufferAttribute(pivots, 3))
  geometry.setAttribute('pfxIceRevealOrder', new THREE.Float32BufferAttribute(revealOrders, 1))
  geometry.setAttribute('pfxIceGroundMask', new THREE.Float32BufferAttribute(groundMasks, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxIceImpactGeometry'] = 'single-draw-grounded-closed-splinter-and-frost-plate-contact'
  geometry.userData['pfxIceImpactDrawCalls'] = 1
  geometry.userData['pfxIceImpactClosedFaces'] = true
  geometry.userData['pfxIceImpactWorldSpaceVolume'] = true
  geometry.userData['pfxIceImpactGrounded'] = true
  geometry.userData['pfxIceImpactHeroShardCount'] = heroShards.length
  geometry.userData['pfxIceImpactDetailShardCount'] = detailShards.length
  geometry.userData['pfxIceImpactTruncatedHeroShardCount'] = heroShards.length
  geometry.userData['pfxIceImpactGroundPlateCount'] = groundPlates.length
  geometry.userData['pfxIceImpactRimeForkCount'] = branchFissures.length
  geometry.userData['pfxIceImpactGroundContactModel'] = 'seven-primary-plates-four-branch-fissures'
  geometry.userData['pfxIceImpactEmbeddedChipCount'] = 7
  geometry.userData['pfxIceImpactAsymmetric'] = true
  const xHeroSlope = Math.abs(heroShards[0].direction[1] / heroShards[0].direction[0])
  const zHeroSlope = Math.abs(heroShards[3].direction[1] / heroShards[3].direction[2])
  geometry.userData['pfxIceImpactDirectionalAxisContrast'] = xHeroSlope / zHeroSlope
  geometry.userData['pfxIceImpactDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxIceImpactWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxIceImpactHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxIceImpactMaterial(
  opacity: number,
  primaryColor = '#7ddfff',
  secondaryColor = '#e9fcff',
  density = 0.56,
  styleEdgeHardness = 0.54,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vIceColor;
      varying vec3 vIceNormal;
      varying vec3 vIceViewPosition;
      varying float vIceHeight;
      varying float vIceGroundMask;
      attribute vec3 pfxIcePivot;
      attribute float pfxIceRevealOrder;
      attribute float pfxIceGroundMask;
      uniform float uOpacity;
      uniform float uCycle;
      void main() {
        float strikeBuild = smoothstep(0.015, 0.22, uCycle);
        float recoverySettle = smoothstep(0.42, 0.86, uCycle);
        float localFormation = smoothstep(
          pfxIceRevealOrder,
          min(1.0, pfxIceRevealOrder + 0.34),
          strikeBuild
        );
        localFormation *= mix(1.0 - recoverySettle * 0.42, 1.0, pfxIceGroundMask);
        vec3 localPosition = position - pfxIcePivot;
        vec3 transformed = pfxIcePivot + localPosition * mix(0.035, 1.0, localFormation);
        vec3 driftDirection = normalize(vec3(
          pfxIcePivot.x + position.x * 0.16 + 0.001,
          0.28 + pfxIceRevealOrder * 0.5,
          pfxIcePivot.z + position.z * 0.16 + 0.001
        ));
        transformed += driftDirection * recoverySettle * (1.0 - pfxIceGroundMask) * (0.05 + pfxIceRevealOrder * 0.13);
        transformed.y -= recoverySettle * recoverySettle * (1.0 - pfxIceGroundMask) * (0.025 + pfxIceRevealOrder * 0.08);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vIceColor = color;
        vIceNormal = normalize(normalMatrix * normal);
        vIceViewPosition = viewPosition.xyz;
        vIceHeight = transformed.y;
        vIceGroundMask = pfxIceGroundMask;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vIceColor;
      varying vec3 vIceNormal;
      varying vec3 vIceViewPosition;
      varying float vIceHeight;
      varying float vIceGroundMask;
      void main() {
        vec3 normal = normalize(vIceNormal);
        vec3 viewDirection = normalize(-vIceViewPosition);
        vec3 keyLight = normalize(vec3(-0.38, 0.84, 0.42));
        float facet = 0.38 + max(dot(normal, keyLight), 0.0) * 0.68;
        float fresnelBase = 1.0 - abs(dot(normal, viewDirection));
        float fresnel = fresnelBase * fresnelBase * mix(0.72, 1.18, uStyleEdgeHardness);
        vec3 reflected = reflect(-keyLight, normal);
        float specularBase = max(dot(reflected, viewDirection), 0.0);
        float specular2 = specularBase * specularBase;
        float specular4 = specular2 * specular2;
        float specular8 = specular4 * specular4;
        float specular = specular8 * specular8;
        float frost = 1.0 - smoothstep(0.04, 0.42, vIceHeight);
        vec3 controlledIceColor = mix(vIceColor, uPrimaryColor, 0.46);
        vec3 controlledRimeColor = mix(uPrimaryColor, uSecondaryColor, 0.68);
        vec3 ice = controlledIceColor * facet;
        ice += uPrimaryColor * fresnel * 0.96;
        ice += uSecondaryColor * specular * 1.12;
        ice += controlledRimeColor * frost * mix(0.24, 0.5, uDensity);
        ice += controlledIceColor * controlledIceColor * 0.26;
        float recoveryFrostHold = (1.0 - smoothstep(0.78, 0.96, uCycle)) * vIceGroundMask;
        float airborneRelease = smoothstep(0.38, 0.76, uCycle) * (1.0 - vIceGroundMask);
        float alpha = min(1.0, uOpacity * mix(1.0, 0.32, airborneRelease) * mix(1.0, 2.2, recoveryFrostHold));
        if (alpha < 0.18) discard;
        gl_FragColor = vec4(ice, alpha);
      }
    `,
  })
  material.userData['pfxIceImpactMaterial'] = 'fresnel-frost-grounded-cut-ice'
  material.userData['pfxIceImpactControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxIceImpactRecoveryModel'] = 'cycle-driven-intact-rime-settle'
  return material
}

export function applyPfxIceImpactAppearance(material: THREE.ShaderMaterial, opacity: number, cycle: number): void {
  material.uniforms['uOpacity']!.value = THREE.MathUtils.clamp(opacity, 0, 1)
  material.uniforms['uCycle']!.value = THREE.MathUtils.clamp(cycle, 0, 1)
}
