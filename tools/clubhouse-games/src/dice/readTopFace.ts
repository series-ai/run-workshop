import * as THREE from 'three'
import { facesForDie } from './geometry'
import { DieKind } from './kinds'
import { BOX_FACE, BoxFaceName } from '../three/BoxPiece'
import { DIE_FACES } from './pipFaces'

const LOCAL: Record<BoxFaceName, THREE.Vector3> = {
  px: new THREE.Vector3(1, 0, 0),
  nx: new THREE.Vector3(-1, 0, 0),
  py: new THREE.Vector3(0, 1, 0),
  ny: new THREE.Vector3(0, -1, 0),
  pz: new THREE.Vector3(0, 0, 1),
  nz: new THREE.Vector3(0, 0, -1),
}

const _n = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _down = new THREE.Vector3(0, -1, 0)

export function readTopFace(kind: DieKind, quaternion: THREE.Quaternion): number {
  if (kind === 6) {
    let best: BoxFaceName = 'py'
    let bestDot = -Infinity
    const names = Object.keys(BOX_FACE) as BoxFaceName[]
    for (const name of names) {
      _n.copy(LOCAL[name]).applyQuaternion(quaternion)
      const d = _n.dot(_up)
      if (d > bestDot) {
        bestDot = d
        best = name
      }
    }
    return DIE_FACES[best]
  }

  // A tetrahedron rests on a face, so the result is the face on the table.
  const axis = kind === 4 ? _down : _up
  const faces = facesForDie(kind, 1)
  let bestVal = faces[0].value
  let bestDot = -Infinity
  for (const f of faces) {
    _n.copy(f.normal).applyQuaternion(quaternion)
    const d = _n.dot(axis)
    if (d > bestDot) {
      bestDot = d
      bestVal = f.value
    }
  }
  return bestVal
}

// Verified against three.js eulers: Rx(−π/2) maps +z→+y; Rz(+π/2) maps +x→+y.
const D6_TOP_EULER: Record<number, THREE.Euler> = {
  3: new THREE.Euler(0, 0, 0),
  4: new THREE.Euler(Math.PI, 0, 0),
  1: new THREE.Euler(-Math.PI / 2, 0, 0),
  6: new THREE.Euler(Math.PI / 2, 0, 0),
  2: new THREE.Euler(0, 0, Math.PI / 2),
  5: new THREE.Euler(0, 0, -Math.PI / 2),
}

export function restQuaternion(
  kind: DieKind,
  value: number,
  yaw = 0,
): THREE.Quaternion {
  const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
  if (kind === 6) {
    const euler = D6_TOP_EULER[value]
    if (!euler) throw new Error(`No d6 rest pose for value ${value}`)
    const q = new THREE.Quaternion().setFromEuler(euler)
    return yawQ.multiply(q)
  }
  const axis = kind === 4 ? _down : _up
  const face = facesForDie(kind, 1).find((f) => f.value === value)
  if (!face) throw new Error(`No d${kind} face for value ${value}`)
  const q = new THREE.Quaternion().setFromUnitVectors(face.normal, axis)
  return yawQ.multiply(q)
}

export function snapToFace(kind: DieKind, quaternion: THREE.Quaternion): THREE.Quaternion {
  const value = readTopFace(kind, quaternion)
  const yaw = Math.atan2(
    2 * (quaternion.w * quaternion.y + quaternion.x * quaternion.z),
    1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z),
  )
  return restQuaternion(kind, value, yaw)
}
