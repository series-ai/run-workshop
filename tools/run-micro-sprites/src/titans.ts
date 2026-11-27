/**
 * Hand-authored centerpiece Titans, Vehicles, and Flyers (14x12 to 18x16 native pixels).
 *
 * Audit-verified animation & silhouette discipline:
 *  - Vanguard Siege Tank (18x14): Clearly legible bright-steel-topped artillery barrel (x11..17),
 *    4 distinct tread phases planted firmly on y12 in BOTH SE and NE (zero stray smoke pixels),
 *    5-frame cannon recoil/smoke/recovery in BOTH SE and NE, grounded wreckage on y12 in D0-D2.
 *  - Kraxen Brood Behemoth (18x16): Grounded diagonal foot pairs planted on y14 across all 4
 *    move phases in BOTH SE and NE (no sideways torso jitter or y15 drop), 5-frame rearing
 *    tusk-cleave in BOTH SE and NE with planted rear feet, grounded carcass on y14 in D0-D2.
 *  - Solaris Colossus (16x16): Alternating 4-stilt gait on y14 in BOTH SE and NE, 4-frame
 *    thermal beam charge/fire/sweep/cool in BOTH SE and NE, grounded broken stilts in D0-D2.
 *  - Valkyrie, Bio-Wyvern, Sky-Carrier: Full distinct SE and NE attack + 3-stage death cycles.
 */

import { buildFactionPalette, INK_OUTLINE, type FactionId, type TeamColorId } from './palette.ts';
import { addPixelOutline, compilePattern, mirrorHorizontal, type PixelSurface } from './pixel.ts';
import { DIRS_8, type AnimId, type Dir8, type FacingId } from './units.ts';

export type TitanId =
  | 'vanguard-tank'
  | 'vanguard-gunship'
  | 'kraxen-behemoth'
  | 'kraxen-wyvern'
  | 'solaris-colossus'
  | 'solaris-carrier';

export interface TitanSpec {
  readonly id: TitanId;
  readonly name: string;
  readonly role: string;
  readonly faction: FactionId;
  readonly layer: 'ground' | 'air';
  readonly width: number;
  readonly height: number;
  readonly shadowRx: number;
  readonly shadowRy: number;
  readonly airAltitude: number;
  readonly attackKind: 'shell' | 'rocket-salvo' | 'cleave' | 'glaive' | 'thermal-beam' | 'interceptors';
  readonly anims: Readonly<
    Record<
      AnimId,
      {
        readonly SE: readonly (readonly string[])[];
        readonly NE: readonly (readonly string[])[];
        readonly N?: readonly (readonly string[])[];
        readonly E?: readonly (readonly string[])[];
        readonly S?: readonly (readonly string[])[];
      }
    >
  >;
}

// ============================================================================
// 1. VANGUARD SIEGE TANK (18x14 ground) — Crisp steel cannon + grounded 4f treads
// ============================================================================

const TANK_SE_IDLE_0: readonly string[] = [
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_IDLE_1: readonly string[] = [
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

// 4-phase rolling tread cleats planted solidly at y12 with 1px turret/chassis rumble (zero floating dots!)
const TANK_SE_MOVE_0: readonly string[] = [
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kskdkskdkskdkkq...',
  'kdkskdkskdkskk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_MOVE_1: readonly string[] = [
  '..................',
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'dkskdkskdkskdkq...',
  'skdkskdkskdksk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_MOVE_2: readonly string[] = [
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'skdkskdkskdkskq...',
  'dkskdkskdkskdk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_MOVE_3: readonly string[] = [
  '..................',
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdwwwwws.',
  '...sBBBBBBddkkkkdk',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

// 5-frame SE Attack: A0 Brace -> A1 BLAST + 2px Recoil -> A2 Recoil Smoke (barrel visible!) -> A3 Slide Forward -> A4 Guard
const TANK_SE_ATK_0: readonly string[] = [
  '.....wbbbbB.......',
  '....wBBBBBBd......',
  '....sBvvBBdfwwwws.',
  '...sBBBBBBddkkkkdk',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_ATK_1: readonly string[] = [
  '...wbbbbB.....f...',
  '..wBBBBBBd...fFf..',
  '..sBvvBBdwwwfFFFf.',
  '.sBBBBBBddkkFFFFFf',
  '..wmmmmmmmddfFFFf.',
  '.wmmmmmmmmmmddqf..',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kskdkskdkskdkkq...',
  'kdkskdkskdkskk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_ATK_2: readonly string[] = [
  '..................',
  '...wbbbbB.....ew..',
  '..wBBBBBBd...ewwe.',
  '..sBvvBBdwwwwfwe..',
  '.sBBBBBBddkkkkee..',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'dkskdkskdkskdkq...',
  'skdkskdkskdksk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_SE_ATK_3: readonly string[] = [
  '....wbbbbB........',
  '...wBBBBBBd...ee..',
  '...sBvvBBdwwwws...',
  '..sBBBBBBddkkkkd..',
  '..wmmmmmmmdddqq...',
  '.wmmmmmmmmmmddq...',
  '.sBBsmmmmmsBBdq...',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

// NE back-facing: raised steel-topped cannon barrel toward y0..1 + rear exhaust vents + 4 tread phases
const TANK_NE_MOVE_0: readonly string[] = [
  '............wwws..',
  '......bbbbBwwkkdk.',
  '.....bBBBBBdskk...',
  '....bBBBBBBddd....',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kskdkskdkskdkkq...',
  'kdkskdkskdkskk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_MOVE_1: readonly string[] = [
  '..................',
  '............wwws..',
  '......bbbbBwwkkdk.',
  '.....bBBBBBdskk...',
  '....bBBBBBBddd....',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'dkskdkskdkskdkq...',
  'skdkskdkskdksk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_MOVE_2: readonly string[] = [
  '............wwws..',
  '......bbbbBwwkkdk.',
  '.....bBBBBBdskk...',
  '....bBBBBBBddd....',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'skdkskdkskdkskq...',
  'dkskdkskdkskdk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_MOVE_3: readonly string[] = [
  '..................',
  '............wwws..',
  '......bbbbBwwkkdk.',
  '.....bBBBBBdskk...',
  '....bBBBBBBddd....',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_ATK_0: readonly string[] = [
  '............wwws..',
  '......bbbbBfwkkdk.',
  '.....bBBBBBdskk...',
  '....bBBBBBBddd....',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_ATK_1: readonly string[] = [
  '..........wwfFFFf.',
  '....bbbbBwwkFFFFFf',
  '...bBBBBBdskfFFFf.',
  '..bBBBBBBddd..f...',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kskdkskdkskdkkq...',
  'kdkskdkskdkskk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_ATK_2: readonly string[] = [
  '...........ww.ew..',
  '....bbbbBwwkkewwe.',
  '...bBBBBBdskk.ee..',
  '..bBBBBBBddd......',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'dkskdkskdkskdkq...',
  'skdkskdkskdksk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_NE_ATK_3: readonly string[] = [
  '...........wwws...',
  '.....bbbbBwwkkd...',
  '....bBBBBBdskk....',
  '...bBBBBBBddd.....',
  '..wmmmmmmmmmmdd...',
  '.wmmmmddddmmmmdd..',
  '.sBBssdkkdssBBdq..',
  'sBBBssdffdsBBBdq..',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

// Grounded wreckage: broken treads stay anchored on y12 through D0-D2!
const TANK_DEATH_0: readonly string[] = [
  '.....fFf..........',
  '....fFFFf..e......',
  '...efFFFf.wBBd....',
  '..e.sffBBBBdd.....',
  '..wmmmmffmmmmdd...',
  '.wmmmmfFFmmmmdd...',
  '.sBBssffssBBdq....',
  'sBBBsssssssBBdq...',
  'dDDDdddddddDDdq...',
  'kkkkkkkkkkkkkkq...',
  'kdkskdkskdkskkq...',
  'kskdkskdkskdkk....',
  '.kkkkkkkkkkkk.....',
  '..................',
];

const TANK_DEATH_1: readonly string[] = [
  '..................',
  '..................',
  '....e.fFf.e.......',
  '...efFFFFfe.......',
  '....efFFfe........',
  '.....eFFe.........',
  '...d..ff..dBBd....',
  '..dB.sfFs..dDD....',
  '.dBD.kdkd.dDDq....',
  '.kkkkkkkkkkkkq....',
  'kdksk.f..dkskk....',
  'kskd.....skdkk....',
  '.kkkk....kkkk.....',
  '..................',
];

const TANK_DEATH_2: readonly string[] = [
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '.....e...e........',
  '....e..e..........',
  '..................',
  '...d..k...d.......',
  '..dk.kfk.dkq......',
  '.kkk.kdk.kkk......',
  '..kk..k..kk.......',
  '..................',
];

const VANGUARD_TANK: TitanSpec = {
  id: 'vanguard-tank',
  name: 'Vanguard Siege Tank',
  role: 'Heavy Artillery',
  faction: 'vanguard',
  layer: 'ground',
  width: 18,
  height: 14,
  shadowRx: 8.2,
  shadowRy: 3.3,
  airAltitude: 0,
  attackKind: 'shell',
  anims: {
    idle: {
      SE: [TANK_SE_IDLE_0, TANK_SE_IDLE_1],
      NE: [TANK_NE_MOVE_0, TANK_NE_MOVE_0],
    },
    move: {
      SE: [TANK_SE_MOVE_0, TANK_SE_MOVE_1, TANK_SE_MOVE_2, TANK_SE_MOVE_3],
      NE: [TANK_NE_MOVE_0, TANK_NE_MOVE_1, TANK_NE_MOVE_2, TANK_NE_MOVE_3],
    },
    attack: {
      SE: [TANK_SE_ATK_0, TANK_SE_ATK_1, TANK_SE_ATK_2, TANK_SE_ATK_3, TANK_SE_IDLE_0],
      NE: [TANK_NE_ATK_0, TANK_NE_ATK_1, TANK_NE_ATK_2, TANK_NE_ATK_3, TANK_NE_MOVE_0],
    },
    death: {
      SE: [TANK_DEATH_0, TANK_DEATH_1, TANK_DEATH_2],
      NE: [TANK_DEATH_0, TANK_DEATH_1, TANK_DEATH_2],
    },
  },
};

// ============================================================================
// 2. VANGUARD VALKYRIE GUNSHIP (14x12 air) — Twin-pod alternating salvos SE/NE
// ============================================================================

const GUNSHIP_SE_1: readonly string[] = [
  '....bbb.......',
  '...bBBBD......',
  '..bbBBBBd.....',
  'c.dwwssssw....',
  'ccwsssssvvv...',
  '.dBBBBBBvvvk..',
  'c.dBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_SE_2: readonly string[] = [
  '..............',
  '....bbb.......',
  '...bBBBD......',
  '..bbBBBBd.....',
  'ccdwwssssw....',
  'c.wsssssvvv...',
  '.dBBBBBBvvvk..',
  'ccdBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
];

const GUNSHIP_SE_ATK1: readonly string[] = [
  '....bbb..f....',
  '...bBBBDfFf...',
  '..bbBBBBdf....',
  'ccdwwssssw....',
  'c.wsssssvvv...',
  '.dBBBBBBvvvk..',
  'ccdBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_SE_ATK2: readonly string[] = [
  '....bbb..e....',
  '...bBBBD.e....',
  '..bbBBBBd.....',
  'c.dwwssssw....',
  'ccwsssssvvv...',
  '.dBBBBBBvvvk..',
  'c.dBBBBBBsskf.',
  '..bbDDDDddsfFf',
  '...bBBBD...f..',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_NE_1: readonly string[] = [
  '.....bbb......',
  '....bBBBD.....',
  '...bbBBBBd....',
  '..dwwssssww...',
  '.cwsssssssdd..',
  'ccdBBBBBBssdk.',
  '.cdBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_NE_2: readonly string[] = [
  '..............',
  '.....bbb......',
  '....bBBBD.....',
  '...bbBBBBd....',
  '..dwwssssww...',
  'ccwsssssssdd..',
  '.cdBBBBBBssdk.',
  'ccdBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
];

const GUNSHIP_NE_ATK1: readonly string[] = [
  '.....bbb.f....',
  '....bBBBDfFf..',
  '...bbBBBBdf...',
  '..dwwssssww...',
  '.cwsssssssdd..',
  'ccdBBBBBBssdk.',
  '.cdBBBBBBsskk.',
  '..bbDDDDdds...',
  '...bBBBD......',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_NE_ATK2: readonly string[] = [
  '.....bbb.e....',
  '....bBBBD.e...',
  '...bbBBBBd....',
  '..dwwssssww...',
  'ccwsssssssdd..',
  '.cdBBBBBBssdk.',
  'ccdBBBBBBsskf.',
  '..bbDDDDddsfFf',
  '...bBBBD...f..',
  '....bBD.......',
  '..............',
  '..............',
];

const GUNSHIP_DEATH_0: readonly string[] = [
  '.....fFf......',
  '...efFFFfe....',
  '..e.bfFFbd....',
  '....sfFss.....',
  '..e.dBffBd.e..',
  '.....effe.....',
  '....e....e....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const GUNSHIP_DEATH_1: readonly string[] = [
  '..e..fF..e....',
  '....fFFFf.....',
  '.e..efFfe..e..',
  '....e.fe......',
  '..e......e....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const GUNSHIP_DEATH_2: readonly string[] = [
  '..............',
  '...e....e.....',
  '.....e........',
  '..e.....e.....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

// 8-way N / E / S frames for Vanguard Valkyrie (14x12 air)
const GUNSHIP_N_1: readonly string[] = [
  '......ww......',
  '.....wmmw.....',
  '....sBmmBs....',
  '...bBBmmBBb...',
  '..bBBBmmBBBb..',
  '.bBBBBmmBBBBb.',
  'bBBBBBmmBBBBBb',
  'dDDDssmmssDDDd',
  '..ddqssssqdd..',
  '....qddddq....',
  '....cc..cc....',
  '.....c..c.....',
];

const GUNSHIP_N_2: readonly string[] = [
  '..............',
  '......ww......',
  '.....wmmw.....',
  '....sBmmBs....',
  '...bBBmmBBb...',
  '..bBBBmmBBBb..',
  '.bBBBBmmBBBBb.',
  'bBBBBBmmBBBBBb',
  'dDDDssmmssDDDd',
  '..ddqssssqdd..',
  '....cc..cc....',
  '..............',
];

const GUNSHIP_N_ATK1: readonly string[] = [
  '..fF..ww..Ff..',
  '..f..wmmw..f..',
  '....sBmmBs....',
  '...bBBmmBBb...',
  '..bBBBmmBBBb..',
  '.bBBBBmmBBBBb.',
  'bBBBBBmmBBBBBb',
  'dDDDssmmssDDDd',
  '..ddqssssqdd..',
  '....qddddq....',
  '....cc..cc....',
  '.....c..c.....',
];

const GUNSHIP_N_ATK2: readonly string[] = [
  '..e...ww...e..',
  '.....wmmw.....',
  '....sBmmBs....',
  '...bBBmmBBb...',
  '..bBBBmmBBBb..',
  '.bBBBBmmBBBBb.',
  'bBBBBBmmBBBBBb',
  'dDDDssmmssDDDd',
  '..ddqssssqdd..',
  '....qddddq....',
  '....cc..cc....',
  '..............',
];

const GUNSHIP_E_1: readonly string[] = [
  '..............',
  '....bbb.......',
  '...bBBBD......',
  '..bBBBBd......',
  'ccdwwssssww...',
  'c.wmmmmmsvvv..',
  '.qBBBBBBBvvvd.',
  'ccdBBBBBBssdd.',
  '..bDDDDddsq...',
  '...bBBBD......',
  '..............',
  '..............',
];

const GUNSHIP_E_2: readonly string[] = [
  '..............',
  '..............',
  '....bbb.......',
  '...bBBBD......',
  'c.bBBBBd......',
  'ccdwwssssww...',
  '.cwmmmmmsvvv..',
  'ccqBBBBBBBvvvd',
  '..dBBBBBBssdd.',
  '..bDDDDddsq...',
  '...bBBBD......',
  '..............',
];

const GUNSHIP_E_ATK1: readonly string[] = [
  '..............',
  '....bbb.......',
  '...bBBBD......',
  '..bBBBBd..f...',
  'ccdwwsssswfFf.',
  'c.wmmmmmsvvf..',
  '.qBBBBBBBvvvd.',
  'ccdBBBBBBssdd.',
  '..bDDDDddsq...',
  '...bBBBD......',
  '..............',
  '..............',
];

const GUNSHIP_E_ATK2: readonly string[] = [
  '..............',
  '....bbb.......',
  '...bBBBD......',
  '..bBBBBd..e...',
  'c.dwwssssww...',
  'ccwmmmmmsvvv..',
  '.qBBBBBBBvvdf.',
  'c.dBBBBBBssfFf',
  '..bDDDDddsq.f.',
  '...bBBBD......',
  '..............',
  '..............',
];

const GUNSHIP_S_1: readonly string[] = [
  '....cc..cc....',
  '....qddddq....',
  '..ddqssssqdd..',
  'bBBBssmmssBBBb',
  'bBBBBBmmBBBBBb',
  '.bBBBBmmBBBBb.',
  '..dBBswwsBBd..',
  '...dDsvvsDd...',
  '....dsvvsd....',
  '.....qssq.....',
  '......dd......',
  '..............',
];

const GUNSHIP_S_2: readonly string[] = [
  '..............',
  '....cc..cc....',
  '....qddddq....',
  '..ddqssssqdd..',
  'bBBBssmmssBBBb',
  'bBBBBBmmBBBBBb',
  '.bBBBBmmBBBBb.',
  '..dBBswwsBBd..',
  '...dDsvvsDd...',
  '....dsvvsd....',
  '.....qssq.....',
  '......dd......',
];

const GUNSHIP_S_ATK1: readonly string[] = [
  '....cc..cc....',
  '....qddddq....',
  '..ddqssssqdd..',
  'bBBBssmmssBBBb',
  'bBBBBBmmBBBBBb',
  '.bBBBBmmBBBBb.',
  '..dBBswwsBBd..',
  '..fdDsvvsDdf..',
  '..fFdvvvvdFf..',
  '...f.qssq.f...',
  '......dd......',
  '..............',
];

const GUNSHIP_S_ATK2: readonly string[] = [
  '....cc..cc....',
  '....qddddq....',
  '..ddqssssqdd..',
  'bBBBssmmssBBBb',
  'bBBBBBmmBBBBBb',
  '.bBBBBmmBBBBb.',
  '..dBBswwsBBd..',
  '...dDsvvsDd...',
  '..e.dsvvsd.e..',
  '.....qssq.....',
  '......dd......',
  '..............',
];

const VANGUARD_GUNSHIP: TitanSpec = {
  id: 'vanguard-gunship',
  name: 'Vanguard Valkyrie',
  role: 'VTOL Gunship',
  faction: 'vanguard',
  layer: 'air',
  width: 14,
  height: 12,
  shadowRx: 5.2,
  shadowRy: 2.2,
  airAltitude: 16,
  attackKind: 'rocket-salvo',
  anims: {
    idle: {
      N: [GUNSHIP_N_1, GUNSHIP_N_2],
      E: [GUNSHIP_E_1, GUNSHIP_E_2],
      S: [GUNSHIP_S_1, GUNSHIP_S_2],
      SE: [GUNSHIP_SE_1, GUNSHIP_SE_2],
      NE: [GUNSHIP_NE_1, GUNSHIP_NE_2],
    },
    move: {
      N: [GUNSHIP_N_1, GUNSHIP_N_2, GUNSHIP_N_1, GUNSHIP_N_2],
      E: [GUNSHIP_E_1, GUNSHIP_E_2, GUNSHIP_E_1, GUNSHIP_E_2],
      S: [GUNSHIP_S_1, GUNSHIP_S_2, GUNSHIP_S_1, GUNSHIP_S_2],
      SE: [GUNSHIP_SE_1, GUNSHIP_SE_2, GUNSHIP_SE_1, GUNSHIP_SE_2],
      NE: [GUNSHIP_NE_1, GUNSHIP_NE_2, GUNSHIP_NE_1, GUNSHIP_NE_2],
    },
    attack: {
      N: [GUNSHIP_N_1, GUNSHIP_N_ATK1, GUNSHIP_N_ATK2, GUNSHIP_N_2],
      E: [GUNSHIP_E_1, GUNSHIP_E_ATK1, GUNSHIP_E_ATK2, GUNSHIP_E_2],
      S: [GUNSHIP_S_1, GUNSHIP_S_ATK1, GUNSHIP_S_ATK2, GUNSHIP_S_2],
      SE: [GUNSHIP_SE_1, GUNSHIP_SE_ATK1, GUNSHIP_SE_ATK2, GUNSHIP_SE_2],
      NE: [GUNSHIP_NE_1, GUNSHIP_NE_ATK1, GUNSHIP_NE_ATK2, GUNSHIP_NE_2],
    },
    death: {
      SE: [GUNSHIP_DEATH_0, GUNSHIP_DEATH_1, GUNSHIP_DEATH_2],
      NE: [GUNSHIP_DEATH_0, GUNSHIP_DEATH_1, GUNSHIP_DEATH_2],
    },
  },
};

// ============================================================================
// 3. KRAXEN BROOD BEHEMOTH (18x16 ground) — Planted y14 feet + SE/NE 5f cleave
// ============================================================================

const BEH_SE_IDLE_0: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmggmmpp..oc..',
  '.ppmmgGGgmmpp.cc..',
  '.pmmmggggmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rmmuuummmuuccooo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_SE_IDLE_1: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp....o...',
  '...ppmmmmpp..oc...',
  '..ppmmggmmpp.cc...',
  '.ppmmggggmmppcc...',
  '.pmmmmmmmmmmucco..',
  'ppmmuummmmuuccoo..',
  'pmmuuummmuuccooo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

// 4-phase grounded quadrupedal stomp: diagonal foot pairs stay anchored on y14 (never y15, zero X-jitter!)
const BEH_SE_MOVE_0: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmggmmpp..oc..',
  '.ppmmgGGgmmpp.cc..',
  '.pmmmggggmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rmmuuummmuuccooo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmmr....',
  '.rrmr.ruur..rmr...',
  '.rrC..r.oC...rC...',
  '.oC...C......oC...',
  '..................',
];

const BEH_SE_MOVE_1: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp....o...',
  '...ppmmmmpp..oc...',
  '..ppmmggmmpp.cc...',
  '.ppmmgGGgmmppcc...',
  '.pmmmggggmmmucco..',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_SE_MOVE_2: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmggmmpp..oc..',
  '.ppmmgGGgmmpp.cc..',
  '.pmmmggggmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rmmuuummmuuccooo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  'rrmm.ruuurrmm.....',
  'rrC...ruur.rmr....',
  'oC....r..r..oC....',
  '......C..C........',
  '..................',
];

const BEH_SE_MOVE_3: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmggmmpp..oc..',
  '.ppmmgGGgmmpp.cc..',
  '.pmmmggggmmmucco..',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

// 5-frame SE Attack: A0 Rear back (rear feet planted on y14!) -> A1 High wide cleave -> A2 Low cut -> A3 Heave -> A4 Guard
const BEH_SE_ATK_0: readonly string[] = [
  '....p..p....o.....',
  '...ppmmpp..oo.....',
  '..ppmmmmpp.oc.....',
  '.ppmmgGGmp.cc.....',
  '.pmmmggggmucc.....',
  'ppmmmmmmmucco.....',
  'pmmmuummmucco.....',
  'rmmuuummmuuc......',
  'rrmuummmuuu.......',
  '.rrmuuuuuuu.......',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..oC....',
  '.oC...r..r........',
  '.oC...C..C........',
  '..................',
];

const BEH_SE_ATK_1: readonly string[] = [
  '.....p..p.....oo..',
  '....ppmmpp...oocc.',
  '...ppmmmmpp.ooocoo',
  '..ppmmgGGmppcccooo',
  '.ppmmgGGGGmmcccooo',
  '.pmmmggggmmuucoooo',
  'ppmmmmmmmmmuuccooo',
  'pmmmuummmmuucccooo',
  'rmmuuummmuuuccco..',
  'rrmuummmuuuuccc...',
  '.rrmuuuuuuucc.....',
  '.rrmmruuurrmmr....',
  '.rrmr.ruur..rmr...',
  '.rrC..r..r...rC...',
  '.oC...C..C...oC...',
  '..................',
];

const BEH_SE_ATK_2: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp.......',
  '..ppmmggmmpp......',
  '.ppmmgGGgmmpp...o.',
  '.pmmmggggmmmu..oo.',
  'ppmmmmmmmmmuucooo.',
  'pmmmuummmmuuccoooo',
  'rmmuuummmuuuccoooo',
  'rrmuummmuuuuccoooo',
  '.rrmuuuuuuucccooo.',
  '.rrmmruuurrmmcoo..',
  '.rrmr.ruur.rmr....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_SE_ATK_3: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp....o..',
  '..ppmmggmmpp..oo..',
  '.ppmmgGGgmmpp.oc..',
  '.pmmmggggmmmuccc..',
  'ppmmmmmmmmmuucoo..',
  'pmmmuummmmuuccoo..',
  'rmmuuummmuuccooo..',
  'rrmuummmuuuccoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

// NE back-facing: 4 distinct grounded move frames + 5 distinct cleave frames (brace, high sweep, low cut, recover, guard)
const BEH_NE_IDLE_0: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmmmmmpp..oc..',
  '.ppmmppppmmpp.cc..',
  '.pmmmppppmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuuuuummuccoo..',
  'rmmuuuuuuuumcooo..',
  'rrmuuuuuuuumcoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_NE_MOVE_0: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmmmmmpp..oc..',
  '.ppmmppppmmpp.cc..',
  '.pmmmppppmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuuuuummuccoo..',
  'rmmuuuuuuuumcooo..',
  'rrmuuuuuuuumcoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmmr....',
  '.rrmr.ruur..rmr...',
  '.rrC..r.oC...rC...',
  '.oC...C......oC...',
  '..................',
];

const BEH_NE_MOVE_1: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp....o...',
  '...ppmmmmpp..oc...',
  '..ppmmmmmmpp.cc...',
  '.ppmmppppmmppcc...',
  '.pmmmppppmmmucco..',
  'ppmmmmmmmmmuucoo..',
  'pmmmuuuuummuccoo..',
  'rrmuuuuuuuumcoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_NE_MOVE_2: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp...o...',
  '..ppmmmmmmpp..oc..',
  '.ppmmppppmmpp.cc..',
  '.pmmmppppmmmucc...',
  'ppmmmmmmmmmuucoo..',
  'pmmmuuuuummuccoo..',
  'rmmuuuuuuuumcooo..',
  'rrmuuuuuuuumcoo...',
  '.rrmuuuuuuuccc....',
  'rrmm.ruuurrmm.....',
  'rrC...ruur.rmr....',
  'oC....r..r..oC....',
  '......C..C........',
  '..................',
];

const BEH_NE_ATK_0: readonly string[] = [
  '....p..p....o.....',
  '...ppmmpp..oo.....',
  '..ppmmmmpp.oc.....',
  '.ppmmmmmmppcc.....',
  '.pmmmppppmmcc.....',
  'ppmmmmmmmucco.....',
  'pmmmuuuuummco.....',
  'rmmuuuuuuuum......',
  'rrmuuuuuuuu.......',
  '.rrmuuuuuuu.......',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..oC....',
  '.oC...r..r........',
  '.oC...C..C........',
  '..................',
];

const BEH_NE_ATK_1: readonly string[] = [
  '.....p..p.....oo..',
  '....ppmmpp...oocc.',
  '...ppmmmmpp.ooocoo',
  '..ppmmmmmmppcccooo',
  '.ppmmppppmmcccoooo',
  '.pmmmppppmmuucoooo',
  'ppmmmmmmmmmuuccooo',
  'pmmmuuuuummucccooo',
  'rmmuuuuuuuumccco..',
  'rrmuuuuuuuumccc...',
  '.rrmuuuuuuucc.....',
  '.rrmmruuurrmmr....',
  '.rrmr.ruur..rmr...',
  '.rrC..r..r...rC...',
  '.oC...C..C...oC...',
  '..................',
];

const BEH_NE_ATK_2: readonly string[] = [
  '..................',
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp.......',
  '..ppmmmmmmpp......',
  '.ppmmppppmmpp...o.',
  '.pmmmppppmmmu..oo.',
  'ppmmmmmmmmmuucooo.',
  'pmmmuuuuummuccoooo',
  'rmmuuuuuuuumccoooo',
  'rrmuuuuuuuumccoooo',
  '.rrmuuuuuuucccooo.',
  '.rrmmruuurrmmcoo..',
  '.rrmr.ruur.rmr....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_NE_ATK_3: readonly string[] = [
  '.....p..p.........',
  '....ppmmpp........',
  '...ppmmmmpp....o..',
  '..ppmmmmmmpp..oo..',
  '.ppmmppppmmpp.oc..',
  '.pmmmppppmmmuccc..',
  'ppmmmmmmmmmuucoo..',
  'pmmmuuuuummuccoo..',
  'rmmuuuuuuuumcooo..',
  'rrmuuuuuuuumcoo...',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

// Grounded carcass death: slumped body stays anchored on y14 through D0-D2!
const BEH_DEATH_0: readonly string[] = [
  '..................',
  '..................',
  '..................',
  '..................',
  '.....g..g.........',
  '...pgGmmGgp.......',
  '..pGmmGGmmGp..o...',
  '.pmmggggggmmp.oc..',
  '.rmmuuggguumr.cc..',
  'rrmuuuggguuurcc...',
  '.rrmmgggggmmrco...',
  '.rrmr.ggg.rmr.....',
  '.rrC..g.g..rC.....',
  '.rC...r.r..rC.....',
  '.oC...C.C..oC.....',
  '..................',
];

const BEH_DEATH_1: readonly string[] = [
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '....g....g........',
  '...p.gGGg.p.......',
  '..pmggggggmp......',
  '.rmmuuggguumr.c...',
  'rrmuuggggguur.oc..',
  '.rrmmgggggmmr.c...',
  '.rrC.rgggr.rC.....',
  '.oC..CC.CC..oC....',
  '..................',
];

const BEH_DEATH_2: readonly string[] = [
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '....g....g........',
  '..rrggggggrr......',
  '.rruugggguur..c...',
  '..rr..gg..rr..o...',
  '..................',
];

// 8-way N / E / S frames for Kraxen Brood Behemoth (18x16 ground, feet firmly anchored on y=14!)
const BEH_N_IDLE_0: readonly string[] = [
  '..oo..........oo..',
  '..co..p..p....oc..',
  '..cc.ppmmpp...cc..',
  '...cppmmmmpp.cc...',
  '...ppmmppmmppp....',
  '..ppmmppppmmppp...',
  '..pmmmmmmmmmmmp...',
  '..pmmuuuuuuumpp...',
  '..rmmuuuuuuuumr...',
  '..rrmmuuuuummrr...',
  '...rrmuuuuuumr....',
  '...rrmr..rmmr.....',
  '...rrmr..rmmr.....',
  '...rrC....Crr.....',
  '...oC......Co.....',
  '..................',
];

const BEH_N_MOVE_0: readonly string[] = [
  '..oo..........oo..',
  '..co..p..p....oc..',
  '..cc.ppmmpp...cc..',
  '...cppmmmmpp.cc...',
  '...ppmmppmmppp....',
  '..ppmmppppmmppp...',
  '..pmmmmmmmmmmmp...',
  '..pmmuuuuuuumpp...',
  '..rmmuuuuuuuumr...',
  '..rrmmuuuuummrr...',
  '...rrmuuuuuumr....',
  '...rrmr..rmmr.....',
  '...rrC...rmmr.....',
  '...oC.....Crr.....',
  '...........Co.....',
  '..................',
];

const BEH_N_MOVE_2: readonly string[] = [
  '..oo..........oo..',
  '..co..p..p....oc..',
  '..cc.ppmmpp...cc..',
  '...cppmmmmpp.cc...',
  '...ppmmppmmppp....',
  '..ppmmppppmmppp...',
  '..pmmmmmmmmmmmp...',
  '..pmmuuuuuuumpp...',
  '..rmmuuuuuuuumr...',
  '..rrmmuuuuummrr...',
  '...rrmuuuuuumr....',
  '...rrmr..rmmr.....',
  '...rrmr...Crr.....',
  '...rrC.....Co.....',
  '...oC.............',
  '..................',
];

const BEH_N_ATK_1: readonly string[] = [
  '.oooo........oooo.',
  '.oocco.p..p.occoo.',
  '..cccppmmppcccc...',
  '...cppmmmmppcc....',
  '...ppmmppmmppp....',
  '..ppmmppppmmppp...',
  '..pmmmmmmmmmmmp...',
  '..pmmuuuuuuumpp...',
  '..rmmuuuuuuuumr...',
  '..rrmmuuuuummrr...',
  '...rrmuuuuuumr....',
  '...rrmr..rmmr.....',
  '...rrmr..rmmr.....',
  '...rrC....Crr.....',
  '...oC......Co.....',
  '..................',
];

const BEH_E_IDLE_0: readonly string[] = [
  '..................',
  '.....p..p.........',
  '...ppmmmmpp.......',
  '..ppmmggmmpp..oo..',
  '.ppmmgGGgmmpp.oc..',
  '.pmmmggggmmmuccc..',
  'ppmmmmmmmmmuucooo.',
  'pmmmuummmmuuccoooo',
  'rmmuuummmuuuccooo.',
  'rrmuummmuuuuccoo..',
  '.rrmuuuuuuuccc....',
  '.rrmmruuurrmm.....',
  '.rrmr.ruur.rmr....',
  '.rrC..r..r..rC....',
  '.oC...C..C..oC....',
  '..................',
];

const BEH_E_ATK_1: readonly string[] = [
  '..................',
  '.....p..p......oo.',
  '...ppmmmmpp..oooc.',
  '..ppmmgGGmppcccooo',
  '.ppmmgGGGGmmcccooo',
  '.pmmmggggmmuucoooo',
  'ppmmmmmmmmmuuccooo',
  'pmmmuummmmuucccooo',
  'rmmuuummmuuuccco..',
  'rrmuummmuuuuccc...',
  '.rrmuuuuuuucc.....',
  '.rrmmruuurrmmr....',
  '.rrmr.ruur..rmr...',
  '.rrC..r..r...rC...',
  '.oC...C..C...oC...',
  '..................',
];

const BEH_S_IDLE_0: readonly string[] = [
  '..................',
  '.....p....p.......',
  '....ppmmmmpp......',
  '...ppmmmmmmpp.....',
  '..ppmmggggmmpp....',
  '..pmmgGmmGgmmp....',
  '.ppmmggmmggmmpp...',
  '.pmmuuummuuummp...',
  '.oocmuuuuuuumcoo..',
  'ooocruuuuuuurcooo.',
  'oooc.rruuuurr.cooo',
  '.oo..rrm..mrr..oo.',
  '.....rrC..Crr.....',
  '.....rrC..Crr.....',
  '.....oC....Co.....',
  '..................',
];

const BEH_S_MOVE_0: readonly string[] = [
  '..................',
  '.....p....p.......',
  '....ppmmmmpp......',
  '...ppmmmmmmpp.....',
  '..ppmmggggmmpp....',
  '..pmmgGmmGgmmp....',
  '.ppmmggmmggmmpp...',
  '.pmmuuummuuummp...',
  '.oocmuuuuuuumcoo..',
  'ooocruuuuuuurcooo.',
  'oooc.rruuuurr.cooo',
  '.oo..rrm..mrr..oo.',
  '.....rrC..Crr.....',
  '.....oC...Crr.....',
  '...........Co.....',
  '..................',
];

const BEH_S_MOVE_2: readonly string[] = [
  '..................',
  '.....p....p.......',
  '....ppmmmmpp......',
  '...ppmmmmmmpp.....',
  '..ppmmggggmmpp....',
  '..pmmgGmmGgmmp....',
  '.ppmmggmmggmmpp...',
  '.pmmuuummuuummp...',
  '.oocmuuuuuuumcoo..',
  'ooocruuuuuuurcooo.',
  'oooc.rruuuurr.cooo',
  '.oo..rrm..mrr..oo.',
  '.....rrC..Crr.....',
  '.....rrC...Co.....',
  '.....oC...........',
  '..................',
];

const BEH_S_ATK_1: readonly string[] = [
  '..................',
  '.....p....p.......',
  '....ppmmmmpp......',
  '...ppmmmmmmpp.....',
  '..ppmmgGGgmmpp....',
  '..pmmgGmmGgmmp....',
  '.ppmmgGmmGgmmpp...',
  '.pmmuuummuuummp...',
  'ooocmuuuuuuumcooo.',
  'ooocruuuuuuurcooo.',
  '.ooc.rruuuurr.coo.',
  '..ooo.rrmmrr.ooo..',
  '...ooooCCoooo.....',
  '....ooo..ooo......',
  '.....oC..Co.......',
  '..................',
];

const KRAXEN_BEHEMOTH: TitanSpec = {
  id: 'kraxen-behemoth',
  name: 'Kraxen Behemoth',
  role: 'Tusk Juggernaut',
  faction: 'kraxen',
  layer: 'ground',
  width: 18,
  height: 16,
  shadowRx: 8.4,
  shadowRy: 3.5,
  airAltitude: 0,
  attackKind: 'cleave',
  anims: {
    idle: {
      N: [BEH_N_IDLE_0, BEH_N_MOVE_0],
      E: [BEH_E_IDLE_0, BEH_SE_IDLE_1],
      S: [BEH_S_IDLE_0, BEH_S_MOVE_0],
      SE: [BEH_SE_IDLE_0, BEH_SE_IDLE_1],
      NE: [BEH_NE_IDLE_0, BEH_NE_MOVE_1],
    },
    move: {
      N: [BEH_N_MOVE_0, BEH_N_IDLE_0, BEH_N_MOVE_2, BEH_N_IDLE_0],
      E: [BEH_SE_MOVE_0, BEH_E_IDLE_0, BEH_SE_MOVE_2, BEH_E_IDLE_0],
      S: [BEH_S_MOVE_0, BEH_S_IDLE_0, BEH_S_MOVE_2, BEH_S_IDLE_0],
      SE: [BEH_SE_MOVE_0, BEH_SE_MOVE_1, BEH_SE_MOVE_2, BEH_SE_MOVE_3],
      NE: [BEH_NE_MOVE_0, BEH_NE_MOVE_1, BEH_NE_MOVE_2, BEH_NE_IDLE_0],
    },
    attack: {
      N: [BEH_N_IDLE_0, BEH_N_ATK_1, BEH_N_ATK_1, BEH_N_IDLE_0, BEH_N_IDLE_0],
      E: [BEH_SE_ATK_0, BEH_E_ATK_1, BEH_SE_ATK_2, BEH_SE_ATK_3, BEH_E_IDLE_0],
      S: [BEH_S_IDLE_0, BEH_S_ATK_1, BEH_S_ATK_1, BEH_S_IDLE_0, BEH_S_IDLE_0],
      SE: [BEH_SE_ATK_0, BEH_SE_ATK_1, BEH_SE_ATK_2, BEH_SE_ATK_3, BEH_SE_IDLE_0],
      NE: [BEH_NE_ATK_0, BEH_NE_ATK_1, BEH_NE_ATK_2, BEH_NE_ATK_3, BEH_NE_IDLE_0],
    },
    death: {
      SE: [BEH_DEATH_0, BEH_DEATH_1, BEH_DEATH_2],
      NE: [BEH_DEATH_0, BEH_DEATH_1, BEH_DEATH_2],
    },
  },
};

// ============================================================================
// 4. KRAXEN BIO-WYVERN (14x12 air) — 4-phase wing flap + SE/NE acid spit
// ============================================================================

const WYVERN_SE_UP: readonly string[] = [
  '..oo......oo..',
  '.pppo....oppp.',
  '.pmmpo..opmmp.',
  '..ummmppmmp...',
  '..rummmggmo...',
  '.rr.rmmGgm....',
  'rr...rggmr....',
  'r.....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_SE_MID: readonly string[] = [
  '..............',
  '..............',
  '.oo........oo.',
  'pppmmppmmpopp.',
  'pmmmummmggmmp.',
  '.uuumrmmGgmuu.',
  '.rr..rggmr....',
  'rr....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_SE_DOWN: readonly string[] = [
  '..............',
  '..............',
  '.....ppmp.....',
  '....pmmggmo...',
  '...ummmGgm....',
  '..pmmrggmmp...',
  '.pmmp.rr.pmp..',
  '.pmo......omp.',
  '.oo........oo.',
  '..............',
  '..............',
  '..............',
];

const WYVERN_SE_SPIT: readonly string[] = [
  '..oo......oo..',
  '.pppo....oppp.',
  '.pmmpo..opmmp.',
  '..ummmppmmp.g.',
  '..rummmGGmogG.',
  '.rr.rmmGgm..g.',
  'rr...rggmr....',
  'r.....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_UP: readonly string[] = [
  '..oo......oo..',
  '.pppo....oppp.',
  '.pmmpo..opmmp.',
  '..ummmpppmp...',
  '..rummmmmmp...',
  '.rr.rmmmmu....',
  'rr...rggmr....',
  'r.....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_MID: readonly string[] = [
  '..............',
  '..............',
  '.oo........oo.',
  'pppmmppmmpopp.',
  'pmmmummmmmmmp.',
  '.uuumrmmmmuuu.',
  '.rr..rggmr....',
  'rr....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_DOWN: readonly string[] = [
  '..............',
  '..............',
  '.....ppmp.....',
  '....pmmmmmp...',
  '...ummmmmu....',
  '..pmmrggmmp...',
  '.pmmp.rr.pmp..',
  '.pmo......omp.',
  '.oo........oo.',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_SPIT: readonly string[] = [
  '..oo......oog.',
  '.pppo....oppgG',
  '.pmmpo..opmpgg',
  '..ummmpppmp...',
  '..rummmmmmp...',
  '.rr.rmmmmu....',
  'rr...rggmr....',
  'r.....rr......',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_DEATH_0: readonly string[] = [
  '....g....g....',
  '..p.gG..Gg.p..',
  '...pmGGGGmp...',
  '....rmggmr....',
  '...g..rr..g...',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_DEATH_1: readonly string[] = [
  '..g........g..',
  '....gG..Gg....',
  '..p..gggg..p..',
  '.....r..r.....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_DEATH_2: readonly string[] = [
  '..............',
  '...g......g...',
  '......g.......',
  '..g........g..',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

// 8-way N / E / S frames for Kraxen Bio-Wyvern (14x12 air)
const WYVERN_N_UP: readonly string[] = [
  '.....o..o.....',
  '....opmmpo....',
  '..oo.pmmp.oo..',
  '.pppopmmpoppp.',
  '.pmmmummmmmmp.',
  '..uuumrmmuuu..',
  '.....rggmr....',
  '......rr......',
  '......rr......',
  '.......r......',
  '..............',
  '..............',
];

const WYVERN_N_DOWN: readonly string[] = [
  '.....o..o.....',
  '....opmmpo....',
  '.....pmmp.....',
  '....pmmmmp....',
  '..ppmmummmpp..',
  '.pmmp.rr.pmmp.',
  '.pmo..rr..omp.',
  '.oo...rr...oo.',
  '.......r......',
  '..............',
  '..............',
  '..............',
];

const WYVERN_N_SPIT: readonly string[] = [
  '.....gGGg.....',
  '....opggpo....',
  '..oo.pmmp.oo..',
  '.pppopmmpoppp.',
  '.pmmmummmmmmp.',
  '..uuumrmmuuu..',
  '.....rggmr....',
  '......rr......',
  '.......r......',
  '..............',
  '..............',
  '..............',
];

const WYVERN_E_UP: readonly string[] = [
  '....oo........',
  '...pppo.......',
  '..pmmppo......',
  '..ummmppmmp...',
  'rrummmggmggo..',
  '.rrrmmGgmmo...',
  '....rggmr.....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_E_DOWN: readonly string[] = [
  '..............',
  '..............',
  '....ppmmp.....',
  'rrummmggmggo..',
  '.rrrmmGgmmo...',
  '...pmmggmr....',
  '..pmmpo.......',
  '..pppo........',
  '...oo.........',
  '..............',
  '..............',
  '..............',
];

const WYVERN_E_SPIT: readonly string[] = [
  '....oo........',
  '...pppo.......',
  '..pmmppo......',
  '..ummmppmmp.g.',
  'rrummmGGmGogG.',
  '.rrrmmGgmmo.g.',
  '....rggmr.....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_S_UP: readonly string[] = [
  '......rr......',
  '..oo..rr..oo..',
  '.pppo.rr.oppp.',
  '.pmmprggmpmmp.',
  '..ummmggmmmu..',
  '...pmmGGmmp...',
  '....pmggmp....',
  '.....o..o.....',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_S_DOWN: readonly string[] = [
  '......rr......',
  '......rr......',
  '....pmggmp....',
  '...pmmGGmmp...',
  '..ppmmggmmpp..',
  '.pmmpo..opmmp.',
  '.pmo......omp.',
  '.oo........oo.',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_S_SPIT: readonly string[] = [
  '......rr......',
  '..oo..rr..oo..',
  '.pppo.rr.oppp.',
  '.pmmprggmpmmp.',
  '..ummmGGmmmu..',
  '...pmmGGmmp...',
  '....pgGGgp....',
  '.....gGGg.....',
  '......gg......',
  '..............',
  '..............',
  '..............',
];

const KRAXEN_WYVERN: TitanSpec = {
  id: 'kraxen-wyvern',
  name: 'Kraxen Bio-Wyvern',
  role: 'Acid Sky-Stalker',
  faction: 'kraxen',
  layer: 'air',
  width: 14,
  height: 12,
  shadowRx: 5.5,
  shadowRy: 2.1,
  airAltitude: 15,
  attackKind: 'glaive',
  anims: {
    idle: {
      N: [WYVERN_N_UP, WYVERN_N_DOWN],
      E: [WYVERN_E_UP, WYVERN_E_DOWN],
      S: [WYVERN_S_UP, WYVERN_S_DOWN],
      SE: [WYVERN_SE_UP, WYVERN_SE_MID],
      NE: [WYVERN_NE_UP, WYVERN_NE_MID],
    },
    move: {
      N: [WYVERN_N_UP, WYVERN_N_DOWN, WYVERN_N_UP, WYVERN_N_DOWN],
      E: [WYVERN_E_UP, WYVERN_E_DOWN, WYVERN_E_UP, WYVERN_E_DOWN],
      S: [WYVERN_S_UP, WYVERN_S_DOWN, WYVERN_S_UP, WYVERN_S_DOWN],
      SE: [WYVERN_SE_UP, WYVERN_SE_MID, WYVERN_SE_DOWN, WYVERN_SE_MID],
      NE: [WYVERN_NE_UP, WYVERN_NE_MID, WYVERN_NE_DOWN, WYVERN_NE_MID],
    },
    attack: {
      N: [WYVERN_N_UP, WYVERN_N_SPIT, WYVERN_N_DOWN, WYVERN_N_UP],
      E: [WYVERN_E_UP, WYVERN_E_SPIT, WYVERN_E_DOWN, WYVERN_E_UP],
      S: [WYVERN_S_UP, WYVERN_S_SPIT, WYVERN_S_DOWN, WYVERN_S_UP],
      SE: [WYVERN_SE_MID, WYVERN_SE_SPIT, WYVERN_SE_DOWN, WYVERN_SE_MID],
      NE: [WYVERN_NE_MID, WYVERN_NE_SPIT, WYVERN_NE_DOWN, WYVERN_NE_MID],
    },
    death: {
      SE: [WYVERN_DEATH_0, WYVERN_DEATH_1, WYVERN_DEATH_2],
      NE: [WYVERN_DEATH_0, WYVERN_DEATH_1, WYVERN_DEATH_2],
    },
  },
};

// ============================================================================
// 5. SOLARIS THERMAL COLOSSUS (16x16 ground) — Alternating stilts + SE/NE beam + grounded death
// ============================================================================

const COL_SE_IDLE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtgg..',
  '..gbttCCCCttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_SE_IDLE_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTccCTggy..',
  '..ggTccCCcctgg..',
  '..gbttccccTtbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_SE_MOVE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtgg..',
  '..gbttCCCCttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg...g..g...gy.',
  'yg...gb..bg...gy',
  'gb...b....b...bg',
  'b....g....g....b',
  '.....b....b.....',
  '....bb....bb....',
  '................',
];

const COL_SE_MOVE_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtgg..',
  '..gbttCCCCttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg...gb.bg..gy.',
  '.gb...b..b...bg.',
  '.g....g..g....g.',
  '.b....b..b....b.',
  'bb............bb',
  '................',
];

const COL_SE_ATK_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTccCTggy..',
  '..ggTccCCcctgg..',
  '..gbttCCCCttbg..',
  '...bbggccggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_SE_ATK_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtggc.',
  '..gbttCCCCttbgC.',
  '...bbggCCggbbcC.',
  '....ybbCCbby..c.',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_SE_ATK_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtgg..',
  '..gbttCCCCttbgc.',
  '...bbggCCggbbCC.',
  '....ybbCCbby.cC.',
  '...yg..bb..gy.c.',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

// NE back-facing: full 4-frame alternating stilt gait + 4-frame thermal emitter charge/fire/sweep/cool
const COL_NE_IDLE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttttttttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_NE_MOVE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttttttttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg...g..g...gy.',
  'yg...gb..bg...gy',
  'gb...b....b...bg',
  'b....g....g....b',
  '.....b....b.....',
  '....bb....bb....',
  '................',
];

const COL_NE_MOVE_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttttttttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg...gb.bg..gy.',
  '.gb...b..b...bg.',
  '.g....g..g....g.',
  '.b....b..b....b.',
  'bb............bb',
  '................',
];

const COL_NE_ATK_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTggc.',
  '..gbttttttttbgc.',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_NE_ATK_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy.c.',
  '..yggTTTTTTggcC.',
  '..ggTttttttTgcC.',
  '..gbttttttttbgc.',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_NE_ATK_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggc..',
  '..ggTttttttTgCC.',
  '..gbttttttttbcC.',
  '...bbggggggbb.c.',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

// Grounded death: two buckled golden stilts remain planted on y14 through D0-D1, low shards on y14 in D2!
const COL_DEATH_0: readonly string[] = [
  '....c..CC..c....',
  '...cCCCCCCCCc...',
  '..cCCCCCCCCCCc..',
  '...ccCCCCCCcc...',
  '....c..CC..c....',
  '....y.cCCc.y....',
  '...yg..cc..gy...',
  '..yg........gy..',
  '..gb........bg..',
  '.yg..........gy.',
  '.gb..........bg.',
  '.g............g.',
  '.b............b.',
  '.b............b.',
  'bb............bb',
  '................',
];

const COL_DEATH_1: readonly string[] = [
  '................',
  '................',
  '....c..CC..c....',
  '...cCCCCCCCCc...',
  '....ccCCCCcc....',
  '......cCCc......',
  '................',
  '................',
  '..y..........y..',
  '..g..........g..',
  '.gb..........bg.',
  '.g............g.',
  '.b....c..c....b.',
  '.b....cccc....b.',
  'bb....c..c....bb',
  '................',
];

const COL_DEATH_2: readonly string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...c........c...',
  '..bb..cCCc..bb..',
  '.bbb...cc...bbb.',
  '................',
];

// 8-way N / E / S frames for Solaris Thermal Colossus (16x16 ground, stilts planted on y=14!)
const COL_N_ATK_1: readonly string[] = [
  '.....cCCCCc.....',
  '...yygCggCgyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttttttttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_E_IDLE_0: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTCCCTgy...',
  '..ggTCCCCCCtg...',
  '..gbttCCCCttg...',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_E_ATK_1: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTCCCTgy...',
  '..ggTCCCCCCtgcC.',
  '..gbttCCCCttgcC.',
  '...bbggCCggbbc..',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const COL_S_ATK_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '..ggTCCCCCCtgg..',
  '..gbttCCCCttbg..',
  '...bbggCCggbb...',
  '....ybcCCcby....',
  '...yg.cCCc.gy...',
  '..yg..yccy..gy..',
  '..gb..g..g..bg..',
  '.yg..gb..bg..gy.',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  '.b...b....b...b.',
  'bb...b....b...bb',
  '................',
];

const SOLARIS_COLOSSUS: TitanSpec = {
  id: 'solaris-colossus',
  name: 'Solaris Colossus',
  role: 'Thermal Beam Walker',
  faction: 'solaris',
  layer: 'ground',
  width: 16,
  height: 16,
  shadowRx: 7.4,
  shadowRy: 3.0,
  airAltitude: 0,
  attackKind: 'thermal-beam',
  anims: {
    idle: {
      N: [COL_NE_IDLE_0, COL_NE_IDLE_0],
      E: [COL_E_IDLE_0, COL_SE_IDLE_1],
      S: [COL_SE_IDLE_0, COL_SE_IDLE_1],
      SE: [COL_SE_IDLE_0, COL_SE_IDLE_1],
      NE: [COL_NE_IDLE_0, COL_NE_IDLE_0],
    },
    move: {
      N: [COL_NE_MOVE_0, COL_NE_IDLE_0, COL_NE_MOVE_2, COL_NE_IDLE_0],
      E: [COL_SE_MOVE_0, COL_E_IDLE_0, COL_SE_MOVE_2, COL_E_IDLE_0],
      S: [COL_SE_MOVE_0, COL_SE_IDLE_0, COL_SE_MOVE_2, COL_SE_IDLE_0],
      SE: [COL_SE_MOVE_0, COL_SE_IDLE_0, COL_SE_MOVE_2, COL_SE_IDLE_0],
      NE: [COL_NE_MOVE_0, COL_NE_IDLE_0, COL_NE_MOVE_2, COL_NE_IDLE_0],
    },
    attack: {
      N: [COL_NE_ATK_0, COL_N_ATK_1, COL_N_ATK_1, COL_NE_IDLE_0],
      E: [COL_SE_ATK_0, COL_E_ATK_1, COL_E_ATK_1, COL_E_IDLE_0],
      S: [COL_SE_ATK_0, COL_S_ATK_1, COL_S_ATK_1, COL_SE_IDLE_0],
      SE: [COL_SE_ATK_0, COL_SE_ATK_1, COL_SE_ATK_2, COL_SE_IDLE_0],
      NE: [COL_NE_ATK_0, COL_NE_ATK_1, COL_NE_ATK_2, COL_NE_IDLE_0],
    },
    death: {
      SE: [COL_DEATH_0, COL_DEATH_1, COL_DEATH_2],
      NE: [COL_DEATH_0, COL_DEATH_1, COL_DEATH_2],
    },
  },
};

// ============================================================================
// 6. SOLARIS SKY-CARRIER (16x12 air) — Capital cruiser with SE/NE launch bay pulse
// ============================================================================

const CARRIER_SE_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '.cgTCCCCCCCCtgy.',
  'cCggttCCCCttggy.',
  'cCgbggggggggggyy',
  '.cgbbTTCCCTtgggy',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_SE_2: readonly string[] = [
  '................',
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  'cCgTCCCCCCCCtgy.',
  '.cggttCCCCttggy.',
  '.cgbggggggggggyy',
  'cCgbbTTCCCTtgggy',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
];

const CARRIER_SE_LAUNCH_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '.cgTCCCCCCCCtgy.',
  'cCggttCCCCttggCc',
  'cCgbggCCCCggggCC',
  '.cgbbTCCCCttggCc',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_SE_LAUNCH_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTCCCTggy..',
  '.cgTCCCCCCCCtgCc',
  'cCggttCCCCttgCCc',
  'cCgbggCCCCgggCCc',
  '.cgbbTCCCCttggc.',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_NE_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '.ygTttttttttTgy.',
  '.yggttCCCCttggCc',
  'yyggggggggggbgCc',
  'ygggtTCCCTtbbgc.',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_NE_2: readonly string[] = [
  '................',
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '.ygTttttttttTgy.',
  '.yggttCCCCttggCc',
  'yyggggggggggbgCc',
  'ygggtTCCCTtbbgc.',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
];

const CARRIER_NE_LAUNCH_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggCc.',
  '.ygTttttttttTCCc',
  '.yggttCCCCttgCCc',
  'yyggggggggggbgCc',
  'ygggtTCCCTtbbgc.',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_NE_LAUNCH_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyyCc.',
  '..yggTTTTTTgCCc.',
  '.ygTttttttttTCc.',
  '.yggttCCCCttggCc',
  'yyggggggggggbgCc',
  'ygggtTCCCTtbbgc.',
  '..bbggTTTTggbb..',
  '...bbbggggbbb...',
  '.....bbbbbb.....',
  '................',
  '................',
];

const CARRIER_DEATH_0: readonly string[] = [
  '....c.CCCC.c....',
  '..cCCCCCCCCCCc..',
  '.cCCCCCCCCCCCCc.',
  '..ccCCCCCCCCcc..',
  '....c.CCCC.c....',
  '.....c....c.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const CARRIER_DEATH_1: readonly string[] = [
  '..c...CCCC...c..',
  '....cCCCCCCc....',
  '..c..cCCCCc..c..',
  '......cccc......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const CARRIER_DEATH_2: readonly string[] = [
  '................',
  '...c........c...',
  '......CCCC......',
  '...c........c...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// 8-way N / E / S frames for Solaris Sky-Carrier (16x12 air)
const CARRIER_N_1: readonly string[] = [
  '......yyyy......',
  '....yyggggyy....',
  '...yggTTTTggy...',
  '..ygTTCCCCtTgy..',
  '..ygTttttttTgy..',
  '..yggTTTTTTggy..',
  '..yggTCCCCtggy..',
  '...bbggggggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '.....c....c.....',
  '................',
];

const CARRIER_N_2: readonly string[] = [
  '................',
  '......yyyy......',
  '....yyggggyy....',
  '...yggTTTTggy...',
  '..ygTTCCCCtTgy..',
  '..ygTttttttTgy..',
  '..yggTTTTTTggy..',
  '..yggTCCCCtggy..',
  '...bbggggggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '................',
];

const CARRIER_N_LAUNCH: readonly string[] = [
  '......yyyy......',
  '....yyggggyy....',
  '..cyggTTTTggyc..',
  '.cCgTTCCCCtTgCc.',
  '..cyTttttttTyc..',
  '..yggTTTTTTggy..',
  '..yggTCCCCtggy..',
  '...bbggggggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '.....c....c.....',
  '................',
];

const CARRIER_S_1: readonly string[] = [
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTTTTTggy..',
  '..ygTTCCCCtTgy..',
  '.ygTCCCCCCCCtgy.',
  '.yggttCCCCttggy.',
  '..yggTTCCCTggy..',
  '...yyggggggyy...',
  '....bbggggbb....',
  '......bbbb......',
  '................',
  '................',
];

const CARRIER_S_2: readonly string[] = [
  '................',
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTTTTTggy..',
  '..ygTTCCCCtTgy..',
  '.ygTCCCCCCCCtgy.',
  '.yggttCCCCttggy.',
  '..yggTTCCCTggy..',
  '...yyggggggyy...',
  '....bbggggbb....',
  '......bbbb......',
  '................',
];

const CARRIER_S_LAUNCH: readonly string[] = [
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTTTTTggy..',
  '..ygTTCCCCtTgy..',
  'cCgTCCCCCCCCtgCc',
  'cCggttCCCCttggCc',
  '.cyggTTCCCTggyc.',
  '...yyggggggyy...',
  '....bbggggbb....',
  '......bbbb......',
  '................',
  '................',
];

const SOLARIS_CARRIER: TitanSpec = {
  id: 'solaris-carrier',
  name: 'Solaris Sky-Carrier',
  role: 'Drone Capital Ship',
  faction: 'solaris',
  layer: 'air',
  width: 16,
  height: 12,
  shadowRx: 7.0,
  shadowRy: 2.8,
  airAltitude: 19,
  attackKind: 'interceptors',
  anims: {
    idle: {
      N: [CARRIER_N_1, CARRIER_N_2],
      E: [CARRIER_SE_1, CARRIER_SE_2],
      S: [CARRIER_S_1, CARRIER_S_2],
      SE: [CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2],
    },
    move: {
      N: [CARRIER_N_1, CARRIER_N_2, CARRIER_N_1, CARRIER_N_2],
      E: [CARRIER_SE_1, CARRIER_SE_2, CARRIER_SE_1, CARRIER_SE_2],
      S: [CARRIER_S_1, CARRIER_S_2, CARRIER_S_1, CARRIER_S_2],
      SE: [CARRIER_SE_1, CARRIER_SE_2, CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2, CARRIER_NE_1, CARRIER_NE_2],
    },
    attack: {
      N: [CARRIER_N_1, CARRIER_N_LAUNCH, CARRIER_N_LAUNCH, CARRIER_N_2],
      E: [CARRIER_SE_1, CARRIER_SE_LAUNCH_1, CARRIER_SE_LAUNCH_2, CARRIER_SE_2],
      S: [CARRIER_S_1, CARRIER_S_LAUNCH, CARRIER_S_LAUNCH, CARRIER_S_2],
      SE: [CARRIER_SE_1, CARRIER_SE_LAUNCH_1, CARRIER_SE_LAUNCH_2, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_LAUNCH_1, CARRIER_NE_LAUNCH_2, CARRIER_NE_2],
    },
    death: {
      SE: [CARRIER_DEATH_0, CARRIER_DEATH_1, CARRIER_DEATH_2],
      NE: [CARRIER_DEATH_0, CARRIER_DEATH_1, CARRIER_DEATH_2],
    },
  },
};

export const TITAN_SPECS: readonly TitanSpec[] = [
  VANGUARD_TANK,
  VANGUARD_GUNSHIP,
  KRAXEN_BEHEMOTH,
  KRAXEN_WYVERN,
  SOLARIS_COLOSSUS,
  SOLARIS_CARRIER,
];

export const TITAN_SPEC_BY_ID: Readonly<Record<TitanId, TitanSpec>> = {
  'vanguard-tank': VANGUARD_TANK,
  'vanguard-gunship': VANGUARD_GUNSHIP,
  'kraxen-behemoth': KRAXEN_BEHEMOTH,
  'kraxen-wyvern': KRAXEN_WYVERN,
  'solaris-colossus': SOLARIS_COLOSSUS,
  'solaris-carrier': SOLARIS_CARRIER,
};

export interface CompiledTitanFrame {
  readonly raw: PixelSurface;
  readonly outlined: PixelSurface;
}

export function compileTitanFrame(
  id: TitanId,
  anim: AnimId,
  facing: FacingId,
  frameIdx: number,
  team: TeamColorId = 'default',
): CompiledTitanFrame {
  const spec = TITAN_SPEC_BY_ID[id];
  const palette = buildFactionPalette(spec.faction, team);
  const animSet = spec.anims[anim];
  const isBack = facing === 'NE' || facing === 'NW';
  const isFlipped = facing === 'SW' || facing === 'NW';
  const list = isBack ? animSet.NE : animSet.SE;
  const pattern = list[frameIdx % list.length];
  const compiled = compilePattern(pattern, palette, spec.width, spec.height);
  const raw = isFlipped ? mirrorHorizontal(compiled) : compiled;
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  return { raw, outlined };
}

export function compileTitanFrame8(
  id: TitanId,
  anim: AnimId,
  dir: Dir8,
  frameIdx: number,
  team: TeamColorId = 'default',
): CompiledTitanFrame {
  const spec = TITAN_SPEC_BY_ID[id];
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
  const compiled = compilePattern(pattern, palette, spec.width, spec.height);
  const raw = isFlipped ? mirrorHorizontal(compiled) : compiled;
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  return { raw, outlined };
}

/**
 * Exact painted emitter offset (relative to bottom-center anchor `(x, y)` of the 18x18 outlined
 * Colossus drawn at `(x - 9, y - 16)`) for all 8 headings so thermal beams always lock to the emitter!
 */
export const COLOSSUS_EMITTER_8: Readonly<Record<Dir8, readonly [number, number]>> = {
  N: [0, -15],
  NE: [6, -13],
  E: [6, -12],
  SE: [6, -11],
  S: [0, -9],
  SW: [-7, -11],
  W: [-7, -12],
  NW: [-7, -13],
};

export function getTitanAnimFrameCount(id: TitanId, anim: AnimId): number {
  return TITAN_SPEC_BY_ID[id].anims[anim].SE.length;
}
