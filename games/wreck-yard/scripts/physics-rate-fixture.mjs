// Shared by the Node runner and the browser worker. All physics calls use the public API.
export const RATE_ARMS = Object.freeze(['30x1', '30x2', '30x3', '30x4', '30x5', '30x6', '60x1', '60x2', '60x3']);
export const RATE_SCENES = Object.freeze(['rest', 'wake', 'shove', 'shallow-edit', 'drop']);
const EDGE = .96, FLOOR_Y = -.86, GRAVITY = 13.5, INERTIA = EDGE * EDGE / 6;
const WARM_SECONDS = 4, SAMPLE_RATE = 30, RECOVERY_SECONDS = 12;
const STACK_POSITIONS = Array.from({ length: 400 }, (_, index) => ({
  x: -13.1 + (index % 8 - 3.5) * EDGE,
  y: FLOOR_Y + EDGE / 2 + Math.floor(index / 40) * EDGE,
  z: -20.7 + (Math.floor(index / 8) % 5 - 2) * EDGE,
}));
function check(condition, message) { if (!condition) throw new Error(message); }
export function parseRateArm(arm) {
  check(RATE_ARMS.includes(arm), `Unknown arm: ${arm}`);
  const [tickRate, substeps] = arm.split('x').map(Number);
  return { tickRate, substeps };
}
export function rateSummary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return { count: values.length, sum, mean: sum / values.length,
    p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)],
    p99: sorted[Math.floor((sorted.length - 1) * .99)], max: sorted.at(-1) };
}
export const RATE_CONTRACT = Object.freeze({
  warmSeconds: WARM_SECONDS, sampleRate: SAMPLE_RATE, recoveryDeadlineSeconds: RECOVERY_SECONDS,
  maxNeutralShiftMeters: .05, maxFloorPenetrationMeters: .05,
  shoveAtSeconds: 0, shoveMetersPerSecond: 6, shoveBodies: 40,
  responseAtSeconds: 6, bottomResponseMeters: .06, topResponseMeters: .01, minimumRespondingPerLayer: 21,
  shallowEditAtSeconds: 4, shallowHalfX: .47, dropHeightMeters: 2,
  notes: [
    'Reject a quality failure before speed ranking. Gates are fixed before the sweep.',
    'The default is six configured velocity iterations. Explicit candidates can use 1 to 32. Native contact paths can use higher minimum counts.',
    'Damping has equal nominal retention per second. Native rounding can change the motion.',
    'Each physics tick calls latest(). Timings include facade work and output conversion.',
    'Time groups cover 1/30 simulated second: one 30 Hz tick or two 60 Hz ticks.',
    'Finite checks and replay hashes cover every outer tick. Summary samples use 30 Hz.',
    'Replay hashes are SHA-256 of the ordered per-tick motion hashes. The terminal world digest must also match.',
    'Checks, hashes, checkpoint capture, restore, replay, and resource reads are outside the timed API calls.',
    'One checkpoint stays retained during forward timing. Once trajectories differ, workloads also differ.',
    'This fixture excludes the full game, rendering, networking, input latency, and device thermal acceptance.',
  ],
});

export async function runRateFixture({ sdk, arm, sha256, readMemory, seconds = 16, serializedReplay = false,
  velocityIterations = 6, wallLimitMs = 600_000, onProgress = async () => {} }) {
  const { tickRate, substeps } = parseRateArm(arm);
  check(Number.isInteger(seconds) && seconds >= 16 && seconds <= 120, 'Duration must be 16 to 120 whole seconds.');
  check(Number.isInteger(velocityIterations) && velocityIterations >= 1 && velocityIterations <= 32, 'Iterations must be 1 to 32.');
  const definition = { tickRate, substeps, velocityIterations, initialGravity: { x: 0, y: -GRAVITY, z: 0 },
    restitutionThreshold: .5, contactSpeed: 0, maximumLinearSpeed: 0, contactHertz: 0, contactDampingRatio: 1,
    capacity: { bodies: 512, joints: 1, fluids: 0, fluidInteractions: 0, checkpoints: 1 }, portalProxyCapacity: 1 };
  const report = { arm, configurationId: `${arm}-v${velocityIterations}`, definition, seconds, contract: RATE_CONTRACT, scenes: [] };
  for (const scene of RATE_SCENES) {
    const isDrop = scene === 'drop';
    const positions = isDrop ? [{ x: 0, y: FLOOR_Y + EDGE / 2 + RATE_CONTRACT.dropHeightMeters, z: 0 }] : STACK_POSITIONS;
    const damping = isDrop ? { linear: 1, angular: 1 } : { linear: .98 ** (30 / tickRate), angular: .945 ** (30 / tickRate) };
    const world = sdk.createPhysicsWorld3D(definition);
    const row = { scene, damping, samples: [] };
    report.scenes.push(row);
    let checkpoint, checkpointBytes, boxes;
    const buffers = { poses: new Float64Array(512 * 7), velocities: new Float64Array(512 * 6),
      ids: new BigUint64Array(512), status: new Uint8Array(512), teleports: new Uint32Array(512) };
    const motionBytes = new Uint8Array((positions.length + 1) * 117);
    const bodyInput = index => ({ kind: 'dynamic', key: `box-${index}`,
      shape: { type: 'box', halfX: EDGE / 2, halfY: EDGE / 2, halfZ: EDGE / 2 }, position: positions[index],
      orientation: { x: 0, y: 0, z: 0, w: 1 }, mass: 1, inertia: { xx: INERTIA, yy: INERTIA, zz: INERTIA },
      gravityScale: 1, linearDamping: damping.linear, angularDamping: damping.angular,
      friction: .85, restitution: .12, rollingResistance: 0, sleeping: true, sleepEnabled: true,
      sleepThreshold: .05, layer: 1, mask: 0xffffffff });
    try {
      boxes = world.edit(ops => {
        ops.createBody({ kind: 'static', key: 'floor', shape: { type: 'box', halfX: 32, halfY: .5, halfZ: 32 },
          position: { x: 0, y: FLOOR_Y - .5, z: 0 }, friction: .82, restitution: .08, layer: 1, mask: 0xffffffff });
        return positions.map((_position, index) => ops.createBody(bodyInput(index)));
      }).created;
      const readMotion = shallow => {
        const { count } = world.writeBodyMotionInto(buffers.poses, buffers.velocities, buffers.ids, buffers.status, buffers.teleports);
        check(count === positions.length + 1, 'Body count changed.');
        let active = 0, maxSpeed = 0, maxShift = 0, floorPenetration = 0, maxY = -Infinity;
        const slots = new Map();
        for (let slot = 0; slot < count; slot++) {
          if ((buffers.status[slot] & 3) !== 1) continue;
          if (!(buffers.status[slot] & 0x10)) active++;
          slots.set(buffers.ids[slot], slot);
          maxSpeed = Math.max(maxSpeed, Math.hypot(...buffers.velocities.subarray(slot * 6, slot * 6 + 3)));
        }
        let byteOffset = 0;
        for (const [array, length] of [[buffers.poses, count * 7], [buffers.velocities, count * 6], [buffers.ids, count], [buffers.status, count], [buffers.teleports, count]]) {
          if (array instanceof Float64Array) for (const value of array.subarray(0, length)) check(Number.isFinite(value), 'Non-finite motion.');
          const bytes = new Uint8Array(array.buffer, array.byteOffset, length * array.BYTES_PER_ELEMENT);
          motionBytes.set(bytes, byteOffset); byteOffset += bytes.length;
        }
        check(byteOffset === motionBytes.length, 'Motion byte count changed.');
        const layer = [];
        boxes.forEach((box, index) => {
          const slot = slots.get(box.id);
          check(slot !== undefined, 'Dynamic body is missing.');
          const offset = slot * 7, p = positions[index];
          const [x, y, z, qx, qy, qz, qw] = buffers.poses.subarray(offset, offset + 7);
          maxShift = Math.max(maxShift, Math.hypot(x - p.x, y - p.y, z - p.z));
          maxY = Math.max(maxY, y);
          const halfX = shallow && index === 399 ? RATE_CONTRACT.shallowHalfX : EDGE / 2;
          const halfY = Math.abs(2 * (qx * qy + qw * qz)) * halfX
            + Math.abs(1 - 2 * (qx * qx + qz * qz)) * EDGE / 2
            + Math.abs(2 * (qy * qz - qw * qx)) * EDGE / 2;
          floorPenetration = Math.max(floorPenetration, FLOOR_Y - (y - halfY));
          if (index < 40 || index >= 360) layer.push([x, y, z]);
        });
        return { active, maxSpeed, maxShift, floorPenetration, maxY, layer };
      };
      for (let frame = 0; frame < WARM_SECONDS * tickRate; frame++) { world.step(); world.latest(); }
      checkpoint = world.captureCheckpoint();
      if (serializedReplay) checkpointBytes = world.serializeCheckpoint(checkpoint);
      const advance = async record => {
        let shallow = false, maximumShift = 0, maximumSpeed = 0, maximumPenetration = 0, maximumY = -Infinity;
        let finalActive = 0, lastActiveSeconds = 0, recoveryTailMaximumActive = 0, firstContactSeconds = null, atSix;
        const hashes = [], stepTimes = [], latestTimes = [], groups = [], buckets = [];
        const start = performance.now();
        if (scene !== 'rest') for (const box of boxes) world.wakeBody(box);
        if (scene === 'shove') for (const box of boxes.slice(0, 40)) world.setBodyLinearVelocity(box, { x: 0, y: 0, z: 6 });
        for (let group = 1; group <= seconds * SAMPLE_RATE; group++) {
          let groupCost = 0;
          if (scene === 'shallow-edit' && group === RATE_CONTRACT.shallowEditAtSeconds * SAMPLE_RATE + 1) {
            const old = world.resolveKey('box-399');
            check(old, 'Edit target is missing.');
            world.edit(ops => ops.replaceBody(boxes[399], { ...bodyInput(399),
              shape: { type: 'box', halfX: RATE_CONTRACT.shallowHalfX, halfY: EDGE / 2, halfZ: EDGE / 2 },
              position: old.position, orientation: old.orientation, linearVelocity: old.linearVelocity,
              angularVelocity: old.angularVelocity, sleeping: false }));
            boxes = boxes.map(box => world.resolveBody(box.id));
            shallow = true;
          }
          let state;
          for (let step = 0; step < tickRate / SAMPLE_RATE; step++) {
            const before = performance.now();
            world.step();
            const after = performance.now();
            const latest = world.latest();
            const end = performance.now();
            const offset = (group - 1) * (tickRate / SAMPLE_RATE) + step + 1;
            const elapsed = offset / tickRate;
            check(Number(latest.frame) === WARM_SECONDS * tickRate + offset, 'Frame count changed.');
            if (record) { stepTimes.push(after - before); latestTimes.push(end - after); groupCost += end - before; }
            if (firstContactSeconds === null && latest.contacts.some(c => c.type !== 'exit' && !c.trigger && !c.sensor)) firstContactSeconds = elapsed;
            state = readMotion(shallow);
            hashes.push(await sha256(motionBytes));
            maximumShift = Math.max(maximumShift, state.maxShift);
            maximumSpeed = Math.max(maximumSpeed, state.maxSpeed);
            maximumPenetration = Math.max(maximumPenetration, state.floorPenetration);
            maximumY = Math.max(maximumY, state.maxY);
            finalActive = state.active;
            if (state.active) lastActiveSeconds = elapsed;
            if (elapsed >= RECOVERY_SECONDS) recoveryTailMaximumActive = Math.max(recoveryTailMaximumActive, state.active);
          }
          if (group === RATE_CONTRACT.responseAtSeconds * SAMPLE_RATE) atSix = state.layer;
          if (record) groups.push(groupCost);
          if (record && (group <= 2 || group % SAMPLE_RATE === 0)) {
            const { layer: _layer, ...summary } = state;
            row.samples.push({ seconds: group / SAMPLE_RATE, ...summary });
          }
          if (group % SAMPLE_RATE === 0) {
            if (record) buckets.push({ seconds: group / SAMPLE_RATE,
              apiMs: groups.slice(-SAMPLE_RATE).reduce((sum, value) => sum + value, 0), active: state.active });
            await onProgress({ arm, scene, replay: !record, seconds: group / SAMPLE_RATE });
          }
          check(performance.now() - start < wallLimitMs, 'Case exceeded its wall time limit.');
        }
        const result = { motionTraceSha256: await sha256(new TextEncoder().encode(hashes.join(''))), digest: world.digest().toString(),
          maximumShift, maximumSpeed, maximumPenetration, maximumY, finalActive, lastActiveSeconds,
          recoveryTailMaximumActive, firstContactSeconds, layerAtSixSeconds: atSix };
        if (record) {
          row.publicStepMs = rateSummary(stepTimes); row.latestMs = rateSummary(latestTimes);
          row.costPer30HzIntervalMs = rateSummary(groups); row.timeBuckets = buckets;
          row.apiMsPerSimulatedSecond = (row.publicStepMs.sum + row.latestMs.sum) / seconds;
          row.stepMsPerSimulatedSecond = row.publicStepMs.sum / seconds;
          row.latestMsPerSimulatedSecond = row.latestMs.sum / seconds;
          row.tickBudgetExceededFraction = stepTimes.filter((value, index) => value + latestTimes[index] > 1000 / tickRate).length / stepTimes.length;
        }
        return result;
      };
      row.forward = await advance(true);
      world.restoreCheckpoint(checkpoint); boxes = boxes.map(box => world.resolveBody(box.id));
      row.replay = await advance(false);
      check(JSON.stringify(row.forward) === JSON.stringify(row.replay), 'Checkpoint replay differs.');
      if (serializedReplay) {
        world.restore(checkpointBytes); boxes = boxes.map(box => world.resolveBody(box.id));
        row.serializedReplay = await advance(false);
        check(JSON.stringify(row.forward) === JSON.stringify(row.serializedReplay), 'Serialized checkpoint replay differs.');
      }
      const forward = row.forward;
      row.gates = { finite: true, bodyCount: true, exactReplay: true,
        ...(serializedReplay ? { serializedReplay: true } : {}),
        floorPenetrationBelow5cm: forward.maximumPenetration <= RATE_CONTRACT.maxFloorPenetrationMeters,
        finalAsleep: forward.finalActive === 0, recoveryTailAsleep: forward.recoveryTailMaximumActive === 0,
        ...(['rest', 'wake', 'shallow-edit'].includes(scene) ? { neutralShiftBelow5cm: forward.maximumShift < RATE_CONTRACT.maxNeutralShiftMeters } : {}),
        ...(scene === 'rest' ? { neverWakes: forward.lastActiveSeconds === 0 } : {}),
        ...(isDrop ? { impactTime: forward.firstContactSeconds !== null
          && Math.abs(forward.firstContactSeconds - Math.sqrt(2 * RATE_CONTRACT.dropHeightMeters / GRAVITY)) <= 2 / tickRate,
          noExcessRebound: forward.maximumY <= positions[0].y + .05 } : {}) };
    } catch (error) {
      row.error = { name: error.name, message: error.message, stack: error.stack };
    } finally {
      try { if (checkpoint) world.releaseCheckpoint(checkpoint); }
      finally { world.dispose(); }
      const counters = readMemory();
      row.nativeAfterDispose = JSON.parse(JSON.stringify(counters, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
      row.disposalZero = ['liveWorlds', 'liveSlots', 'retainedBytes'].every(key => String(counters[key]) === '0') && !counters.imbalance;
      row.pass = !row.error && row.disposalZero && Object.values(row.gates ?? {}).every(Boolean);
      await onProgress({ arm, scene, complete: true, preliminaryPass: row.pass, apiMsPerSimulatedSecond: row.apiMsPerSimulatedSecond });
    }
  }
  const wake = report.scenes.find(row => row.scene === 'wake'), shove = report.scenes.find(row => row.scene === 'shove');
  if (!wake.error && !shove.error) {
    const moved = (index, threshold) => {
      const after = shove.forward.layerAtSixSeconds[index], control = wake.forward.layerAtSixSeconds[index];
      const initial = STACK_POSITIONS[index < 40 ? index : 360 + index - 40];
      return Math.hypot(after[0] - initial.x, after[2] - initial.z) > threshold
        && Math.hypot(after[0] - control[0], after[2] - control[2]) > threshold;
    };
    shove.bottomResponders = Array.from({ length: 40 }, (_, index) => moved(index, RATE_CONTRACT.bottomResponseMeters)).filter(Boolean).length;
    shove.topResponders = Array.from({ length: 40 }, (_, index) => moved(index + 40, RATE_CONTRACT.topResponseMeters)).filter(Boolean).length;
    shove.gates.bottomResponse = shove.bottomResponders >= RATE_CONTRACT.minimumRespondingPerLayer;
    shove.gates.topResponse = shove.topResponders >= RATE_CONTRACT.minimumRespondingPerLayer;
    shove.pass = shove.pass && shove.gates.bottomResponse && shove.gates.topResponse;
  }
  report.pass = report.scenes.every(row => row.pass);
  return report;
}
