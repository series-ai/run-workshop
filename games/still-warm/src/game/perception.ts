import {
  CATALOG,
  type ContactAction,
  type Emotion,
  type GameState,
} from "./model";

export function contactThought(
  contact: ContactAction,
  state: GameState,
): string {
  const movement = contact.style === "rough" ? "Too fast." : "Slowly.";
  if (contact.kind === "lift_debris")
    return `He's about to lift the weight. ${movement}`;
  if (contact.kind === "roll_patient")
    return `He's going to turn me onto my back. ${movement}`;
  const tool = CATALOG[contact.item].name.toLowerCase();
  if (contact.target === "patient") {
    if (contact.item === "morphine")
      return "The morphine. He's going to give me more.";
    if (contact.item === "release")
      return "His hand is at the brace. He's going to release it.";
    if (contact.item === "mirror")
      return "The mirror. He's going to let me see.";
    return `He's bringing the ${tool} toward me. ${movement}`;
  }
  if (contact.item === "forceps" && state.stage === "exposed")
    return `The forceps. He's going to pull the metal out. ${movement}`;
  if (contact.item === "suture" && state.stage === "extracted")
    return `He's bringing the threaded needle to the wound. ${movement}`;
  if (contact.item === "cloth" && state.stage === "covered")
    return `He's going to uncover the wound. ${movement}`;
  if (["cloth", "bandage", "blanket"].includes(contact.item))
    return `The ${tool}. He's going to press it against the wound. ${movement}`;
  return `He's bringing the ${tool} to my wound. ${movement}`;
}

export const EMOTION_THOUGHTS: Record<Emotion, string> = {
  scared: "A frightened, shuddering whimper in the cold cellar.",
  anxious: "A thick, slurred murmur caught in his throat.",
  angry: "A sudden, guttural growl cutting through the dark.",
  sad: "A mournful moan caught deep in his chest.",
  happy: "A sharp, eager rasp—he shifts his weight in sudden excitement.",
  focused: "A deep, straining grunt under the heavy weight.",
};
