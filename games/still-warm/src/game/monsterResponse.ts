import type { Emotion, VocalCue } from "./model";
import { MicroGrammar, type GrammarRules } from "./microGrammar";

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

export const MONSTER_VOCAL_CUES: Record<MonsterEmotionCategory, VocalCue[]> = {
  moan: ["effort", "pain"],
  slurred_speech: ["fear", "effort"],
  excitement: ["relief", "effort"],
  screaming: ["pain", "fear"],
  fear: ["fear"],
  effort: ["effort"],
  relief: ["relief"],
  anger: ["anger"],
};

export const MONSTER_GRAMMAR_RULES: Record<MonsterEmotionCategory, GrammarRules> = {
  fear: {
    origin: [
      "#perception_fear# #sound_fear# #location#.",
      "#location_front#, #perception_fear# #sound_fear#.",
      "#sound_fear_direct# reaches me #location#.",
      "#sound_fear_direct# shivers through the cold air #location#.",
    ],
    perception_fear: [
      "I hear",
      "I catch",
      "I listen as he lets out",
      "I feel my chest tighten as I hear",
      "my ears catch",
    ],
    sound_fear: [
      "his faint, trembling whimper",
      "his frightened, shuddering whimper",
      "a trembling rasp of fear caught in his throat",
      "a soft, fragile cry of raw terror",
      "his quavering breath catching short in terror",
      "a terrified, weeping whimper",
      "a small, quivering whimper breaking from his chest",
    ],
    sound_fear_direct: [
      "his faint, trembling whimper",
      "a fragile, frightened whimper from him",
      "his quavering breath of terror",
      "a small, weeping whimper",
      "his soft, shuddering cry of fear",
    ],
    location: [
      "from the gloom",
      "close to the cold flagstones",
      "in the darkness beside me",
      "from the shadows",
      "against the damp floor",
      "in the black cellar air",
    ],
    location_front: [
      "from the gloom",
      "through the darkness",
      "across the wet stone",
      "from the deep shadows",
      "close to the cold floor",
    ],
  },
  moan: {
    origin: [
      "#perception_moan# #sound_moan# #location#.",
      "#location_front#, #perception_moan# #sound_moan#.",
      "#sound_moan_direct# echoes #location#.",
      "#sound_moan_direct# vibrates through the stone beneath my cheek.",
    ],
    perception_moan: [
      "I hear",
      "I catch",
      "I listen to",
      "through the silence comes",
    ],
    sound_moan: [
      "a low, shuddering moan from him",
      "his heavy, guttural moan",
      "a mournful groan caught deep in his chest",
      "his ragged, suffering moan",
      "a low, resonant groan echoing faintly",
      "his deep, sorrowful groan",
    ],
    sound_moan_direct: [
      "his heavy, guttural moan",
      "a low, shuddering moan from his chest",
      "his mournful, ragged groan",
      "a deep, hollow groan from him",
    ],
    location: [
      "in the dark",
      "across the cellar floor",
      "against the wet walls",
      "in the damp air",
      "from the black shadows",
    ],
    location_front: [
      "in the darkness",
      "across the cellar floor",
      "through the cold air",
      "from across the room",
    ],
  },
  slurred_speech: {
    origin: [
      "#perception_speech# #sound_speech#.",
      "#speech_direct# reaches me through the dark.",
      "he tries to speak to me, #struggle#.",
    ],
    perception_speech: [
      "I hear",
      "I catch",
      "my ears strain to hear",
      "I listen as",
    ],
    sound_speech: [
      "his thick, slurred murmur as he struggles to form a word",
      "a heavy, slurred stammer caught in his throat",
      "a clumsy, slurred rumble spilling from his lips",
      "him mutter a broken, slurred cadence that dissolves into a rasp",
      "a broken syllable trembling from his lips, clumsy and thick",
    ],
    speech_direct: [
      "his thick, slurred murmur",
      "a clumsy, broken stammer from him",
      "his garbled, struggling voice",
      "a heavy, slurred rasp",
    ],
    struggle: [
      "but only a clumsy, wet sound spills out",
      "fumbling in the dark with broken syllables",
      "his heavy tongue shaping only a ragged murmur",
      "dissolving into a breathless rasp",
    ],
  },
  excitement: {
    origin: [
      "#perception_excite# #sound_excite#.",
      "#sound_excite_direct# reaches me in the dark.",
      "his breathing quickens with sudden eagerness, #excite_detail#.",
    ],
    perception_excite: [
      "I hear",
      "I catch",
      "through the gloom comes",
    ],
    sound_excite: [
      "a sharp, eager rasp as he shifts his weight in sudden excitement",
      "an excited, ragged gasp as his heavy hands twitch",
      "his breathless, hurried panting in the shadows",
      "an eager shudder run through his breathing",
      "a sudden, quickened rasp as he recognizes what to do",
    ],
    sound_excite_direct: [
      "an excited, ragged gasp from him",
      "his breathless, hurried panting",
      "an eager shudder in his breath",
    ],
    excite_detail: [
      "warming the cold cellar air",
      "his heavy chest heaving with anticipation",
      "his massive frame trembling with purpose",
    ],
  },
  screaming: {
    origin: [
      "#sound_scream_direct# #scream_impact#.",
      "#perception_scream# #sound_scream_mid# #location_scream#.",
    ],
    perception_scream: [
      "I wince as",
      "my head reels as",
      "terror spikes through me as",
      "I hear",
    ],
    sound_scream_direct: [
      "his sudden, terrified scream",
      "a sharp, ragged screech tearing from him",
      "his muffled shriek of raw fear",
      "a piercing, desperate cry tearing from his throat",
      "his agonized, wild shriek",
    ],
    sound_scream_mid: [
      "his sudden, terrified scream",
      "a sharp, ragged screech tearing from him",
      "his muffled shriek of raw fear",
      "a piercing, desperate cry",
      "his wild shriek",
    ],
    scream_impact: [
      "echoes off the cellar walls, piercing my ears",
      "cuts violently through the black silence",
      "shakes the stone floor beneath my chest",
      "rebounds off the damp masonry right above me",
      "batters my ears, wild and terrified",
    ],
    location_scream: [
      "fills the cellar",
      "slices through the dark",
      "rips through the silence",
    ],
  },
  effort: {
    origin: [
      "#perception_effort# #sound_effort# #location_effort#.",
      "#sound_effort_direct# #effort_impact#.",
      "#location_front#, #perception_effort# #sound_effort#.",
    ],
    perception_effort: [
      "I hear",
      "I listen to",
      "I feel the cold stone tremble as I hear",
    ],
    sound_effort: [
      "his deep, straining grunt under the heavy weight",
      "his harsh, laboring breath as muscle strains against bone",
      "a low, ragged heave of raw exertion from him",
      "his teeth grinding together in massive exertion",
      "his strained, breathy grunt of immense physical effort",
    ],
    sound_effort_direct: [
      "his deep, straining grunt",
      "a guttural heave of raw exertion from his chest",
      "his harsh, laboring breath",
      "a ragged groan of immense physical strength",
    ],
    effort_impact: [
      "echoes heavily across the cellar floor",
      "shudders through the damp air beside me",
      "strains the cold air around us",
    ],
    location_effort: [
      "in the dark",
      "beside me",
      "against the heavy resistance",
      "in the gloom",
    ],
    location_front: [
      "in the darkness",
      "beside me",
      "through the gloom",
    ],
  },
  relief: {
    origin: [
      "#perception_relief# #sound_relief# #location_relief#.",
      "#sound_relief_direct# #relief_impact#.",
      "#location_front#, #perception_relief# #sound_relief#.",
    ],
    perception_relief: [
      "I hear",
      "I catch",
      "warmth returns to my chest as I hear",
    ],
    sound_relief: [
      "his long, shuddering sigh of relief",
      "his soft, quivering exhale",
      "a quiet, trembling release of breath from him",
      "his gentle, tremulous sigh",
      "his breathing steady and soften with relief",
    ],
    sound_relief_direct: [
      "his long, shuddering sigh of relief",
      "a soft, quivering exhale from him",
      "his gentle, tremulous sigh",
      "a deep, unburdened breath from his chest",
    ],
    relief_impact: [
      "washes into the silence",
      "settles into the cold quiet beside me",
      "eases the suffocating tension in the room",
      "tells me his panic has subsided",
    ],
    location_relief: [
      "in the damp cold",
      "from the shadows",
      "into the silence",
      "beside me",
    ],
    location_front: [
      "in the damp chill",
      "from the shadows",
      "beside me",
    ],
  },
  anger: {
    origin: [
      "#perception_anger# #sound_anger# #location_anger#.",
      "#sound_anger_direct# #anger_impact#.",
      "#location_front#, #perception_anger# #sound_anger#.",
    ],
    perception_anger: [
      "I hear",
      "I catch",
      "a chill grips me as I hear",
    ],
    sound_anger: [
      "a low, defensive rumble vibrating in his throat",
      "his sudden, guttural growl warning me",
      "a harsh, warning rumble rising from deep in his chest",
      "a sharp, defiant snarl tearing through the damp gloom",
      "his breath turn into a harsh, bristling hiss",
    ],
    sound_anger_direct: [
      "his low, defensive rumble",
      "a fierce, defensive growl from him",
      "his harsh, warning rumble",
      "a sharp, jagged snarl from his chest",
    ],
    anger_impact: [
      "reverberates through the stone floor beneath me",
      "cuts sharply through the dark",
      "vibrates threateningly against the cellar walls",
    ],
    location_anger: [
      "in the shadows",
      "through the dark",
      "in his throat",
      "from the gloom",
    ],
    location_front: [
      "in the shadows",
      "through the darkness",
      "from the gloom",
    ],
  },
};

const grammars: Record<MonsterEmotionCategory, MicroGrammar> = {
  fear: new MicroGrammar(MONSTER_GRAMMAR_RULES.fear),
  moan: new MicroGrammar(MONSTER_GRAMMAR_RULES.moan),
  slurred_speech: new MicroGrammar(MONSTER_GRAMMAR_RULES.slurred_speech),
  excitement: new MicroGrammar(MONSTER_GRAMMAR_RULES.excitement),
  screaming: new MicroGrammar(MONSTER_GRAMMAR_RULES.screaming),
  effort: new MicroGrammar(MONSTER_GRAMMAR_RULES.effort),
  relief: new MicroGrammar(MONSTER_GRAMMAR_RULES.relief),
  anger: new MicroGrammar(MONSTER_GRAMMAR_RULES.anger),
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
  } else if (categoryOrEmotion in MONSTER_GRAMMAR_RULES) {
    cat = categoryOrEmotion as MonsterEmotionCategory;
  } else if (categoryOrEmotion in EMOTION_MAP) {
    const options = EMOTION_MAP[categoryOrEmotion as Emotion];
    cat = options[Math.floor(Math.random() * options.length)];
  } else {
    cat = "moan";
  }

  const grammar = grammars[cat];
  const text = grammar.expand("#origin#");
  const cues = MONSTER_VOCAL_CUES[cat];
  const cue = cues[Math.floor(Math.random() * cues.length)];

  return { category: cat, text, cue };
}

export function resetMonsterResponseIndices(): void {
  for (const g of Object.values(grammars)) {
    g.reset();
  }
}
