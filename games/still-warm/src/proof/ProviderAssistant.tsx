import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import idleUrl from "../../source-assets/assembled/animations/anim_idle.glb?url";
import walkUrl from "../../source-assets/assembled/animations/anim_walk.glb?url";

import clip112Url from "../../source-assets/assembled/animations/expanded/anim_112.glb?url";
import clip119Url from "../../source-assets/assembled/animations/expanded/anim_119.glb?url";
import clip111Url from "../../source-assets/assembled/animations/expanded/anim_111.glb?url";
import clip276Url from "../../source-assets/assembled/animations/expanded/anim_276.glb?url";
import clip284Url from "../../source-assets/assembled/animations/expanded/anim_284.glb?url";
import clip262Url from "../../source-assets/assembled/animations/expanded/anim_262.glb?url";
import clip365Url from "../../source-assets/assembled/animations/expanded/anim_365.glb?url";
import clip386Url from "../../source-assets/assembled/animations/expanded/anim_386.glb?url";
import clip576Url from "../../source-assets/assembled/animations/expanded/anim_576.glb?url";
import clip586Url from "../../source-assets/assembled/animations/expanded/anim_586.glb?url";
import pickupGripUrl from "../../source-assets/assembled/hand-grips/anim_276_grip.glb?url";
import collectGripUrl from "../../source-assets/assembled/hand-grips/anim_284_grip.glb?url";
export const HAND_GRIPS = {
  action276: { url: pickupGripUrl, filename: "anim_276_grip.glb" },
  action284: { url: collectGripUrl, filename: "anim_284_grip.glb" },
};

export const RAW_CLIPS = {
  idle: {
    label: "Idle",
    filename: "anim_idle.glb",
    url: idleUrl,
    category: "Original",
    note: "Original idle response.",
  },
  action112: {
    label: "Monster walk",
    filename: "anim_112.glb",
    url: clip112Url,
    category: "Movement",
    note: "Main walking candidate.",
  },
  action119: {
    label: "Slow orc walk",
    filename: "anim_119.glb",
    url: clip119Url,
    category: "Movement",
    note: "Heavy walking candidate.",
  },
  action111: {
    label: "Injured walk",
    filename: "anim_111.glb",
    url: clip111Url,
    category: "Movement",
    note: "Walking after an injury.",
  },
  action276: {
    label: "Bend and pick up",
    filename: "anim_276.glb",
    url: clip276Url,
    category: "Interaction",
    note: "Pick up an object below the hand.",
  },
  action284: {
    label: "Collect object",
    filename: "anim_284.glb",
    url: clip284Url,
    category: "Interaction",
    note: "Alternative object pickup.",
  },
  action262: {
    label: "Crouch and push",
    filename: "anim_262.glb",
    url: clip262Url,
    category: "Interaction",
    note: "Push the fallen beam.",
  },
  action365: {
    label: "Kneel and stand",
    filename: "anim_365.glb",
    url: clip365Url,
    category: "Interaction",
    note: "Move down beside the patient.",
  },
  action386: {
    label: "Zombie scream",
    filename: "anim_386.glb",
    url: clip386Url,
    category: "Reaction",
    note: "Fear or anger response.",
  },
  action576: {
    label: "Turn left",
    filename: "anim_576.glb",
    url: clip576Url,
    category: "Movement",
    note: "Turn while standing.",
  },
  action586: {
    label: "Turn right",
    filename: "anim_586.glb",
    url: clip586Url,
    category: "Movement",
    note: "Turn while standing.",
  },
  walk: {
    label: "Fall (old walk response)",
    filename: "anim_walk.glb",
    url: walkUrl,
    category: "Original",
    note: "RUN mapped walk to action 7 (BeHit_FlyUp). This is the original incorrect response.",
  },
};
export type RawClip = keyof typeof RAW_CLIPS;
export interface ClipInfo {
  name: string;
  duration: number;
  tracks: number;
}

// Use each response's own mesh, skeleton, materials, and animation tracks.
export function ProviderAssistant({
  url,
  focusHand,
  paused,
  rate,
  onLoaded,
  repeat,
}: {
  url: string;
  focusHand: "Left" | "Right" | null;
  paused: boolean;
  rate: number;
  repeat: boolean;
  onLoaded: (info: ClipInfo) => void;
}) {
  const source = useGLTF(url, `${import.meta.env.BASE_URL}draco/`);
  const scene = useMemo(() => clone(source.scene), [source.scene]);
  const camera = useThree((state) => state.camera);
  const handViews = useMemo(() => {
    scene.updateMatrixWorld(true);
    const mesh = scene.getObjectByName("char1");
    if (!(mesh instanceof SkinnedMesh))
      throw new Error("The clip has no character mesh.");
    const result = new Map<
      string,
      { bone: (typeof mesh.skeleton.bones)[number]; center: Vector3 }
    >();
    for (const side of ["Left", "Right"]) {
      const index = mesh.skeleton.bones.findIndex(
        (bone) => bone.name === side + "Hand",
      );
      if (index < 0) throw new Error("The clip has no " + side + " wrist.");
      const positions = mesh.geometry.getAttribute("position");
      const indices = mesh.geometry.getAttribute("skinIndex");
      const weights = mesh.geometry.getAttribute("skinWeight");
      const center = new Vector3();
      const vertex = new Vector3();
      let total = 0;
      for (let i = 0; i < positions.count; i++) {
        for (let j = 0; j < 4; j++) {
          if (indices.getComponent(i, j) !== index) continue;
          const weight = weights.getComponent(i, j);
          if (weight < 0.6) continue;
          center.addScaledVector(
            vertex.fromBufferAttribute(positions, i),
            weight,
          );
          total += weight;
        }
      }
      if (!total) throw new Error("The wrist has no hand vertices.");
      center
        .divideScalar(total)
        .applyMatrix4(mesh.bindMatrix)
        .applyMatrix4(mesh.skeleton.boneInverses[index]);
      result.set(side, { bone: mesh.skeleton.bones[index], center });
    }
    return result;
  }, [scene]);
  const target = useMemo(() => new Vector3(), []);
  const cameraOffset = useMemo(() => new Vector3(0.32, 0.12, 0.45), []);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  useEffect(
    function playOriginalClip() {
      const animation = source.animations[0];
      if (!animation) throw new Error("The response has no animation.");
      const action = mixer.clipAction(animation);
      action.setLoop(repeat ? LoopRepeat : LoopOnce, repeat ? Infinity : 1);
      action.clampWhenFinished = true;
      action.reset().play();
      mixer.update(0);
      onLoaded({
        name: animation.name,
        duration: animation.duration,
        tracks: animation.tracks.length,
      });
      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      };
    },
    [mixer, scene, source.animations, onLoaded, repeat],
  );
  useFrame((_, dt) => {
    if (!paused) mixer.update(dt * rate);
    if (focusHand) {
      scene.updateMatrixWorld(true);
      const hand = handViews.get(focusHand)!;
      target.copy(hand.center);
      hand.bone.localToWorld(target);
      camera.position.copy(target).add(cameraOffset);
      camera.lookAt(target);
    }
  });
  return <primitive object={scene} />;
}
