import { describe, expect, it } from 'vitest';
import { BUTTONS } from '../sim/contraptions';
import { GLYPH_HEIGHT, GLYPH_WIDTH, pixelText } from './pixelFont';

describe('pixel font', () => {
  it('lays out glyphs 5 wide with a one-column gap', () => {
    const grid = pixelText('DUNKS');
    expect(grid).toHaveLength(GLYPH_HEIGHT);
    expect(grid.every((row) => row.length === 5 * GLYPH_WIDTH + 4)).toBe(true);
    // D starts with a full left column.
    expect(grid.every((row) => row[0])).toBe(true);
  });

  it('draws every digit and every label the yard shows', () => {
    for (const text of ['DUNKS', '0123456789', ...BUTTONS.map((button) => button.label)]) {
      expect(() => pixelText(text), text).not.toThrow();
    }
  });

  it('fails loudly on a character it cannot draw', () => {
    expect(() => pixelText('DUNK!')).toThrow('WRECK_YARD_PIXEL_GLYPH_MISSING');
  });
});
