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
import type { AnimId, FacingId } from './units.ts';

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
      SE: [GUNSHIP_SE_1, GUNSHIP_SE_2],
      NE: [GUNSHIP_NE_1, GUNSHIP_NE_2],
    },
    move: {
      SE: [GUNSHIP_SE_1, GUNSHIP_SE_2, GUNSHIP_SE_1, GUNSHIP_SE_2],
      NE: [GUNSHIP_NE_1, GUNSHIP_NE_2, GUNSHIP_NE_1, GUNSHIP_NE_2],
    },
    attack: {
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
      SE: [BEH_SE_IDLE_0, BEH_SE_IDLE_1],
      NE: [BEH_NE_IDLE_0, BEH_NE_MOVE_1],
    },
    move: {
      SE: [BEH_SE_MOVE_0, BEH_SE_MOVE_1, BEH_SE_MOVE_2, BEH_SE_MOVE_3],
      NE: [BEH_NE_MOVE_0, BEH_NE_MOVE_1, BEH_NE_MOVE_2, BEH_NE_IDLE_0],
    },
    attack: {
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
      SE: [WYVERN_SE_UP, WYVERN_SE_MID],
      NE: [WYVERN_NE_UP, WYVERN_NE_MID],
    },
    move: {
      SE: [WYVERN_SE_UP, WYVERN_SE_MID, WYVERN_SE_DOWN, WYVERN_SE_MID],
      NE: [WYVERN_NE_UP, WYVERN_NE_MID, WYVERN_NE_DOWN, WYVERN_NE_MID],
    },
    attack: {
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
      SE: [COL_SE_IDLE_0, COL_SE_IDLE_1],
      NE: [COL_NE_IDLE_0, COL_NE_IDLE_0],
    },
    move: {
      SE: [COL_SE_MOVE_0, COL_SE_IDLE_0, COL_SE_MOVE_2, COL_SE_IDLE_0],
      NE: [COL_NE_MOVE_0, COL_NE_IDLE_0, COL_NE_MOVE_2, COL_NE_IDLE_0],
    },
    attack: {
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
      SE: [CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2],
    },
    move: {
      SE: [CARRIER_SE_1, CARRIER_SE_2, CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2, CARRIER_NE_1, CARRIER_NE_2],
    },
    attack: {
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

export function getTitanAnimFrameCount(id: TitanId, anim: AnimId): number {
  return TITAN_SPEC_BY_ID[id].anims[anim].SE.length;
}
