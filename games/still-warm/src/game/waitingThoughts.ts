import type { GameState } from "./model";

export interface ConditionalThought {
  text: string;
  // If predicate is provided, only available when it returns true
  available?: (state?: GameState) => boolean;
}

export const WAITING_ITEMS_1: readonly ConditionalThought[] = [
  { text: "My voice echoes in the darkness" },
  { text: "My throat is coarse" },
  { text: "The words scrape against my dry lips" },
  {
    text: "My breath leaves a cold mist against the stone",
    available: (state) => !state || state.posture === "prone",
  },
  { text: "A hollow rasp catches in my throat" },
  { text: "The damp cellar air swallows my call" },
  { text: "My whisper trembles across the dark" },
  { text: "Pain flares along my ribs as I speak" },
  { text: "My voice sounds faint even to my own ears" },
  { text: "The stone drinks the sound of my voice" },
  { text: "I force the words past my cracked lips" },
  {
    text: "The cold stone muffles my call",
    available: (state) => !state || state.posture === "prone",
  },
  { text: "A trembling rasp leaves my chest" },
  { text: "My words hang frozen in the chill" },
  { text: "My chest burns with the effort to speak" },
  {
    text: "My voice rises toward the black cellar ceiling",
    available: (state) => !state || state.posture === "supine",
  },
  {
    text: "I call out into the empty air above me",
    available: (state) => !state || state.posture === "supine",
  },
] as const;

export const WAITING_ITEMS_2: readonly ConditionalThought[] = [
  { text: "Silence presses back against my chest." },
  { text: "The cold creeps deeper into my fingertips." },
  { text: "A dull throb pulses behind my eyes." },
  { text: "Warm blood seeps slowly through my clothes." },
  { text: "The darkness stays thick and suffocating." },
  {
    text: "My ribs groan beneath the oak cabinet.",
    available: (state) => !state || state.stage === "pinned",
  },
  { text: "Every heartbeat feels heavier than the last." },
  { text: "I strain to hear movement in the gloom." },
  {
    text: "The cellar floor drains the warmth from my skin.",
    available: (state) => !state || state.posture === "prone",
  },
  { text: "A slow shudder rattles down my spine." },
  { text: "The shadows offer no answer yet." },
  { text: "My breath comes shallow and tight." },
  { text: "Numbness crawls along my wounded flank." },
  {
    text: "The damp stone bites into my forehead.",
    available: (state) => !state || state.posture === "prone",
  },
  { text: "Dust settles slowly in the black air." },
  // Freed prone (cabinet off, but still face down)
  {
    text: "The crushing weight is gone, but my cheek is still pressed against the stones.",
    available: (state) => !state || (state.stage !== "pinned" && state.posture === "prone"),
  },
  {
    text: "I can see the cold mortar and flagstones right in front of my eyes.",
    available: (state) => !state || (state.stage !== "pinned" && state.posture === "prone"),
  },
  // Supine (flipped over) specific continuations
  {
    text: "The damp cellar ceiling looms in the shadows above.",
    available: (state) => !state || state.posture === "supine",
  },
  {
    text: "I stare upward into the black rafters.",
    available: (state) => !state || state.posture === "supine",
  },
  {
    text: "My exposed wound burns in the raw air.",
    available: (state) => !state || state.posture === "supine",
  },
  {
    text: "I look up, straining to see his hands in the gloom.",
    available: (state) => !state || state.posture === "supine",
  },
] as const;

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

export interface WaitingThought {
  first: string;
  second: string;
  full: string;
}

export class WaitingThoughtPicker {
  private recentFirst: string[] = [];
  private recentSecond: string[] = [];
  private readonly maxHistory = 4;

  pick(state?: GameState): WaitingThought {
    // Filter available items based on current game state
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
