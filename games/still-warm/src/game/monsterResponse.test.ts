import { describe, expect, it } from "vitest";
import {
  getMonsterResponse,
  type MonsterEmotionCategory,
} from "./monsterResponse";

describe("monster emotional responses", () => {
  it("never includes spoken dialogue or conversational words", () => {
    const categories: MonsterEmotionCategory[] = [
      "moan",
      "slurred_speech",
      "excitement",
      "screaming",
      "fear",
      "effort",
      "relief",
      "anger",
    ];

    for (const cat of categories) {
      for (let i = 0; i < 20; i++) {
        const resp = getMonsterResponse(cat);
        expect(resp.text).not.toContain('"');
        expect(resp.text).not.toContain("“");
        expect(resp.text).not.toContain("”");
        expect(resp.text).not.toMatch(/\bfather\b/i);
        expect(resp.cue).toBeDefined();
      }
    }
  });

  it("generates procedurally diverse responses without immediate repetition", () => {
    const outputs = new Set<string>();
    for (let i = 0; i < 15; i++) {
      outputs.add(getMonsterResponse("fear").text);
    }
    // Procedural generation should produce multiple distinct sentences
    expect(outputs.size).toBeGreaterThan(4);
  });

  it("returns appropriate vocal cues for moaning, slurred speech, excitement, and screaming", () => {
    const moan = getMonsterResponse("moan");
    expect(["effort", "pain"]).toContain(moan.cue);

    const slur = getMonsterResponse("slurred_speech");
    expect(["fear", "effort"]).toContain(slur.cue);

    const excitement = getMonsterResponse("excitement");
    expect(["relief", "effort"]).toContain(excitement.cue);

    const scream = getMonsterResponse("screaming");
    expect(["pain", "fear"]).toContain(scream.cue);
  });

  it("maps game emotions to non-verbal monster emotional responses", () => {
    const scaredResp = getMonsterResponse("scared");
    expect(["fear", "screaming", "moan"]).toContain(scaredResp.category);

    const happyResp = getMonsterResponse("happy");
    expect(["excitement", "relief"]).toContain(happyResp.category);
  });
});
