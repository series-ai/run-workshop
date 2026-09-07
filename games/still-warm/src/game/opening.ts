export const OPENING_DURATION = 22;

export function openingAt(elapsed: number) {
  const eyes = Math.max(0, Math.min(1, (elapsed - 9) / 5));
  const narration =
    elapsed < 6
      ? "Total blackness. Something heavy is pushing down on your chest. Pain everywhere. Then you hear your boy’s voice."
      : elapsed >= 13 && elapsed < 17
        ? "You can hear the anxiety in your son’s voice."
        : elapsed >= 20
          ? "It’s dark. Maybe you can get him to light the lantern you keep on your workbench."
          : "";
  const speech =
    elapsed >= 6 && elapsed < 9
      ? "Dah? DAH?"
      : elapsed >= 17 && elapsed < 20
        ? "DAH? WHERE DAH?"
        : "";
  return { eyes, narration, speech, complete: elapsed >= OPENING_DURATION };
}
