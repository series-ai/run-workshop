/**
 * Hand-authored true 8x8 pixel-art RTS unit definitions — full 8-way compass facings.
 *
 * Every unit frame is strictly 8x8 native pixels (64 pixels total), authored
 * pixel-by-pixel for silhouette clarity at 1x native scale in 150-400 unit battles.
 *
 * Each unit provides:
 *  - 5 hand-authored base directions (N, NE, E, SE, S) + crisp horizontal mirrors (SW, W, NW)
 *  - Unmistakably distinct 3D silhouettes on every cardinal & diagonal heading
 *  - 4 animations: idle (2f), move (4f), attack (4f), death (3f)
 *  - Optional 1px dark-ink contour wrapper (10x10 padded) for dense swarm separation
 */

import { buildFactionPalette, INK_OUTLINE, type FactionId, type TeamColorId } from './palette.ts';
import {
  addPixelOutline,
  compilePattern,
  mirrorHorizontal,
  type PixelSurface,
} from './pixel.ts';

export type UnitId =
  | 'vanguard-trooper'
  | 'vanguard-heavy'
  | 'kraxen-stalker'
  | 'kraxen-swarmling'
  | 'solaris-blade'
  | 'solaris-arcanist';

export type FacingId = 'SE' | 'SW' | 'NE' | 'NW';
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const DIRS_8: readonly Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export type AnimId = 'idle' | 'move' | 'attack' | 'death';

export type SpritePattern8x8 = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface UnitSpec {
  readonly id: UnitId;
  readonly name: string;
  readonly role: string;
  readonly faction: FactionId;
  readonly attackKind: 'tracer' | 'missile' | 'acid' | 'bite' | 'psi-slash' | 'psi-orb';
  readonly shadowRx: number;
  readonly shadowRy: number;
  readonly has8Way?: boolean;
  readonly anims: Readonly<
    Record<
      AnimId,
      {
        readonly SE: readonly SpritePattern8x8[];
        readonly NE: readonly SpritePattern8x8[];
        readonly N?: readonly SpritePattern8x8[];
        readonly E?: readonly SpritePattern8x8[];
        readonly S?: readonly SpritePattern8x8[];
      }
    >
  >;
}

// Helper to shift a standing 8x8 frame cleanly for idle breathe / leg-stride cycles
function strideLegs(
  top6: readonly [string, string, string, string, string, string],
  legs: readonly [string, string],
  drop1 = false,
): SpritePattern8x8 {
  if (drop1) {
    return ['........', top6[0], top6[1], top6[2], top6[3], top6[5], legs[0], legs[1]];
  }
  return [top6[0], top6[1], top6[2], top6[3], top6[4], top6[5], legs[0], legs[1]];
}

function makeWalk4(
  top6: readonly [string, string, string, string, string, string],
  l0: readonly [string, string],
  l1: readonly [string, string],
  l2: readonly [string, string],
  l3: readonly [string, string],
): readonly SpritePattern8x8[] {
  return [
    strideLegs(top6, l0, false),
    strideLegs(top6, l1, false),
    strideLegs(top6, l2, true),
    strideLegs(top6, l3, false),
  ];
}

function makeIdle2(
  top6: readonly [string, string, string, string, string, string],
  legs: readonly [string, string],
): readonly SpritePattern8x8[] {
  return [strideLegs(top6, legs, false), strideLegs(top6, legs, true)];
}

// ============================================================================
// 1. VANGUARD TROOPER (8x8) — Rifle tip 1px UP on NE, LEVEL on E, 1px DOWN on SE
// ============================================================================

const TR_N: readonly [string, string, string, string, string, string] = [
  '..wsw.s.',
  '..ssddd.',
  '.bBddBb.',
  '.BDssDB.',
  '..DBBD..',
  '..dBBd..',
];
const TR_NE: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..sssd.s',
  '.bBddBds',
  '.BDssDd.',
  '..DBBD..',
  '..dBBd..',
];
const TR_E: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..sssv..',
  '.bBBsd..',
  '.BDDdkds',
  '..dBBd..',
  '..dBBd..',
];
const TR_SE: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..ssvd..',
  '.bBssBb.',
  '.BDssBd.',
  '..DBBdk.',
  '..dBBdds',
];
const TR_S: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..svvs..',
  '.bBssBb.',
  '.BDssBD.',
  '..DBdB..',
  '..dBkd..',
];

const VANGUARD_TROOPER: UnitSpec = {
  id: 'vanguard-trooper',
  name: 'Vanguard Trooper',
  role: 'Rifle Infantry',
  faction: 'vanguard',
  attackKind: 'tracer',
  shadowRx: 3.4,
  shadowRy: 1.5,
  has8Way: true,
  anims: {
    idle: {
      N: makeIdle2(TR_N, ['..B..B..', '..d..d..']),
      NE: makeIdle2(TR_NE, ['..B..B..', '..d..d..']),
      E: makeIdle2(TR_E, ['..B..B..', '..d..d..']),
      SE: makeIdle2(TR_SE, ['..B..B..', '..d..d..']),
      S: makeIdle2(TR_S, ['..B.sB..', '..d..d..']),
    },
    move: {
      N: makeWalk4(TR_N, ['.d...B..', '.....d..'], ['..B..B..', '..d..d..'], ['..B..d..', '..d.....'], ['..B..B..', '..d..d..']),
      NE: makeWalk4(TR_NE, ['.B...B..', '.d....d.'], ['...BB...', '...dd...'], ['..B..B..', '.d....d.'], ['..B.B...', '..d.d...']),
      E: makeWalk4(TR_E, ['.B...B..', '.d....d.'], ['...BB...', '...dd...'], ['..B..B..', '.d....d.'], ['..B.B...', '..d.d...']),
      SE: makeWalk4(TR_SE, ['.B...B..', '.d....d.'], ['...BB...', '...dd...'], ['..B..B..', '.d....d.'], ['..B.B...', '..d.d...']),
      S: makeWalk4(TR_S, ['..B.sd..', '..d.....'], ['..B.sB..', '..d..d..'], ['..d.sB..', '.....d..'], ['..B.sB..', '..d..d..']),
    },
    attack: {
      N: [
        ['..wsw.s.', '..ssddd.', '.bBddBbs', '.BDssDB.', '..DBBD..', '..dBBd..', '.B...B..', '.d...d..'],
        ['.....fFf', '..wswdFf', '..ssdd..', '.bBddBb.', '.BDssDB.', '..dBBd..', '.B...B..', '.d...d..'],
        ['..wsw.f.', '..ssddd.', '.bBddBbs', '.BDssDB.', '..DBBD..', '..dBBd..', '.B...B..', '.d...d..'],
        strideLegs(TR_N, ['..B..B..', '..d..d..']),
      ],
      NE: [
        strideLegs(TR_NE, ['.B...B..', '.d...d..']),
        ['.wsw..fF', '.sssd.Ff', 'bBddBdf.', 'BDssDd..', '.DBBD...', '.dBBd...', '.B..B...', '.d..d...'],
        ['..wsw..f', '..sssd.s', '.bBddBdk', '.BDssDd.', '..DBBD..', '..dBBd..', '.B...B..', '.d...d..'],
        strideLegs(TR_NE, ['..B..B..', '..d..d..']),
      ],
      E: [
        strideLegs(TR_E, ['.B...B..', '.d...d..']),
        ['.wsw....', '.sssv...', 'bBBsd.f.', 'BDDddFfF', '.dBBd.f.', '.dBBd...', '.B..B...', '.d..d...'],
        ['..wsw...', '..sssv..', '.bBBsd..', '.BDDdkdf', '..dBBd..', '..dBBd..', '.B...B..', '.d...d..'],
        strideLegs(TR_E, ['..B..B..', '..d..d..']),
      ],
      SE: [
        strideLegs(TR_SE, ['.B...B..', '.d...d..']),
        ['.wsw....', '.ssvd...', 'bBssBb..', 'BDssBd..', '.DBBddF.', '.dBBd.fF', '.B..B.f.', '.d..d...'],
        ['..wsw...', '..ssvd..', '.bBssBb.', '.BDssBd.', '..DBBdk.', '..dBBddf', '.B...B..', '.d...d..'],
        strideLegs(TR_SE, ['..B..B..', '..d..d..']),
      ],
      S: [
        strideLegs(TR_S, ['.B..sB..', '.d...d..']),
        ['..wsw...', '..svvs..', '.bBssBb.', '.BDssBD.', '..DBdB..', '..dBkd..', '.B.fFf..', '.d..F...'],
        ['..wsw...', '..svvs..', '.bBssBb.', '.BDssBD.', '..DBdB..', '..dBkd..', '.B..fB..', '.d...d..'],
        strideLegs(TR_S, ['..B.sB..', '..d..d..']),
      ],
    },
    death: {
      SE: [
        ['..www...', '.wsvvw..', 'wbBssBbw', '.BDsskk.', '..DBdsk.', '..dBBd..', '..B..B..', '..d..d..'],
        ['........', '........', '.e....e.', '..wsw...', '.bBssBb.', 'dBDs.skk', '.dB..Bd.', '........'],
        ['........', '........', '........', '........', '.e..s...', '.bB.dB..', 'dDs.kBd.', '........'],
      ],
      NE: [
        ['..www...', '.wsssw..', 'wbBddBbw', '.BDssBD.', '..DBBDk.', '..dBBd..', '..B..B..', '..d..d..'],
        ['........', '........', '.e....e.', '..wsw...', '.bBddBb.', 'dBDs.BDk', '.dB..Bd.', '........'],
        ['........', '........', '........', '........', '.e..s...', '.bB.dB..', 'dDs.kBd.', '........'],
      ],
    },
  },
};

// ============================================================================
// 2. VANGUARD HEAVY (8x8) — Broad shoulders; 2px shoulder casing on NE, low opening on SE, extended opening on E
// ============================================================================

const HV_N: readonly [string, string, string, string, string, string] = [
  '.dqwsw..',
  '.qbssdd.',
  'bBBddBBb',
  'bBDssDBd',
  '.DBddBd.',
  '.dBBBBd.',
];
// NE: Broad grounded shoulders intact; cleanly separated slate-steel shoulder pod (dq/qd) on upper-right!
const HV_NE: readonly [string, string, string, string, string, string] = [
  '..wsw.sq',
  '..sssdqd',
  'bBBddBBb',
  'bBDssDBd',
  '.DBddBd.',
  '.dBBBBd.',
];
// E: Launcher opening extends 1px beyond shoulder on right (x=6..7, y=2..3)
const HV_E: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..ssvv..',
  '.bBBsdqd',
  '.bBDssdq',
  '..DBddBd',
  '..dBBBd.',
];
// SE: Front 3/4 with dark launcher opening shifted 1px outward & down (x=6..7, y=4..5)
const HV_SE: readonly [string, string, string, string, string, string] = [
  '..wsw...',
  '..svvd..',
  'bBBssBBb',
  'bBDccDBd',
  '.DBddBdq',
  '.dBBBBdq',
];
const HV_S: readonly [string, string, string, string, string, string] = [
  '.dqwsw..',
  '.qbsvvs.',
  'bBBssBBb',
  'bBDccDBd',
  '.DBddBd.',
  '.dBqqBd.',
];

const VANGUARD_HEAVY: UnitSpec = {
  id: 'vanguard-heavy',
  name: 'Vanguard Heavy',
  role: 'Siege Rocket Frame',
  faction: 'vanguard',
  attackKind: 'missile',
  shadowRx: 3.9,
  shadowRy: 1.7,
  has8Way: true,
  anims: {
    idle: {
      N: makeIdle2(HV_N, ['.B.dd.B.', '.d....d.']),
      NE: makeIdle2(HV_NE, ['.B.dd.B.', '.d....d.']),
      E: makeIdle2(HV_E, ['..B..B..', '..d..d..']),
      SE: makeIdle2(HV_SE, ['.B.dd.B.', '.d....d.']),
      S: makeIdle2(HV_S, ['.B.dd.B.', '.d....d.']),
    },
    move: {
      N: makeWalk4(HV_N, ['.d.dd.B.', '......d.'], ['.B.dd.B.', '.d....d.'], ['.B.dd.d.', '.d......'], ['.B.dd.B.', '.d....d.']),
      NE: makeWalk4(HV_NE, ['B..dd.B.', 'd.....d.'], ['..B..B..', '..d..d..'], ['.B.dd..B', '.d.....d'], ['.B.dd.B.', '.d....d.']),
      E: makeWalk4(HV_E, ['.B...B..', '.d....d.'], ['...BB...', '...dd...'], ['..B..B..', '.d....d.'], ['..B.B...', '..d.d...']),
      SE: makeWalk4(HV_SE, ['B..dd.B.', 'd.....d.'], ['..B..B..', '..d..d..'], ['.B.dd..B', '.d.....d'], ['.B.dd.B.', '.d....d.']),
      S: makeWalk4(HV_S, ['.B.dd.d.', '.d......'], ['.B.dd.B.', '.d....d.'], ['.d.dd.B.', '......d.'], ['.B.dd.B.', '.d....d.']),
    },
    attack: {
      N: [
        ['.fqwsw..', '.qbssdd.', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        ['fFf.sw..', 'efqssdd.', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', 'B..dd..B', 'd......d'],
        ['e.qwsw..', '.qbssdd.', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        strideLegs(HV_N, ['.B.dd.B.', '.d....d.']),
      ],
      NE: [
        ['..wsw.fq', '..sssdqd', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        ['.wsw.dfF', '.sssdqFf', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', 'B..dd..B', 'd......d'],
        ['..wsw.sf', '..sssdqd', 'bBBddBBb', 'bBDssDBd', '.DBddBd.', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        strideLegs(HV_NE, ['.B.dd.B.', '.d....d.']),
      ],
      // E attack: recoils 1px left so launcher opening (q at x=5) sits ahead of shoulder and flash (x=6..7) is BEYOND opening!
      E: [
        strideLegs(HV_E, ['..B..B..', '..d..d..']),
        ['.wsw....', '.ssvv.f.', 'bBBsdqFf', 'bBDssdfF', '.DBddBf.', '.dBBBd..', '.B..B...', '.d..d...'],
        ['..wsw...', '..ssvv..', '.bBBsdqf', '.bBDssdq', '..DBddBd', '..dBBBd.', '..B..B..', '..d..d..'],
        strideLegs(HV_E, ['..B..B..', '..d..d..']),
      ],
      SE: [
        strideLegs(HV_SE, ['.B.dd.B.', '.d....d.']),
        ['.wsw....', '.svvd...', 'bBBssBBb', 'bBDccDBd', '.DBddBqf', '.dBBBBqF', 'B..dd.fF', 'd.....d.'],
        ['..wsw...', '..svvd..', 'bBBssBBb', 'bBDccDBd', '.DBddBdq', '.dBBBBdf', '.B.dd.B.', '.d....d.'],
        strideLegs(HV_SE, ['.B.dd.B.', '.d....d.']),
      ],
      S: [
        strideLegs(HV_S, ['.B.dd.B.', '.d....d.']),
        ['.dqwsw..', '.qbsvvs.', 'bBBssBBb', 'bBDccDBd', '.DBddBd.', '.dBqqBd.', 'B.fFFf.B', 'd..fF..d'],
        ['.dqwsw..', '.qbsvvs.', 'bBBssBBb', 'bBDccDBd', '.DBddBd.', '.dBqqBd.', '.B.ff.B.', '.d....d.'],
        strideLegs(HV_S, ['.B.dd.B.', '.d....d.']),
      ],
    },
    death: {
      SE: [
        ['.ffwww..', '.fFsvvw.', 'wBBssBBw', 'bBDffDBk', '.DBddBkk', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        ['........', '..fF....', '.efFe.e.', 'bBBssBB.', '.dBddBk.', 'dB.dd.Bd', '........', '........'],
        ['........', '........', '........', '.e....e.', '..k..s..', '.bBd.dB.', 'dD.kk.Dd', '........'],
      ],
      NE: [
        ['.ffwww..', '.fFsssw.', 'wBBddBBw', 'bBDffDBk', '.DBddBkk', '.dBBBBd.', '.B.dd.B.', '.d....d.'],
        ['........', '..fF....', '.efFe.e.', 'bBBddBB.', '.dBddBk.', 'dB.dd.Bd', '........', '........'],
        ['........', '........', '........', '.e....e.', '..k..s..', '.bBd.dB.', 'dD.kk.Dd', '........'],
      ],
    },
  },
};

// ============================================================================
// 3. KRAXEN STALKER (8x8) — Half-projection angled snout on NE (up) / SE (down + acid pixel)
// ============================================================================

const ST_N: readonly [string, string, string, string, string, string] = [
  '...pp...',
  '..pmmp..',
  '.ppmmpp.',
  '.pmppmp.',
  '.cmppmc.',
  '..rmmr..',
];
// NE: Hunched forward-leaning 3/4 bio-stalker (bridging N->E cleanly, no upright cat-ears box!)
const ST_NE: readonly [string, string, string, string, string, string] = [
  '..p.....',
  '.ppmmpo.',
  '.pmmmpmo',
  'rmmppm..',
  '.rrmmco.',
  '..rmmu..',
];
// E: Reference full snout projection (x=4..7, y=2..3), rear spike over body (x=1..2, y=0)
const ST_E: readonly [string, string, string, string, string, string] = [
  '.p.p....',
  '..pmmp..',
  '.pmmmgmo',
  'rmmummco',
  '.rrmuuoc',
  '..rmmu..',
];
// SE: Hunched forward-leaning 3/4 stalker facing down-right with exposed lime eye & bone claw!
const ST_SE: readonly [string, string, string, string, string, string] = [
  '..p.....',
  '.ppmmp..',
  'ppmmmmp.',
  'rmmumgg.',
  '.rruumco',
  '..rmmuo.',
];
const ST_S: readonly [string, string, string, string, string, string] = [
  '..p..p..',
  '..pmmp..',
  '.pmggmp.',
  'ocmggmco',
  '.ocuuco.',
  '..rmmr..',
];

const KRAXEN_STALKER: UnitSpec = {
  id: 'kraxen-stalker',
  name: 'Kraxen Stalker',
  role: 'Acid Bio-Lancer',
  faction: 'kraxen',
  attackKind: 'acid',
  shadowRx: 3.6,
  shadowRy: 1.6,
  has8Way: true,
  anims: {
    idle: {
      N: makeIdle2(ST_N, ['..ruur..', '...rr...']),
      NE: makeIdle2(ST_NE, ['.rruur..', '..r..r..']),
      E: makeIdle2(ST_E, ['.rr..rr.', '.r....r.']),
      SE: makeIdle2(ST_SE, ['.rruur..', '..r..r..']),
      S: makeIdle2(ST_S, ['.rr..rr.', '..r..r..']),
    },
    move: {
      N: makeWalk4(ST_N, ['.r.uur..', '.....r..'], ['..ruur..', '...rr...'], ['.rru..r.', '..r.....'], ['..ruur..', '...rr...']),
      NE: makeWalk4(ST_NE, ['rrmuur..', '.rrr....'], ['.rruur..', '..rrrr..'], ['.rmuur..', '...rrr..'], ['.rruur..', '..r..r..']),
      E: makeWalk4(ST_E, ['rr...rr.', 'r.....r.'], ['..rrrr..', '...rr...'], ['.rr..rr.', 'r.....r.'], ['..r..r..', '..r..r..']),
      SE: makeWalk4(ST_SE, ['rrmuur..', '.rrr....'], ['.rruur..', '..rrrr..'], ['.rmuur..', '...rrr..'], ['.rruur..', '..r..r..']),
      S: makeWalk4(ST_S, ['.rr...r.', '..r.....'], ['.rr..rr.', '..r..r..'], ['.r...rr.', '.....r..'], ['.rr..rr.', '..r..r..']),
    },
    attack: {
      N: [
        ['..pggp..', '..pmmp..', '.ppmmpp.', '.pmppmp.', '.cmppmc.', '..rmmr..', '..ruur..', '...rr...'],
        ['..gGGg..', '..pggp..', '.ppmmpp.', '.pmppmp.', '.cmppmc.', '..rmmr..', '..ruur..', '...rr...'],
        ['...gg...', '..pmmp..', '.ppmmpp.', '.pmppmp.', '.cmppmc.', '..rmmr..', '..ruur..', '...rr...'],
        strideLegs(ST_N, ['..ruur..', '...rr...']),
      ],
      NE: [
        ['.p..p...', '.pmmpm..', 'ppmmpmo.', 'cmppm...', '.ocmmo..', '..rmmu..', '.rruur..', '..r..r..'],
        ['..p..pgG', '..pmmpGg', '.ppmmpmg', '.cmppm..', '.ocmmo..', '..rmmu..', '.rruur..', '..r..r..'],
        ['..p..p.g', '..pmmpm.', '.ppmmpmo', '.cmppm..', '.ocmmo..', '..rmmu..', '.rruur..', '..r..r..'],
        strideLegs(ST_NE, ['.rruur..', '..r..r..']),
      ],
      E: [
        ['p.p.....', '.pmmp...', 'pmmmgmo.', 'rmummco.', '.rrmuuoc', '..rmmu..', '.rr..rr.', '.r....r.'],
        ['.p.p....', '..pmmp.g', '.pmmmGgG', 'rmmummcg', '.rrmuuoc', '..rmmu..', '.rr..rr.', '.r....r.'],
        ['.p.p....', '..pmmp..', '.pmmmgmg', 'rmmummco', '.rrmuuoc', '..rmmu..', '.rr..rr.', '.r....r.'],
        strideLegs(ST_E, ['.rr..rr.', '.r....r.']),
      ],
      SE: [
        ['.p......', '.pmmp...', 'ppmmmp..', 'cmumgg..', '.ocuumc.', '..rmmuo.', '.rruur..', '..r..r..'],
        ['..p.....', '..pmmp..', '.ppmmmp.', '.cmumGgG', '.ocuumGg', '..rmmuog', '.rruur..', '..r..r..'],
        ['..p.....', '..pmmp..', '.ppmmmp.', '.cmumggg', '.ocuumc.', '..rmmuo.', '.rruur..', '..r..r..'],
        strideLegs(ST_SE, ['.rruur..', '..r..r..']),
      ],
      S: [
        strideLegs(ST_S, ['.rr..rr.', '..r..r..']),
        ['..p..p..', '..pmmp..', '.pmGGmp.', 'ocmGGmco', '.ocggco.', '..gGGg..', '.rrggrr.', '..r..r..'],
        ['..p..p..', '..pmmp..', '.pmggmp.', 'ocmggmco', '.ocuuco.', '..rmmr..', '.rrggrr.', '..r..r..'],
        strideLegs(ST_S, ['.rr..rr.', '..r..r..']),
      ],
    },
    death: {
      SE: [
        ['..p.p...', '..pGGp..', '.pGggGp.', '.cmGmco.', '.ocuuoc.', '..rmmu..', '.rrmuur.', '..rrr...'],
        ['........', '........', '..g..g..', '.p.mm.o.', '.cmggmc.', 'rrmuuur.', '.rr..r..', '........'],
        ['........', '........', '........', '........', '.g.p..g.', '.rmggmr.', 'rru..cc.', '........'],
      ],
      NE: [
        ['..p.p...', '..pGGp..', '.pGmmGp.', '.cmGpmc.', '.ocmmco.', '..rmmu..', '.rrmuur.', '..rrr...'],
        ['........', '........', '..g..g..', '.p.mm.o.', '.cmggmc.', 'rrmuuur.', '.rr..r..', '........'],
        ['........', '........', '........', '........', '.g.p..g.', '.rmggmr.', 'rru..cc.', '........'],
      ],
    },
  },
};

// ============================================================================
// 4. KRAXEN SWARMLING (8x8) — Corner-shifted head/rump on NE/SE + open dark mouth on E bite
// ============================================================================

const KRAXEN_SWARMLING: UnitSpec = {
  id: 'kraxen-swarmling',
  name: 'Kraxen Swarmling',
  role: 'Fast Brood Rusher',
  faction: 'kraxen',
  attackKind: 'bite',
  shadowRx: 3.1,
  shadowRy: 1.3,
  has8Way: true,
  anims: {
    idle: {
      N: [
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '..r..r..', '...rr...'],
        ['........', '........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '...rr...'],
      ],
      // NE: Compact crouching quadruped rusher facing UP-RIGHT with two planted legs (no slug-on-a-stick!)
      NE: [
        ['........', '....po..', '..ppmp..', '.pmmmmc.', 'rrmmmu..', '.r..r...', 'r...r...', '........'],
        ['........', '........', '....po..', '..ppmp..', '.pmmmmc.', 'rrmmmu..', '.r..r...', '........'],
      ],
      E: [
        ['........', '........', '..ppp...', '.pmmggo.', 'rmmmuuoc', '.r..r.c.', 'r....r..', '........'],
        ['........', '........', '........', '..ppp...', '.pmmggo.', 'rmmmuuoc', '.r..r.c.', '........'],
      ],
      // SE: Compact crouching quadruped rusher facing DOWN-RIGHT with two planted legs (no peg-leg!)
      SE: [
        ['........', '........', '.ppp....', 'pmmmp...', 'rmmmggo.', '.r.muoc.', 'r...r...', '........'],
        ['........', '........', '........', '.ppp....', 'pmmmp...', 'rmmmggo.', '.r.muoc.', '........'],
      ],
      S: [
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '.r.oo.r.', '........'],
        ['........', '........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocoooc.', '........'],
      ],
    },
    move: {
      N: [
        ['..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', 'r..uu..r', 'r..rr..r', '........', '........'],
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '...rr...', '........'],
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '.r.uu.r.', '..r..r..', '...rr...'],
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '..r..r..', '........'],
      ],
      NE: [
        ['....po..', '..ppmp..', '.pmmmmc.', 'rrmmmu..', 'r...r...', 'r....r..', '........', '........'],
        ['........', '....po..', '..ppmp..', '.pmmmmc.', 'rrmmmu..', '..rr....', '..r.r...', '........'],
        ['........', '.....po.', '...ppmp.', '..pmmmmc', '.rrmmmu.', 'r...r...', 'r...r...', '........'],
        ['........', '....po..', '..ppmp..', '.pmmmmc.', 'rrmmmu..', '.r..r...', '.r..r...', '........'],
      ],
      E: [
        ['........', '..ppp...', '.pmmggo.', 'rmmmuuoc', 'r...r.c.', 'r.....r.', '........', '........'],
        ['........', '........', '..ppp...', '.pmmggo.', 'rmmmuuoc', '..r..r..', '...rr...', '........'],
        ['........', '........', '...ppp..', '..pmmggo', '.rmmmuuo', 'rr..r.c.', 'r....c..', '........'],
        ['........', '........', '..ppp...', '.pmmggo.', 'rmmmuuoc', '.r..rc..', '..r.r...', '........'],
      ],
      SE: [
        ['........', '.ppp....', 'pmmmp...', 'rmmmggo.', 'r..muoc.', 'r....r..', '........', '........'],
        ['........', '........', '.ppp....', 'pmmmp...', 'rmmmggo.', '..r.moc.', '..r.r...', '........'],
        ['........', '........', '..ppp...', '.pmmmp..', '.rmmmggo', 'r..muoc.', 'r...r...', '........'],
        ['........', '........', '.ppp....', 'pmmmp...', 'rmmmggo.', '.r.muoc.', '.r..r...', '........'],
      ],
      S: [
        ['........', '..pppp..', '.pmggmp.', '.rmggmr.', 'oc.uu.co', 'r..oo..r', '........', '........'],
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '..roor..', '........'],
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '.r.oo.r.', '........'],
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '..cuuc..', '..roor..', '........'],
      ],
    },
    attack: {
      N: [
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '..r..r..', '...rr...'],
        ['.oo..oo.', '.ccppcc.', '.ppmmpp.', '.rmmmmr.', '..ruur..', '...rr...', '........', '........'],
        ['..o..o..', '..cppc..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '...rr...', '........', '........'],
        ['........', '..o..o..', '..pppp..', '.ppmmpp.', '.rmmmmr.', '..ruur..', '..r..r..', '...rr...'],
      ],
      NE: [
        ['........', '....po..', '..ppmp..', '.pmmmmc.', 'rmmmm...', 'rr.mu.r.', 'r.......', '........'],
        ['.....p.o', '...ppmco', '..pmmmr.', '.rmmm.co', 'rr.mu.r.', 'r.......', '........', '........'],
        ['........', '.....p.o', '...ppmc.', '..pmmmm.', '.rmmmm..', 'rr.mu.r.', '........', '........'],
        ['........', '.....po.', '...ppmp.', '..pmmmmc', '.rmmmm..', 'rr.mu.r.', 'r.......', '........'],
      ],
      // E attack: upper & lower bone fangs separated by dark mouth pixel (r at 6,3)! Zero vertical pale bar!
      E: [
        ['........', '........', '.ppp....', 'pmmggo..', 'rmmmuuoc', '.r..r.c.', 'r....r..', '........'],
        ['........', '....p..o', '..pmGGco', '.rmmmur.', '..r..rco', '..r..r..', '........', '........'],
        ['........', '........', '...ppp.o', '..pmmggc', '.rmmmuu.', '..r..rc.', '........', '........'],
        ['........', '........', '..ppp...', '.pmmggo.', 'rmmmuuoc', '.r..r.c.', 'r....r..', '........'],
      ],
      SE: [
        ['........', '........', 'pp......', 'pmmmp...', 'rmmmggo.', '.r.muoc.', '..r..r..', '.....c..'],
        ['........', '........', '..pp....', '.pmmmp.o', '.rmmGGco', '..r.mur.', '..r..rco', '........'],
        ['........', '........', '..pp....', '.pmmmp..', '.rmmmggo', '..r.mu.c', '..r..r..', '........'],
        ['........', '........', '.pp.....', 'pmmmp...', 'rmmmggo.', '.r.muoc.', '..r..r..', '.....c..'],
      ],
      S: [
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '.r.oo.r.', '........'],
        ['........', '........', '..pppp..', '.pmGGmp.', '.rmGGmr.', 'oocuucoo', '.oo..oo.', '..o..o..'],
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '.oo..oo.', '........'],
        ['........', '........', '..pppp..', '.pmggmp.', '.rmggmr.', '.ocuuoc.', '.r.oo.r.', '........'],
      ],
    },
    death: {
      SE: [
        ['........', '........', '..GG....', '.pGGm...', 'rmmugc..', '.r.mu.o.', '.r..r.c.', '........'],
        ['........', '........', '........', '.g...g..', '..pmm...', '.rmgmu..', '..r.c...', '........'],
        ['........', '........', '........', '........', '........', '.g.rm.g.', '..ru.c..', '........'],
      ],
      NE: [
        ['........', '........', '..GG....', '.pGGm...', 'rmmmmp..', '.r.mu.c.', '.r..r.c.', '........'],
        ['........', '........', '........', '.g...g..', '..pmm...', '.rmgmu..', '..r.c...', '........'],
        ['........', '........', '........', '........', '........', '.g.rm.g.', '..ru.c..', '........'],
      ],
    },
  },
};

// ============================================================================
// 5. SOLARIS BLADE (8x8) — Gold shoulder above hand; blade angles UP (NE) / LEVEL (E) / DOWN (SE); gold hand preserved in strike
// ============================================================================

const BL_N: readonly [string, string, string, string, string, string] = [
  '..ygy...',
  '..ggy.c.',
  '.ygTgy..',
  '.TbtbT..',
  '..bTb...',
  '..gtg...',
];
// NE: Solid edge-connected cyan psi-blade angled UP-RIGHT from gold hand (no pinched corner dots!)
const BL_NE: readonly [string, string, string, string, string, string] = [
  '..ygy..C',
  '..ggy.CC',
  '.ygTgyc.',
  '.TbtbTg.',
  '..bTb...',
  '..gtg...',
];
// E: Gold shoulder (y/g at 4,2) above gold hand (g at 4,3), cyan blade runs straight outward horizontally ((5..7, 3))!
const BL_E: readonly [string, string, string, string, string, string] = [
  '..ygy...',
  '..ggC...',
  '.ygtgy..',
  '.TbgbgCc',
  '..bTb...',
  '..gtg...',
];
// SE: Solid edge-connected cyan psi-blade angled DOWN-RIGHT from gold hand (no pinched corner dots!)
const BL_SE: readonly [string, string, string, string, string, string] = [
  '..ygy...',
  '..gCg...',
  '.ygtgy..',
  '.Tbgbgc.',
  '..bTb.CC',
  '..gtg..C',
];
const BL_S: readonly [string, string, string, string, string, string] = [
  '..ygy...',
  '..gCg...',
  '.ygtgy..',
  '.TbgbT..',
  'c.bTb.c.',
  'C.gtg.C.',
];

const SOLARIS_BLADE: UnitSpec = {
  id: 'solaris-blade',
  name: 'Solaris Blade',
  role: 'Psi-Blade Zealot',
  faction: 'solaris',
  attackKind: 'psi-slash',
  shadowRx: 3.3,
  shadowRy: 1.5,
  has8Way: true,
  anims: {
    idle: {
      N: makeIdle2(BL_N, ['..g.g...', '..b.b...']),
      NE: makeIdle2(BL_NE, ['..g.g...', '..b.b...']),
      E: makeIdle2(BL_E, ['..g.g...', '..b.b...']),
      SE: makeIdle2(BL_SE, ['..g.g...', '..b.b...']),
      S: makeIdle2(BL_S, ['..g.g...', '..b.b...']),
    },
    move: {
      N: makeWalk4(BL_N, ['.b...g..', '.....b..'], ['..g.g...', '..b.b...'], ['..g..b..', '..b.....'], ['..g.g...', '..b.b...']),
      NE: makeWalk4(BL_NE, ['.g...g..', '.b....b.'], ['...gg...', '...bb...'], ['..g..g..', '.b....b.'], ['..g.g...', '..b.b...']),
      E: makeWalk4(BL_E, ['.g...g..', '.b....b.'], ['...gg...', '...bb...'], ['..g..g..', '.b....b.'], ['..g.g...', '..b.b...']),
      SE: makeWalk4(BL_SE, ['.g...g..', '.b....b.'], ['...gg...', '...bb...'], ['..g..g..', '.b....b.'], ['..g.g...', '..b.b...']),
      S: makeWalk4(BL_S, ['..g..b..', '..b.....'], ['..g.g...', '..b.b...'], ['..b..g..', '.....b..'], ['..g.g...', '..b.b...']),
    },
    attack: {
      N: [
        ['..ygy.c.', '..ggy.C.', '.ygTgyg.', '.TbtbT..', '..bTb...', '..gtg...', '.g...g..', '.b...b..'],
        ['.cCCCCc.', '.CygygC.', '..ggy...', '.ygTgy..', '.TbtbT..', '..gtg...', '.g...g..', '.b...b..'],
        ['..cCCc..', '..ygy...', '..ggy...', '.ygTgy..', '.TbtbT..', '..gtg...', '.g...g..', '.b...b..'],
        strideLegs(BL_N, ['..g.g...', '..b.b...']),
      ],
      NE: [
        ['.ygy..c.', '.ggy.cC.', 'ygTgyg..', 'TbtbT...', '.bTb....', '.gtg....', '.g..g...', '.b..b...'],
        ['..ygy.CC', '..ggycCc', '.ygTgyc.', '.TbtbTg.', '..bTb...', '..gtg...', '.g...g..', '.b...b..'],
        ['..ygy..c', '..ggy.C.', '.ygTgyc.', '.TbtbTg.', '..bTb...', '..gtg...', '.g...g..', '.b...b..'],
        strideLegs(BL_NE, ['..g.g...', '..b.b...']),
      ],
      // E attack: preserves gold hand pixel (g at 4,3) at base of crisp horizontal cyan strike!
      E: [
        ['.ygy..c.', '.ggC..C.', 'ygtgyg..', 'Tbgbg...', '.bTb....', '.gtg....', '.g..g...', '.b..b...'],
        ['..ygy...', '..ggC...', '.ygtgyc.', '.TbgbgCC', '..bTb.c.', '..gtg...', '.g...g..', '.b...b..'],
        ['..ygy...', '..ggC...', '.ygtgy..', '.TbgbgCc', '..bTb.c.', '..gtg...', '.g...g..', '.b...b..'],
        strideLegs(BL_E, ['..g.g...', '..b.b...']),
      ],
      SE: [
        ['.ygy....', '.gCg....', 'ygtgy...', 'Tbgbgc..', '.bTb..C.', '.gtg....', '.g..g...', '.b..b...'],
        ['..ygy...', '..gCg...', '.ygtgy..', '.Tbgbg..', '..bTb.cC', '..gtg.Cc', '.g...g.c', '.b...b..'],
        ['..ygy...', '..gCg...', '.ygtgy..', '.Tbgbg..', '..bTb.c.', '..gtg.C.', '.g...g..', '.b...b..'],
        strideLegs(BL_SE, ['..g.g...', '..b.b...']),
      ],
      S: [
        strideLegs(BL_S, ['.g...g..', '.b...b..']),
        ['..ygy...', '..gCg...', '.ygtgy..', '.TbgbT..', '.gbTbg..', '.cCgtCc.', '.cCCCCc.', '..cCCc..'],
        ['..ygy...', '..gCg...', '.ygtgy..', '.TbgbT..', '..bTb...', '.cgtgc..', '.g.CC.g.', '.b....b.'],
        strideLegs(BL_S, ['..g.g...', '..b.b...']),
      ],
    },
    death: {
      SE: [
        ['..CCC...', '.cCCc...', 'cCCCCc..', '.TCCCc..', '..cCCc..', '..ccc...', '..c.c...', '........'],
        ['.c...c..', '..CCC...', '.cCCCc..', '..CCC...', '.c.C.c..', '........', '........', '........'],
        ['........', '..c.c...', '...C....', '.c...c..', '........', '........', '........', '........'],
      ],
      NE: [
        ['..CCC...', '.cCCc...', 'cCCCCc..', '.TCCCc..', '..cCCc..', '..ccc...', '..c.c...', '........'],
        ['.c...c..', '..CCC...', '.cCCCc..', '..CCC...', '.c.C.c..', '........', '........', '........'],
        ['........', '..c.c...', '...C....', '.c...c..', '........', '........', '........', '........'],
      ],
    },
  },
};

// ============================================================================
// 6. SOLARIS ARCANIST (8x8) — Hood opening at leading edge, hand UP/LEVEL/DOWN, 1px gap to orb, centered hem
// ============================================================================

const AR_N_0: SpritePattern8x8 = [
  '...yy...',
  '..yggy..',
  '.ygTggy.',
  '.gbTTbg.',
  '..gTtg..',
  '..bTtb..',
  '...cc...',
  '........',
];
const AR_N_1: SpritePattern8x8 = [
  '........',
  '...yy...',
  '..yggy..',
  '.ygTggy.',
  '.gbTTbg.',
  '..gTtg..',
  '..bTtb..',
  '...CC...',
];

// NE: Smooth rounded golden hood back + trailing left cloak fold + subtle cyan spark up-right (no duck beak!)
const AR_NE_0: SpritePattern8x8 = [
  '...yy...',
  '..yggy..',
  '.ygTgg.c',
  'bgbTtb..',
  '.bgTg...',
  '..bTb...',
  '...c....',
  '........',
];
const AR_NE_1: SpritePattern8x8 = [
  '........',
  '...yy...',
  '..yggy.c',
  '.ygTgg..',
  'bgbTtb..',
  '.bgTg...',
  '..bTb...',
  '...C....',
];

// E: Smooth rounded golden hood with leading-edge cyan visor + swept cloak + subtle horizontal aura (no duck beak!)
const AR_E_0: SpritePattern8x8 = [
  '...yy...',
  '..yggC..',
  '.ygTgb..',
  'bgbTtg.c',
  '.bgTg...',
  '..bTb...',
  '...c....',
  '........',
];
const AR_E_1: SpritePattern8x8 = [
  '........',
  '...yy...',
  '..yggC..',
  '.ygTgb.c',
  'bgbTtg..',
  '.bgTg...',
  '..bTb...',
  '...C....',
];

// SE: Smooth rounded golden hood with front-right cyan face pixel + flowing cloak + low cyan spark (no duck beak!)
const AR_SE_0: SpritePattern8x8 = [
  '...yy...',
  '..ygCy..',
  '.ygTgb..',
  '.gbTtg..',
  '.bgTgb.c',
  '..bTb...',
  '...c....',
  '........',
];
const AR_SE_1: SpritePattern8x8 = [
  '........',
  '...yy...',
  '..ygCy..',
  '.ygTgb..',
  '.gbTtg.c',
  '.bgTgb..',
  '..bTb...',
  '...C....',
];

// S: Broad 4-5px golden mantle matching width, twin lit cyan eyes, centered hem!
const AR_S_0: SpritePattern8x8 = [
  '...yy...',
  '..yCCy..',
  '.ygTggy.',
  '.gbTTbg.',
  '..gTtg..',
  '..bTtb..',
  '...cc...',
  '........',
];
const AR_S_1: SpritePattern8x8 = [
  '........',
  '...yy...',
  '..yCCy..',
  '.ygTggy.',
  '.gbTTbg.',
  '..gTtg..',
  '..bTtb..',
  '...CC...',
];

const SOLARIS_ARCANIST: UnitSpec = {
  id: 'solaris-arcanist',
  name: 'Solaris Arcanist',
  role: 'Floating Psi-Caster',
  faction: 'solaris',
  attackKind: 'psi-orb',
  shadowRx: 2.8,
  shadowRy: 1.2,
  has8Way: true,
  anims: {
    idle: {
      N: [AR_N_0, AR_N_1],
      NE: [AR_NE_0, AR_NE_1],
      E: [AR_E_0, AR_E_1],
      SE: [AR_SE_0, AR_SE_1],
      S: [AR_S_0, AR_S_1],
    },
    move: {
      N: [AR_N_0, AR_N_1, AR_N_0, AR_N_1],
      NE: [AR_NE_0, AR_NE_1, AR_NE_0, AR_NE_1],
      E: [AR_E_0, AR_E_1, AR_E_0, AR_E_1],
      SE: [AR_SE_0, AR_SE_1, AR_SE_0, AR_SE_1],
      S: [AR_S_0, AR_S_1, AR_S_0, AR_S_1],
    },
    attack: {
      // N: 1px empty gap at y=1 between released orb (y=0) and hood/hands (y=2)!
      N: [
        ['..cCCc..', '..yggy..', '.ygTggy.', '.gbTTbg.', '..gTtg..', '..bTtb..', '...cc...', '........'],
        ['..cCCc..', '........', '.yyggyy.', '.ygTggy.', '.gbTTbg.', '..gTtg..', '..bTtb..', '...CC...'],
        ['...CC...', '........', '..yggy..', '.ygTggy.', '.gbTTbg.', '..gTtg..', '..bTtb..', '...cc...'],
        AR_N_0,
      ],
      // NE: Gold casting hand at (4,2), 1px empty gap at (5,1..2), released cyan orb at (6..7, 0..1)!
      NE: [
        ['...yy...', '..yggyc.', '.ygTgg..', '.gbTtb..', '..gTg...', '..bTb...', '...c....', '........'],
        ['..yy..cC', '.ygg..Cc', '.ygTg...', '.gbTtb..', '..gTg...', '..bTb...', '...C....', '........'],
        ['...yy..c', '..yggy..', '.ygTgg..', '.gbTtb..', '..gTg...', '..bTb...', '...c....', '........'],
        AR_NE_0,
      ],
      // E: Hood opening at leading right edge, gold casting hand at (4,3), 1px empty gap at (5,2..3), released orb at (6..7, 2..3)!
      E: [
        ['...yy...', '..yggC..', '.ygTgb..', '.gbTggc.', '..gTg...', '..bTb...', '...c....', '........'],
        ['..yy....', '.yggC...', '.ygTb.cC', '.gbTg.Cc', '..gTg...', '..bTb...', '...C....', '........'],
        ['...yy...', '..yggC..', '.ygTgb..', '.gbTgg.c', '..gTg...', '..bTb...', '...c....', '........'],
        AR_E_0,
      ],
      // SE: 1 lit face pixel (ygCy), gold casting hand down-right (4,4), 1px empty gap at (5,4..5), released orb at (6..7, 4..5)!
      SE: [
        ['...yy...', '..ygCy..', '.ygTgb..', '.gbTtg..', '..gTggc.', '..bTb...', '...c....', '........'],
        ['..yy....', '.ygCy...', '.ygTgb..', '.gbTtg..', '..gTg.cC', '..bTb.Cc', '...C....', '........'],
        ['...yy...', '..ygCy..', '.ygTgb..', '.gbTtg..', '..gTgg.c', '..bTb...', '...c....', '........'],
        AR_SE_0,
      ],
      // S: Broad mantle + eyes at y=0..4 (full centered robe hem!), 1px empty gap at y=5, released cyan orb at y=6..7!
      S: [
        ['...yy...', '..yCCy..', '.ygTggy.', '.gbTTbg.', '..gTtg..', '..bTtb..', '...cc...', '........'],
        ['...yy...', '..yCCy..', '.ygTggy.', '.gbTTbg.', '..bTtb..', '........', '..cCCc..', '...CC...'],
        ['...yy...', '..yCCy..', '.ygTggy.', '.gbTTbg.', '..gTtg..', '..cCCc..', '...cc...', '........'],
        AR_S_0,
      ],
    },
    death: {
      SE: [
        ['...CC...', '..CCCC..', '..CCCC..', '..cCCc..', '..cCCc..', '...cc...', '...c....', '........'],
        ['..c..c..', '...CC...', '.c.CC.c.', '...cc...', '..c..c..', '........', '........', '........'],
        ['........', '...c....', '.c....c.', '........', '...c....', '........', '........', '........'],
      ],
      NE: [
        ['...CC...', '..CCCC..', '..CCCC..', '..cCCc..', '..cCCc..', '...cc...', '...c....', '........'],
        ['..c..c..', '...CC...', '.c.CC.c.', '...cc...', '..c..c..', '........', '........', '........'],
        ['........', '...c....', '.c....c.', '........', '...c....', '........', '........', '........'],
      ],
    },
  },
};

export const UNIT_SPECS: readonly UnitSpec[] = [
  VANGUARD_TROOPER,
  VANGUARD_HEAVY,
  KRAXEN_STALKER,
  KRAXEN_SWARMLING,
  SOLARIS_BLADE,
  SOLARIS_ARCANIST,
];

export const UNIT_SPEC_BY_ID: Readonly<Record<UnitId, UnitSpec>> = {
  'vanguard-trooper': VANGUARD_TROOPER,
  'vanguard-heavy': VANGUARD_HEAVY,
  'kraxen-stalker': KRAXEN_STALKER,
  'kraxen-swarmling': KRAXEN_SWARMLING,
  'solaris-blade': SOLARIS_BLADE,
  'solaris-arcanist': SOLARIS_ARCANIST,
};

export interface CompiledUnitFrame {
  readonly raw: PixelSurface; // strict 8x8
  readonly outlined: PixelSurface; // 10x10 (8x8 core + 1px dark ink outline)
}

export function compileUnitFrame(
  unitId: UnitId,
  anim: AnimId,
  facing: FacingId,
  frameIdx: number,
  team: TeamColorId = 'default',
): CompiledUnitFrame {
  const spec = UNIT_SPEC_BY_ID[unitId];
  const palette = buildFactionPalette(spec.faction, team);
  const animSet = spec.anims[anim];
  const isBack = facing === 'NE' || facing === 'NW';
  const isFlipped = facing === 'SW' || facing === 'NW';
  const list = isBack ? animSet.NE : animSet.SE;
  const pattern = list[frameIdx % list.length];
  const compiled = compilePattern(pattern, palette, 8, 8);
  const raw = isFlipped ? mirrorHorizontal(compiled) : compiled;
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  return { raw, outlined };
}

export function compileUnitFrame8(
  unitId: UnitId,
  anim: AnimId,
  dir: Dir8,
  frameIdx: number,
  team: TeamColorId = 'default',
): CompiledUnitFrame {
  const spec = UNIT_SPEC_BY_ID[unitId];
  const palette = buildFactionPalette(spec.faction, team);
  const animSet = spec.anims[anim];
  const isFlipped = dir === 'NW' || dir === 'W' || dir === 'SW';
  const baseDir: 'N' | 'NE' | 'E' | 'SE' | 'S' =
    dir === 'NW' ? 'NE' : dir === 'W' ? 'E' : dir === 'SW' ? 'SE' : dir;
  const list =
    baseDir === 'N'
      ? (animSet.N ?? animSet.NE)
      : baseDir === 'E'
        ? (animSet.E ?? animSet.SE)
        : baseDir === 'S'
          ? (animSet.S ?? animSet.SE)
          : baseDir === 'NE'
            ? animSet.NE
            : animSet.SE;
  const pattern = list[frameIdx % list.length];
  const compiled = compilePattern(pattern, palette, 8, 8);
  const raw = isFlipped ? mirrorHorizontal(compiled) : compiled;
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  return { raw, outlined };
}

export function getAnimFrameCount(unitId: UnitId, anim: AnimId): number {
  return UNIT_SPEC_BY_ID[unitId].anims[anim].SE.length;
}
