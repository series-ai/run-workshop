/**
 * Production 8-Way Isometric Split-Hull + Independent-Turret Vanguard Siege Tank
 * (22x20 core -> 24x22 single-pass exterior outline).
 *
 *  - 5 authored hulls (N, NE, E, SE, S) + relit horizontal mirrors (NW, W, SW) x 4 tread phases
 *  - 5 authored low beveled turrets (N, NE, E, SE, S) + relit mirrors x 4 barrel-only recoil/blast frames
 *  - Matched 1px exterior #130f1e outline weight (slate q/d outer track & barrel rims, never near-black k doubling)
 *  - Track-hugging contact shadows & exact painted A1 flash-core muzzle coordinates across all 64 hull x turret pairs
 */

import { buildFactionPalette, INK_OUTLINE, SHADOW_GROUND, SHADOW_SOFT, type TeamColorId } from './palette.ts';
import {
  addPixelOutline,
  compilePattern,
  createSurface,
  mirrorHorizontal,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';
import { DIRS_8, type Dir8 } from './units.ts';

export const TANK_CORE_W = 22;
export const TANK_CORE_H = 20;
export const TANK_OUT_W = TANK_CORE_W + 2; // 24
export const TANK_OUT_H = TANK_CORE_H + 2; // 22

export const TANK_HULL_PIVOT: Readonly<Record<Dir8, readonly [number, number]>> = {
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
// 1. 8-WAY ISOMETRIC TANK HULLS (22x20 core)
// ============================================================================

function makeNorthHull(phase: number): readonly string[] {
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
    '.....qdwmmmmmmwdq.....',
    `....${trL(0)}wBmmmmBs${trR(0)}....`,
    `....${trL(1)}wmmmmmms${trR(1)}....`,
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
    '.....qddkkddkkddq.....',
    `....${trL(0)}wmmmmmmw${trR(0)}....`,
    `....${trL(1)}wmmmmmms${trR(1)}....`,
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

function relightMirroredSteel(raw: PixelSurface, pal: Readonly<Record<string, RGBA32>>): PixelSurface {
  const out = createSurface(raw.width, raw.height);
  out.pixels.set(raw.pixels);
  const wCol = pal.w;
  const mCol = pal.m;
  const sCol = pal.s;
  const dCol = pal.d;
  const qCol = pal.q;
  const kCol = pal.k;

  const at = (x: number, y: number): RGBA32 =>
    x >= 0 && y >= 0 && x < raw.width && y < raw.height ? raw.pixels[y * raw.width + x] : 0;

  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      const px = at(x, y);
      if (px === 0) continue;
      const leftEmpty = at(x - 1, y) === 0 || at(x - 1, y) === kCol || at(x - 1, y) === qCol;
      const topEmpty = at(x, y - 1) === 0 || at(x, y - 1) === kCol || at(x, y - 1) === qCol;
      const rightEmpty = at(x + 1, y) === 0 || at(x + 1, y) === kCol || at(x + 1, y) === qCol;
      const botEmpty = at(x, y + 1) === 0 || at(x, y + 1) === kCol || at(x, y + 1) === qCol;

      if (px === wCol && (rightEmpty || botEmpty) && !leftEmpty && !topEmpty) {
        out.pixels[y * raw.width + x] = mCol;
      } else if ((px === mCol || px === sCol) && (leftEmpty || topEmpty) && !botEmpty) {
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
// ============================================================================

const TURRET_N: readonly (readonly string[])[] = [
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
  [
    '...................f..',
    '..................fFf.',
    '.................fFFFf',
    '...............wwdfFf.',
    '..............wwdq....',
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
  [
    '......................',
    '..................ew..',
    '.................ewwe.',
    '................wdq...',
    '..............wwdq....',
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
  [
    '......................',
    '......................',
    '......................',
    '......................',
    '..................ew..',
    '........wmmms....ewwe.',
    '.......wBmmBBswwwwwwwe',
    '.......sBvvBBddddddq..',
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
    '........qqqqq.dqwf....',
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
    '................dqwe..',
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
    '..........ww..........',
    '.........fFf..........',
    '........fFFFf.........',
    '.........fFf..........',
    '......................',
  ],
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
    '..........ww..........',
    '.........ew...........',
    '........ewwe..........',
    '......................',
  ],
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
// 3. COMPILERS, SINGLE-PASS OUTLINE, MUZZLE CENTROID & CONTACT SHADOWS
// ============================================================================

export function compileRawTankHull(
  dir: Dir8,
  phase: number,
  team: TeamColorId = 'default',
): PixelSurface {
  const pal = buildFactionPalette('vanguard', team);
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
  const raw = compilePattern(rows, pal, TANK_CORE_W, TANK_CORE_H);
  if (!mirror) return raw;
  return relightMirroredSteel(mirrorHorizontal(raw), pal);
}

export function compileRawTankTurret(
  dir: Dir8,
  atkFrame: number,
  team: TeamColorId = 'default',
): PixelSurface {
  const pal = buildFactionPalette('vanguard', team);
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
  const raw = compilePattern(list[atkFrame % list.length], pal, TANK_CORE_W, TANK_CORE_H);
  if (!mirror) return raw;
  return relightMirroredSteel(mirrorHorizontal(raw), pal);
}

export function computeTankMuzzleRel(dir: Dir8): readonly [number, number] {
  const pal = buildFactionPalette('vanguard', 'default');
  const a1 = compileRawTankTurret(dir, 1);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < a1.height; y++) {
    for (let x = 0; x < a1.width; x++) {
      if (a1.pixels[y * a1.width + x] === pal.F) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) return [0, 0];
  return [Math.round(sumX / count) - 11, Math.round(sumY / count) - 8];
}

export const TANK_MUZZLE_REL_8: Readonly<Record<Dir8, readonly [number, number]>> = Object.fromEntries(
  DIRS_8.map((d) => [d, computeTankMuzzleRel(d)]),
) as Record<Dir8, readonly [number, number]>;

export function buildTankContactShadow(hullDir: Dir8): PixelSurface {
  const raw = compileRawTankHull(hullDir, 0);
  const sh = createSurface(TANK_OUT_W, TANK_OUT_H);
  for (let y = 0; y < TANK_CORE_H; y++) {
    for (let x = 0; x < TANK_CORE_W; x++) {
      if (raw.pixels[y * TANK_CORE_W + x] === 0) continue;
      const ox = x + 1;
      const oy = y + 2;
      if (oy < TANK_OUT_H) sh.pixels[oy * TANK_OUT_W + ox] = SHADOW_GROUND;
      if (oy + 1 < TANK_OUT_H) {
        const idx = (oy + 1) * TANK_OUT_W + ox;
        if (sh.pixels[idx] === 0) sh.pixels[idx] = SHADOW_SOFT;
      }
    }
  }
  return sh;
}

export function composeIsoTank(
  hullDir: Dir8,
  turretDir: Dir8,
  phase = 0,
  atkFrame = 0,
  team: TeamColorId = 'default',
): PixelSurface {
  const hull = compileRawTankHull(hullDir, phase, team);
  const turret = compileRawTankTurret(turretDir, atkFrame, team);
  const [px, py] = TANK_HULL_PIVOT[hullDir];
  const dx = px - 11;
  const dy = py - 8;

  const combined = createSurface(TANK_CORE_W, TANK_CORE_H);
  combined.pixels.set(hull.pixels);
  for (let y = 0; y < TANK_CORE_H; y++) {
    const ty = y - dy;
    if (ty < 0 || ty >= TANK_CORE_H) continue;
    for (let x = 0; x < TANK_CORE_W; x++) {
      const tx = x - dx;
      if (tx < 0 || tx >= TANK_CORE_W) continue;
      const src = turret.pixels[ty * TANK_CORE_W + tx];
      if (src !== 0) combined.pixels[y * TANK_CORE_W + x] = src;
    }
  }
  return addPixelOutline(combined, INK_OUTLINE);
}
