import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

function createPfxHealingBurstBloomLegacyGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendPrimitive = (source: THREE.BufferGeometry, matrix: THREE.Matrix4, center: THREE.Vector3, seed: number, form: number) => {
    const geometry = source.index ? source.toNonIndexed() : source
    const attribute = geometry.getAttribute('position')
    for (let vertex = 0; vertex < attribute.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(attribute, vertex).applyMatrix4(matrix)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (geometry !== source) geometry.dispose()
    source.dispose()
  }
  const coreCenter = new THREE.Vector3(0, 0.35, 0)
  appendPrimitive(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.Matrix4().compose(coreCenter, new THREE.Quaternion(), new THREE.Vector3(0.43, 0.52, 0.43)),
    coreCenter,
    0.08,
    0,
  )

  // Six closed faceted petals make a renewal wreath around the seed. This
  // keeps the connecting contour volumetric and authored instead of relying
  // on a low-detail torus that can read as a pasted UI ring.
  const wreathPetalCount = 6
  for (let petal = 0; petal < wreathPetalCount; petal += 1) {
    const seed = 0.28 + petal * 0.09
    const angle = petal / wreathPetalCount * Math.PI * 2 + 0.22
    const petalCenter = new THREE.Vector3(Math.cos(angle) * 0.38, 0.42 + Math.sin(angle * 2) * 0.045, Math.sin(angle) * 0.38)
    const radial = petalCenter.clone().setY(0).normalize()
    const petalRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial)
    appendPrimitive(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.Matrix4().compose(petalCenter, petalRotation, new THREE.Vector3(0.14, 0.24, 0.12)),
      petalCenter,
      seed,
      2,
    )
  }

  // A 3D plus built from three rounded orthogonal capsules: it keeps the
  // universal heal-cross cue while removing the hard box-icon silhouette.
  const appendPlusPrism = (center: THREE.Vector3, rotation: THREE.Quaternion, halfLength: number, seed: number, form: number) => {
    const radius = halfLength * 0.28
    const capsuleLength = Math.max(0.02, halfLength * 2 - radius * 2)
    const axisRotations = [
      new THREE.Quaternion(),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI * 0.5)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, 0)),
    ]
    for (const axisRotation of axisRotations) {
      appendPrimitive(
        new THREE.CapsuleGeometry(radius, capsuleLength, 1, 6),
        new THREE.Matrix4().compose(center, rotation.clone().multiply(axisRotation), new THREE.Vector3(1, 1, 1)),
        center,
        seed,
        form,
      )
    }
  }

  // Adapt the healing-loop glyph language into a compact burst: the centered
  // hero cross is deliberately made from three closed bars so its medical cue
  // survives the camera angle, while two smaller rounded crosses remain
  // anchored in the wreath. The satellites retain the softer renewal language.
  const heroCrossCenter = new THREE.Vector3(0, 0.56, 0.48)
  const heroCrossRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0.08, -0.08))
  const appendHeroCrossBar = (size: readonly [number, number, number], seed: number) => {
    appendPrimitive(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.Matrix4().compose(heroCrossCenter, heroCrossRotation, new THREE.Vector3(1, 1, 1)),
      heroCrossCenter,
      seed,
      1,
    )
  }
  appendHeroCrossBar([0.18, 0.5, 0.16], 0.14)
  appendHeroCrossBar([0.5, 0.18, 0.16], 0.15)
  appendHeroCrossBar([0.16, 0.16, 0.34], 0.16)
  const crossMoteCount = 3
  const moteRadii = [0.42, 0.46] as const
  const moteHeights = [0.35, 0.68] as const
  for (let mote = 0; mote < crossMoteCount - 1; mote += 1) {
    const seed = ((mote * 37 + 31) % 101) / 101
    const angle = mote * 2.4 + (seed - 0.5) * 0.3 + 0.42
    const radius = moteRadii[mote]!
    const center = new THREE.Vector3(Math.cos(angle) * radius, moteHeights[mote]!, Math.sin(angle) * radius)
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 + mote * 0.22, angle + 0.5, 0.24 - mote * 0.13))
    appendPlusPrism(center, tilt, 0.16 + (mote % 2) * 0.018, seed, 1)
  }

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxHealingBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxHealingBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxHealingBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxHealingBurstBloomDrawCalls'] = 1
  geometry.userData['pfxHealingBurstBloomClosedFaces'] = true
  geometry.userData['pfxHealingBurstBloomSmoothNormals'] = true
  geometry.userData['pfxHealingBurstBloomBillboardCount'] = 0
  geometry.userData['pfxHealingBurstCoreCount'] = 1
  geometry.userData['pfxHealingBurstCrossMoteCount'] = crossMoteCount
  geometry.userData['pfxHealingBurstHeroCrossCount'] = 1
  geometry.userData['pfxHealingBurstCrownCrossCount'] = 0
  geometry.userData['pfxHealingBurstDepthLayerCount'] = 7
  geometry.userData['pfxHealingBurstGameplayScaleProfile'] = 'character-width-restoration-cross-motes'
  geometry.userData['pfxHealingBurstOnsetScaleFloor'] = 0.56
  geometry.userData['pfxHealingBurstWreathCount'] = 1
  geometry.userData['pfxHealingBurstWreathPetalCount'] = wreathPetalCount
  geometry.userData['pfxHealingBurstConnectedSilhouette'] = true
  geometry.userData['pfxHealingBurstWreathProfile'] = 'closed-renewal-wreath-around-integrated-seed'
  geometry.userData['pfxHealingBurstWreathTopology'] = 'six-closed-rounded-petals-around-seed'
  geometry.userData['pfxHealingBurstHeroCrossTopology'] = 'three-axis-closed-bar-cross-from-healing-loop-reference'
  geometry.userData['pfxHealingBurstCrossMoteProfile'] = 'rounded-orthogonal-renewal-capsules-with-centered-hero-cross'
  geometry.userData['pfxHealingBurstPetalGeometryProfile'] = 'closed-faceted-diamond-petal-volumes'
  geometry.userData['pfxHealingBurstCoreGeometryProfile'] = 'rounded-faceted-renewal-seed'
  geometry.userData['pfxHealingBurstCoreIntegrationProfile'] = 'mint-seed-nested-inside-overlapping-rounded-renewal-wreath-and-cross-motes'
  geometry.userData['pfxHealingBurstDecayFoldProfile'] = 'cross-motes-fold-inward-under-rising-recovery'
  geometry.userData['pfxHealingBurstDecayFoldScale'] = 0.35
  geometry.userData['pfxHealingBurstDecayVisibilityProfile'] = 'persistent-mint-cross-and-seed-floor-through-decay'
  geometry.userData['pfxHealingBurstSilhouette'] = 'connected-restoration-wreath-with-centered-hero-cross-and-two-anchored-heal-cross-motes'
  geometry.userData['pfxHealingBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxHealingBurstBloomTriangleCount'] = positions.length / 9
  geometry.userData['pfxHealingBurstBloomWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxHealingBurstBloomDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxHealingBurstBloomHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}
