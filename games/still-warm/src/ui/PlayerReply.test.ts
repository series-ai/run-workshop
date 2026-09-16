import { describe, expect, it } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  FIRST_INSTRUCTION_PLACEHOLDER,
  SUBSEQUENT_INSTRUCTION_PLACEHOLDER,
  PlayerReply,
} from "./PlayerReply";
import { canPlayerSpeak, isActionResolving } from "./playerInputState";
import { MEMORY_STOOL, SENSORY_FIRST_SOUND, SENSORY_FIRST_SOUND_PULSE } from "../App";
import { createWaitingTurn } from "./waitingTurnState";

describe("PlayerReply placeholders", () => {
  it("uses 'Call out into the dark...' for the initial instruction prompt", () => {
    expect(FIRST_INSTRUCTION_PLACEHOLDER).toBe("Call out into the dark...");
  });

  it("uses 'Tell him what to do next' for subsequent instruction prompts", () => {
    expect(SUBSEQUENT_INSTRUCTION_PLACEHOLDER).toBe("Tell him what to do next");
  });

  it("renders FIRST_INSTRUCTION_PLACEHOLDER when hasSpoken is false", () => {
    const inputRef = { current: null };
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef,
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        onFocus: () => {},
        onBlur: () => {},
        voiceSupported: true,
        listening: false,
        busy: false,
        onStopWork: () => {},
        onSpeak: () => {},
        onStopSpeaking: () => {},
        onCancelSpeaking: () => {},
        hasSpoken: false,
      }),
    );
    expect(html).toContain(`placeholder="${FIRST_INSTRUCTION_PLACEHOLDER}"`);
  });

  it("renders SUBSEQUENT_INSTRUCTION_PLACEHOLDER when hasSpoken is true", () => {
    const inputRef = { current: null };
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef,
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        onFocus: () => {},
        onBlur: () => {},
        voiceSupported: true,
        listening: false,
        busy: false,
        onStopWork: () => {},
        onSpeak: () => {},
        onStopSpeaking: () => {},
        onCancelSpeaking: () => {},
        hasSpoken: true,
      }),
    );
    expect(html).toContain(`placeholder="${SUBSEQUENT_INSTRUCTION_PLACEHOLDER}"`);
  });
});

describe("Opening and Memory constants", () => {
  it("has exact phrasing for stool memory upon action", () => {
    expect(MEMORY_STOOL).toBe("I was standing on the stool.. reaching above the cabinet. Did I fall?");
  });

  it("has exact phrasing for first sound sensory discovery", () => {
    expect(SENSORY_FIRST_SOUND).toBe("There's a wimper near by. Who is that? Is it.. my boy?");
  });

  it("formats sensory first sound pulse with suspense pauses and trailing buffer", () => {
    expect(SENSORY_FIRST_SOUND_PULSE).toContain("{{pause(2.0)}}");
    expect(SENSORY_FIRST_SOUND_PULSE).toContain("{{pause(1.5)}}");
    expect(SENSORY_FIRST_SOUND_PULSE).toContain("{{pause(2.5)}}");
    const turn = createWaitingTurn(SENSORY_FIRST_SOUND_PULSE);
    expect(turn.cleanText).toBe("There's a wimper near by... Who is that? Is it.. my boy?");
    expect(turn.animationComplete).toBe(false);
  });
});

describe("playerInputState", () => {
  it("resolves action when connection status is thinking, acting, or stopping", () => {
    expect(isActionResolving("thinking", null)).toBe(true);
    expect(isActionResolving("acting", null)).toBe(true);
    expect(isActionResolving("stopping", null)).toBe(true);
    expect(isActionResolving("idle", null)).toBe(false);
  });

  it("resolves action when store has an in-flight pending physical action even if connection is idle", () => {
    expect(isActionResolving("idle", { action: { kind: "lift_debris" }, progress: 0.5 })).toBe(true);
  });

  it("keeps action resolving while pending narration text is still displaying on screen", () => {
    expect(isActionResolving("idle", null, true)).toBe(true);
    expect(isActionResolving("idle", null, false)).toBe(false);
  });

  it("restores input immediately when pending narration is cleared upon cancellation or stop", () => {
    let hasPendingNarration = true;
    let status = "thinking";
    expect(isActionResolving(status, null, hasPendingNarration)).toBe(true);

    // Cancel / Stop immediately zeroes out status to idle and clears pending narration
    hasPendingNarration = false;
    status = "idle";
    expect(isActionResolving(status, null, hasPendingNarration)).toBe(false);
  });

  it("canPlayerSpeak checks active, busy, and openingComplete", () => {
    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: true,
        mode: "live",
        busy: false,
      }),
    ).toBe(true);

    expect(
      canPlayerSpeak({
        active: false,
        openingComplete: true,
        mode: "live",
        busy: false,
      }),
    ).toBe(false);

    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: false,
        mode: "live",
        busy: false,
      }),
    ).toBe(false);

    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: true,
        mode: "live",
        busy: true,
      }),
    ).toBe(false);
  });
});

describe("PlayerReply component rendering", () => {
  it("renders normal interactive controls while idle (busy: false)", () => {
    const inputRef = { current: null };
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef,
        value: "Lift it",
        onChange: () => {},
        onSubmit: () => {},
        onFocus: () => {},
        onBlur: () => {},
        voiceSupported: true,
        listening: false,
        busy: false,
        onStopWork: () => {},
        onSpeak: () => {},
        onStopSpeaking: () => {},
        onCancelSpeaking: () => {},
      }),
    );

    // Form has no resolving class
    expect(html).toContain('class="command-form "');
    // Input is enabled
    expect(html).not.toContain('id="player-words" aria-label="Your instruction" inputMode="text" enterKeyHint="send" disabled=""');
    // Speak button is enabled
    expect(html).toContain('class="speak-button  "');
    expect(html).not.toContain('class="speak-button  " disabled=""');
  });

  it("renders faded out and completely disabled controls while resolving (busy: true)", () => {
    const inputRef = { current: null };
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef,
        value: "Lift it",
        onChange: () => {},
        onSubmit: () => {},
        onFocus: () => {},
        onBlur: () => {},
        voiceSupported: true,
        listening: false,
        busy: true,
        onStopWork: () => {},
        onSpeak: () => {},
        onStopSpeaking: () => {},
        onCancelSpeaking: () => {},
      }),
    );

    // Form has resolving class for CSS fade-out transition
    expect(html).toContain("command-form resolving");

    // Input is strictly disabled, aria-disabled, tabIndex -1
    expect(html).toContain('<input id="player-words" aria-label="Your instruction" inputMode="text" enterKeyHint="send" disabled="" aria-disabled="true" tabindex="-1"');

    // Speak button has resolving class and is disabled
    expect(html).toContain("speak-button  resolving");
    expect(html).toContain('class="speak-button  resolving" disabled="" tabindex="-1"');

    // Stop button is visible while busy so user can abort if necessary
    expect(html).toContain('class="stop-button"');
  });
});
