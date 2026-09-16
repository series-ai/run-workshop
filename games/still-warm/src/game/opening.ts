import { compileText } from "../text";

export const OPENING_BEATS = [
  { at: 0, voice: "thought", text: "Pitch black. Cold against my face. I'm pinned down." },
] as const;
export const OPENING_DURATION = 5;

export function openingAt(elapsed: number) {
  const beat =
    [...OPENING_BEATS].reverse().find((beat) => elapsed >= beat.at) ??
    OPENING_BEATS[0];
  return {
    eyes: Math.max(0, Math.min(1, elapsed / 2.5)),
    narration: elapsed < OPENING_DURATION ? beat.text : "",
    voice: beat.voice,
    age: Math.max(0, elapsed - beat.at),
    shuffle: false,
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
