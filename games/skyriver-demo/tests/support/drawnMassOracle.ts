import * as THREE from 'three';
import { deriveCityLayout } from '../../src/sim/derive';
import { presentCityLayout } from '../../src/render/presentationLayout';
import { deriveCityMasses, warpBoxPoint } from '../../src/render/city';

export function indexedDrawnBoxes(seed = 424242) {
  return deriveCityMasses(presentCityLayout(deriveCityLayout(seed))).map((mass, index) => {
    const warped = warpBoxPoint(mass, mass.x, mass.z, { x: 0, z: 0, heading: 0 });
    const inverse = new THREE.Matrix4().compose(
      new THREE.Vector3(warped.x, mass.y0 + mass.height / 2, warped.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), warped.heading),
      new THREE.Vector3(1, 1, 1),
    ).invert();
    return { index, inverse, half: new THREE.Vector3(mass.width / 2, mass.height / 2, mass.depth / 2) };
  });
}

export function nearestDrawnBox(boxes: ReturnType<typeof indexedDrawnBoxes>, point: { readonly x: number; readonly y: number; readonly z: number }) {
  let nearest = { index: -1, gapM: Infinity };
  for (const box of boxes) {
    const e = box.inverse.elements;
    const x = point.x * e[0]! + point.z * e[8]! + e[12]!;
    const y = point.y + e[13]!;
    const z = point.x * e[2]! + point.z * e[10]! + e[14]!;
    const dx = Math.abs(x) - box.half.x, dy = Math.abs(y) - box.half.y, dz = Math.abs(z) - box.half.z;
    const outside = Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, dz));
    const gapM = outside > 0 ? outside : Math.max(dx, dy, dz);
    if (gapM < nearest.gapM) nearest = { index: box.index, gapM };
  }
  return nearest;
}
