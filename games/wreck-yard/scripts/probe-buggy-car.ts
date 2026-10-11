// Drive the real buggy into car props, then try to reverse.
import { mkdirSync, writeFileSync } from 'node:fs';
import { meters, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { YardSim } from '../src/sim/sim';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { FLOOR_Y } from '../src/sim/constants';
import { physicsBodyHandle, physicsStateBodyById, replacePhysicsPose } from '../src/sim/physics';
import '../src/deterministicMath';

const results = [];
for (const id of [process.env.CAR_PROBE_ID ?? 'yard-ne-cars-b-0']) {
  for (const offset of [-1.3, -0.7, 0, 0.7, 1.3]) {
    for (const driveTicks of [90, 150]) {
      const sim = YardSim.create(1);
      try {
        for (let t = 0; t < 60; t++) sim.step([NEUTRAL_INPUT]);
        const target = physicsStateBodyById(sim.state.world, id)!;
        if (!target) throw new Error(`Missing car ${id}`);
        sim.edit((physics) => { replacePhysicsPose(physics, 'vehicle-chassis', { x: target.x + offset, y: FLOOR_Y + 1.05, z: target.z + 6, vx: 0, vy: 0, vz: 0 }); physics.world.setBodyTransform(physicsBodyHandle(physics, 'vehicle-chassis'), { position: vec3(meters, target.x + offset, FLOOR_Y + 1.05, target.z + 6), orientation: { x:0, y:0, z:0, w:1 } }); });
        const save = sim.save();
        sim.restore({ ...save, state: { ...save.state, players: save.state.players.map((p) => ({ ...p, x: target.x + offset, y: FLOOR_Y + 1.5, z: target.z + 6, ridingVehicle: true })) } });
        sim.release(save);
        const history = [];
        for (let t = 0; t < driveTicks + 120; t++) {
          const state = sim.step([{ ...NEUTRAL_INPUT, moveZ: t < driveTicks ? 1 : -1 }]);
          const buggy = physicsStateBodyById(state.world, 'vehicle-chassis')!;
          history.push({ t, pose: [buggy.x, buggy.y, buggy.z], velocity: [buggy.vx, buggy.vy, buggy.vz], rotation: buggy.orientation, wheels: state.buggyWheels, mounted: state.players[0]!.ridingVehicle, vehicle: state.buggyVehicle, contacts: sim.physics.world.latest().contacts.filter((c) => c.bodyKeyA === "vehicle-chassis" || c.bodyKeyB === "vehicle-chassis") });
        }
        const before = history[driveTicks - 1]!;
        const after = history.at(-1)!;
        const reverseDistance = after.pose[2]! - before.pose[2]!;
        const nearby = sim.state.world.bodies.filter((b) => b.id !== 'vehicle-chassis' && Math.hypot(b.x - after.pose[0]!, b.z - after.pose[2]!) < 5);
        const result = { id, offset, driveTicks, reverseDistance, before, after, nearby, history };
        results.push(result);
        console.log(JSON.stringify({ id, offset, driveTicks, reverseDistance, before: before.pose, after: after.pose, grounded: after.wheels?.map((w) => w.grounded) }));
      } finally { sim.dispose(); }
    }
  }
}
mkdirSync('test-results/buggy-car', { recursive: true });
writeFileSync('test-results/buggy-car/game-probe.json', JSON.stringify(results, (_, v) => typeof v === 'bigint' ? String(v) : v));
