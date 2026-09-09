import {
  CATALOG,
  type GameAction,
  type GameState,
  type PortableItemId,
} from "./model";
import { isLiftReady } from "./transitions";

export function sceneThought(state: GameState): { id: string; text: string } {
  if (state.stage === "pinned" && !isLiftReady(state))
    return {
      id: "pinned",
      text: "He's afraid of hurting me. He needs to hear my voice.",
    };
  if (state.stage === "pinned")
    return {
      id: "lift",
      text: "I can ask him to lift the cabinet.",
    };
  if (state.posture === "prone")
    return {
      id: "roll",
      text: "The cabinet is off my back. I am still face down. He can turn me.",
    };
  if (!state.environment.lanternLit)
    return {
      id: "light",
      text: "His shoulder. His hand. My boy, in the dark. The lantern is on the workbench.",
    };
  if (state.environment.fire > 0)
    return {
      id: "fire",
      text:
        state.waterPortions > 0
          ? "Smoke. Water, or the wool blanket. Before it spreads."
          : "Smoke. He has to cover the flames. The blanket, or the metal bowl.",
    };
  if (state.patient.pain >= 62 && state.patient.sedation < 18)
    return {
      id: "pain",
      text: "I can't stay awake through another cut. He has to slow down.",
    };
  if (state.rules.noSharp && state.stage === "extracted")
    return {
      id: "rule",
      text: "I told him no sharp tools. He cannot stitch until I change that rule.",
    };
  switch (state.stage) {
    case "covered":
      return {
        id: "covered",
        text: "I am on my back. My legs won't answer. Open my shirt.",
      };
    case "exposed":
      return {
        id: "exposed",
        text: "Metal. Still inside me. The forceps could get it out.",
      };
    case "extracted":
      return {
        id: "extracted",
        text:
          state.items.suture.location !== "consumed"
            ? "The needle is ready. Close it. Before I lose more blood."
            : state.items.thread.location !== "consumed"
              ? "The thread will hold. Put it through the needle."
              : state.items.wig.location !== "consumed"
                ? "A needle, but no thread. There is hair on the workbench."
                : "No hair left. There must be thread in all this cloth.",
      };
    case "closed":
      return {
        id: "closed",
        text: "Something clean over it. Then the iron on my legs.",
      };
    case "dressed":
      return {
        id: "dressed",
        text: "The brace release. Help me up, my boy. Don't let go.",
      };
  }
}

export interface PreviewChoice {
  id: string;
  label: string;
  actions: GameAction[];
}

function emptyHand(state: GameState): GameAction[] {
  if (!state.holding) return [];
  return [
    {
      kind: "place" as const,
      item: state.holding,
      location: "tray" as const,
    },
  ];
}

function take(state: GameState, item: PortableItemId): GameAction[] {
  if (state.holding === item) return [];
  return [...emptyHand(state), { kind: "pick_up", item }];
}
function treat(
  state: GameState,
  item: PortableItemId,
  target: "wound" | "patient",
): GameAction[] {
  return [
    ...(target === "wound" && state.lamp !== "wound"
      ? [{ kind: "adjust_lamp" as const, position: "wound" as const }]
      : []),
    ...take(state, item),
    {
      kind: "signal_intent",
      contact: { kind: "use", item, target, style: "gentle" },
    },
    { kind: "use", item, target, style: "gentle" },
  ];
}

function lanternExplore(state: GameState): PreviewChoice | null {
  if (state.items.lantern.location === "consumed") return null;
  const target =
    state.creatureArea === "cabinet"
      ? "door"
      : state.creatureArea === "door"
        ? "father"
        : "cabinet";
  return {
    id: "lantern",
    label:
      target === "cabinet"
        ? "Take the lantern. Look at the cabinet."
        : target === "door"
          ? "Take the lantern. Look at the door."
          : "Take the lantern. Come back to me.",
    actions: [...take(state, "lantern"), { kind: "move_to", target }],
  };
}

function liftCabinet(state: GameState): PreviewChoice {
  return {
    id: "lift",
    label: "Lift the cabinet. Use gentle hands.",
    actions: [
      ...emptyHand(state),
      {
        kind: "signal_intent",
        contact: { kind: "lift_debris", style: "gentle" },
      },
      { kind: "lift_debris", style: "gentle" },
    ],
  };
}

function reassureBoy(): PreviewChoice {
  return {
    id: "soothe",
    label: "You are safe. I am here.",
    actions: [{ kind: "react", stimulus: "reassure" }],
  };
}

function rollOntoBack(state: GameState): PreviewChoice {
  return {
    id: "roll",
    label: "Turn me onto my back.",
    actions: [
      ...emptyHand(state),
      {
        kind: "signal_intent",
        contact: { kind: "roll_patient", style: "gentle" },
      },
      { kind: "roll_patient", style: "gentle" },
    ],
  };
}

export function previewChoices(state: GameState): PreviewChoice[] {
  if (state.stage === "pinned") {
    if (!isLiftReady(state)) return [reassureBoy()];
    return finishChoices(state, [liftCabinet(state)]);
  }
  if (state.posture === "prone")
    return finishChoices(state, [rollOntoBack(state)]);
  if (!state.environment.lanternLit)
    return [
      {
        id: "light",
        label: "Light the lantern. I am here.",
        actions: [
          { kind: "light_lantern" },
          { kind: "vocalize", cue: "relief" },
        ],
      },
    ];
  const options: PreviewChoice[] = [];
  if (state.environment.fire > 0) {
    const item =
      state.waterPortions > 0 || state.items.blanket.location === "consumed"
        ? "bowl"
        : "blanket";
    options.push({
      id: "fire",
      label:
        item === "bowl"
          ? state.waterPortions > 0
            ? "The fire. Use the water."
            : "Cover the flames with the bowl."
          : "Smother it with the blanket.",
      actions: [
        ...take(state, item),
        { kind: "use", item, target: "fire", style: "gentle" },
        { kind: "vocalize", cue: "relief" },
      ],
    });
  }
  switch (state.stage) {
    case "covered":
      options.push({
        id: "expose",
        label: "Open my shirt. Gently.",
        actions: treat(state, "cloth", "wound"),
      });
      break;
    case "exposed":
      options.push({
        id: "extract",
        label: "Take the metal out. Slowly.",
        actions: treat(state, "forceps", "wound"),
      });
      break;
    case "extracted": {
      if (state.items.suture.location !== "consumed")
        options.push({
          id: "close",
          label: "Stitch it shut. Stay with me.",
          actions: treat(state, "suture", "wound"),
        });
      else {
        const cutter = (
          ["scissors", "scalpel", "blade", "shard"] as const
        ).find((item) => state.items[item].location !== "consumed");
        const fabric = (["blanket", "cloth"] as const).find(
          (item) => state.items[item].location !== "consumed",
        );
        const fromWig = state.items.wig.location !== "consumed" && cutter;
        const source = fromWig ? "wig" : fabric;
        const tool = fromWig ? cutter : "forceps";
        if (state.items.thread.location === "consumed" && !source) break;
        const cut: GameAction[] =
          state.items.thread.location === "consumed" && source
            ? [
                ...take(state, tool),
                { kind: "use", item: tool, target: source, style: "gentle" },
                { kind: "place", item: tool, location: "tray" },
                { kind: "pick_up", item: "needle" },
              ]
            : take(state, "needle");
        options.push({
          id: "thread",
          label:
            state.items.thread.location !== "consumed"
              ? "Put the thread through the needle."
              : fromWig
                ? "Cut hair from the wig. Thread the needle."
                : `Pull thread from the ${source}. Thread the needle.`,
          actions: [
            ...cut,
            { kind: "combine", first: "needle", second: "thread" },
            { kind: "vocalize", cue: "relief" },
          ],
        });
      }
      break;
    }
    case "closed": {
      const clean = (["bandage", "cloth"] as const).find(
        (item) =>
          state.items[item].location !== "consumed" && state.items[item].clean,
      );
      if (clean)
        options.push({
          id: "dress",
          label: "Cover it with something clean.",
          actions: treat(state, clean, "wound"),
        });
      else if (
        state.items.blanket.clean &&
        state.items.blanket.location !== "consumed" &&
        state.items.bandage.location === "consumed"
      ) {
        const cutter = (
          ["scissors", "scalpel", "blade", "shard"] as const
        ).find(
          (item) =>
            state.items[item].location !== "consumed" &&
            state.items[item].clean &&
            !state.rules.noSharp,
        );
        if (cutter)
          options.push({
            id: "bandage",
            label: "Cut a clean strip from the blanket.",
            actions: [
              ...take(state, cutter),
              { kind: "use", item: cutter, target: "blanket", style: "gentle" },
            ],
          });
      }
      if (
        !options.some(
          (choice) => choice.id === "dress" || choice.id === "bandage",
        )
      ) {
        const stained = (["bandage", "cloth"] as const).find(
          (item) => state.items[item].location !== "consumed",
        );
        if (stained && state.items.bowl.clean && state.waterPortions > 0) {
          options.push({
            id: "wash",
            label: `Wash the ${stained}. We still have water.`,
            actions: [
              ...take(state, "bowl"),
              { kind: "use", item: "bowl", target: stained, style: "gentle" },
            ],
          });
        } else if (stained) {
          options.push({
            id: "dress",
            label: `It is all we have. Use the stained ${stained}.`,
            actions: treat(state, stained, "wound"),
          });
        }
      }
      break;
    }
    case "dressed":
      if (!state.environment.fire)
        options.push({
          id: "free",
          label: "Unlock the brace. Help me up.",
          actions: treat(state, "release", "patient"),
        });
      break;
  }
  if (
    !state.rules.noMedicine &&
    state.medicineDoses > 0 &&
    state.patient.pain > 35 &&
    state.patient.sedation < 35
  )
    options.push({
      id: "relief",
      label: "A little morphine. Only a little.",
      actions: treat(state, "morphine", "patient"),
    });
  if (state.environment.door === "knocking")
    options.push({
      id: "door",
      label: "Bar the door. Then come back.",
      actions: [
        ...take(state, "forceps"),
        { kind: "use", item: "forceps", target: "door", style: "gentle" },
        { kind: "move_to", target: "father" },
        { kind: "vocalize", cue: "relief" },
      ],
    });
  return finishChoices(state, options);
}

function finishChoices(
  state: GameState,
  options: PreviewChoice[],
): PreviewChoice[] {
  if (state.environment.lanternLit && options.length < 3) {
    const explore = lanternExplore(state);
    if (explore) options.push(explore);
  }
  if (options.length < 3)
    options.push({
      id: "calm",
      label: "You're doing well. I am here.",
      actions: [
        { kind: "react", stimulus: "reassure" },
        { kind: "vocalize", cue: "relief" },
      ],
    });
  return options
    .filter(
      (choice) =>
        !state.rules.noSharp ||
        !choice.actions.some(
          (action) =>
            ((action.kind === "pick_up" || action.kind === "use") &&
              CATALOG[action.item].sharp) ||
            action.kind === "combine" ||
            action.kind === "break",
        ),
    )
    .slice(0, 3);
}
