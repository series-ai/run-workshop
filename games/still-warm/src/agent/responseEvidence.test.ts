import { describe, expect, it } from "vitest";
import {
  interpretationSchema,
  ResponseEvidence,
} from "./responseEvidence";

describe("response evidence", () => {
  it("accepts any unused evidence issued during the current input", () => {
    const evidence = new ResponseEvidence();
    evidence.beginInput();
    const first = evidence.issue();
    const latest = evidence.issue();

    expect(
      evidence.accept({ evidenceId: first, text: "I heard him." }),
    ).toEqual({ ok: true, text: "I heard him." });
    expect(
      evidence.accept({ evidenceId: latest, text: "I saw the room." }),
    ).toEqual({ ok: true, text: "I saw the room." });
    expect(
      evidence.accept({ evidenceId: latest, text: "I repeat myself." }),
    ).toMatchObject({ ok: false });

    evidence.beginInput();
    expect(
      evidence.accept({ evidenceId: latest, text: "I still heard him." }),
    ).toMatchObject({ ok: false });
  });

  it("limits one input to three brief interpretations", () => {
    const evidence = new ResponseEvidence();
    evidence.beginInput();

    for (let index = 0; index < 3; index += 1) {
      const evidenceId = evidence.issue();
      expect(
        evidence.accept({ evidenceId, text: `I notice result ${index + 1}.` }),
      ).toMatchObject({ ok: true });
    }
    const evidenceId = evidence.issue();
    expect(
      evidence.accept({ evidenceId, text: "I add unnecessary chatter." }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/three/i) });
  });

  it("validates short plain text and rejects markup, quotes, and extra lines", () => {
    expect(
      interpretationSchema.parse({ evidenceId: 7, text: "  I can help him.  " }),
    ).toEqual({ evidenceId: 7, text: "I can help him." });
    expect(
      interpretationSchema.safeParse({ evidenceId: 7, text: "I wait.\nThen act." })
        .success,
    ).toBe(false);
    expect(
      interpretationSchema.safeParse({ evidenceId: 7, text: "*I wait.*" })
        .success,
    ).toBe(false);
    expect(
      interpretationSchema.safeParse({ evidenceId: 7, text: 'He said "lift".' })
        .success,
    ).toBe(false);
    expect(
      interpretationSchema.safeParse({ evidenceId: 7, text: "x".repeat(201) })
        .success,
    ).toBe(false);
  });
});
