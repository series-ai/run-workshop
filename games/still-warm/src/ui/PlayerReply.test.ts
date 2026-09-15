import { describe, expect, it } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  FIRST_INSTRUCTION_PLACEHOLDER,
  SUBSEQUENT_INSTRUCTION_PLACEHOLDER,
  PlayerReply,
} from "./PlayerReply";
import { canPlayerSpeak, isActionResolving } from "./playerInputState";

describe("PlayerReply placeholders", () => {
  it("uses 'Speak to him, he can help you' for the initial instruction prompt", () => {
    expect(FIRST_INSTRUCTION_PLACEHOLDER).toBe("Speak to him, he can help you");
  });

  it("uses 'Tell him what to do next' for subsequent instruction prompts", () => {
    expect(SUBSEQUENT_INSTRUCTION_PLACEHOLDER).toBe("Tell him what to do next");
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

    // Player stops request: narration cleared and status returns to idle
    hasPendingNarration = false;
    status = "idle";
    expect(isActionResolving(status, null, hasPendingNarration)).toBe(false);
  });

  it("permits speech only when active, opening complete, live mode, and NOT busy", () => {
    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: true,
        mode: "live",
        busy: false,
      }),
    ).toBe(true);

    // Blocked if action is resolving (busy)
    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: true,
        mode: "live",
        busy: true,
      }),
    ).toBe(false);

    // Blocked if opening not complete
    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: false,
        mode: "live",
        busy: false,
      }),
    ).toBe(false);

    // Blocked if mode is rehearsal
    expect(
      canPlayerSpeak({
        active: true,
        openingComplete: true,
        mode: "rehearsal",
        busy: false,
      }),
    ).toBe(false);
  });
});

describe("PlayerReply component rendering", () => {
  it("renders enabled input and interactive controls when idle (busy: false)", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef: { current: null },
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

    // Form does NOT have resolving class
    expect(html).toContain('class="command-form "');
    expect(html).not.toContain("command-form resolving");

    // Input is NOT disabled, aria-disabled is false, tabIndex is 0
    expect(html).toContain('id="player-words"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-disabled="false"');
    expect(html).not.toContain('<input id="player-words" aria-label="Your instruction" inputMode="text" enterKeyHint="send" disabled=""');

    // Speak button is enabled and not resolving
    expect(html).toContain('class="speak-button  "');
    expect(html).toContain('Hold to speak');
  });

  it("renders faded out and completely disabled controls while resolving (busy: true)", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlayerReply, {
        inputRef: { current: null },
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

    // Stop button is enabled while busy so user can abort if necessary
    expect(html).toContain('<button class="stop-control">Stop</button>');
  });
});
