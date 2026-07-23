import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxCurseBurstEffigyGeometry(): THREE.BufferGeometry {
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

  const up = new THREE.Vector3(0, 1, 0)
  const forward = new THREE.Vector3(0, 0, 1)
  const skullLobes = [
    { center: new THREE.Vector3(0, 0.64, 0), scale: new THREE.Vector3(0.54, 0.6, 0.43), seed: 0.04 },
    { center: new THREE.Vector3(0, 0.12, 0.025), scale: new THREE.Vector3(0.35, 0.34, 0.31), seed: 0.11 },
    { center: new THREE.Vector3(-0.34, 0.38, 0.035), scale: new THREE.Vector3(0.25, 0.19, 0.3), seed: 0.17 },
    { center: new THREE.Vector3(0.34, 0.38, -0.015), scale: new THREE.Vector3(0.25, 0.19, 0.3), seed: 0.23 },
    { center: new THREE.Vector3(-0.25, 0.08, 0.03), scale: new THREE.Vector3(0.17, 0.29, 0.25), seed: 0.29 },
    { center: new THREE.Vector3(0.25, 0.08, 0.02), scale: new THREE.Vector3(0.17, 0.29, 0.25), seed: 0.35 },
    { center: new THREE.Vector3(0, -0.1, 0.035), scale: new THREE.Vector3(0.24, 0.15, 0.23), seed: 0.41 },
  ] as const
  skullLobes.forEach((lobe, index) => appendPrimitive(
    index === 0 ? new THREE.IcosahedronGeometry(1, 2) : new THREE.DodecahedronGeometry(1, 0),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.08, index * -0.12, index * 0.06)),
    lobe.scale,
    lobe.seed,
    0,
  ))

  const spectralSpinePoints = [
    new THREE.Vector3(0, 0.56, -0.3),
    new THREE.Vector3(0.1, 0.63, -0.66),
    new THREE.Vector3(-0.1, 0.76, -0.96),
    new THREE.Vector3(0.14, 0.9, -1.18),
  ] as const
  const spectralSpineRadii = [0.29, 0.22, 0.14, 0.04] as const
  const spectralSpineLobes = spectralSpinePoints.slice(0, -1).map((start, index) => ({ start, end: spectralSpinePoints[index + 1]!, index }))
  spectralSpineLobes.forEach(({ start, end, index }) => {
    const direction = new THREE.Vector3().subVectors(end, start)
    const length = direction.length()
    direction.normalize()
    appendPrimitive(
      new THREE.CylinderGeometry(spectralSpineRadii[index + 1]!, spectralSpineRadii[index]!, length, 8, 1, false),
      new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, direction),
      new THREE.Vector3(1, 1, 1),
      0.18 + index * 0.06,
      5,
    )
  })

  const eyeSockets = [
    { center: new THREE.Vector3(-0.2, 0.62, 0.398), direction: new THREE.Vector3(0, 0, 1), scale: new THREE.Vector3(0.19, 0.155, 0.062) },
    { center: new THREE.Vector3(0.2, 0.62, 0.398), direction: new THREE.Vector3(0, 0, 1), scale: new THREE.Vector3(0.19, 0.155, 0.062) },
    { center: new THREE.Vector3(0, 0.4, 0.39), direction: new THREE.Vector3(0, 0, 1), scale: new THREE.Vector3(0.075, 0.12, 0.05) },
    { center: new THREE.Vector3(0.515, 0.59, 0.015), direction: new THREE.Vector3(1, 0, 0), scale: new THREE.Vector3(0.16, 0.135, 0.058) },
  ] as const
  eyeSockets.forEach((socket, index) => appendPrimitive(
    new THREE.DodecahedronGeometry(1, 0),
    socket.center,
    new THREE.Quaternion().setFromUnitVectors(forward, socket.direction),
    socket.scale,
    0.1 + index * 0.06,
    4,
  ))

  const toxicEyes = [
    { center: new THREE.Vector3(-0.2, 0.62, 0.448), direction: new THREE.Vector3(0, 0, 1) },
    { center: new THREE.Vector3(0.2, 0.62, 0.448), direction: new THREE.Vector3(0, 0, 1) },
    { center: new THREE.Vector3(0.565, 0.59, 0.015), direction: new THREE.Vector3(1, 0, 0) },
  ] as const
  toxicEyes.forEach((eye, index) => appendPrimitive(
    new THREE.SphereGeometry(1, 8, 6),
    eye.center,
    new THREE.Quaternion().setFromUnitVectors(forward, eye.direction),
    new THREE.Vector3(0.066, 0.092, 0.04),
    0.16 + index * 0.05,
    1,
  ))

  const hornPaths = [
    [new THREE.Vector3(-0.34, 0.9, 0.01), new THREE.Vector3(-0.45, 1.18, 0.03), new THREE.Vector3(-0.66, 1.38, 0.11), new THREE.Vector3(-0.92, 1.48, 0.29)],
    [new THREE.Vector3(0.34, 0.9, -0.01), new THREE.Vector3(0.43, 1.19, -0.05), new THREE.Vector3(0.62, 1.4, -0.15), new THREE.Vector3(0.88, 1.5, -0.35)],
  ] as const
  let crookedHornSegmentCount = 0
  hornPaths.forEach((points, hornIndex) => {
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const start = points[segmentIndex]!
      const end = points[segmentIndex + 1]!
      const direction = new THREE.Vector3().subVectors(end, start)
      const length = direction.length()
      direction.normalize()
      appendPrimitive(
        new THREE.ConeGeometry([0.135, 0.1, 0.068][segmentIndex]!, length, 7, 1, false),
        new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(up, direction),
        new THREE.Vector3(1, 1, 1),
        0.31 + hornIndex * 0.18,
        2,
      )
      crookedHornSegmentCount += 1
    }
  })

  const raisedCurseRune = [
    { center: [0, 0.94, 0.47], rotation: 0, scale: [0.052, 0.24, 0.038] },
    { center: [-0.1, 1.04, 0.475], rotation: -0.74, scale: [0.046, 0.16, 0.036] },
    { center: [0.1, 1.04, 0.475], rotation: 0.74, scale: [0.046, 0.16, 0.036] },
    { center: [-0.1, 0.84, 0.475], rotation: 0.74, scale: [0.046, 0.16, 0.036] },
    { center: [0.1, 0.84, 0.475], rotation: -0.74, scale: [0.046, 0.16, 0.036] },
  ] as const
  raisedCurseRune.forEach((piece, index) => appendPrimitive(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.Vector3(...piece.center),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, piece.rotation)),
    new THREE.Vector3(...piece.scale),
    0.19 + index * 0.12,
    3,
  ))

  const skullTeeth = [-0.16, -0.08, 0, 0.08, 0.16] as const
  skullTeeth.forEach((x, index) => appendPrimitive(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.Vector3(x, 0.18 - Math.abs(index - 2) * 0.012, 0.325),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04 * (index - 2), 0, -0.025 * (index - 2))),
    new THREE.Vector3(0.032, 0.095 - Math.abs(index - 2) * 0.006, 0.026),
    0.22 + index * 0.09,
    7,
  ))

  const curseAuraShells = [
    { center: new THREE.Vector3(-0.4, 0.57, -0.17), scale: new THREE.Vector3(0.27, 0.73, 0.31), seed: 0.12 },
    { center: new THREE.Vector3(0.4, 0.54, -0.2), scale: new THREE.Vector3(0.28, 0.68, 0.34), seed: 0.34 },
  ] as const
  curseAuraShells.forEach((shell, index) => appendPrimitive(
    index === 0 ? new THREE.IcosahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, 1),
    shell.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08 + index * 0.11, index * 0.17, -0.05 - index * 0.08)),
    shell.scale,
    shell.seed,
    6,
  ))

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxCurseBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxCurseBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxCurseBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxCurseBurstEffigyDrawCalls'] = 1
  geometry.userData['pfxCurseBurstEffigyClosedFaces'] = true
  geometry.userData['pfxCurseBurstEffigySmoothNormals'] = true
  geometry.userData['pfxCurseBurstBillboardCount'] = 0
  geometry.userData['pfxCurseBurstSkullLobeCount'] = skullLobes.length
  geometry.userData['pfxCurseBurstSkullCraniumSubdivision'] = 2
  geometry.userData['pfxCurseBurstSkullToothCount'] = skullTeeth.length
  geometry.userData['pfxCurseBurstAuraShellCount'] = curseAuraShells.length
  geometry.userData['pfxCurseBurstSpectralSpineLobeCount'] = spectralSpineLobes.length
  geometry.userData['pfxCurseBurstSpectralSpineJointGap'] = 0
  geometry.userData['pfxCurseBurstSpectralSpineProfile'] = 'connected-three-segment-crooked-taper'
  geometry.userData['pfxCurseBurstEyeSocketCount'] = eyeSockets.length
  geometry.userData['pfxCurseBurstToxicEyeCount'] = toxicEyes.length
  geometry.userData['pfxCurseBurstCrookedHornSegmentCount'] = crookedHornSegmentCount
  geometry.userData['pfxCurseBurstMaximumHornJointGap'] = 0
  geometry.userData['pfxCurseBurstRaisedCurseRunePieceCount'] = raisedCurseRune.length
  geometry.userData['pfxCurseBurstEffigyProfile'] = 'faceted-obsidian-skull-idol-with-seven-lobe-cranium-brow-cheekbone-mandible-silhouette-three-front-and-one-anatomical-side-recessed-sockets-three-toxic-pupils-contiguous-crooked-horns-raised-curse-rune-and-long-negative-z-spectral-spine'
  geometry.userData['pfxCurseBurstOnsetScaleFloor'] = 0.66
  geometry.userData['pfxCurseBurstOnsetOpacityFloor'] = 0.46
  geometry.userData['pfxCurseBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxCurseBurstEffigyTriangleCount'] = positions.length / 9
  geometry.userData['pfxCurseBurstEffigyWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxCurseBurstEffigyDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxCurseBurstEffigyHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxCurseBurstEffigyMaterial(
  opacity: number,
  primaryColor = '#2e0249',
  secondaryColor = '#a855f7',
  accentColor = '#bef264',
  density = 0.54,
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
      attribute vec3 pfxCurseBurstCenter;
      attribute float pfxCurseBurstSeed;
      attribute float pfxCurseBurstForm;
      varying vec3 vCurseNormal;
      varying vec3 vCurseViewPosition;
      varying vec3 vCurseLocalPosition;
      varying float vCurseSeed;
      varying float vCurseForm;
      varying float vCurseLife;
      void main() {
        float curseTriggerFlash = 1.0 - smoothstep(0.08, 0.2, uCycle);
        float maledictionIgnition = smoothstep(0.018, 0.13, uCycle);
        float crookedHornUnfurl = smoothstep(0.07 + pfxCurseBurstSeed * 0.03, 0.38 + pfxCurseBurstSeed * 0.03, uCycle);
        float skullIdolContraction = smoothstep(0.46, 0.82, uCycle);
        float corruptionResolve = smoothstep(0.42, 0.56, uCycle);
        float cleanRecoveryGate = mix(1.0, 0.16, corruptionResolve);
        float skullForm = 1.0 - step(0.5, pfxCurseBurstForm);
        float toxicEyeForm = step(0.5, pfxCurseBurstForm) * (1.0 - step(1.5, pfxCurseBurstForm));
        float hornForm = step(1.5, pfxCurseBurstForm) * (1.0 - step(2.5, pfxCurseBurstForm));
        float raisedRuneForm = step(2.5, pfxCurseBurstForm) * (1.0 - step(3.5, pfxCurseBurstForm));
        float eyeSocketForm = step(3.5, pfxCurseBurstForm) * (1.0 - step(4.5, pfxCurseBurstForm));
        float spectralSpineForm = step(4.5, pfxCurseBurstForm) * (1.0 - step(5.5, pfxCurseBurstForm));
        float auraShellForm = step(5.5, pfxCurseBurstForm) * (1.0 - step(6.5, pfxCurseBurstForm));
        float skullToothForm = step(6.5, pfxCurseBurstForm);
        vec3 local = position - pfxCurseBurstCenter;
        float opening = mix(maledictionIgnition, crookedHornUnfurl, hornForm + raisedRuneForm);
        opening = mix(opening, maledictionIgnition, eyeSocketForm);
        opening = mix(opening, crookedHornUnfurl, spectralSpineForm);
        opening = mix(opening, maledictionIgnition, auraShellForm + skullToothForm);
        opening = max(opening, curseTriggerFlash * mix(0.6, 0.76, toxicEyeForm));
        local *= mix(vec3(0.66, 0.58, 0.66), vec3(1.0), opening);
        local *= mix(1.0, 0.8, corruptionResolve * (hornForm + raisedRuneForm));
        local *= mix(1.0, 0.76, skullIdolContraction * skullForm);
        vec3 center = pfxCurseBurstCenter * mix(0.66, 1.0, opening);
        center.xz *= 1.0 + crookedHornUnfurl * hornForm * 0.13;
        center.y += raisedRuneForm * corruptionResolve * (0.13 + pfxCurseBurstSeed * 0.2);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vCurseNormal = normalize(normalMatrix * normal);
        vCurseViewPosition = viewPosition.xyz;
        vCurseLocalPosition = local;
        vCurseSeed = pfxCurseBurstSeed;
        vCurseForm = pfxCurseBurstForm;
        float densityReveal = mix(1.0, step(pfxCurseBurstSeed, 0.22 + uDensity * 0.78), raisedRuneForm + auraShellForm);
        float retirement = 1.0 - smoothstep(0.78 + pfxCurseBurstSeed * 0.02, 0.94 + pfxCurseBurstSeed * 0.02, uCycle);
        float auraAnticipationGate = mix(1.0, smoothstep(0.07, 0.2, uCycle), auraShellForm);
        vCurseLife = densityReveal * retirement * max(0.46 + maledictionIgnition * 0.54, curseTriggerFlash * 0.72) * cleanRecoveryGate * auraAnticipationGate;
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
      varying vec3 vCurseNormal;
      varying vec3 vCurseViewPosition;
      varying vec3 vCurseLocalPosition;
      varying float vCurseSeed;
      varying float vCurseForm;
      varying float vCurseLife;
      void main() {
        float curseTriggerFlash = 1.0 - smoothstep(0.08, 0.2, uCycle);
        vec3 normal = normalize(vCurseNormal);
        vec3 viewDirection = normalize(-vCurseViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.0, 0.72, uStyleEdgeHardness));
        float skullForm = 1.0 - step(0.5, vCurseForm);
        float toxicEyeForm = step(0.5, vCurseForm) * (1.0 - step(1.5, vCurseForm));
        float hornForm = step(1.5, vCurseForm) * (1.0 - step(2.5, vCurseForm));
        float raisedRuneForm = step(2.5, vCurseForm) * (1.0 - step(3.5, vCurseForm));
        float eyeSocketForm = step(3.5, vCurseForm) * (1.0 - step(4.5, vCurseForm));
        float spectralSpineForm = step(4.5, vCurseForm) * (1.0 - step(5.5, vCurseForm));
        float auraShellForm = step(5.5, vCurseForm) * (1.0 - step(6.5, vCurseForm));
        float skullToothForm = step(6.5, vCurseForm);
        float facetedKeyLight = max(0.0, dot(normal, normalize(vec3(-0.38, 0.78, 0.5))));
        float facetedFillLight = max(0.0, dot(normal, normalize(vec3(0.64, 0.18, -0.74))));
        vec3 curseHalfVector = normalize(viewDirection + normalize(vec3(-0.38, 0.78, 0.5)));
        float obsidianSpecular = pow(max(0.0, dot(normal, curseHalfVector)), 18.0) * (0.42 + skullForm * 0.38);
        float sculptedSkullSpecular = obsidianSpecular * skullForm;
        float obsidianMalediction = 0.42 + facetedKeyLight * 0.58 + facetedFillLight * 0.24;
        float raisedRuneEmission = raisedRuneForm * (0.76 + 0.24 * sin(vCurseSeed * 31.0 + uCycle * 23.0));
        float sicklyRuneGlint = raisedRuneForm * smoothstep(0.72, 0.96, 0.5 + 0.5 * sin(vCurseSeed * 47.0 + uCycle * 29.0));
        float toxicEyeEmission = toxicEyeForm * (0.82 + 0.18 * sin(uCycle * 18.0));
        float eyeSocketOcclusion = eyeSocketForm * (0.72 + facing * 0.18);
        float toxicRuneAccent = raisedRuneForm * (0.82 + 0.18 * sin(uCycle * 16.0 + vCurseSeed * 13.0));
        float spectralSpineRim = spectralSpineForm * rim;
        float auraEdgeFalloff = auraShellForm * smoothstep(0.18, 0.94, rim);
        float curseAuraBloomHalo = auraShellForm * (0.18 + auraEdgeFalloff * 0.82);
        vec3 shellChromaticSeparation = mix(uSecondaryColor, vec3(0.18, 0.34, 0.95), 0.34);
        float toxicToothGlint = skullToothForm * (0.72 + facetedKeyLight * 0.28);
        float corruptionFresnel = rim * (0.38 + hornForm * 0.34 + skullForm * 0.2);
        vec3 color = uPrimaryColor * (0.86 + skullForm * 0.28) + uSecondaryColor * (0.12 + facetedKeyLight * 0.26);
        color *= obsidianMalediction;
        color += uSecondaryColor * (corruptionFresnel * 0.96 + raisedRuneEmission * 0.92);
        color = mix(color, uAccentColor * 0.72 + uPrimaryColor * 0.12, toxicEyeEmission * 0.94);
        color += uAccentColor * sicklyRuneGlint * 0.72;
        color += mix(uPrimaryColor, uSecondaryColor, 0.62) * skullForm * (0.22 + facing * 0.3);
        color += mix(uSecondaryColor, vec3(1.0), 0.54) * obsidianSpecular;
        color += mix(uSecondaryColor, vec3(1.0), 0.62) * sculptedSkullSpecular * 0.34;
        vec3 hornObsidian = uPrimaryColor * 0.52 + uSecondaryColor * (0.18 + facetedKeyLight * 0.44);
        color = mix(color, hornObsidian, hornForm * 0.74);
        color += mix(uSecondaryColor * 1.48, uAccentColor * 1.68, toxicEyeForm) * curseTriggerFlash * (0.56 + rim * 0.44);
        color += uAccentColor * toxicEyeForm * (0.38 + rim * 0.5);
        color = mix(color, uPrimaryColor * 0.12 + uSecondaryColor * rim * 0.08, eyeSocketOcclusion);
        color = mix(color, uPrimaryColor * 0.42 + uSecondaryColor * (0.64 + rim * 0.62), spectralSpineForm * 0.94);
        color = mix(color, uAccentColor * 0.82 + uSecondaryColor * 0.08, toxicRuneAccent * 0.96);
        color += uAccentColor * (spectralSpineRim * 0.72 + hornForm * rim * 0.18);
        color = mix(color, shellChromaticSeparation * 1.08 + uAccentColor * 0.1, curseAuraBloomHalo * 0.9);
        color = mix(color, uAccentColor * 0.62 + uSecondaryColor * 0.28, toxicToothGlint * 0.88);
        float alpha = uOpacity * vCurseLife * (0.64 + facing * 0.2 + rim * 0.16);
        alpha *= mix(1.0, 0.16 + auraEdgeFalloff * 0.32, auraShellForm);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxCurseBurstMaterial'] = true
  material.userData['pfxCurseBurstMaterialRole'] = 'effigy'
  material.userData['pfxCurseBurstMaterialProfile'] = 'obsidian-violet-malediction-with-toxic-iris-and-crack-emission'
  return material
}
