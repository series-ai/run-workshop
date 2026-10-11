import { describe, it, expect, beforeEach } from "vitest";
import {
  formatSensoryNarration,
  formatInspectNarration,
  defaultSensoryPicker,
  INSPECT_DARK_VARIATIONS,
  INSPECT_DARK_WITH_FIRE_VARIATIONS,
  INSPECT_FLOOR_VARIATIONS,
} from "./sensoryNarration";
import type { VisionInput } from "../game/vision";

describe("sensoryNarration", () => {
  beforeEach(() => {
    defaultSensoryPicker.reset();
  });

  it("narrates surgical tool pickup correctly", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "tray",
      action: "take_item",
      targetItem: "scalpel",
      actionSucceeded: true,
      vocalText: "A soft, raspy sigh escapes his throat in the silence.",
    });
    expect(text).toContain("to my left, by the instrument tray");
    expect(text).toContain("steel");
    expect(text).toContain("A soft, raspy sigh");
  });

  it("narrates medicine pickup correctly", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "cabinet",
      action: "take_item",
      targetItem: "morphine",
      actionSucceeded: true,
      vocalText: "I hear a sharp, frightened gasp as his frame tenses.",
    });
    expect(text).toContain("supply cabinet");
    expect(text).toContain("glass");
  });

  it("narrates successful lift_debris with first-person physical relief", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "lift_debris",
      actionSucceeded: true,
      vocalText: "A heavy, shuddering groan breaks from his chest as he strains.",
    });
    expect(text).toContain("timber");
    expect(text).toContain("spine");
    expect(text).not.toContain("His heavy boots scrape");
  });

  it("narrates morphine usage with visceral first-person sensation", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "use_morphine",
      actionSucceeded: true,
      vocalText: "A calm, gentle rumble vibrates from his chest.",
    });
    expect(text).toContain("numb");
  });

  it("narrates bandage application with somatic touch", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "use_bandage",
      actionSucceeded: true,
      vocalText: "A soft, raspy sigh escapes his throat in the silence.",
    });
    expect(text).toContain("pressure");
  });

  it("narrates suture usage with needle sensation", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "use_suture",
      actionSucceeded: true,
      vocalText: "A soft, raspy sigh escapes his throat in the silence.",
    });
    expect(text).toContain("skin");
  });

  it("narrates examination with gentle proximity", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "examine_wound",
      actionSucceeded: true,
      vocalText: "A calm, gentle rumble vibrates from his chest.",
    });
    expect(text).toContain("fingertips");
  });

  it("cycles variations deterministically and avoids immediate repetition", () => {
    const text1 = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "tray",
      action: "take_item",
      targetItem: "scalpel",
      actionSucceeded: true,
      vocalText: "",
    });
    const text2 = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "tray",
      action: "take_item",
      targetItem: "forceps",
      actionSucceeded: true,
      vocalText: "",
    });
    expect(text1).not.toBe(text2);
  });

  it("narrates somatic failure when lift_debris is blocked by fear (gate failure)", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "lift_debris",
      actionSucceeded: false,
      gateFailureReason: "lift_scared",
      vocalText: "From the gloom, I hear him let out a faint, trembling whimper.",
    });
    expect(text).toContain("oak cabinet");
    expect(text).toContain("trembling");
    expect(text).toContain("whimper");
  });

  it("narrates somatic reality when player attempts to stand up while injured", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "none",
      actionSucceeded: false,
      gateFailureReason: "stand_injured",
      vocalText: "From the gloom, I hear him let out a faint, trembling whimper.",
    });
    expect(text).toContain("agony");
    expect(text).toContain("whimper");
  });

  it("narrates somatic obstruction when player attempts to roll over while pinned", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "roll_patient",
      actionSucceeded: false,
      gateFailureReason: "roll_pinned",
      vocalText: "A low, frightened groan escapes his throat.",
    });
    expect(text).toContain("oak cabinet");
    expect(text).toContain("pins me");
  });

  it("adds somatic telegraph at peak tempo when turn is stagnant", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "none",
      actionSucceeded: false,
      tempoState: "peak",
      currentStage: "pinned",
      creatureEmotion: "scared",
      vocalText: "A soft, raspy sigh escapes his throat in the silence.",
    });
    expect(text).toContain("ragged sleeve");
    expect(text).toContain("panic");
  });

  it("does not narrate mechanical failure when lift_debris is blocked and gateFailureReason is absent", () => {
    const text = formatSensoryNarration({
      movedFrom: "father",
      movedTo: "father",
      action: "lift_debris",
      actionSucceeded: false,
      vocalText: "I hear his frightened, shuddering whimper close to the stone.",
    });
    expect(text).toBe("I hear his frightened, shuddering whimper close to the stone.");
    expect(text).not.toContain("cabinet");
    expect(text).not.toContain("failed");
  });
});

describe("visibility discipline", () => {
  const SIGHT_OF_BOY =
    /\bhis (mismatched )?(eyes|face|shape|silhouette|shadow)\b|\bwatches\b|\bstares\b|\blooks down\b|\bleans (close )?over\b/i;

  beforeEach(() => {
    defaultSensoryPicker.reset();
  });

  it("never shows the boy while pinned face down in the dark", () => {
    const dark: VisionInput = {
      posture: "prone",
      stage: "pinned",
      lamp: "away",
      candleLit: false,
      lanternLit: false,
      fire: 12,
    };
    // Every inspect answer must stay within hearing and touch.
    for (let i = 0; i < INSPECT_DARK_VARIATIONS.length; i++) {
      expect(formatInspectNarration(dark)).not.toMatch(SIGHT_OF_BOY);
    }
    // Peak-tempo telegraphs for the pinned, frightened boy are tactile too.
    for (let i = 0; i < 4; i++) {
      const text = formatSensoryNarration({
        action: "none",
        actionSucceeded: false,
        tempoState: "peak",
        currentStage: "pinned",
        creatureEmotion: "scared",
        vocalText: "",
      });
      expect(text).not.toMatch(SIGHT_OF_BOY);
    }
    // Roll failure narration must not claim he watches.
    for (let i = 0; i < 4; i++) {
      const text = formatSensoryNarration({
        action: "none",
        actionSucceeded: false,
        gateFailureReason: "roll_pinned",
        vocalText: "",
      });
      expect(text).not.toMatch(SIGHT_OF_BOY);
    }
  });

  it("shows only the floor, never the boy, once the cabinet is off", () => {
    const floor: VisionInput = {
      posture: "prone",
      stage: "covered",
      lamp: "away",
      candleLit: false,
      lanternLit: false,
      fire: 12,
    };
    for (let i = 0; i < INSPECT_FLOOR_VARIATIONS.length; i++) {
      const text = formatInspectNarration(floor);
      expect(text).not.toMatch(SIGHT_OF_BOY);
      expect(text).toMatch(/flagstones|grate|stone/i);
    }
  });

  it("shows the boy only when supine under light", () => {
    const room: VisionInput = {
      posture: "supine",
      stage: "covered",
      lamp: "away",
      candleLit: false,
      lanternLit: true,
      fire: 12,
    };
    const text = formatInspectNarration(room);
    expect(text).toMatch(/lantern|light|see/i);
    expect(text).not.toMatch(/cannot see|nothing but dark|blackness answers/i);
  });

  it("names only the light source that is actually burning", () => {
    const base: VisionInput = {
      posture: "supine",
      stage: "covered",
      lamp: "away",
      candleLit: false,
      lanternLit: false,
      fire: 0,
    };
    // Fire-only light must not claim a lantern, candle, or lamp.
    const fireOnly = formatInspectNarration({ ...base, fire: 30 });
    expect(fireOnly).toMatch(/burning oil|amber/i);
    expect(fireOnly).not.toMatch(/lantern|candle|examination lamp/i);

    // Candle-only must not claim a lantern.
    const candleOnly = formatInspectNarration({ ...base, candleLit: true });
    expect(candleOnly).toMatch(/candle/i);
    expect(candleOnly).not.toMatch(/lantern/i);

    // Lamp-only must not claim a lantern.
    const lampOnly = formatInspectNarration({ ...base, lamp: "wound" });
    expect(lampOnly).toMatch(/examination lamp/i);
    expect(lampOnly).not.toMatch(/lantern light|candlelight/i);
  });

  it("describes a fire by heat and sound only, never by sight, in the dark", () => {
    const warmDark: VisionInput = {
      posture: "prone",
      stage: "pinned",
      lamp: "away",
      candleLit: false,
      lanternLit: false,
      fire: 20,
    };
    const SIGHT_OF_LIGHT =
      /\blit by\b|flicker\w*\s+(?:of|on)|glow|shines?|light(?:s|ed)? up|illuminat/i;
    for (let i = 0; i < INSPECT_DARK_WITH_FIRE_VARIATIONS.length; i++) {
      const text = formatInspectNarration(warmDark);
      expect(text).not.toMatch(SIGHT_OF_LIGHT);
      expect(text).toMatch(/hear|crackle|heat|black/i);
    }
  });

  it("never describes a fire that is not burning", () => {
    const coldDark: VisionInput = {
      posture: "prone",
      stage: "pinned",
      lamp: "away",
      candleLit: false,
      lanternLit: false,
      fire: 0,
    };
    for (let i = 0; i < INSPECT_DARK_VARIATIONS.length; i++) {
      const text = formatInspectNarration(coldDark);
      expect(text).not.toMatch(/fire|crackle|burning|flame|flicker/i);
    }
    // With a live fire the dark case may reference its heat and crackle.
    const warmDark = formatInspectNarration({ ...coldDark, fire: 20 });
    expect(warmDark).toMatch(/fire|crackle|flicker|burning/i);
  });
});
