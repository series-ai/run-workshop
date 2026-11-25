/**
 * @file contracts.ts
 * Tactical bounty contracts and mission system for Stick Zone.
 */

export interface Contract {
  id: string;
  title: string;
  codename: string;
  description: string;
  targetCount: number;
  currentCount: number;
  rewardCash: number;
  rewardXp: number;
  rewardItemName?: string;
  completed: boolean;
  claimed: boolean;
  type: "kills" | "boss" | "extract_cash" | "crates" | "clean_exfil" | "keycard";
}

export const INITIAL_CONTRACTS: Contract[] = [
  {
    id: "contract_scav_purge",
    title: "SECTOR CLEARANCE",
    codename: "OP // SWEEP",
    description: "Eliminate 3 Scav hostiles inside Sector 7 Depot.",
    targetCount: 3,
    currentCount: 0,
    rewardCash: 3500,
    rewardXp: 500,
    rewardItemName: "M855A1 AP Ammo Pack",
    completed: false,
    claimed: false,
    type: "kills",
  },
  {
    id: "contract_boss_headhunt",
    title: "WARLORD TERMINATION",
    codename: "OP // APEX",
    description: "Neutralize Sector Warlord Boss and secure the extraction perimeter.",
    targetCount: 1,
    currentCount: 0,
    rewardCash: 9500,
    rewardXp: 1500,
    rewardItemName: "Violet Lab Access Keycard",
    completed: false,
    claimed: false,
    type: "boss",
  },
  {
    id: "contract_high_value_exfil",
    title: "SMUGGLER'S RUN",
    codename: "OP // EXTRACT",
    description: "Successfully extract with at least $4,000 in uncommitted loot.",
    targetCount: 4000,
    currentCount: 0,
    rewardCash: 4000,
    rewardXp: 600,
    rewardItemName: "Propital Combat Stim",
    completed: false,
    claimed: false,
    type: "extract_cash",
  },
];

export function updateContractProgress(
  contracts: Contract[],
  event: {
    type: "kill" | "boss_kill" | "crate_looted" | "exfil";
    cashExtracted?: number;
    hasKeycard?: boolean;
    hadBleed?: boolean;
  }
): Contract[] {
  return contracts.map((c) => {
    if (c.completed) return c;
    let newCount = c.currentCount;

    if (event.type === "kill" && c.type === "kills") {
      newCount += 1;
    } else if (event.type === "boss_kill" && (c.type === "boss" || c.type === "kills")) {
      newCount += 1;
    } else if (event.type === "crate_looted" && c.type === "crates") {
      newCount += 1;
    } else if (event.type === "exfil") {
      if (c.type === "extract_cash" && (event.cashExtracted ?? 0) >= c.targetCount) {
        newCount = c.targetCount;
      }
      if (c.type === "keycard" && event.hasKeycard) {
        newCount = 1;
      }
      if (c.type === "clean_exfil" && !event.hadBleed) {
        newCount = 1;
      }
    }

    const isDone = newCount >= c.targetCount;
    return {
      ...c,
      currentCount: Math.min(newCount, c.targetCount),
      completed: isDone,
    };
  });
}
