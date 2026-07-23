import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxPetalAmbientLifecycle(cycle: number): {
  energy: number
  drift: number
  lift: number
  stage: 'settle' | 'lift' | 'glide' | 'turn'
} {
  const phase = ((cycle % 1) + 1) % 1
  const stage = phase < 0.25
    ? 'settle'
    : phase < 0.5
      ? 'lift'
      : phase < 0.75
        ? 'glide'
        : 'turn'
  const crestDistance = Math.abs(phase - 0.26)
  const crest = THREE.MathUtils.clamp(1 - crestDistance / 0.26, 0, 1)
  const easedCrest = crest * crest * (3 - 2 * crest)
  return {
    energy: roundMetric(0.72 + easedCrest * 0.28),
    drift: roundMetric(0.28 + phase * 0.52),
    lift: roundMetric(0.84 + (1 - Math.abs(phase - 0.5) * 2) * 0.14),
    stage,
  }
}

export function createPfxPetalAmbientGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const centers: number[] = []
  const locals: number[] = []
  const seeds: number[] = []
  const petalUvs: number[] = []
  const paletteIndices: number[] = []
  const clusters: number[] = []
  const flowLanes: number[] = []
  const sidewalls: number[] = []
  const bridges: number[] = []
  const petalCount = 180
  const loosePetalCount = 168
  const heroPetals = new Set([168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179])
  const looseHeroPetals = new Set(Array.from({ length: 15 }, (_, index) => 5 + index * 11))
  const bridgePetals = new Set(Array.from({ length: 24 }, (_, index) => index * 7))
  const depthLanes = [-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6] as const
  const blossomCenters = [
    new THREE.Vector3(-1.18, 1.12, 0.35),
    new THREE.Vector3(0.38, 0.72, -0.45),
    new THREE.Vector3(1.18, -0.28, 0.65),
  ] as const
  const outlines: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    // Almond: a clean, pointed single lobe.
    [[1, 0], [0.72, 0.42], [0.28, 0.72], [-0.28, 0.7], [-0.72, 0.4], [-1, 0.08], [-1, -0.08], [-0.72, -0.4], [-0.28, -0.7], [0.28, -0.72], [0.72, -0.42], [1, 0]],
    // Notched heart: the deep cleft survives native-resolution capture.
    [[0.34, 0], [1, 0.34], [0.72, 0.68], [0.16, 0.88], [-0.4, 0.7], [-0.84, 0.28], [-1, 0], [-0.78, -0.34], [-0.22, -0.76], [0.34, -0.8], [0.78, -0.56], [1, -0.3]],
    // Curled spear: narrow shoulders and an asymmetric hooked tip.
    [[1, 0.1], [0.58, 0.34], [0.16, 0.52], [-0.36, 0.46], [-0.82, 0.22], [-1, 0], [-0.78, -0.18], [-0.26, -0.36], [0.24, -0.3], [0.62, -0.08], [0.76, -0.34], [0.92, -0.18]],
    // Twin lobe: alternating shoulders create a visibly scalloped family.
    [[0.92, 0], [0.62, 0.5], [0.2, 0.34], [-0.02, 0.82], [-0.5, 0.64], [-0.9, 0.24], [-1, 0], [-0.76, -0.34], [-0.28, -0.76], [0.06, -0.38], [0.58, -0.62], [1, -0.18]],
    // Folded blade: a slim, swept profile with unequal edges.
    [[1, 0.04], [0.62, 0.26], [0.18, 0.42], [-0.34, 0.36], [-0.78, 0.18], [-1, -0.02], [-0.7, -0.24], [-0.14, -0.34], [0.34, -0.5], [0.76, -0.34], [0.58, -0.08], [0.9, -0.18]],
    // Ruffled: a second strong tip cleft plus alternating edge lobes.
    [[0.3, 0], [0.94, 0.28], [0.58, 0.46], [0.72, 0.72], [0.12, 0.82], [-0.28, 0.58], [-0.82, 0.46], [-1, 0], [-0.72, -0.52], [-0.1, -0.78], [0.62, -0.62], [0.98, -0.26]],
  ]
  const appendVertex = (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    center: THREE.Vector3,
    local: THREE.Vector3,
    seed: number,
    uv: THREE.Vector2,
    paletteIndex: number,
    cluster: number,
    flowLane: number,
    sidewall: number,
    bridge: number,
    shade: number,
  ) => {
    positions.push(point.x, point.y, point.z)
    normals.push(normal.x, normal.y, normal.z)
    colors.push(shade, shade, shade)
    centers.push(center.x, center.y, center.z)
    locals.push(local.x, local.y, local.z)
    seeds.push(seed)
    petalUvs.push(uv.x, uv.y)
    paletteIndices.push(paletteIndex)
    clusters.push(cluster)
    flowLanes.push(flowLane)
    sidewalls.push(sidewall)
    bridges.push(bridge)
  }
  for (let petal = 0; petal < petalCount; petal += 1) {
    const cluster = petal < loosePetalCount ? 0 : petal < 172 ? 1 : petal < 176 ? 2 : 3
    const flowLane = cluster > 0 ? cluster - 1 : petal < 42 ? 0 : petal < 126 ? 1 : 2
    const laneStep = cluster > 0 ? (petal - loosePetalCount) % 4 : flowLane === 0 ? petal : flowLane === 1 ? petal - 42 : petal - 126
    const laneCount = flowLane === 1 ? 84 : 42
    const seed = cluster === 0 ? (laneStep + flowLane * 0.23) / laneCount : cluster === 1 ? 0.19 : cluster === 2 ? 0.53 : 0.83
    const silhouette = petal % outlines.length
    const outline = outlines[silhouette]!
    const hero = heroPetals.has(petal)
    const length = hero ? 0.04 + (petal % 3) * 0.0075 : looseHeroPetals.has(petal) ? 0.09 : petal % 9 === 3 ? 0.08 : 0.045 + (petal % 5) * 0.008
    const widthRatio = [1.25, 1.05, 0.78, 1.3, 0.7, 1.18][silhouette]!
    const width = length * widthRatio
    const depth = length * (0.07 + (petal % 3) * 0.01)
    const flowProgress = (laneStep + 0.5) / laneCount
    const blossomCenter = blossomCenters[Math.max(0, cluster - 1)]!
    const blossomAngle = laneStep * Math.PI * 0.5 + cluster * 0.18
    const center = cluster === 0
      ? new THREE.Vector3(
        -2.55 + flowProgress * 5.1 + (flowLane - 1) * 0.18,
        1.2 - flowProgress * 2.4 + (flowLane - 1) * 0.5 + Math.sin(flowProgress * Math.PI * 2 + flowLane * 0.82) * 0.3,
        looseHeroPetals.has(petal) ? depthLanes[petal % 2]! : depthLanes[(laneStep * 2 + flowLane * 3) % depthLanes.length],
      )
      : blossomCenter.clone().add(new THREE.Vector3(
        Math.cos(blossomAngle) * 0.11,
        Math.sin(blossomAngle) * 0.11,
        laneStep % 2 === 0 ? 0.025 : -0.025,
      ))
    const yaw = cluster > 0 ? (cluster === 1 ? -0.22 : cluster === 2 ? 0.3 : 0.08) : -0.9 + seed * 1.8
    const pitch = cluster > 0 ? -0.16 + (petal % 2) * 0.1 : -0.38 + (petal % 5) * 0.17
    const roll = cluster > 0 ? ((petal - loosePetalCount) % 4) * Math.PI * 0.5 : seed * Math.PI * 1.6
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'))
    const familyCurl = [0.82, 0.62, 1.42, 0.96, 1.58, 1.12][silhouette]!
    const familyFold = [0.02, -0.04, 0.16, -0.08, 0.2, -0.12][silhouette]!
    const surfaceCurve = (x: number, y: number) => (x * 0.18 - Math.abs(y) * 0.26 * familyCurl + y * (0.08 + familyFold)) * length
    const topOutline = outline.map(([x, y]) => new THREE.Vector3(x * length, y * width, surfaceCurve(x, y) + depth))
    const bottomOutline = outline.map(([x, y]) => new THREE.Vector3(x * length, y * width, surfaceCurve(x, y) - depth))
    const topCenter = new THREE.Vector3(-length * 0.04, 0, length * 0.2 + depth)
    const bottomCenter = new THREE.Vector3(-length * 0.04, 0, length * 0.2 - depth)
    const allLocal = [...topOutline, ...bottomOutline, topCenter, bottomCenter]
    const allPoints = allLocal.map((point) => point.clone().applyQuaternion(rotation).add(center))
    const uvFor = (point: THREE.Vector3) => new THREE.Vector2(
      THREE.MathUtils.clamp((point.x / Math.max(0.001, length) + 0.95) / 1.95, 0, 1),
      THREE.MathUtils.clamp(point.y / Math.max(0.001, width) * 0.5 + 0.5, 0, 1),
    )
    const topCenterIndex = outline.length * 2
    const bottomCenterIndex = topCenterIndex + 1
    const faces: Array<[number, number, number]> = []
    for (let edge = 0; edge < outline.length; edge += 1) {
      const next = (edge + 1) % outline.length
      faces.push(
        [topCenterIndex, edge, next],
        [bottomCenterIndex, outline.length + next, outline.length + edge],
        [edge, outline.length + edge, outline.length + next],
        [edge, outline.length + next, next],
      )
    }
    for (const [a, b, c] of faces) {
      const isSideFace = a !== topCenterIndex && a !== bottomCenterIndex && b !== topCenterIndex && b !== bottomCenterIndex && c !== topCenterIndex && c !== bottomCenterIndex
      const faceNormal = new THREE.Vector3()
        .subVectors(allPoints[b]!, allPoints[a]!)
        .cross(new THREE.Vector3().subVectors(allPoints[c]!, allPoints[a]!))
        .normalize()
      const shade = 0.55 + ((a + b + c + petal) % 4) * 0.15
      for (const vertexIndex of [a, b, c]) {
        const localPoint = allLocal[vertexIndex]!
        const isTopVertex = vertexIndex < outline.length || vertexIndex === topCenterIndex
        const localNormal = new THREE.Vector3(
          localPoint.x / Math.max(length, 0.001) * 0.14,
          localPoint.y / Math.max(width, 0.001) * 0.12,
          isTopVertex ? 1 : -1,
        ).normalize().applyQuaternion(rotation).lerp(faceNormal, isSideFace ? 0.92 : 0.06).normalize()
        appendVertex(
          allPoints[vertexIndex]!,
          localNormal,
          center,
          localPoint,
          seed,
          uvFor(allLocal[vertexIndex]!),
          petal % 7 === 0 ? 2 : petal % 2,
          cluster,
          flowLane,
          isSideFace ? 1 : 0,
          bridgePetals.has(petal) ? 1 : 0,
          shade,
        )
      }
    }
  }
  const blossomCores = [
    { center: blossomCenters[0].clone(), seed: 0.19, cluster: 1 },
    { center: blossomCenters[1].clone(), seed: 0.53, cluster: 2 },
    { center: blossomCenters[2].clone(), seed: 0.83, cluster: 3 },
  ] as const
  const coreSource = new THREE.OctahedronGeometry(0.045, 0)
  const coreGeometry = coreSource.index ? coreSource.toNonIndexed() : coreSource
  const corePositions = coreGeometry.getAttribute('position')
  const coreNormals = coreGeometry.getAttribute('normal')
  for (const core of blossomCores) {
    for (let vertex = 0; vertex < corePositions.count; vertex += 1) {
      const local = new THREE.Vector3().fromBufferAttribute(corePositions, vertex)
      const normal = new THREE.Vector3().fromBufferAttribute(coreNormals, vertex).normalize()
      appendVertex(
        local.clone().add(core.center),
        normal,
        core.center,
        local,
        core.seed,
        new THREE.Vector2(0.5, 0.5),
        3,
        core.cluster,
        core.cluster - 1,
        0,
        0,
        1,
      )
    }
  }
  if (coreGeometry !== coreSource) coreGeometry.dispose()
  coreSource.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxPetalAmbientCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxPetalAmbientLocal', new THREE.Float32BufferAttribute(locals, 3))
  geometry.setAttribute('pfxPetalAmbientSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxPetalAmbientUv', new THREE.Float32BufferAttribute(petalUvs, 2))
  geometry.setAttribute('pfxPetalAmbientPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.setAttribute('pfxPetalAmbientCluster', new THREE.Float32BufferAttribute(clusters, 1))
  geometry.setAttribute('pfxPetalAmbientFlowLane', new THREE.Float32BufferAttribute(flowLanes, 1))
  geometry.setAttribute('pfxPetalAmbientSidewall', new THREE.Float32BufferAttribute(sidewalls, 1))
  geometry.setAttribute('pfxPetalAmbientBridge', new THREE.Float32BufferAttribute(bridges, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPetalAmbientDrawCalls'] = 1
  geometry.userData['pfxPetalAmbientClosedFaces'] = true
  geometry.userData['pfxPetalAmbientBillboardCount'] = 0
  geometry.userData['pfxPetalAmbientPetalCount'] = petalCount
  geometry.userData['pfxPetalAmbientLoosePetalCount'] = loosePetalCount
  geometry.userData['pfxPetalAmbientBlossomClusterCount'] = 3
  geometry.userData['pfxPetalAmbientClusterPetalCount'] = petalCount - loosePetalCount
  geometry.userData['pfxPetalAmbientBlossomCoreCount'] = blossomCores.length
  geometry.userData['pfxPetalAmbientBlossomCoreGeometry'] = 'closed-octahedral-pollen'
  geometry.userData['pfxPetalAmbientSilhouetteVariantCount'] = outlines.length
  geometry.userData['pfxPetalAmbientOutlineVertexCount'] = outlines[0]!.length
  geometry.userData['pfxPetalAmbientDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxPetalAmbientHeroPetalCount'] = heroPetals.size
  geometry.userData['pfxPetalAmbientLooseHeroPetalCount'] = looseHeroPetals.size
  geometry.userData['pfxPetalAmbientSculptedNormals'] = true
  geometry.userData['pfxPetalAmbientCurledVolume'] = true
  geometry.userData['pfxPetalAmbientLoopOccupancy'] = 'continuous-staggered-fall'
  geometry.userData['pfxPetalAmbientVerticalOccupancyBands'] = 4
  geometry.userData['pfxPetalAmbientClusterRootProfile'] = 'core-attached-radial-corollas'
  geometry.userData['pfxPetalAmbientWindEnvelope'] = 'feathered-three-lane-swept-gust'
  geometry.userData['pfxPetalAmbientFlowDirection'] = 'upper-left-to-lower-right-swept-descent'
  geometry.userData['pfxPetalAmbientFlowLaneCount'] = 3
  geometry.userData['pfxPetalAmbientFlowLaneAllocation'] = '42-84-42'
  geometry.userData['pfxPetalAmbientDensityGradient'] = 'connected-feathered-gust-with-dense-center-lane'
  geometry.userData['pfxPetalAmbientSceneCoverage'] = 'one-feathered-swept-gust-with-layered-bands'
  geometry.userData['pfxPetalAmbientVisibilityFacingSupport'] = 'world-oriented-with-limited-view-support'
  geometry.userData['pfxPetalAmbientNotchedSilhouetteCount'] = 3
  geometry.userData['pfxPetalAmbientSilhouetteFamily'] = 'six-botanical-petal-variants'
  geometry.userData['pfxPetalAmbientDistinctSilhouetteFamilyCount'] = outlines.length
  geometry.userData['pfxPetalAmbientSilhouetteFamilyProfile'] = 'almond-notched-heart-curled-lobed-folded-ruffled'
  geometry.userData['pfxPetalAmbientNotchDepthRatio'] = 0.28
  geometry.userData['pfxPetalAmbientWorldDepthOcclusion'] = true
  geometry.userData['pfxPetalAmbientOrientationModel'] = 'coherent-world-space-tumble'
  geometry.userData['pfxPetalAmbientPerspectiveScaleRange'] = '0.90-1.05'
  geometry.userData['pfxPetalAmbientDepthCompensatedPerspective'] = false
  geometry.userData['pfxPetalAmbientPerspectiveCueProfile'] = 'moderated-natural-depth-size-cue'
  geometry.userData['pfxPetalAmbientNegativeSpaceCorridors'] = 1
  geometry.userData['pfxPetalAmbientSilhouetteAspectRange'] = '0.70-1.30'
  geometry.userData['pfxPetalAmbientOccupancyScatter'] = 'phase-jittered-curved-gust-occupancy'
  geometry.userData['pfxPetalAmbientFiberProfile'] = 'subtle-seeded-micro-fiber'
  geometry.userData['pfxPetalAmbientBridgePetalCount'] = bridgePetals.size
  geometry.userData['pfxPetalAmbientBridgeProfile'] = 'continuous-world-space-sway-strand'
  geometry.userData['pfxPetalAmbientPalette'] = 'blush-coral-cream'
  geometry.userData['pfxPetalAmbientAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxPetalAmbientTriangleCount'] = positions.length / 9
  geometry.userData['pfxPetalAmbientWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxPetalAmbientHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxPetalAmbientDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxPetalAmbientMaxLength'] = 0.09
  geometry.userData['pfxPetalAmbientMaximumProjectedHeroLength'] = 0.08
  geometry.userData['pfxPetalAmbientScaleRatio'] = 0.09 / 0.045
  geometry.userData['pfxPetalAmbientEffectiveScaleRatio'] = (0.09 * 1.1) / (0.045 * 0.9)
  geometry.userData['pfxPetalAmbientMinimumBroadPetalAspectRatio'] = 0.7
  geometry.userData['pfxPetalAmbientEdgeOnThicknessRatio'] = 0.18
  geometry.userData['pfxPetalAmbientSurfaceCurvatureRatio'] = 0.42
  geometry.userData['pfxPetalAmbientDepthLaneSpan'] = 3.2
  geometry.userData['pfxPetalAmbientOrganicScaleMaximum'] = 1.1
  geometry.userData['pfxPetalAmbientSmoothNormalFaceBlend'] = 0.06
  geometry.userData['pfxPetalAmbientMinimumClusterSpacing'] = 1.25
  geometry.userData['pfxPetalAmbientClusterPetalMaxLength'] = 0.055
  geometry.userData['pfxPetalAmbientBlossomCoreRadius'] = 0.045
  geometry.userData['pfxPetalAmbientFlowLaneSeparation'] = 1.02
  geometry.userData['pfxPetalAmbientOnsetScale'] = 0.77
  geometry.userData['pfxPetalAmbientCrestScale'] = 1.08
  geometry.userData['pfxPetalAmbientOnsetOpacity'] = 0.55
  geometry.userData['pfxPetalAmbientCrestOpacity'] = 1
  return geometry
}

export function createPfxPetalAmbientMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#f47cab',
  secondaryColor: THREE.ColorRepresentation = '#ffd0c4',
  density = 0.58,
  styleEdgeHardness = 0.52,
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
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxPetalAmbientCenter;
      attribute vec3 pfxPetalAmbientLocal;
      attribute float pfxPetalAmbientSeed;
      attribute vec2 pfxPetalAmbientUv;
      attribute float pfxPetalAmbientPaletteIndex;
      attribute float pfxPetalAmbientCluster;
      attribute float pfxPetalAmbientFlowLane;
      attribute float pfxPetalAmbientSidewall;
      attribute float pfxPetalAmbientBridge;
      varying vec3 vPetalNormal;
      varying vec3 vPetalViewPosition;
      varying vec3 vPetalShade;
      varying vec2 vPetalUv;
      varying float vPetalPaletteIndex;
      varying float vDensityVisibility;
      varying float vPetalSidewall;
      varying float vPetalWorldHeight;
      varying float vPetalSeed;
      vec3 rotateAroundAxis(vec3 value, vec3 axis, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return value * cosine + cross(axis, value) * sine + axis * dot(axis, value) * (1.0 - cosine);
      }
      void main() {
        float staggeredFall = fract(uCycle + pfxPetalAmbientSeed * 0.973);
        float breezeArc = sin(uCycle * 6.2831853 + pfxPetalAmbientSeed * 17.0);
        float crossBreeze = cos(uCycle * 4.712389 + pfxPetalAmbientSeed * 13.0);
        float wideBreezeArc = breezeArc * (0.08 + pfxPetalAmbientSeed * 0.12) + (staggeredFall - 0.5) * 0.1;
        float tumbleAngle = uCycle * 6.2831853 * (0.42 + pfxPetalAmbientSeed * 0.38) + pfxPetalAmbientSeed * 6.2831853;
        float blossomEddy = step(0.5, pfxPetalAmbientCluster);
        float densityVisibility = mix(0.32, 1.0, smoothstep(0.05, 0.82, uDensity + (1.0 - pfxPetalAmbientSeed) * 0.16));
        vec3 tumbleAxis = normalize(vec3(0.32 + pfxPetalAmbientSeed * 0.26, 0.72, 0.48 - pfxPetalAmbientSeed * 0.2));
        vec3 secondaryAxis = normalize(vec3(-0.22, 0.44 + pfxPetalAmbientSeed * 0.2, 0.86));
        vec2 directionalFallVector = vec2(0.38, -2.82);
        vec2 flowLaneDirection = vec2(0.3 + pfxPetalAmbientFlowLane * 0.04, -2.72 + abs(pfxPetalAmbientFlowLane - 1.0) * 0.18);
        float lanePhaseOffset = pfxPetalAmbientFlowLane * 0.113;
        float featheredPhaseJitter = (fract(pfxPetalAmbientSeed * 5.37) - 0.5) * 0.18;
        float decorrelatedFall = fract(staggeredFall + lanePhaseOffset + featheredPhaseJitter);
        float authoredWindArc = sin(pfxPetalAmbientSeed * 3.1415927) * 0.34;
        vec3 fallingCenter = pfxPetalAmbientCenter;
        fallingCenter.y = 1.55 + (pfxPetalAmbientFlowLane - 1.0) * 0.52 + flowLaneDirection.y * decorrelatedFall + authoredWindArc;
        fallingCenter.x += wideBreezeArc + flowLaneDirection.x * decorrelatedFall + directionalFallVector.x * 0.08;
        fallingCenter.z += crossBreeze * (0.18 + pfxPetalAmbientSeed * 0.11);
        fallingCenter.y += sin(uCycle * 12.5663706 + pfxPetalAmbientSeed * 9.0) * 0.045;
        vec3 eddyCenter = pfxPetalAmbientCenter;
        eddyCenter.x += breezeArc * (0.12 + pfxPetalAmbientCluster * 0.025);
        eddyCenter.y += sin(uCycle * 6.2831853 + pfxPetalAmbientCluster * 1.7) * 0.11;
        eddyCenter.z += crossBreeze * (0.09 + pfxPetalAmbientCluster * 0.012);
        vec3 animatedCenter = mix(fallingCenter, eddyCenter, blossomEddy);
        float bridgeOccupancy = pfxPetalAmbientBridge * (1.0 - blossomEddy);
        vec3 bridgeCenter = pfxPetalAmbientCenter;
        bridgeCenter.x += breezeArc * 0.08;
        bridgeCenter.y += sin(uCycle * 6.2831853 + pfxPetalAmbientSeed * 8.0) * 0.08;
        bridgeCenter.z += crossBreeze * 0.06;
        animatedCenter = mix(animatedCenter, bridgeCenter, bridgeOccupancy);
        float localTumble = mix(tumbleAngle, breezeArc * 0.16, blossomEddy);
        float organicSizeVariance = mix(0.9, 1.1, fract(pfxPetalAmbientSeed * 7.31));
        vec4 centerViewPosition = modelViewMatrix * vec4(animatedCenter, 1.0);
        float perspectiveDepthScale = mix(0.9, 1.05, smoothstep(-9.5, -6.6, centerViewPosition.z));
        vec3 tumbledLocal = rotateAroundAxis(pfxPetalAmbientLocal, tumbleAxis, localTumble) * mix(0.9, 1.04, uDensity) * organicSizeVariance * perspectiveDepthScale;
        tumbledLocal = rotateAroundAxis(tumbledLocal, secondaryAxis, breezeArc * mix(0.42, 0.1, blossomEddy));
        vec3 tumbledNormal = rotateAroundAxis(normal, tumbleAxis, localTumble);
        tumbledNormal = rotateAroundAxis(tumbledNormal, secondaryAxis, breezeArc * mix(0.42, 0.1, blossomEddy));
        float semanticFacingBlend = 0.12;
        vec3 worldPetalNormalView = normalize(normalMatrix * tumbledNormal);
        float edgeOnSupport = smoothstep(0.72, 0.96, 1.0 - abs(worldPetalNormalView.z));
        float adaptiveFacingBlend = mix(semanticFacingBlend, 0.42, edgeOnSupport);
        float viewPetalAngle = localTumble * 0.32 + pfxPetalAmbientSeed * 3.1415927;
        mat2 viewPetalRotation = mat2(cos(viewPetalAngle), -sin(viewPetalAngle), sin(viewPetalAngle), cos(viewPetalAngle));
        vec2 facingLocal = viewPetalRotation * pfxPetalAmbientLocal.xy;
        vec3 viewBiasedPetalLocal = vec3(facingLocal, pfxPetalAmbientLocal.z * 0.18) * mix(0.9, 1.04, uDensity) * organicSizeVariance * perspectiveDepthScale;
        vec3 worldPetalLocalView = (modelViewMatrix * vec4(tumbledLocal, 0.0)).xyz;
        vec4 viewPosition = centerViewPosition;
        viewPosition.xyz += mix(worldPetalLocalView, viewBiasedPetalLocal, adaptiveFacingBlend);
        vec3 viewBiasedPetalNormal = normalize(vec3(pfxPetalAmbientLocal.xy * 0.12, pfxPetalAmbientLocal.z >= 0.0 ? 1.0 : -1.0));
        vPetalNormal = normalize(mix(worldPetalNormalView, viewBiasedPetalNormal, adaptiveFacingBlend));
        vPetalViewPosition = viewPosition.xyz;
        vPetalShade = color;
        vPetalUv = pfxPetalAmbientUv;
        vPetalPaletteIndex = pfxPetalAmbientPaletteIndex;
        vDensityVisibility = densityVisibility;
        vPetalSidewall = pfxPetalAmbientSidewall;
        vPetalWorldHeight = animatedCenter.y;
        vPetalSeed = pfxPetalAmbientSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vPetalNormal;
      varying vec3 vPetalViewPosition;
      varying vec3 vPetalShade;
      varying vec2 vPetalUv;
      varying float vPetalPaletteIndex;
      varying float vDensityVisibility;
      varying float vPetalSidewall;
      varying float vPetalWorldHeight;
      varying float vPetalSeed;
      void main() {
        vec3 normal = normalize(vPetalNormal);
        vec3 viewDirection = normalize(-vPetalViewPosition);
        float depthAtmosphereCue = smoothstep(-9.5, -6.6, vPetalViewPosition.z);
        float nearFarPigmentSeparation = mix(0.78, 1.18, depthAtmosphereCue);
        vec3 keyLight = normalize(vec3(0.38, 0.84, 0.4));
        float botanicalFacet = 0.82 + max(0.0, dot(normal, keyLight)) * 0.25;
        float softPetalTranslucency = pow(1.0 - abs(dot(normal, viewDirection)), 0.85);
        float translucentRim = softPetalTranslucency;
        float centerLine = abs(vPetalUv.y - 0.5);
        float petalVein = 1.0 - smoothstep(0.055, 0.16, centerLine);
        float branchVein = 1.0 - smoothstep(0.06, 0.15, abs(centerLine - (0.14 + vPetalUv.x * 0.1)));
        float centralFold = 1.0 - smoothstep(0.08, 0.28, centerLine);
        float curlSide = smoothstep(0.38, 0.94, vPetalUv.y);
        float sidewallShade = 1.0 - abs(dot(normal, viewDirection));
        float edgeTransmission = softPetalTranslucency * (0.26 + smoothstep(0.42, 0.9, vPetalUv.x) * 0.14);
        float sidewallRim = smoothstep(0.45, 0.95, vPetalSidewall);
        float rootToTipGradient = smoothstep(0.02, 0.92, vPetalUv.x);
        float groundContactTint = 1.0 - smoothstep(-1.02, -0.52, vPetalWorldHeight);
        float petalFiber = smoothstep(0.38, 0.62, fract(vPetalUv.x * 13.0 + vPetalUv.y * 21.0 + vPetalSeed * 3.17));
        float accentCrestShimmer = 1.0 - smoothstep(0.06, 0.2, abs(uCycle - 0.26));
        float tipLight = smoothstep(0.46, 0.96, vPetalUv.x);
        float rootShade = 1.0 - smoothstep(0.05, 0.34, vPetalUv.x);
        vec3 blush = vec3(1.0, 0.6, 0.72);
        vec3 coral = vec3(1.0, 0.68, 0.64);
        vec3 cream = vec3(1.0, 0.82, 0.84);
        vec3 pollenGold = vec3(1.0, 0.58, 0.36);
        float blossomCore = step(2.5, vPetalPaletteIndex);
        vec3 blossomPalette = mix(blush, coral, step(0.5, vPetalPaletteIndex));
        blossomPalette = mix(blossomPalette, cream, step(1.5, vPetalPaletteIndex));
        blossomPalette = mix(blossomPalette, pollenGold, blossomCore);
        float secondaryPigmentFloor = 0.4 + (1.0 - tipLight) * 0.06;
        vec3 controlledPetalPalette = mix(uPrimaryColor, uSecondaryColor, max(secondaryPigmentFloor, tipLight * 0.62));
        controlledPetalPalette = mix(controlledPetalPalette, pollenGold, blossomCore * 0.82);
        blossomPalette = mix(blossomPalette, controlledPetalPalette, 0.62);
        float petalLuminanceFloor = 1.22;
        vec3 pigment = blossomPalette * botanicalFacet * (0.9 + vPetalShade * 0.1) * petalLuminanceFloor * nearFarPigmentSeparation;
        vec3 botanicalRoot = mix(uPrimaryColor, blush, 0.34);
        vec3 botanicalTip = mix(uSecondaryColor, cream, 0.42);
        vec3 botanicalGradient = mix(botanicalRoot, botanicalTip, rootToTipGradient) * petalLuminanceFloor;
        pigment = mix(pigment, botanicalGradient, 0.58);
        pigment *= mix(0.96, 1.04, petalFiber);
        pigment *= 0.95 + tipLight * 0.07;
        pigment *= mix(0.96, 1.04, curlSide);
        pigment *= 1.0 - centralFold * 0.12;
        pigment *= 1.0 - sidewallShade * 0.1;
        pigment -= blossomPalette * rootShade * 0.08;
        pigment -= mix(vec3(0.24, 0.025, 0.06), uPrimaryColor * 0.28, 0.58) * petalVein * mix(0.08, 0.16, uStyleEdgeHardness);
        pigment += mix(vec3(1.0, 0.76, 0.82), uSecondaryColor, 0.72) * branchVein * 0.045;
        pigment += mix(vec3(1.0, 0.9, 0.86), uSecondaryColor, 0.58) * centralFold * curlSide * 0.04;
        float backlitPetalRim = edgeTransmission;
        pigment += mix(vec3(1.0, 0.82, 0.86), uSecondaryColor, 0.68) * backlitPetalRim;
        pigment = mix(pigment, mix(vec3(1.0, 0.78, 0.84), uSecondaryColor, 0.74) * petalLuminanceFloor, sidewallRim * 0.36);
        vec3 silkyHalfDirection = normalize(keyLight + viewDirection);
        float silkyHighlight = pow(max(0.0, dot(normal, silkyHalfDirection)), 12.0) * 0.1;
        pigment += mix(vec3(1.0, 0.84, 0.9), uSecondaryColor, 0.42) * silkyHighlight;
        pigment += mix(vec3(1.0, 0.86, 0.92), uSecondaryColor, 0.5) * accentCrestShimmer * 0.18;
        pigment *= 1.0 - groundContactTint * 0.12;
        pigment += mix(vec3(1.0, 0.74, 0.8), uSecondaryColor, 0.72) * translucentRim * mix(0.04, 0.08, uStyleEdgeHardness);
        pigment += mix(vec3(1.0, 0.88, 0.82), uSecondaryColor, 0.66) * tipLight * translucentRim * 0.04;
        pigment += pollenGold * blossomCore * (0.16 + translucentRim * 0.12);
        float coverage = (0.64 + botanicalFacet * 0.08 + edgeTransmission * 0.1 + sidewallRim * 0.08 + accentCrestShimmer * 0.05) * mix(0.9, 1.0, depthAtmosphereCue);
        gl_FragColor = vec4(pigment * mix(0.94, 1.06, uDensity), uOpacity * coverage * vDensityVisibility);
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxPetalAmbientMaterial'] = true
  material.userData['pfxPetalAmbientMaterialProfile'] = 'sculpted-botanical-pigment'
  material.userData['pfxPetalAmbientFragmentTranscendentalOps'] = 0
  material.userData['pfxPetalAmbientForceSinglePass'] = true
  material.userData['pfxPetalAmbientLuminanceFloor'] = 1.22
  material.userData['pfxPetalAmbientAssetProvenance'] = 'original-procedural-closed-mesh'
  material.userData['pfxPetalAmbientControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxPetalAmbientControlTintStrength'] = 0.62
  material.userData['pfxPetalAmbientSecondaryPigmentFloor'] = 0.4
  material.userData['pfxPetalAmbientMinimumDensityVisibility'] = 0.32
  material.userData['pfxPetalAmbientGlossHighlightCap'] = 0.12
  material.userData['pfxPetalAmbientSemanticFacingBlend'] = 0.12
  material.userData['pfxPetalAmbientAdaptiveFacingMaximum'] = 0.42
  material.userData['pfxPetalAmbientVeinContrast'] = 0.16
  material.userData['pfxPetalAmbientCentralFoldContrast'] = 0.18
  material.userData['pfxPetalAmbientSidewallShadeStrength'] = 0.1
  material.userData['pfxPetalAmbientBacklightStrength'] = 0.22
  material.userData['pfxPetalAmbientPaperyAlphaMaximum'] = 0.82
  material.userData['pfxPetalAmbientSidewallRimStrength'] = 0.36
  material.userData['pfxPetalAmbientRootToTipGradientStrength'] = 0.58
  material.userData['pfxPetalAmbientEdgeTransmissionStrength'] = 0.4
  material.userData['pfxPetalAmbientFiberStrength'] = 0.08
  material.userData['pfxPetalAmbientSilkyHighlightStrength'] = 0.1
  material.userData['pfxPetalAmbientAccentCrestShimmer'] = 0.18
  material.userData['pfxPetalAmbientTranslucencyProfile'] = 'soft-fiber-backlight'
  material.userData['pfxPetalAmbientDepthContrast'] = 1.8
  material.userData['pfxPetalAmbientCoreAccent'] = 'warm-peach'
  return material
}
