export const WAITING_SET_1 = [
  "Your voice echoes in the darkness",
  "Your throat is coarse",
  "The words scrape against your dry lips",
  "Your breath leaves a cold mist against the stone",
  "A hollow rasp catches in your throat",
  "The damp cellar air swallows your call",
  "Your whisper trembles across the dark",
  "Pain flares along your ribs as you speak",
  "Your voice sounds faint even to your own ears",
  "The stone drinks the sound of your voice",
  "You force the words past your cracked lips",
  "The cold stone muffles your call",
  "A trembling rasp leaves your chest",
  "Your words hang frozen in the chill",
  "Your chest burns with the effort to speak",
] as const;

export const WAITING_SET_2 = [
  "Silence presses back against your chest.",
  "The cold creeps deeper into your fingertips.",
  "A dull throb pulses behind your eyes.",
  "Warm blood seeps slowly through your clothes.",
  "The darkness stays thick and suffocating.",
  "Your ribs groan beneath the oak cabinet.",
  "Every heartbeat feels heavier than the last.",
  "You strain to hear movement in the gloom.",
  "The cellar floor drains the warmth from your skin.",
  "A slow shudder rattles down your spine.",
  "The shadows offer no answer yet.",
  "Your breath comes shallow and tight.",
  "Numbness crawls along your wounded flank.",
  "The damp stone bites into your forehead.",
  "Dust settles slowly in the black air.",
] as const;

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
  private recentFirst: number[] = [];
  private recentSecond: number[] = [];
  private readonly maxHistory = 4;

  pick(): WaitingThought {
    // Pick first thought avoiding recently used
    const eligibleFirst: number[] = [];
    for (let i = 0; i < WAITING_SET_1.length; i++) {
      if (!this.recentFirst.includes(i)) eligibleFirst.push(i);
    }
    const idx1 =
      eligibleFirst.length > 0
        ? eligibleFirst[Math.floor(Math.random() * eligibleFirst.length)]
        : Math.floor(Math.random() * WAITING_SET_1.length);

    const first = WAITING_SET_1[idx1];

    // Pick second thought avoiding recently used and keyword collision
    const eligibleSecond: number[] = [];
    for (let i = 0; i < WAITING_SET_2.length; i++) {
      if (
        !this.recentSecond.includes(i) &&
        !hasKeywordCollision(first, WAITING_SET_2[i])
      ) {
        eligibleSecond.push(i);
      }
    }
    const idx2 =
      eligibleSecond.length > 0
        ? eligibleSecond[Math.floor(Math.random() * eligibleSecond.length)]
        : (idx1 + 1) % WAITING_SET_2.length;

    const second = WAITING_SET_2[idx2];

    // Update history
    this.recentFirst.push(idx1);
    if (this.recentFirst.length > this.maxHistory) this.recentFirst.shift();
    this.recentSecond.push(idx2);
    if (this.recentSecond.length > this.maxHistory) this.recentSecond.shift();

    // Uses ellipsis with pause marker to slow down before revealing the second thought
    const full = `${first}...{{pause(1.3)}} ${second}`;

    return { first, second, full };
  }

  reset(): void {
    this.recentFirst = [];
    this.recentSecond = [];
  }
}

export const defaultWaitingPicker = new WaitingThoughtPicker();
