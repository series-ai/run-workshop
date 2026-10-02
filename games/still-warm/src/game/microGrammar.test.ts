import { describe, expect, it } from "vitest";
import { MicroGrammar } from "./microGrammar";

describe("MicroGrammar", () => {
  it("expands nested template symbols", () => {
    const grammar = new MicroGrammar({
      origin: ["#perception# #sound# #location#."],
      perception: ["I hear", "I catch"],
      sound: ["his faint whimper", "his ragged gasp"],
      location: ["in the dark", "from the gloom"],
    });

    const output = grammar.expand("#origin#");
    expect(output).toMatch(/^(I hear|I catch) (his faint whimper|his ragged gasp) (in the dark|from the gloom)\.$/);
  });

  it("avoids immediate repetition using recent selection history", () => {
    const grammar = new MicroGrammar({
      item: ["one", "two", "three", "four", "five"],
    });

    const picks: string[] = [];
    for (let i = 0; i < 5; i++) {
      picks.push(grammar.expand("#item#"));
    }

    // No consecutive duplicate
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i]).not.toBe(picks[i - 1]);
    }
  });

  it("normalizes spacing and capitalizes output", () => {
    const grammar = new MicroGrammar({
      start: ["  i hear  #sound#  "],
      sound: ["a cry"],
    });
    expect(grammar.expand("#start#")).toBe("I hear a cry.");
  });

  it("converts 'a' to 'an' before vowels", () => {
    const grammar = new MicroGrammar({
      test: ["a #adj# sound"],
      adj: ["eager", "uneven"],
    });
    expect(grammar.expand("#test#")).toMatch(/^An (eager|uneven) sound\.$/);
  });
});
