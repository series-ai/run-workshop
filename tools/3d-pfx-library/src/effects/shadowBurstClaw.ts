import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxShadowBurstClawGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const handPivot = new THREE.Vector3(0, 0.36, 0)
  const presentationYawRadians = 0.35
  const handDepthScale = 1.5
  const handRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, presentationYawRadians, -0.12))
  const transformHandPoint = (point: THREE.Vector3) => point.sub(handPivot).applyQuaternion(handRotation).add(handPivot)
  const appendPrimitive = (
    source: THREE.BufferGeometry,
    center: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3,
    direction: THREE.Vector3,
    seed: number,
    form: number,
  ) => {
    const raw = source.index ? source.toNonIndexed() : source
    const position = raw.getAttribute('position')
    const depthCenter = center.clone()
    depthCenter.z *= handDepthScale
    const worldCenter = transformHandPoint(depthCenter)
    const depthDirection = new THREE.Vector3(direction.x, direction.y, direction.z * handDepthScale).normalize()
    const worldDirection = depthDirection.applyQuaternion(handRotation).normalize()
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      point.z *= handDepthScale
      transformHandPoint(point)
      positions.push(point.x, point.y, point.z)
      centers.push(worldCenter.x, worldCenter.y, worldCenter.z)
      seeds.push(seed)
      directions.push(worldDirection.x, worldDirection.y, worldDirection.z)
      forms.push(form)
    }
    if (raw !== source) raw.dispose()
    source.dispose()
  }
  const appendCapsule = (start: THREE.Vector3, end: THREE.Vector3, radius: number, direction: THREE.Vector3, seed: number, form = 1) => {
    const segment = new THREE.Vector3().subVectors(end, start)
    const length = segment.length()
    segment.normalize()
    appendPrimitive(
      new THREE.CapsuleGeometry(radius, Math.max(0.012, length - radius * 2), 1, 7),
      new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), segment),
      new THREE.Vector3(1, 1, 1),
      direction,
      seed,
      form,
    )
  }
  const appendContinuousFinger = (path: THREE.Vector3[], radii: number[], seed: number) => {
    const radialSegments = 7
    const centroid = path.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / path.length)
    const rings = path.map((point, index) => {
      const tangent = index === 0
        ? new THREE.Vector3().subVectors(path[1]!, point).normalize()
        : index === path.length - 1
        ? new THREE.Vector3().subVectors(point, path[index - 1]!).normalize()
        : new THREE.Vector3().subVectors(path[index + 1]!, path[index - 1]!).normalize()
      const reference = Math.abs(tangent.z) < 0.86 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
      const normalA = new THREE.Vector3().crossVectors(tangent, reference).normalize()
      const normalB = new THREE.Vector3().crossVectors(tangent, normalA).normalize()
      return Array.from({ length: radialSegments }, (_, radialIndex) => {
        const angle = radialIndex / radialSegments * Math.PI * 2
        return point.clone()
          .addScaledVector(normalA, Math.cos(angle) * radii[index]!)
          .addScaledVector(normalB, Math.sin(angle) * radii[index]!)
          .sub(centroid)
      })
    })
    const tubePositions: number[] = []
    const appendTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => tubePositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
      const ring = rings[ringIndex]!
      const nextRing = rings[ringIndex + 1]!
      for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
        const nextRadialIndex = (radialIndex + 1) % radialSegments
        appendTriangle(ring[radialIndex]!, nextRing[radialIndex]!, nextRing[nextRadialIndex]!)
        appendTriangle(ring[radialIndex]!, nextRing[nextRadialIndex]!, ring[nextRadialIndex]!)
      }
    }
    const localStart = path[0]!.clone().sub(centroid)
    const localEnd = path.at(-1)!.clone().sub(centroid)
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadialIndex = (radialIndex + 1) % radialSegments
      appendTriangle(localStart, rings[0]![nextRadialIndex]!, rings[0]![radialIndex]!)
      appendTriangle(localEnd, rings.at(-1)![radialIndex]!, rings.at(-1)![nextRadialIndex]!)
    }
    const source = new THREE.BufferGeometry()
    source.setAttribute('position', new THREE.Float32BufferAttribute(tubePositions, 3))
    appendPrimitive(
      source,
      centroid,
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3().subVectors(path.at(-1)!, path[0]!).normalize(),
      seed,
      1,
    )
  }

  const palmLobes = [
    { center: new THREE.Vector3(0, 0.37, 0), scale: new THREE.Vector3(0.43, 0.5, 0.27), seed: 0.04 },
    { center: new THREE.Vector3(-0.17, 0.24, 0.025), scale: new THREE.Vector3(0.13, 0.19, 0.095), seed: 0.12 },
    { center: new THREE.Vector3(0.17, 0.31, -0.02), scale: new THREE.Vector3(0.125, 0.2, 0.09), seed: 0.2 },
  ] as const
  palmLobes.forEach((lobe, index) => appendPrimitive(
    new THREE.IcosahedronGeometry(1, index === 0 ? 2 : 1),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.09, index * -0.13, index * 0.07)),
    lobe.scale,
    new THREE.Vector3(0, 1, 0),
    lobe.seed,
    0,
  ))

  const fingerDepthLanes = [0.3, -0.28, 0, 0.24, -0.32] as const
  const fingers = [
    { start: new THREE.Vector3(-0.3, 0.26, fingerDepthLanes[0]), bends: [new THREE.Vector3(-0.18, 0.05, 0.11), new THREE.Vector3(-0.16, 0.1, 0.07), new THREE.Vector3(-0.12, 0.11, 0.03)], seed: 0.12 },
    { start: new THREE.Vector3(-0.25, 0.61, fingerDepthLanes[1]), bends: [new THREE.Vector3(-0.12, 0.29, -0.06), new THREE.Vector3(-0.04, 0.29, -0.035), new THREE.Vector3(0.06, 0.23, 0.015)], seed: 0.24 },
    { start: new THREE.Vector3(-0.08, 0.69, fingerDepthLanes[2]), bends: [new THREE.Vector3(-0.02, 0.33, 0.02), new THREE.Vector3(0.05, 0.31, -0.015), new THREE.Vector3(0.1, 0.24, 0)], seed: 0.36 },
    { start: new THREE.Vector3(0.1, 0.66, fingerDepthLanes[3]), bends: [new THREE.Vector3(0.07, 0.3, 0.07), new THREE.Vector3(0.09, 0.27, 0.05), new THREE.Vector3(0.04, 0.21, 0.025)], seed: 0.48 },
    { start: new THREE.Vector3(0.25, 0.56, fingerDepthLanes[4]), bends: [new THREE.Vector3(0.16, 0.23, -0.09), new THREE.Vector3(0.13, 0.21, -0.05), new THREE.Vector3(0.03, 0.17, -0.025)], seed: 0.6 },
  ] as const
  let fingerSegmentCount = 0
  let fingerRingCount = 0
  let knuckleCount = 0
  let clawTipCount = 0
  let clawTipSegmentCount = 0
  fingers.forEach((finger, fingerIndex) => {
    const fingerPath = [finger.start.clone()]
    finger.bends.forEach((bend) => fingerPath.push(fingerPath.at(-1)!.clone().add(bend)))
    appendContinuousFinger(fingerPath, fingerIndex === 0 ? [0.07, 0.06, 0.05, 0.038] : [0.086, 0.073, 0.057, 0.041], finger.seed)
    const start = fingerPath.at(-1)!
    const finalDirection = new THREE.Vector3().subVectors(start, fingerPath.at(-2)!).normalize()
    fingerSegmentCount += fingerPath.length - 1
    fingerRingCount += fingerPath.length
    appendPrimitive(
      new THREE.IcosahedronGeometry(1, 1),
      finger.start,
      new THREE.Quaternion(),
      new THREE.Vector3(0.115, 0.105, 0.095),
      finalDirection,
      finger.seed,
      2,
    )
    knuckleCount += 1
    const bendAxis = new THREE.Vector3().crossVectors(finalDirection, new THREE.Vector3(0, 0, 1))
    if (bendAxis.lengthSq() < 1e-4) bendAxis.set(1, 0, 0)
    bendAxis.normalize().multiplyScalar(fingerIndex % 2 === 0 ? 1 : -1)
    const clawMiddle = start.clone().addScaledVector(finalDirection, 0.1).addScaledVector(bendAxis, 0.025)
    const firstClawDirection = new THREE.Vector3().subVectors(clawMiddle, start)
    const firstClawLength = firstClawDirection.length()
    firstClawDirection.normalize()
    appendPrimitive(
      new THREE.CylinderGeometry(0.034, 0.056 - fingerIndex * 0.003, firstClawLength, 8, 1, false),
      new THREE.Vector3().addVectors(start, clawMiddle).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), firstClawDirection),
      new THREE.Vector3(1, 1, 1),
      firstClawDirection,
      finger.seed,
      3,
    )
    const secondClawDirection = finalDirection.clone().addScaledVector(bendAxis, 0.62).normalize()
    const clawEnd = clawMiddle.clone().addScaledVector(secondClawDirection, 0.11 - fingerIndex * 0.004)
    appendPrimitive(
      new THREE.ConeGeometry(0.036, clawMiddle.distanceTo(clawEnd), 8, 2, false),
      new THREE.Vector3().addVectors(clawMiddle, clawEnd).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), secondClawDirection),
      new THREE.Vector3(1, 1, 1),
      secondClawDirection,
      finger.seed + 0.012,
      3,
    )
    clawTipCount += 1
    clawTipSegmentCount += 2
  })

  const palmRidges = fingers.map((finger, index) => {
    const start = finger.start.clone()
    start.z = 0.225 + (index % 2) * 0.012
    const end = new THREE.Vector3(finger.start.x * 0.42, 0.1 + index * 0.024, 0.23 - (index % 2) * 0.012)
    return { start, end, seed: finger.seed + 0.018 }
  })
  palmRidges.forEach((ridge, index) => {
    const direction = new THREE.Vector3().subVectors(ridge.start, ridge.end).normalize()
    appendCapsule(ridge.end, ridge.start, 0.027 + (index % 2) * 0.004, direction, ridge.seed, 5)
  })

  const wristSmokeLobes = [
    { center: new THREE.Vector3(-0.13, -0.04, 0.07), scale: new THREE.Vector3(0.1, 0.14, 0.09), seed: 0.16 },
    { center: new THREE.Vector3(0.03, -0.11, -0.035), scale: new THREE.Vector3(0.11, 0.15, 0.1), seed: 0.34 },
    { center: new THREE.Vector3(0.18, -0.06, 0.025), scale: new THREE.Vector3(0.095, 0.13, 0.085), seed: 0.52 },
  ] as const
  wristSmokeLobes.forEach((lobe, index) => appendPrimitive(
    new THREE.IcosahedronGeometry(1, 1),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1 * index, -0.14 * index, 0.08 * index)),
    lobe.scale,
    new THREE.Vector3((index - 1) * 0.3, -1, index % 2 ? -0.2 : 0.2).normalize(),
    lobe.seed,
    4,
  ))

  const groundShadowLobes = [
    { center: new THREE.Vector3(-0.3, -0.2, 0.08), scale: new THREE.Vector3(0.5, 0.055, 0.34), seed: 0.7 },
    { center: new THREE.Vector3(0.18, -0.21, -0.2), scale: new THREE.Vector3(0.44, 0.05, 0.3), seed: 0.8 },
    { center: new THREE.Vector3(0.34, -0.19, 0.22), scale: new THREE.Vector3(0.34, 0.045, 0.26), seed: 0.9 },
  ] as const
  groundShadowLobes.forEach((lobe, index) => appendPrimitive(
    new THREE.IcosahedronGeometry(1, 1),
    lobe.center,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index * 0.34, index * -0.08)),
    lobe.scale,
    new THREE.Vector3(lobe.center.x, -0.2, lobe.center.z).normalize(),
    lobe.seed,
    4,
  ))
  const groundTendrils = Array.from({ length: 5 }, (_, index) => {
    const angle = -2.56 + index * 1.18
    const start = new THREE.Vector3(Math.cos(angle) * 0.16, -0.2, Math.sin(angle) * 0.13)
    const middle = new THREE.Vector3(Math.cos(angle + 0.16) * 0.46, -0.195, Math.sin(angle + 0.16) * 0.34)
    const end = new THREE.Vector3(Math.cos(angle - 0.1) * 0.76, -0.19, Math.sin(angle - 0.1) * 0.55)
    return { start, middle, end, seed: 0.72 + index * 0.045 }
  })
  groundTendrils.forEach((tendril) => {
    const direction = new THREE.Vector3().subVectors(tendril.end, tendril.start).normalize()
    appendCapsule(tendril.start, tendril.middle, 0.043, direction, tendril.seed, 4)
    appendCapsule(tendril.middle, tendril.end, 0.026, direction, tendril.seed + 0.016, 4)
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
  geometry.userData['pfxShadowBurstClawDrawCalls'] = 1
  geometry.userData['pfxShadowBurstClawClosedFaces'] = true
  geometry.userData['pfxShadowBurstClawSmoothNormals'] = true
  geometry.userData['pfxShadowBurstBillboardCount'] = 0
  geometry.userData['pfxShadowBurstPalmLobeCount'] = palmLobes.length
  geometry.userData['pfxShadowBurstFingerCount'] = fingers.length
  geometry.userData['pfxShadowBurstFingerSegmentCount'] = fingerSegmentCount
  geometry.userData['pfxShadowBurstFingerRingCount'] = fingerRingCount
  geometry.userData['pfxShadowBurstFingerPrimitive'] = 'continuous-closed-seven-sided-tapered-tube'
  geometry.userData['pfxShadowBurstFingerDepthLaneCount'] = fingerDepthLanes.length
  geometry.userData['pfxShadowBurstKnuckleCount'] = knuckleCount
  geometry.userData['pfxShadowBurstClawTipCount'] = clawTipCount
  geometry.userData['pfxShadowBurstClawTipSegmentCount'] = clawTipSegmentCount
  geometry.userData['pfxShadowBurstPalmRidgeCount'] = palmRidges.length
  geometry.userData['pfxShadowBurstPresentationYawRadians'] = presentationYawRadians
  geometry.userData['pfxShadowBurstHandDepthScale'] = handDepthScale
  geometry.userData['pfxShadowBurstPalmAnchorProfile'] = 'single-dominant-palm-with-subordinate-thenar-lobes'
  geometry.userData['pfxShadowBurstWristSmokeMaximumScale'] = 0.15
  geometry.userData['pfxShadowBurstThumbLengthRatio'] = 0.76
  geometry.userData['pfxShadowBurstWristSmokeLobeCount'] = wristSmokeLobes.length
  geometry.userData['pfxShadowBurstGroundShadowLobeCount'] = groundShadowLobes.length
  geometry.userData['pfxShadowBurstGroundTendrilCount'] = groundTendrils.length
  geometry.userData['pfxShadowBurstFingerDepthLaneSpread'] = Math.max(...fingerDepthLanes) - Math.min(...fingerDepthLanes)
  geometry.userData['pfxShadowBurstCompleteRingCount'] = 0
  geometry.userData['pfxShadowBurstClawProfile'] = 'three-lobe-shadow-palm-with-five-raised-metacarpal-ridges-five-depth-splayed-continuous-articulated-fingers-five-two-segment-violet-claws-three-wrist-smoke-lobes-and-three-irregular-ground-shadow-lobes'
  geometry.userData['pfxShadowBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxShadowBurstClawTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBurstClawWidthSpan'] = width
  geometry.userData['pfxShadowBurstClawDepthSpan'] = depth
  geometry.userData['pfxShadowBurstClawHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxShadowBurstClawPlanarBalance'] = Math.min(width, depth) / Math.max(width, depth)
  return geometry
}

export function createPfxShadowBurstClawMaterial(
  opacity: number,
  primaryColor = '#101018',
  secondaryColor = '#4a4560',
  accentColor = '#b6c2d8',
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
    // Matches every sibling burst material: the ground-shadow hand is authored
    // half-sunk into the stage floor; depth testing would clip most of the
    // mesh and leave the effect invisible against dark backdrops.
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
      varying vec3 vClawNormal;
      varying vec3 vClawViewPosition;
      varying vec3 vClawLocal;
      varying float vClawSeed;
      varying float vClawForm;
      varying float vClawLife;
      void main() {
        float palmForm = 1.0 - step(0.5, pfxShadowBurstForm);
        float fingerForm = step(0.5, pfxShadowBurstForm) * (1.0 - step(1.5, pfxShadowBurstForm));
        float knuckleForm = step(1.5, pfxShadowBurstForm) * (1.0 - step(2.5, pfxShadowBurstForm));
        float tipForm = step(2.5, pfxShadowBurstForm) * (1.0 - step(3.5, pfxShadowBurstForm));
        float smokeForm = step(3.5, pfxShadowBurstForm) * (1.0 - step(4.5, pfxShadowBurstForm));
        float ridgeForm = step(4.5, pfxShadowBurstForm);
        float compressedFistReveal = 0.76;
        float readableCompressedTell = 0.58;
        float clawUnfurl = smoothstep(0.045 + pfxShadowBurstSeed * 0.018, 0.31 + pfxShadowBurstSeed * 0.025, uCycle);
        float foldedFingerPose = clawUnfurl;
        float radialClawExpansion = mix(0.78, 1.1, clawUnfurl);
        float knuckleRupture = smoothstep(0.025, 0.19, uCycle);
        float shadowDisperse = smoothstep(0.32, 0.62, uCycle);
        float clawRetraction = smoothstep(0.35, 0.64, uCycle);
        vec3 origin = vec3(0.0, 0.36, 0.0);
        vec3 local = position - pfxShadowBurstCenter;
        float palmScale = mix(0.82, 1.0, knuckleRupture) * mix(1.0, 0.68, shadowDisperse);
        float fingerScale = mix(readableCompressedTell, 1.0, foldedFingerPose) * mix(1.0, 0.46, clawRetraction);
        float supportScale = mix(0.82, 1.0, knuckleRupture) * mix(1.0, 0.55, clawRetraction);
        float smokeScale = mix(0.75, 1.0, knuckleRupture) * mix(1.0, 1.18, shadowDisperse);
        local *= palmScale * palmForm + fingerScale * (fingerForm + tipForm) + supportScale * (knuckleForm + ridgeForm) + smokeScale * smokeForm;
        vec3 foldedDigitCenter = origin + vec3(
          (pfxShadowBurstCenter.x - origin.x) * 0.7,
          clamp((pfxShadowBurstCenter.y - origin.y) * 0.4, -0.14, 0.34),
          (pfxShadowBurstCenter.z - origin.z) * 0.82
        );
        vec3 expandedDigitCenter = origin + (pfxShadowBurstCenter - origin) * radialClawExpansion;
        vec3 center = origin;
        center += (mix(origin, pfxShadowBurstCenter, mix(compressedFistReveal, 1.0, knuckleRupture)) - origin) * palmForm;
        vec3 unfurledDigitCenter = mix(foldedDigitCenter, expandedDigitCenter, foldedFingerPose);
        vec3 retractedDigitCenter = mix(unfurledDigitCenter, origin + (pfxShadowBurstCenter - origin) * 0.58, clawRetraction);
        center += (retractedDigitCenter - origin) * (fingerForm + tipForm);
        center += (mix(origin, pfxShadowBurstCenter, mix(0.9, 1.0, knuckleRupture)) - origin) * knuckleForm;
        center += (mix(origin, pfxShadowBurstCenter, mix(0.82, 1.0, knuckleRupture)) - origin) * ridgeForm;
        center += (mix(origin, pfxShadowBurstCenter, mix(0.68, 1.0, knuckleRupture)) - origin) * smokeForm;
        center += pfxShadowBurstDirection * shadowDisperse * (0.08 + pfxShadowBurstSeed * 0.2) * (fingerForm + tipForm + smokeForm + ridgeForm);
        center.y -= smokeForm * shadowDisperse * (0.12 + pfxShadowBurstSeed * 0.16);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vClawNormal = normalize(normalMatrix * normal);
        vClawViewPosition = viewPosition.xyz;
        vClawLocal = local;
        vClawSeed = pfxShadowBurstSeed;
        vClawForm = pfxShadowBurstForm;
        float birth = smoothstep(0.0, 0.028 + pfxShadowBurstSeed * 0.008, uCycle);
        float handSilhouetteCarry = 1.0 - smoothstep(0.56, 0.72, uCycle);
        float recoveryHandSilhouette = smoothstep(0.34, 0.46, uCycle) * (1.0 - smoothstep(0.68, 0.82, uCycle));
        float shadowDecaySilhouetteCarry = smoothstep(0.42, 0.56, uCycle) * (1.0 - smoothstep(0.78, 0.92, uCycle));
        float retirement = 1.0 - smoothstep(0.36 + pfxShadowBurstSeed * 0.016, 0.64, uCycle);
        retirement = max(retirement, max(handSilhouetteCarry * 0.12, max(recoveryHandSilhouette * 0.72, shadowDecaySilhouetteCarry * 0.58)));
        vClawLife = birth * retirement * mix(0.88, 1.0, uDensity);
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
      uniform float uDensity;
      varying vec3 vClawNormal;
      varying vec3 vClawViewPosition;
      varying vec3 vClawLocal;
      varying float vClawSeed;
      varying float vClawForm;
      varying float vClawLife;
      void main() {
        vec3 normal = normalize(vClawNormal);
        vec3 hardFacetNormal = normalize(cross(dFdx(vClawViewPosition), dFdy(vClawViewPosition)));
        if (dot(hardFacetNormal, normal) < 0.0) hardFacetNormal *= -1.0;
        normal = normalize(mix(normal, hardFacetNormal, 0.46));
        vec3 viewDirection = normalize(-vClawViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(2.1, 0.68, uStyleEdgeHardness));
        float fingerForm = step(0.5, vClawForm) * (1.0 - step(1.5, vClawForm));
        float knuckleForm = step(1.5, vClawForm) * (1.0 - step(2.5, vClawForm));
        float tipForm = step(2.5, vClawForm) * (1.0 - step(3.5, vClawForm));
        float smokeForm = step(3.5, vClawForm) * (1.0 - step(4.5, vClawForm));
        float ridgeForm = step(4.5, vClawForm);
        float palmForm = 1.0 - max(max(fingerForm, knuckleForm), max(max(tipForm, smokeForm), ridgeForm));
        vec3 keyDirection = normalize(vec3(-0.52, 0.7, 0.48));
        vec3 fillDirection = normalize(vec3(0.68, -0.08, -0.72));
        float keyLight = max(0.0, dot(normal, keyDirection));
        float fillLight = max(0.0, dot(normal, fillDirection));
        float shadowSkinFalloff = 0.2 + keyLight * 0.32 + fillLight * 0.19 + facing * 0.08;
        float readableShadowValueLift = 0.12 + uDensity * 0.1;
        float spectralPalmRim = rim * (0.72 + palmForm * 0.26 + smokeForm * 0.18);
        float coldVoidRim = rim * (0.42 + keyLight * 0.34 + fillLight * 0.18);
        float onsetSpectralTell = 1.0 - smoothstep(0.1, 0.25, uCycle);
        float distributedColdRim = coldVoidRim * (0.46 + fingerForm * 0.18 + palmForm * 0.24 + ridgeForm * 0.3);
        float clawTipEmission = tipForm * (0.86 + 0.14 * sin(vClawSeed * 41.0 + uCycle * 19.0));
        float sculptedClawHighlight = tipForm * (0.2 + keyLight * 0.46 + fillLight * 0.18 + rim * 0.16);
        float coldBoneAccent = (tipForm + ridgeForm) * (0.28 + keyLight * 0.46 + rim * 0.2);
        float palmBoneOcclusion = palmForm * (0.12 + (1.0 - facing) * 0.16);
        float dorsalRidgeHighlight = ridgeForm * (0.3 + keyLight * 0.44 + rim * 0.26);
        float palmSpecular = pow(max(0.0, dot(normal, normalize(viewDirection + keyDirection))), 18.0) * (palmForm + ridgeForm);
        float murkyPalmRange = palmForm * (0.2 + shadowSkinFalloff * 0.44);
        float palmAnchorContrast = palmForm * (0.18 + keyLight * 0.25 + fillLight * 0.18);
        float shadowVeinPattern = (palmForm + fingerForm) * smoothstep(0.78, 0.96, 0.5 + 0.5 * sin(vClawLocal.x * 19.0 + vClawLocal.y * 27.0 + vClawSeed * 43.0));
        float jointFacet = knuckleForm * pow(max(0.0, keyLight), 3.0);
        float smokeVeil = smokeForm * (0.45 + 0.22 * sin(vClawLocal.y * 16.0 + vClawSeed * 37.0));
        float articulatedRange = 0.3 + shadowSkinFalloff * 0.62 + fingerForm * 0.08;
        float paletteRange = mix(articulatedRange, murkyPalmRange, palmForm);
        paletteRange = mix(paletteRange, 0.18 + shadowSkinFalloff * 0.28, smokeForm);
        vec3 color = mix(uPrimaryColor * 4.8, uSecondaryColor * 3.0, clamp(paletteRange, 0.0, 1.0));
        float sculptedValuePlane = clamp(0.46 + dot(normal, normalize(vec3(-0.32, 0.81, 0.49))) * 0.54, 0.0, 1.0);
        color += uSecondaryColor * readableShadowValueLift * (0.42 + palmForm * 0.4 + fingerForm * 0.22);
        color *= mix(0.92, 1.34, sculptedValuePlane);
        float shadowVoidCore = palmForm * (1.0 - sculptedValuePlane) * (0.48 + facing * 0.32);
        float recoveryShadowRim = smoothstep(0.34, 0.48, uCycle) * (1.0 - smoothstep(0.7, 0.82, uCycle)) * rim;
        float decaySilhouetteLift = smoothstep(0.34, 0.48, uCycle) * (1.0 - smoothstep(0.74, 0.86, uCycle));
        float shadowEnergyRim = rim * (0.52 + fingerForm * 0.18 + palmForm * 0.12 + ridgeForm * 0.2);
        float palmVolumeLift = (palmForm + fingerForm) * (0.12 + sculptedValuePlane * 0.24 + keyLight * 0.1);
        float onsetBoneTell = onsetSpectralTell * (ridgeForm + fingerForm * 0.42 + tipForm * 0.68);
        float groundShadowVein = smokeForm * smoothstep(0.64, 0.94, 0.5 + 0.5 * sin(vClawLocal.x * 23.0 - vClawLocal.z * 19.0 + vClawSeed * 31.0));
        color = mix(color, uPrimaryColor * 0.24, shadowVoidCore * 0.45);
        color += uSecondaryColor * shadowEnergyRim * 0.9;
        color += uAccentColor * shadowEnergyRim * (tipForm * 0.36 + ridgeForm * 0.18 + palmForm * 0.06);
        color += uSecondaryColor * palmVolumeLift * 0.58;
        color += uAccentColor * onsetBoneTell * (0.2 + rim * 0.24);
        color += uSecondaryColor * groundShadowVein * (0.22 + rim * 0.28);
        color = mix(color, uPrimaryColor * 0.56, palmBoneOcclusion);
        color += uSecondaryColor * spectralPalmRim * 1.0;
        color += uAccentColor * distributedColdRim * 0.58;
        color += uSecondaryColor * onsetSpectralTell * (0.24 + palmForm * 0.16 + fingerForm * 0.12);
        color += uAccentColor * onsetSpectralTell * distributedColdRim * 0.34;
        color += uAccentColor * coldBoneAccent * 0.42;
        color += uSecondaryColor * palmAnchorContrast * 0.48;
        color = mix(color, uPrimaryColor * 0.34 + uAccentColor * rim * 0.16, shadowVeinPattern * 0.34);
        color += mix(uSecondaryColor, uAccentColor, 0.72) * dorsalRidgeHighlight * 0.64;
        color += uAccentColor * palmSpecular * 0.38;
        color += mix(uSecondaryColor, uAccentColor, 0.42) * jointFacet * 0.34;
        color = mix(color, uPrimaryColor * 0.46 + uSecondaryColor * rim * 0.34, smokeVeil);
        color = mix(color, uSecondaryColor * 0.72 + uAccentColor * sculptedClawHighlight, clawTipEmission * 0.46);
        color += uAccentColor * sculptedClawHighlight * 0.34;
        color += uAccentColor * recoveryShadowRim * (0.24 + fingerForm * 0.18 + palmForm * 0.1);
        color += uSecondaryColor * decaySilhouetteLift * (0.18 + rim * 0.24);
        color += uAccentColor * decaySilhouetteLift * rim * (0.3 + fingerForm * 0.16);
        color += uSecondaryColor * fingerForm * keyLight * 0.26;
        float moonlitBonePlane = pow(max(0.0, dot(normal, normalize(vec3(0.18, 0.94, -0.29)))), 3.0);
        color += uAccentColor * moonlitBonePlane * (0.14 + tipForm * 0.14 + ridgeForm * 0.12 + palmForm * 0.08);
        float decayRecoveryFill = smoothstep(0.4, 0.56, uCycle) * (1.0 - smoothstep(0.76, 0.9, uCycle));
        color += mix(uSecondaryColor, uAccentColor, 0.62) * decayRecoveryFill * (0.07 + rim * 0.11);
        // Shadow contract: retain a charcoal body and reserve the slate value
        // for articulated rims/tips. The body still needs a controlled value
        // lift against the dark gameplay stage, so the final palette lock is
        // applied after every lighting term.
        float slateReadabilityRange = clamp(rim * 0.72 + tipForm * 0.2 + ridgeForm * 0.16, 0.0, 0.84);
        float shadowVisibleCharcoalLift = clamp(0.2 + (1.0 - shadowVoidCore) * 0.18 + palmForm * 0.08, 0.0, 0.42);
        vec3 nearBlackBodyMix = mix(uPrimaryColor * (1.9 + shadowVisibleCharcoalLift), uSecondaryColor * (2.7 + shadowVisibleCharcoalLift * 1.4), clamp(0.28 + paletteRange * 0.56 + shadowVoidCore * 0.2, 0.0, 0.92));
        vec3 restrainedSlateRim = mix(uSecondaryColor * (2.4 + shadowVisibleCharcoalLift), uAccentColor * 0.9, slateReadabilityRange);
        vec3 shadowLockedColor = mix(nearBlackBodyMix, restrainedSlateRim, slateReadabilityRange);
        float shadowExposureFloor = 0.62 + (1.0 - shadowVoidCore) * 0.18 + rim * 0.12;
        float shadowNativeReadabilityFloor = 0.16 + palmForm * 0.08 + fingerForm * 0.04 + (1.0 - smokeForm) * 0.06;
        vec3 visibleCharcoalFloor = mix(uPrimaryColor * 2.9, uSecondaryColor * 1.42, slateReadabilityRange) * (shadowExposureFloor + shadowNativeReadabilityFloor);
        color = max(mix(color, shadowLockedColor, 0.84), visibleCharcoalFloor);
        float shadowValueCeiling = 0.82 + rim * 0.06 + tipForm * 0.03;
        color = min(color, vec3(shadowValueCeiling, shadowValueCeiling * 1.05, shadowValueCeiling * 1.18));
        float alpha = uOpacity * vClawLife * (0.94 + facing * 0.05 + rim * 0.04);
        alpha *= mix(1.0, 0.74, smokeForm);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxShadowBurstMaterial'] = true
  material.userData['pfxShadowBurstMaterialRole'] = 'spectral-claw'
  material.userData['pfxShadowBurstMaterialProfile'] = 'near-black-shadow-skin-with-cold-slate-volume-moonlit-claw-planes-and-a-hard-value-ceiling'
  material.userData['pfxShadowBurstReadableValueProfile'] = 'visible-charcoal-body-with-slate-rim-not-frost'
  material.userData['pfxShadowBurstValueCeilingProfile'] = 'charcoal-body-with-readable-slate-rim-max-0.82'
  material.userData['pfxShadowBurstExposureFloorProfile'] = 'visible-against-dark-stage-minimum-luminance'
  return material
}
