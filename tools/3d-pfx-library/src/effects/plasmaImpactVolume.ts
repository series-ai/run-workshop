import * as THREE from 'three'

export function createPfxPlasmaImpactVolumeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const pushQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray())
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1)
  }

  // Broad arrival-axis sheet, narrower depth sheet, and offset diagonal sheet.
  // Their negative-X reach gives a projectile-contact direction while the
  // crossed spans retain front/side resilience in one draw.
  pushQuad(
    new THREE.Vector3(-1.22, -0.78, 0),
    new THREE.Vector3(0.62, -0.7, 0),
    new THREE.Vector3(0.52, 0.7, 0),
    new THREE.Vector3(-1.06, 0.82, 0),
  )
  pushQuad(
    new THREE.Vector3(-0.2, -0.7, -0.66),
    new THREE.Vector3(-0.06, -0.7, 0.66),
    new THREE.Vector3(-0.02, 0.66, 0.58),
    new THREE.Vector3(-0.18, 0.72, -0.58),
  )
  pushQuad(
    new THREE.Vector3(-0.88, -0.62, -0.48),
    new THREE.Vector3(0.42, -0.58, 0.38),
    new THREE.Vector3(0.36, 0.58, 0.34),
    new THREE.Vector3(-0.82, 0.64, -0.44),
  )
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.userData = {
    pfxPlasmaImpactVolumePlanes: 3,
    pfxPlasmaImpactDirectionalAxis: 'negative-x-projectile-arrival',
    pfxPlasmaImpactCameraFacing: false,
    pfxPlasmaImpactDrawCalls: 1,
  }
  return geometry
}
