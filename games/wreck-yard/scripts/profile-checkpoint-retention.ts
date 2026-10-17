// Bundle like scripts/profile-sim.ts. This drives the real offline runner.
import '../src/deterministicMath';
import assert from 'node:assert/strict';
import { createSyncplayRunner } from '@series-inc/rundot-syncplay/browser';
import type { KinetixAdvanceRequest } from '@series-inc/rundot-syncplay/core/runtime';
import { TICK_RATE } from '../src/sim/constants';
import { decodeYardInput, encodeYardInput, NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from '../src/sim/input';
import { createYardRuntime, yardRoomOptions } from '../src/sim/session';
import { perfRecorder, type PerfReport } from '../src/perf/recorder';
import type { YardState } from '../src/sim/state';

const busy = process.argv.includes('--busy');
const room = yardRoomOptions(1);
const logicalCheckpoints = new Set<unknown>();
let lastFrame = 0;
let completed = false;
let runnerError: Error | undefined;
const liveCount = (report: PerfReport) => {
  const records = report.records;
  const counter = records.findLast((record) => record.kind === 'counter' && record.label === 'checkpoint.live');
  return counter?.kind === 'counter' ? counter.value : 0;
};
perfRecorder.start({ capacity: 65536, maxDurationMs: 60000 });
const runner = createSyncplayRunner<YardState, YardInput, unknown, YardState, YardState>({
  inputOwnership: room.inputOwnership,
  runtimeFactory: (identity, sessionConfigBytes) => {
    const lease = createYardRuntime(identity, sessionConfigBytes);
    const runtime = lease.runtime;
    return { ...lease, runtime: {
      ...runtime,
      get currentFrame() { return runtime.currentFrame; },
      capture: () => {
        const checkpoint = runtime.capture();
        logicalCheckpoints.add(checkpoint);
        return checkpoint;
      },
      advance: (requests: readonly KinetixAdvanceRequest<YardInput>[]) => {
        const results = runtime.advance(requests);
        for (const result of results) logicalCheckpoints.add(result.checkpoint);
        return results;
      },
      release: (checkpoint: unknown) => {
        runtime.release(checkpoint);
        logicalCheckpoints.delete(checkpoint);
      },
    } };
  },
  defaultInput: NEUTRAL_INPUT,
  encodeInput: encodeYardInput,
  decodeInput: decodeYardInput,
  presentation: { project: (state) => state },
  maxOfflineStepsPerUpdate: 2,
  localInputForTick: (_slot, frame) => busy && frame >= 30
    ? { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
      ...quantizeRay([-13, 0.8, -10], [0, 0, -1]) }
    : NEUTRAL_INPUT,
});
runner.subscribe((snapshot) => {
  lastFrame = snapshot.renderState?.frame ?? lastFrame;
  if (snapshot.status === 'error') runnerError = snapshot.error;
});
try {
  await runner.start({
    mode: 'offline', identity: room.runtimeIdentity,
    sessionConfigBytes: room.sessionConfigBytes, playerCount: 1,
    checksumMode: 'interval', checksumIntervalFrames: TICK_RATE,
  });
  for (let tick = 0; tick < 600; tick++) {
    runner.update(1000 / TICK_RATE + 0.001);
    if (runnerError) throw runnerError;
  }
  assert.ok(lastFrame >= 600, `Runner stopped at frame ${lastFrame}.`);
  completed = true;
} finally {
  const report = perfRecorder.export();
  const retained = liveCount(report);
  const logicalRetained = logicalCheckpoints.size;
  perfRecorder.start({ capacity: 10000, maxDurationMs: 10000 });
  await runner.dispose();
  const afterDispose = liveCount(perfRecorder.export());
  const peak = report.counterSummary['checkpoint.peak']?.max ?? 0;
  console.log(JSON.stringify({ busy, completed, lastFrame, peak, retained, logicalRetained, afterDispose, logicalAfterDispose: logicalCheckpoints.size }));
  assert.equal(afterDispose, 0, 'Runner did not release every checkpoint.');
  assert.equal(logicalCheckpoints.size, 0, 'Runner did not release every logical checkpoint.');
  if (completed) {
    assert.equal(logicalRetained, 256, 'Logical checkpoint history did not settle at 256.');
    assert.equal(retained, 32, 'Native checkpoint count did not settle at 32.');
    assert.ok(peak <= 32, `Native checkpoint peak was ${peak}.`);
  }
}
