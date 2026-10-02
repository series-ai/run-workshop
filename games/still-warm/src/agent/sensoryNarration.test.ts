import { describe, it, expect, beforeEach } from "vitest";
import {
  formatSensoryNarration,
  defaultSensoryPicker,
} from "./sensoryNarration";

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
