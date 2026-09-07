import { describe, expect, it } from "vitest";
import { createInitialState } from "./model";
import { contactThought } from "./perception";

describe("the father's reading of contact", () => {
  it("makes a rough change visible before the support moves", () => {
    const state = createInitialState();
    expect(contactThought({ kind: "lift_debris", style: "rough" }, state)).toBe(
      "He's about to lift the weight. Too fast.",
    );
    expect(state.stage).toBe("pinned");
  });

  it("names the actual tool and target without claiming that work is complete", () => {
    const state = { ...createInitialState(), stage: "exposed" as const };
    expect(
      contactThought(
        { kind: "use", item: "forceps", target: "wound", style: "gentle" },
        state,
      ),
    ).toBe("The forceps. He's going to pull the metal out. Slowly.");
    expect(
      contactThought(
        { kind: "use", item: "needle", target: "wound", style: "rough" },
        state,
      ),
    ).toBe("He's bringing the suture needle to my wound. Too fast.");
  });

  it("does not describe a bare needle as a prepared suture", () => {
    const state = { ...createInitialState(), stage: "extracted" as const };
    const thought = contactThought(
      { kind: "use", item: "needle", target: "wound", style: "gentle" },
      state,
    );
    expect(thought).not.toContain("threaded");
    expect(thought).not.toContain("closed");
  });
});
