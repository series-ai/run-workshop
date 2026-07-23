import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxMeteorImpactGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = []
  const ensureNonIndexed = (geometry: THREE.BufferGeometry) => (
    geometry.index ? geometry.toNonIndexed() : geometry
  )
  const assignColors = (
    geometry: THREE.BufferGeometry,
    colorAt: (point: THREE.Vector3, index: number) => THREE.Color,
  ) => {
    geometry.deleteAttribute('uv')
    const position = geometry.getAttribute('position')
    const colors = new Float32Array(position.count * 3)
    const point = new THREE.Vector3()
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index)
      const color = colorAt(point, index)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    return geometry
  }

  const bowlPositions: number[] = [0, -0.055, 0]
  const bowlIndices: number[] = []
  const radialSegments = 36
  const rings = [
    { radius: 0.18, height: -0.035 },
    { radius: 0.38, height: -0.01 },
    { radius: 0.58, height: 0.02 },
    { radius: 0.72, height: 0.055 },
  ]
  for (const [ringIndex, ring] of rings.entries()) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2
      const irregular = 1 + Math.sin(angle * 5 + ringIndex * 0.8) * 0.045 + Math.sin(angle * 9 - 0.4) * 0.018
      bowlPositions.push(
        Math.cos(angle) * ring.radius * irregular,
        ring.height + Math.sin(angle * 7 + ringIndex) * 0.012,
        Math.sin(angle) * ring.radius * irregular,
      )
    }
  }
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments
    bowlIndices.push(0, 1 + next, 1 + segment)
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const innerStart = 1 + ringIndex * radialSegments
    const outerStart = innerStart + radialSegments
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments
      bowlIndices.push(
        innerStart + segment, outerStart + next, outerStart + segment,
        innerStart + segment, innerStart + next, outerStart + next,
      )
    }
  }
  const bowlSource = new THREE.BufferGeometry()
  bowlSource.setAttribute('position', new THREE.Float32BufferAttribute(bowlPositions, 3))
  bowlSource.setIndex(bowlIndices)
  const bowl = ensureNonIndexed(bowlSource)
  bowlSource.dispose()
  assignColors(bowl, (vertex) => {
    const radius = Math.hypot(vertex.x, vertex.z)
    const angle = Math.atan2(vertex.z, vertex.x)
    const heat = 1 - THREE.MathUtils.smoothstep(radius, 0.08, 0.72)
    const crackBand = THREE.MathUtils.smoothstep(radius, 0.16, 0.28) * (1 - THREE.MathUtils.smoothstep(radius, 0.58, 0.72))
    const radialCrack = Math.pow(1 - Math.abs(Math.sin(angle * 4 + 0.35)), 12) * crackBand
    const incandescent = THREE.MathUtils.clamp(heat * 0.66 + radialCrack * 0.92, 0, 1)
    return new THREE.Color('#240c08').lerp(new THREE.Color('#ff7918'), incandescent)
  })
  geometries.push(bowl)

  // A meteor *ring* needs a readable boundary beyond the crater mass. Keep
  // the band continuous, then use uneven radii and three darker heat notches
  // so it does not collapse into a stock torus or gameplay reticle.
  const boundarySegmentCount = 28
  const boundaryHeatNotches = new Set([3, 12, 21])
  const boundaryPositions: number[] = []
  const boundaryIndices: number[] = []
  for (let segment = 0; segment < boundarySegmentCount; segment += 1) {
    const next = (segment + 1) % boundarySegmentCount
    const angle = segment / boundarySegmentCount * Math.PI * 2
    const nextAngle = next / boundarySegmentCount * Math.PI * 2
    const innerRadius = 0.96 + Math.sin(angle * 3 + 0.6) * 0.008
    const nextInnerRadius = 0.96 + Math.sin(nextAngle * 3 + 0.6) * 0.008
    const outerRadius = 1.045 + Math.sin(angle * 5 - 0.35) * 0.012 + Math.sin(angle * 2) * 0.005
    const nextOuterRadius = 1.045 + Math.sin(nextAngle * 5 - 0.35) * 0.012 + Math.sin(nextAngle * 2) * 0.005
    const outerTop = 0.035 + Math.sin(angle * 4) * 0.015
    const nextOuterTop = 0.035 + Math.sin(nextAngle * 4) * 0.015
    const innerTop = 0.13 + Math.sin(angle * 3 + 0.45) * 0.042
    const nextInnerTop = 0.13 + Math.sin(nextAngle * 3 + 0.45) * 0.042
    const outerBottom = 0.005 + Math.sin(angle * 2) * 0.003
    const nextOuterBottom = 0.005 + Math.sin(nextAngle * 2) * 0.003
    const innerBottom = 0.02
    const base = boundaryPositions.length / 3
    boundaryPositions.push(
      Math.cos(angle) * outerRadius, outerTop, Math.sin(angle) * outerRadius,
      Math.cos(angle) * innerRadius, innerTop, Math.sin(angle) * innerRadius,
      Math.cos(nextAngle) * nextInnerRadius, nextInnerTop, Math.sin(nextAngle) * nextInnerRadius,
      Math.cos(nextAngle) * nextOuterRadius, nextOuterTop, Math.sin(nextAngle) * nextOuterRadius,
      Math.cos(angle) * outerRadius, outerBottom, Math.sin(angle) * outerRadius,
      Math.cos(angle) * innerRadius, innerBottom, Math.sin(angle) * innerRadius,
      Math.cos(nextAngle) * nextInnerRadius, innerBottom, Math.sin(nextAngle) * nextInnerRadius,
      Math.cos(nextAngle) * nextOuterRadius, nextOuterBottom, Math.sin(nextAngle) * nextOuterRadius,
    )
    boundaryIndices.push(
      base, base + 1, base + 2, base, base + 2, base + 3,
      base + 5, base + 6, base + 2, base + 5, base + 2, base + 1,
    )
  }
  const boundarySource = new THREE.BufferGeometry()
  boundarySource.setAttribute('position', new THREE.Float32BufferAttribute(boundaryPositions, 3))
  boundarySource.setIndex(boundaryIndices)
  const boundaryRing = ensureNonIndexed(boundarySource)
  boundarySource.dispose()
  assignColors(boundaryRing, (vertex) => {
    const radius = Math.hypot(vertex.x, vertex.z)
    const angle = Math.atan2(vertex.z, vertex.x)
    const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2)
    const segment = Math.round(normalizedAngle / (Math.PI * 2) * boundarySegmentCount) % boundarySegmentCount
    const notch = boundaryHeatNotches.has(segment) ? 0.24 : 1
    const innerHeat = 1 - THREE.MathUtils.smoothstep(radius, 0.965, 1.045)
    const pulse = (0.62 + Math.sin(angle * 5 - 0.4) * 0.16 + Math.sin(angle * 2 + 0.8) * 0.1) * notch
    const heat = THREE.MathUtils.clamp(pulse * (0.28 + innerHeat * 0.92), 0, 1)
    return new THREE.Color('#260805').lerp(new THREE.Color('#ff6512'), heat)
  })
  geometries.push(boundaryRing)

  const lipSegmentCount = 24
  const lipPositions: number[] = []
  const lipIndices: number[] = []
  for (let segment = 0; segment < lipSegmentCount; segment += 1) {
    const angle = segment / lipSegmentCount * Math.PI * 2
    const outerRadius = 0.79 + Math.sin(angle * 5 + 0.7) * 0.045 + Math.sin(angle * 9 - 0.4) * 0.018
    const innerRadius = 0.62 + Math.sin(angle * 4 - 0.2) * 0.026
    const outerTop = 0.075 + Math.sin(angle * 7 + 0.3) * 0.055 + Math.sin(angle * 3) * 0.018
    const innerTop = 0.055 + Math.sin(angle * 6 - 0.4) * 0.026
    const outerBottom = -0.02 + Math.sin(angle * 5 + 0.2) * 0.014
    const innerBottom = 0.008 + Math.sin(angle * 4) * 0.01
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    lipPositions.push(
      cos * outerRadius, outerTop, sin * outerRadius,
      cos * innerRadius, innerTop, sin * innerRadius,
      cos * outerRadius * 0.985, outerBottom, sin * outerRadius * 0.985,
      cos * innerRadius * 1.01, innerBottom, sin * innerRadius * 1.01,
    )
  }
  for (let segment = 0; segment < lipSegmentCount; segment += 1) {
    const next = (segment + 1) % lipSegmentCount
    const ot = segment * 4
    const it = ot + 1
    const ob = ot + 2
    const ib = ot + 3
    const nextOt = next * 4
    const nextIt = nextOt + 1
    const nextOb = nextOt + 2
    const nextIb = nextOt + 3
    lipIndices.push(
      it, nextIt, nextOt, it, nextOt, ot,
      ob, ot, nextOt, ob, nextOt, nextOb,
      ib, nextIt, it, ib, nextIb, nextIt,
    )
  }
  const craterLipSource = new THREE.BufferGeometry()
  craterLipSource.setAttribute('position', new THREE.Float32BufferAttribute(lipPositions, 3))
  craterLipSource.setIndex(lipIndices)
  const craterLip = ensureNonIndexed(craterLipSource)
  craterLipSource.dispose()
  assignColors(craterLip, (vertex) => {
    const radius = Math.hypot(vertex.x, vertex.z)
    const innerHeat = 1 - THREE.MathUtils.smoothstep(radius, 0.61, 0.8)
    return new THREE.Color('#170a08').lerp(new THREE.Color('#8b2008'), innerHeat * 0.76)
  })
  geometries.push(craterLip)

  const centerHeight = 0.1
  const meteorRadius = 0.27
  const meteor = ensureNonIndexed(new THREE.DodecahedronGeometry(meteorRadius, 0))
  meteor.scale(1.08, 0.56, 0.84)
  meteor.rotateX(0.12)
  meteor.rotateY(-0.34)
  meteor.rotateZ(0.18)
  const meteorOffset: readonly [number, number] = [0.16, -0.08]
  meteor.translate(meteorOffset[0], 0.06, meteorOffset[1])
  assignColors(meteor, (vertex, index) => {
    const faceBand = Math.floor(index / 3) % 7
    const palette = ['#1c0b09', '#35100a', '#f0520c', '#240c09', '#551307', '#ff8219', '#160a09']
    const color = new THREE.Color(palette[faceBand]!)
    return vertex.y < 0.03 ? color.multiplyScalar(0.72) : color
  })
  geometries.push(meteor)

  const rimRocks = [
    { angle: 0.08, radius: 0.69, size: 0.17, lift: 0.12, scale: [1.35, 0.72, 0.88], rotation: [0.2, 0.6, 0.1] },
    { angle: 0.74, radius: 0.73, size: 0.13, lift: 0.17, scale: [0.86, 1.18, 1.24], rotation: [0.7, 0.2, 0.5] },
    { angle: 1.5, radius: 0.67, size: 0.15, lift: 0.1, scale: [1.2, 0.66, 0.9], rotation: [0.3, 1.1, 0.2] },
    { angle: 2.22, radius: 0.75, size: 0.12, lift: 0.28, scale: [0.9, 1.4, 0.78], rotation: [0.9, 0.4, 0.7] },
    { angle: 3.04, radius: 0.68, size: 0.16, lift: 0.13, scale: [1.28, 0.7, 1.05], rotation: [0.45, 0.8, 0.3] },
    { angle: 3.86, radius: 0.72, size: 0.11, lift: 0.18, scale: [0.82, 1.3, 1.12], rotation: [1, 0.3, 0.6] },
    { angle: 4.58, radius: 0.66, size: 0.14, lift: 0.11, scale: [1.32, 0.64, 0.82], rotation: [0.25, 1.2, 0.4] },
    { angle: 5.42, radius: 0.74, size: 0.13, lift: 0.16, scale: [0.92, 1.16, 1.28], rotation: [0.8, 0.55, 0.9] },
  ] as const
  for (const [rockIndex, rock] of rimRocks.entries()) {
    const rockGeometry = ensureNonIndexed(rockIndex % 3 === 0
      ? new THREE.DodecahedronGeometry(rock.size, 0)
      : rockIndex % 3 === 1
        ? new THREE.IcosahedronGeometry(rock.size, 0)
        : new THREE.ConeGeometry(rock.size * 0.82, rock.size * 1.55, 5, 1))
    rockGeometry.scale(rock.scale[0] * 0.78, rock.scale[1] * 0.72, rock.scale[2] * 0.78)
    rockGeometry.rotateX(rock.rotation[0])
    rockGeometry.rotateY(rock.rotation[1])
    rockGeometry.rotateZ(rock.rotation[2])
    rockGeometry.translate(
      Math.cos(rock.angle) * rock.radius,
      rock.lift * 0.35,
      Math.sin(rock.angle) * rock.radius,
    )
    assignColors(rockGeometry, (_vertex, index) => {
      const palette = ['#210c09', '#3b1008', '#8c2108', '#170a08']
      return new THREE.Color(palette[(rockIndex + Math.floor(index / 3)) % palette.length]!)
    })
    geometries.push(rockGeometry)
  }

  const geometry = mergeGeometries(geometries, false)
  if (!geometry) throw new Error('Unable to merge meteor impact crater geometry')
  geometries.forEach((source) => source.dispose())
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMeteorImpactGeometry'] = 'single-draw-grounded-molten-crater'
  geometry.userData['pfxMeteorImpactDrawCalls'] = 1
  geometry.userData['pfxMeteorImpactCraterFloor'] = true
  geometry.userData['pfxMeteorImpactEmbeddedCore'] = true
  geometry.userData['pfxMeteorImpactRimRockCount'] = rimRocks.length
  geometry.userData['pfxMeteorImpactRimRocksEmbedded'] = true
  geometry.userData['pfxMeteorImpactIrregularRim'] = true
  geometry.userData['pfxMeteorImpactBoundaryRing'] = 'continuous-asymmetric-outer-annulus'
  geometry.userData['pfxMeteorImpactBoundaryContinuous'] = true
  geometry.userData['pfxMeteorImpactBoundaryProfile'] = 'tapered-crater-ridge'
  geometry.userData['pfxMeteorImpactBoundaryMaximumWidth'] = 0.11
  geometry.userData['pfxMeteorImpactBoundaryOuterWall'] = false
  geometry.userData['pfxMeteorImpactBowlDepth'] = 0.11
  geometry.userData['pfxMeteorImpactBoundaryHeatNotchCount'] = boundaryHeatNotches.size
  geometry.userData['pfxMeteorImpactBoundaryInnerHeat'] = true
  geometry.userData['pfxMeteorImpactBoundaryOuterEdgeCool'] = true
  geometry.userData['pfxMeteorImpactBoundaryOuterRadius'] = 1.045
  geometry.userData['pfxMeteorImpactBoundaryHeight'] = 0.17
  geometry.userData['pfxMeteorImpactBoundaryWalls'] = true
  geometry.userData['pfxMeteorImpactCoreOffset'] = Math.hypot(...meteorOffset)
  geometry.userData['pfxMeteorImpactCoreRadius'] = meteorRadius
  geometry.userData['pfxMeteorImpactRimRockArchetypeCount'] = 3
  geometry.userData['pfxMeteorImpactUsesGemPrimitives'] = false
  geometry.userData['pfxMeteorImpactLipSegmentCount'] = lipSegmentCount
  geometry.userData['pfxMeteorImpactRadialHeatCrackCount'] = 8
  geometry.userData['pfxMeteorImpactCenterHeight'] = centerHeight
  geometry.userData['pfxMeteorImpactDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxMeteorImpactHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxMeteorImpactMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: false,
    opacity: 1,
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
    metalness: 0.05,
    roughness: 0.64,
    emissive: new THREE.Color('#2d0702'),
    emissiveIntensity: 0.7,
  })
  material.userData['pfxMaterial'] = 'meteor-ring-molten-impact'
  material.userData['pfxAuthoredOpacity'] = opacity
  return material
}

export function applyPfxMeteorImpactAppearance(
  material: THREE.MeshStandardMaterial,
  heat: number,
): { visible: boolean; emissiveIntensity: number; colorMultiplier: number } {
  const energy = THREE.MathUtils.clamp(heat, 0, 1)
  const emissiveIntensity = 0.08 + Math.pow(energy, 0.75) * 0.62
  const colorMultiplier = 0.12 + Math.pow(energy, 1.2) * 0.88
  material.transparent = false
  material.opacity = 1
  material.emissiveIntensity = emissiveIntensity
  material.color.setRGB(
    colorMultiplier,
    colorMultiplier * (0.62 + energy * 0.38),
    colorMultiplier * (0.5 + energy * 0.5),
  )
  return { visible: energy > 0.02, emissiveIntensity, colorMultiplier }
}
