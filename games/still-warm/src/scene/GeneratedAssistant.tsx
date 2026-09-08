import {
  Suspense,
  Component,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  AnimationAction,
  Euler,
  Group,
  Mesh,
  SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_PATHS, DRACO_PATH } from "./assets";
import { ProceduralAssistant } from "./ProceduralAssistant";
import { PATIENT_LAYOUT } from "./patientLayout";
import {
  LAMP_HANDLE,
  getItemOffset,
  getItemSlot,
  type LiveHandSocket,
} from "./types";
import { planSafeRoute, selectContactStance } from "./staging";
import { actionPerformance, APPROACH_SECONDS } from "../game/performance";
import { getActionDuration } from "../game/store";
import type { GameState } from "../game/model";
import { callEnvelope, type CreatureCall } from "../audio/creatureVoice";
import { MorphOverlay } from "./morphOverlay";

interface Props {
  state: GameState;
  reducedMotion?: boolean;
  socket: LiveHandSocket;
  call?: CreatureCall | null;
}
const SCALE = 0.9;
const FLOOR = PATIENT_LAYOUT.floorY;
const HOME = [-0.72, FLOOR, 0.48] as const;
const WORK_YAW = 2.1;
const RETURN_METERS_PER_WALK_CLIP = 2.9;
const RETURN_TURN_SECONDS = 0.65;
const BEAM_GRIP = new Vector3(-0.25, 0.12, -0.14)
  .applyEuler(new Euler(0.07, 0.25, 0.08))
  .add(new Vector3(...PATIENT_LAYOUT.beam));
const STANCE_YAWS = [
  WORK_YAW,
  Math.PI / 2,
  2.5,
  Math.PI,
  -Math.PI / 2,
  0,
  1.2,
  -2.1,
] as const;

class AssistantErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function actionTarget(state: GameState, out: Vector3): boolean {
  const action = state.pending?.action;
  if (!action) return false;
  if (action.kind === "light_lantern") {
    out.set(-1, 0.4, 0.4);
    return true;
  }
  if (action.kind === "lift_debris") {
    out.copy(BEAM_GRIP);
    return true;
  }
  if (action.kind === "adjust_lamp") {
    out.set(...LAMP_HANDLE);
    return true;
  }
  if (action.kind === "combine" || action.kind === "break") {
    out.set(-0.2, 0.12, 0.28);
    return true;
  }
  if (action.kind === "pick_up" || action.kind === "place") {
    const location =
      action.kind === "place"
        ? action.location
        : state.items[action.item].location;
    const slot = getItemSlot(location);
    const offset = getItemOffset(action.item);
    out.set(
      slot[0] + offset[0],
      slot[1] + offset[1] + 0.04,
      slot[2] + offset[2],
    );
    return true;
  }
  if (action.kind === "use") {
    if (action.item === "candle" && action.target === "lamp") {
      out.set(-1, 0.4, 0.4);
      return true;
    }
    switch (action.target) {
      case "wound":
        out.set(...PATIENT_LAYOUT.wound);
        break;
      case "patient":
        out.set(...PATIENT_LAYOUT.care);
        break;
      case "pillow":
        out.set(0.15, -0.78, -0.42);
        break;
      case "creature":
        out.set(-0.55, 0.3, 0.16);
        break;
      case "fire":
        out.set(-1.25, -0.65, 0.45);
        break;
      case "door":
        out.set(1.35, 0.4, 2.35);
        break;
      case "lamp":
        out.set(...LAMP_HANDLE);
        break;
      default: {
        const slot = getItemSlot(state.items[action.target].location);
        const offset = getItemOffset(action.target);
        out.set(
          slot[0] + offset[0],
          slot[1] + offset[1] + 0.04,
          slot[2] + offset[2],
        );
      }
    }
    return true;
  }
  return false;
}

function RiggedAssistant({ state, socket, call = null }: Props) {
  const root = useRef<Group>(null!);
  const activeCall = useRef<(CreatureCall & { age: number }) | null>(null);
  const source = useGLTF(ASSET_PATHS.assistantGlb, DRACO_PATH);
  const scene = useMemo(() => {
    const instance = clone(source.scene);
    instance.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return instance;
  }, [source.scene]);
  const rig = useMemo(() => {
    const mesh = scene
      .getObjectsByProperty("isSkinnedMesh", true)
      .find(
        (object): object is SkinnedMesh =>
          object instanceof SkinnedMesh &&
          object.morphTargetDictionary?.RightGrip !== undefined,
      );
    if (!(mesh instanceof SkinnedMesh))
      throw new Error("The creature skin is missing.");
    const index = mesh.skeleton.bones.findIndex(
      (bone) => bone.name === "RightHand",
    );
    if (index < 0) throw new Error("The creature hand is missing.");
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    const palm = new Vector3();
    const point = new Vector3();
    let weight = 0;
    for (let i = 0; i < position.count; i++) {
      for (let j = 0; j < 4; j++) {
        const w = skinWeight.getComponent(i, j);
        if (skinIndex.getComponent(i, j) === index && w > 0.5) {
          palm.addScaledVector(point.fromBufferAttribute(position, i), w);
          weight += w;
        }
      }
    }
    palm
      .divideScalar(weight)
      .applyMatrix4(mesh.bindMatrix)
      .applyMatrix4(mesh.skeleton.boneInverses[index])
      .multiplyScalar(0.5);
    const mixer = new AnimationMixer(scene);
    const actions = Object.fromEntries(
      source.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
    );
    // Measure the authored hand path. Move the actor to the object, not the bones.
    const samples: Record<string, { time: number; palm: Vector3 }[]> = {};
    for (const name of ["pickup", "collect"]) {
      const action = actions[name];
      action.play();
      samples[name] = [];
      for (let frame = 30; frame <= 78; frame++) {
        mixer.setTime(frame / 30);
        scene.updateMatrixWorld(true);
        samples[name].push({
          time: frame / 30,
          palm: mesh.skeleton.bones[index].localToWorld(palm.clone()),
        });
      }
      action.stop();
    }
    return {
      mesh,
      hand: mesh.skeleton.bones[index],
      palm,
      mixer,
      actions,
      samples,
      morphs: new MorphOverlay(mesh),
    };
  }, [scene, source.animations]);
  const active = useRef<AnimationAction | null>(null);
  const plan = useRef<{
    id: number;
    end: Vector3;
    route: Vector3[];
    routeEnds: number[];
    routeDistance: number;
    yaw: number;
    duration: number;
    contact: number;
    clip: string;
    reverse: boolean;
    hold: boolean;
  } | null>(null);
  const returnPlan = useRef<{
    route: Vector3[];
    routeEnds: number[];
    routeDistance: number;
    travelSeconds: number;
    elapsed: number;
    turnYaw: number | null;
  } | null>(null);
  const eventCount = useRef(state.environment.events.length);
  const screamUntil = useRef(0);
  const elapsed = useRef(0);
  const target = useMemo(() => new Vector3(), []);

  useEffect(() => {
    active.current = null;
    return () => {
      rig.mixer.stopAllAction();
      socket.isTracking = false;
    };
  }, [rig, socket]);

  useFrame((_, dt) => {
    if (!root.current || state.paused) return;
    if (!call) activeCall.current = null;
    else if (activeCall.current?.id !== call.id)
      activeCall.current = { ...call, age: 0 };
    else activeCall.current.age += dt;
    elapsed.current += dt;
    if (state.phase === "ready") {
      root.current.position.set(...HOME);
      root.current.rotation.y = WORK_YAW;
      plan.current = null;
      returnPlan.current = null;
    }
    if (eventCount.current < state.environment.events.length) {
      if (!state.pending)
        screamUntil.current =
          elapsed.current + rig.actions.scream.getClip().duration;
    }
    eventCount.current = state.environment.events.length;
    const pending = state.pending;
    if (pending && plan.current?.id !== pending.id) {
      returnPlan.current = null;
      actionTarget(state, target);
      const performance = actionPerformance(pending.action);
      const height = (target.y - FLOOR) / SCALE;
      const sample = rig.samples[performance.clip].reduce((best, point) =>
        Math.abs(point.palm.y - height) < Math.abs(best.palm.y - height)
          ? point
          : best,
      );
      const stance = selectContactStance({
        target: { x: target.x, z: target.z },
        palm: { x: sample.palm.x, z: sample.palm.z },
        scale: SCALE,
        start: {
          x: root.current.position.x,
          z: root.current.position.z,
        },
        home: { x: HOME[0], z: HOME[2] },
        preferredYaw: WORK_YAW,
        candidateYaws: STANCE_YAWS,
      });
      const end = new Vector3(stance.position.x, FLOOR, stance.position.z);
      const route = [
        root.current.position.clone(),
        ...stance.waypoints.map(
          (point) => new Vector3(point.x, FLOOR, point.z),
        ),
        end,
      ];
      let routeDistance = 0;
      const routeEnds = route.slice(1).map((point, index) => {
        routeDistance += point.distanceTo(route[index]);
        return routeDistance;
      });
      plan.current = {
        id: pending.id,
        end,
        route,
        routeEnds,
        routeDistance,
        yaw: stance.yaw,
        duration: getActionDuration(pending.action, state.emotion) / 1000,
        contact: sample.time,
        clip: performance.clip,
        reverse: performance.reverse,
        hold: performance.hold,
      };
    }
    let name = elapsed.current < screamUntil.current ? "scream" : "idle";
    let clipTime: number | null = null;
    socket.actionContact = false;
    const current = plan.current;
    if (pending && current) {
      const seconds = pending.progress * current.duration;
      const approach = Math.min(1, seconds / APPROACH_SECONDS);
      const moving = current.routeDistance > 0.045;
      if (approach < 1) {
        name = moving ? "walk" : "idle";
        let walkYaw = current.yaw;
        if (moving) {
          const traveled = approach * current.routeDistance;
          const segment = Math.min(
            current.routeEnds.findIndex((end) => traveled <= end),
            current.route.length - 2,
          );
          const index = segment < 0 ? current.route.length - 2 : segment;
          const segmentStart = index === 0 ? 0 : current.routeEnds[index - 1];
          const segmentLength = current.routeEnds[index] - segmentStart;
          const from = current.route[index];
          const to = current.route[index + 1];
          root.current.position.lerpVectors(
            from,
            to,
            segmentLength > 0 ? (traveled - segmentStart) / segmentLength : 1,
          );
          walkYaw = Math.atan2(to.x - from.x, to.z - from.z);
        }
        const yaw = moving && approach < 0.88 ? walkYaw : current.yaw;
        root.current.rotation.y +=
          Math.atan2(
            Math.sin(yaw - root.current.rotation.y),
            Math.cos(yaw - root.current.rotation.y),
          ) *
          (1 - Math.exp(-dt * 5));
      } else {
        name = current.clip;
        const progress = Math.min(
          1,
          (seconds - APPROACH_SECONDS) / (current.duration - APPROACH_SECONDS),
        );
        const duration = rig.actions[name].getClip().duration;
        clipTime =
          (current.reverse ? 1 - progress : progress) * (duration - 0.001);
        if (current.hold) {
          const reach =
            progress < 0.3
              ? progress / 0.3
              : progress > 0.7
                ? (1 - progress) / 0.3
                : 1;
          clipTime = current.contact * reach;
        }
        socket.actionContact = current.hold
          ? progress >= 0.3 && progress <= 0.7
          : current.reverse
            ? clipTime <= current.contact
            : clipTime >= current.contact;
        root.current.position.copy(current.end);
        root.current.rotation.y = current.yaw;
      }
    } else {
      if (current) {
        const home = new Vector3(...HOME);
        const waypoints = planSafeRoute(
          { x: root.current.position.x, z: root.current.position.z },
          { x: HOME[0], z: HOME[2] },
        );
        const route = [
          root.current.position.clone(),
          ...waypoints.map((point) => new Vector3(point.x, FLOOR, point.z)),
          home,
        ];
        let routeDistance = 0;
        const routeEnds = route.slice(1).map((point, index) => {
          routeDistance += point.distanceTo(route[index]);
          return routeDistance;
        });
        const walkCycle = rig.actions.walk.getClip().duration;
        returnPlan.current = {
          route,
          routeEnds,
          routeDistance,
          travelSeconds:
            (routeDistance * walkCycle) / RETURN_METERS_PER_WALK_CLIP,
          elapsed: 0,
          turnYaw: null,
        };
        plan.current = null;
      }
      const returning = returnPlan.current;
      if (returning && elapsed.current >= screamUntil.current) {
        name = "walk";
        returning.elapsed += dt;
        if (
          returning.routeDistance > 0.001 &&
          returning.elapsed < returning.travelSeconds
        ) {
          const traveled =
            (returning.elapsed / returning.travelSeconds) *
            returning.routeDistance;
          const found = returning.routeEnds.findIndex((end) => traveled <= end);
          const index = found < 0 ? returning.route.length - 2 : found;
          const segmentStart = index === 0 ? 0 : returning.routeEnds[index - 1];
          const segmentLength = returning.routeEnds[index] - segmentStart;
          const from = returning.route[index];
          const to = returning.route[index + 1];
          root.current.position.lerpVectors(
            from,
            to,
            segmentLength > 0 ? (traveled - segmentStart) / segmentLength : 1,
          );
          const yaw = Math.atan2(to.x - from.x, to.z - from.z);
          root.current.rotation.y +=
            Math.atan2(
              Math.sin(yaw - root.current.rotation.y),
              Math.cos(yaw - root.current.rotation.y),
            ) *
            (1 - Math.exp(-dt * 5));
        } else {
          root.current.position.set(...HOME);
          returning.turnYaw ??= root.current.rotation.y;
          const turnProgress = Math.min(
            1,
            (returning.elapsed - returning.travelSeconds) / RETURN_TURN_SECONDS,
          );
          const turn = Math.atan2(
            Math.sin(WORK_YAW - returning.turnYaw),
            Math.cos(WORK_YAW - returning.turnYaw),
          );
          root.current.rotation.y = returning.turnYaw + turn * turnProgress;
          if (turnProgress >= 1) {
            root.current.rotation.y = WORK_YAW;
            returnPlan.current = null;
            name = "idle";
          }
        }
      }
    }
    const next = rig.actions[name];
    if (active.current !== next) {
      active.current?.fadeOut(0.35);
      next.reset().setEffectiveWeight(1).fadeIn(0.35).play();
      active.current = next;
    }
    next.paused = clipTime !== null;
    if (clipTime !== null) next.time = clipTime;
    rig.morphs.update(rig.mixer, dt, {
      ScreamOpen: activeCall.current
        ? callEnvelope(activeCall.current.cue, activeCall.current.age) * 0.18
        : 0,
      RightGrip: state.holding ? 0.8 : 0,
    });
    root.current.updateMatrixWorld(true);
    rig.hand.getWorldPosition(socket.position);
    socket.gripPosition.copy(rig.palm);
    rig.hand.localToWorld(socket.gripPosition);
    rig.hand.getWorldQuaternion(socket.quaternion);
    socket.isTracking = true;
  });
  return (
    <group
      ref={root}
      position={[...HOME]}
      rotation={[0, WORK_YAW, 0]}
      scale={SCALE}
      name="assembled-son"
    >
      <primitive object={scene} />
    </group>
  );
}

export function GeneratedAssistant(props: Props) {
  const fallback = (
    <ProceduralAssistant
      state={props.state}
      reducedMotion={props.reducedMotion}
    />
  );
  return (
    <AssistantErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RiggedAssistant {...props} />
      </Suspense>
    </AssistantErrorBoundary>
  );
}
