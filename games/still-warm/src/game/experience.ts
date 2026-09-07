import { CATALOG, type GameAction, type GameState, type ItemId } from "./model";

export function sceneThought(state: GameState): { id: string; text: string } {
  if (!state.environment.lanternLit)
    return {
      id: "light",
      text: "The lantern. On the workbench. He can reach it.",
    };
  if (state.environment.fire > 0)
    return {
      id: "fire",
      text: "Smoke. Water, or the wool blanket. Before it spreads.",
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
    case "pinned":
      return {
        id: "pinned",
        text: "He's afraid of hurting me. He needs to hear my voice.",
      };
    case "covered":
      return {
        id: "covered",
        text: "The weight is gone. My legs won't answer. Open the coat.",
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
              ? "The hair will hold. Thread it through the needle."
              : "A needle, but no thread. There is hair on the workbench.",
      };
    case "closed":
      return {
        id: "closed",
        text: "Something clean over it. Then the iron on my legs.",
      };
    case "dressed":
      return {
        id: "dressed",
        text: "The brace key. Help me up, son. Don't let go.",
      };
  }
}

export interface PreviewChoice {
  id: string;
  label: string;
  actions: GameAction[];
}

function take(state: GameState, item: ItemId): GameAction[] {
  if (state.holding === item) return [];
  return [
    ...(state.holding
      ? [
          {
            kind: "place" as const,
            item: state.holding,
            location: "tray" as const,
          },
        ]
      : []),
    { kind: "pick_up", item },
  ];
}
function treat(
  state: GameState,
  item: ItemId,
  target: "wound" | "patient",
): GameAction[] {
  return [
    ...(target === "wound" && state.lamp !== "wound"
      ? [{ kind: "adjust_lamp" as const, position: "wound" as const }]
      : []),
    ...take(state, item),
    { kind: "speak", text: "Slow. Careful." },
    { kind: "use", item, target, style: "gentle" },
  ];
}

export function previewChoices(state: GameState): PreviewChoice[] {
  if (!state.environment.lanternLit)
    return [
      {
        id: "light",
        label: "Light the lantern. I am here.",
        actions: [
          { kind: "light_lantern" },
          { kind: "speak", text: "The lantern is lit." },
        ],
      },
    ];
  const options: PreviewChoice[] = [];
  if (state.environment.fire > 0) {
    const item = state.items.bowl.clean ? "bowl" : "blanket";
    options.push({
      id: "fire",
      label:
        item === "bowl"
          ? "The fire. Use the water."
          : "Smother it with the blanket.",
      actions: [
        ...take(state, item),
        { kind: "use", item, target: "fire", style: "gentle" },
        { kind: "speak", text: "The fire is out." },
      ],
    });
  }
  switch (state.stage) {
    case "pinned":
      options.push({
        id: "lift",
        label: "You can do it. Lift it off me.",
        actions: [
          ...(state.holding
            ? [
                {
                  kind: "place" as const,
                  item: state.holding,
                  location: "tray" as const,
                },
              ]
            : []),
          { kind: "react", stimulus: "reassure" },
          { kind: "speak", text: "Lifting the support." },
          { kind: "lift_debris", style: "gentle" },
        ],
      });
      break;
    case "covered":
      options.push({
        id: "expose",
        label: "Open my coat. Gently.",
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
        const cut: GameAction[] =
          state.items.thread.location === "consumed"
            ? [
                ...take(state, "scissors"),
                {
                  kind: "use",
                  item: "scissors",
                  target: "wig",
                  style: "gentle",
                },
                { kind: "place", item: "scissors", location: "tray" },
                { kind: "pick_up", item: "needle" },
              ]
            : take(state, "needle");
        options.push({
          id: "thread",
          label: "Cut hair from the wig. Thread the needle.",
          actions: [
            ...cut,
            { kind: "combine", first: "needle", second: "thread" },
            { kind: "speak", text: "The needle is threaded." },
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
            state.items[item].clean,
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
        { kind: "speak", text: "The door is barred." },
      ],
    });
  if (options.length < 3)
    options.push({
      id: "calm",
      label: "You're doing well. I am here.",
      actions: [
        { kind: "react", stimulus: "reassure" },
        { kind: "speak", text: "Here." },
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
