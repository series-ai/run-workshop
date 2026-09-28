import { expect, it } from 'vitest';
import * as THREE from 'three';
import { openTankFrameBoxes } from './YardShell';

it('leaves the water accessible from above and encloses each side', () => {
  const boxes = openTankFrameBoxes(4.3, 3.15, 0.4, 0.1).map(({ center, size }) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...center), new THREE.Vector3(...size)));
  const above = new THREE.Ray(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
  expect(boxes.some((box) => above.intersectsBox(box))).toBe(false);
  for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    const outward = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(...direction));
    expect(boxes.filter((box) => outward.intersectsBox(box))).toHaveLength(1);
  }
});
