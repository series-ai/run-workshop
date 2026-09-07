import {
  Suspense,
  Component,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  Bone,
  Group,
  Mesh,
  SkinnedMesh,
  MeshStandardMaterial,
  Vector3,
  Quaternion,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSISTANT_READY, ASSET_PATHS, DRACO_PATH } from "./assets";
import { ProceduralAssistant } from "./ProceduralAssistant";
import { PATIENT_LAYOUT } from "./patientLayout";
import { ZombieGait } from "./zombieGait";
import { ArmReach } from "./arm";
import { CORPSE_HOME, CorpseMotion } from "./corpseMotion";
import { getItemOffset, getItemSlot, type LiveHandSocket } from "./types";
import type { GameState } from "../game/model";

export interface CreaturePoseSample {
  phase: "idle" | "turning" | "walking" | "working";
  root: number[];
  yaw: number;
  feet: { position: number[]; planted: boolean; error: number }[];
  hand: number[];
  contactError: number | null;
  leftContactError: number | null;
}

interface Props {
  playbackRate?: number;
  onPose?: (sample: CreaturePoseSample) => void;
  state: GameState;
  reducedMotion?: boolean;
  socket: LiveHandSocket;
}
const HOME: [number, number, number] = [...CORPSE_HOME];
const SCALE: [number, number, number] = [0.9, 0.9, 0.9];
// Anatomical sides in this rig: left is positive local X.
const SIDE_X = { Left: 1, Right: -1 } as const;

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
    out.set(0.15, 1.2, 0.2);
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
        out.set(0.15, 1.2, 0.2);
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

function RiggedAssistant({
  state,
  reducedMotion = false,
  socket,
  playbackRate = 1,
  onPose,
}: Props) {
  const root = useRef<Group>(null!);
  const source = useGLTF(ASSET_PATHS.assistantGlb, DRACO_PATH);
  const scene = useMemo(() => {
    const instance = clone(source.scene);
    instance.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material instanceof MeshStandardMaterial)
          object.material = object.material.clone();
      }
    });
    return instance;
  }, [source.scene]);
  const palmOffset = useMemo(() => {
    const mesh = scene.getObjectByName("char1");
    if (!(mesh instanceof SkinnedMesh))
      throw new Error("Creature mesh is missing its skin.");
    const index = mesh.skeleton.bones.findIndex(
      (bone) => bone.name === "RightHand",
    );
    if (index < 0) throw new Error("Creature rig is missing the right hand.");
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    const center = new Vector3();
    const point = new Vector3();
    let weight = 0;
    for (let i = 0; i < position.count; i++) {
      for (let j = 0; j < 4; j++) {
        if (skinIndex.getComponent(i, j) !== index) continue;
        const w = skinWeight.getComponent(i, j);
        if (w < 0.5) continue;
        center.addScaledVector(point.fromBufferAttribute(position, i), w);
        weight += w;
      }
    }
    if (weight === 0) throw new Error("Creature hand has no skin weights.");
    center
      .divideScalar(weight)
      .applyMatrix4(mesh.bindMatrix)
      .applyMatrix4(mesh.skeleton.boneInverses[index]);
    // The hand surface centroid extends into the fingers. Grip halfway from the wrist.
    return center.multiplyScalar(0.5);
  }, [scene]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const actions = useMemo(
    () =>
      Object.fromEntries(
        source.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
      ),
    [mixer, source.animations],
  );
  const bones = useMemo(() => {
    const result = new Map<string, Bone>();
    scene.traverse((object) => {
      if (object instanceof Bone) result.set(object.name, object);
    });
    return result;
  }, [scene]);
  const restPose = useMemo(() => {
    actions.idle?.reset().play();
    mixer.setTime(0.15);
    const pose = [...bones.values()].map((bone) => ({
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    }));
    mixer.stopAllAction();
    return pose;
  }, [actions, bones, mixer]);
  const modelYaw = useMemo(() => {
    scene.updateWorldMatrix(true, true);
    const face = bones.get("Head"),
      front = bones.get("headfront");
    if (!face || !front) return 0;
    const direction = front
      .getWorldPosition(new Vector3())
      .sub(face.getWorldPosition(new Vector3()));
    return Math.atan2(direction.x, direction.z);
  }, [bones, scene, restPose]);
  const motion = useMemo(() => new CorpseMotion(), []);
  const reach = useMemo(() => new ArmReach(), []);
  const legReach = useMemo(() => new ArmReach(), []);
  const gait = useRef<ZombieGait | null>(null);
  const limbs = useMemo(
    () =>
      (["Left", "Right"] as const).map((side) => ({
        side,
        upper: bones.get(`${side}UpLeg`)!,
        lower: bones.get(`${side}Leg`)!,
        foot: bones.get(`${side}Foot`)!,
        local: new Vector3(),
        bind: new Quaternion(),
        ideal: new Vector3(),
      })),
    [bones],
  );
  const vectors = useMemo(
    () => ({
      target: new Vector3(),
      direction: new Vector3(),
      pole: new Vector3(),
      pelvis: new Vector3(),
      left: new Vector3(),
      smooth: new Vector3(),
      leftSmooth: new Vector3(),
      actual: new Vector3(),
      focus: new Vector3(...PATIENT_LAYOUT.eyes),
    }),
    [],
  );
  const rotations = useMemo(
    () => ({
      root: new Quaternion(),
      foot: new Quaternion(),
      parent: new Quaternion(),
      axis: new Vector3(0, 1, 0),
      forward: new Vector3(),
      spread: new Quaternion(),
    }),
    [],
  );
  const armJoints = useMemo(
    () =>
      (["Left", "Right"] as const).flatMap((side) =>
        ["Arm", "ForeArm", "Hand"].map((part) => {
          const bone = bones.get(`${side}${part}`)!;
          return { side, bone, previous: bone.quaternion.clone() };
        }),
      ),
    [bones, restPose],
  );
  const lastAction = useRef<number | null>(null);
  const facingSet = useRef(false);
  const time = useRef(0);
  const crouch = useRef(0),
    crouchGoal = useRef(0),
    lean = useRef(0.32),
    leanGoal = useRef(0.32);
  const smoothingReady = useRef(false);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      socket.isTracking = false;
      scene.traverse((object) => {
        if (
          object instanceof Mesh &&
          object.material instanceof MeshStandardMaterial
        )
          object.material.dispose();
      });
    },
    [mixer, scene, socket],
  );

  useFrame((_, frameDt) => {
    if (state.paused) return;
    const dt = Math.min(0.1, frameDt * playbackRate);
    time.current += dt;
    for (const rest of restPose) {
      rest.bone.position.copy(rest.position);
      rest.bone.quaternion.copy(rest.quaternion);
      rest.bone.scale.copy(rest.scale);
    }
    const {
      target,
      direction,
      pole,
      pelvis,
      left,
      smooth,
      leftSmooth,
      actual,
      focus,
    } = vectors;
    const working = actionTarget(state, target);
    if (working && state.pending && lastAction.current !== state.pending.id) {
      lastAction.current = state.pending.id;
      motion.approach(target);
      crouchGoal.current = target.y < -0.35 ? 0.68 : target.y < 0.3 ? 0.1 : 0;
      leanGoal.current = target.y < -0.35 ? 1.18 : 0.5;
    }
    if (state.pending?.action.kind === "lift_debris") {
      const progress = state.pending.progress;
      crouchGoal.current = 0.68 * (1 - progress * 0.8);
      leanGoal.current = 1.18 * (1 - progress * 0.65);
    }
    if (!working) {
      if (motion.travelling) motion.stop();
      crouchGoal.current = 0;
      leanGoal.current = 0.32;
    }
    if (motion.travelling) motion.direction(direction);
    else direction.subVectors(working ? target : focus, motion.position);
    const desiredYaw = Math.atan2(direction.x, direction.z) - modelYaw;
    const difference = Math.atan2(
      Math.sin(desiredYaw - root.current.rotation.y),
      Math.cos(desiredYaw - root.current.rotation.y),
    );
    if (!facingSet.current) {
      root.current.rotation.y = desiredYaw;
      facingSet.current = true;
    } else
      root.current.rotation.y += Math.max(
        -dt * 0.55,
        Math.min(dt * 0.55, difference),
      );
    const turning = Math.abs(difference) > 0.22;
    const walking = motion.step(dt, Math.abs(difference) < 0.3 ? 1 : 0);
    root.current.position.copy(motion.position);
    const travelling = motion.travelling;
    if (walking && !reducedMotion) {
      actions.walk?.play().setEffectiveWeight(0.45);
      const duration = actions.walk?.getClip().duration ?? 1;
      mixer.setTime((motion.distanceTravelled / 0.46) * duration);
      const hips = restPose.find((rest) => rest.bone.name === "Hips");
      if (hips) {
        hips.bone.position.copy(hips.position);
        hips.bone.quaternion.copy(hips.quaternion);
      }
    } else actions.walk?.stop();
    root.current.updateWorldMatrix(true, true);
    root.current.getWorldQuaternion(rotations.root);
    if (!gait.current) {
      const points = limbs.map((limb) => {
        limb.foot.getWorldPosition(actual);
        limb.local.copy(root.current.worldToLocal(actual.clone()));
        limb.local.z *= 0.35;
        actual.copy(root.current.localToWorld(limb.local.clone()));
        limb.foot.getWorldQuaternion(limb.bind);
        limb.bind.premultiply(rotations.root.clone().invert());
        return actual.clone();
      });
      gait.current = new ZombieGait(
        points[0],
        points[1],
        root.current.rotation.y,
      );
    }
    for (const limb of limbs)
      limb.ideal.copy(root.current.localToWorld(limb.local.clone()));
    gait.current.update(
      [limbs[0].ideal, limbs[1].ideal],
      root.current.rotation.y,
      motion.velocity,
      dt,
    );
    crouch.current +=
      ((travelling ? 0.16 : crouchGoal.current) - crouch.current) *
      (1 - Math.exp(-dt * 6));
    const hips = bones.get("Hips");
    if (hips?.parent) {
      hips.getWorldPosition(pelvis);
      pelvis.y -= crouch.current;
      hips.position.copy(hips.parent.worldToLocal(pelvis));
    }
    lean.current +=
      ((travelling ? 0.25 : leanGoal.current) - lean.current) *
      (1 - Math.exp(-dt * 3));
    bones.get("Spine02")?.rotateX(lean.current);
    if (!reducedMotion)
      bones.get("Spine01")?.rotateX(Math.sin(time.current * 0.9) * 0.004);
    const face = bones.get("Head");
    if (face) {
      face.rotateX(
        state.emotion === "sad"
          ? 0.22
          : state.emotion === "angry"
            ? 0.06
            : 0.12,
      );
      face.rotateZ(state.emotion === "scared" ? -0.09 : -0.04);
      if (!reducedMotion) face.rotateX(Math.sin(time.current * 0.55) * 0.007);
    }
    if (state.emotion === "scared" || state.emotion === "anxious") {
      bones.get("LeftShoulder")?.rotateZ(0.045);
      bones.get("RightShoulder")?.rotateZ(-0.035);
    }
    scene.updateWorldMatrix(true, true);
    const footSamples = limbs.map((limb, index) => {
      const foot = gait.current!.feet[index];
      pole
        .set(SIDE_X[limb.side] * 0.3, 0.4, 0.7)
        .applyQuaternion(rotations.root)
        .add(root.current.position);
      const error = legReach.solve(
        limb.upper,
        limb.lower,
        limb.foot,
        foot.position,
        pole,
      );
      rotations.foot
        .setFromAxisAngle(rotations.axis, foot.yaw)
        .multiply(limb.bind);
      limb.foot.parent!.getWorldQuaternion(rotations.parent).invert();
      limb.foot.quaternion.copy(rotations.parent.multiply(rotations.foot));
      limb.foot.updateWorldMatrix(false, true);
      limb.foot.getWorldPosition(actual);
      return {
        position: actual.toArray(),
        planted: gait.current!.activeFoot !== index,
        error,
      };
    });
    const canWork = working && !travelling;
    const moveRight = canWork || state.holding !== null;
    const moveLeft = canWork && state.pending?.action.kind === "lift_debris";
    if (!canWork && state.holding) {
      target.set(-0.36, 0.95 - crouch.current, 0.5);
      target.applyQuaternion(rotations.root).add(root.current.position);
    } else if (!canWork) bones.get("RightHand")!.getWorldPosition(target);
    bones.get("LeftHand")!.getWorldPosition(left);
    if (moveLeft)
      left.set(
        -0.5,
        PATIENT_LAYOUT.beamGripY + state.pending!.progress * 0.7,
        PATIENT_LAYOUT.beam[2],
      );
    if (!smoothingReady.current) {
      smooth.copy(target);
      leftSmooth.copy(left);
      smoothingReady.current = true;
    }
    smooth.lerp(target, 1 - Math.exp(-dt * 6));
    leftSmooth.lerp(left, 1 - Math.exp(-dt * 6));
    const upper = bones.get("RightArm")!,
      lower = bones.get("RightForeArm")!,
      hand = bones.get("RightHand")!;
    pole
      .set(SIDE_X.Right * 0.42, 0.48, -0.35)
      .applyQuaternion(rotations.root)
      .add(root.current.position);
    if (moveRight) reach.solve(upper, lower, hand, smooth, pole);
    pole
      .set(SIDE_X.Left * 0.42, 0.45, -0.35)
      .applyQuaternion(rotations.root)
      .add(root.current.position);
    if (moveLeft)
      reach.solve(
        bones.get("LeftArm")!,
        bones.get("LeftForeArm")!,
        bones.get("LeftHand")!,
        leftSmooth,
        pole,
      );
    // Keep the provider elbow and wrist pose. Rotate unused arms clear of clothing.
    rotations.forward.set(0, 0, 1).applyQuaternion(rotations.root);
    for (const side of ["Left", "Right"] as const) {
      if (side === "Right" ? moveRight : moveLeft) continue;
      const arm = bones.get(`${side}Arm`)!;
      rotations.spread.setFromAxisAngle(
        rotations.forward,
        SIDE_X[side] * (side === "Left" ? 0.28 : 0.18),
      );
      arm.getWorldQuaternion(rotations.foot).premultiply(rotations.spread);
      arm.parent!.getWorldQuaternion(rotations.parent).invert();
      arm.quaternion.copy(rotations.parent.multiply(rotations.foot));
      arm.updateWorldMatrix(false, true);
    }
    // Return unused arms to the provider pose, without a forced thigh target.
    for (const joint of armJoints) {
      const active = joint.side === "Right" ? moveRight : moveLeft;
      if (active) joint.previous.copy(joint.bone.quaternion);
      else {
        joint.previous.slerp(joint.bone.quaternion, 1 - Math.exp(-dt * 6));
        joint.bone.quaternion.copy(joint.previous);
      }
    }
    scene.updateWorldMatrix(true, true);
    if (!moveRight) hand.getWorldPosition(smooth);
    if (!moveLeft) bones.get("LeftHand")!.getWorldPosition(leftSmooth);
    bones.get("LeftHand")!.getWorldPosition(actual);
    const leftContactError =
      canWork && state.pending?.action.kind === "lift_debris"
        ? actual.distanceTo(left)
        : null;
    hand.getWorldPosition(socket.position);
    socket.gripPosition.copy(palmOffset);
    hand.localToWorld(socket.gripPosition);
    hand.getWorldQuaternion(socket.quaternion);
    socket.isTracking = true;
    onPose?.({
      phase: walking
        ? "walking"
        : turning
          ? "turning"
          : canWork
            ? "working"
            : "idle",
      root: root.current.position.toArray(),
      yaw: root.current.rotation.y,
      feet: footSamples,
      hand: socket.position.toArray(),
      contactError: canWork ? socket.position.distanceTo(target) : null,
      leftContactError,
    });
  });
  return (
    <group
      ref={root}
      position={HOME}
      rotation={[0, 2.4, 0]}
      scale={SCALE}
      name="generated-assistant-rig"
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
  if (!ASSISTANT_READY) return fallback;
  return (
    <AssistantErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RiggedAssistant {...props} />
      </Suspense>
    </AssistantErrorBoundary>
  );
}
