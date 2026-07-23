import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstLegGeometry(): THREE.BufferGeometry {
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
  const appendSegment = (start: THREE.Vector3, end: THREE.Vector3, startRadius: number, endRadius: number, direction: THREE.Vector3, seed: number, form: number, sides = 6) => {
    const segmentDirection = new THREE.Vector3().subVectors(end, start)
    const length = segmentDirection.length()
    segmentDirection.normalize()
    appendPrimitive(
      new THREE.CylinderGeometry(endRadius, startRadius, length, sides, 1, false),
      new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), segmentDirection),
      new THREE.Vector3(1, 1, 1),
      direction,
      seed,
      form,
    )
  }

  const legs = [
    { side: -1, z: 0.48, length: 1.02, lift: 0.34, depth: 0.28, seed: 0.06 },
    { side: -1, z: 0.2, length: 1.1, lift: 0.18, depth: 0.16, seed: 0.14 },
    { side: -1, z: -0.12, length: 1.16, lift: 0.02, depth: -0.12, seed: 0.22 },
    { side: -1, z: -0.42, length: 1.04, lift: -0.16, depth: -0.28, seed: 0.3 },
    { side: 1, z: 0.52, length: 1.08, lift: 0.28, depth: 0.32, seed: 0.38 },
    { side: 1, z: 0.18, length: 1.14, lift: 0.1, depth: 0.18, seed: 0.46 },
    { side: 1, z: -0.16, length: 1.2, lift: -0.04, depth: -0.14, seed: 0.54 },
    { side: 1, z: -0.46, length: 1.06, lift: -0.2, depth: -0.3, seed: 0.62 },
  ] as const
  let legSegmentCount = 0
  let legJointCount = 0
  let clawCount = 0
  legs.forEach((leg, index) => {
    const direction = new THREE.Vector3(leg.side, leg.lift, leg.depth).normalize()
    const root = new THREE.Vector3(leg.side * 0.34, 0.38 + leg.lift * 0.16, leg.z)
    const knee = root.clone().add(new THREE.Vector3(leg.side * leg.length * 0.48, 0.22 + leg.lift * 0.34, leg.depth * 0.52))
    const foot = knee.clone().add(new THREE.Vector3(leg.side * leg.length * 0.44, -0.28 + leg.lift * 0.18, leg.depth * 0.58))
    appendSegment(root, knee, 0.105, 0.075, direction, leg.seed, 0, 7)
    appendSegment(knee, foot, 0.075, 0.04, direction, leg.seed, 1, 7)
    legSegmentCount += 2
    appendPrimitive(
      new THREE.OctahedronGeometry(1, 0),
      knee,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.12, index * -0.08, 0)),
      new THREE.Vector3(0.115, 0.105, 0.11),
      direction,
      leg.seed,
      2,
    )
    legJointCount += 1
    const clawDirection = new THREE.Vector3(leg.side * 0.5, -0.72, leg.depth * 0.4).normalize()
    const clawEnd = foot.clone().addScaledVector(clawDirection, 0.2)
    appendSegment(foot, clawEnd, 0.055, 0.002, direction, leg.seed, 3, 6)
    clawCount += 1
  })

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
  geometry.userData['pfxShadowBurstLegDrawCalls'] = 1
  geometry.userData['pfxShadowBurstLegClosedFaces'] = true
  geometry.userData['pfxShadowBurstLegSmoothNormals'] = true
  geometry.userData['pfxShadowBurstLegBillboardCount'] = 0
  geometry.userData['pfxShadowBurstLegCount'] = legs.length
  geometry.userData['pfxShadowBurstLegSegmentCount'] = legSegmentCount
  geometry.userData['pfxShadowBurstLegJointCount'] = legJointCount
  geometry.userData['pfxShadowBurstClawCount'] = clawCount
  geometry.userData['pfxShadowBurstDistinctLegLengthCount'] = new Set(legs.map(({ length }) => length)).size
  geometry.userData['pfxShadowBurstCompleteRingCount'] = 0
  geometry.userData['pfxShadowBurstLegProfile'] = 'eight-asymmetric-world-space-two-bone-spider-legs-with-faceted-joints-and-tapered-claws'
  geometry.userData['pfxShadowBurstLegTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstLegWidthSpan'] = width
  geometry.userData['pfxShadowBurstLegDepthSpan'] = depth
  geometry.userData['pfxShadowBurstLegHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShadowBurstLegPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxShadowBurstLegMaterial(
  opacity: number,
  primaryColor = '#16082b',
  secondaryColor = '#7c3aed',
  accentColor = '#ede9fe',
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
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxShadowBurstCenter;
      attribute float pfxShadowBurstSeed;
      attribute vec3 pfxShadowBurstDirection;
      attribute float pfxShadowBurstForm;
      varying vec3 vHandNormal;
      varying vec3 vHandViewPosition;
      varying vec3 vHandLocal;
      varying float vHandSeed;
      varying float vHandForm;
      varying float vHandLife;
      void main() {
        float legUnfurl = smoothstep(0.07 + pfxShadowBurstSeed * 0.04, 0.34 + pfxShadowBurstSeed * 0.04, uCycle);
        float radialScuttle = smoothstep(0.14, 0.5, uCycle);
        float handRetreat = smoothstep(0.54 + pfxShadowBurstSeed * 0.025, 0.88 + pfxShadowBurstSeed * 0.02, uCycle);
        float fingerForm = step(1.5, pfxShadowBurstForm) * (1.0 - step(2.5, pfxShadowBurstForm));
        float nailForm = step(2.5, pfxShadowBurstForm);
        vec3 local = position - pfxShadowBurstCenter;
        local *= mix(vec3(0.3, 0.24, 0.3), vec3(1.0), mix(radialScuttle, legUnfurl, fingerForm + nailForm));
        local *= mix(1.0, 0.74, handRetreat);
        vec3 center = pfxShadowBurstCenter * mix(0.32, 1.0, radialScuttle);
        center += pfxShadowBurstDirection * radialScuttle * (0.18 + pfxShadowBurstSeed * 0.22);
        center -= pfxShadowBurstDirection * handRetreat * (0.04 + pfxShadowBurstSeed * 0.08);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHandNormal = normalize(normalMatrix * normal);
        vHandViewPosition = viewPosition.xyz;
        vHandLocal = local;
        vHandSeed = pfxShadowBurstSeed;
        vHandForm = pfxShadowBurstForm;
        float densityReveal = step(pfxShadowBurstSeed, 0.16 + uDensity * 0.84);
        float retirement = 1.0 - smoothstep(0.78 + pfxShadowBurstSeed * 0.02, 0.94 + pfxShadowBurstSeed * 0.015, uCycle);
        float recoveryGate = mix(1.0, 0.12, handRetreat);
        vHandLife = densityReveal * retirement * (0.46 + legUnfurl * 0.54) * recoveryGate;
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
      varying vec3 vHandNormal;
      varying vec3 vHandViewPosition;
      varying vec3 vHandLocal;
      varying float vHandSeed;
      varying float vHandForm;
      varying float vHandLife;
      void main() {
        vec3 normal = normalize(vHandNormal);
        vec3 viewDirection = normalize(-vHandViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.0, 0.68, uStyleEdgeHardness));
        float secondLegForm = step(0.5, vHandForm) * (1.0 - step(1.5, vHandForm));
        float jointForm = step(1.5, vHandForm) * (1.0 - step(2.5, vHandForm));
        float nailForm = step(2.5, vHandForm);
        vec3 keyDirection = normalize(vec3(-0.5, 0.7, 0.5));
        vec3 fillDirection = normalize(vec3(0.64, -0.08, -0.76));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float segmentedChitin = 0.52 + keyLight * 0.34 + fillLight * 0.24 + rim * 0.14;
        float jointSpecular = jointForm * pow(max(0.0, dot(normal, normalize(viewDirection + keyDirection))), 18.0);
        float segmentPulse = secondLegForm * (0.72 + 0.28 * sin(vHandSeed * 37.0 + uCycle * 19.0));
        float clawTipGlint = nailForm * (0.76 + rim * 0.24);
        vec3 color = mix(uPrimaryColor * 1.08, uSecondaryColor * 1.08, 0.48 + keyLight * 0.2 + fillLight * 0.08);
        color *= segmentedChitin;
        color += uSecondaryColor * rim * (0.58 + secondLegForm * 0.24);
        color += mix(uSecondaryColor, uAccentColor, 0.52) * jointSpecular * 0.68;
        color += uSecondaryColor * segmentPulse * secondLegForm * 0.18;
        color = mix(color, uAccentColor * 0.82 + uSecondaryColor * 0.34, clawTipGlint * 0.9);
        float alpha = uOpacity * vHandLife * (0.64 + facing * 0.2 + rim * 0.16);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'legs'
  material.userData['pfxShadowBurstMaterialProfile'] = 'segmented-violet-chitin-with-faceted-joints-and-cold-claw-tips'
  return material
}
