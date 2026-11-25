// node --test tests/layouts.test.mjs  (needs Python 3 with numpy on PATH as `python`, for the catalogue)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Layout, Runner, placeConsist } from '../viewer/trackpath.js';
import { LAYOUTS } from '../viewer/layouts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(execFileSync('python', [path.join(here, '..', 'kit', 'catalog.py'), '--family', 'track,civil'], { maxBuffer: 1 << 26 }).toString());

/** Distance from a point to the nearest sampled point of any route in the layout. */
function offTrack(lay, p) {
  let best = Infinity;
  for (const e of lay.edges()) {
    for (let u = 0; u <= e.route.length; u += 1) {
      const q = lay.edgeAt(e, u).p;
      best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    }
  }
  return best;
}

for (const [name, plan] of Object.entries(LAYOUTS)) {
  test(`${name}: closes, with open ends only at a turntable's unused side`, () => {
    const lay = new Layout(cat, plan.steps);
    for (const o of lay.openEnds()) {
      assert.equal(lay.placed[o.piece].spec.kind, 'turntable', `open end at step ${o.piece} (${lay.placed[o.piece].name}) ${o.conn}`);
    }
  });

  test(`${name}: the chosen train can run round for ever, and the track behind it is real`, () => {
    const lay = new Layout(cat, plan.steps);
    const run = new Runner(lay, lay.edge(plan.main.step), plan.main.u);
    const behind = run.history.reduce((t, h) => t + h.route.length, run.u);
    assert.ok(behind >= 1000, `only ${behind} voxels of track behind the start`);
    run.advance(20000);
    assert.equal(run.stopped, false);
  });

  for (const t of [plan.main, ...(plan.trains ?? [])].filter((t) => t.stops || t.shuttle)) {
    test(`${name}: ${t.consist ?? 'the chosen train'} passes its stops${t.shuttle ? ' and shuttles between buffer stops' : ''}`, () => {
      const lay = new Layout(cat, plan.steps);
      if (t.shuttle) {
        for (const dir of ['a', 'b']) {
          const run = new Runner(lay, lay.edge(t.step, dir), t.u);
          run.advance(50000);
          assert.equal(run.stopped, true, `running ${dir === 'a' ? 'forward' : 'back'} never reaches a dead end`);
          const end = lay.placed[run.edge.piece];
          assert.ok(end.spec.routes.some((r) => !r.to) || !lay.mate(run.edge.piece, run.edge.dir > 0 ? run.edge.route.to : run.edge.route.from),
            `stopped at ${end.name}, not a buffer stop`);
        }
      }
      const run = new Runner(lay, lay.edge(t.step, t.reverse ? 'b' : 'a'), t.u);
      const seen = new Set([run.edge.piece]);
      for (let k = 0; k < 400 && !run.stopped; k++) { run.advance(64); seen.add(run.edge.piece); }
      for (const st of t.stops ?? []) {
        assert.ok(seen.has(st.step), `stop at step ${st.step} is not on the train's way`);
        const len = lay.placed[st.step].spec.routes[0].length;
        assert.ok(st.at >= 0 && st.at <= len, `stop at ${st.at} is beyond step ${st.step}'s ${len}`);
      }
    });
  }

  for (const t of plan.trains ?? []) {
    test(`${name}: its ${t.consist ?? t.cars.map((c) => c.id).join('+')} sits on the track`, () => {
      const lay = new Layout(cat, plan.steps);
      const run = new Runner(lay, lay.edge(t.step, t.reverse ? 'b' : 'a'), t.u);
      const coach = { couplers: { f: -80, r: 80 }, guides: [-52, 52] };
      for (const p of placeConsist(run, [coach, coach, coach])) {
        assert.ok(offTrack(lay, p.front) < 1 && offTrack(lay, p.rear) < 1);
      }
    });
  }
}

test('a long train placed after a curve lies along the curve behind it, not on a straight extension', () => {
  const lay = new Layout(cat, LAYOUTS['Country junction'].steps);
  const run = new Runner(lay, lay.edge(2), 10); // just after the two curves
  const coach = { couplers: { f: -80, r: 80 }, guides: [-52, 52] };
  const poses = placeConsist(run, Array(6).fill(coach));
  for (const p of poses) assert.ok(offTrack(lay, p.rear) < 1, `rear guide ${p.rear.map((v) => v.toFixed(1))} is off the track`);
});

// With a built catalogue (out/glb/kit.json), check every parked yard rake fits its road without fouling the points.
const built = path.join(here, '..', 'out', 'glb', 'kit.json');
test('Grand trainset: every parked rake fits its yard road', { skip: !existsSync(built) && 'no build in out/glb' }, () => {
  const kit = JSON.parse(readFileSync(built, 'utf8'));
  const plan = LAYOUTS['Grand trainset'];
  const roads = plan.marks.roads;
  for (const t of plan.trains.filter((x) => x.speed === 0)) {
    const road = roads.find((r) => r.end === t.step);
    assert.ok(road, `parked train at step ${t.step} is not at the end of a yard road`);
    const len = t.cars.reduce((a, c) => a + kit.stock[c.id].L, 0);
    assert.ok(len <= road.length - (128 - t.u) - 8, `a ${len}-long rake does not fit a ${road.length}-long road`);
  }
});
