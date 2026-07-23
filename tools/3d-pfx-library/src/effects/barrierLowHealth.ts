import * as THREE from 'three'
import { buildPfxMeshShaderMaterial } from '../constants/06'

export function createPfxBarrierLowHealthMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.ShaderMaterial {
  const material = buildPfxMeshShaderMaterial('barrier-failure-shell', {
    opacity,
    color: new THREE.Color(color).getStyle(),
    blending: 'alpha',
    particleSizeMultiplier: 1,
    edgeHardness: 1,
  })
  material.userData['pfxMaterial'] = 'barrier-low-health-fractured-shell'
  return material
}

export function createPfxBarrierLowHealthGeometry(): THREE.BufferGeometry {
  const source = new THREE.SphereGeometry(0.72, 36, 24).toNonIndexed()
  const sourcePosition = source.getAttribute('position')
  const sourceNormal = source.getAttribute('normal')
  const sourceUv = source.getAttribute('uv')
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const mainBreach = new THREE.Vector3(0.78, 0.18, 0.6).normalize()
  const crownBreach = new THREE.Vector3(-0.54, 0.75, -0.38).normalize()
  const mainBreachThreshold = 0.92
  const crownBreachThreshold = 0.975
  const centroid = new THREE.Vector3()
  const vertex = new THREE.Vector3()
  const sourceTriangleCount = sourcePosition.count / 3
  let liftedPanelCount = 0
  let maximumPanelLift = 0

  for (let triangleIndex = 0; triangleIndex < sourceTriangleCount; triangleIndex += 1) {
    centroid.set(0, 0, 0)
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangleIndex * 3 + corner
      vertex.fromBufferAttribute(sourcePosition, index)
      centroid.add(vertex)
    }
    centroid.normalize()
    const mainFacing = centroid.dot(mainBreach)
    const crownFacing = centroid.dot(crownBreach)
    const azimuth = Math.atan2(centroid.z, centroid.x)
    const branchOne = Math.abs(centroid.y - (0.09 + Math.sin(azimuth * 2.4 + 0.5) * 0.11)) < 0.016
      && mainFacing > 0.46
    const branchTwo = Math.abs(centroid.y - (0.38 - Math.cos(azimuth * 1.7) * 0.1)) < 0.015
      && mainFacing > 0.55
    const removed = mainFacing > mainBreachThreshold || crownFacing > crownBreachThreshold || branchOne || branchTwo
    if (removed) continue

    // A few panels immediately behind the wound peel outward. Because the
    // sphere is non-indexed these are real detached triangular facets: they
    // catch profile light, interrupt the outer contour, and cast different
    // silhouettes from front/oblique/side without another draw call.
    const liftedPanel = mainFacing > 0.72
      && mainFacing <= mainBreachThreshold
      && Math.sin(azimuth * 6.2 + centroid.y * 8.4) > 0.54
      && triangleIndex % 4 === 0
    const panelLift = liftedPanel ? 0.18 + (mainBreachThreshold - mainFacing) * 0.5 : 0
    if (liftedPanel) {
      liftedPanelCount += 1
      maximumPanelLift = Math.max(maximumPanelLift, panelLift)
    }

    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangleIndex * 3 + corner
      vertex.fromBufferAttribute(sourcePosition, index)
      if (liftedPanel) {
        vertex.addScaledVector(mainBreach, panelLift)
        vertex.addScaledVector(centroid, panelLift * 0.22)
      }
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(sourceNormal.getX(index), sourceNormal.getY(index), sourceNormal.getZ(index))
      uvs.push(sourceUv.getX(index), sourceUv.getY(index))
    }
  }
  source.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const retainedTriangleCount = positions.length / 9
  geometry.userData['pfxBarrierLowHealthGeometry'] = 'single-draw-open-asymmetric-fractured-shell'
  geometry.userData['pfxBarrierLowHealthDrawCalls'] = 1
  geometry.userData['pfxBarrierLowHealthOpenShell'] = true
  geometry.userData['pfxBarrierLowHealthBreachCount'] = 2
  geometry.userData['pfxBarrierLowHealthMainBreachThreshold'] = mainBreachThreshold
  geometry.userData['pfxBarrierLowHealthAsymmetric'] = true
  geometry.userData['pfxBarrierLowHealthLiftedPanelCount'] = liftedPanelCount
  geometry.userData['pfxBarrierLowHealthMaximumPanelLift'] = maximumPanelLift
  geometry.userData['pfxBarrierLowHealthRetainedTriangleRatio'] = retainedTriangleCount / sourceTriangleCount
  geometry.userData['pfxBarrierLowHealthDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxBarrierLowHealthMainBreachDirection'] = mainBreach.toArray()
  return geometry
}
