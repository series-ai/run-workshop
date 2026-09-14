import { describe, expect, it } from "vitest";
import { evaluateLiftGate, isDistressUtterance } from "./turnGuards";

describe("turnGuards", () => {
  describe("isDistressUtterance", () => {
    it("identifies frantic cries of distress and pain", () => {
      expect(isDistressUtterance("help")).toBe(true);
      expect(isDistressUtterance("Help me!")).toBe(true);
      expect(isDistressUtterance("help me please")).toBe(true);
      expect(isDistressUtterance("please help me")).toBe(true);
      expect(isDistressUtterance("where are you")).toBe(true);
      expect(isDistressUtterance("are you there?")).toBe(true);
      expect(isDistressUtterance("hurry!")).toBe(true);
      expect(isDistressUtterance("it hurts...")).toBe(true);
      expect(isDistressUtterance("ouch!")).toBe(true);
      expect(isDistressUtterance("lift it")).toBe(true);
      expect(isDistressUtterance("get it off")).toBe(true);
      expect(isDistressUtterance("get this off me")).toBe(true);
    });

    it("does not flag calming reassurance or general instructions as distress", () => {
      expect(isDistressUtterance("You are safe, my boy.")).toBe(false);
      expect(isDistressUtterance("I am right here with you.")).toBe(false);
      expect(isDistressUtterance("It is okay.")).toBe(false);
      expect(isDistressUtterance("Good boy, stay calm.")).toBe(false);
      expect(isDistressUtterance("Gently lift the cabinet now.")).toBe(false);
      expect(isDistressUtterance("Pick up the lantern.")).toBe(false);
      expect(isDistressUtterance("")).toBe(false);
    });
  });

  describe("evaluateLiftGate", () => {
    it("blocks lifting when turn started scared", () => {
      const result = evaluateLiftGate({
        turnStartedScared: true,
        reactedOutOfFear: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/trembling in fear/i);
      }
    });

    it("blocks lifting when creature reacted out of fear during this turn", () => {
      const result = evaluateLiftGate({
        turnStartedScared: false,
        reactedOutOfFear: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/trembling in fear/i);
      }
    });

    it("allows lifting when creature was already calm/anxious and did not react out of fear", () => {
      // e.g. Anxious creature receives clear_instruction to lift
      const result = evaluateLiftGate({
        turnStartedScared: false,
        reactedOutOfFear: false,
      });
      expect(result.ok).toBe(true);
    });
  });
});
