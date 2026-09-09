import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewChoices, sceneThought } from "./experience";
import { OPENING_DURATION } from "./opening";
import { GameStore } from "./store";
import { createInitialState, type GameState } from "./model";
import { applyAction } from "./transitions";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function itemsOtherThanLantern(state: GameState) {
  const { lantern: _lantern, ...items } = state.items;
  return items;
}

async function runOffered(
  store: GameStore,
  choice: ReturnType<typeof previewChoices>[number],
) {
  for (const action of choice.actions) {
    const pending = store.run(action);
    await vi.advanceTimersByTimeAsync(15000);
    const result = await pending;
    expect(result.ok, `${choice.id}: ${result.message}`).toBe(true);
  }
}

it("guides a timed operation through relief, the door, fire, and rescue", async () => {
  const store = new GameStore();
  store.start();
  const clock = setInterval(() => store.tick(0.1), 100);
  await vi.advanceTimersByTimeAsync(OPENING_DURATION * 1000);
  const choose = async (id: string) => {
    const choice = previewChoices(store.getSnapshot()).find(
      (choice) => choice.id === id,
    );
    expect(
      choice,
      `Choice ${id} at ${store.getSnapshot().stage} ${store.getSnapshot().posture}`,
    ).toBeDefined();
    for (const action of choice!.actions) {
      const pending = store.run(action);
      await vi.advanceTimersByTimeAsync(15000);
      const result = await pending;
      expect(result.ok, `${id}: ${result.message}`).toBe(true);
    }
  };
  await choose("soothe");
  await choose("lift");
  await choose("roll");
  await choose("light");
  await choose("expose");
  await choose("relief");
  await choose("door");
  // Time spent on care can start the fallback fire before extraction.
  if (store.getSnapshot().environment.fire) await choose("fire");
  await choose("extract");
  if (store.getSnapshot().environment.fire) await choose("fire");
  await choose("thread");
  if (store.getSnapshot().phase === "blackout")
    await vi.advanceTimersByTimeAsync(13000);
  await choose("close");
  if (store.getSnapshot().phase === "blackout")
    await vi.advanceTimersByTimeAsync(13000);
  await choose("dress");
  await choose("free");
  expect(store.getSnapshot().outcome).toBe("saved");
  expect(store.getSnapshot().medicineDoses).toBe(2);
  expect(store.getSnapshot().environment.fire).toBe(0);
  clearInterval(clock);
  store.dispose();
}, 20000);

it("offers reassurance alone before it offers the pinned lift", () => {
  const state = {
    ...createInitialState(),
    phase: "playing" as const,
  };
  expect(sceneThought(state).id).toBe("pinned");
  expect(previewChoices(state)).toEqual([
    {
      id: "soothe",
      label: "You are safe. I am here.",
      actions: [{ kind: "react", stimulus: "reassure" }],
    },
  ]);

  const reassured = applyAction(state, {
    kind: "react",
    stimulus: "reassure",
  });
  expect(reassured.ok).toBe(true);
  if (!reassured.ok) return;
  expect(sceneThought(reassured.state).id).toBe("lift");
  const choices = previewChoices(reassured.state);
  const lift = choices.find((choice) => choice.id === "lift");
  expect(lift?.actions).toContainEqual({
    kind: "lift_debris",
    style: "gentle",
  });
  expect(lift?.actions).not.toContainEqual({
    kind: "react",
    stimulus: "reassure",
  });
  expect(choices.some((choice) => choice.id === "light")).toBe(false);
});

it("offers a gentle roll onto the back after the cabinet is gone while still prone", () => {
  const initial = createInitialState();
  const state = {
    ...initial,
    phase: "playing" as const,
    stage: "covered" as const,
    posture: "prone" as const,
    holding: "lantern" as const,
    items: {
      ...initial.items,
      lantern: { ...initial.items.lantern, location: "hand" as const },
    },
  };
  expect(sceneThought(state).id).toBe("roll");
  const choices = previewChoices(state);
  const roll = choices.find((choice) => choice.id === "roll");
  expect(
    roll,
    `roll among [${choices.map((choice) => choice.id).join(", ")}]`,
  ).toBeDefined();
  expect(choices.some((choice) => choice.id === "light")).toBe(false);
  expect(choices.some((choice) => choice.id === "expose")).toBe(false);
  expect(roll?.actions).toEqual([
    { kind: "place", item: "lantern", location: "tray" },
    {
      kind: "signal_intent",
      contact: { kind: "roll_patient", style: "gentle" },
    },
    { kind: "roll_patient", style: "gentle" },
  ]);
});

it("offers the lantern only after the patient is supine", () => {
  const state = {
    ...createInitialState(),
    phase: "playing" as const,
    stage: "covered" as const,
    posture: "supine" as const,
  };
  expect(sceneThought(state).id).toBe("light");
  const choices = previewChoices(state);
  expect(choices.map((choice) => choice.id)).toEqual(["light"]);
  expect(choices[0]?.actions).toContainEqual({ kind: "light_lantern" });
});

it("does not offer medicine or sharp work when the player forbids them", () => {
  const store = new GameStore();
  const state = store.getSnapshot();
  const choices = previewChoices({
    ...state,
    phase: "playing",
    stage: "extracted",
    posture: "supine",
    patient: { ...state.patient, pain: 70 },
    environment: { ...state.environment, lanternLit: true },
    rules: { ...state.rules, noSharp: true, noMedicine: true },
  });
  expect(
    choices.some(
      (choice) =>
        choice.id === "relief" ||
        choice.id === "thread" ||
        choice.id === "close",
    ),
  ).toBe(false);
});

it("makes a fresh dressing from the blanket when the cloth is dirty", () => {
  const store = new GameStore();
  const state = store.getSnapshot();
  const choices = previewChoices({
    ...state,
    phase: "playing",
    stage: "closed",
    posture: "supine",
    environment: { ...state.environment, lanternLit: true },
    items: { ...state.items, cloth: { ...state.items.cloth, clean: false } },
  });
  expect(choices.some((choice) => choice.id === "dress")).toBe(false);
  expect(
    choices.find((choice) => choice.id === "bandage")?.actions,
  ).toContainEqual({
    kind: "use",
    item: "scissors",
    target: "blanket",
    style: "gentle",
  });
});

it("washes the remaining dressing and completes care when cutting is forbidden", async () => {
  const state = createInitialState();
  const store = new GameStore({
    ...state,
    phase: "playing",
    stage: "closed",
    posture: "supine",
    lamp: "wound",
    environment: { ...state.environment, lanternLit: true },
    rules: { ...state.rules, noSharp: true },
    items: {
      ...state.items,
      cloth: { ...state.items.cloth, clean: false },
    },
  });
  for (const id of ["wash", "dress"]) {
    const choice = previewChoices(store.getSnapshot()).find(
      (choice) => choice.id === id,
    );
    expect(choice).toBeDefined();
    for (const action of choice!.actions) {
      const pending = store.run(action);
      await vi.advanceTimersByTimeAsync(15000);
      expect(await pending).toMatchObject({ ok: true });
    }
  }
  expect(store.getSnapshot().stage).toBe("dressed");
  expect(store.getSnapshot().waterPortions).toBe(2);
  expect(store.getSnapshot().items.cloth.clean).toBe(true);
  store.dispose();
});

it("offers an honest last-resort dressing when all clean materials and water are gone", async () => {
  const state = createInitialState();
  const store = new GameStore({
    ...state,
    phase: "playing",
    stage: "closed",
    posture: "supine",
    lamp: "wound",
    waterPortions: 0,
    environment: { ...state.environment, lanternLit: true },
    items: {
      ...state.items,
      cloth: { ...state.items.cloth, clean: false },
      blanket: { ...state.items.blanket, location: "consumed" },
    },
  });
  const choice = previewChoices(store.getSnapshot()).find(
    (choice) => choice.id === "dress",
  );
  expect(choice?.label).toContain("stained cloth");
  for (const action of choice!.actions) {
    const pending = store.run(action);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toMatchObject({ ok: true });
  }
  expect(store.getSnapshot().stage).toBe("dressed");
  expect(store.getSnapshot().patient.health).toBeLessThan(state.patient.health);
  store.dispose();
});

it("prepares a suture from the blanket when the wig is gone", async () => {
  const state = createInitialState();
  const store = new GameStore({
    ...state,
    phase: "playing",
    stage: "extracted",
    posture: "supine",
    environment: { ...state.environment, lanternLit: true },
    items: {
      ...state.items,
      wig: { ...state.items.wig, location: "consumed" },
    },
  });
  const choice = previewChoices(store.getSnapshot()).find(
    (choice) => choice.id === "thread",
  );
  expect(choice?.label).toContain("blanket");
  for (const action of choice!.actions) {
    const pending = store.run(action);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toMatchObject({ ok: true });
  }
  expect(store.getSnapshot().holding).toBe("suture");
  expect(store.getSnapshot().items.suture.clean).toBe(true);
  expect(store.getSnapshot().items.blanket.location).toBe("consumed");
  store.dispose();
});

it("takes and carries the portable lantern to the cabinet, then the door, then back to father", async () => {
  const state = createInitialState();
  const store = new GameStore({
    ...state,
    phase: "playing",
    stage: "covered",
    posture: "supine",
    environment: { ...state.environment, lanternLit: true },
  });
  const sourceInventory = itemsOtherThanLantern(store.getSnapshot());
  const path = ["cabinet", "door", "father"] as const;
  for (const destination of path) {
    const offered = previewChoices(store.getSnapshot());
    const choice = offered.find((option) =>
      option.actions.some(
        (action) => action.kind === "move_to" && action.target === destination,
      ),
    );
    expect(
      choice,
      `carry to ${destination} among [${offered.map((option) => option.id).join(", ")}]`,
    ).toBeDefined();
    await runOffered(store, choice!);
    const after = store.getSnapshot();
    expect(after.creatureArea).toBe(destination);
    expect(after.holding).toBe("lantern");
    expect(after.items.lantern.location).toBe("hand");
    expect(after.environment.lanternLit).toBe(true);
    expect(itemsOtherThanLantern(after)).toEqual(sourceInventory);
  }
  store.dispose();
});

it("places a held lantern before preview lift and surgery choices", async () => {
  const state = createInitialState();
  const heldLantern = {
    holding: "lantern" as const,
    items: {
      ...state.items,
      lantern: { ...state.items.lantern, location: "hand" as const },
    },
    environment: { ...state.environment, lanternLit: true },
  };

  const liftStore = new GameStore({
    ...state,
    ...heldLantern,
    phase: "playing",
    disposition: { ...state.disposition, trust: 50, confidence: 30 },
  });
  const liftOffered = previewChoices(liftStore.getSnapshot());
  const lift = liftOffered.find((choice) => choice.id === "lift");
  expect(
    lift,
    `lift among [${liftOffered.map((choice) => choice.id).join(", ")}]`,
  ).toBeDefined();
  await runOffered(liftStore, lift!);
  expect(liftStore.getSnapshot().stage).toBe("covered");
  expect(liftStore.getSnapshot().holding).toBeNull();
  expect(liftStore.getSnapshot().items.lantern.location).toBe("tray");
  liftStore.dispose();

  const surgeryStore = new GameStore({
    ...state,
    ...heldLantern,
    phase: "playing",
    stage: "covered",
    posture: "supine",
  });
  const surgeryOffered = previewChoices(surgeryStore.getSnapshot());
  const surgery = surgeryOffered.find((choice) => choice.id === "expose");
  expect(
    surgery,
    `expose among [${surgeryOffered.map((choice) => choice.id).join(", ")}]`,
  ).toBeDefined();
  await runOffered(surgeryStore, surgery!);
  expect(surgeryStore.getSnapshot().stage).toBe("exposed");
  expect(surgeryStore.getSnapshot().holding).toBe("cloth");
  expect(surgeryStore.getSnapshot().items.lantern.location).toBe("tray");
  surgeryStore.dispose();
});
