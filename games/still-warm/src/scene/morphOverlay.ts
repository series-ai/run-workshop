import type { AnimationMixer, Mesh } from "three";

const MORPHS = ["ScreamOpen", "RightGrip"] as const;
type MorphName = (typeof MORPHS)[number];

export class MorphOverlay {
  private readonly weights: number[];
  private readonly slots: {
    name: MorphName;
    index: number;
    authored: number;
  }[];

  constructor(mesh: Mesh) {
    const dictionary = mesh.morphTargetDictionary;
    const weights = mesh.morphTargetInfluences;
    if (!dictionary || !weights)
      throw new Error("The creature mouth and grip shapes are missing.");
    this.weights = weights;
    this.slots = MORPHS.map((name) => {
      const index = dictionary[name];
      if (index === undefined)
        throw new Error(`The creature ${name} shape is missing.`);
      return { name, index, authored: weights[index] };
    });
  }

  update(
    mixer: AnimationMixer,
    dt: number,
    overrides: Record<MorphName, number>,
  ) {
    // The mixer skips cached values. Restore its previous output before each update.
    for (const slot of this.slots) this.weights[slot.index] = slot.authored;
    mixer.update(dt);
    for (const slot of this.slots) {
      slot.authored = this.weights[slot.index];
      this.weights[slot.index] = Math.max(slot.authored, overrides[slot.name]);
    }
  }
}
