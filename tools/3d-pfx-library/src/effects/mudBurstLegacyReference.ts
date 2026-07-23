import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'

function createPfxMudBurstLegacyReferenceGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
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
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
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

  const woundOrigin = new THREE.Vector3(0, 0.04, 0)
  appendPrimitive(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.Matrix4().compose(woundOrigin, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.36, -0.12)), new THREE.Vector3(0.32, 0.36, 0.28)),
    woundOrigin,
    new THREE.Vector3(),
    0,
    0.5,
    2,
  )

  const jetDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.82, 0.72, -0.34], [0.76, 0.86, 0.38], [-0.92, 0.22, 0.64],
    [0.88, 0.34, -0.62], [-0.58, -0.16, -0.78], [0.62, -0.08, 0.82],
  ]
  jetDirections.forEach(([x, y, z], jetIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const length = 0.46 + jetIndex * 0.035
    const radius = 0.052 + (jetIndex % 3) * 0.012
    appendPrimitive(
      new THREE.CylinderGeometry(radius * 0.52, radius, length, 8, 2, false),
      new THREE.Matrix4().compose(
        woundOrigin.clone().add(direction.clone().multiplyScalar(length * 0.5)),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        new THREE.Vector3(1, 1, 1),
      ),
      woundOrigin,
      direction,
      1,
      jetIndex / jetDirections.length,
      jetIndex % 3 === 0 ? 3 : 1,
    )
  })

  const clotDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.9, 0.62, -0.18], [0.86, 0.7, 0.24], [-0.7, 0.4, 0.78], [0.74, 0.46, -0.72],
    [-1, 0.05, -0.46], [0.94, 0.1, 0.54], [-0.54, -0.34, 0.82], [0.58, -0.28, -0.86],
    [-0.24, 0.86, -0.9], [0.3, 0.92, 0.86], [-0.78, -0.18, 0.2], [0.82, -0.14, -0.16],
  ]
  const depthLanes = [-0.58, -0.29, 0, 0.29, 0.58] as const
  clotDirections.forEach(([x, y, z], clotIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const origin = woundOrigin.clone().add(direction.clone().multiplyScalar(0.2 + (clotIndex % 3) * 0.025))
    origin.z = depthLanes[clotIndex % depthLanes.length]!
    const radius = 0.095 + (clotIndex % 3) * 0.014
    const length = 0.14 + (clotIndex % 4) * 0.035
    appendPrimitive(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.Matrix4().compose(
        origin.clone().add(direction.clone().multiplyScalar(length * 0.08)),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        new THREE.Vector3(radius * (1.1 + (clotIndex % 2) * 0.18), length * 1.35, radius * (0.92 + (clotIndex % 3) * 0.12)),
      ),
      origin,
      direction,
      2,
      clotIndex / clotDirections.length,
      clotIndex % 4 === 0 ? 0 : 1,
    )
  })

  const poolOrigin = new THREE.Vector3(0, -0.58, 0)
  appendPrimitive(
    new THREE.CylinderGeometry(0.66, 0.74, 0.07, 16, 1, false),
    new THREE.Matrix4().makeTranslation(poolOrigin.x, poolOrigin.y, poolOrigin.z),
    poolOrigin,
    new THREE.Vector3(),
    3,
    0.5,
    0,
  )
  for (let lobe = 0; lobe < 6; lobe += 1) {
    const angle = lobe / 6 * Math.PI * 2 + 0.16
    const center = new THREE.Vector3(Math.cos(angle) * 0.52, -0.56 + (lobe % 2) * 0.008, Math.sin(angle) * 0.46)
    appendPrimitive(
      new THREE.SphereGeometry(1, 10, 6),
      new THREE.Matrix4().compose(center, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle * 0.4, 0)), new THREE.Vector3(0.2 + (lobe % 3) * 0.03, 0.045, 0.14 + (lobe % 2) * 0.03)),
      center,
      new THREE.Vector3(),
      3,
      lobe / 6,
      0,
    )
  }

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
  geometry.userData['pfxBloodDeathSplashJetCount'] = jetDirections.length
  geometry.userData['pfxBloodDeathClotCount'] = clotDirections.length
  geometry.userData['pfxBloodDeathClotProfile'] = 'twelve-faceted-ellipsoid-earth-clots'
  geometry.userData['pfxBloodDeathPoolCount'] = 1
  geometry.userData['pfxBloodDeathPoolLobeCount'] = 6
  geometry.userData['pfxBloodDeathPoolGroundOffset'] = -0.58
  geometry.userData['pfxBloodDeathDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxBloodDeathSilhouetteProfile'] = 'compact-wet-clot-core-to-rounded-splash-fan-and-grounded-silt-pool'
  geometry.userData['pfxBloodDeathPalette'] = 'wet-umber-clay-with-silt-highlight'
  geometry.userData['pfxBloodDeathAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxBloodDeathTriangleCount'] = positions.length / 9
  geometry.userData['pfxMudBurstAdaptationProfile'] = 'thickened-closed-clots-with-grounded-silt-pool'
  geometry.userData['pfxMudBurstReferenceGeometryProfile'] = 'faceted-ellipsoid-clots-and-tapered-jets'
  return markPfxReferenceAdaptation(
    geometry,
    'blood-death-pigment-rupture',
    'wet-earth-clot-splash-with-grounded-stain',
    [0.84, 0.8, 0.84],
    [0, 0.12, 0],
  )
}
