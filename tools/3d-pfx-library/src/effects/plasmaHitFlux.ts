import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { appendPfxPlasmaHitTube } from '../constants/04'

export function createPfxPlasmaHitFluxGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const arcs = [
    { length: 1.32, y: 0.025, z: -0.01, driftY: 0.48, driftZ: -0.34, forkY: 0.25, forkZ: 0.1, phase: 0.15, forkRootIndex: 4, forkLength: 0.34, color: [0.08, 0.92, 1] },
    { length: 1.16, y: -0.025, z: 0.01, driftY: -0.44, driftZ: 0.4, forkY: -0.23, forkZ: -0.17, phase: 1.35, forkRootIndex: 3, forkLength: 0.3, color: [0.62, 0.16, 1] },
    { length: 1.02, y: 0, z: 0.02, driftY: 0.1, driftZ: 0.52, forkY: 0.2, forkZ: 0.24, phase: 2.55, forkRootIndex: 5, forkLength: 0.26, color: [0.22, 0.58, 1] },
  ] as const
  for (const arc of arcs) {
    const centers = Array.from({ length: 8 }, (_, index) => {
      const t = index / 7
      const peel = t * t * (3 - 2 * t)
      const agitation = Math.sin(t * Math.PI * 4.5 + arc.phase) * peel * (0.012 + t * 0.028)
      return new THREE.Vector3(
        0.14 - t * arc.length,
        arc.y + peel * arc.driftY + agitation,
        arc.z + peel * arc.driftZ + Math.cos(t * Math.PI * 3.5 + arc.phase) * peel * (0.012 + t * 0.024),
      )
    })
    const primaryRadii = [0.052, 0.052, 0.049, 0.044, 0.037, 0.029, 0.019, 0.006] as const
    appendPfxPlasmaHitTube(positions, colors, centers, primaryRadii, arc.color)
    const forkRoot = centers[arc.forkRootIndex]!
    const fork = Array.from({ length: 5 }, (_, index) => {
      const t = index / 4
      return new THREE.Vector3(
        forkRoot.x - t * arc.forkLength,
        forkRoot.y + t * arc.forkY + Math.sin(t * Math.PI * 2.5 + arc.phase) * 0.032,
        forkRoot.z + t * arc.forkZ + Math.cos(t * Math.PI * 2 + arc.phase) * 0.03,
      )
    })
    appendPfxPlasmaHitTube(positions, colors, fork, [0.03, 0.025, 0.019, 0.012, 0.004], arc.color)
  }
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  raw.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const geometry = mergeVertices(raw, 1e-4)
  raw.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxPlasmaHitFluxDrawCalls'] = 1
  geometry.userData['pfxPlasmaHitFluxClosedVolume'] = true
  geometry.userData['pfxPlasmaHitFluxPrimaryCount'] = arcs.length
  geometry.userData['pfxPlasmaHitFluxForkCount'] = arcs.length
  geometry.userData['pfxPlasmaHitFluxCrossSectionSides'] = 8
  geometry.userData['pfxPlasmaHitFluxDirectionalFan'] = true
  geometry.userData['pfxPlasmaHitFluxCompactRootNexus'] = true
  geometry.userData['pfxPlasmaHitFluxRootCenterSpanY'] = 0.05
  geometry.userData['pfxPlasmaHitFluxRootCenterSpanZ'] = 0.03
  geometry.userData['pfxPlasmaHitFluxSmoothPeel'] = true
  geometry.userData['pfxPlasmaHitFluxCompleteRingCount'] = 0
  geometry.userData['pfxPlasmaHitFluxWorldSpaceVolume'] = true
  geometry.userData['pfxPlasmaHitFluxFunction'] = 'three-asymmetric-backward-peeling-magnetic-streamers'
  geometry.userData['pfxPlasmaHitFluxSmoothWeldedNormals'] = true
  geometry.userData['pfxPlasmaHitFluxPrimaryRootRadius'] = 0.06
  geometry.userData['pfxPlasmaHitFluxAxialTravel'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxPlasmaHitFluxFaceCount'] = geometry.index!.count / 3
  return geometry
}
