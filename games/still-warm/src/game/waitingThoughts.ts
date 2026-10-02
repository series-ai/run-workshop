import type { GameState } from "./model";
import type { TempoTracker } from "./tempo";

export interface WaitingItem {
  id: string;
  text: string;
  available?: (state?: GameState) => boolean;
}

// Waiting thought items for the first sentence
export const WAITING_ITEMS_1: readonly WaitingItem[] = [
  {
    id: "chest_heavy",
    text: "The heavy timber presses against my ribs... cold stone under my cheek.",
    available: (state) => !state || state.stage === "pinned",
  },
  {
    id: "stone_floor",
    text: "Cold flagstones press against my face... I cannot see his hands in the dark.",
    available: (state) => !state || state.posture === "prone",
  },
  {
    id: "air_cold",
    text: "Cold cellar air stings the raw wound... dark shadows move above me.",
    available: (state) => !state || state.stage !== "pinned",
  },
  {
    id: "shadows_move",
    text: "Shadows flicker along the damp stone wall... somewhere water drips.",
  },
  {
    id: "breath_shallow",
    text: "Every breath is shallow and sharp... my ribs burn with each rasp.",
  },
  {
    id: "throat_dry",
    text: "My throat rasps like dry paper... the cellar smells of damp earth.",
  },
  {
    id: "blood_warm",
    text: "A warm trickle spreads along my side... the iron fragment bites deep.",
    available: (state) =>
      !state || state.stage === "exposed" || state.stage === "extracted",
  },
  {
    id: "dark_deep",
    text: "The gloom is thick... I strain to hear where his heavy boots shuffle.",
  },
  {
    id: "supine_ceiling",
    text: "Rotting beams crisscross the cellar ceiling... shadows hang heavy.",
    available: (state) => !state || state.posture === "supine",
  },
  {
    id: "supine_breath",
    text: "Looking up into the dark... my chest rises against the cold.",
    available: (state) => !state || state.posture === "supine",
  },
] as const satisfies readonly {
  id: string;
  text: string;
  available?: (state?: GameState) => boolean;
}[];

// Waiting thought items for the second sentence
export const WAITING_ITEMS_2: readonly WaitingItem[] = [
  {
    id: "listen_close",
    text: "I listen for the shuffle of his heavy boots across the floor.",
  },
  {
    id: "feel_weight",
    text: "The crushing weight of oak timber holds me fast against the wet stone.",
    available: (state) => !state || state.stage === "pinned",
  },
  {
    id: "straining_dark",
    text: "Straining into the blackness, waiting for him to find the nerve.",
  },
  {
    id: "heart_pounds",
    text: "My heart beats a ragged rhythm against the damp cellar flagstones.",
  },
  {
    id: "cold_draft",
    text: "A draft creeps beneath the barricaded door, carrying the scent of rain.",
  },
  {
    id: "shudder_wait",
    text: "I shudder as the silence stretches between us, thick as cellar dust.",
  },
  {
    id: "fog_breath",
    text: "My breath leaves a cold mist against the stone, fading into nothing.",
    available: (state) => !state || state.posture === "prone",
  },
  {
    id: "supine_rafters",
    text: "Webs drift from the rafters overhead in the cold draft.",
    available: (state) => !state || state.posture === "supine",
  },
  {
    id: "supine_shadows",
    text: "I look up, straining to see his hands in the gloom.",
    available: (state) => !state || state.posture === "supine",
  },
] as const;

// Stage-specific somatic guidance thoughts prioritized at Peak tempo (Turns 3-4)
export const STAGE_SOMATIC_PEAK_THOUGHTS: Record<string, readonly string[]> = {
  pinned: [
    "The oak timber groans against my spine... I feel his presence hovering right beside the weight, terrified to move without me.",
    "His heavy boots scrape the stone inches from my face... he has the strength to heave this wood, but fear has paralyzed him.",
    "My lungs burn under the crushing oak... his hands are shuddering near the beam, waiting for my voice.",
  ],
  covered: [
    "The crushing weight is gone, but the stone floor is suffocating my mouth... I need to be turned over before I choke.",
    "My cheek scrapes the dirt; I cannot see where he stands until he rolls me onto my back.",
  ],
  exposed: [
    "Every breath drives the jagged iron deeper into my ribs... the instrument tray is within his reach if he would only turn to it.",
    "The cold steel forceps lie on the tray beside us... the fragment must be pulled before I bleed out.",
  ],
  extracted: [
    "Warm blood is spreading across my ribs... the linen cloth or clean bandage in the cupboard must be pressed against it.",
    "Dark blood pools on the stone beneath my side... I need pressure on the wound before my strength fails.",
  ],
  closed: [
    "The stitches hold against the raw air... the dressing must be bound tightly over the cut.",
    "The bitter cellar damp bites into the fresh suture... it needs clean linen bound across it.",
  ],
};

export const ACTION_INTENT_THOUGHTS = {
  stand_pinned: [
    "I strain to push my palms against the flagstones, but white-hot agony flares through my spine... the heavy oak pins me flat. I cannot rise.",
    "I claw at the stone trying to heave myself up, but the crushing cabinet drives the breath from my lungs... I cannot stand.",
  ],
  stand_unpinned: [
    "I try to push my hands against the floor, but blinding agony spikes through my flank... my legs are dead weight beneath me. I cannot stand.",
    "I attempt to pull myself upright, but the jagged iron tears deeper into my ribs... agony collapses me back onto the cold stone, unable to stand.",
  ],
  push_cabinet_pinned: [
    "I brace my palms against the fallen oak and shove with all my remaining strength, but it won't budge an inch... my boy must heave this weight off me.",
    "I try to push the splintered timber off my spine, but the iron-bound weight is too massive... only his strength can move it.",
  ],
  push_cabinet_unpinned: [
    "The heavy oak cabinet has already been heaved aside into the gloom... the crushing weight is off me.",
  ],
  roll_pinned: [
    "I try to wrench my hips and turn onto my back, but the oak cabinet pins me flat against the flagstones... it must be lifted off first.",
    "I twist against the floor to turn over, but the crushing cabinet holds my shoulders fast... the heavy oak has to come off first.",
  ],
  roll_prone: [
    "I try to draw my knees up and roll over, but the iron shard in my flank bites deep into my ribs... he has to roll me gently.",
    "Every attempt to roll myself over tears at the jagged wound... my boy must turn me onto my back.",
  ],
  roll_supine: [
    "I am already turned onto my back, staring up into the damp cellar gloom.",
  ],
};

export function isStandAttempt(input?: string): boolean {
  if (!input) return false;
  return /\b(i\s+)?(try\s+to\s+)?(stand(\s+up)?|get\s+up|rise|walk|get\s+on\s+my\s+feet)\b/i.test(
    input.trim(),
  );
}

export function isPushCabinetAttempt(input?: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return (
    /\b(i\s+)?(push|shove|heave|move|lift)\s+(off\s+)?(the\s+)?(cabinet|debris|beam|timber|wood|furniture|weight)(\s+off(\s+me)?)?\b/i.test(
      trimmed,
    ) ||
    /\b(push|shove|heave|get)\s+(it|this)\s+off(\s+me)?\b/i.test(trimmed)
  );
}

export function isRollAttempt(input?: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return /\b(i\s+)?(try\s+to\s+)?(roll(\s+me)?\s+over|turn(\s+me)?\s+over|roll(\s+me)?\s+onto\s+my\s+back|turn(\s+me)?\s+onto\s+my\s+back|flip(\s+me)?\s+over)\b/i.test(
    trimmed,
  );
}

export const WAITING_SET_1 = WAITING_ITEMS_1.map((i) => i.text);
export const WAITING_SET_2 = WAITING_ITEMS_2.map((i) => i.text);

// Key words to prevent any accidental semantic repetition between Set 1 and Set 2
const KEYWORD_GROUPS: Record<string, string[]> = {
  throat: ["throat", "rasp"],
  chest: ["chest", "ribs", "lungs"],
  stone: ["stone", "floor"],
  dark: ["dark", "shadows", "darkness"],
  breath: ["breath", "mist"],
};

function hasKeywordCollision(first: string, second: string): boolean {
  const fLower = first.toLowerCase();
  const sLower = second.toLowerCase();
  for (const words of Object.values(KEYWORD_GROUPS)) {
    const fHas = words.some((w) => fLower.includes(w));
    const sHas = words.some((w) => sLower.includes(w));
    if (fHas && sHas) return true;
  }
  return false;
}

function formatThoughtWithPause(thought: string): WaitingThought {
  const formatted = thought.includes("{{pause")
    ? thought
    : thought.replace(/\\.\\.\\./g, "...{{pause(2.2)}} ") + ".{{pause(2.5)}}";
  return {
    first: thought.split("...")[0] || thought,
    second: thought.split("...")[1] || "",
    full: formatted,
  };
}

export interface WaitingThought {
  first: string;
  second: string;
  full: string;
}

export class WaitingThoughtPicker {
  private recentFirst: string[] = [];
  private recentSecond: string[] = [];
  private readonly maxHistory = 4;

  pick(
    state?: GameState,
    tempo?: TempoTracker,
    playerInput?: string,
  ): WaitingThought {
    // 1. Direct player physical action intent matching
    if (playerInput) {
      if (isStandAttempt(playerInput)) {
        const pool =
          state?.stage === "pinned"
            ? ACTION_INTENT_THOUGHTS.stand_pinned
            : ACTION_INTENT_THOUGHTS.stand_unpinned;
        return formatThoughtWithPause(
          pool[Math.floor(Math.random() * pool.length)],
        );
      }
      if (isPushCabinetAttempt(playerInput)) {
        const pool =
          state?.stage === "pinned"
            ? ACTION_INTENT_THOUGHTS.push_cabinet_pinned
            : ACTION_INTENT_THOUGHTS.push_cabinet_unpinned;
        return formatThoughtWithPause(
          pool[Math.floor(Math.random() * pool.length)],
        );
      }
      if (isRollAttempt(playerInput)) {
        const pool =
          state?.stage === "pinned"
            ? ACTION_INTENT_THOUGHTS.roll_pinned
            : state?.posture === "prone"
              ? ACTION_INTENT_THOUGHTS.roll_prone
              : ACTION_INTENT_THOUGHTS.roll_supine;
        return formatThoughtWithPause(
          pool[Math.floor(Math.random() * pool.length)],
        );
      }
    }

    // 2. If tempo is at peak and stage matches, deliver somatic realization
    if (tempo && tempo.state === "peak" && state?.stage) {
      const peakPool = STAGE_SOMATIC_PEAK_THOUGHTS[state.stage];
      if (peakPool && peakPool.length > 0) {
        const fullThought =
          peakPool[Math.floor(Math.random() * peakPool.length)];
        return formatThoughtWithPause(fullThought);
      }
    }

    // 3. Filter available items based on current game state
    const pool1 = WAITING_ITEMS_1.filter((item) =>
      item.available ? item.available(state) : true,
    ).map((i) => i.text);

    const eligibleFirst = pool1.filter((t) => !this.recentFirst.includes(t));
    const first =
      eligibleFirst.length > 0
        ? eligibleFirst[Math.floor(Math.random() * eligibleFirst.length)]
        : pool1[Math.floor(Math.random() * pool1.length)];

    const pool2 = WAITING_ITEMS_2.filter((item) =>
      item.available ? item.available(state) : true,
    ).map((i) => i.text);

    const eligibleSecond = pool2.filter(
      (t) => !this.recentSecond.includes(t) && !hasKeywordCollision(first, t),
    );
    const second =
      eligibleSecond.length > 0
        ? eligibleSecond[Math.floor(Math.random() * eligibleSecond.length)]
        : pool2[0];

    // Update history
    this.recentFirst.push(first);
    if (this.recentFirst.length > this.maxHistory) this.recentFirst.shift();
    this.recentSecond.push(second);
    if (this.recentSecond.length > this.maxHistory) this.recentSecond.shift();

    // Trailing pauses act as buffers:
    // Line 1 ends with ellipsis and 2.2s buffer pause.
    // Line 2 ends with period/ellipsis and 2.5s buffer pause.
    const cleanFirst = first.replace(/\.+$/, "");
    const cleanSecond = second.replace(/\.+$/, "");
    const full = `${cleanFirst}...{{pause(2.2)}} ${cleanSecond}.{{pause(2.5)}}`;

    return { first, second, full };
  }

  reset(): void {
    this.recentFirst = [];
    this.recentSecond = [];
  }
}

export const defaultWaitingPicker = new WaitingThoughtPicker();
