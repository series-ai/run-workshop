import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxCurseBurstBindingGeometry(): THREE.BufferGeometry {
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

  const axisDirections = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1),
  ] as const
  const linkArms = [
    { direction: new THREE.Vector3(0.62, 0.46, 0.64).normalize(), count: 6, spacing: 0.3, size: 0.92 },
    { direction: new THREE.Vector3(-0.68, 0.14, 0.72).normalize(), count: 5, spacing: 0.28, size: 0.84 },
    { direction: new THREE.Vector3(0.08, 0.7, -0.71).normalize(), count: 4, spacing: 0.26, size: 0.78 },
  ] as const
  const bindingOrigin = new THREE.Vector3(0, 0.56, 0)
  let bindingSegmentCount = 0
  let bindingLinkInlayCount = 0
  let bindingLinkInlayPieceCount = 0
  linkArms.forEach(({ direction, count, spacing, size }, radialIndex) => {
    const reference = Math.abs(direction.y) > 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const firstNormal = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const secondNormal = new THREE.Vector3().crossVectors(direction, firstNormal).normalize()
    for (let segment = 0; segment < count; segment += 1) {
      const normal = segment % 2 === 0 ? firstNormal : secondNormal
      const progress = segment / Math.max(1, count - 1)
      const center = bindingOrigin.clone().add(direction.clone().multiplyScalar(0.58 + segment * spacing))
      center.addScaledVector(firstNormal, Math.sin(progress * Math.PI) * (0.11 + radialIndex * 0.035))
      center.addScaledVector(secondNormal, (progress * progress - progress * 0.25) * (radialIndex - 1) * 0.08)
      const localX = new THREE.Vector3().crossVectors(direction, normal).normalize()
      const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(localX, direction, normal))
      const densityTierSeed = segment === 0
        ? 0.06 + radialIndex * 0.006
        : segment === 1
          ? 0.22 + radialIndex * 0.006
          : segment === 2
            ? 0.38 + radialIndex * 0.006
            : segment === 3
              ? 0.5 + radialIndex * 0.006
              : radialIndex === 0 && segment === 4
                ? 0.52
                : segment === 4
                  ? 0.74
                : 0.84
      appendPrimitive(new THREE.TorusGeometry(0.15, 0.055, 5, 8), center, rotation, new THREE.Vector3(0.68 * size, 1.32 * size, size), direction, densityTierSeed, 0)
      for (const inlaySide of [-1, 1] as const) {
        const inlayRotation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), inlaySide * 0.68))
        appendPrimitive(new THREE.BoxGeometry(1, 1, 1), center, inlayRotation, new THREE.Vector3(0.045, 0.17 * size, 0.06), direction, densityTierSeed, 1)
        bindingLinkInlayPieceCount += 1
      }
      bindingLinkInlayCount += 1
      bindingSegmentCount += 1
    }
  })

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxCurseBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxCurseBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxCurseBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxCurseBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  const depth = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxCurseBurstBindingDrawCalls'] = 1
  geometry.userData['pfxCurseBurstBindingClosedFaces'] = true
  geometry.userData['pfxCurseBurstBindingSmoothNormals'] = true
  geometry.userData['pfxCurseBurstBindingBillboardCount'] = 0
  geometry.userData['pfxCurseBurstBindingAxisCount'] = axisDirections.length
  geometry.userData['pfxCurseBurstBindingSegmentCount'] = bindingSegmentCount
  geometry.userData['pfxCurseBurstChainLinkCount'] = bindingSegmentCount
  geometry.userData['pfxCurseBurstBindingLinkInlayCount'] = bindingLinkInlayCount
  geometry.userData['pfxCurseBurstBindingLinkInlayPieceCount'] = bindingLinkInlayPieceCount
  geometry.userData['pfxCurseBurstEscapedGlyphCount'] = 0
  geometry.userData['pfxCurseBurstSkewedArmCount'] = linkArms.length
  geometry.userData['pfxCurseBurstArmLinkCountProfile'] = linkArms.map(({ count }) => count).join('-')
  geometry.userData['pfxCurseBurstDistinctArmLengthCount'] = new Set(linkArms.map(({ count, spacing }) => (count * spacing).toFixed(3))).size
  geometry.userData['pfxCurseBurstMinimumVisibleLinkCount'] = 3
  geometry.userData['pfxCurseBurstDefaultVisibleLinkCount'] = 13
  geometry.userData['pfxCurseBurstDefaultVisibleInlayCount'] = 13
  geometry.userData['pfxCurseBurstMaximumVisibleLinkCount'] = 15
  geometry.userData['pfxCurseBurstCompleteRingCount'] = 0
  geometry.userData['pfxCurseBurstChainLinkRadialSegments'] = 5
  geometry.userData['pfxCurseBurstChainLinkTubularSegments'] = 8
  geometry.userData['pfxCurseBurstChainLinkAspectRatio'] = 1.941
  geometry.userData['pfxCurseBurstChainLinkTubeRadius'] = 0.055
  geometry.userData['pfxCurseBurstChainLinkSpacing'] = 0.28
  geometry.userData['pfxCurseBurstBindingStartDistance'] = 0.58
  geometry.userData['pfxCurseBurstDefaultFrontLongArmCount'] = 1
  geometry.userData['pfxCurseBurstMinimumDensityLinksPerArm'] = 1
  geometry.userData['pfxCurseBurstDefaultDensityLinksPerArm'] = 4
  geometry.userData['pfxCurseBurstMaximumDensityLinksPerArm'] = 6
  geometry.userData['pfxCurseBurstBindingProfile'] = 'three-asymmetric-curved-world-space-snapped-binding-whips-with-six-five-four-discrete-toxic-sigil-links'
  geometry.userData['pfxCurseBurstRingDiscipline'] = 'small-interlocking-slashed-toxic-sigil-links-communicate-snapped-containment-never-gameplay-radius'
  geometry.userData['pfxCurseBurstBindingTriangleCount'] = positions.length / 9
  geometry.userData['pfxCurseBurstBindingWidthSpan'] = width
  geometry.userData['pfxCurseBurstBindingDepthSpan'] = depth
  geometry.userData['pfxCurseBurstBindingHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxCurseBurstBindingPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxCurseBurstBindingMaterial(
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
      attribute vec3 pfxCurseBurstDirection;
      attribute float pfxCurseBurstForm;
      varying vec3 vBindingNormal;
      varying vec3 vBindingViewPosition;
      varying vec3 vBindingLocalPosition;
      varying float vBindingSeed;
      varying float vBindingForm;
      varying float vBindingLife;
      void main() {
        float structuralSlowTimingFloor = 0.64;
        float bindingSnap = smoothstep(0.06 + pfxCurseBurstSeed * 0.025, 0.34 + pfxCurseBurstSeed * 0.025, uCycle);
        float threeAxisSeparation = smoothstep(0.18, 0.56, uCycle);
        float escapedRuneAscent = smoothstep(0.42 + pfxCurseBurstSeed * 0.025, 0.9, uCycle);
        float glyphForm = step(0.5, pfxCurseBurstForm);
        vec3 local = position - pfxCurseBurstCenter;
        local *= mix(structuralSlowTimingFloor, 1.0, bindingSnap);
        vec3 center = pfxCurseBurstCenter * mix(0.62, 1.0, bindingSnap);
        center += pfxCurseBurstDirection * threeAxisSeparation * (0.08 + pfxCurseBurstSeed * 0.08);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vBindingNormal = normalize(normalMatrix * normal);
        vBindingViewPosition = viewPosition.xyz;
        vBindingLocalPosition = local;
        vBindingSeed = pfxCurseBurstSeed;
        vBindingForm = pfxCurseBurstForm;
        float bindingDensityReveal = step(pfxCurseBurstSeed, 0.08 + uDensity * 0.92);
        float densityReveal = bindingDensityReveal;
        float retirement = 1.0 - smoothstep(0.66 + pfxCurseBurstSeed * 0.02, 0.9 + pfxCurseBurstSeed * 0.015, uCycle);
        float bindingCorruptionResolve = smoothstep(0.43, 0.56, uCycle);
        float bindingCleanRecoveryGate = mix(1.0, 0.14, bindingCorruptionResolve);
        vBindingLife = densityReveal * retirement * (0.56 + bindingSnap * 0.44) * bindingCleanRecoveryGate;
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
      varying vec3 vBindingNormal;
      varying vec3 vBindingViewPosition;
      varying vec3 vBindingLocalPosition;
      varying float vBindingSeed;
      varying float vBindingForm;
      varying float vBindingLife;
      void main() {
        vec3 normal = normalize(vBindingNormal);
        vec3 viewDirection = normalize(-vBindingViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(1.8, 0.68, uStyleEdgeHardness));
        float glyphForm = step(0.5, vBindingForm);
        float cursedLinkInlay = glyphForm;
        float toxicTierSeparation = cursedLinkInlay * (0.82 + 0.18 * sin(vBindingSeed * 37.0));
        vec3 bindingKeyDirection = normalize(vec3(-0.46, 0.72, 0.52));
        float bindingKeyLight = max(0.0, dot(normal, bindingKeyDirection));
        vec3 bindingFillDirection = normalize(vec3(0.68, -0.12, -0.72));
        float bindingFillLight = max(0.0, dot(normal, bindingFillDirection));
        float bindingSpecular = pow(max(0.0, dot(normal, normalize(viewDirection + bindingKeyDirection))), 22.0);
        float facetedBindingMetal = 0.38 + bindingKeyLight * 0.34 + bindingFillLight * 0.25 + rim * 0.1;
        float volumetricLinkCore = (1.0 - glyphForm) * (1.0 - rim) * (0.18 + bindingKeyLight * 0.2 + bindingFillLight * 0.16);
        float brokenChainPulse = (1.0 - glyphForm) * (0.7 + 0.3 * sin(uCycle * 24.0 + vBindingSeed * 29.0));
        float glyphContamination = glyphForm * smoothstep(0.48, 0.9, 0.5 + 0.5 * sin(vBindingLocalPosition.y * 25.0 + vBindingSeed * 41.0));
        float toxicEdgeReceipt = rim * (0.34 + glyphContamination * 0.48);
        float bindingRimEmission = rim * (0.72 + brokenChainPulse * 0.46);
        vec3 color = mix(uPrimaryColor * 0.58, uSecondaryColor * 1.24, 0.4 + brokenChainPulse * 0.3);
        color *= facetedBindingMetal;
        color += mix(uPrimaryColor * 0.82, uSecondaryColor * 0.68, bindingFillLight) * volumetricLinkCore;
        color += uSecondaryColor * (bindingRimEmission * 0.76 + brokenChainPulse * 0.28);
        color = mix(color, uAccentColor * 1.32 + uSecondaryColor * 0.36, glyphContamination * 0.82);
        color += uAccentColor * toxicEdgeReceipt * 0.62;
        vec3 shadedToxicInlay = uAccentColor * (0.38 + bindingKeyLight * 0.42) + uSecondaryColor * rim * 0.22;
        color = mix(color, shadedToxicInlay, toxicTierSeparation * 0.88);
        color += mix(uSecondaryColor, vec3(1.0), 0.58) * bindingSpecular * (1.0 - glyphForm) * 0.82;
        float alpha = uOpacity * vBindingLife * (0.58 + facing * 0.2 + rim * 0.22);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxCurseBurstMaterial'] = true
  material.userData['pfxCurseBurstMaterialRole'] = 'bindings'
  material.userData['pfxCurseBurstMaterialProfile'] = 'snapped-violet-bindings-with-toxic-rune-contamination'
  return material
}
