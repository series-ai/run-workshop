import { compileText } from "../text";

export const OPENING_BEATS = [
  { at: 0, voice: "thought", text: "Pitch black. Cold stone against my face." },
  { at: 6, voice: "thought", text: "I try to move.{{pause(0.250)}}.{{pause(0.250)}}..{{pause(0.750)}} I can't." },
  { at: 11, voice: "thought", text: "The cabinet. It's pinning me." },
  { at: 16, voice: "thought", text: "But no pain." },
  { at: 21, voice: "narrator", text: "You hear shuffling on the stone next to you." },
  { at: 25, voice: "thought", text: "Oh! My boy is here, in the dark. He must be so scared." },
] as const;
export const OPENING_DURATION = 32;

export function openingAt(elapsed: number) {
  const beat =
    [...OPENING_BEATS].reverse().find((beat) => elapsed >= beat.at) ??
    OPENING_BEATS[0];
  return {
    eyes: Math.max(0, Math.min(1, (elapsed - 8) / 6)),
    narration: elapsed < OPENING_DURATION ? beat.text : "",
    voice: beat.voice,
    age: Math.max(0, elapsed - beat.at),
    shuffle: elapsed >= 21 && elapsed < 25,
    call: 0,
    complete: elapsed >= OPENING_DURATION,
  };
}

function openingLine(elapsed: number) {
  const index = Math.max(0, OPENING_BEATS.reduce((found, beat, index) => elapsed >= beat.at ? index : found, 0));
  const beat = OPENING_BEATS[index];
  const text = beat.text;
  return {
    revealedAt: beat.at + compileText(text).duration,
    nextAt: OPENING_BEATS[index + 1]?.at ?? OPENING_DURATION,
  };
}

// Reading time does not advance the patient clock beyond the current line.
export function openingTickSeconds(elapsed: number, dt: number): number {
  if (elapsed >= OPENING_DURATION) return dt;
  return Math.max(0, Math.min(dt, openingLine(elapsed).revealedAt - elapsed));
}

export function openingClickSeconds(elapsed: number, instant = false): number {
  if (elapsed >= OPENING_DURATION) return 0;
  const line = openingLine(elapsed);
  return (instant || elapsed + 0.001 >= line.revealedAt ? line.nextAt : line.revealedAt) - elapsed;
}
