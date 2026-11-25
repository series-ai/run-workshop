// node --test tests/trainkit.test.mjs: door and pantograph clips play separately
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Car } from '../viewer/train-kit.js';

function tram() {
  const group = new THREE.Group();
  const root = new THREE.Group();
  root.name = 'tram';
  group.add(root);
  for (const n of ['body', 'panto-lower', 'panto-upper', 'door-l1', 'door-r1']) {
    const o = new THREE.Object3D();
    o.name = n;
    root.add(o);
  }
  const open = new THREE.AnimationClip('open', 1, [
    new THREE.QuaternionKeyframeTrack('panto-lower.quaternion', [0, 1], [0, 0, 0, 1, -0.3, 0, 0, 0.954]),
    new THREE.VectorKeyframeTrack('door-l1.position', [0, 1], [0, 0, 0, 0, 0, 8]),
  ]);
  const close = new THREE.AnimationClip('close', 1, [
    new THREE.QuaternionKeyframeTrack('panto-lower.quaternion', [0, 1], [-0.3, 0, 0, 0.954, 0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('door-l1.position', [0, 1], [0, 0, 8, 0, 0, 0]),
  ]);
  const mixer = new THREE.AnimationMixer(group);
  const model = { group, clips: [open, close], mixer, play: () => null };
  return new Car(group, { wheels: {}, bogies: [] }, false, model);
}

test('setPantograph moves only the pantograph, setDoors only the doors', () => {
  const car = tram();
  assert.equal(car.hasPanto, true);
  const panto = car.group.getObjectByName('panto-lower');
  const door = car.group.getObjectByName('door-l1');
  car.setPantograph(true);
  car.model.mixer.update(2);
  assert.ok(Math.abs(panto.quaternion.x + 0.3) < 1e-3, 'pantograph raised');
  assert.equal(door.position.z, 0, 'doors untouched');
  assert.equal(car.pantoUp, true);
  car.setDoors(true);
  car.model.mixer.update(2);
  assert.ok(Math.abs(door.position.z - 8) < 1e-6, 'doors open');
  assert.ok(Math.abs(panto.quaternion.x + 0.3) < 1e-3, 'pantograph still up');
  car.setDoors(false);
  car.model.mixer.update(2);
  assert.ok(Math.abs(door.position.z) < 1e-6, 'doors shut');
  assert.ok(Math.abs(panto.quaternion.x + 0.3) < 1e-3, 'pantograph still up');
  car.setPantograph(false);
  car.model.mixer.update(2);
  assert.ok(Math.abs(panto.quaternion.x) < 1e-3, 'pantograph down');
  assert.equal(car.pantoUp, false);
});
