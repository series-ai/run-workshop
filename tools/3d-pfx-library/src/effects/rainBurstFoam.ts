import * as THREE from 'three'
import { smoothPfxWaterColumnNormals } from '../constants/04'

export function createPfxRainBurstFoamGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const forms: number[] = []
  const progresses: number[] = []
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, form: number, progress: number, shade: number) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(shade, 0.92 + shade * 0.08, 1, shade, 0.92 + shade * 0.08, 1, shade, 0.92 + shade * 0.08, 1)
    forms.push(form, form, form)
    progresses.push(progress, progress, progress)
  }
  const appendTube = (points: readonly THREE.Vector3[], radius: number, sides: number, form: number, progress: number) => {
    const rings = points.map((point, station) => {
      const previous = points[Math.max(0, station - 1)]!
      const next = points[Math.min(points.length - 1, station + 1)]!
      const axis = next.clone().sub(previous).normalize()
      const reference = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
      const basisA = axis.clone().cross(reference).normalize()
      const basisB = axis.clone().cross(basisA).normalize()
      const local = station / Math.max(1, points.length - 1)
      const incomingSilhouetteProfile = Math.round(progress * 24) % 4
      const taper = form === 0
        ? incomingSilhouetteProfile === 0
          ? 0.35 + Math.sin(local * Math.PI) * 0.65
          : incomingSilhouetteProfile === 1
            ? 0.72 + Math.sin(local * Math.PI) * 0.28
            : incomingSilhouetteProfile === 2
              ? 0.2 + Math.sqrt(Math.max(0, Math.sin(local * Math.PI))) * 0.8
              : 0.48 + (1 - local) * 0.52
        : form === 1
          ? 0.24 + Math.sin(local * Math.PI) * 0.76
          : 0.42 + Math.sin(local * Math.PI) * 0.58
      return Array.from({ length: sides }, (_, side) => {
        const angle = side / sides * Math.PI * 2
        return point.clone().addScaledVector(basisA, Math.cos(angle) * radius * taper).addScaledVector(basisB, Math.sin(angle) * radius * taper)
      })
    })
    for (let station = 0; station < rings.length - 1; station += 1) {
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides
        pushTriangle(rings[station]![side]!, rings[station]![next]!, rings[station + 1]![next]!, form, progress, 0.76 + station * 0.05)
        pushTriangle(rings[station]![side]!, rings[station + 1]![next]!, rings[station + 1]![side]!, form, progress, 0.82 + station * 0.04)
      }
    }
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides
      pushTriangle(points[0]!, rings[0]![next]!, rings[0]![side]!, form, progress, 0.74)
      pushTriangle(points.at(-1)!, rings.at(-1)![side]!, rings.at(-1)![next]!, form, progress, 0.98)
    }
  }
  const appendSprayHighlight = (center: THREE.Vector3, radius: number, length: number, progress: number, leanX: number, leanZ: number) => {
    const source = new THREE.SphereGeometry(1, 6, 4).toNonIndexed()
    const sourcePosition = source.getAttribute('position') as THREE.BufferAttribute
    for (let index = 0; index < sourcePosition.count; index += 3) {
      const vertices = [0, 1, 2].map((offset) => {
        const vertex = new THREE.Vector3().fromBufferAttribute(sourcePosition, index + offset)
        const taper = 0.68 - vertex.y * 0.2
        return new THREE.Vector3(
          center.x + vertex.x * radius * taper + vertex.y * leanX,
          center.y + vertex.y * length,
          center.z + vertex.z * radius * taper + vertex.y * leanZ,
        )
      })
      pushTriangle(vertices[0]!, vertices[1]!, vertices[2]!, 3, progress, 0.98)
    }
    source.dispose()
  }
  const incomingStreakCount = 24
  const incomingImpacts = [
    [-0.82, -0.46], [-0.74, 0.02], [-0.66, 0.43], [-0.52, -0.18], [-0.43, 0.26], [-0.31, -0.5],
    [-0.2, 0.08], [-0.11, 0.5], [0, -0.29], [0.12, 0.22], [0.22, -0.52], [0.33, -0.02],
    [0.42, 0.48], [0.53, -0.26], [0.61, 0.15], [0.7, -0.48], [0.78, 0.34], [0.86, -0.05],
    [-0.58, 0.38], [-0.37, -0.36], [-0.08, 0.41], [0.18, -0.39], [0.47, 0.36], [0.72, -0.34],
  ] as const
  for (let streak = 0; streak < incomingStreakCount; streak += 1) {
    const [impactX, impactZ] = incomingImpacts[streak]!
    const end = new THREE.Vector3(impactX * 1.25, 0.045, impactZ * 3)
    const start = new THREE.Vector3(
      end.x - 0.18,
      1.08 + (streak % 6) * 0.105,
      impactZ * 3 + 0.06,
    )
    const points = Array.from({ length: 6 }, (_, station) => {
      const progress = station / 5
      const bow = Math.sin(progress * Math.PI)
      const profileDirection = streak % 3 === 0 ? 0 : streak % 3 === 1 ? 1 : -1
      return new THREE.Vector3(
        THREE.MathUtils.lerp(start.x, end.x, progress) + bow * profileDirection * 0.022,
        THREE.MathUtils.lerp(start.y, end.y, progress),
        THREE.MathUtils.lerp(start.z, end.z, progress) - bow * profileDirection * 0.018,
      )
    })
    appendTube(points, 0.012 + (streak % 5) * 0.006, 5, 0, streak / incomingStreakCount)
  }

  const crownFoamStreakCount = 0

  const groundFoamStreakCount = 5
  for (let streak = 0; streak < groundFoamStreakCount; streak += 1) {
    const baseAngle = streak / groundFoamStreakCount * Math.PI * 2 + 0.36
    const points = Array.from({ length: 4 }, (_, station) => {
      const progress = station / 3
      const radius = 0.18 + progress * (0.38 + (streak % 2) * 0.08)
      const angle = baseAngle + Math.sin(progress * Math.PI) * (streak % 2 === 0 ? 0.1 : -0.08)
      return new THREE.Vector3(Math.cos(angle) * radius, 0.045 + Math.sin(progress * Math.PI) * 0.018, Math.sin(angle) * radius * 0.9)
    })
    appendTube(points, 0.018 + (streak % 2) * 0.004, 5, 2, streak / groundFoamStreakCount)
  }

  const additiveSprayHighlightCount = 18
  for (let droplet = 0; droplet < additiveSprayHighlightCount; droplet += 1) {
    const angle = droplet / additiveSprayHighlightCount * Math.PI * 2 + Math.sin(droplet * 1.9) * 0.22
    const reach = 0.52 + (droplet % 4) * 0.13
    appendSprayHighlight(
      new THREE.Vector3(
        Math.cos(angle) * reach,
        0.44 + (droplet % 5) * 0.13 + Math.abs(Math.sin(angle * 1.6)) * 0.06,
        Math.sin(angle) * reach * (0.78 + (droplet % 3) * 0.12),
      ),
      0.032 + (droplet % 3) * 0.006,
      0.07 + (droplet % 4) * 0.012,
      droplet / additiveSprayHighlightCount,
      Math.cos(angle) * (0.006 + (droplet % 3) * 0.004),
      Math.sin(angle) * (0.005 + ((droplet + 1) % 3) * 0.004),
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxRainForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxRainProgress', new THREE.Float32BufferAttribute(progresses, 1))
  smoothPfxWaterColumnNormals(geometry)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxRainBurstFoamGeometry'] = 'closed-tapered-rain-and-ground-contact-foam'
  geometry.userData['pfxRainBurstFoamDrawCalls'] = 1
  geometry.userData['pfxRainBurstFoamClosedFaces'] = true
  geometry.userData['pfxRainBurstIncomingStreakCount'] = incomingStreakCount
  geometry.userData['pfxRainBurstIncomingPathStationCount'] = 6
  geometry.userData['pfxRainBurstIncomingPathProfile'] = 'gently-bowed-six-station-water-trails'
  geometry.userData['pfxRainBurstIncomingParallelFall'] = true
  geometry.userData['pfxRainBurstIncomingSharedFallVector'] = [-0.18, -1, 0.06]
  geometry.userData['pfxRainBurstIncomingDepthLaneCount'] = 6
  geometry.userData['pfxRainBurstIncomingConvergesAtImpact'] = true
  geometry.userData['pfxRainBurstIncomingMinimumRadius'] = 0.012
  geometry.userData['pfxRainBurstIncomingMaximumRadius'] = 0.036
  geometry.userData['pfxRainBurstIncomingSilhouetteProfileCount'] = 4
  geometry.userData['pfxRainBurstImpactContactBridge'] = true
  geometry.userData['pfxRainBurstIncomingBulbTipCount'] = 0
  geometry.userData['pfxRainBurstCrownFoamStreakCount'] = crownFoamStreakCount
  geometry.userData['pfxRainBurstCrownFoamOmittedToAvoidHaloArtifacts'] = true
  geometry.userData['pfxRainBurstGroundFoamStreakCount'] = groundFoamStreakCount
  geometry.userData['pfxRainBurstAdditiveSprayHighlightCount'] = additiveSprayHighlightCount
  geometry.userData['pfxRainBurstAdditiveSprayTopology'] = 'closed-pointed-teardrop-highlight-shells'
  geometry.userData['pfxRainBurstAdditiveSprayShapeProfileCount'] = 3
  geometry.userData['pfxRainBurstFoamBillboardCount'] = 0
  geometry.userData['pfxRainBurstFoamTopology'] = 'closed-tapered-rain-and-ground-contact-foam'
  geometry.userData['pfxRainBurstFoamTriangleCount'] = positions.length / 9
  geometry.userData['pfxRainBurstIncomingDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxRainBurstIncomingWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  return geometry
}

export function createPfxRainBurstFoamMaterial(
  opacity: number,
  primaryColor: string,
  secondaryColor: string,
  density: number,
  edgeHardness: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: density },
      uEdgeHardness: { value: edgeHardness },
    },
    vertexShader: /* glsl */ `
      attribute float pfxRainForm;
      attribute float pfxRainProgress;
      varying vec3 vFoamColor;
      varying vec3 vFoamNormal;
      varying vec3 vFoamObjectPosition;
      varying vec3 vFoamViewPosition;
      varying float vRainForm;
      varying float vRainProgress;
      varying float vFoamVisibility;
      uniform float uCycle;
      void main() {
        float rainStreakReleaseEnd = 0.225;
        float rainStreak = 1.0 - smoothstep(0.08, rainStreakReleaseEnd, uCycle);
        float foamCrest = smoothstep(0.03, 0.2, uCycle) * (1.0 - smoothstep(0.7, 0.86, uCycle));
        float groundFoam = smoothstep(0.16, 0.42, uCycle) * (1.0 - smoothstep(0.72, 0.88, uCycle));
        vec3 transformed = position;
        if (pfxRainForm < 0.5) {
          float fall = smoothstep(0.0, 0.28, uCycle + pfxRainProgress * 0.045);
          transformed.y -= fall * 0.18;
          vFoamVisibility = rainStreak * (0.62 + pfxRainProgress * 0.38);
        } else if (pfxRainForm < 1.5) {
          transformed.xz *= 0.18 + foamCrest * 0.82;
          transformed.y *= 0.16 + foamCrest * 0.84;
          vFoamVisibility = foamCrest;
        } else if (pfxRainForm < 2.5) {
          transformed.xz *= 0.48 + groundFoam * 0.52;
          vFoamVisibility = groundFoam;
        } else {
          transformed.xz *= 0.3 + foamCrest * 0.7;
          transformed.y *= 0.2 + foamCrest * 0.8;
          transformed.y += foamCrest * (0.07 + pfxRainProgress * 0.05);
          vFoamVisibility = foamCrest * (0.82 + pfxRainProgress * 0.18);
        }
        vFoamColor = color;
        vFoamNormal = normalize(normalMatrix * normal);
        vFoamObjectPosition = transformed;
        vec4 foamViewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vFoamViewPosition = foamViewPosition.xyz;
        vRainForm = pfxRainForm;
        vRainProgress = pfxRainProgress;
        gl_Position = projectionMatrix * foamViewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uEdgeHardness;
      varying vec3 vFoamColor;
      varying vec3 vFoamNormal;
      varying vec3 vFoamObjectPosition;
      varying vec3 vFoamViewPosition;
      varying float vRainForm;
      varying float vRainProgress;
      varying float vFoamVisibility;
      void main() {
        vec3 normalDirection = normalize(vFoamNormal);
        vec3 viewDirection = normalize(-vFoamViewPosition);
        float rainStreak = vRainForm < 0.5 ? 0.76 + vRainProgress * 0.18 : 1.0;
        float rainDirectionalSheen = vRainForm < 0.5 ? 0.82 + max(0.0, dot(normalDirection, normalize(vec3(-0.52, 0.78, 0.34)))) * 0.7 : 1.0;
        float smoothLongitudinalRefraction = smoothstep(-0.04, 1.58, vFoamObjectPosition.y);
        float rainRefractionBand = vRainForm < 0.5 ? 0.76 + smoothLongitudinalRefraction * 0.34 + vRainProgress * 0.12 : 1.0;
        float rainMicroRivulet = vRainForm < 0.5 ? smoothstep(0.52, 0.94, abs(dot(normalDirection, normalize(vec3(0.28, 0.9, -0.34))))) : 0.0;
        float rainFacetGlint = vRainForm < 0.5 ? smoothstep(0.42, 0.9, abs(dot(normalDirection, normalize(vec3(0.74, 0.18, 0.64))))) : 0.0;
        float rainTailFade = vRainForm < 0.5 ? 1.0 - smoothstep(0.3, 1.6, vFoamObjectPosition.y) * 0.38 : 1.0;
        vec3 rainHalfDirection = normalize(normalize(vec3(-0.28, 0.84, 0.46)) + viewDirection);
        float rainCordSpecular = vRainForm < 0.5 ? pow(max(0.0, dot(normalDirection, rainHalfDirection)), 8.0) : 0.0;
        float rainBackscatter = vRainForm < 0.5 ? max(0.0, dot(-normalDirection, normalize(vec3(-0.46, 0.62, 0.64)))) : 0.0;
        float rainTransmission = vRainForm < 0.5 ? 0.42 + (1.0 - abs(dot(normalDirection, viewDirection))) * 0.58 : 1.0;
        float rainBurstLuminanceLift = vRainForm < 0.5 ? 1.28 : 1.0;
        float foamCrest = vRainForm > 2.5 ? 1.3 : vRainForm > 0.5 && vRainForm < 1.5 ? 1.12 : 0.88;
        float rim = 0.62 + (1.0 - abs(dot(normalDirection, viewDirection))) * 0.38;
        float foamMix = vRainForm < 0.5 ? 0.84 + vFoamColor.b * 0.14 : 0.68 + vFoamColor.b * 0.3;
        vec3 controlledFoamColor = mix(uPrimaryColor, uSecondaryColor, foamMix);
        vec3 rainDepthTint = mix(uPrimaryColor * 0.76, uSecondaryColor * 1.16, clamp(0.28 + (vFoamObjectPosition.z + 1.2) * 0.24 + vRainProgress * 0.22, 0.0, 1.0));
        controlledFoamColor = mix(controlledFoamColor, rainDepthTint, (1.0 - step(0.5, vRainForm)) * 0.68);
        float impactContactFlash = step(0.5, vRainForm) * exp(-length(vFoamObjectPosition.xz) * 3.2) * (1.0 - smoothstep(0.08, 0.58, vFoamObjectPosition.y));
        vec3 color = controlledFoamColor * vFoamColor * rainStreak * rainDirectionalSheen * rainRefractionBand * rainTransmission * rainTailFade * foamCrest * rim * rainBurstLuminanceLift * 1.42;
        color += uSecondaryColor * rainMicroRivulet * 0.34;
        color += uSecondaryColor * rainFacetGlint * (0.18 + rainMicroRivulet * 0.28);
        color += uSecondaryColor * rainCordSpecular * 0.78;
        color += mix(uPrimaryColor, uSecondaryColor, 0.68) * rainBackscatter * 0.22;
        color += uSecondaryColor * impactContactFlash * 0.62;
        float formAlpha = vRainForm > 2.5 ? 0.96 : vRainForm < 0.5 ? 0.9 : vRainForm < 1.5 ? 0.96 : 0.78;
        float alpha = uOpacity * vFoamVisibility * formAlpha * rainTailFade * mix(0.82, 1.08, uDensity) * mix(0.9, 1.08, uEdgeHardness);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
      }
    `,
  })
  material.userData['pfxRainBurstMaterial'] = true
  material.userData['pfxRainBurstMaterialRole'] = 'foam'
  material.userData['pfxRainBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxRainBurstMaterialProfile'] = 'closed-rain-needles-and-ground-contact-foam'
  return material
}
