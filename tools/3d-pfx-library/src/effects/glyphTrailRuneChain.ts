import * as THREE from 'three'
import { createPfxGlyphTrailLeadSigilGeometry } from './glyphTrailLeadSigil'

export function createPfxGlyphTrailRuneChainGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const runeOrders: number[] = []
  let currentRuneOrder = 0
  const cool: readonly [number, number, number] = [0.2, 0.48, 1]
  const cyan: readonly [number, number, number] = [0.28, 0.88, 1]
  const electric: readonly [number, number, number] = [0.2, 0.68, 1]
  const violet: readonly [number, number, number] = [0.48, 0.24, 0.94]
  const palettes = [cool, cyan, electric, violet] as const
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
    runeOrders.push(currentRuneOrder, currentRuneOrder, currentRuneOrder)
  }
  const pushQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    nearColor: readonly [number, number, number],
    farColor: readonly [number, number, number],
  ) => {
    pushTriangle(a, b, c, nearColor, nearColor, farColor)
    pushTriangle(a, c, d, nearColor, farColor, farColor)
  }
  const addClosedStroke = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    halfWidth: number,
    halfDepth: number,
    startColor: readonly [number, number, number],
    endColor: readonly [number, number, number],
  ) => {
    const direction = end.clone().sub(start).normalize()
    const reference = Math.abs(direction.z) < 0.82
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0)
    const basisA = direction.clone().cross(reference).normalize().multiplyScalar(halfWidth)
    const basisB = direction.clone().cross(basisA).normalize().multiplyScalar(halfDepth)
    const makeTriangularCrossSection = (center: THREE.Vector3) => [
      center.clone().add(basisA),
      center.clone().addScaledVector(basisA, -.5).add(basisB),
      center.clone().addScaledVector(basisA, -.5).sub(basisB),
    ]
    const startCorners = makeTriangularCrossSection(start)
    const endCorners = makeTriangularCrossSection(end)
    pushTriangle(startCorners[0]!, startCorners[2]!, startCorners[1]!, startColor, startColor, startColor)
    pushTriangle(endCorners[0]!, endCorners[1]!, endCorners[2]!, endColor, endColor, endColor)
    for (let side = 0; side < 3; side += 1) {
      const next = (side + 1) % 3
      pushQuad(startCorners[side]!, startCorners[next]!, endCorners[next]!, endCorners[side]!, startColor, endColor)
    }
  }

  type RuneStroke = readonly [readonly [number, number, number], readonly [number, number, number]]
  const runes: Array<{ center: readonly [number, number, number]; strokes: RuneStroke[] }> = [
    { center: [-1.35, -0.2, 0.75], strokes: [
      [[0.14, 0.32, -0.04], [-0.14, 0.3, 0.04]],
      [[-0.14, 0.3, 0.04], [-0.28, 0.08, -0.02]],
      [[-0.28, 0.08, -0.02], [-0.24, -0.2, 0.05]],
      [[-0.24, -0.2, 0.05], [-0.04, -0.32, -0.04]],
      [[-0.04, -0.32, -0.04], [0.16, -0.22, 0.03]],
      [[-0.16, 0.08, 0], [0.07, 0.01, 0.12]],
    ] },
    { center: [-0.55, 0.24, 0.25], strokes: [
      [[0, 0.34, -0.04], [0.25, 0, 0.05]],
      [[0.25, 0, 0.05], [0, -0.34, -0.03]],
      [[0, -0.34, -0.03], [-0.25, 0, 0.04]],
      [[-0.25, 0, 0.04], [0, 0.34, -0.04]],
      [[0, 0.24, -0.02], [0, -0.22, 0.1]],
      [[-0.12, 0.02, -0.06], [0.12, -0.04, 0.08]],
    ] },
    { center: [0.25, -0.24, -0.25], strokes: [
      [[0, -0.34, 0], [0, 0.08, 0.08]],
      [[0, 0.08, 0.08], [-0.24, 0.31, -0.04]],
      [[0, 0.08, 0.08], [0.25, 0.3, 0.03]],
      [[-0.18, -0.03, -0.06], [0.18, -0.03, 0.07]],
      [[-0.18, -0.03, -0.06], [-0.27, 0.16, 0.02]],
    ] },
    { center: [1.05, 0.2, -0.75], strokes: [
      [[-0.3, 0, 0], [-0.12, 0.2, 0.05]],
      [[-0.12, 0.2, 0.05], [0.14, 0.2, -0.04]],
      [[0.14, 0.2, -0.04], [0.3, 0, 0.03]],
      [[0.3, 0, 0.03], [0.12, -0.2, -0.04]],
      [[0.12, -0.2, -0.04], [-0.14, -0.2, 0.04]],
      [[-0.1, -0.04, -0.08], [0.12, 0.07, 0.12]],
    ] },
  ]
  let strokeCount = 0
  for (const [runeIndex, rune] of runes.entries()) {
    // The faceted leader writes first (order 0), followed by the nearest rune
    // and then each older mark toward the rear of the wake.
    currentRuneOrder = 4 - runeIndex
    const [centerX, centerY, centerZ] = rune.center
    const makePoint = ([localX, localY, localZ]: readonly [number, number, number]) => new THREE.Vector3(
      centerX + localX,
      centerY + localY,
      centerZ + localZ,
    )
    for (const [strokeIndex, stroke] of rune.strokes.entries()) {
      const startColor = palettes[runeIndex % palettes.length]!
      const endColor = palettes[(runeIndex + 1) % palettes.length]!
      addClosedStroke(makePoint(stroke[0]), makePoint(stroke[1]), 0.04, 0.034, startColor, endColor)
      strokeCount += 1
    }
  }

  // Three tiny crossed prisms replace a separate particle emitter. They keep
  // the cooling-ink glints in the same merged draw and inherit ordered reveal
  // and erosion from the nearest authored mark.
  const coolingSparklets = [
    { center: new THREE.Vector3(.28, .23, -.18), order: 2 },
    { center: new THREE.Vector3(-.52, .5, .18), order: 3 },
    { center: new THREE.Vector3(.94, .43, -.64), order: 1 },
  ] as const
  for (const sparklet of coolingSparklets) {
    currentRuneOrder = sparklet.order
    const diagonalA = new THREE.Vector3(.065, .065, .018)
    const diagonalB = new THREE.Vector3(.065, -.065, -.018)
    addClosedStroke(sparklet.center.clone().sub(diagonalA), sparklet.center.clone().add(diagonalA), .014, .011, cyan, cool)
    addClosedStroke(sparklet.center.clone().sub(diagonalB), sparklet.center.clone().add(diagonalB), .014, .011, cyan, violet)
    strokeCount += 2
  }

  // The writing head is part of the same merged buffer and draw as the wake.
  // It is deliberately nib-sized, placed directly after the newest rune, and
  // tagged order zero so GPU reveal/erosion keeps the authoring direction.
  const leadGeometry = createPfxGlyphTrailLeadSigilGeometry()
  const leadPositions = leadGeometry.getAttribute('position')
  const leadColors = leadGeometry.getAttribute('color')
  const leadPoint = new THREE.Vector3()
  currentRuneOrder = 0
  for (let index = 0; index < leadPositions.count; index += 1) {
    leadPoint.fromBufferAttribute(leadPositions, index).multiply(new THREE.Vector3(.7, .42, .38)).add(new THREE.Vector3(1.6, 0.03, -1.02))
    positions.push(leadPoint.x, leadPoint.y, leadPoint.z)
    colors.push(leadColors.getX(index), leadColors.getY(index), leadColors.getZ(index))
    runeOrders.push(currentRuneOrder)
  }
  leadGeometry.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxRuneOrder', new THREE.Float32BufferAttribute(runeOrders, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxGlyphTrailGeometry'] = 'single-draw-crossed-closed-prism-rune-chain'
  geometry.userData['pfxGlyphTrailDrawCalls'] = 1
  geometry.userData['pfxGlyphTrailRuneCount'] = runes.length
  geometry.userData['pfxGlyphTrailLeadNibCount'] = 1
  geometry.userData['pfxGlyphTrailStrokeCount'] = strokeCount
  geometry.userData['pfxGlyphTrailStrokeCrossSectionSides'] = 3
  geometry.userData['pfxGlyphTrailClosedVolume'] = true
  geometry.userData['pfxGlyphTrailWorldSpaceVolume'] = true
  geometry.userData['pfxGlyphTrailCrossedPlanes'] = true
  geometry.userData['pfxGlyphTrailGpuWriteOrder'] = true
  geometry.userData['pfxGlyphTrailIntegratedLeadNib'] = true
  geometry.userData['pfxGlyphTrailIntegratedCoolingMoteCount'] = coolingSparklets.length
  geometry.userData['pfxGlyphTrailTriangleCount'] = positions.length / 9
  geometry.userData['pfxGlyphTrailLengthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxGlyphTrailHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxGlyphTrailDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}
