import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createInitialState } from "../src/sim/presets";
import { stepYard } from "../src/sim/step";
import {
  NEUTRAL_INPUT,
  quantizeRay,
  TOOL,
  type YardInput,
} from "../src/sim/input";
import { replacePhysicsPose } from "../src/sim/physics";
import {
  FLOOR_Y,
  PLAYER_EYE_OFFSET,
  TANK,
  TICK_RATE,
} from "../src/sim/constants";
import type { YardState } from "../src/sim/state";
import type { Vec3 } from "../src/sim/math";
import { projectYard, type YardRender } from "../src/render/presentation";
import { VoxelBodies } from "../src/render/VoxelBodies";
import { YardShell } from "../src/render/YardShell";
import {
  OcclusionUpdater,
  useWorldOcclusion,
} from "../src/render/OcclusionUpdater";
import { PlayerAvatars } from "../src/render/PlayerAvatars";

type Id = "torch" | "gravity" | "jetpack" | "water" | "buggy" | "impact";
const ids: Id[] = ["torch", "gravity", "jetpack", "water", "buggy", "impact"];
const titles: Record<Id, string> = {
  torch: "Torch cut and separated pieces",
  gravity: "Gravity gun grab, lift, and punt",
  jetpack: "Jetpack climb and landing",
  water: "Water entry and buoyant recovery",
  buggy: "Buggy mount, ramp jump, stop, and exit",
  impact: "Impact damage",
};
const setups: Record<Id, string> = {
  torch: "Staged ray at the gantry. The orange line shows the input ray.",
  gravity: "Staged ray at the ballast box. The blue line shows the input ray.",
  jetpack: "Player starts on the open work pad. Only jetpack input changes.",
  water:
    "Float crate starts above the water. Gravity and fluid forces control its motion.",
  buggy:
    "Player starts beside the buggy. Mount, throttle, stop, and exit use game inputs.",
  impact:
    "Ballast box starts at 3.5 m with downward velocity. No later pose edits.",
};
let state: YardState;
let active: Id = "torch";
let tick = 0;
let total = 180;
let initialTarget: Vec3 = [0, 0, 0];
let input = NEUTRAL_INPUT;
let history: ReturnType<typeof measure>[] = [];
function body(id: string) {
  const value = state.world.bodies.find((b) => b.id === id);
  if (!value) throw new Error(`Missing body ${id}`);
  return value;
}
function measure() {
  const p = state.players[0]!;
  const b = state.world.bodies.find((b) => b.id === "vehicle-chassis");
  const ballast = state.world.bodies.find((b) => b.id === "ballast-box");
  const floating = state.world.bodies.find((b) => b.id === "float-crate");
  return {
    tick,
    frame: state.frame,
    stats: state.stats,
    ballastPieces: state.bodies.filter((b) => b.label === "Ballast Box").length,
    ballastVoxels: state.bodies.filter((b) => b.label === "Ballast Box").reduce(
      (n, b) => n + b.voxels.reduce((a, v) => a + (v ? 1 : 0), 0),
      0,
    ),
    pieces: state.bodies.filter((b) => b.label === "Steel Gantry").length,
    player: {
      x: p.x,
      y: p.y,
      z: p.z,
      fuel: p.fuel,
      grounded: p.grounded,
      riding: !!p.ridingVehicle,
      grab: p.grab?.bodyId ?? null,
    },
    buggy: b
      ? {
        x: b.x,
        y: b.y,
        z: b.z,
        speed: Math.hypot(b.vx, b.vz) * TICK_RATE,
        groundedWheels:
          (state.buggyWheels ?? []).filter((w) => w.grounded).length,
      }
      : null,
    ballast: ballast
      ? {
        x: ballast.x,
        y: ballast.y,
        z: ballast.z,
        speed: Math.hypot(ballast.vx, ballast.vy, ballast.vz) * TICK_RATE,
      }
      : null,
    floating: floating ? { y: floating.y, vy: floating.vy * TICK_RATE } : null,
  };
}
function ray(target: Vec3) {
  const p = state.players[0]!;
  const origin: Vec3 = [p.x, p.y + PLAYER_EYE_OFFSET, p.z];
  return quantizeRay(origin, [
    target[0] - origin[0],
    target[1] - origin[1],
    target[2] - origin[2],
  ]);
}
function setup(id: Id) {
  active = id;
  state = createInitialState(1);
  tick = 0;
  input = NEUTRAL_INPUT;
  total = id === "buggy" ? 210 : id === "water" ? 240 : 180;
  if (id === "torch") {
    const b = body("steel-gantry");
    initialTarget = [b.x + 0.2, b.y + 0.35, b.z];
    state = {
      ...state,
      players: [{ ...state.players[0]!, x: b.x + 0.2, y: 0.2, z: b.z + 1.6 }],
    };
  }
  if (id === "gravity") {
    for (let i = 0; i < 20; i++) state = stepYard(state, [NEUTRAL_INPUT]);
    const b = body("ballast-box");
    initialTarget = [b.x, b.y, b.z];
    state = {
      ...state,
      players: [{ ...state.players[0]!, x: b.x - 2.5, y: 0.2, z: b.z }],
    };
  }
  if (id === "jetpack") {
    state = {
      ...state,
      players: [{ ...state.players[0]!, x: -3, y: 0.2, z: 5, grounded: true }],
    };
  }
  if (id === "water") {
    state = {
      ...state,
      world: replacePhysicsPose(state.world, "float-crate", {
        y: TANK.surfaceY + 2.2,
        vy: 0,
      }),
    };
  }
  if (id === "buggy") {
    for (let i = 0; i < 30; i++) state = stepYard(state, [NEUTRAL_INPUT]);
    const b = body("vehicle-chassis");
    state = {
      ...state,
      players: [{ ...state.players[0]!, x: b.x - 1.2, y: b.y + 0.5, z: b.z }],
    };
  }
  if (id === "impact") {
    state = {
      ...state,
      world: replacePhysicsPose(state.world, "ballast-box", {
        x: -6,
        z: 3,
        y: 3.5,
        vy: -9 / TICK_RATE,
      }),
    };
  }
  history = [measure()];
}
function nextInput(): YardInput {
  if (active === "torch" && tick >= 20 && tick < 55) {
    return {
      ...NEUTRAL_INPUT,
      tool: TOOL.torch,
      pressed: true,
      ...ray(initialTarget),
    };
  }
  if (active === "gravity" && tick >= 20 && tick < 90) {
    const lift = Math.min(2, Math.max(0, (tick - 30) / 25));
    return {
      ...NEUTRAL_INPUT,
      tool: TOOL.hand,
      pressed: true,
      ...ray([initialTarget[0], initialTarget[1] + lift, initialTarget[2]]),
    };
  }
  if (active === "jetpack" && tick >= 20 && tick < 55) {
    return { ...NEUTRAL_INPUT, jetpack: true };
  }
  if (active === "buggy") {
    if (tick === 20) return { ...NEUTRAL_INPUT, secondary: true };
    if (tick > 20 && tick < 75) return { ...NEUTRAL_INPUT, moveZ: 1 };
    if (tick === 180) return { ...NEUTRAL_INPUT, secondary: true };
  }
  if (active === "gravity" && tick === 90) {
    return {
      ...NEUTRAL_INPUT,
      tool: TOOL.hand,
      pressed: true,
      secondary: true,
      ...ray([initialTarget[0], initialTarget[1] + 0.6, initialTarget[2]]),
    };
  }
  if (active === "gravity" && tick > 90) {
    return { ...NEUTRAL_INPUT, tool: TOOL.hand };
  }
  return NEUTRAL_INPUT;
}
function results() {
  const first = history[0]!;
  const last = history.at(-1)!;
  const checks: Record<string, boolean> = {};
  if (active === "torch") {
    checks.cut = last.stats.torchCuts > first.stats.torchCuts;
    checks.separated = last.pieces > first.pieces;
  }
  if (active === "gravity") {
    checks.grab = history.some((h) => h.player.grab === "ballast-box");
    checks.lift = history.some((h) =>
      h.ballast && h.ballast.y > initialTarget[1] + 0.3
    );
    checks.punt = history.some((h) =>
      h.tick >= 91 && h.tick <= 95 && h.ballast && h.ballast.speed > 8
    );
    checks.release = last.player.grab === null &&
      last.stats.throws > first.stats.throws;
  }
  if (active === "jetpack") {
    checks.climb = Math.max(...history.map((h) =>
      h.player.y
    )) > first.player.y + 1;
    checks.fuel = history.some((h) => h.player.fuel < first.player.fuel);
    checks.land = last.player.grounded;
  }
  if (active === "water") {
    const ys = history.flatMap((h) => h.floating ? [h.floating.y] : []);
    checks.enters = Math.min(...ys) < TANK.surfaceY;
    checks.recovers = last.floating !== null &&
      last.floating.y > Math.min(...ys) + 0.05;
    checks.aboveBottom = !!last.floating &&
      last.floating.y > TANK.bottomY + 0.2;
  }
  if (active === "buggy") {
    checks.mount = history.some((h) => h.player.riding);
    checks.drive = !!first.buggy &&
      history.some((h) =>
        h.buggy &&
        Math.hypot(h.buggy.x - first.buggy!.x, h.buggy.z - first.buggy!.z) > 3
      );
    const airborne = history.findIndex((h) =>
      h.tick > 20 && h.buggy && h.buggy.z > -3 && h.buggy.z < 8 &&
      h.buggy.groundedWheels === 0 && h.buggy.y > first.buggy!.y + 0.25
    );
    checks.rampAirborne = airborne >= 0;
    checks.rampLanded = airborne >= 0 &&
      history.slice(airborne + 1).some((h) =>
        h.buggy && h.buggy.groundedWheels >= 2
      );
    checks.stop = history.some((h) =>
      h.tick >= 140 && h.tick < 180 && h.buggy && h.buggy.speed < 0.5
    );
    checks.exit = !last.player.riding;
  }
  if (active === "impact") {
    checks.voxelDamage = last.stats.fractures > first.stats.fractures &&
      history.some((h) =>
        h.ballastVoxels < first.ballastVoxels ||
        h.ballastPieces > first.ballastPieces
      );
  }
  return {
    id: active,
    title: titles[active],
    setup: setups[active],
    mode:
      "Offline simulation replay at 30 ticks/s. This does not measure live frame rate or test browser input.",
    checks,
    passed: Object.values(checks).every(Boolean),
    history,
  };
}
let refresh: () => void;
let draw: () => void;
function Observer() {
  const { camera, advance } = useThree();
  draw = () => {
    let target: Vec3;
    let offset: Vec3;
    if (active === "torch") {
      target = [2.18, 1.5, TANK.center[2]];
      offset = [3.2, 2.2, 4.5];
    } else if (active === "gravity" || active === "impact") {
      target = active === "impact"
        ? [-6, 0.8, 3]
        : tick >= 90
        ? [body("ballast-box").x, 0.8, body("ballast-box").z]
        : [0.62, 0.8, 1.3];
      offset = active === "impact" ? [2.5, 1.4, 3.5] : [5, 4, 7];
    } else if (active === "water") {
      target = [TANK.center[0], TANK.surfaceY, TANK.center[2]];
      offset = [6, 5, 8];
    } else if (active === "buggy") {
      const b = body("vehicle-chassis");
      target = [b.x, b.y, b.z];
      offset = [5, 3, 6];
    } else {
      target = [-3, Math.max(2, state.players[0]!.y + 0.7), 5];
      offset = [7, 4, 10];
    }
    camera.position.set(
      target[0] + offset[0],
      target[1] + offset[1],
      target[2] + offset[2],
    );
    camera.lookAt(...target);
    advance(tick / TICK_RATE);
  };
  return null;
}
function Scene() {
  const renderRef = useRef<YardRender | null>(null);
  const worldOcclusion = useWorldOcclusion();
  const [, force] = useState(0);
  refresh = () => force((n) => n + 1);
  renderRef.current = projectYard(state, { localSlot: 0, status: "offline" });
  const render = renderRef.current;
  const points = input.pressed && input.dy !== 0
    ? new Float32Array([
      input.ox / 1000,
      input.oy / 1000,
      input.oz / 1000,
      input.ox / 1000 + input.dx / 10000 * 4,
      input.oy / 1000 + input.dy / 10000 * 4,
      input.oz / 1000 + input.dz / 10000 * 4,
    ])
    : null;
  return (
    <>
      <Observer />
      <YardShell renderRef={renderRef} />
      <VoxelBodies
        bodies={render.bodies}
        renderRef={renderRef}
        outlines={new Map()}
        onHover={() => {}}
        worldOcclusion={worldOcclusion}
      />
      {active === "jetpack" || active === "buggy"
        ? <PlayerAvatars renderRef={renderRef} tool="orbit" />
        : null}
      <OcclusionUpdater renderRef={renderRef} worldOcclusion={worldOcclusion} />
      {points
        ? (
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[points, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={active === "torch" ? "#ff9e43" : "#5fdafa"}
            />
          </line>
        )
        : null}
    </>
  );
}
setup("torch");
function App() {
  return (
    <>
      <aside>
        <h1 id="title">Mechanics audit</h1>
        <p id="phase"></p>
        <small id="setup"></small>
        <p>
          <small>
            OFFLINE REPLAY · 30 simulation ticks/s · staged setup · no live FPS
            claim
          </small>
        </p>
      </aside>
      <Canvas
        frameloop="never"
        dpr={1}
        shadows
        camera={{ fov: 46, near: 0.1, far: 180 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Scene />
      </Canvas>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
function update() {
  flushSync(() => refresh());
  document.getElementById("title")!.textContent = titles[active];
  document.getElementById("setup")!.textContent = setups[active];
  document.getElementById("phase")!.textContent = `Tick ${tick} / ${total} · ${
    tick === 0 ? "Before action" : tick < total ? "Simulation" : "Result"
  }`;
  const m = measure();
  const metrics = active === "torch"
    ? `Cuts ${m.stats.torchCuts} · Gantry pieces ${m.pieces}`
    : active === "gravity"
    ? `Holding ${m.player.grab ?? "none"} · Releases ${m.stats.throws}`
    : active === "jetpack"
    ? `Player height ${m.player.y.toFixed(2)} m · Fuel ${
      m.player.fuel.toFixed(0)
    } · Grounded ${m.player.grounded}`
    : active === "water"
    ? `Crate height ${m.floating?.y.toFixed(2)} m · Water surface ${
      TANK.surfaceY.toFixed(2)
    } m`
    : active === "buggy"
    ? `Speed ${
      m.buggy?.speed.toFixed(1)
    } m/s · Wheels on ground ${m.buggy?.groundedWheels} · Driver mounted ${m.player.riding}`
    : `Impact events ${m.stats.fractures} · Ballast voxels ${m.ballastVoxels} · Pieces ${m.ballastPieces}`;
  document.getElementById("phase")!.textContent += ` · ${metrics}`;
  draw();
}
Object.assign(window, {
  mechanicsAudit: {
    ids,
    ready: () => !!refresh && !!draw,
    setup: (id: Id) => {
      if (!ids.includes(id)) throw new Error("Unknown scenario");
      setup(id);
      update();
      return {
        total,
        title: titles[id],
        actionFrame: ({
          torch: 40,
          gravity: 75,
          jetpack: 48,
          water: 24,
          buggy: 75,
          impact: 8,
        })[id],
      };
    },
    step: (render = true) => {
      input = nextInput();
      state = stepYard(state, [input]);
      tick++;
      history.push(measure());
      if (render) update();
      return measure();
    },
    results,
  },
});
