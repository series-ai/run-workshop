export const LETTERS_PER_SECOND = 28;

export interface TextToken {
  text: string;
  italic?: boolean;
}

export interface TextSequence {
  text: string;
  revealAt: number[];
  duration: number;
  tokens: TextToken[];
}

// Pause values are seconds. This parser does not execute source text.
export function compileText(source: string): TextSequence {
  const revealAt: number[] = [];
  const tokens: TextToken[] = [];
  let text = "";
  let duration = 0;
  let cursor = 0;

  const appendSpan = (content: string, italic: boolean) => {
    if (!content) return;
    for (const letter of Array.from(content)) {
      text += letter;
      duration += 1 / LETTERS_PER_SECOND;
      revealAt.push(duration);
    }
    for (const part of content.match(/\S+|\s+/gu) ?? []) {
      tokens.push(italic ? { text: part, italic: true } : { text: part });
    }
  };

  const parseFormatted = (segment: string) => {
    let segCursor = 0;
    for (const match of segment.matchAll(/\*([^*\n]+)\*/gu)) {
      if (match.index > segCursor) {
        appendSpan(segment.slice(segCursor, match.index), false);
      }
      appendSpan(match[1], true);
      segCursor = match.index + match[0].length;
    }
    if (segCursor < segment.length) {
      appendSpan(segment.slice(segCursor), false);
    }
  };

  for (const match of source.matchAll(/\{\{pause\((\d+(?:\.\d+)?)\)\}\}/gu)) {
    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds)) continue;
    parseFormatted(source.slice(cursor, match.index));
    duration += seconds;
    cursor = match.index + match[0].length;
  }
  parseFormatted(source.slice(cursor));
  return { text, revealAt, duration, tokens };
}

export function visibleCharacters(sequence: TextSequence, seconds: number): number {
  const next = sequence.revealAt.findIndex(at => at > seconds + 1e-6);
  return next < 0 ? sequence.revealAt.length : next;
}
