import { describe, expect, it } from "vitest";

import {
  compileText,
  LETTERS_PER_SECOND,
  visibleCharacters,
} from "./text";

describe("text timing", () => {
  it("holds after one dot before revealing the next dot", () => {
    const sequence = compileText(".{{pause(0.250)}}.");
    const firstDotAt = 1 / LETTERS_PER_SECOND;
    const secondDotAt = 2 / LETTERS_PER_SECOND + 0.25;

    expect(sequence.text).toBe("..");
    expect(sequence.revealAt[0]).toBeCloseTo(firstDotAt);
    expect(sequence.revealAt[1]).toBeCloseTo(secondDotAt);
    expect(visibleCharacters(sequence, firstDotAt)).toBe(1);
    expect(visibleCharacters(sequence, secondDotAt - 0.01)).toBe(1);
    expect(visibleCharacters(sequence, secondDotAt)).toBe(2);
  });

  it("adds multiple pauses, including a trailing pause", () => {
    const sequence = compileText(
      "A{{pause(0.100)}}B{{pause(0.200)}}",
    );

    expect(sequence.text).toBe("AB");
    expect(sequence.revealAt).toHaveLength(2);
    expect(sequence.revealAt[1] - sequence.revealAt[0]).toBeCloseTo(
      0.1 + 1 / LETTERS_PER_SECOND,
    );
    expect(sequence.duration).toBeCloseTo(
      2 / LETTERS_PER_SECOND + 0.3,
    );
    expect(visibleCharacters(sequence, sequence.revealAt[1])).toBe(2);
    expect(visibleCharacters(sequence, sequence.duration - 0.01)).toBe(2);
  });

  it("counts Unicode code points as visible characters", () => {
    const sequence = compileText("A🙂B");

    expect(sequence.text).toBe("A🙂B");
    expect(sequence.revealAt).toHaveLength(3);
    expect(visibleCharacters(sequence, 1 / LETTERS_PER_SECOND)).toBe(1);
    expect(visibleCharacters(sequence, 2 / LETTERS_PER_SECOND)).toBe(2);
    expect(visibleCharacters(sequence, 3 / LETTERS_PER_SECOND)).toBe(3);
  });

  it("keeps a malformed marker literal and does not execute it", () => {
    const property = "__compileTextExecuted";
    Reflect.deleteProperty(globalThis, property);
    const source =
      "Safe {{pause(globalThis.__compileTextExecuted = true)}} text";

    try {
      const sequence = compileText(source);

      expect(sequence.text).toBe(source);
      expect(sequence.revealAt).toHaveLength(Array.from(source).length);
      expect(property in globalThis).toBe(false);
    } finally {
      Reflect.deleteProperty(globalThis, property);
    }
  });

  it("uses constant character timing for plain text", () => {
    const sequence = compileText("plain");

    expect(sequence.text).toBe("plain");
    expect(sequence.revealAt).toHaveLength(5);
    sequence.revealAt.forEach((seconds, index) => {
      expect(seconds).toBeCloseTo((index + 1) / LETTERS_PER_SECOND);
    });
    expect(sequence.duration).toBeCloseTo(5 / LETTERS_PER_SECOND);
    expect(visibleCharacters(sequence, -1)).toBe(0);
    expect(visibleCharacters(sequence, sequence.duration)).toBe(5);
  });

  it("parses italic markdown without counting asterisks in character timing", () => {
    const sequence = compileText("IN THE DARK, *IT* IS...");

    expect(sequence.text).toBe("IN THE DARK, IT IS...");
    expect(sequence.revealAt).toHaveLength(Array.from("IN THE DARK, IT IS...").length);
    expect(sequence.duration).toBeCloseTo(Array.from("IN THE DARK, IT IS...").length / LETTERS_PER_SECOND);

    const italicTokens = sequence.tokens.filter(t => t.italic);
    expect(italicTokens).toEqual([{ text: "IT", italic: true }]);
  });

  it("handles italic markdown combined with pause markers", () => {
    const sequence = compileText("*A*{{pause(0.5)}}*B*");

    expect(sequence.text).toBe("AB");
    expect(sequence.revealAt).toHaveLength(2);
    expect(sequence.duration).toBeCloseTo(2 / LETTERS_PER_SECOND + 0.5);
    expect(sequence.tokens).toEqual([
      { text: "A", italic: true },
      { text: "B", italic: true },
    ]);
  });
});
