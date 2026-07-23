import * as THREE from 'three'
import { createPfxElectricCriticalVoltageCageGeometry } from './electricCriticalVoltageCage'

export function createPfxElectricCriticalImpactStarburstGeometry(): THREE.BufferGeometry {
  return createPfxElectricCriticalVoltageCageGeometry()
}
