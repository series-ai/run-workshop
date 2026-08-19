import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type ComponentOptions = {
  color: THREE.Color
  layer?: number
  opacityWeight?: number
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  quaternion?: THREE.Quaternion
  scale?: readonly [number, number, number]
}

function prepareComponent(
  source: THREE.BufferGeometry,
  {
    color,
    layer = 0,
    opacityWeight = 1,
    position,
    rotation = [0, 0, 0],
    quaternion,
    scale = [1, 1, 1],
  }: ComponentOptions,
): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source
  if (geometry !== source) source.dispose()
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    quaternion ?? new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ))
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = color.r
    colors[index + 1] = color.g
    colors[index + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const layers = new Float32Array(geometry.getAttribute('position').count)
  layers.fill(layer)
  geometry.setAttribute('pfxLayer', new THREE.BufferAttribute(layers, 1))
  if (!geometry.getAttribute('pfxOpacityWeight')) {
    const opacityWeights = new Float32Array(geometry.getAttribute('position').count)
    opacityWeights.fill(opacityWeight)
    geometry.setAttribute('pfxOpacityWeight', new THREE.BufferAttribute(opacityWeights, 1))
  }
  return geometry
}

function mergeSpawnComponents(
  components: THREE.BufferGeometry[],
  userData: Readonly<Record<string, unknown>>,
): THREE.BufferGeometry {
  const geometry = mergeGeometries(components, false)
  for (const component of components) component.dispose()
  if (!geometry) throw new Error('Unable to assemble spawn-telegraph geometry')
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = { ...userData, cameraFacing: false }
  return geometry
}

function createTaperedTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radius: number,
  radialSegments: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (let segment = 0; segment <= tubularSegments; segment += 1) {
    const progress = segment / tubularSegments
    curve.getPointAt(progress, point)
    const taper = Math.pow(Math.sin(progress * Math.PI), 0.62)
    for (let side = 0; side <= radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2
      normal.copy(frames.normals[segment]!).multiplyScalar(Math.cos(angle))
        .addScaledVector(frames.binormals[segment]!, Math.sin(angle))
        .normalize()
      positions.push(
        point.x + normal.x * radius * taper,
        point.y + normal.y * radius * taper,
        point.z + normal.z * radius * taper,
      )
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(progress, side / radialSegments)
    }
  }
  for (let segment = 0; segment < tubularSegments; segment += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const row = radialSegments + 1
      const a = segment * row + side
      const b = (segment + 1) * row + side
      const c = (segment + 1) * row + side + 1
      const d = segment * row + side + 1
      indices.push(a, b, d, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

function createFootprintPanelGeometry(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): THREE.BufferGeometry {
  const innerStart = new THREE.Vector3(Math.cos(startAngle) * innerRadius, 0, Math.sin(startAngle) * innerRadius)
  const outerStart = new THREE.Vector3(Math.cos(startAngle) * outerRadius, 0, Math.sin(startAngle) * outerRadius)
  const outerEnd = new THREE.Vector3(Math.cos(endAngle) * outerRadius, 0, Math.sin(endAngle) * outerRadius)
  const innerEnd = new THREE.Vector3(Math.cos(endAngle) * innerRadius, 0, Math.sin(endAngle) * innerRadius)
  const vertices = [innerStart, outerEnd, outerStart, innerStart, innerEnd, outerEnd]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap((vertex) => vertex.toArray()), 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices.flatMap(() => [0, 1, 0]), 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 1, 1, 0,
    0, 0, 0, 1, 1, 1,
  ], 2))
  return geometry
}

function createSoftTriangularWarningPlaneGeometry(
  innerRadius: number,
  outerRadius: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const opacityWeights: number[] = []
  const center = new THREE.Vector3(0, 0, 0)
  const inner = Array.from({ length: 3 }, (_, index) => {
    const angle = (index / 3) * Math.PI * 2 - Math.PI / 2
    return new THREE.Vector3(Math.cos(angle) * innerRadius, 0, Math.sin(angle) * innerRadius)
  })
  const outer = Array.from({ length: 3 }, (_, index) => {
    const angle = (index / 3) * Math.PI * 2 - Math.PI / 2
    return new THREE.Vector3(Math.cos(angle) * outerRadius, 0, Math.sin(angle) * outerRadius)
  })
  const pushTriangle = (
    vertices: readonly THREE.Vector3[],
    weights: readonly number[],
  ) => {
    for (let index = 0; index < vertices.length; index += 1) {
      const vertex = vertices[index]!
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(0, 1, 0)
      uvs.push(vertex.x / (outerRadius * 2) + 0.5, vertex.z / (outerRadius * 2) + 0.5)
      opacityWeights.push(weights[index]!)
    }
  }
  for (let side = 0; side < 3; side += 1) {
    const next = (side + 1) % 3
    pushTriangle([center, inner[next]!, inner[side]!], [1, 0.82, 0.82])
    pushTriangle([inner[side]!, inner[next]!, outer[next]!], [0.82, 0.82, 0])
    pushTriangle([inner[side]!, outer[next]!, outer[side]!], [0.82, 0, 0])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('pfxOpacityWeight', new THREE.Float32BufferAttribute(opacityWeights, 1))
  return geometry
}

function createBeveledHexFrameGeometry(
  outerRadius: number,
  width: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 6
    const x = Math.cos(angle) * outerRadius
    const y = Math.sin(angle) * outerRadius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hole = new THREE.Path()
  for (let index = 5; index >= 0; index -= 1) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 6
    const x = Math.cos(angle) * (outerRadius - width)
    const y = Math.sin(angle) * (outerRadius - width)
    if (index === 5) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  hole.closePath()
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  geometry.translate(0, -(geometry.boundingBox?.min.y ?? 0), 0)
  return geometry
}

export function createPfxSpawnArrivalAvatarGeometry(
  color: THREE.ColorRepresentation = '#35d8ff',
): THREE.BufferGeometry {
  const base = new THREE.Color(color)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.48)
  const shadow = base.clone().lerp(new THREE.Color('#06263d'), 0.58)
  const accent = base.clone().lerp(new THREE.Color('#c5a6ff'), 0.58)
  const components: THREE.BufferGeometry[] = []
  const add = (geometry: THREE.BufferGeometry, options: ComponentOptions) => {
    components.push(prepareComponent(geometry, options))
  }
  const addLimb = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    topRadius: number,
    bottomRadius: number,
    limbColor: THREE.Color,
    layer: number,
  ) => {
    const direction = end.clone().sub(start)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    add(new THREE.CylinderGeometry(topRadius, bottomRadius, direction.length(), 6, 1), {
      color: limbColor,
      layer,
      position: [midpoint.x, midpoint.y, midpoint.z],
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
    })
  }

  // The arrival proxy is an authored armored construct rather than a neutral
  // mannequin. Faceted plates and articulated limbs preserve a readable
  // shoulder/waist hierarchy from front, three-quarter, and side cameras.
  add(new THREE.DodecahedronGeometry(0.15, 0), {
    color: pale,
    layer: 3,
    position: [0, 0.67, 0],
    scale: [0.92, 1.08, 0.92],
  })
  add(new THREE.BoxGeometry(0.2, 0.045, 0.055), {
    color: accent,
    layer: 4,
    position: [0, 0.69, 0.135],
    rotation: [0.08, 0, 0],
  })
  add(new THREE.CylinderGeometry(0.065, 0.08, 0.1, 6, 1), {
    color: shadow,
    layer: 0,
    position: [0, 0.51, 0],
  })
  add(new THREE.CylinderGeometry(0.2, 0.255, 0.36, 6, 1), {
    color: base,
    layer: 1,
    position: [0, 0.3, 0],
    scale: [1, 1, 0.74],
  })
  add(new THREE.OctahedronGeometry(0.15, 0), {
    color: pale,
    layer: 3,
    position: [0, 0.32, 0.155],
    scale: [1.18, 0.72, 0.46],
  })
  add(new THREE.OctahedronGeometry(0.115, 0), {
    color: shadow,
    layer: 2,
    position: [-0.255, 0.4, 0],
    scale: [1.42, 0.66, 0.84],
  })
  add(new THREE.OctahedronGeometry(0.115, 0), {
    color: shadow,
    layer: 2,
    position: [0.255, 0.4, 0],
    scale: [1.42, 0.66, 0.84],
  })
  const leftElbow = new THREE.Vector3(-0.34, 0.14, 0.11)
  const rightElbow = new THREE.Vector3(0.34, 0.14, -0.11)
  addLimb(new THREE.Vector3(-0.245, 0.35, 0.03), leftElbow, 0.074, 0.09, base, 1)
  addLimb(new THREE.Vector3(0.245, 0.35, -0.03), rightElbow, 0.074, 0.09, base, 1)
  addLimb(leftElbow, new THREE.Vector3(-0.28, -0.08, 0.2), 0.06, 0.08, pale, 3)
  addLimb(rightElbow, new THREE.Vector3(0.28, -0.08, -0.2), 0.06, 0.08, pale, 3)
  add(new THREE.BoxGeometry(0.31, 0.105, 0.19), {
    color: shadow,
    layer: 2,
    position: [0, 0.06, 0],
    rotation: [0, Math.PI / 4, 0],
  })
  const leftKnee = new THREE.Vector3(-0.13, -0.25, 0.07)
  const rightKnee = new THREE.Vector3(0.13, -0.25, -0.07)
  addLimb(new THREE.Vector3(-0.095, 0.02, 0.025), leftKnee, 0.082, 0.105, base, 1)
  addLimb(new THREE.Vector3(0.095, 0.02, -0.025), rightKnee, 0.082, 0.105, base, 1)
  addLimb(leftKnee, new THREE.Vector3(-0.145, -0.425, 0.12), 0.07, 0.09, shadow, 2)
  addLimb(rightKnee, new THREE.Vector3(0.145, -0.425, -0.12), 0.07, 0.09, shadow, 2)
  add(new THREE.BoxGeometry(0.15, 0.11, 0.25), {
    color: pale,
    layer: 3,
    position: [-0.145, -0.475, 0.16],
    rotation: [0, 0.08, 0],
  })
  add(new THREE.BoxGeometry(0.15, 0.11, 0.25), {
    color: pale,
    layer: 3,
    position: [0.145, -0.475, -0.16],
    rotation: [0, -0.08, 0],
  })
  add(new THREE.OctahedronGeometry(0.062, 0), {
    color: accent,
    layer: 4,
    position: [0, 0.31, 0.215],
  })
  add(new THREE.TetrahedronGeometry(0.1, 0), {
    color: shadow,
    layer: 2,
    position: [0, 0.57, -0.16],
    rotation: [0.28, Math.PI / 4, 0],
    scale: [0.72, 1.35, 0.54],
  })

  return mergeSpawnComponents(components, {
    pfxGeometry: 'spawn-telegraph-arrival-avatar',
    avatarPrimitiveCount: 20,
    bodyMeshStyle: 'faceted-armored-arrival-construct',
    armorPlateCount: 7,
    articulatedLimbSegmentCount: 8,
    visorCount: 1,
    chestCoreCount: 1,
    limbRadialSegments: 6,
    profileDepthOffset: 0.2,
    materialAccentPalette: 'cyan-violet-core',
  })
}

export function createPfxSpawnArrivalCageGeometry(
  color: THREE.ColorRepresentation = '#35d8ff',
): THREE.BufferGeometry {
  const base = new THREE.Color(color)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.2)
  const components: THREE.BufferGeometry[] = []
  const add = (geometry: THREE.BufferGeometry, options: ComponentOptions) => {
    components.push(prepareComponent(geometry, options))
  }

  const fragmentAccent = base.clone().lerp(new THREE.Color('#c5a6ff'), 0.46)
  const convergencePylonCount = 3
  const pylonSegmentCount = convergencePylonCount
  const pylonAxialSegments = 24
  const pylonRadialSegments = 6
  const pylonHaloRadius = 0.115
  const pylonCoreRadius = 0.042
  const pylonCenterRadius = 0.98

  for (let pylon = 0; pylon < convergencePylonCount; pylon += 1) {
    const cornerAngle = (pylon / convergencePylonCount) * Math.PI * 2 - Math.PI / 2
    const points = Array.from({ length: 13 }, (_, pointIndex) => {
      const progress = pointIndex / 12
      const signedBend = pylon % 2 === 0 ? 1 : -1
      const angle = cornerAngle +
        Math.sin(progress * Math.PI) * 0.032 * signedBend +
        (progress - 0.5) * 0.018 * (pylon - 1)
      const radius = THREE.MathUtils.lerp(pylonCenterRadius, 0.89, progress) +
        Math.sin(progress * Math.PI) * 0.018
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(-0.5, 0.74, progress),
        Math.sin(angle) * radius,
      )
    })
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    add(createTaperedTubeGeometry(
      curve,
      pylonAxialSegments,
      pylonHaloRadius,
      pylonRadialSegments,
    ), {
      color: (pylon === 1 ? pale : base).clone().multiplyScalar(0.52),
      layer: 2,
      position: [0, 0, 0],
    })
    add(createTaperedTubeGeometry(curve, pylonAxialSegments, pylonCoreRadius, 4), {
      color: pylon === 1 ? fragmentAccent : pale,
      layer: 3,
      position: [0, 0, 0],
    })
  }

  const dataFragmentCount = 54
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let fragment = 0; fragment < dataFragmentCount; fragment += 1) {
    const shell = fragment % 3
    const band = Math.floor(fragment / 3)
    const scaleTier = fragment % 4
    const progress = (band + 0.5) / (dataFragmentCount / 3)
    const angle = fragment * goldenAngle + shell * 0.19
    const radius = 0.76 + shell * 0.105 + ((fragment * 7) % 5) * 0.016
    const size = 0.027 + (fragment % 4) * 0.005
    const scaleTiers: ReadonlyArray<readonly [number, number, number]> = [
      [0.58, 1, 0.72],
      [0.82, 1.38, 0.9],
      [1.08, 1.78, 1.16],
      [1.32, 2.2, 1.28],
    ]
    const fragmentGeometry =
      shell === 0
        ? new THREE.TetrahedronGeometry(size, 0)
        : shell === 1
          ? new THREE.OctahedronGeometry(size, 0)
          : new THREE.IcosahedronGeometry(size, 0)
    add(fragmentGeometry, {
      color: fragment % 5 === 0 ? fragmentAccent : shell === 1 ? base : pale,
      layer: 4,
      opacityWeight: 0.32 + (scaleTier / 3) * 0.68,
      position: [
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(-0.44, 0.7, progress) + (shell - 1) * 0.025,
        Math.sin(angle) * radius,
      ],
      rotation: [fragment * 0.19, fragment * 0.31, fragment * 0.23],
      scale: scaleTiers[scaleTier]!,
    })
  }

  return mergeSpawnComponents(components, {
    pfxGeometry: 'spawn-telegraph-arrival-cage',
    convergenceRibbonCount: 0,
    convergencePylonCount,
    pylonSegmentCount,
    pylonAxialSegments,
    pylonRadialSegments,
    pylonHaloCount: convergencePylonCount,
    pylonCoreCount: convergencePylonCount,
    pylonCapCount: 0,
    pylonCurveProfile: 'corner-anchored-continuous-faceted-spires',
    pylonSilhouette: 'broad-tapered-spires-without-beaded-lines',
    ribbonEndpointProfile: 'geometry-tapered-spire-tips',
    minimumBodyClearanceRadius: 0.72,
    closedRingCount: 0,
    energyVeilCount: convergencePylonCount,
    energyVeilProfile: 'continuous-faceted-pylon-shells',
    secondaryFilamentCount: 0,
    dataFragmentCount,
    dataFragmentShapeCount: 3,
    dataFragmentScaleTierCount: 4,
    dataFragmentScaleRange: [0.58, 2.2],
    dataFragmentOpacityRange: [0.32, 1],
    dataFragmentDistribution: 'density-graded-three-shell-arrival-field',
    dataFragmentPrimitive: 'mixed-faceted-motes',
    fragmentReleaseMotion: 'outward-rise',
    silhouetteCrossingPolicy: 'corner-anchored-body-clear-sectors',
    volumeLanguage: 'broad-faceted-spires-hot-cores-and-density-graded-motes',
  })
}

export function createPfxSpawnArrivalFootprintGeometry(
  color: THREE.ColorRepresentation = '#168cff',
): THREE.BufferGeometry {
  const base = new THREE.Color(color)
  const pale = base.clone().lerp(new THREE.Color('#ffffff'), 0.16)
  const panel = base.clone().multiplyScalar(0.24)
  const components: THREE.BufferGeometry[] = []
  const gateCount = 3
  const actionableRadius = 1.22
  components.push(prepareComponent(createSoftTriangularWarningPlaneGeometry(0.58, 1.02), {
    color: base.clone().multiplyScalar(0.72),
    layer: 5,
    position: [0, 0.009, 0],
  }))
  const boundaryVertices = Array.from({ length: gateCount }, (_, gateIndex) => {
    const angle = (gateIndex / gateCount) * Math.PI * 2 - Math.PI / 2
    return new THREE.Vector3(
      Math.cos(angle) * actionableRadius,
      0,
      Math.sin(angle) * actionableRadius,
    )
  })
  for (let edgeIndex = 0; edgeIndex < boundaryVertices.length; edgeIndex += 1) {
    const start = boundaryVertices[edgeIndex]!
    const end = boundaryVertices[(edgeIndex + 1) % boundaryVertices.length]!
    const direction = end.clone().sub(start)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    components.push(prepareComponent(new THREE.BoxGeometry(direction.length(), 0.05, 0.075), {
      color: edgeIndex === 0 ? pale : base,
      layer: 6,
      position: [midpoint.x, 0.024, midpoint.z],
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        direction.normalize(),
      ),
    }))
  }
  for (let gateIndex = 0; gateIndex < gateCount; gateIndex += 1) {
    const centerAngle = (gateIndex / gateCount) * Math.PI * 2 - Math.PI / 2
    components.push(prepareComponent(
      createFootprintPanelGeometry(0.22, 0.9, centerAngle - 0.22, centerAngle + 0.22),
      {
        color: gateIndex === 0 ? panel.clone().multiplyScalar(1.18) : panel,
        layer: 5,
        position: [0, 0.012, 0],
      },
    ))
    const gateTip = boundaryVertices[gateIndex]!
    components.push(prepareComponent(new THREE.CylinderGeometry(0.075, 0.075, 0.065, 3, 1), {
      color: pale,
      layer: 6,
      position: [gateTip.x, 0.035, gateTip.z],
      rotation: [0, -centerAngle + Math.PI / 2, 0],
    }))
    components.push(prepareComponent(
      new THREE.CylinderGeometry(0.09, 0.09, 0.035, 3, 1),
      {
        color: pale,
        layer: 6,
        position: [Math.cos(centerAngle) * 0.62, 0.02, Math.sin(centerAngle) * 0.62],
        rotation: [0, -centerAngle + Math.PI / 2, 0],
      },
    ))
  }
  components.push(prepareComponent(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 3, 1), {
    color: panel.clone().multiplyScalar(1.35),
    layer: 6,
    position: [0, 0.014, 0],
    rotation: [0, Math.PI / 6, 0],
  }))
  return mergeSpawnComponents(components, {
    pfxGeometry: 'spawn-telegraph-arrival-footprint',
    boundarySegmentCount: 3,
    boundaryGapCount: 0,
    dockingBracketCount: 0,
    dockingBracketSegmentCount: 0,
    cornerBeaconCount: 3,
    closedPolygonCount: 1,
    closedRingCount: 0,
    segmentWidth: 0.075,
    groundThickness: 0.08,
    boundaryProfile: 'continuous-triangular-arrival-perimeter',
    boundaryBevelSegments: 1,
    inwardChevronCount: 3,
    innerPanelCount: 3,
    centralApertureRadius: 0.22,
    centralGateTriangleCount: 1,
    warningPlaneCount: 1,
    warningPlaneProfile: 'soft-vertex-faded-triangle',
    warningPlaneGeometry: 'single-sided-gradient-fan',
    warningPlaneCenterWeight: 1,
    warningPlaneEdgeWeight: 0,
    actionableRadius,
    radialSymmetry: 3,
    groundMotif: 'tri-lobed-arrival-lock',
  })
}

export type PfxSpawnArrivalMaterialRole = 'avatar' | 'ribbon' | 'footprint'

export interface PfxSpawnArrivalAppearanceInput {
  role: PfxSpawnArrivalMaterialRole
  baseOpacity: number
  motionOpacityMultiplier: number
  flipbookOpacityMultiplier: number
  scaleMultiplier: number
}

export interface PfxSpawnArrivalAppearance {
  opacity: number
  release: number
  scaleMultiplier: number
}

export function createPfxSpawnArrivalAppearance(
  input: PfxSpawnArrivalAppearanceInput,
): PfxSpawnArrivalAppearance {
  const animatedOpacity =
    input.baseOpacity * input.motionOpacityMultiplier * input.flipbookOpacityMultiplier
  if (input.role === 'footprint') {
    return { opacity: animatedOpacity, release: 0, scaleMultiplier: input.scaleMultiplier }
  }
  const releaseScale = input.role === 'ribbon' ? 0.42 : 0.18
  const release = THREE.MathUtils.clamp(
    (input.scaleMultiplier - 1) / releaseScale,
    0,
    1,
  )
  if (input.role === 'avatar') {
    return {
      opacity: animatedOpacity,
      release: 0,
      scaleMultiplier: release > 0 ? 1 : input.scaleMultiplier,
    }
  }
  return { opacity: animatedOpacity, release, scaleMultiplier: input.scaleMultiplier }
}

export function createPfxSpawnArrivalVolumeMaterial(
  opacity: number,
  role: PfxSpawnArrivalMaterialRole = 'ribbon',
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uRelease: { value: 0 },
      uEndpointFade: { value: role === 'ribbon' ? 1 : 0 },
      uRibbonResolve: { value: role === 'ribbon' ? 1 : 0 },
      uBrightness: { value: role === 'avatar' ? 1.08 : role === 'ribbon' ? 1.3 : 1.12 },
      uRimStrength: { value: role === 'avatar' ? 0.54 : 0.3 },
      uScanContrast: { value: role === 'avatar' ? 0.16 : 0.08 },
      uMidtoneFloor: { value: role === 'avatar' ? 0.32 : role === 'ribbon' ? 0.58 : 0.4 },
      uSpecularStrength: { value: role === 'avatar' ? 0.28 : 0.12 },
      uReleaseLift: { value: role === 'avatar' ? 0.08 : role === 'ribbon' ? 0.25 : 0 },
      uRadialFalloff: { value: role === 'footprint' ? 1 : 0 },
      uBreakupStrength: { value: role === 'avatar' ? 0.5 : role === 'footprint' ? 0 : 1 },
      uDitheredTransparency: { value: role === 'avatar' ? 1 : 0 },
      uDitherPeakGain: { value: role === 'avatar' ? 1.1 : 1 },
      uDissolveCellDensity: { value: role === 'avatar' ? 18 : 1 },
      uVolumeSoftness: { value: role === 'ribbon' ? 1 : 0 },
      uAvatarRole: { value: role === 'avatar' ? 1 : 0 },
      uRibbonRole: { value: role === 'ribbon' ? 1 : 0 },
      uFootprintRole: { value: role === 'footprint' ? 1 : 0 },
      uScanlineEmission: { value: role === 'avatar' ? 0.18 : 0 },
      uGroundScanEmission: { value: role === 'footprint' ? 0.34 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float pfxLayer;
      attribute float pfxOpacityWeight;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vLocalPosition;
      varying float vBreakupBand;
      varying float vLayer;
      varying float vOpacityWeight;
      varying vec2 vUv;
      uniform float uRelease;
      uniform float uReleaseLift;
      void main() {
        float band = fract(
          (position.y + 0.72) * 0.73 +
          position.x * 0.41 +
          position.z * 0.29
        );
        float fragmentRelease = 1.0 - step(0.5, abs(pfxLayer - 4.0));
        vec3 releasedPosition = position;
        releasedPosition.y += uRelease * (0.28 + band * 0.56) *
          (uReleaseLift + fragmentRelease * 0.72);
        float inwardResolve = 1.0 - uRelease * (0.2 + band * 0.18);
        float outwardDissipation = 1.0 + uRelease * (0.34 + band * 0.32);
        releasedPosition.xz *= mix(inwardResolve, outwardDissipation, fragmentRelease);
        vec4 viewPosition = modelViewMatrix * vec4(releasedPosition, 1.0);
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        vLocalPosition = releasedPosition;
        vBreakupBand = band;
        vLayer = pfxLayer;
        vOpacityWeight = pfxOpacityWeight;
        vUv = uv;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vLocalPosition;
      varying float vBreakupBand;
      varying float vLayer;
      varying float vOpacityWeight;
      varying vec2 vUv;
      uniform float uRelease;
      uniform float uEndpointFade;
      uniform float uRibbonResolve;
      uniform float uBrightness;
      uniform float uRimStrength;
      uniform float uScanContrast;
      uniform float uMidtoneFloor;
      uniform float uSpecularStrength;
      uniform float uRadialFalloff;
      uniform float uBreakupStrength;
      uniform float uDitheredTransparency;
      uniform float uDitherPeakGain;
      uniform float uDissolveCellDensity;
      uniform float uVolumeSoftness;
      uniform float uAvatarRole;
      uniform float uRibbonRole;
      uniform float uFootprintRole;
      uniform float uScanlineEmission;
      uniform float uGroundScanEmission;
      float hashCell(vec3 cell) {
        return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vViewDirection)));
        float rim = pow(1.0 - facing, 2.0);
        float haloLayer = uRibbonRole * (1.0 - step(0.5, abs(vLayer - 2.0)));
        float coreLayer = uRibbonRole * (1.0 - step(0.5, abs(vLayer - 3.0)));
        float fragmentLayer = uRibbonRole * (1.0 - step(0.5, abs(vLayer - 4.0)));
        float avatarShadowLayer = uAvatarRole * (1.0 - step(0.5, abs(vLayer - 2.0)));
        float avatarAccentLayer = uAvatarRole * (1.0 - step(0.5, abs(vLayer - 4.0)));
        float scanWave = 0.5 + 0.5 * sin(vLocalPosition.y * 32.0 - uTime * 7.0);
        float scan = mix(1.0 - uScanContrast, 1.0 + uScanContrast, scanWave);
        float height = clamp(vLocalPosition.y * 0.55 + 0.52, 0.0, 1.0);
        vec3 keyDirection = normalize(vec3(-0.38, 0.72, 0.58));
        float keyLight = max(dot(normalize(vNormal), keyDirection), 0.0);
        float facetResponse = 0.55 + keyLight * 0.58;
        vec3 graded = mix(vColor * uMidtoneFloor, vColor * 0.88, height) * uBrightness;
        graded *= scan * (0.72 + facing * 0.18) * facetResponse;
        graded *= mix(1.0, 0.78 + keyLight * 0.22, avatarShadowLayer * 0.52);
        graded = mix(
          graded,
          graded * vec3(0.78, 0.88, 1.14) + vec3(0.065, 0.025, 0.12),
          avatarAccentLayer * 0.64
        );
        graded += vColor * rim * uRimStrength;
        float specular = pow(max(dot(
          reflect(-keyDirection, normalize(vNormal)),
          normalize(vViewDirection)
        ), 0.0), 18.0);
        graded += vec3(0.62, 0.92, 1.0) * specular * uSpecularStrength;
        float scanline = pow(scanWave, 16.0) * uAvatarRole;
        graded += vec3(0.58, 0.94, 1.0) * scanline * uScanlineEmission;
        float filamentFlow = 0.5 + 0.5 * sin(vUv.x * 9.0 - uTime * 4.0 + vLayer * 1.7);
        float pylonFacet = clamp(haloLayer + coreLayer, 0.0, 1.0);
        float facetGlint = pow(max(dot(
          normalize(vNormal),
          normalize(vec3(-0.68, 0.24, 0.69))
        ), 0.0), 3.0);
        vec3 filamentTint = mix(
          vec3(0.16, 0.58, 0.94),
          vec3(0.7, 0.42, 1.0),
          filamentFlow
        );
        float phaseSplit = 0.5 + 0.5 * sin(
          vLocalPosition.y * 11.0 +
          vLocalPosition.x * 7.0 -
          vLocalPosition.z * 5.0 -
          uTime * 3.2
        );
        vec3 prismaticTint = mix(
          vec3(0.2, 0.76, 1.0),
          vec3(0.88, 0.42, 1.0),
          phaseSplit
        );
        graded = mix(
          graded,
          graded * filamentTint * (0.92 + facetGlint * 0.38),
          clamp(haloLayer * 0.52 + coreLayer * 0.74, 0.0, 1.0)
        );
        graded = mix(
          graded,
          graded * prismaticTint * (0.92 + facetGlint * 0.24),
          clamp(haloLayer * 0.22 + coreLayer * 0.3 + fragmentLayer * 0.38, 0.0, 1.0)
        );
        graded += vec3(0.58, 0.94, 1.0) * coreLayer *
          (0.2 + filamentFlow * 0.22 + facetGlint * 0.18);
        graded += vec3(0.56, 0.3, 0.94) * pylonFacet * facetGlint *
          (0.08 + height * 0.09);
        graded += vec3(0.62, 0.46, 1.0) * fragmentLayer * filamentFlow * 0.14;
        graded = min(graded, vec3(0.92));
        float rawBreakup = 1.0 - smoothstep(vBreakupBand - 0.12, vBreakupBand + 0.18, uRelease * 0.92);
        float breakup = mix(1.0, rawBreakup, uBreakupStrength);
        float taperedEnds = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
        float filamentLayer = clamp(haloLayer + coreLayer, 0.0, 1.0);
        float endpointMask = mix(1.0, taperedEnds, uEndpointFade * filamentLayer);
        float upwardResolve = smoothstep(uRelease * 0.86 - 0.12, uRelease * 0.86 + 0.12, vUv.x);
        float resolveMask = mix(1.0, upwardResolve, uRibbonResolve);
        float radial = length(vLocalPosition.xz);
        float radialMask = mix(1.0, 0.38 + 0.62 * smoothstep(0.18, 0.72, radial), uRadialFalloff);
        float warningPlaneLayer = 1.0 - step(0.5, abs(vLayer - 5.0));
        float gateLayer = 1.0 - step(0.5, abs(vLayer - 6.0));
        float volumeMask = mix(1.0, 0.62 + facing * 0.38, uVolumeSoftness * haloLayer);
        float alpha = uOpacity * (0.58 + facing * 0.42) * breakup *
          endpointMask * resolveMask * radialMask * volumeMask;
        float filamentAlpha = mix(
          1.0,
          (0.28 + facing * 0.38) * (0.7 + filamentFlow * 0.3),
          haloLayer
        );
        filamentAlpha *= mix(1.0, 0.76 + filamentFlow * 0.24, coreLayer);
        filamentAlpha *= mix(1.0, 0.58 + filamentFlow * 0.42, fragmentLayer);
        alpha *= filamentAlpha;
        alpha *= mix(1.0, vOpacityWeight, fragmentLayer);
        float groundScan = 0.62 + 0.38 * sin(radial * 12.0 - uTime * 4.0);
        float warningPlaneMask = uFootprintRole * warningPlaneLayer;
        float gateMask = uFootprintRole * gateLayer;
        graded += vColor * (
          warningPlaneMask * (0.12 + groundScan * uGroundScanEmission) +
          gateMask * 0.24
        );
        alpha *= mix(
          1.0,
          (0.52 + groundScan * 0.28) * vOpacityWeight,
          warningPlaneMask
        );
        alpha *= mix(1.0, 0.48 + groundScan * 0.14, gateMask);
        if (uDitheredTransparency > 0.5) {
          float gainedOpacity = clamp(uOpacity * uDitherPeakGain, 0.0, 1.0) * breakup;
          float reveal = clamp(0.18 + gainedOpacity * 0.95, 0.0, 1.18);
          reveal = mix(reveal, 1.18, step(0.9, gainedOpacity));
          float verticalProgress = clamp((vLocalPosition.y + 0.64) / 1.48, 0.0, 1.0);
          vec3 cell = floor(vLocalPosition * vec3(
            uDissolveCellDensity,
            uDissolveCellDensity * 0.72,
            uDissolveCellDensity
          ));
          float cellNoise = hashCell(cell);
          float assemblyCoordinate = verticalProgress + (cellNoise - 0.5) * 0.42;
          float releaseCoordinate = verticalProgress + (cellNoise - 0.5) * 0.42;
          float dissolveCoordinate = mix(
            assemblyCoordinate,
            releaseCoordinate,
            step(0.001, uRelease)
          );
          if (dissolveCoordinate > reveal) discard;
          float dissolveEdge = 1.0 - smoothstep(0.035, 0.14, abs(dissolveCoordinate - reveal));
          graded = min(graded + vColor * dissolveEdge * 0.38, vec3(0.98));
          alpha = 1.0;
        }
        gl_FragColor = vec4(
          graded,
          alpha
        );
      }
    `,
    transparent: role !== 'avatar',
    vertexColors: true,
    blending: role === 'avatar' ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: role === 'avatar',
    side: role === 'avatar' ? THREE.FrontSide : THREE.DoubleSide,
    toneMapped: role === 'avatar',
  })
  material.userData = {
    pfxMaterial: 'spawn-telegraph-faceted-arrival-volume',
    role,
    endpointFade: role === 'ribbon',
    brightnessBoost: role === 'avatar' ? 1.08 : role === 'ribbon' ? 1.3 : 1.12,
    rimStrength: role === 'avatar' ? 0.54 : 0.3,
    scanBandContrast: role === 'avatar' ? 0.16 : 0.08,
    midtoneFloor: role === 'avatar' ? 0.32 : role === 'ribbon' ? 0.58 : 0.4,
    specularStrength: role === 'avatar' ? 0.28 : 0.12,
    frontFacesOnly: role === 'avatar',
    releaseLift: role === 'avatar' ? 0.08 : role === 'ribbon' ? 0.25 : 0,
    radialFalloff: role === 'footprint',
    breakupStrength: role === 'avatar' ? 0.5 : role === 'footprint' ? 0 : 1,
    ditheredTransparency: role === 'avatar',
    ditherPeakGain: role === 'avatar' ? 1.1 : 1,
    dissolvePattern: role === 'avatar' ? 'vertical-cell-bands' : 'none',
    dissolveCellDensity: role === 'avatar' ? 18 : 0,
    releaseDissolveDirection: role === 'avatar' ? 'runtime-held-resolved' : 'not-applicable',
    postPeakBehavior: role === 'avatar' ? 'hold-resolved-avatar' : 'not-applicable',
    facetedKeyLight: role === 'avatar',
    energyEdgeFalloff: role === 'avatar' ? 'fresnel-plus-scan' : 'not-applicable',
    facetToneVariation: role === 'avatar' ? 'layered-cyan-violet' : 'not-applicable',
    scanlineEmission: role === 'avatar' ? 0.18 : 0,
    depthOcclusion: role === 'avatar' ? 'nearest-surface' : 'none',
    volumeSoftness: role === 'ribbon',
    veilColorGain: 0,
    silhouetteSeparation: role === 'ribbon' ? 'sector-locked-bright-core' : 'not-applicable',
    warningPlaneFalloff: role === 'footprint',
    warningPlaneCenterAlphaFloor: role === 'footprint' ? 0.52 : 0,
    groundScanEmission: role === 'footprint' ? 0.34 : 0,
    groundRailAlphaCeiling: role === 'footprint' ? 0.62 : 1,
    bodyClearance: role === 'ribbon' ? 'outside-avatar-silhouette' : 'not-applicable',
    endpointTreatment: role === 'ribbon' ? 'dual-geometry-taper-and-alpha-fade' : 'not-applicable',
    railSmoothing: role === 'ribbon' ? '48x8' : 'not-applicable',
    layeredFilamentMaterial: role === 'ribbon',
    prismaticPhaseSeparation: true,
    fragmentReleaseMotion: role === 'ribbon' ? 'outward-rise' : 'not-applicable',
    filamentHaloFalloff: role === 'ribbon',
    filamentCorePulse: role === 'ribbon',
    pylonFacetShading: role === 'ribbon',
    pylonHeightGradient: role === 'ribbon',
    energyMaterialProfile: role === 'ribbon'
      ? 'deep-cyan-shell-white-core-violet-facet-glints'
      : 'not-applicable',
  }
  return material
}
