import { z } from "zod";

export const ITEM_IDS = [
  "forceps",
  "cloth",
  "needle",
  "morphine",
  "scalpel",
  "mirror",
  "lamp",
  "shard",
  "release",
  "scissors",
  "wig",
  "thread",
  "blade",
  "suture",
  "bandage",
  "bowl",
  "blanket",
  "candle",
] as const;
export const LOCATIONS = [
  "tray",
  "cabinet",
  "hand",
  "patient",
  "stand",
  "pillow",
  "floor",
  "consumed",
] as const;
export const RULE_IDS = [
  "announce",
  "noSharp",
  "noMedicine",
  "gentle",
  "waitBlackout",
] as const;
export const STAGES = [
  "pinned",
  "covered",
  "exposed",
  "extracted",
  "closed",
  "dressed",
] as const;
export type ItemId = (typeof ITEM_IDS)[number];
export type Location = (typeof LOCATIONS)[number];
export type RuleId = (typeof RULE_IDS)[number];
export type Stage = (typeof STAGES)[number];
export type Phase = "ready" | "playing" | "blackout" | "won" | "lost";
export type Outcome =
  | "saved"
  | "blood_loss"
  | "fire"
  | "creature_lost";
export const EMOTIONS = [
  "scared",
  "anxious",
  "angry",
  "sad",
  "happy",
  "focused",
] as const;
export const STIMULI = [
  "reassure",
  "praise",
  "insult",
  "threaten",
  "apologize",
  "clear_instruction",
  "cry_pain",
  "silence",
  "abandon",
] as const;
export type Emotion = (typeof EMOTIONS)[number];
export type Stimulus = (typeof STIMULI)[number];
export type Material =
  "metal" | "fabric" | "hair" | "glass" | "medicine" | "wax";
export type Capability =
  | "cut"
  | "grip"
  | "absorb"
  | "reflect"
  | "sew"
  | "pry"
  | "sedate"
  | "smother"
  | "light"
  | "contain";

export const CATALOG: Record<
  ItemId,
  {
    name: string;
    sharp: boolean;
    initial: Location;
    material: Material;
    capabilities: readonly Capability[];
  }
> = {
  forceps: {
    name: "Forceps",
    sharp: false,
    initial: "tray",
    material: "metal",
    capabilities: ["grip", "pry"],
  },
  cloth: {
    name: "Clean cloth",
    sharp: false,
    initial: "cabinet",
    material: "fabric",
    capabilities: ["absorb", "smother"],
  },
  needle: {
    name: "Suture needle",
    sharp: true,
    initial: "tray",
    material: "metal",
    capabilities: ["sew"],
  },
  morphine: {
    name: "Morphine",
    sharp: false,
    initial: "cabinet",
    material: "medicine",
    capabilities: ["sedate"],
  },
  scalpel: {
    name: "Scalpel",
    sharp: true,
    initial: "tray",
    material: "metal",
    capabilities: ["cut", "pry"],
  },
  mirror: {
    name: "Hand mirror",
    sharp: false,
    initial: "cabinet",
    material: "glass",
    capabilities: ["reflect"],
  },
  lamp: {
    name: "Examination lamp",
    sharp: false,
    initial: "stand",
    material: "metal",
    capabilities: ["light"],
  },
  shard: {
    name: "Metal fragment",
    sharp: true,
    initial: "patient",
    material: "metal",
    capabilities: ["cut", "pry"],
  },
  release: {
    name: "Leg brace catch",
    sharp: false,
    initial: "tray",
    material: "metal",
    capabilities: ["pry"],
  },
  scissors: {
    name: "Scissors",
    sharp: true,
    initial: "tray",
    material: "metal",
    capabilities: ["cut", "pry"],
  },
  wig: {
    name: "Hairpiece",
    sharp: false,
    initial: "cabinet",
    material: "hair",
    capabilities: ["smother"],
  },
  thread: {
    name: "Hair thread",
    sharp: false,
    initial: "consumed",
    material: "hair",
    capabilities: ["sew"],
  },
  blade: {
    name: "Broken scissor blade",
    sharp: true,
    initial: "consumed",
    material: "metal",
    capabilities: ["cut", "pry"],
  },
  suture: {
    name: "Threaded needle",
    sharp: true,
    initial: "consumed",
    material: "metal",
    capabilities: ["sew"],
  },
  bandage: {
    name: "Cut bandage",
    sharp: false,
    initial: "consumed",
    material: "fabric",
    capabilities: ["absorb", "smother"],
  },
  bowl: {
    name: "Water bowl",
    sharp: false,
    initial: "cabinet",
    material: "metal",
    capabilities: ["contain", "smother", "reflect"],
  },
  blanket: {
    name: "Wool blanket",
    sharp: false,
    initial: "pillow",
    material: "fabric",
    capabilities: ["absorb", "smother"],
  },
  candle: {
    name: "Candle",
    sharp: false,
    initial: "stand",
    material: "wax",
    capabilities: ["light"],
  },
};

export const RULES: Record<RuleId, { label: string; instruction: string }> = {
  announce: {
    label: "Explain before contact",
    instruction: "Announce each patient contact before starting it.",
  },
  noSharp: {
    label: "No sharp tools",
    instruction: "Do not pick up or use a sharp tool.",
  },
  noMedicine: { label: "No medication", instruction: "Do not use morphine." },
  gentle: {
    label: "Gentle hands",
    instruction: "Use gentle movements for every patient contact.",
  },
  waitBlackout: {
    label: "Wait if I pass out",
    instruction:
      "Do not start or complete patient contact while I am unconscious.",
  },
};

const item = z.enum(ITEM_IDS);
const location = z.enum(LOCATIONS);
export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("light_lantern") }),
  z.object({
    kind: z.literal("lift_debris"),
    style: z.enum(["gentle", "rough"]),
  }),
  z.object({ kind: z.literal("pick_up"), item }),
  z.object({
    kind: z.literal("place"),
    item,
    location: location.exclude(["hand", "consumed"]),
  }),
  z.object({
    kind: z.literal("use"),
    item,
    target: z.enum([
      "wound",
      "patient",
      "pillow",
      "creature",
      "fire",
      "door",
      "wig",
      "cloth",
      "blanket",
      "thread",
      "scissors",
      "lamp",
      "bowl",
    ]),
    style: z.enum(["gentle", "rough"]),
  }),
  z.object({ kind: z.literal("combine"), first: item, second: item }),
  z.object({ kind: z.literal("break"), item }),
  z.object({
    kind: z.literal("adjust_lamp"),
    position: z.enum(["wound", "face", "away"]),
  }),
  z.object({
    kind: z.literal("set_rule"),
    rule: z.enum(RULE_IDS),
    enabled: z.boolean(),
  }),
  z.object({
    kind: z.literal("remember"),
    note: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("speak"),
    text: z.string().trim().min(1).max(240),
  }),
  z.object({ kind: z.literal("react"), stimulus: z.enum(STIMULI) }),
]);
export type GameAction = z.infer<typeof actionSchema>;
export type PhysicalAction = Exclude<
  GameAction,
  { kind: "speak" | "remember" | "set_rule" | "react" }
>;

export interface ItemState {
  location: Location;
  clean: boolean;
}
export interface PatientState {
  health: number;
  pain: number;
  sedation: number;
  blood: number;
  blackoutRemaining: number;
  blackoutCount: number;
}
export interface JournalEntry {
  id: number;
  time: number;
  kind: "patient" | "creature" | "action" | "system";
  text: string;
}
export interface PendingAction {
  id: number;
  action: PhysicalAction;
  label: string;
  progress: number;
}
export interface GameState {
  phase: Phase;
  outcome: Outcome | null;
  paused: boolean;
  elapsed: number;
  stage: Stage;
  patient: PatientState;
  items: Record<ItemId, ItemState>;
  holding: ItemId | null;
  lamp: "wound" | "face" | "away";
  restrained: boolean;
  rules: Record<RuleId, boolean>;
  notes: string[];
  journal: JournalEntry[];
  pending: PendingAction | null;
  announced: boolean;
  contactCount: number;
  emotion: Emotion;
  disposition: { trust: number; agitation: number; confidence: number };
  creatureHealth: number;
  medicineDoses: number;
  environment: {
    lanternLit: boolean;
    fire: number;
    fireStarted: boolean;
    door: "quiet" | "knocking" | "barricaded";
    doorPressure: number;
    eventCount: number;
    nextEventAt: number;
    lastEvent: string;
  };
}

export type ActionResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

export function createInitialState(): GameState {
  const items = Object.fromEntries(
    ITEM_IDS.map((id) => [id, { location: CATALOG[id].initial, clean: true }]),
  ) as Record<ItemId, ItemState>;
  return {
    phase: "ready",
    outcome: null,
    paused: false,
    elapsed: 0,
    stage: "pinned",
    patient: {
      health: 86,
      pain: 36,
      sedation: 0,
      blood: 94,
      blackoutRemaining: 0,
      blackoutCount: 0,
    },
    items,
    holding: null,
    lamp: "away",
    restrained: true,
    rules: {
      announce: true,
      noSharp: false,
      noMedicine: false,
      gentle: false,
      waitBlackout: false,
    },
    notes: [],
    journal: [],
    pending: null,
    announced: false,
    contactCount: 0,
    emotion: "scared",
    disposition: { trust: 42, agitation: 48, confidence: 18 },
    creatureHealth: 100,
    medicineDoses: 3,
    environment: {
      lanternLit: false,
      fire: 0,
      fireStarted: false,
      door: "quiet",
      doorPressure: 0,
      eventCount: 0,
      nextEventAt: 75,
      lastEvent: "",
    },
  };
}

export function appendJournal(
  state: GameState,
  kind: JournalEntry["kind"],
  text: string,
): GameState {
  const id = (state.journal.at(-1)?.id ?? 0) + 1;
  return {
    ...state,
    journal: [...state.journal, { id, kind, text, time: state.elapsed }].slice(
      -100,
    ),
  };
}

export function isActive(state: GameState): boolean {
  return (
    !state.paused && (state.phase === "playing" || state.phase === "blackout")
  );
}

export function actionLabel(action: PhysicalAction): string {
  switch (action.kind) {
    case "light_lantern":
      return "Lighting the workbench lantern";
    case "lift_debris":
      return `${action.style === "rough" ? "Dragging" : "Carefully lifting"} the fallen ceiling support`;
    case "pick_up":
      return `Reaching for ${CATALOG[action.item].name.toLowerCase()}`;
    case "place":
      return `Moving ${CATALOG[action.item].name.toLowerCase()} to ${action.location}`;
    case "use":
      return `${action.style === "rough" ? "Pressing" : "Using"} ${CATALOG[action.item].name.toLowerCase()} on ${action.target}`;
    case "adjust_lamp":
      return `Turning the lamp ${action.position === "away" ? "away" : `toward your ${action.position}`}`;
    case "combine":
      return `Combining ${CATALOG[action.first].name.toLowerCase()} and ${CATALOG[action.second].name.toLowerCase()}`;
    case "break":
      return `Taking ${CATALOG[action.item].name.toLowerCase()} apart`;
  }
}
