import * as THREE from 'three'

export function applyPfxSurfaceRotation(
  object: THREE.Object3D,
  cameraQuaternion: THREE.Quaternion,
  cameraFacing: boolean,
  rotationZ: number,
  parentWorldQuaternion?: THREE.Quaternion,
): void {
  if (cameraFacing) {
    object.quaternion.copy(cameraQuaternion)
    if (parentWorldQuaternion) {
      const inverseParent = (object.userData['pfxInverseParentQuaternion'] as THREE.Quaternion | undefined) ?? new THREE.Quaternion()
      object.userData['pfxInverseParentQuaternion'] = inverseParent
      inverseParent.copy(parentWorldQuaternion).invert()
      object.quaternion.premultiply(inverseParent)
    }
  } else {
    const authoredQuaternion = object.userData['pfxAuthoredQuaternion'] as THREE.Quaternion | undefined
    if (!authoredQuaternion) object.userData['pfxAuthoredQuaternion'] = object.quaternion.clone()
    object.quaternion.copy(object.userData['pfxAuthoredQuaternion'] as THREE.Quaternion)
  }
  object.rotateZ(rotationZ)
}
