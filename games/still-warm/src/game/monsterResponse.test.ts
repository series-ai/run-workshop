import { describe, expect, it } from "vitest";
import {
  getMonsterResponse,
  MONSTER_RESPONSES,
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
      const items = MONSTER_RESPONSES[cat];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.text).not.toContain('"');
        expect(item.text).not.toContain("“");
        expect(item.text).not.toContain("”");
        expect(item.text).not.toContain("father");
        expect(item.cue).toBeDefined();
      }
    }
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
