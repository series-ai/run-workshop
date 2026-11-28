/**
 * Crisp Micro-Pixel-Art RTS UI, Cursors, Selection Rings, Order Pings & Command Icons.
 *
 * Includes:
 *  - 4 Sizes of 3/4 Perspective Ground Selection Ellipses (sm, md, lg, bldg) x 4 Tactical States (selected, hover, enemy, ally)
 *  - 8 Crisp 16x16 Tactical RTS Cursors (default, attack 2f, move 2f, gather 2f, repair 2f, patrol, ability 2f, invalid)
 *  - 5 In-World Tactical Markers (move-ping 4f, attack-ping 4f, rally-flag 3f, minimap-ping 4f, build-grid ok/bad)
 *  - 12 Command Card & Resource HUD Icons (12x12: mineral, gold, gas, supply, move, stop, hold, attack, patrol, build, repair, rally)
 */

import { INK_OUTLINE } from './palette.ts';
import {
  addPixelOutline,
  blitScaled,
  compilePattern,
  createSurface,
  hexToU32,
  packRGBA,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';

export const UI_PAL: Readonly<Record<string, RGBA32>> = {
  K: INK_OUTLINE,
  w: hexToU32('#f7fbff'),
  m: hexToU32('#b8c7d9'),
  s: hexToU32('#76859c'),
  d: hexToU32('#3b4457'),
  // Emerald selection / move / valid
  G: hexToU32('#a6ffbe'),
  g: hexToU32('#3de870'),
  l: hexToU32('#189948'),
  // Crimson attack / enemy / invalid
  R: hexToU32('#ffadb8'),
  r: hexToU32('#ff4255'),
  u: hexToU32('#9e1b2d'),
  // Sky-blue ally / patrol / minerals
  C: hexToU32('#b5f4ff'),
  c: hexToU32('#3ecfff'),
  b: hexToU32('#197ad6'),
  // Gold / amber ability / repair / rich gold
  Y: hexToU32('#fff5b8'),
  y: hexToU32('#ffd042'),
  o: hexToU32('#d97d1e'),
  // Gas emerald
  V: hexToU32('#8cffcc'),
  v: hexToU32('#27bd7a'),
  // Subtle translucent fill
  t: packRGBA(61, 232, 112, 68),
  x: packRGBA(255, 66, 85, 72),
  p: packRGBA(62, 207, 255, 64),
};

export type SelectionState = 'selected' | 'hover' | 'enemy' | 'ally';

const SEL_COLORS: Readonly<Record<SelectionState, { hi: RGBA32; mid: RGBA32; shadow: RGBA32; fill: RGBA32 }>> = {
  selected: { hi: hexToU32('#9effb8'), mid: hexToU32('#36e36a'), shadow: packRGBA(14, 18, 26, 170), fill: packRGBA(54, 227, 106, 26) },
  hover:    { hi: hexToU32('#ffffff'), mid: hexToU32('#b7d4cc'), shadow: packRGBA(14, 18, 26, 130), fill: packRGBA(220, 245, 235, 22) },
  enemy:    { hi: hexToU32('#ffa3ad'), mid: hexToU32('#ff3d52'), shadow: packRGBA(20, 10, 18, 175), fill: packRGBA(255, 61, 82, 26) },
  ally:     { hi: hexToU32('#b8f0ff'), mid: hexToU32('#38bfff'), shadow: packRGBA(12, 16, 28, 165), fill: packRGBA(56, 191, 255, 24) },
};

/** Generates a razor-sharp 3/4 perspective pixel-art selection ellipse with 1px dark rim contrast. */
export function buildSelectionRing(w: number, h: number, state: SelectionState, dashed = false): PixelSurface {
  const s = createSurface(w, h, 0);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = w / 2 - 1.3;
  const ry = h / 2 - 1.3;
  const col = SEL_COLORS[state];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d <= 0.86) {
        s.pixels[y * w + x] = col.fill;
      } else if (d <= 1.04) {
        if (dashed && (((x + y) >> 1) & 1) === 1) continue;
        s.pixels[y * w + x] = y < cy ? col.hi : col.mid;
      } else if (d <= 1.22 && y >= cy - 1) {
        if (dashed && (((x + y) >> 1) & 1) === 1) continue;
        s.pixels[y * w + x] = col.shadow;
      }
    }
  }
  return s;
}

export interface UiSpriteSpec {
  readonly id: string;
  readonly name: string;
  readonly category: 'cursor' | 'marker' | 'icon';
  readonly outline: boolean;
  readonly frames: readonly (readonly string[])[];
}

export const UI_SPRITE_SPECS: readonly UiSpriteSpec[] = [
  // === 8 TACTICAL RTS CURSORS ===
  {
    id: 'cursor-default',
    name: 'Pointer',
    category: 'cursor',
    outline: true,
    frames: [[
      'w.........',
      'ww........',
      'wmw.......',
      'wmmw......',
      'wmmmw.....',
      'wmmmmw....',
      'wmmssww...',
      'wmsd......',
      'wd.sd.....',
      '....sd....',
    ]],
  },
  {
    id: 'cursor-attack',
    name: 'Attack Reticle',
    category: 'cursor',
    outline: true,
    frames: [
      [
        '....rr....',
        '..r.RR.r..',
        '.r......r.',
        'rR..ww..Rr',
        'rR..ww..Rr',
        '.r......r.',
        '..r.RR.r..',
        '....rr....',
      ],
      [
        '...r..r...',
        '.rr....rr.',
        'r...RR...r',
        '...RwwR...',
        '...RwwR...',
        'r...RR...r',
        '.rr....rr.',
        '...r..r...',
      ],
    ],
  },
  {
    id: 'cursor-move',
    name: 'Move Order',
    category: 'cursor',
    outline: true,
    frames: [
      [
        '....GG....',
        '...GggG...',
        '..GglggG..',
        '.gg....gg.',
        '....gg....',
        '...GggG...',
        '..gg..gg..',
        '..........',
      ],
      [
        '..........',
        '....GG....',
        '...GggG...',
        '..GglggG..',
        '.gg....gg.',
        '....gg....',
        '...GggG...',
        '..gg..gg..',
      ],
    ],
  },
  {
    id: 'cursor-gather',
    name: 'Gather Minerals',
    category: 'cursor',
    outline: true,
    frames: [
      [
        '....w.....',
        '...wCC....',
        '..CCcC.C..',
        '.CccbbCC..',
        '.cbb..cb..',
        '..bb..bb..',
        '....yy....',
        '...yooy...',
      ],
      [
        '....C.....',
        '...CwC....',
        '..CwCC.w..',
        '.CccbbCC..',
        '.cbb..cb..',
        '..bb..bb..',
        '....YY....',
        '...yyyy...',
      ],
    ],
  },
  {
    id: 'cursor-repair',
    name: 'Repair / Wrench',
    category: 'cursor',
    outline: true,
    frames: [
      [
        '.....yy...',
        '....yyYY..',
        '....y..Y..',
        '....yyy...',
        '...yoo....',
        '..yoo.....',
        '.yoo......',
        '.oo.......',
      ],
      [
        '....yy....',
        '...yyYY...',
        '...y..Y...',
        '...yyy....',
        '..yoo.....',
        '.yoo......',
        'yoo.......',
        'oo........',
      ],
    ],
  },
  {
    id: 'cursor-patrol',
    name: 'Patrol Arrows',
    category: 'cursor',
    outline: true,
    frames: [[
      '.....C....',
      '....CCC...',
      '.bbbbCCc..',
      '.....C....',
      '....C.....',
      '..cCCbbbb.',
      '...CCC....',
      '....C.....',
    ]],
  },
  {
    id: 'cursor-ability',
    name: 'Ability AOE',
    category: 'cursor',
    outline: true,
    frames: [
      [
        '...YYYY...',
        '.YY....YY.',
        'Y...CC...Y',
        'Y..CwwC..Y',
        'Y..CwwC..Y',
        'Y...CC...Y',
        '.YY....YY.',
        '...YYYY...',
      ],
      [
        '....YY....',
        '..Y....Y..',
        '.Y..ww..Y.',
        'Y..wCCw..Y',
        'Y..wCCw..Y',
        '.Y..ww..Y.',
        '..Y....Y..',
        '....YY....',
      ],
    ],
  },
  {
    id: 'cursor-invalid',
    name: 'Blocked / Invalid',
    category: 'cursor',
    outline: true,
    frames: [[
      'RR....RR',
      'rRR..RRr',
      '.rRRRRr.',
      '..rRRr..',
      '..rRRr..',
      '.rRRRRr.',
      'rRR..RRr',
      'RR....RR',
    ]],
  },

  // === 5 IN-WORLD ORDER FEEDBACK MARKERS ===
  {
    id: 'order-move-ping',
    name: 'Move Ping',
    category: 'marker',
    outline: false,
    frames: [
      ['G........G', '.g......g.', '..........', '..........', '.g......g.', 'G........G'],
      ['..........', '..G....G..', '...g..g...', '...g..g...', '..G....G..', '..........'],
      ['..........', '..........', '...GggG...', '...gGGg...', '..........', '..........'],
      ['..........', '..........', '....gg....', '....gg....', '..........', '..........'],
    ],
  },
  {
    id: 'order-attack-ping',
    name: 'Attack Ping',
    category: 'marker',
    outline: false,
    frames: [
      ['RR......RR', 'r........r', '..........', '..........', 'r........r', 'RR......RR'],
      ['..........', '.RR....RR.', '.r......r.', '.r......r.', '.RR....RR.', '..........'],
      ['..........', '..........', '..RRwwRR..', '..rRwwRr..', '..........', '..........'],
      ['..........', '..........', '....rr....', '....rr....', '..........', '..........'],
    ],
  },
  {
    id: 'rally-flag',
    name: 'Rally Point Flag',
    category: 'marker',
    outline: true,
    frames: [
      ['.wYYYYY...', '.wyyyyyY..', '.wooooo...', '.m........', '.m........', '.m........', '.m........', 'ddd.......'],
      ['.wYYYY....', '.wyyyyYY..', '.woooooy..', '.m........', '.m........', '.m........', '.m........', 'ddd.......'],
      ['.wYYYYY...', '.wyyyyyy..', '.woooo....', '.m........', '.m........', '.m........', '.m........', 'ddd.......'],
    ],
  },
  {
    id: 'build-grid-ok',
    name: 'Valid Build Tile',
    category: 'marker',
    outline: false,
    frames: [[
      'ggttttgg',
      'gttttttg',
      'tttttttt',
      'tttttttt',
      'tttttttt',
      'tttttttt',
      'gttttttg',
      'ggttttgg',
    ]],
  },
  {
    id: 'build-grid-bad',
    name: 'Blocked Build Tile',
    category: 'marker',
    outline: false,
    frames: [[
      'rrxxxxrr',
      'rxxxxxxr',
      'xxrxxrxx',
      'xxxrrxxx',
      'xxxrrxxx',
      'xxrxxrxx',
      'rxxxxxxr',
      'rrxxxxrr',
    ]],
  },

  // === 12 HUD RESOURCE & COMMAND CARD ICONS (10x10 core -> 12x12 outlined) ===
  {
    id: 'icon-mineral',
    name: 'Minerals',
    category: 'icon',
    outline: true,
    frames: [[
      '....w.....',
      '...wCC.C..',
      '.C.CCcCC..',
      'CC.CcbbC..',
      'CcbCbbbC..',
      '.bbbbbcb..',
      '..bbbbbb..',
    ]],
  },
  {
    id: 'icon-gold',
    name: 'Rich Gold',
    category: 'icon',
    outline: true,
    frames: [[
      '....w.....',
      '...wYY.Y..',
      '.Y.YYyYY..',
      'YY.YyooY..',
      'YyoYoooY..',
      '.oooooyo..',
      '..oooooo..',
    ]],
  },
  {
    id: 'icon-gas',
    name: 'Plasma Gas',
    category: 'icon',
    outline: true,
    frames: [[
      '....VV....',
      '...VvvV...',
      '..VvvvvV..',
      '..vVwwVv..',
      '..vvvvvv..',
      '...vvvv...',
      '....ll....',
    ]],
  },
  {
    id: 'icon-supply',
    name: 'Supply Cap',
    category: 'icon',
    outline: true,
    frames: [[
      '...wwww...',
      '..wmmmmw..',
      '..mYYYYm..',
      '...ssss...',
      '..smmmms..',
      '.smmmmmms.',
      '.dddddddd.',
    ]],
  },
  {
    id: 'icon-move',
    name: 'Move (M)',
    category: 'icon',
    outline: true,
    frames: [[
      '....GG....',
      '...GggG...',
      '..GggggG..',
      '....gg....',
      '...GggG...',
      '..GggggG..',
      '....gg....',
    ]],
  },
  {
    id: 'icon-stop',
    name: 'Stop (S)',
    category: 'icon',
    outline: true,
    frames: [[
      '..mmmmmm..',
      '.mwwwwwwm.',
      'mwwddddwwm',
      'mwdwwwwdwm',
      'mwwddddwwm',
      '.mwwwwwwm.',
      '..dddddd..',
    ]],
  },
  {
    id: 'icon-hold',
    name: 'Hold (H)',
    category: 'icon',
    outline: true,
    frames: [[
      '.CCbbbbCC.',
      'CbbbbbbbbC',
      'CbbwwwwbbC',
      '.CbbbbbbC.',
      '..CbbbbC..',
      '...CbbC...',
      '....bb....',
    ]],
  },
  {
    id: 'icon-attack',
    name: 'Attack (A)',
    category: 'icon',
    outline: true,
    frames: [[
      'w.......w.',
      'ww.....ww.',
      '.rr...rr..',
      '..rRRRr...',
      '.rr...rr..',
      'yy.....yy.',
      'o.......o.',
    ]],
  },
  {
    id: 'icon-patrol',
    name: 'Patrol (P)',
    category: 'icon',
    outline: true,
    frames: [[
      '.....C....',
      '....CCC...',
      '.bbbbCCc..',
      '.....C....',
      '...C......',
      '.cCCbbbb..',
      '..CCC.....',
    ]],
  },
  {
    id: 'icon-build',
    name: 'Build (B)',
    category: 'icon',
    outline: true,
    frames: [[
      '...YYYY...',
      '..YyyyyY..',
      '..yyyy....',
      '...oo.....',
      '...oo.....',
      '...oo.....',
      '..oooo....',
    ]],
  },
  {
    id: 'icon-repair',
    name: 'Repair (R)',
    category: 'icon',
    outline: true,
    frames: [[
      '...VV.....',
      '...VV.....',
      '.VVwwVV...',
      '.VVwwVV...',
      '...VV.....',
      '...VV.....',
      '...ll.....',
    ]],
  },
  {
    id: 'icon-rally',
    name: 'Rally (Y)',
    category: 'icon',
    outline: true,
    frames: [[
      '.wYYYYY...',
      '.wyyyyyY..',
      '.wooooo...',
      '.m........',
      '.m........',
      '.m........',
      'ddd.......',
    ]],
  },
];

export interface BakedUiSprite {
  readonly spec: UiSpriteSpec;
  readonly cellW: number;
  readonly cellH: number;
  readonly strip: PixelSurface;
  readonly frames: readonly PixelSurface[];
}

export function bakeAllUiSprites(): readonly BakedUiSprite[] {
  return UI_SPRITE_SPECS.map((spec) => {
    const frames = spec.frames.map((pat) => {
      const raw = compilePattern(pat, UI_PAL);
      return spec.outline ? addPixelOutline(raw, INK_OUTLINE) : raw;
    });
    const cellW = Math.max(...frames.map((f) => f.width));
    const cellH = Math.max(...frames.map((f) => f.height));
    const strip = createSurface(cellW * frames.length, cellH, 0);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      blitScaled(strip, f, i * cellW + Math.floor((cellW - f.width) / 2), Math.floor((cellH - f.height) / 2), 1);
    }
    return { spec, cellW, cellH, strip, frames };
  });
}
