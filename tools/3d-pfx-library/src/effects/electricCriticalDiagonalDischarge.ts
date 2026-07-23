import * as THREE from 'three'
import { createPfxElectricCriticalVoltageCageGeometry } from './electricCriticalVoltageCage'

export function createPfxElectricCriticalDiagonalDischargeGeometry(): THREE.BufferGeometry {
  return createPfxElectricCriticalVoltageCageGeometry()
}
