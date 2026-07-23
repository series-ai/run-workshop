import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { createPfxMudChargeGeometry } from './mudCharge'

function createPfxMudBurstChargeReferenceGeometry(): THREE.BufferGeometry {
  // The certified mud-charge rig is the stronger repository reference here:
  // it has authored low-poly clods, a three-lobe compressed core, and shaped
  // ground heaves. Adapt its fields into the ballistic burst shader instead
  // of reusing the old smooth pebble scatter.
  const source = createPfxMudChargeGeometry()
  const sourcePositions = source.getAttribute('position')
  const sourceNormals = source.getAttribute('normal')
  const sourceAnchors = source.getAttribute('pfxMudChargeAnchor')
  const sourceTargets = source.getAttribute('pfxMudChargeTarget')
  const sourceSeeds = source.getAttribute('pfxMudChargeSeed')
  const sourceForms = source.getAttribute('pfxMudChargeForm')
  const sourcePaletteIndices = source.getAttribute('pfxMudChargePaletteIndex')
  const positions = Array.from(sourcePositions.array as ArrayLike<number>)
  const normals = Array.from(sourceNormals.array as ArrayLike<number>)
  const origins: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const vertexCount = sourcePositions.count
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const anchor = new THREE.Vector3().fromBufferAttribute(sourceAnchors, vertex)
    const target = new THREE.Vector3().fromBufferAttribute(sourceTargets, vertex)
    const sourceForm = sourceForms.getX(vertex)
    const mappedForm = sourceForm < 0.5 ? 2 : sourceForm < 1.5 ? 0 : 3
    const origin = mappedForm === 0 ? target : anchor
    const direction = mappedForm === 2
      ? anchor.clone().sub(target).normalize()
      : anchor.clone().setY(0.02).normalize()
    origins.push(origin.x, origin.y, origin.z)
    directions.push(direction.x, direction.y, direction.z)
    forms.push(mappedForm)
    seeds.push(sourceSeeds.getX(vertex))
    paletteIndices.push(sourcePaletteIndices.getX(vertex))
  }

  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    form: 0 | 1 | 2 | 3,
    seed: number,
    paletteIndex: number,
  ) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertex = 0; vertex < rawPositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(origin.x, origin.y, origin.z)
      directions.push(direction.x, direction.y, direction.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
    primitive.dispose()
  }

  const splashOrigin = new THREE.Vector3(0, 0.48, 0)
  const splashDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.82, 0.72, -0.34], [0.76, 0.86, 0.38], [-0.92, 0.22, 0.64],
    [0.88, 0.34, -0.62], [-0.58, -0.16, -0.78], [0.62, -0.08, 0.82],
  ]
  splashDirections.forEach(([x, y, z], splashIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const length = 0.5 + splashIndex * 0.035
    const radius = 0.058 + (splashIndex % 3) * 0.012
    appendPrimitive(
      new THREE.CylinderGeometry(radius * 0.48, radius, length, 7, 2, false),
      new THREE.Matrix4().compose(
        splashOrigin.clone().add(direction.clone().multiplyScalar(length * 0.5)),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        new THREE.Vector3(1, 1, 1),
      ),
      splashOrigin,
      direction,
      1,
      0.72 + splashIndex / splashDirections.length * 0.22,
      splashIndex % 3 === 0 ? 3 : 1,
    )
  })
  source.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxBloodDeathOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxBloodDeathDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxBloodDeathForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxBloodDeathSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxBloodDeathPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxBloodDeathDrawCalls'] = 1
  geometry.userData['pfxBloodDeathClosedFaces'] = true
  geometry.userData['pfxBloodDeathBillboardCount'] = 0
  geometry.userData['pfxBloodDeathWoundCoreCount'] = 1
  geometry.userData['pfxBloodDeathSplashJetCount'] = splashDirections.length
  geometry.userData['pfxBloodDeathClotCount'] = 14
  geometry.userData['pfxBloodDeathClotProfile'] = 'fourteen-faceted-earth-clods-from-mud-charge-reference'
  geometry.userData['pfxBloodDeathPoolCount'] = 1
  geometry.userData['pfxBloodDeathPoolLobeCount'] = 3
  geometry.userData['pfxBloodDeathPoolGroundOffset'] = -0.2
  geometry.userData['pfxBloodDeathDepthLaneCount'] = 5
  geometry.userData['pfxBloodDeathSilhouetteProfile'] = 'faceted-earth-clods-through-ground-heaves-and-tapered-splash-fan'
  geometry.userData['pfxBloodDeathPalette'] = 'wet-umber-clay-sunlit-earth-with-silt-highlight'
  geometry.userData['pfxBloodDeathAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxBloodDeathTriangleCount'] = positions.length / 9
  geometry.userData['pfxMudChargeClodCount'] = 14
  geometry.userData['pfxMudChargeCoreLobeCount'] = 3
  geometry.userData['pfxMudChargeGroundHeaveCount'] = 3
  geometry.userData['pfxMudBurstAdaptationProfile'] = 'mud-charge-clod-convergence-adapted-to-ballistic-burst'
  geometry.userData['pfxMudBurstReferenceGeometryProfile'] = 'faceted-earth-clods-ground-heaves-and-tapered-splash-jets'
  return markPfxReferenceAdaptation(
    geometry,
    'mud-charge-sculpted-clods',
    'wet-umber-helical-clods-with-grounded-silt-heaves',
    [0.84, 0.8, 0.84],
    [0, 0.12, 0],
  )
}
