import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHealingLoopLifecycle(cycle: number): {
  energy: number
  renewal: number
  rise: number
  grounding: number
  stage: 'inhale' | 'crest' | 'release' | 'recover'
} {
  const phase = ((cycle % 1) + 1) % 1
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.2) {
    const inhale = smooth(phase / 0.2)
    return { energy: roundMetric(0.72 + inhale * 0.18), renewal: roundMetric(0.38 + inhale * 0.34), rise: roundMetric(0.3 + inhale * 0.24), grounding: 1, stage: 'inhale' }
  }
  if (phase < 0.45) {
    const crest = smooth((phase - 0.2) / 0.25)
    return { energy: roundMetric(0.9 + crest * 0.1), renewal: roundMetric(0.82 + crest * 0.18), rise: roundMetric(0.58 + crest * 0.32), grounding: roundMetric(1 - crest * 0.08), stage: 'crest' }
  }
  if (phase < 0.72) {
    const release = smooth((phase - 0.45) / 0.27)
    return { energy: roundMetric(1 - release * 0.16), renewal: roundMetric(1 - release * 0.26), rise: roundMetric(0.9 - release * 0.16), grounding: roundMetric(0.92 + release * 0.08), stage: 'release' }
  }
  const recover = smooth((phase - 0.72) / 0.28)
  return { energy: roundMetric(0.84 - recover * 0.12), renewal: roundMetric(0.74 - recover * 0.36), rise: roundMetric(0.74 - recover * 0.44), grounding: 1, stage: 'recover' }
}

export function createPfxHealingLoopGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const baseSegmentCount = 16
  const strandCount = 2
  const strandSegmentCount = 8
  const glyphCount = 4
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    form: 0 | 1 | 2,
    seed: number,
    paletteIndex: number,
  ) => {
    const source = primitive.index ? primitive.toNonIndexed() : primitive
    const sourcePositions = source.getAttribute('position')
    const sourceNormals = source.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < sourcePositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(sourceNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (source !== primitive) source.dispose()
  }

  const sanctuary = new THREE.TorusGeometry(0.82, 0.085, 4, baseSegmentCount)
  appendPrimitive(sanctuary, new THREE.Matrix4().makeRotationX(Math.PI / 2), 0, 0.16, 0)
  sanctuary.dispose()

  const up = new THREE.Vector3(0, 1, 0)
  for (let strand = 0; strand < strandCount; strand += 1) {
    const points: THREE.Vector3[] = []
    for (let node = 0; node <= strandSegmentCount; node += 1) {
      const progress = node / strandSegmentCount
      const angle = strand * Math.PI + progress * Math.PI * 2.5
      const radius = 0.5 - progress * 0.16
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0.08 + progress * 1.48,
        Math.sin(angle) * radius,
      ))
    }
    for (let segment = 0; segment < strandSegmentCount; segment += 1) {
      const start = points[segment]!
      const end = points[segment + 1]!
      const direction = end.clone().sub(start)
      const length = direction.length()
      const primitive = new THREE.CylinderGeometry(0.045, 0.065, length, 4, 1, false)
      const matrix = new THREE.Matrix4().compose(
        start.clone().add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()),
        new THREE.Vector3(1, 1, 1),
      )
      appendPrimitive(primitive, matrix, 1, strand * 0.5 + segment / strandSegmentCount * 0.48, strand + 1)
      primitive.dispose()
    }
  }

  const glyphBox = new THREE.BoxGeometry(1, 1, 1)
  for (let glyphIndex = 0; glyphIndex < glyphCount; glyphIndex += 1) {
    const seed = 0.12 + glyphIndex * 0.23
    const angle = glyphIndex * 2.18 + 0.42
    const radius = 0.42 + (glyphIndex % 2) * 0.1
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.38 + glyphIndex * 0.32, Math.sin(angle) * radius)
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle + Math.PI / 2, 0))
    appendPrimitive(
      glyphBox,
      new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(0.09, 0.3, 0.07)),
      2,
      seed,
      3,
    )
    appendPrimitive(
      glyphBox,
      new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(0.27, 0.1, 0.07)),
      2,
      seed,
      3,
    )
  }
  glyphBox.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxHealingLoopForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxHealingLoopSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxHealingLoopPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.76, 0), 1.35)
  geometry.userData['pfxHealingLoopDrawCalls'] = 1
  geometry.userData['pfxHealingLoopClosedFaces'] = true
  geometry.userData['pfxHealingLoopBillboardCount'] = 0
  geometry.userData['pfxHealingLoopBaseSegmentCount'] = baseSegmentCount
  geometry.userData['pfxHealingLoopStrandCount'] = strandCount
  geometry.userData['pfxHealingLoopStrandSegmentCount'] = strandSegmentCount
  geometry.userData['pfxHealingLoopGlyphCount'] = glyphCount
  geometry.userData['pfxHealingLoopWorldPlane'] = 'xz-grounded'
  geometry.userData['pfxHealingLoopSilhouetteProfile'] = 'sanctuary-torus-with-double-renewal-helix-and-cross-glyphs'
  geometry.userData['pfxHealingLoopPalette'] = 'deep-emerald-mint-warm-renewal-gold'
  geometry.userData['pfxHealingLoopAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxHealingLoopTriangleCount'] = positions.length / 9
  geometry.userData['pfxHealingLoopWidthSpan'] = 1.82
  geometry.userData['pfxHealingLoopDepthSpan'] = 1.82
  geometry.userData['pfxHealingLoopHeightSpan'] = 1.62
  return geometry
}

export function createPfxHealingLoopMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute float pfxHealingLoopForm;
      attribute float pfxHealingLoopSeed;
      attribute float pfxHealingLoopPaletteIndex;
      varying vec3 vHealingNormal;
      varying vec3 vHealingViewPosition;
      varying float vHealingForm;
      varying float vHealingPaletteIndex;
      varying float vHealingPulse;
      varying float vHealingSeed;
      vec3 rotateHealingAroundY(vec3 value, float sine, float cosine) {
        return vec3(value.x * cosine + value.z * sine, value.y, -value.x * sine + value.z * cosine);
      }
      void main() {
        float groundMask = 1.0 - step(0.5, pfxHealingLoopForm);
        float strandMask = step(0.5, pfxHealingLoopForm) * (1.0 - step(1.5, pfxHealingLoopForm));
        float glyphMask = step(1.5, pfxHealingLoopForm);
        float renewalTriangle = 1.0 - abs(fract(uCycle + 0.25) * 2.0 - 1.0);
        float renewalPulse = renewalTriangle * renewalTriangle * (3.0 - 2.0 * renewalTriangle);
        float rotationAngle = uCycle * mix(2.2619467, 3.1415927, glyphMask) * (strandMask + glyphMask);
        float rotationSine = sin(rotationAngle);
        float rotationCosine = cos(rotationAngle);
        vec3 groundPosition = position;
        groundPosition.xz *= 0.96 + renewalPulse * 0.06;
        groundPosition.y += renewalPulse * 0.018;
        vec3 rotatedPosition = rotateHealingAroundY(position, rotationSine, rotationCosine);
        float interwovenPhase = fract(position.y * 0.43 - uCycle + pfxHealingLoopSeed * 0.5);
        float interwovenRise = (1.0 - abs(interwovenPhase * 2.0 - 1.0)) * 2.0 - 1.0;
        float glyphBob = (1.0 - abs(fract(uCycle + pfxHealingLoopSeed) * 2.0 - 1.0)) * 2.0 - 1.0;
        rotatedPosition.y += interwovenRise * 0.026 * strandMask + glyphBob * 0.055 * glyphMask;
        rotatedPosition.xz *= 1.0 + renewalPulse * 0.035 * strandMask;
        vec3 transformed = mix(groundPosition, rotatedPosition, strandMask + glyphMask);
        vec3 rotatedNormal = rotateHealingAroundY(normal, rotationSine, rotationCosine);
        vec3 animatedNormal = mix(normal, rotatedNormal, strandMask + glyphMask);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHealingNormal = normalize(normalMatrix * animatedNormal);
        vHealingViewPosition = viewPosition.xyz;
        vHealingForm = pfxHealingLoopForm;
        vHealingPaletteIndex = pfxHealingLoopPaletteIndex;
        vHealingPulse = renewalPulse;
        vHealingSeed = pfxHealingLoopSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vHealingNormal;
      varying vec3 vHealingViewPosition;
      varying float vHealingForm;
      varying float vHealingPaletteIndex;
      varying float vHealingPulse;
      varying float vHealingSeed;
      void main() {
        vec3 normal = normalize(vHealingNormal);
        vec3 viewDirection = normalize(-vHealingViewPosition);
        vec3 keyLight = normalize(vec3(-0.3, 0.88, 0.38));
        float renewalBody = 0.58 + max(0.0, dot(normal, keyLight)) * 0.48;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float sanctuaryMeniscus = rim * rim;
        float calmSpecular = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        calmSpecular *= calmSpecular;
        calmSpecular *= calmSpecular;
        calmSpecular *= calmSpecular;
        float groundMask = 1.0 - step(0.5, vHealingForm);
        float strandMask = step(0.5, vHealingForm) * (1.0 - step(1.5, vHealingForm));
        float glyphMask = step(1.5, vHealingForm);
        vec3 deepEmerald = vec3(0.015, 0.22, 0.12);
        vec3 healingGreen = vec3(0.12, 0.7, 0.34);
        vec3 renewalMint = vec3(0.48, 1.0, 0.7);
        vec3 renewalGold = vec3(1.0, 0.82, 0.28);
        vec3 healingPalette = mix(healingGreen, renewalMint, step(1.5, vHealingPaletteIndex));
        healingPalette = mix(healingPalette, renewalGold, step(2.5, vHealingPaletteIndex));
        vec3 groundPigment = mix(deepEmerald, healingGreen, 0.54 + vHealingPulse * 0.16) * renewalBody;
        groundPigment += renewalMint * sanctuaryMeniscus * 0.36;
        vec3 strandPigment = healingPalette * renewalBody * (0.92 + vHealingSeed * 0.1);
        strandPigment += renewalMint * sanctuaryMeniscus * 0.28;
        vec3 glyphPigment = mix(renewalGold, vec3(1.0, 1.0, 0.82), 0.42 + calmSpecular * 0.46) * renewalBody;
        glyphPigment += renewalMint * sanctuaryMeniscus * 0.22;
        vec3 pigment = groundPigment * groundMask + strandPigment * strandMask + glyphPigment * glyphMask;
        pigment += vec3(0.9, 1.0, 0.82) * calmSpecular * mix(0.18, 0.44, glyphMask);
        float coverage = mix(0.88, 0.98, strandMask + glyphMask) * (0.9 + vHealingPulse * 0.1);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxHealingLoopMaterial'] = true
  material.userData['pfxHealingLoopMaterialProfile'] = 'faceted-emerald-mint-helix-with-warm-healing-glyphs'
  material.userData['pfxHealingLoopFragmentTranscendentalOps'] = 0
  material.userData['pfxHealingLoopAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
