import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstSpiderGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendPrimitive = (source: THREE.BufferGeometry, center: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, seed: number, form: number) => {
    const raw = source.index ? source.toNonIndexed() : source
    const position = raw.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (raw !== source) raw.dispose()
    source.dispose()
  }
  const bodyLobes = [
    { center: new THREE.Vector3(0, 0.43, -0.42), scale: new THREE.Vector3(0.56, 0.48, 0.72), seed: 0.08 },
    { center: new THREE.Vector3(0, 0.38, 0.22), scale: new THREE.Vector3(0.48, 0.34, 0.46), seed: 0.18 },
    { center: new THREE.Vector3(0, 0.38, 0.62), scale: new THREE.Vector3(0.34, 0.27, 0.3), seed: 0.28 },
  ] as const
  bodyLobes.forEach((lobe, index) => appendPrimitive(
    index === 0 ? new THREE.IcosahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, 0),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06 * index, -0.11 * index, 0.08 * (index - 1))),
    lobe.scale,
    lobe.seed,
    0,
  ))

  appendPrimitive(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.Vector3(0, 0.16, 0.1),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
    new THREE.Vector3(0.3, 0.08, 0.38),
    0.16,
    1,
  )

  const coldEyes = [
    new THREE.Vector3(-0.2, 0.47, 0.88), new THREE.Vector3(0, 0.5, 0.9), new THREE.Vector3(0.2, 0.47, 0.88),
    new THREE.Vector3(-0.16, 0.34, 0.89), new THREE.Vector3(0, 0.32, 0.91), new THREE.Vector3(0.16, 0.34, 0.89),
  ] as const
  coldEyes.forEach((center, index) => appendPrimitive(
    new THREE.SphereGeometry(1, 7, 5),
    center,
    new THREE.Quaternion(),
    new THREE.Vector3(index === 1 || index === 4 ? 0.055 : 0.046, 0.038, 0.028),
    0.08 + index * 0.1,
    2,
  ))

  const fangs = [
    { center: new THREE.Vector3(-0.14, 0.24, 0.83), direction: new THREE.Vector3(-0.08, -0.62, 0.78).normalize(), seed: 0.2 },
    { center: new THREE.Vector3(0.14, 0.24, 0.83), direction: new THREE.Vector3(0.08, -0.62, 0.78).normalize(), seed: 0.38 },
  ] as const
  fangs.forEach((fang) => appendPrimitive(
    new THREE.ConeGeometry(0.075, 0.3, 6, 1, false),
    fang.center,
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fang.direction),
    new THREE.Vector3(1, 1, 1),
    fang.seed,
    3,
  ))

  const ruptureShards = [
    { center: new THREE.Vector3(-0.44, 0.64, 0.3), direction: new THREE.Vector3(-0.78, 0.45, 0.42).normalize(), length: 0.3, seed: 0.08 },
    { center: new THREE.Vector3(0.45, 0.61, 0.26), direction: new THREE.Vector3(0.82, 0.38, 0.43).normalize(), length: 0.34, seed: 0.16 },
    { center: new THREE.Vector3(-0.47, 0.38, -0.12), direction: new THREE.Vector3(-0.88, -0.08, 0.47).normalize(), length: 0.28, seed: 0.24 },
    { center: new THREE.Vector3(0.49, 0.36, -0.18), direction: new THREE.Vector3(0.84, -0.18, -0.51).normalize(), length: 0.32, seed: 0.32 },
    { center: new THREE.Vector3(-0.28, 0.72, -0.58), direction: new THREE.Vector3(-0.5, 0.62, -0.6).normalize(), length: 0.29, seed: 0.4 },
    { center: new THREE.Vector3(0.31, 0.74, -0.62), direction: new THREE.Vector3(0.48, 0.58, -0.66).normalize(), length: 0.31, seed: 0.48 },
    { center: new THREE.Vector3(0, 0.86, -0.12), direction: new THREE.Vector3(0.08, 0.96, 0.26).normalize(), length: 0.36, seed: 0.56 },
    { center: new THREE.Vector3(0.04, 0.16, -0.3), direction: new THREE.Vector3(-0.06, -0.9, -0.44).normalize(), length: 0.27, seed: 0.64 },
  ] as const
  ruptureShards.forEach((shard) => appendPrimitive(
    new THREE.ConeGeometry(0.09, shard.length, 5, 1, false),
    shard.center,
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), shard.direction),
    new THREE.Vector3(1, 1, 1),
    shard.seed,
    4,
  ))

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxShadowBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxShadowBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxShadowBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxShadowBurstSpiderDrawCalls'] = 1
  geometry.userData['pfxShadowBurstSpiderClosedFaces'] = true
  geometry.userData['pfxShadowBurstSpiderSmoothNormals'] = true
  geometry.userData['pfxShadowBurstBillboardCount'] = 0
  geometry.userData['pfxShadowBurstBodyLobeCount'] = bodyLobes.length
  geometry.userData['pfxShadowBurstEyeCount'] = coldEyes.length
  geometry.userData['pfxShadowBurstFangCount'] = fangs.length
  geometry.userData['pfxShadowBurstRuptureShardCount'] = ruptureShards.length
  geometry.userData['pfxShadowBurstSpiderProfile'] = 'faceted-three-lobe-shadow-spider-eidolon-with-six-cold-eyes-two-fangs-and-eight-three-axis-rupture-shards'
  geometry.userData['pfxShadowBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxShadowBurstSpiderTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstSpiderWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxShadowBurstSpiderDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxShadowBurstSpiderHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxShadowBurstSpiderMaterial(
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
      attribute float pfxShadowBurstForm;
      varying vec3 vShadowNormal;
      varying vec3 vShadowViewPosition;
      varying vec3 vShadowLocal;
      varying float vShadowSeed;
      varying float vShadowForm;
      varying float vShadowLife;
      void main() {
        float carapaceManifest = smoothstep(0.018 + pfxShadowBurstSeed * 0.025, 0.26 + pfxShadowBurstSeed * 0.025, uCycle);
        float abdomenPulse = smoothstep(0.52 + pfxShadowBurstSeed * 0.02, 0.86 + pfxShadowBurstSeed * 0.025, uCycle);
        float eyeForm = step(1.5, pfxShadowBurstForm) * (1.0 - step(2.5, pfxShadowBurstForm));
        float ragForm = step(3.5, pfxShadowBurstForm);
        float ruptureScatter = smoothstep(0.12 + pfxShadowBurstSeed * 0.02, 0.38 + pfxShadowBurstSeed * 0.025, uCycle);
        vec3 local = position - pfxShadowBurstCenter;
        float opening = max(carapaceManifest, eyeForm * (1.0 - smoothstep(0.1, 0.2, uCycle)) * 0.78);
        local *= mix(vec3(0.56, 0.48, 0.56), vec3(1.0), opening);
        local *= mix(1.0, 0.82, abdomenPulse * ragForm);
        vec3 center = pfxShadowBurstCenter * mix(0.5, 1.0, carapaceManifest);
        center.y += ragForm * sin(abdomenPulse * 3.14159) * (0.04 + pfxShadowBurstSeed * 0.05);
        center += normalize(pfxShadowBurstCenter - vec3(0.0, 0.42, -0.12)) * ruptureScatter * (0.42 + pfxShadowBurstSeed * 0.34) * ragForm;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vShadowNormal = normalize(normalMatrix * normal);
        vShadowViewPosition = viewPosition.xyz;
        vShadowLocal = local;
        vShadowSeed = pfxShadowBurstSeed;
        vShadowForm = pfxShadowBurstForm;
        float densityReveal = mix(1.0, step(pfxShadowBurstSeed, 0.18 + uDensity * 0.82), ragForm);
        float retirement = 1.0 - smoothstep(0.78 + pfxShadowBurstSeed * 0.025, 0.94 + pfxShadowBurstSeed * 0.02, uCycle);
        float recoveryGate = mix(1.0, 0.15, abdomenPulse);
        vShadowLife = densityReveal * retirement * (0.48 + carapaceManifest * 0.52) * recoveryGate;
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
        float rim = pow(1.0 - facing, mix(2.2, 0.7, uStyleEdgeHardness));
        float maskForm = step(0.5, vShadowForm) * (1.0 - step(1.5, vShadowForm));
        float eyeForm = step(1.5, vShadowForm) * (1.0 - step(2.5, vShadowForm));
        float shoulderForm = step(2.5, vShadowForm) * (1.0 - step(3.5, vShadowForm));
        float ragForm = step(3.5, vShadowForm);
        vec3 keyDirection = normalize(vec3(-0.42, 0.76, 0.5));
        vec3 fillDirection = normalize(vec3(0.68, 0.06, -0.72));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float ambientLift = 0.2 + facing * 0.12;
        float chitinVolume = 0.42 + keyLight * 0.34 + fillLight * 0.22;
        float carapaceRim = rim * (0.72 + shoulderForm * 0.22 + ragForm * 0.28);
        float eyeBandGlow = eyeForm * (0.84 + 0.16 * sin(uCycle * 23.0 + vShadowSeed * 29.0));
        float maskVoid = maskForm * (0.82 + facing * 0.12);
        float ragVein = ragForm * smoothstep(0.62, 0.94, 0.5 + 0.5 * sin(vShadowLocal.y * 18.0 + vShadowSeed * 37.0));
        vec3 color = mix(uPrimaryColor * 1.08, uSecondaryColor * 0.82, ambientLift + keyLight * 0.16 + fillLight * 0.1);
        color *= chitinVolume;
        color += uSecondaryColor * (carapaceRim * 0.98 + keyLight * 0.24);
        color = mix(color, uPrimaryColor * 0.28 + uSecondaryColor * rim * 0.1, maskVoid);
        color += mix(uSecondaryColor * 1.15, uAccentColor * 1.45, 0.68) * eyeBandGlow;
        color += uSecondaryColor * ragVein * 0.42;
        color += mix(uSecondaryColor, uAccentColor, 0.42) * shoulderForm * keyLight * 0.22;
        float alpha = uOpacity * vShadowLife * (0.68 + facing * 0.18 + rim * 0.14);
        alpha *= mix(1.0, 0.9, maskForm);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'spider'
  material.userData['pfxShadowBurstMaterialProfile'] = 'faceted-violet-black-chitin-with-six-cold-eyes-and-rim-lit-dorsal-plates'
  return material
}
