import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AnimationMixer, LoopOnce, LoopRepeat } from "three";
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
  clip,
  paused,
  rate,
  onLoaded,
  repeat,
}: {
  clip: RawClip;
  paused: boolean;
  rate: number;
  repeat: boolean;
  onLoaded: (info: ClipInfo) => void;
}) {
  const source = useGLTF(
    RAW_CLIPS[clip].url,
    `${import.meta.env.BASE_URL}draco/`,
  );
  const scene = useMemo(() => clone(source.scene), [source.scene]);
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
  });
  return <primitive object={scene} />;
}
