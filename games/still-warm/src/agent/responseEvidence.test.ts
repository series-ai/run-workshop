import { describe, expect, it } from "vitest";
import {
  interpretationSchema,
  ResponseEvidence,
  sanitizeNarrativeVoice,
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
      interpretationSchema.safeParse({ evidenceId: 7, text: "x".repeat(401) })
        .success,
    ).toBe(false);
  });

  it("sanitizes narrative perspective so the father never thinks of his boy as 'the creature' or 'the assistant'", () => {
    expect(sanitizeNarrativeVoice("The creature does not move.")).toBe(
      "My boy does not move.",
    );
    expect(sanitizeNarrativeVoice("The creature does not move")).toBe(
      "My boy does not move",
    );
    expect(
      sanitizeNarrativeVoice("I hear the creature breathing in the gloom."),
    ).toBe("I hear my boy breathing in the gloom.");
    expect(
      sanitizeNarrativeVoice("The assistant hesitated beside the table."),
    ).toBe("My boy hesitated beside the table.");
    expect(
      sanitizeNarrativeVoice("I felt the creature's hand tremble."),
    ).toBe("I felt my boy's hand tremble.");
  });

  it("automatically transforms 'The creature does not move' to father's loving perspective upon acceptance", () => {
    const evidence = new ResponseEvidence();
    evidence.beginInput();
    const id = evidence.issue();
    const result = evidence.accept({
      evidenceId: id,
      text: "The creature does not move.",
    });
    expect(result).toEqual({ ok: true, text: "My boy does not move." });
  });

  it("sanitizes third-person slips about the father into first-person voice", () => {
    expect(sanitizeNarrativeVoice("The cabinet still pins him fast in the dark.")).toBe(
      "The cabinet still pins me fast in the dark.",
    );
    expect(sanitizeNarrativeVoice("The crushing cabinet holds him flat.")).toBe(
      "The crushing cabinet holds me flat.",
    );
    expect(sanitizeNarrativeVoice("He lifted the wood off his back.")).toBe(
      "He lifted the wood off my back.",
    );
    expect(sanitizeNarrativeVoice("He is still face down in the dirt.")).toBe(
      "I am still face down in the dirt.",
    );
    expect(sanitizeNarrativeVoice("He cannot stand after the collapse.")).toBe(
      "I cannot stand after the collapse.",
    );
    expect(sanitizeNarrativeVoice("The patient cannot turn over.")).toBe(
      "I cannot turn over.",
    );
    expect(sanitizeNarrativeVoice("He presses the cloth to comfort the patient.")).toBe(
      "He presses the cloth to comfort me.",
    );
    expect(sanitizeNarrativeVoice("Agony spikes through his spine.")).toBe(
      "Agony spikes through my spine.",
    );
  });
});
