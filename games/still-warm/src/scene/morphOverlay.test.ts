import { expect, it } from "vitest";
import {
  AnimationClip,
  AnimationMixer,
  Mesh,
  NumberKeyframeTrack,
} from "three";
import { MorphOverlay } from "./morphOverlay";

function fixture(mouth: number, grip: number) {
  const mesh = new Mesh();
  mesh.morphTargetDictionary = { ScreamOpen: 0, RightGrip: 1 };
  mesh.morphTargetInfluences = [0, 0];
  const mixer = new AnimationMixer(mesh);
  const clip = new AnimationClip("source", 1, [
    new NumberKeyframeTrack(
      ".morphTargetInfluences[0]",
      [0, 1],
      [mouth, mouth],
    ),
    new NumberKeyframeTrack(".morphTargetInfluences[1]", [0, 1], [grip, grip]),
  ]);
  mixer.clipAction(clip).play();
  return { mesh, mixer, overlay: new MorphOverlay(mesh) };
}

it("releases a call and grip while the mixer caches constant zero tracks", () => {
  const { mesh, mixer, overlay } = fixture(0, 0);
  overlay.update(mixer, 0.1, { ScreamOpen: 0.18, RightGrip: 0.8 });
  expect(mesh.morphTargetInfluences).toEqual([0.18, 0.8]);
  overlay.update(mixer, 0.1, { ScreamOpen: 0.06, RightGrip: 0.8 });
  expect(mesh.morphTargetInfluences).toEqual([0.06, 0.8]);
  overlay.update(mixer, 0.1, { ScreamOpen: 0, RightGrip: 0 });
  expect(mesh.morphTargetInfluences).toEqual([0, 0]);
});

it("preserves the full source scream and restores the source grip", () => {
  const { mesh, mixer, overlay } = fixture(1, 0.45);
  overlay.update(mixer, 0.1, { ScreamOpen: 0.18, RightGrip: 0.8 });
  expect(mesh.morphTargetInfluences).toEqual([1, 0.8]);
  overlay.update(mixer, 0.1, { ScreamOpen: 0, RightGrip: 0 });
  expect(mesh.morphTargetInfluences![0]).toBe(1);
  expect(mesh.morphTargetInfluences![1]).toBeCloseTo(0.45);
});
