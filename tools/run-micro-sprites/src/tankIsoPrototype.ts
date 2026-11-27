/**
 * Prototype v2: 8-Way Isometric Split-Hull + Independent-Turret Vanguard Siege Tank (22x20 core -> 24x22 outlined).
 *
 * Built directly from pixel-art RTS discipline + Codex (gpt-6.2-astra) art-direction critique:
 *  1. 22x20 core footprint with consistent projected 3D volume across ALL 8 headings (17x9 side, 14x12 end, 17x12 2:1 diagonals).
 *  2. Exposed parallel heavy track sponsons + broad sunlit pale-steel roof (m/s, w top-left bevel) + dark vertical armor (d/q)
 *     + team-blue accent panels (B) — matching Vanguard Bunker & Marine value hierarchy.
 *  3. Single-pass exterior 1px outline AFTER compositing raw hull + subtle under-turret `q` cast shadow + raw low beveled turret.
 *  4. True 2:1 diagonal barrel slope matching NE/SE/SW/NW hulls, 2px shaded barrel + chunky muzzle brake extending 3px+ past the nose.
 *  5. Fixed turret ring pivot during recoil (ONLY the barrel retracts along its firing axis); flash & shell spawn at exact muzzle pixel on A1.
 *  6. Upper-left lighting restored on mirrored headings (NW, W, SW) and track-matched contact shadows (zero oval gap on diagonals).
 *
 * Run: `node src/tankIsoPrototype.ts`
 * Outputs:
 *  - output/proof-tank-iso-8way.png   (3x contact sheet + Codex 1x/2x scale acceptance strip alongside Marine & Bunker)
 *  - output/tank-iso-prototype.html   (interactive Old vs New patrol + WASD drive + mouse turret aim + alpha cliff brushes)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAllBuildings } from './buildings.ts';
import { buildFactionPalette, INK_OUTLINE, SHADOW_GROUND, SHADOW_SOFT } from './palette.ts';
import {
  addPixelOutline,
  blendPixel,
  blitScaled,
  compilePattern,
  createSurface,
  encodePNG,
  fillRect,
  hexToU32,
  mirrorHorizontal,
  surfaceToDataURL,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';
import { WORLD_H, WORLD_W } from './terrain.ts';
import {
  buildDefaultBattleTilemap,
  buildTileset,
  composeTilemap,
  TILE_PX,
} from './tileset.ts';
import { compileTitanFrame } from './titans.ts';
import { compileUnitFrame } from './units.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = resolve(__dirname, '../output');

export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const DIRS_8: readonly Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const CORE_W = 22;
export const CORE_H = 20;
export const OUT_W = CORE_W + 2; // 24
export const OUT_H = CORE_H + 2; // 22

const VAN_PAL = buildFactionPalette('vanguard', 'default');

// Explicit turret-ring center in 22x20 core coordinates for each hull heading.
// All 8 turret sprites are authored around pivot (11, 8), so (pivotX - 11, pivotY - 8) seats them cleanly!
export const HULL_PIVOT: Readonly<Record<Dir8, readonly [number, number]>> = {
  N: [11, 7],
  NE: [11, 8],
  E: [10, 8],
  SE: [11, 8],
  S: [11, 7],
  SW: [11, 8],
  W: [12, 8],
  NW: [11, 8],
};

// ============================================================================
// 1. 8-WAY ISOMETRIC TANK HULLS (22x20 core — crisp angular tracks + steel deck)
// ============================================================================

function makeNorthHull(phase: number): readonly string[] {
  // Driving UP (away from camera):
  // Outer track/hull perimeter uses slate `q`/`d` (not near-black `k`) so the 1px #130f1e outline stays
  // razor-thin and matches the exact outline weight of the Marine & Bunker!
  const trL = (y: number): string => {
    const p = (y + phase) & 3;
    return p === 0 ? 'sqq' : p === 1 ? 'qdq' : p === 2 ? 'dsq' : 'qkq';
  };
  const trR = (y: number): string => {
    const p = (y + phase) & 3;
    return p === 0 ? 'qqs' : p === 1 ? 'qdq' : p === 2 ? 'qsd' : 'qkq';
  };
  return [
    '......................',
    '......................',
    '......................',
    '......................',
    '.....qd........dq.....',
    `.....qdwmmmmmmwdq.....`,
    `....${trL(0)}wBmmmmBs${trR(0)}....`,
    `....${trL(1)}wmmmmmmS${trR(1)}....`.replace('S', 's'),
    `....${trL(2)}sBmmmmBs${trR(2)}....`,
    `....${trL(3)}dssssssd${trR(3)}....`,
    `....${trL(0)}qddddddq${trR(0)}....`,
    `....${trL(1)}dkffdkfd${trR(1)}....`,
    `....${trL(2)}dkffdkfd${trR(2)}....`,
    `....${trL(3)}qddqqddq${trR(3)}....`,
    `....${trL(0)}dddddddd${trR(0)}....`,
    '....qdqqddddddqqdq....',
    '......................',
    '......................',
    '......................',
    '......................',
  ];
}

function makeSouthHull(phase: number): readonly string[] {
  // Driving DOWN (toward camera):
  // Bright sunlit pale-steel + cobalt sloped front glacis wedge + slate `q`/`d` outer track casing (1px outline weight!).
  const trL = (y: number): string => {
    const p = (y - phase + 8) & 3;
    return p === 0 ? 'sqq' : p === 1 ? 'qdq' : p === 2 ? 'dsq' : 'qkq';
  };
  const trR = (y: number): string => {
    const p = (y - phase + 8) & 3;
    return p === 0 ? 'qqs' : p === 1 ? 'qdq' : p === 2 ? 'qsd' : 'qkq';
  };
  return [
    '......................',
    '......................',
    '......................',
    '......................',
    '.....qdqqddddqqdq.....',
    `.....qddkkddkkddq.....`,
    `....${trL(0)}wmmmmmmw${trR(0)}....`,
    `....${trL(1)}wmmmmmmS${trR(1)}....`.replace('S', 's'),
    `....${trL(2)}sBmmmmBs${trR(2)}....`,
    `....${trL(3)}wwwwwwww${trR(3)}....`,
    `....${trL(0)}vmmmmmmv${trR(0)}....`,
    `....${trL(1)}wBmmmmBw${trR(1)}....`,
    `....${trL(2)}sBBmmBBs${trR(2)}....`,
    `....${trL(3)}dDDssDDd${trR(3)}....`,
    `....${trL(0)}qddddddq${trR(0)}....`,
    '....qdqqddddddqqdq....',
    '......qqddddddqq......',
    '......................',
    '......................',
    '......................',
  ];
}

function makeEastHull(phase: number): readonly string[] {
  // 17px wide (x1..17), 9px tall (y6..14): slate `q`/`d` outer track rim + interior `k` tread recesses so outline stays 1px crisp!
  const c = (i: number): string => {
    const p = (i - phase + 16) & 3;
    return p === 0 ? 's' : p === 1 ? 'k' : p === 2 ? 'd' : 'q';
  };
  const rTop = Array.from({ length: 14 }, (_, i) => c(i)).join('');
  const rBot = Array.from({ length: 14 }, (_, i) => c(i + 2)).join('');
  return [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '...wmmmmmmmmms........',
    '..wmmmmmmmmmmms.......',
    '.qkmmmmmmmmmmmmw......',
    '.dfqBBmmmmmmBBmmw.....',
    '.qddDDssssssDDsmvs....',
    '.qqqqqqqqqqqqqqqds....',
    `.q${rTop}dq....`,
    `.q${rBot}dq....`,
    '..qqdddddddddddqq.....',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ];
}

function makeDiagNEHull(phase: number): readonly string[] {
  // True 2:1 isometric parallelogram heading UP-RIGHT (NE), x3..19 (17px), y4..15 (12px):
  // Outer track perimeter uses `q`/`d` (reserving `k` for interior recesses) for razor-thin 1px outline matching Marines!
  const t = (i: number): string => {
    const p = (i + phase) & 3;
    return p === 0 ? 's' : p === 1 ? 'k' : p === 2 ? 'd' : 'q';
  };
  return [
    '......................',
    '......................',
    '......................',
    '......................',
    '............dqd.......',
    '..........dqwmmwq.....',
    '........dqwmmmmmmBq...',
    '......dqwmmmmmmmBBdq..',
    `....dqwmmmmmmmmBBs${t(0)}q..`,
    `...qwmmmmmmmmmmBBd${t(1)}q..`,
    `...qddmmmmmmmBBdq${t(1)}${t(2)}q..`,
    `...qdkfdmmmmBdq${t(2)}${t(3)}q....`,
    `...qqddkfdBdq${t(3)}${t(0)}q......`,
    `.....qqqddq${t(0)}${t(1)}q........`,
    `.......qqd${t(1)}q..........`,
    '........dq............',
    '......................',
    '......................',
    '......................',
    '......................',
  ];
}

function makeDiagSEHull(phase: number): readonly string[] {
  // True 2:1 isometric parallelogram heading DOWN-RIGHT (SE), x3..19 (17px), y4..15 (12px):
  // Outer track perimeter uses `q`/`d` so the single exterior #130f1e outline never thickens into a 2px black slab!
  const t = (i: number): string => {
    const p = (i - phase + 8) & 3;
    return p === 0 ? 's' : p === 1 ? 'k' : p === 2 ? 'd' : 'q';
  };
  return [
    '......................',
    '......................',
    '......................',
    '......................',
    '........dqd...........',
    '......dqdmmqd.........',
    '....dqdkmmmmmqd.......',
    '...qwmmmmmmmmmBqd.....',
    `...q${t(0)}BmmmmmmmmmmBqd...`,
    `...q${t(1)}qBmmmmmmmmmmvsq..`,
    `...q${t(2)}${t(3)}qBmmmmmmmssddq..`,
    `.....q${t(3)}${t(0)}qBBmmvssddqq..`,
    `.......q${t(0)}${t(1)}qDDssddqq...`,
    `.........q${t(1)}${t(2)}qdddqq....`,
    `...........q${t(2)}dqq......`,
    '............dq........',
    '......................',
    '......................',
    '......................',
    '......................',
  ];
}

// Restore consistent upper-left directional lighting after mirroring E->W, NE->NW, SE->SW!
function relightMirroredSteel(raw: PixelSurface): PixelSurface {
  const out = createSurface(raw.width, raw.height);
  out.pixels.set(raw.pixels);
  const wCol = VAN_PAL.w;
  const mCol = VAN_PAL.m;
  const sCol = VAN_PAL.s;
  const dCol = VAN_PAL.d;
  const qCol = VAN_PAL.q;

  const at = (x: number, y: number): RGBA32 =>
    x >= 0 && y >= 0 && x < raw.width && y < raw.height ? raw.pixels[y * raw.width + x] : 0;

  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      const px = at(x, y);
      if (px === 0) continue;
      const leftEmpty = at(x - 1, y) === 0 || at(x - 1, y) === VAN_PAL.k || at(x - 1, y) === VAN_PAL.q;
      const topEmpty = at(x, y - 1) === 0 || at(x, y - 1) === VAN_PAL.k || at(x, y - 1) === VAN_PAL.q;
      const rightEmpty = at(x + 1, y) === 0 || at(x + 1, y) === VAN_PAL.k || at(x + 1, y) === VAN_PAL.q;
      const botEmpty = at(x, y + 1) === 0 || at(x, y + 1) === VAN_PAL.k || at(x, y + 1) === VAN_PAL.q;

      // Demote highlight that landed on a shadowed right/bottom edge after mirror
      if (px === wCol && (rightEmpty || botEmpty) && !leftEmpty && !topEmpty) {
        out.pixels[y * raw.width + x] = mCol;
      } else if ((px === mCol || px === sCol) && (leftEmpty || topEmpty) && !botEmpty) {
        // Promote top-left steel bevel into sunlight
        out.pixels[y * raw.width + x] = wCol;
      } else if (px === qCol && leftEmpty && !botEmpty) {
        out.pixels[y * raw.width + x] = dCol;
      }
    }
  }
  return out;
}

// ============================================================================
// 2. LOW BEVELED ANGULAR TURRETS + HEAVY 2px CANNON (22x20 core, pivot = (11, 8))
//    - Broad pale-steel roof (m/s, w bevel) + B team accent (NOT an all-blue dome!)
//    - Short `q` under-turret cast shadow grounds it onto the hull deck
//    - 3px gun mantlet + 2px shaded barrel + chunky muzzle brake (3px+ nose clearance!)
//    - FIXED turret body on recoil (A1..A3): ONLY the barrel retracts along its axis!
// ============================================================================

const TURRET_N: readonly (readonly string[])[] = [
  // 0: Idle (straight 2px heavy cannon + symmetric muzzle brake at y=1..2 -> lands at y=0..1 on N hull, 4px clear of hull!)
  [
    '......................',
    '..........ww..........',
    '..........sd..........',
    '..........wd..........',
    '..........wd..........',
    '.........dwd..........',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBmmmBd........',
    '.......qDBBBDq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 1: BLAST (barrel retracts 2px down, flash y1..3 -> lands at y0..2 on N hull with zero clipping; turret FIXED at y=6..9!)
  [
    '......................',
    '.........fFf..........',
    '........fFFFf.........',
    '.........fFf..........',
    '..........ww..........',
    '.........dwd..........',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBmmmBd........',
    '.......qDBBBDq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 2: Recoil smoke (barrel recovering -1px)
  [
    '......................',
    '.........ew...........',
    '..........ww..........',
    '..........wd..........',
    '..........wd..........',
    '.........dwd..........',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBmmmBd........',
    '.......qDBBBDq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 3: Settled
  [
    '......................',
    '..........ww..........',
    '..........sd..........',
    '..........wd..........',
    '..........wd..........',
    '.........dwd..........',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBmmmBd........',
    '.......qDBBBDq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
];

const TURRET_NE: readonly (readonly string[])[] = [
  // 0: Idle (exact 2:1 barrel stepping up-right to x20..21, y2..3!)
  [
    '......................',
    '......................',
    '...................ws.',
    '.................wwdq.',
    '...............wwdq...',
    '.............swdq.....',
    '........wmmmsqd.......',
    '.......sBmmBBd........',
    '.......dBBBBdq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 1: BLAST (barrel retracts 1 step SW, solidly connected to mantlet; turret FIXED at y6..9!)
  [
    '...................f..',
    '..................fFf.',
    '.................fFFFf',
    '...............wwdfFf.',
    '..............wwdk....',
    '.............swdk.....',
    '........wmmmskd.......',
    '.......sBmmBBd........',
    '.......dBBBBdq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 2: Recoil smoke
  [
    '......................',
    '..................ew..',
    '.................ewwe.',
    '................wdk...',
    '..............wwdk....',
    '.............swdk.....',
    '........wmmmskd.......',
    '.......sBmmBBd........',
    '.......dBBBBdq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 3: Settled
  [
    '......................',
    '...................e..',
    '...................ws.',
    '.................wwdq.',
    '...............wwdq...',
    '.............swdq.....',
    '........wmmmsqd.......',
    '.......sBmmBBd........',
    '.......dBBBBdq........',
    '........qqqqq.........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
];

const TURRET_E: readonly (readonly string[])[] = [
  // 0: Idle (heavy 2px horizontal cannon + chunky muzzle brake reaching x=21 -> x=20 on E hull = exact 3px clear past x=17 track & 4px past x=16 nose!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms.........',
    '.......wBmmBBswwwwwwws',
    '.......sBvvBBddddddddd',
    '.......dDDDDdd........',
    '........qqqqqq........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 1: BLAST (barrel retracts 2px left, turret FIXED at x7..13!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '...................f..',
    '........wmmms.....fFf.',
    '.......wBmmBBswwwfFFFf',
    '.......sBvvBBddddfFFFf',
    '.......dDDDDdd.....f..',
    '........qqqqqq........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 2: Recoil smoke
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '..................ew..',
    '........wmmms....ewwe.',
    '.......wBmmBBswwwwwwwe',
    '.......sBvvBBdddddkk..',
    '.......dDDDDdd........',
    '........qqqqqq........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 3: Settled
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms......e..',
    '.......wBmmBBswwwwwwws',
    '.......sBvvBBddddddddd',
    '.......dDDDDdd........',
    '........qqqqqq........',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
];

const TURRET_SE: readonly (readonly string[])[] = [
  // 0: Idle (exact 2:1 diagonal barrel matching NE slope! Tip at x20..21, y11..12 — 3px clear of nose & headlights!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms.........',
    '.......wBmmBBd........',
    '.......sBvvBBsw.......',
    '.......dDDDDddww......',
    '........qqqqq.dqww....',
    '................dqww..',
    '..................dqws',
    '....................dq',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 1: BLAST (barrel retracts 1 step NW, turret FIXED at y5..8!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms.........',
    '.......wBmmBBd........',
    '.......sBvvBBsw.......',
    '.......dDDDDddww......',
    '........qqqqq.dkwf....',
    '................dfFf..',
    '................fFFFf.',
    '.................fFf..',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 2: Recoil smoke
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms.........',
    '.......wBmmBBd........',
    '.......sBvvBBsw.......',
    '.......dDDDDddww......',
    '........qqqqq.dkww....',
    '................dkwe..',
    '.................ewwe.',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
  // 3: Settled
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........wmmms.........',
    '.......wBmmBBd........',
    '.......sBvvBBsw.......',
    '.......dDDDDddww......',
    '........qqqqq.dkww....',
    '................dkww..',
    '..................dkws',
    '....................e.',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
  ],
];

const TURRET_S: readonly (readonly string[])[] = [
  // 0: Idle (straight 2px heavy vertical barrel + symmetric muzzle cap at y=18..19 -> y=17..18 on S hull, 2-3px clear below prow!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBvvBBd........',
    '.......dDswdDd........',
    '........qswdq.........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........ww..........',
    '..........dq..........',
  ],
  // 1: BLAST (barrel retracts 2px up, turret FIXED at y5..8!)
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBvvBBd........',
    '.......dDswdDd........',
    '........qswdq.........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........ww..........',
    '.........fFf..........',
    '........fFFFf.........',
    '.........fFf..........',
    '......................',
  ],
  // 2: Recoil smoke
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBvvBBd........',
    '.......dDswdDd........',
    '........qswdq.........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........wk..........',
    '..........ww..........',
    '.........ew...........',
    '........ewwe..........',
    '......................',
  ],
  // 3: Settled
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '........dmmmd.........',
    '.......dBmmmBd........',
    '.......dBvvBBd........',
    '.......dDswdDd........',
    '........qswdq.........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........wd..........',
    '..........ww..........',
    '..........dq..........',
  ],
];

// ============================================================================
// 3. RAW COMPILATION + SINGLE-PASS EXTERIOR OUTLINE + TRACK-MATCHED SHADOW
// ============================================================================

export function compileRawHull(dir: Dir8, phase: number): PixelSurface {
  const mirror = dir === 'NW' || dir === 'W' || dir === 'SW';
  const baseDir: Dir8 = dir === 'NW' ? 'NE' : dir === 'W' ? 'E' : dir === 'SW' ? 'SE' : dir;
  const rows =
    baseDir === 'N'
      ? makeNorthHull(phase)
      : baseDir === 'S'
        ? makeSouthHull(phase)
        : baseDir === 'NE'
          ? makeDiagNEHull(phase)
          : baseDir === 'SE'
            ? makeDiagSEHull(phase)
            : makeEastHull(phase);
  const raw = compilePattern(rows, VAN_PAL, CORE_W, CORE_H);
  if (!mirror) return raw;
  return relightMirroredSteel(mirrorHorizontal(raw));
}

export function compileRawTurret(dir: Dir8, atkFrame: number): PixelSurface {
  const mirror = dir === 'NW' || dir === 'W' || dir === 'SW';
  const baseDir: Dir8 = dir === 'NW' ? 'NE' : dir === 'W' ? 'E' : dir === 'SW' ? 'SE' : dir;
  const list =
    baseDir === 'N'
      ? TURRET_N
      : baseDir === 'S'
        ? TURRET_S
        : baseDir === 'NE'
          ? TURRET_NE
          : baseDir === 'SE'
            ? TURRET_SE
            : TURRET_E;
  const raw = compilePattern(list[atkFrame % list.length], VAN_PAL, CORE_W, CORE_H);
  if (!mirror) return raw;
  // Preserve barrel/flash luminance cleanly while flipping geometry; relight only the turret roof
  const flipped = mirrorHorizontal(raw);
  return relightMirroredSteel(flipped);
}

/**
 * Derives exact A1 muzzle-flash centroid relative to turret pivot (11, 8) directly from the
 * painted bright flash core (`F`, #fff7cc) in `compileRawTurret(dir, 1)` — guaranteeing the
 * projectile ALWAYS spawns strictly inside the rendered A1 muzzle flash across all 8 headings!
 */
export function computeMuzzleRel(dir: Dir8): readonly [number, number] {
  const a1 = compileRawTurret(dir, 1);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < a1.height; y++) {
    for (let x = 0; x < a1.width; x++) {
      if (a1.pixels[y * a1.width + x] === VAN_PAL.F) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) return [0, 0];
  return [Math.round(sumX / count) - 11, Math.round(sumY / count) - 8];
}

export const MUZZLE_REL_8: Readonly<Record<Dir8, readonly [number, number]>> = {
  N: computeMuzzleRel('N'),
  NE: computeMuzzleRel('NE'),
  E: computeMuzzleRel('E'),
  SE: computeMuzzleRel('SE'),
  S: computeMuzzleRel('S'),
  SW: computeMuzzleRel('SW'),
  W: computeMuzzleRel('W'),
  NW: computeMuzzleRel('NW'),
};

/**
 * Generates an exact track-hugging contact shadow in 24x22 outlined coordinates
 * directly from the hull's lower footprint (ZERO horizontal oval gaps under NE/SE/NW/SW!).
 */
export function buildHullContactShadow(hullDir: Dir8): PixelSurface {
  const raw = compileRawHull(hullDir, 0);
  const sh = createSurface(OUT_W, OUT_H);
  // Project hull pixels onto ground shifted +1px down (and +1px in outline coordinates -> ox = x+1, oy = y+2)
  for (let y = 0; y < CORE_H; y++) {
    for (let x = 0; x < CORE_W; x++) {
      if (raw.pixels[y * CORE_W + x] === 0) continue;
      // Only ground-adjacent lower 65% of hull casts contact shadow tightly beneath tracks
      const ox = x + 1;
      const oy = y + 2;
      if (oy < OUT_H) sh.pixels[oy * OUT_W + ox] = SHADOW_GROUND;
      if (oy + 1 < OUT_H) {
        const idx = (oy + 1) * OUT_W + ox;
        if (sh.pixels[idx] === 0) sh.pixels[idx] = SHADOW_SOFT;
      }
    }
  }
  return sh;
}

/**
 * Single-pass compositing: raw hull + pivot-aligned raw turret -> ONE exterior 1px INK_OUTLINE!
 * Eliminates the harsh black moat around the turret while keeping the silhouette razor-sharp.
 */
export function composeIsoTank(
  hullDir: Dir8,
  turretDir: Dir8,
  phase = 0,
  atkFrame = 0,
): PixelSurface {
  const hull = compileRawHull(hullDir, phase);
  const turret = compileRawTurret(turretDir, atkFrame);
  const [px, py] = HULL_PIVOT[hullDir];
  const dx = px - 11;
  const dy = py - 8;

  const combined = createSurface(CORE_W, CORE_H);
  combined.pixels.set(hull.pixels);
  for (let y = 0; y < CORE_H; y++) {
    const ty = y - dy;
    if (ty < 0 || ty >= CORE_H) continue;
    for (let x = 0; x < CORE_W; x++) {
      const tx = x - dx;
      if (tx < 0 || tx >= CORE_W) continue;
      const src = turret.pixels[ty * CORE_W + tx];
      if (src !== 0) combined.pixels[y * CORE_W + x] = src;
    }
  }
  return addPixelOutline(combined, INK_OUTLINE);
}

// ============================================================================
// 4. CONTACT SHEET + CODEX ACCEPTANCE TEST PROOF PNG
// ============================================================================

function buildTankContactProof(): PixelSurface {
  const cellW = 84;
  const cellH = 78;
  const cols = 8;
  const topRows = 3; // Row 0: 8 headings | Row 1: 8 hulls, ALL turrets aimed E | Row 2: Old vs New + 4f NE recoil
  const pad = 2;
  const W = cols * cellW + (cols + 1) * pad;
  const topH = topRows * cellH + (topRows + 1) * pad;

  // Row 3: Codex Acceptance Strip on real battle dirt — 1x native scale + 2x closeup alongside Marine & Bunker!
  const stripH = 112;
  const H = topH + stripH + pad;
  const sheet = createSurface(W, H, hexToU32('#0d1018'));

  const bgDark = createSurface(cellW, cellH, hexToU32('#171c28'));
  const bgDirt = createSurface(cellW, cellH, hexToU32('#6b523e'));
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      if ((((x >> 3) + (y >> 3)) & 1) === 0) {
        bgDark.pixels[y * cellW + x] = hexToU32('#1c2230');
        bgDirt.pixels[y * cellW + x] = hexToU32('#765b44');
      }
    }
  }

  const drawCell = (
    col: number,
    row: number,
    bar: RGBA32,
    bg: PixelSurface,
    sp: PixelSurface,
    shadow: PixelSurface | null,
    zoom = 3,
  ) => {
    const cx = pad + col * (cellW + pad);
    const cy = pad + row * (cellH + pad);
    blitScaled(sheet, bg, cx, cy, 1);
    fillRect(sheet, cx, cy, cellW, 2, bar);
    const ox = cx + Math.floor((cellW - sp.width * zoom) / 2);
    const oy = cy + Math.floor((cellH - sp.height * zoom) / 2) + 2;
    if (shadow) blitScaled(sheet, shadow, ox, oy, zoom);
    blitScaled(sheet, sp, ox, oy, zoom);
  };

  // Row 0: All 8 headings (aligned turret + track-matched contact shadow)
  for (let c = 0; c < 8; c++) {
    const d = DIRS_8[c];
    drawCell(c, 0, hexToU32('#38bdf8'), bgDark, composeIsoTank(d, d, 0, 0), buildHullContactShadow(d));
  }

  // Row 1: Codex Acceptance Test (3x) — All 8 hulls with EVERY turret aimed EAST!
  for (let c = 0; c < 8; c++) {
    const d = DIRS_8[c];
    drawCell(c, 1, hexToU32('#a855f7'), bgDirt, composeIsoTank(d, 'E', 0, 0), buildHullContactShadow(d));
  }

  // Row 2: [0] Old Tank NE vs [1] New N vs [2] New NE vs [3] New SE | [4..7] 4-frame NE barrel-only recoil + blast!
  drawCell(0, 2, hexToU32('#ef4444'), bgDirt, compileTitanFrame('vanguard-tank', 'move', 'NE', 0).outlined, null);
  drawCell(1, 2, hexToU32('#22c55e'), bgDirt, composeIsoTank('N', 'N', 0, 0), buildHullContactShadow('N'));
  drawCell(2, 2, hexToU32('#22c55e'), bgDirt, composeIsoTank('NE', 'NE', 0, 0), buildHullContactShadow('NE'));
  drawCell(3, 2, hexToU32('#22c55e'), bgDirt, composeIsoTank('SE', 'SE', 0, 0), buildHullContactShadow('SE'));
  for (let f = 0; f < 4; f++) {
    drawCell(4 + f, 2, hexToU32('#f97316'), bgDark, composeIsoTank('NE', 'NE', 0, f), buildHullContactShadow('NE'));
  }

  // Row 3: Real battle-dirt strip — Left half 1x NATIVE game scale, Right half 2x closeup (Marine + Bunker + all 8 hulls aimed E)
  const tileset = buildTileset();
  const dirtCols = Math.ceil((W - pad * 2) / TILE_PX);
  const dirtRows = Math.ceil(stripH / TILE_PX);
  const dirtMap = {
    gridW: dirtCols + 1,
    gridH: dirtRows + 1,
    biomes: new Array((dirtCols + 1) * (dirtRows + 1)).fill('dirt' as const),
    ramps: [],
  };
  const dirtSurf = composeTilemap(dirtMap, tileset);
  for (let y = 0; y < stripH; y++) {
    for (let x = 0; x < W - pad * 2; x++) {
      sheet.pixels[(topH + y) * W + pad + x] = dirtSurf.pixels[y * dirtSurf.width + x];
    }
  }
  fillRect(sheet, pad, topH, W - pad * 2, 2, hexToU32('#eab308'));

  const marine = compileUnitFrame('vanguard-trooper', 'idle', 'SE', 0).outlined;
  const bunker = buildAllBuildings()['vanguard-turret'].surface;

  // 1x native scale acceptance lineup (top half of Row 3: y = topH + 10)
  const y1x = topH + 14;
  blitScaled(sheet, bunker, pad + 14, y1x + 2, 1);
  blitScaled(sheet, marine, pad + 44, y1x + 12, 1);
  for (let i = 0; i < 8; i++) {
    const d = DIRS_8[i];
    const tx = pad + 64 + i * 30;
    blitScaled(sheet, buildHullContactShadow(d), tx, y1x, 1);
    blitScaled(sheet, composeIsoTank(d, 'E', 0, 0), tx, y1x, 1);
  }
  // Second 1x lineup on the right side with turrets aligned to each hull's own heading!
  for (let i = 0; i < 8; i++) {
    const d = DIRS_8[i];
    const tx = pad + 332 + i * 32;
    blitScaled(sheet, buildHullContactShadow(d), tx, y1x, 1);
    blitScaled(sheet, composeIsoTank(d, d, 0, 0), tx, y1x, 1);
  }

  // 2x game-scale closeup lineup (bottom half of Row 3: y = topH + 54)
  const y2x = topH + 56;
  blitScaled(sheet, bunker, pad + 14, y2x + 6, 2);
  blitScaled(sheet, marine, pad + 72, y2x + 24, 2);
  for (let i = 0; i < 8; i++) {
    const d = DIRS_8[i];
    const tx = pad + 106 + i * 68;
    blitScaled(sheet, buildHullContactShadow(d), tx, y2x, 2);
    blitScaled(sheet, composeIsoTank(d, 'E', 0, 0), tx, y2x, 2);
  }

  return sheet;
}

// ============================================================================
// 5. INTERACTIVE PROTOTYPE HTML (Single-pass outline compositor + A1 muzzle sync)
// ============================================================================

function buildInteractivePrototypeHTML(): string {
  const tileset = buildTileset();
  const tilemap = buildDefaultBattleTilemap(WORLD_W / TILE_PX, WORLD_H / TILE_PX);
  const terrain = composeTilemap(tilemap, tileset);

  // Raw sheets (22x20 cells, un-outlined -> composited + single-pass outlined on demand in JS!)
  const rawHullSheet = createSurface(4 * CORE_W, 8 * CORE_H);
  const rawTurretSheet = createSurface(4 * CORE_W, 8 * CORE_H);
  const shadowSheet = createSurface(8 * OUT_W, OUT_H);
  for (let d = 0; d < 8; d++) {
    blitScaled(shadowSheet, buildHullContactShadow(DIRS_8[d]), d * OUT_W, 0, 1);
    for (let p = 0; p < 4; p++) {
      blitScaled(rawHullSheet, compileRawHull(DIRS_8[d], p), p * CORE_W, d * CORE_H, 1);
      blitScaled(rawTurretSheet, compileRawTurret(DIRS_8[d], p), p * CORE_W, d * CORE_H, 1);
    }
  }

  // Old flat tank sheet + Bunker + Marine for in-scene scale reference
  const oldSheet = createSurface(4 * 20, 4 * 16);
  const oldFacings = ['SE', 'SW', 'NE', 'NW'] as const;
  for (let r = 0; r < 4; r++) {
    for (let f = 0; f < 4; f++) {
      blitScaled(oldSheet, compileTitanFrame('vanguard-tank', 'move', oldFacings[r], f).outlined, f * 20, r * 16, 1);
    }
  }
  const bunkerSurf = buildAllBuildings()['vanguard-turret'].surface;
  const marineSurf = compileUnitFrame('vanguard-trooper', 'idle', 'SE', 0).outlined;

  const payload = JSON.stringify({
    worldW: WORLD_W,
    worldH: WORLD_H,
    viewW: 320,
    viewH: 180,
    coreW: CORE_W,
    coreH: CORE_H,
    outW: OUT_W,
    outH: OUT_H,
    pivots: DIRS_8.map((d) => HULL_PIVOT[d]),
    muzzles: DIRS_8.map((d) => MUZZLE_REL_8[d]),
    terrainUrl: surfaceToDataURL(terrain),
    atlasUrl: surfaceToDataURL(tileset.atlas),
    tilemap,
    hullUrl: surfaceToDataURL(rawHullSheet),
    turretUrl: surfaceToDataURL(rawTurretSheet),
    shadowUrl: surfaceToDataURL(shadowSheet),
    oldUrl: surfaceToDataURL(oldSheet),
    bunkerUrl: surfaceToDataURL(bunkerSurf),
    marineUrl: surfaceToDataURL(marineSurf),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="icon" href="data:," />
<title>8-Way Isometric Siege Tank v2 + Alpha Cliffs Prototype</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    color: var(--foreground, #e5e7eb);
  }
  .root { width: 100%; display: flex; flex-direction: column; gap: 8px; }
  .bar {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 6px; padding: 6px 8px;
    background: var(--card, rgba(24,24,30,0.85));
    border: 1px solid var(--border, rgba(255,255,255,0.12));
    border-radius: var(--radius, 10px);
  }
  .grp { display: flex; align-items: center; flex-wrap: wrap; gap: 3px; }
  .lbl {
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--muted-foreground, #9ca3af); margin-right: 3px;
  }
  button.pill {
    appearance: none;
    border: 1px solid var(--border, rgba(255,255,255,0.14));
    background: var(--secondary, rgba(255,255,255,0.06));
    color: var(--foreground, #f3f4f6);
    font-size: 11px; font-weight: 600; padding: 3px 7px; border-radius: 6px;
    cursor: pointer; white-space: nowrap;
  }
  button.pill.active {
    background: var(--primary, #3b82f6); color: #fff; border-color: transparent;
  }
  .stage {
    position: relative; width: 100%; aspect-ratio: 16 / 9;
    background: #10131c;
    border: 1px solid var(--border, rgba(255,255,255,0.16));
    border-radius: var(--radius, 10px); overflow: hidden; user-select: none; touch-action: none;
  }
  canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
  .tag {
    position: absolute; top: 8px; left: 8px;
    padding: 4px 9px; border-radius: 999px;
    background: rgba(12,14,22,0.82); border: 1px solid rgba(255,255,255,0.15);
    font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; color: #f1f5f9;
    pointer-events: none;
  }
  .hint {
    position: absolute; bottom: 8px; right: 8px;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(12,14,22,0.75); border: 1px solid rgba(255,255,255,0.12);
    font-size: 10.5px; color: #cbd5e1; pointer-events: none;
  }
</style>
</head>
<body>
<div class="root">
  <div class="bar">
    <div class="grp">
      <span class="lbl">Tank</span>
      <button class="pill active" data-demo="compare">Old vs New</button>
      <button class="pill" data-demo="drive">WASD Drive</button>
    </div>
    <div class="grp">
      <span class="lbl">Alpha Cliff Brush</span>
      <button class="pill active" data-brush="fire">Aim &amp; Fire</button>
      <button class="pill" data-brush="grass">Grass</button>
      <button class="pill" data-brush="dirt">Dirt</button>
      <button class="pill" data-brush="creep">Creep</button>
      <button class="pill" data-brush="plateau">Cliff</button>
    </div>
    <div class="grp">
      <button class="pill active" id="btn-tracks">Tracks</button>
      <button class="pill" id="btn-pause">Pause</button>
    </div>
  </div>
  <div class="stage">
    <canvas id="cv" width="320" height="180"></canvas>
    <div class="tag" id="tag">GREEN = New 22x20 Split-Hull Iso Tank · RED = Old Flat Tank</div>
    <div class="hint" id="hint">Move mouse to aim turret · Click fires from exact muzzle tip</div>
  </div>
</div>

<script>
const D = ${payload};
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const st = {
  demo: 'compare',
  brush: 'fire',
  tracks: true,
  paused: false,
  mouseX: 256,
  mouseY: 96,
  camX: 96,
  camY: 22,
};

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const tCanvas = document.createElement('canvas');
tCanvas.width = D.worldW; tCanvas.height = D.worldH;
const tCtx = tCanvas.getContext('2d'); tCtx.imageSmoothingEnabled = false;
const liveBiomes = D.tilemap.biomes.slice();
const GW = D.tilemap.gridW, GH = D.tilemap.gridH, RAMPS = D.tilemap.ramps;

let atlasImg, hullImg, turretImg, shadowImg, oldImg, bunkerImg, marineImg;
const compositeCache = new Map();

// Lazy single-pass compositor: raw hull + pivot-aligned raw turret -> ONE 1px #130f1e exterior outline!
function getCompositeTank(hullDir, phase, turretDir, atkCol) {
  const key = (hullDir << 7) | (phase << 5) | (turretDir << 2) | atkCol;
  let cached = compositeCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = D.outW; c.height = D.outH;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const [px, py] = D.pivots[hullDir];
  const dx = px - 11, dy = py - 8;

  g.drawImage(hullImg, phase * D.coreW, hullDir * D.coreH, D.coreW, D.coreH, 1, 1, D.coreW, D.coreH);
  g.drawImage(turretImg, atkCol * D.coreW, turretDir * D.coreH, D.coreW, D.coreH, 1 + dx, 1 + dy, D.coreW, D.coreH);

  const img = g.getImageData(0, 0, D.outW, D.outH);
  const src = new Uint8ClampedArray(img.data);
  const dst = img.data;
  const W = D.outW, H = D.outH;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 0) continue;
      const adj =
        (x > 0 && src[i - 4 + 3] > 0) ||
        (x + 1 < W && src[i + 4 + 3] > 0) ||
        (y > 0 && src[i - W * 4 + 3] > 0) ||
        (y + 1 < H && src[i + W * 4 + 3] > 0);
      if (adj) {
        dst[i] = 0x13; dst[i + 1] = 0x0f; dst[i + 2] = 0x1e; dst[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  compositeCache.set(key, c);
  return c;
}

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function redrawLayeredCell(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GW - 1 || ty >= GH - 1 || !atlasImg) return;
  const rawAt = (gx, gy) => liveBiomes[gy * GW + gx];
  const raw = [rawAt(tx, ty), rawAt(tx + 1, ty), rawAt(tx, ty + 1), rawAt(tx + 1, ty + 1)];
  let fb = 'grass';
  const np = raw.filter((b) => b !== 'plateau');
  if (np.length) fb = np[0];
  else {
    for (let sy = ty + 2; sy < GH; sy++) { const b = rawAt(tx, sy); if (b !== 'plateau') { fb = b; break; } }
  }
  const nw = raw[0] === 'plateau' ? fb : raw[0];
  const ne = raw[1] === 'plateau' ? fb : raw[1];
  const sw = raw[2] === 'plateau' ? fb : raw[2];
  const se = raw[3] === 'plateau' ? fb : raw[3];
  const vr = hash2(tx, ty, 313);
  const v = vr < 0.52 ? 0 : vr < 0.72 ? 1 : vr < 0.88 ? 2 : 3;
  const mOf = (b) => (nw === b ? 1 : 0) | (ne === b ? 2 : 0) | (sw === b ? 4 : 0) | (se === b ? 8 : 0);

  let gCol = v, gRow = 0;
  const wM = mOf('water'), cM = mOf('creep'), gM = mOf('grass');
  if (wM === 15) { const wr = hash2(tx, ty, 811); gCol = wr > 0.9 ? 3 : wr > 0.65 ? 2 : wr > 0.35 ? 1 : 0; gRow = 1; }
  else if (wM > 0) {
    const dc = (nw==='dirt'||nw==='creep')+(ne==='dirt'||ne==='creep')+(sw==='dirt'||sw==='creep')+(se==='dirt'||se==='creep');
    const gc = (nw==='grass')+(ne==='grass')+(sw==='grass')+(se==='grass');
    gCol = wM; gRow = dc > gc ? 7 : 5;
  } else if (cM === 15) { gCol = 8 + v; gRow = 0; }
  else if (cM > 0) {
    const gc = (nw==='grass')+(ne==='grass')+(sw==='grass')+(se==='grass');
    const dc = (nw==='dirt')+(ne==='dirt')+(sw==='dirt')+(se==='dirt');
    gCol = cM; gRow = gc >= dc ? 4 : 3;
  } else if (gM === 15) { gCol = hash2(tx, ty, 77) > 0.92 ? 14 + (v & 1) : 4 + v; gRow = hash2(tx, ty, 77) > 0.92 ? 1 : 0; }
  else if (gM > 0) { gCol = gM; gRow = 2; }
  tCtx.drawImage(atlasImg, gCol * 8, gRow * 8, 8, 8, tx * 8, ty * 8, 8, 8);

  let oCol = -1, oRow = -1;
  for (const r of RAMPS) {
    if (ty >= r.gy && ty <= r.gy + 1 && Math.abs(tx - r.gx) <= r.halfW) {
      oCol = tx === r.gx - r.halfW ? 8 : tx === r.gx + r.halfW ? 10 : 9; oRow = 1; break;
    }
  }
  if (oCol < 0) {
    const pM = (raw[0]==='plateau'?1:0)|(raw[1]==='plateau'?2:0)|(raw[2]==='plateau'?4:0)|(raw[3]==='plateau'?8:0);
    if (pM === 15) {
      const p = hash2(tx, ty, 41);
      oCol = p > 0.86 ? 4 + (Math.floor(p * 29) & 3) : 12 + v;
      oRow = p > 0.86 ? 1 : 0;
    } else if (pM > 0) { oCol = pM; oRow = 6; }
  }
  if (oCol >= 0) tCtx.drawImage(atlasImg, oCol * 8, oRow * 8, 8, 8, tx * 8, ty * 8, 8, 8);
}

function paintAt(wx, wy, biome) {
  const gx = Math.round(wx / 8), gy = Math.round(wy / 8);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 1) continue;
    const vx = gx + dx, vy = gy + dy;
    if (vx >= 0 && vy >= 0 && vx < GW && vy < GH) liveBiomes[vy * GW + vx] = biome;
  }
  for (let ty = gy - 2; ty <= gy + 1; ty++) for (let tx = gx - 2; tx <= gx + 1; tx++) redrawLayeredCell(tx, ty);
}

function vecToDir8(dx, dy) {
  const a = Math.atan2(dy, dx);
  const shifted = a + Math.PI / 2;
  return ((Math.round(shifted / (Math.PI / 4)) % 8) + 8) % 8;
}

const PATH = [
  [162, 146], [194, 114], [196, 60], [260, 56], [320, 62], [320, 116], [352, 152], [260, 162], [176, 156]
];

function makeTank(x, y, isNew, wpOffset) {
  return { x, y, isNew, wp: wpOffset, dir8: 1, turret8: 1, dist: 0, atkT: 10, trackAccum: 0 };
}

const newTank = makeTank(172, 136, true, 1);
const oldTank = makeTank(234, 136, false, 1);
const tracks = [];
const shells = [];
const blasts = [];

function stepPatrol(t, dt, xShift) {
  const tgt = PATH[t.wp];
  const tx = tgt[0] + xShift, ty = tgt[1];
  const dx = tx - t.x, dy = ty - t.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) { t.wp = (t.wp + 1) % PATH.length; return; }
  const spd = 24;
  t.x += (dx / d) * spd * dt;
  t.y += (dy / d) * spd * dt;
  t.dist += spd * dt;
  t.dir8 = vecToDir8(dx, dy);
  t.trackAccum += spd * dt;
  if (t.isNew && st.tracks && t.trackAccum >= 3.5) {
    t.trackAccum = 0;
    const px = (-dy / d) * 4.0, py = (dx / d) * 2.6;
    tracks.push({ x: t.x + px, y: t.y + py, life: 4.0 });
    tracks.push({ x: t.x - px, y: t.y - py, life: 4.0 });
  }
}

function fireTank(t, wx, wy) {
  const dx = wx - t.x, dy = wy - t.y;
  t.turret8 = vecToDir8(dx, dy);
  t.atkT = 0; // Frame A1 (blast) starts IMMEDIATELY at t=0!
  const [px, py] = D.pivots[t.dir8];
  const [mx, my] = D.muzzles[t.turret8];
  // Sprite top-left is drawn at (t.x - 12, t.y - 15); outline adds +1,+1
  const sx = t.x - 12 + 1 + px + mx;
  const sy = t.y - 15 + 1 + py + my;
  const dist = Math.hypot(wx - sx, wy - sy) || 1;
  shells.push({ x: sx, y: sy, tx: wx, ty: wy, t: 0, dur: Math.max(0.14, dist / 150), fresh: true });
}

let painting = false, lastW = null;
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return [st.camX + ((e.clientX - r.left) / r.width) * D.viewW, st.camY + ((e.clientY - r.top) / r.height) * D.viewH];
}
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  const [wx, wy] = toWorld(e);
  st.mouseX = wx; st.mouseY = wy;
  if (st.brush !== 'fire') {
    painting = true; lastW = [wx, wy]; paintAt(wx, wy, st.brush);
  } else {
    fireTank(newTank, wx, wy);
  }
});
cv.addEventListener('pointermove', (e) => {
  const [wx, wy] = toWorld(e);
  st.mouseX = wx; st.mouseY = wy;
  if (painting && lastW) {
    const dist = Math.hypot(wx - lastW[0], wy - lastW[1]);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let s = 1; s <= steps; s++) paintAt(lastW[0] + (wx - lastW[0]) * (s / steps), lastW[1] + (wy - lastW[1]) * (s / steps), st.brush);
    lastW = [wx, wy];
  }
});
cv.addEventListener('pointerup', () => { painting = false; lastW = null; });

document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-demo]').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); st.demo = b.dataset.demo;
  document.getElementById('tag').textContent = st.demo === 'compare'
    ? 'GREEN = New 22x20 Split-Hull Iso Tank · RED = Old Flat Tank'
    : 'WASD / Arrows drive hull · Mouse aims turret · Click fires';
}));
document.querySelectorAll('[data-brush]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-brush]').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); st.brush = b.dataset.brush;
  cv.style.cursor = st.brush === 'fire' ? 'crosshair' : 'cell';
}));
document.getElementById('btn-tracks').addEventListener('click', (e) => { st.tracks = !st.tracks; e.target.classList.toggle('active', st.tracks); });
document.getElementById('btn-pause').addEventListener('click', (e) => { st.paused = !st.paused; e.target.textContent = st.paused ? 'Resume' : 'Pause'; e.target.classList.toggle('active', st.paused); });

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (!st.paused) {
    if (st.demo === 'compare') {
      stepPatrol(newTank, dt, 0);
      stepPatrol(oldTank, dt, 62);
    } else {
      let mx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
      let my = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
      if (mx || my) {
        const len = Math.hypot(mx, my);
        const spd = 28;
        newTank.x = Math.max(108, Math.min(404, newTank.x + (mx / len) * spd * dt));
        newTank.y = Math.max(34, Math.min(188, newTank.y + (my / len) * spd * dt));
        newTank.dist += spd * dt;
        newTank.dir8 = vecToDir8(mx, my);
        newTank.trackAccum += spd * dt;
        if (st.tracks && newTank.trackAccum >= 3.5) {
          newTank.trackAccum = 0;
          const px = (-my / len) * 4.0, py = (mx / len) * 2.6;
          tracks.push({ x: newTank.x + px, y: newTank.y + py, life: 4.0 });
          tracks.push({ x: newTank.x - px, y: newTank.y - py, life: 4.0 });
        }
      }
    }

    newTank.turret8 = vecToDir8(st.mouseX - newTank.x, st.mouseY - newTank.y);
    if (newTank.atkT < 0.5) newTank.atkT += dt;

    for (let i = tracks.length - 1; i >= 0; i--) { tracks[i].life -= dt; if (tracks[i].life <= 0) tracks.splice(i, 1); }
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      if (s.fresh) { s.fresh = false; continue; }
      s.t += dt;
      if (s.t >= s.dur) { blasts.push({ x: s.tx, y: s.ty, t: 0, dur: 0.24 }); shells.splice(i, 1); }
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].t += dt; if (blasts[i].t >= blasts[i].dur) blasts.splice(i, 1); }
  }

  ctx.drawImage(tCanvas, st.camX, st.camY, D.viewW, D.viewH, 0, 0, D.viewW, D.viewH);

  // Reference Vanguard Bunker + 2 Marines on the left grass/dirt edge for real-time scale comparison!
  ctx.drawImage(bunkerImg, 122 - st.camX, 114 - st.camY);
  ctx.drawImage(marineImg, 148 - st.camX, 126 - st.camY);
  ctx.drawImage(marineImg, 138 - st.camX, 134 - st.camY);

  // Fading twin tread tracks
  for (const tr of tracks) {
    ctx.fillStyle = 'rgba(18, 12, 24, ' + (Math.min(1, tr.life / 4) * 0.34).toFixed(2) + ')';
    ctx.fillRect(Math.round(tr.x - st.camX), Math.round(tr.y - st.camY), 2, 2);
  }

  // Draw Old flat tank in Compare mode (red ring)
  if (st.demo === 'compare') {
    const ox = Math.round(oldTank.x - st.camX), oy = Math.round(oldTank.y - st.camY);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
    ctx.beginPath(); ctx.ellipse(ox, oy, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(14,10,24,0.42)';
    ctx.beginPath(); ctx.ellipse(ox, oy, 8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    const isUp = oldTank.dir8 === 0 || oldTank.dir8 === 1 || oldTank.dir8 === 7;
    const isLeft = oldTank.dir8 >= 5;
    const oldRow = isUp ? (isLeft ? 3 : 2) : (isLeft ? 1 : 0);
    const phase = Math.floor(oldTank.dist * 0.45) & 3;
    ctx.drawImage(oldImg, phase * 20, oldRow * 16, 20, 16, ox - 10, oy - 13, 20, 16);
  }

  // Draw NEW 22x20 Single-Pass Outlined Split-Hull Iso Tank (green ring + exact track-hugging shadow!)
  {
    const nx = Math.round(newTank.x - st.camX), ny = Math.round(newTank.y - st.camY);
    if (st.demo === 'compare') {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
      ctx.beginPath(); ctx.ellipse(nx, ny, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const phase = Math.floor(newTank.dist * 0.45) & 3;
    // Immediate A1 blast at atkT=0..0.11, A2 smoke at 0.11..0.24, A3 settled at 0.24..0.36, 0 idle
    const atkCol = newTank.atkT < 0.11 ? 1 : newTank.atkT < 0.24 ? 2 : newTank.atkT < 0.36 ? 3 : 0;
    ctx.drawImage(shadowImg, newTank.dir8 * D.outW, 0, D.outW, D.outH, nx - 12, ny - 15, D.outW, D.outH);
    const comp = getCompositeTank(newTank.dir8, phase, newTank.turret8, atkCol);
    ctx.drawImage(comp, nx - 12, ny - 15);
  }

  // Shells & blasts
  for (const s of shells) {
    const u = Math.min(1, s.t / s.dur);
    const px = s.x + (s.tx - s.x) * u - st.camX, py = s.y + (s.ty - s.y) * u - st.camY;
    const tu = Math.max(0, u - 0.25);
    const lx = s.x + (s.tx - s.x) * tu - st.camX, ly = s.y + (s.ty - s.y) * tu - st.camY;
    ctx.strokeStyle = '#ff7b29'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#fff6cc'; ctx.fillRect(Math.round(px - 1), Math.round(py - 1), 2, 2);
  }
  for (const b of blasts) {
    const r = Math.max(1, Math.round(6 * (1 - b.t / b.dur * 0.45)));
    const bx = Math.round(b.x - st.camX), by = Math.round(b.y - st.camY);
    ctx.fillStyle = '#ff5522'; ctx.fillRect(bx - r, by - (r >> 1), r * 2, r);
    ctx.fillStyle = '#ff922b'; ctx.fillRect(bx - (r >> 1), by - r, r, r * 2);
    ctx.fillStyle = '#fffbe6'; ctx.fillRect(bx - 1, by - 1, 2, 2);
  }

  requestAnimationFrame(frame);
}

function load(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

Promise.all([
  load(D.terrainUrl), load(D.atlasUrl), load(D.hullUrl), load(D.turretUrl),
  load(D.shadowUrl), load(D.oldUrl), load(D.bunkerUrl), load(D.marineUrl),
]).then(([ti, ai, hi, tui, shi, oi, bi, mi]) => {
  tCtx.drawImage(ti, 0, 0);
  atlasImg = ai; hullImg = hi; turretImg = tui; shadowImg = shi; oldImg = oi; bunkerImg = bi; marineImg = mi;
  requestAnimationFrame(frame);
});
</script>
</body>
</html>
`;
}

function main(): void {
  mkdirSync(OUT_ROOT, { recursive: true });
  const proof = buildTankContactProof();
  const proofPath = resolve(OUT_ROOT, 'proof-tank-iso-8way.png');
  writeFileSync(proofPath, encodePNG(proof));

  const html = buildInteractivePrototypeHTML();
  const htmlPath = resolve(OUT_ROOT, 'tank-iso-prototype.html');
  writeFileSync(htmlPath, html, 'utf8');

  console.log(`Generated 8-Way Isometric Tank Prototype v2:\n  - ${proofPath}\n  - ${htmlPath}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
