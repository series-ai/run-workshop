import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstBloomGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const appendPrimitive = (source: THREE.BufferGeometry, center: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, direction: THREE.Vector3, seed: number, form: number) => {
    const raw = source.index ? source.toNonIndexed() : source
    const position = raw.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      directions.push(direction.x, direction.y, direction.z)
      forms.push(form)
    }
    if (raw !== source) raw.dispose()
    source.dispose()
  }
  const appendSegment = (start: THREE.Vector3, end: THREE.Vector3, startRadius: number, endRadius: number, direction: THREE.Vector3, seed: number, form: number) => {
    const segmentDirection = new THREE.Vector3().subVectors(end, start)
    const length = segmentDirection.length()
    segmentDirection.normalize()
    const capsuleRadius = (startRadius + endRadius) * 0.5
    appendPrimitive(
      new THREE.CapsuleGeometry(capsuleRadius, Math.max(0.01, length - capsuleRadius * 2), 1, 6),
      new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), segmentDirection),
      new THREE.Vector3(1, 1, 1),
      direction,
      seed,
      form,
    )
  }

  const coreLobes = [
    { center: new THREE.Vector3(0, 0.42, 0), scale: new THREE.Vector3(0.5, 0.46, 0.48), seed: 0.06 },
    { center: new THREE.Vector3(-0.2, 0.35, -0.1), scale: new THREE.Vector3(0.3, 0.32, 0.31), seed: 0.14 },
    { center: new THREE.Vector3(0.2, 0.48, 0.08), scale: new THREE.Vector3(0.28, 0.3, 0.29), seed: 0.22 },
  ] as const
  coreLobes.forEach((lobe, index) => appendPrimitive(
    new THREE.IcosahedronGeometry(1, index === 0 ? 2 : 1),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.11, index * -0.16, index * 0.08)),
    lobe.scale,
    new THREE.Vector3(0, 0, 0),
    lobe.seed,
    0,
  ))

  const origin = new THREE.Vector3(0, 0.42, 0)
  const petals = Array.from({ length: 10 }, (_, index) => {
    const angle = index / 10 * Math.PI * 2 + (index % 2 === 0 ? -0.14 : 0.19)
    const z = ((index * 3) % 7 - 3) * 0.24
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 0.72 + (index % 3 - 1) * 0.1, z).normalize()
    return { direction, seed: 0.08 + index * 0.075, length: 0.72 + (index % 4) * 0.065 }
  })
  const petalCurveOffset = 0.48
  let petalSegmentCount = 0
  petals.forEach((petal, index) => {
    const reference = Math.abs(petal.direction.y) > 0.82 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const curl = new THREE.Vector3().crossVectors(petal.direction, reference).normalize().multiplyScalar(index % 2 === 0 ? 1 : -1)
    const start = origin.clone().addScaledVector(petal.direction, 0.2)
    const middle = origin.clone().addScaledVector(petal.direction, petal.length * 0.48).addScaledVector(curl, petalCurveOffset * 0.42 + (index % 3) * 0.025)
    const end = origin.clone().addScaledVector(petal.direction, petal.length * 0.74).addScaledVector(curl, petalCurveOffset + (index % 3) * 0.045)
    appendSegment(start, middle, 0.078, 0.055, petal.direction, petal.seed, 1)
    appendSegment(middle, end, 0.055, 0.012, petal.direction, petal.seed, 1)
    petalSegmentCount += 2
  })

  const crackPieces = [
    { center: new THREE.Vector3(-0.13, 0.53, 0.45), rotation: -0.72, scale: new THREE.Vector3(0.025, 0.11, 0.018), seed: 0.1, direction: new THREE.Vector3(0, 0, 1) },
    { center: new THREE.Vector3(0.43, 0.46, 0.08), rotation: 0.38, scale: new THREE.Vector3(0.022, 0.1, 0.018), seed: 0.22, direction: new THREE.Vector3(1, 0, 0) },
    { center: new THREE.Vector3(-0.4, 0.31, -0.04), rotation: -0.46, scale: new THREE.Vector3(0.02, 0.09, 0.016), seed: 0.34, direction: new THREE.Vector3(-1, 0, 0) },
    { center: new THREE.Vector3(0.06, 0.27, -0.43), rotation: 0.64, scale: new THREE.Vector3(0.02, 0.085, 0.016), seed: 0.46, direction: new THREE.Vector3(0, 0, -1) },
  ] as const
  crackPieces.forEach((piece) => appendPrimitive(
    new THREE.BoxGeometry(1, 1, 1),
    piece.center,
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), piece.direction).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, piece.rotation))),
    piece.scale,
    piece.direction,
    piece.seed,
    2,
  ))

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxShadowBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxShadowBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxShadowBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxShadowBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  const depth = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxShadowBurstBloomDrawCalls'] = 1
  geometry.userData['pfxShadowBurstBloomClosedFaces'] = true
  geometry.userData['pfxShadowBurstBloomSmoothNormals'] = true
  geometry.userData['pfxShadowBurstBillboardCount'] = 0
  geometry.userData['pfxShadowBurstCoreLobeCount'] = coreLobes.length
  geometry.userData['pfxShadowBurstPetalCount'] = petals.length
  geometry.userData['pfxShadowBurstPetalSegmentCount'] = petalSegmentCount
  geometry.userData['pfxShadowBurstPetalCurveOffset'] = petalCurveOffset
  geometry.userData['pfxShadowBurstPetalPrimitive'] = 'overlapping-rounded-capsule-hooks'
  geometry.userData['pfxShadowBurstCrackPieceCount'] = crackPieces.length
  geometry.userData['pfxShadowBurstCompleteRingCount'] = 0
  geometry.userData['pfxShadowBurstBloomProfile'] = 'three-lobe-compressed-void-core-with-ten-asymmetric-two-segment-hook-tendrils-and-four-subtle-rift-seams'
  geometry.userData['pfxShadowBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxShadowBurstBloomTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstBloomWidthSpan'] = width
  geometry.userData['pfxShadowBurstBloomDepthSpan'] = depth
  geometry.userData['pfxShadowBurstBloomHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShadowBurstBloomPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxShadowBurstBloomMaterial(
  opacity: number,
  primaryColor = '#020106',
  secondaryColor = '#5b21b6',
  accentColor = '#ddd6fe',
  density = 0.58,
  styleEdgeHardness = 0.66,
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
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxShadowBurstCenter;
      attribute float pfxShadowBurstSeed;
      attribute vec3 pfxShadowBurstDirection;
      attribute float pfxShadowBurstForm;
      varying vec3 vShadowNormal;
      varying vec3 vShadowViewPosition;
      varying vec3 vShadowLocal;
      varying float vShadowSeed;
      varying float vShadowForm;
      varying float vShadowLife;
      void main() {
        float coreForm = 1.0 - step(0.5, pfxShadowBurstForm);
        float petalForm = step(0.5, pfxShadowBurstForm) * (1.0 - step(1.5, pfxShadowBurstForm));
        float crackForm = step(1.5, pfxShadowBurstForm);
        float umbraCompression = smoothstep(0.0, 0.075, uCycle);
        float petalRupture = smoothstep(0.065 + pfxShadowBurstSeed * 0.018, 0.31 + pfxShadowBurstSeed * 0.025, uCycle);
        float shadowDisperse = smoothstep(0.43, 0.9, uCycle);
        vec3 origin = vec3(0.0, 0.42, 0.0);
        vec3 local = position - pfxShadowBurstCenter;
        float coreScale = mix(0.42, 1.0, umbraCompression) * mix(1.0, 0.48, shadowDisperse);
        float petalScale = mix(0.14, 1.0, petalRupture) * mix(1.0, 0.42, shadowDisperse);
        float crackScale = mix(0.18, 1.0, smoothstep(0.055, 0.2, uCycle)) * mix(1.0, 0.46, shadowDisperse);
        local *= coreScale * coreForm + petalScale * petalForm + crackScale * crackForm;
        float centerReveal = coreForm * umbraCompression + petalForm * petalRupture + crackForm * smoothstep(0.06, 0.2, uCycle);
        vec3 center = mix(origin, pfxShadowBurstCenter, centerReveal);
        center += pfxShadowBurstDirection * shadowDisperse * (0.06 + pfxShadowBurstSeed * 0.18) * (petalForm + crackForm);
        center.y += sin(pfxShadowBurstSeed * 31.0 + uCycle * 12.0) * shadowDisperse * 0.035 * petalForm;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vShadowNormal = normalize(normalMatrix * normal);
        vShadowViewPosition = viewPosition.xyz;
        vShadowLocal = local;
        vShadowSeed = pfxShadowBurstSeed;
        vShadowForm = pfxShadowBurstForm;
        float birth = smoothstep(0.0, 0.03 + pfxShadowBurstSeed * 0.008, uCycle);
        float retirement = 1.0 - smoothstep(0.43 + pfxShadowBurstSeed * 0.018, 0.69, uCycle);
        float densityLift = mix(0.82, 1.0, uDensity);
        vShadowLife = birth * retirement * densityLift;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAccentColor;
      uniform float uStyleEdgeHardness;
      varying vec3 vShadowNormal;
      varying vec3 vShadowViewPosition;
      varying vec3 vShadowLocal;
      varying float vShadowSeed;
      varying float vShadowForm;
      varying float vShadowLife;
      void main() {
        vec3 normal = normalize(vShadowNormal);
        vec3 viewDirection = normalize(-vShadowViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.15, 0.72, uStyleEdgeHardness));
        float petalForm = step(0.5, vShadowForm) * (1.0 - step(1.5, vShadowForm));
        float crackForm = step(1.5, vShadowForm);
        float coreForm = 1.0 - max(petalForm, crackForm);
        vec3 keyDirection = normalize(vec3(-0.48, 0.72, 0.5));
        vec3 fillDirection = normalize(vec3(0.66, -0.08, -0.74));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float softShadowFalloff = 0.18 + keyLight * 0.24 + fillLight * 0.14 + facing * 0.06;
        float volumetricPetalRim = petalForm * rim * (0.72 + 0.28 * sin(vShadowSeed * 41.0 + uCycle * 9.0));
        float coldCrackEmission = crackForm * (0.72 + 0.16 * sin(vShadowSeed * 53.0 + uCycle * 21.0));
        float innerUmbra = coreForm * (1.0 - smoothstep(0.04, 0.5, length(vShadowLocal))) * 0.28;
        vec3 color = mix(uPrimaryColor * 1.12, uSecondaryColor * 0.68, softShadowFalloff);
        color += uSecondaryColor * (rim * 1.12 + volumetricPetalRim * 1.04);
        color += mix(uSecondaryColor, uAccentColor, 0.24) * coldCrackEmission * 0.38;
        color += uAccentColor * keyLight * petalForm * 0.08;
        color = mix(color, uPrimaryColor * 0.28, innerUmbra);
        float alpha = uOpacity * vShadowLife * (0.6 + facing * 0.2 + rim * 0.2);
        alpha *= mix(1.0, 0.92, crackForm);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'umbra-bloom'
  material.userData['pfxShadowBurstMaterialProfile'] = 'soft-volumetric-umbra-core-with-violet-petal-rims-and-cold-crack-emission'
  return material
}
