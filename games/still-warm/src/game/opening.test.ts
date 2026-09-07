import { describe, expect, it, vi } from "vitest";
import { openingAt, OPENING_DURATION } from "./opening";
import { createInitialState } from "./model";
import { GameStore } from "./store";
import { applyAction, observeStatus } from "./transitions";

describe("Dark opening", () => {
  it("starts blind, separates narration and son, and opens into darkness", () => {
    expect(openingAt(0).eyes).toBe(0);
    expect(openingAt(0).narration).toContain("Total blackness");
    expect(openingAt(7).speech).toBe("Dah? DAH?");
    expect(openingAt(7).narration).toBe("");
    expect(openingAt(11).eyes).toBeGreaterThan(0);
    expect(openingAt(11).eyes).toBeLessThan(1);
    expect(openingAt(15).narration).toContain("son");
    expect(openingAt(18).speech).toBe("DAH? WHERE DAH?");
    expect(openingAt(OPENING_DURATION).narration).toContain("lantern");
    expect(openingAt(OPENING_DURATION).complete).toBe(true);
    expect(createInitialState().environment.lanternLit).toBe(false);
  });

  it("lighting is a physical action and does not remove the obstruction", () => {
    const state = { ...createInitialState(), phase: "playing" as const };
    const result = applyAction(state, { kind: "light_lantern" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stage).toBe("pinned");
    expect(result.state.contactCount).toBe(0);
    expect(observeStatus(result.state).environment.lanternLit).toBe(true);
    expect(applyAction(result.state, { kind: "light_lantern" }).ok).toBe(false);
  });

  it("STOP cancels lighting before the flame appears", async () => {
    vi.useFakeTimers();
    const store = new GameStore();
    try {
      store.start();
      const action = store.run({ kind: "light_lantern" });
      expect(store.getSnapshot().pending?.action.kind).toBe("light_lantern");
      store.cancel();
      await vi.runAllTimersAsync();
      expect((await action).ok).toBe(false);
      expect(store.getSnapshot().environment.lanternLit).toBe(false);
    } finally {
      store.dispose();
      vi.useRealTimers();
    }
  });
});
