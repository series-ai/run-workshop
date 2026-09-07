export const OPENING_DURATION = 22;

export function openingAt(elapsed: number) {
  const eyes = Math.max(0, Math.min(1, (elapsed - 9) / 5));
  const narration =
    elapsed < 6
      ? "Something heavy is pushing down on my chest. Pain everywhere."
      : elapsed >= 13 && elapsed < 17
        ? "It’s my boy. He sounds scared."
        : elapsed >= 20
          ? "It’s dark. The lantern is on my workbench. He can reach it."
          : "";
  const call =
    elapsed >= 6 && elapsed < 9 ? 1 : elapsed >= 17 && elapsed < 20 ? 2 : 0;
  return { eyes, narration, call, complete: elapsed >= OPENING_DURATION };
}
