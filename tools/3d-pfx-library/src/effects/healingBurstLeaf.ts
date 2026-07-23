import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxHealingBurstLeafGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  // Fewer, larger motes: at gameplay camera distance a scatter of tiny
  // sub-0.1-unit meshes resolves as sprite-like clutter no matter how closed
  // the topology is, and it buries the golden core focal read.
  const leafCount = 16
  const up = new THREE.Vector3(0, 1, 0)
  for (let leaf = 0; leaf < leafCount; leaf += 1) {
    const seed = ((leaf * 43 + 17) % 103) / 103
    const strand = leaf % 2
    const progress = Math.floor(leaf / 2) / 7
    const angle = strand * Math.PI + progress * Math.PI * 5
    const radius = 0.34 + Math.sin(progress * Math.PI) * 0.48
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.28 + progress * 1.25, Math.sin(angle) * radius)
    const direction = new THREE.Vector3(-Math.sin(angle) * 0.44, 0.84, Math.cos(angle) * 0.44).normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction)
    const species = leaf % 3
    // Species 0 is a small 3D heal cross (three closed orthogonal boxes) so
    // the rising volume carries the same semantic glyph as the crown; the
    // others are soft light motes and diamond sparks.
    const sources: THREE.BufferGeometry[] = species === 0
      ? [
          new THREE.BoxGeometry(0.34, 0.115, 0.115),
          new THREE.BoxGeometry(0.115, 0.34, 0.115),
          new THREE.BoxGeometry(0.115, 0.115, 0.34),
        ]
      : species === 1
        ? [new THREE.IcosahedronGeometry(1, 0)]
        : [new THREE.OctahedronGeometry(1, 0)]
    const scale = species === 0
      ? new THREE.Vector3(1, 1, 1)
      : species === 1
        ? new THREE.Vector3(0.12, 0.13 + (leaf % 2) * 0.025, 0.12)
        : new THREE.Vector3(0.115, 0.2 + (leaf % 2) * 0.022, 0.09)
    for (const source of sources) {
      const raw = source.index ? source.toNonIndexed() : source
      const attribute = raw.getAttribute('position')
      for (let vertex = 0; vertex < attribute.count; vertex += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(attribute, vertex).multiply(scale).applyQuaternion(rotation).add(center)
        positions.push(point.x, point.y, point.z)
        centers.push(center.x, center.y, center.z)
        seeds.push(seed)
        directions.push(direction.x, direction.y, direction.z)
      }
      if (raw !== source) raw.dispose()
      source.dispose()
    }
  }
  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxHealingBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxHealingBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxHealingBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxHealingBurstLeafDrawCalls'] = 1
  geometry.userData['pfxHealingBurstLeafClosedFaces'] = true
  geometry.userData['pfxHealingBurstLeafSmoothNormals'] = true
  geometry.userData['pfxHealingBurstLeafCount'] = leafCount
  geometry.userData['pfxHealingBurstLeafSpeciesCount'] = 3
  geometry.userData['pfxHealingBurstLeafSpeciesProfile'] = 'plus-cross-soft-orb-and-diamond-spark-motes'
  geometry.userData['pfxHealingBurstLeafSizeRange'] = [0.09, 0.34]
  geometry.userData['pfxHealingBurstLeafDepthLayerCount'] = 8
  geometry.userData['pfxHealingBurstLeafSpiralTurns'] = 2.5
  geometry.userData['pfxHealingBurstRecoveryHeightRatio'] = 1.4
  geometry.userData['pfxHealingBurstFountainEnvelope'] = 'symmetric-double-helix-inside-tapered-arch'
  geometry.userData['pfxHealingBurstLeafBillboardCount'] = 0
  geometry.userData['pfxHealingBurstLeafTopology'] = 'closed-plus-crosses-and-light-motes-in-rising-double-helix'
  geometry.userData['pfxHealingBurstLeafTriangleCount'] = positions.length / 9
  return geometry
}

export function createPfxHealingBurstLeafMaterial(
  opacity: number,
  primaryColor = '#37d982',
  secondaryColor = '#ffd166',
  accentColor = '#b7f7d0',
  density = 0.52,
  styleEdgeHardness = 0.48,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uAccentColor: { value: new THREE.Color(accentColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxHealingBurstCenter;
      attribute float pfxHealingBurstSeed;
      attribute vec3 pfxHealingBurstDirection;
      varying vec3 vHealingLeafNormal;
      varying vec3 vHealingLeafViewPosition;
      varying vec3 vHealingLeafLocalPosition;
      varying float vHealingLeafSeed;
      varying float vHealingLeafLife;
      void main() {
        float restorativeLift = smoothstep(0.1 + pfxHealingBurstSeed * 0.05, 0.48 + pfxHealingBurstSeed * 0.04, uCycle);
        float recoveryAscent = smoothstep(0.62 + pfxHealingBurstSeed * 0.025, 0.86 + pfxHealingBurstSeed * 0.03, uCycle);
        float cappedRecoveryAscent = recoveryAscent * (0.3 + pfxHealingBurstSeed * 0.2);
        float doubleHelixTurn = uCycle * 3.4 + pfxHealingBurstSeed * 2.2;
        float gentleLeafDrift = sin(uCycle * 8.0 + pfxHealingBurstSeed * 29.0) * 0.08;
        float fountainBoundaryArc = smoothstep(0.12, 0.72, pfxHealingBurstCenter.y) * (1.0 - smoothstep(1.12, 1.72, pfxHealingBurstCenter.y));
        vec3 local = position - pfxHealingBurstCenter;
        mat2 rotation = mat2(cos(doubleHelixTurn), -sin(doubleHelixTurn), sin(doubleHelixTurn), cos(doubleHelixTurn));
        local.xz = rotation * local.xz;
        local *= mix(vec3(0.5, 0.62, 0.5), vec3(1.0), restorativeLift);
        vec3 center = pfxHealingBurstCenter * mix(0.18, 1.0, restorativeLift);
        center.y += restorativeLift * (0.18 + pfxHealingBurstSeed * 0.38);
        center.y += cappedRecoveryAscent;
        center.xz *= 1.0 + recoveryAscent * 0.22;
        center.xz *= 0.96 + fountainBoundaryArc * 0.04;
        center.xz += pfxHealingBurstDirection.xz * gentleLeafDrift;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHealingLeafNormal = normalize(normalMatrix * normal);
        vHealingLeafViewPosition = viewPosition.xyz;
        vHealingLeafLocalPosition = local;
        vHealingLeafSeed = pfxHealingBurstSeed;
        float semanticDensityFloor = 0.22;
        float densityReveal = step(pfxHealingBurstSeed, semanticDensityFloor + uDensity * (1.0 - semanticDensityFloor));
        float persistentRecoveryLeaf = 1.0 - smoothstep(0.44 + pfxHealingBurstSeed * 0.03, 0.74 + pfxHealingBurstSeed * 0.04, uCycle);
        vHealingLeafLife = persistentRecoveryLeaf * densityReveal;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAccentColor;
      uniform float uStyleEdgeHardness;
      varying vec3 vHealingLeafNormal;
      varying vec3 vHealingLeafViewPosition;
      varying vec3 vHealingLeafLocalPosition;
      varying float vHealingLeafSeed;
      varying float vHealingLeafLife;
      void main() {
        vec3 normal = normalize(vHealingLeafNormal);
        vec3 viewDirection = normalize(-vHealingLeafViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float leafVeinGlow = smoothstep(0.58, 0.9, 0.5 + 0.5 * sin(vHealingLeafLocalPosition.y * 24.0 + vHealingLeafSeed * 37.0));
        float goldenTipReceipt = smoothstep(0.06, 0.24, vHealingLeafLocalPosition.y) * (0.7 + facing * 0.3);
        float rim = pow(1.0 - facing, mix(1.7, 0.68, uStyleEdgeHardness));
        float saturationPreservingLeafMix = 0.32 + leafVeinGlow * 0.28;
        vec3 color = mix(uPrimaryColor * 0.92, uSecondaryColor * 0.85, saturationPreservingLeafMix);
        color += uSecondaryColor * goldenTipReceipt * 0.22;
        color += uAccentColor * rim * (0.08 + uStyleEdgeHardness * 0.12);
        float postLightGoldenLeaf = 0.42 + leafVeinGlow * 0.18;
        color += uPrimaryColor * (0.06 + facing * 0.08) + uSecondaryColor * postLightGoldenLeaf * 0.24;
        float accentLeafAlternation = step(0.42, vHealingLeafSeed) * (1.0 - step(0.78, vHealingLeafSeed));
        float healingSemanticAccentLock = accentLeafAlternation * 0.58;
        color = mix(color, uAccentColor * 0.82, healingSemanticAccentLock);
        float decayVisibilityFloor = 0.18 + leafVeinGlow * 0.08;
        color += mix(uPrimaryColor, uSecondaryColor, 0.38) * decayVisibilityFloor;
        float alpha = uOpacity * vHealingLeafLife * (0.52 + facing * 0.16 + rim * 0.18);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxHealingBurstMaterial'] = true
  material.userData['pfxHealingBurstMaterialRole'] = 'leaves'
  material.userData['pfxHealingBurstMaterialProfile'] = 'rising-mint-leaves-with-golden-restoration-tips'
  return material
}
