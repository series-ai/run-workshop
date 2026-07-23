import * as THREE from 'three'
import { markPfxReferenceAdaptation } from '../constants/04'
import { markPfxReferenceAdaptationMaterial } from '../constants/05'
import { createPfxAcidPoolGeometry } from './acidPool'
import { createPfxSlimeBurstCrownGeometry, createPfxSlimeBurstCrownMaterial } from './slimeBurstCrown'

export function createPfxMudBurstReferenceGeometry(): THREE.BufferGeometry {
  // The slime gel crown is the stronger repository reference for this
  // semantic: its rounded core, soft ground lobes, tapered tentacles, and
  // closed tip bulbs already read as a cohesive liquid volume. Adapt those
  // authored shapes into a wet umber palette and add the repo's irregular
  // skirted pool as another closed ground lobe; keep the native gel motion so
  // the result stays wet and grounded instead of becoming a shard fan.
  const source = createPfxSlimeBurstCrownGeometry()
  const sourceRaw = source.index ? source.toNonIndexed() : source
  const sourcePosition = sourceRaw.getAttribute('position')
  const sourceNormal = sourceRaw.getAttribute('normal')
  const sourceCenter = sourceRaw.getAttribute('pfxSlimeBurstCenter')
  const sourceSeed = sourceRaw.getAttribute('pfxSlimeBurstSeed')
  const sourceForm = sourceRaw.getAttribute('pfxSlimeBurstForm')
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  for (let vertex = 0; vertex < sourcePosition.count; vertex += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(sourcePosition, vertex)
    const normal = new THREE.Vector3().fromBufferAttribute(sourceNormal, vertex)
    const origin = new THREE.Vector3().fromBufferAttribute(sourceCenter, vertex)
    positions.push(point.x, point.y, point.z)
    normals.push(normal.x, normal.y, normal.z)
    origins.push(origin.x, origin.y, origin.z)
    forms.push(sourceForm.getX(vertex))
    seeds.push(sourceSeed.getX(vertex))
  }
  const mudClodDescriptors = [
    { center: new THREE.Vector3(-0.62, 0.5, 0.16), scale: new THREE.Vector3(0.14, 0.2, 0.12), seed: 0.08, rotation: new THREE.Euler(0.2, 0.5, -0.25) },
    { center: new THREE.Vector3(0.42, 0.76, 0.24), scale: new THREE.Vector3(0.1, 0.17, 0.13), seed: 0.27, rotation: new THREE.Euler(-0.3, 0.9, 0.18) },
    { center: new THREE.Vector3(0.12, 1.02, -0.3), scale: new THREE.Vector3(0.12, 0.22, 0.1), seed: 0.46, rotation: new THREE.Euler(0.6, -0.4, 0.32) },
    { center: new THREE.Vector3(-0.82, 0.2, -0.3), scale: new THREE.Vector3(0.16, 0.11, 0.13), seed: 0.65, rotation: new THREE.Euler(0.1, 1.2, -0.4) },
    { center: new THREE.Vector3(0.72, 0.28, -0.42), scale: new THREE.Vector3(0.13, 0.12, 0.18), seed: 0.84, rotation: new THREE.Euler(-0.5, 0.2, 0.45) },
  ] as const
  const clod = new THREE.DodecahedronGeometry(1, 1)
  const clodRaw = clod.index ? clod.toNonIndexed() : clod
  const clodPosition = clodRaw.getAttribute('position')
  const clodNormal = clodRaw.getAttribute('normal')
  for (const descriptor of mudClodDescriptors) {
    const matrix = new THREE.Matrix4().compose(descriptor.center, new THREE.Quaternion().setFromEuler(descriptor.rotation), descriptor.scale)
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertex = 0; vertex < clodPosition.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(clodPosition, vertex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(clodNormal, vertex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      forms.push(3)
      seeds.push(descriptor.seed)
    }
  }
  if (clodRaw !== clod) clodRaw.dispose()
  clod.dispose()
  const pool = createPfxAcidPoolGeometry(48, 6)
  const poolRaw = pool.index ? pool.toNonIndexed() : pool
  const poolPosition = poolRaw.getAttribute('position')
  const poolNormal = poolRaw.getAttribute('normal')
  const poolCenter = new THREE.Vector3(0, -0.54, 0)
  const poolScale = new THREE.Vector3(1.08, 1, 0.92)
  const poolMatrix = new THREE.Matrix4().compose(poolCenter, new THREE.Quaternion(), poolScale)
  const poolNormalMatrix = new THREE.Matrix3().getNormalMatrix(poolMatrix)
  for (let vertex = 0; vertex < poolPosition.count; vertex += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(poolPosition, vertex).applyMatrix4(poolMatrix)
    const normal = new THREE.Vector3().fromBufferAttribute(poolNormal, vertex).applyMatrix3(poolNormalMatrix).normalize()
    positions.push(point.x, point.y, point.z)
    normals.push(normal.x, normal.y, normal.z)
    origins.push(poolCenter.x, poolCenter.y, poolCenter.z)
    forms.push(1)
    seeds.push(0.5)
  }
  if (poolRaw !== pool) poolRaw.dispose()
  pool.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxSlimeBurstCenter', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxSlimeBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxSlimeBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.userData = { ...source.userData }
  geometry.userData['pfxSlimeBurstCrownDrawCalls'] = 1
  geometry.userData['pfxSlimeBurstCrownClosedFaces'] = true
  geometry.userData['pfxSlimeBurstCrownBillboardCount'] = 0
  geometry.userData['pfxSlimeBurstGroundedPoolCount'] = 1
  geometry.userData['pfxSlimeBurstPalette'] = 'wet-umber-clay-with-silt-highlight'
  geometry.userData['pfxSlimeBurstCrownTriangleCount'] = positions.length / 9
  geometry.userData['pfxMudBurstRoundedCoreCount'] = 1
  geometry.userData['pfxMudBurstRoundedLobeCount'] = 9
  geometry.userData['pfxMudBurstSplashTentacleCount'] = 11
  geometry.userData['pfxMudBurstTipClotCount'] = 11
  geometry.userData['pfxMudBurstGroundedPoolCount'] = 1
  geometry.userData['pfxMudBurstIrregularClodCount'] = mudClodDescriptors.length
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  if (sourceRaw !== source) sourceRaw.dispose()
  source.dispose()
  geometry.userData['pfxMudBurstAdaptationProfile'] = 'slime-burst-sculpted-gel-crown-adapted-to-wet-mud'
  geometry.userData['pfxMudBurstReferenceGeometryProfile'] = 'closed-wet-gel-core-rounded-lobes-tapered-tentacles-and-grounded-silt-pool'
  geometry.userData['pfxMudBurstWetPigmentProfile'] = 'closed-umber-gel-core-with-rounded-lobes-tapered-mud-tentacles-and-silt-pool'
  geometry.userData['pfxMudBurstCoreProfile'] = 'closed-rounded-wet-gel-core-adapted-as-mud-clump'
  return markPfxReferenceAdaptation(
    geometry,
    'slime-burst-sculpted-gel-crown',
    'wet-umber-gel-crown-adapted-to-grounded-mud-pool',
    [0.82, 0.84, 0.82],
    [0, 0.14, 0],
  )
}

export function createPfxMudBurstReferenceMaterial(
  opacity: number,
  darkColor = '#4a2417',
  wetColor = '#8a522e',
  brightColor = '#d3a070',
  highlightColor = '#f0d0ad',
): THREE.ShaderMaterial {
  const material = markPfxReferenceAdaptationMaterial(
    createPfxSlimeBurstCrownMaterial(opacity, wetColor, brightColor, 0.62, 0.54),
    'slime-burst-sculpted-gel-crown',
    'wet-umber-gel-crown-adapted-to-grounded-mud-pool',
  )
  material.fragmentShader = material.fragmentShader.replace(
    'gelColor += uPrimaryColor * transmissionGlow * 0.08;',
    `gelColor += uPrimaryColor * transmissionGlow * 0.08;
        float mudWetSpecular = pow(max(0.0, dot(normal, normalize(viewDirection + vec3(-0.32, 0.82, 0.46)))), 22.0);
        float mudSurfaceStriation = 0.5 + 0.5 * sin(vSlimeLocalPosition.y * 18.0 + vSlimeLocalPosition.x * 9.0 + vSlimeSeed * 29.0);
        gelColor += uSecondaryColor * mudWetSpecular * (0.64 + mudSurfaceStriation * 0.2);
        gelColor *= 0.92 + mudSurfaceStriation * 0.08;`,
  )
  material.needsUpdate = true
  material.userData['pfxMudBurstReferenceMaterial'] = true
  material.userData['pfxMudBurstMaterialProfile'] = 'translucent-wet-umber-gel-crown-with-silt-rim'
  material.userData['pfxMudBurstEdgeProfile'] = 'grounded-silt-pool-and-rounded-mud-tentacle-edge'
  material.userData['pfxMudBurstReferenceDarkColor'] = darkColor
  material.userData['pfxMudBurstReferenceWetColor'] = wetColor
  material.userData['pfxMudBurstReferenceBrightColor'] = brightColor
  material.userData['pfxMudBurstReferenceHighlightColor'] = highlightColor
  return material
}
