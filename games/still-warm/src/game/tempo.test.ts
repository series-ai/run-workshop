import { describe, expect, it } from "vitest";
import {
  createInitialTempo,
  isTurnProductive,
  updateTempo,
  type TurnProgressInput,
} from "./tempo";

describe("TempoDirector & dual-track progress", () => {
  it("treats physical stage changes as productive", () => {
    const input: TurnProgressInput = {
      actionSucceeded: true,
      stateBefore: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 40, agitation: 50, confidence: 20 },
        holding: null,
      },
      stateAfter: {
        stage: "covered",
        emotion: "scared",
        disposition: { trust: 40, agitation: 50, confidence: 20 },
        holding: null,
      },
    };
    expect(isTurnProductive(input)).toBe(true);
  });

  it("treats emotional soothing (agitation drop >= 8) as productive", () => {
    const input: TurnProgressInput = {
      actionSucceeded: false,
      stateBefore: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
      stateAfter: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 46, agitation: 38, confidence: 18 }, // drop of 10
        holding: null,
      },
    };
    expect(isTurnProductive(input)).toBe(true);
  });

  it("treats transitioning out of 'scared' as productive", () => {
    const input: TurnProgressInput = {
      actionSucceeded: false,
      stateBefore: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
      stateAfter: {
        stage: "pinned",
        emotion: "anxious",
        disposition: { trust: 45, agitation: 44, confidence: 20 },
        holding: null,
      },
    };
    expect(isTurnProductive(input)).toBe(true);
  });

  it("marks a non-action, non-soothing turn as stagnant", () => {
    const input: TurnProgressInput = {
      actionSucceeded: false,
      stateBefore: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
      stateAfter: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
    };
    expect(isTurnProductive(input)).toBe(false);
  });

  it("cycles tempo through calm -> buildup -> peak -> lull", () => {
    let tempo = createInitialTempo("pinned");
    expect(tempo.state).toBe("calm");

    const stagnantInput: TurnProgressInput = {
      actionSucceeded: false,
      stateBefore: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
      stateAfter: {
        stage: "pinned",
        emotion: "scared",
        disposition: { trust: 42, agitation: 48, confidence: 18 },
        holding: null,
      },
    };

    // Turn 1
    tempo = updateTempo(tempo, stagnantInput);
    expect(tempo.stagnantTurns).toBe(1);
    expect(tempo.state).toBe("buildup");

    // Turn 2
    tempo = updateTempo(tempo, stagnantInput);
    expect(tempo.stagnantTurns).toBe(2);
    expect(tempo.state).toBe("buildup");

    // Turn 3 -> Peak!
    tempo = updateTempo(tempo, stagnantInput);
    expect(tempo.stagnantTurns).toBe(3);
    expect(tempo.state).toBe("peak");

    // Turn 4 -> Peak!
    tempo = updateTempo(tempo, stagnantInput);
    expect(tempo.stagnantTurns).toBe(4);
    expect(tempo.state).toBe("peak");

    // Turn 5 -> Lull (pressure relief)
    tempo = updateTempo(tempo, stagnantInput);
    expect(tempo.stagnantTurns).toBe(5);
    expect(tempo.state).toBe("lull");

    // Productive action resets to calm
    const productiveInput: TurnProgressInput = {
      ...stagnantInput,
      actionSucceeded: true,
    };
    tempo = updateTempo(tempo, productiveInput);
    expect(tempo.stagnantTurns).toBe(0);
    expect(tempo.state).toBe("calm");
  });
});
