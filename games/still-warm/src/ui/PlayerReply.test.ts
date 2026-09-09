import { describe, expect, it } from "vitest";
import {
  FIRST_INSTRUCTION_PLACEHOLDER,
  SUBSEQUENT_INSTRUCTION_PLACEHOLDER,
} from "./PlayerReply";

describe("PlayerReply placeholders", () => {
  it("uses 'Speak to him, he can help you' for the initial instruction prompt", () => {
    expect(FIRST_INSTRUCTION_PLACEHOLDER).toBe("Speak to him, he can help you");
  });

  it("uses 'Tell him what to do next' for subsequent instruction prompts", () => {
    expect(SUBSEQUENT_INSTRUCTION_PLACEHOLDER).toBe("Tell him what to do next");
  });
});
