import type { Emotion, VocalCue } from "./model";

export type MonsterEmotionCategory =
  | "moan"
  | "slurred_speech"
  | "excitement"
  | "screaming"
  | "fear"
  | "effort"
  | "relief"
  | "anger";

export interface MonsterResponse {
  category: MonsterEmotionCategory;
  text: string;
  cue: VocalCue;
}

export const MONSTER_RESPONSES: Record<
  MonsterEmotionCategory,
  { text: string; cue: VocalCue }[]
> = {
  moan: [
    { text: "A low, shuddering moan in the dark.", cue: "effort" },
    { text: "A heavy, guttural moan from across the cellar floor.", cue: "effort" },
    { text: "A mournful groan caught deep in his chest.", cue: "pain" },
    { text: "A ragged moan vibrating through the cold stone.", cue: "effort" },
  ],
  slurred_speech: [
    {
      text: "A thick, slurred murmur—he tries to form a word, but only a clumsy sound spills out.",
      cue: "fear",
    },
    { text: "A heavy, slurred stammer in the dark.", cue: "effort" },
    { text: "A clumsy, slurred rumble caught in his throat.", cue: "effort" },
    {
      text: "He mutters a broken, slurred cadence that dissolves into a rasp.",
      cue: "fear",
    },
  ],
  excitement: [
    {
      text: "A sharp, eager rasp—he shifts his weight in sudden excitement.",
      cue: "relief",
    },
    {
      text: "An excited, ragged gasp as his heavy hands twitch.",
      cue: "relief",
    },
    { text: "A breathless, hurried panting in the shadows.", cue: "effort" },
    { text: "An eager shudder runs through his breath.", cue: "relief" },
  ],
  screaming: [
    {
      text: "A sudden, terrified scream echoes off the cellar walls.",
      cue: "pain",
    },
    { text: "A sharp, ragged screech that cuts through the dark.", cue: "pain" },
    { text: "A muffled shriek of raw fear.", cue: "fear" },
    { text: "A piercing cry tearing from his throat.", cue: "pain" },
  ],
  fear: [
    {
      text: "A frightened, shuddering whimper close to the stone.",
      cue: "fear",
    },
    { text: "A faint, trembling whimper from the gloom.", cue: "fear" },
  ],
  effort: [
    { text: "A deep, straining grunt under the heavy weight.", cue: "effort" },
    {
      text: "A harsh, laboring breath as muscle strains against bone.",
      cue: "effort",
    },
  ],
  relief: [
    { text: "A long, shuddering sigh of relief.", cue: "relief" },
    { text: "A soft, quivering exhale in the damp cold.", cue: "relief" },
  ],
  anger: [
    { text: "A low, defensive rumble vibrating in his throat.", cue: "anger" },
    { text: "A sudden, guttural growl cutting through the dark.", cue: "anger" },
  ],
};

const EMOTION_MAP: Record<Emotion, MonsterEmotionCategory[]> = {
  scared: ["fear", "screaming", "moan"],
  anxious: ["slurred_speech", "moan", "fear"],
  angry: ["anger", "screaming"],
  sad: ["moan", "slurred_speech"],
  happy: ["excitement", "relief"],
  focused: ["effort", "moan"],
};

export function getMonsterResponse(
  categoryOrEmotion?: MonsterEmotionCategory | Emotion,
): MonsterResponse {
  let cat: MonsterEmotionCategory;
  if (!categoryOrEmotion) {
    const allCats: MonsterEmotionCategory[] = [
      "moan",
      "slurred_speech",
      "excitement",
      "screaming",
    ];
    cat = allCats[Math.floor(Math.random() * allCats.length)];
  } else if (categoryOrEmotion in MONSTER_RESPONSES) {
    cat = categoryOrEmotion as MonsterEmotionCategory;
  } else if (categoryOrEmotion in EMOTION_MAP) {
    const options = EMOTION_MAP[categoryOrEmotion as Emotion];
    cat = options[Math.floor(Math.random() * options.length)];
  } else {
    cat = "moan";
  }

  const pool = MONSTER_RESPONSES[cat];
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { category: cat, text: item.text, cue: item.cue };
}
