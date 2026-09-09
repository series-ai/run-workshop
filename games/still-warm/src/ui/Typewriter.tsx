import { useEffect, useMemo, useState } from "react";

import { compileText, visibleCharacters } from "../text";

export function Typewriter({
  text,
  seconds,
  paused = false,
  instant = false,
}: {
  text: string;
  seconds?: number;
  paused?: boolean;
  instant?: boolean;
}) {
  const sequence = useMemo(() => compileText(text), [text]);
  const [clock, setClock] = useState({ text, seconds: 0 });
  const localSeconds = clock.text === text ? clock.seconds : 0;
  const forcedComplete = seconds !== undefined && seconds + 1e-6 >= sequence.duration;
  const displaySeconds = forcedComplete ? seconds : localSeconds;
  const finished = displaySeconds + 1e-6 >= sequence.duration;
  useEffect(() => {
    if (instant || paused || finished) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      setClock((old) => ({
        text,
        seconds: (old.text === text ? old.seconds : 0) + dt,
      }));
    }, 35);
    return () => clearInterval(timer);
  }, [text, instant, paused, finished]);
  const visible = instant
    ? Infinity
    : visibleCharacters(sequence, displaySeconds);
  let offset = 0;
  return (
    <span className="typewriter">
      <span className="sr-only">{sequence.text}</span>
      <span aria-hidden="true">
        {sequence.tokens.map((token, index) => {
          const letters = Array.from(token.text);
          const count = Math.max(0, Math.min(letters.length, visible - offset));
          offset += letters.length;
          const isWord = /\S/u.test(token.text);
          const className = isWord
            ? token.italic
              ? "typewriter-word typewriter-italic"
              : "typewriter-word"
            : undefined;
          return (
            <span
              className={className}
              key={index}
            >
              {letters.slice(0, count).join("")}
              <span className="typewriter-hidden">
                {letters.slice(count).join("")}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
