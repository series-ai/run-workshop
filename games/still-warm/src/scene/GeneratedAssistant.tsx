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
  Group,
  Mesh,
  SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_PATHS, DRACO_PATH } from "./assets";
import { ProceduralAssistant } from "./ProceduralAssistant";
import { PATIENT_LAYOUT } from "./patientLayout";
import { LAMP_HANDLE, getItemOffset, getItemSlot, type LiveHandSocket } from "./types";
import { actionPerformance, APPROACH_SECONDS } from "../game/performance";
import { getActionDuration } from "../game/store";
import type { GameState } from "../game/model";

interface Props {
  state: GameState;
  reducedMotion?: boolean;
  socket: LiveHandSocket;
}
const SCALE = 0.9;
const FLOOR = PATIENT_LAYOUT.floorY;
const HOME = [-0.72, FLOOR, 0.48] as const;
const WORK_YAW = 2.1;
const UP = new Vector3(0, 1, 0);

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
    out.set(
      -0.25,
      PATIENT_LAYOUT.beamGripY + (state.pending?.progress ?? 0) * 0.7,
      PATIENT_LAYOUT.beam[2],
    );
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

function RiggedAssistant({ state, socket }: Props) {
  const root = useRef<Group>(null!);
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
    };
  }, [scene, source.animations]);
  const active = useRef<AnimationAction | null>(null);
  const plan = useRef<{
    id: number;
    start: Vector3;
    end: Vector3;
    yaw: number;
    duration: number;
    contact: number;
    clip: string;
    reverse: boolean;
    hold: boolean;
  } | null>(null);
  const eventCount = useRef(state.environment.eventCount);
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
    elapsed.current += dt;
    if (state.phase === "ready") {
      root.current.position.set(...HOME);
      root.current.rotation.y = WORK_YAW;
      plan.current = null;
    }
    if (eventCount.current !== state.environment.eventCount) {
      eventCount.current = state.environment.eventCount;
      if (!state.pending)
        screamUntil.current =
          elapsed.current + rig.actions.scream.getClip().duration;
    }
    const pending = state.pending;
    if (pending && plan.current?.id !== pending.id) {
      actionTarget(state, target);
      const performance = actionPerformance(pending.action);
      const yaw = target.x < -0.85 ? -Math.PI / 2 : WORK_YAW;
      const height = (target.y - FLOOR) / SCALE;
      const sample = rig.samples[performance.clip].reduce((best, point) =>
        Math.abs(point.palm.y - height) < Math.abs(best.palm.y - height)
          ? point
          : best,
      );
      const offset = sample.palm
        .clone()
        .multiplyScalar(SCALE)
        .applyAxisAngle(UP, yaw);
      const end = new Vector3(target.x - offset.x, FLOOR, target.z - offset.z);
      // Keep the feet outside the patient's body.
      if (end.z < 1.25 && Math.abs(end.x) < 0.48)
        end.x = end.x < 0 ? -0.48 : 0.48;
      plan.current = {
        id: pending.id,
        start: root.current.position.clone(),
        end,
        yaw,
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
      const moving = current.start.distanceToSquared(current.end) > 0.002;
      if (approach < 1) {
        name = moving ? "walk" : "idle";
        root.current.position.lerpVectors(current.start, current.end, approach);
        const walkYaw = Math.atan2(
          current.end.x - current.start.x,
          current.end.z - current.start.z,
        );
        const yaw = moving && approach < 0.75 ? walkYaw : current.yaw;
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
      plan.current = null;
    }
    const next = rig.actions[name];
    if (active.current !== next) {
      active.current?.fadeOut(0.35);
      next.reset().setEffectiveWeight(1).fadeIn(0.35).play();
      active.current = next;
    }
    next.paused = clipTime !== null;
    if (clipTime !== null) next.time = clipTime;
    rig.mixer.update(dt);
    // Keep the instrument inside the hand after the authored grip releases.
    if (
      state.holding &&
      rig.mesh.morphTargetDictionary &&
      rig.mesh.morphTargetInfluences
    ) {
      rig.mesh.morphTargetInfluences[rig.mesh.morphTargetDictionary.RightGrip] =
        Math.max(
          rig.mesh.morphTargetInfluences[
            rig.mesh.morphTargetDictionary.RightGrip
          ],
          0.8,
        );
    }
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
