import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewChoices } from "./experience";
import { GameStore } from "./store";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("guides a timed operation through relief, the door, fire, and rescue", async () => {
  const store = new GameStore();
  store.start();
  const clock = setInterval(() => store.tick(0.1), 100);
  await vi.advanceTimersByTimeAsync(22000);
  const choose = async (id: string) => {
    const choice = previewChoices(store.getSnapshot()).find(
      (choice) => choice.id === id,
    );
    expect(
      choice,
      `Choice ${id} at ${store.getSnapshot().stage}`,
    ).toBeDefined();
    for (const action of choice!.actions) {
      const pending = store.run(action);
      await vi.advanceTimersByTimeAsync(15000);
      const result = await pending;
      expect(result.ok, `${id}: ${result.message}`).toBe(true);
    }
  };
  await choose("light");
  await choose("lift");
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

it("does not offer medicine or sharp work when the player forbids them", () => {
  const store = new GameStore();
  const state = store.getSnapshot();
  const choices = previewChoices({
    ...state,
    phase: "playing",
    stage: "extracted",
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
