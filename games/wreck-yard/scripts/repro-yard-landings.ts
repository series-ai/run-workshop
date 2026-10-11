// Run: esbuild scripts/repro-yard-landings.ts --bundle --platform=node --format=esm --external:@series-inc/* --outfile=test-results/repro-yard-landings.mjs
// Then: node test-results/repro-yard-landings.mjs --assert
import '../src/deterministicMath';
import { meters } from '@series-inc/rundot-syncplay/physics/3d';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { physicsBodyHandle } from '../src/sim/physics';
import { YardSim } from '../src/sim/sim';

const fixtures = [
  { id: 'steel-case', offset: [0, 0] },
  { id: 'steel-case', offset: [0.65, 0] },
  { id: 'steel-case', offset: [0, 0.65] },
  { id: 'ballast-box', offset: [0, 0.65] },
  { id: 'container-deck-north', offset: [0, 0] },
  { id: 'bay-wreck-0', offset: [0, 0] },
] as const;
const sim = YardSim.create(1);
const results = [];
try {
  for (let tick = 0; tick < 90; tick += 1) sim.step([NEUTRAL_INPUT]);
  const initial = sim.save();
  try {
    for (const fixture of fixtures) {
      sim.restore(initial);
      const body = sim.physics.world.readBody(physicsBodyHandle(sim.physics, fixture.id));
      const x = body.position.x + fixture.offset[0];
      const z = body.position.z + fixture.offset[1];
      const surface = sim.physics.world.raycast({ x: meters(x), y: meters(body.position.y + 4), z: meters(z), dx: 0, dy: -1, dz: 0, maxDistance: meters(10), maxPortalDepth: 0 })[0];
      if (!surface) throw new Error(`No landing surface: ${fixture.id}`);
      sim.restore({ ...initial, state: { ...initial.state, players: initial.state.players.map((player) => ({ ...player, x, y: surface.point.y + 3, z, vx: 0, vy: 0, vz: 0, grounded: false })) } });
      for (let tick = 0; tick < 60; tick += 1) sim.step([NEUTRAL_INPUT]);
      const landing = sim.save();
      try {
        const start = landing.state.players[0]!;
        const travel = [];
        for (const [moveX, moveZ] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          sim.restore(landing);
          for (let tick = 0; tick < 12; tick += 1) sim.step([{ ...NEUTRAL_INPUT, moveX, moveZ }]);
          const end = sim.state.players[0]!;
          travel.push({ direction: [moveX, moveZ], distance: Math.hypot(end.x - start.x, end.z - start.z) });
        }
        results.push({ ...fixture, surface: surface.bodyKey, landing: [start.x, start.y, start.z], grounded: start.grounded, canWalkAway: travel.some((move) => move.distance > 0.5), travel });
      } finally { sim.release(landing); }
    }
  } finally { sim.release(initial); }
} finally { sim.dispose(); }
const failures = results.filter((result) => !result.canWalkAway).length;
console.log(JSON.stringify({ artifact: 'Wreck Yard with installed WASM', failures, results }, null, 2));
if (process.argv.includes('--assert') && failures > 0) process.exitCode = 1;
