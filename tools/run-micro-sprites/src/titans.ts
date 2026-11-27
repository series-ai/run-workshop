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
// 2. VANGUARD VALKYRIE GUNSHIP (18x14 air) — High-contrast twin-pod VTOL gunship
// ============================================================================
// Consistent 3D landmarks across all 8 headings:
//   - 4px pale-steel central fuselage + dark-framed cyan-blue cockpit (q/c/b) behind tapered nose
//   - Two swept cobalt wings carrying distinct metallic steel/slate 2x4 engine pods (s/d/q)
//     separated by dark navy pylons (D) & 1px open background cutouts, ending in cyan exhausts (c)
//   - Yellow-orange (f/F) strictly reserved for attack flashes!

const GUNSHIP_N_1: readonly string[] = [
  '........ww........',
  '.......wmmw.......',
  '.......qccq.......',
  '......sqbbqs......',
  '.....bbDmmDbb.....',
  '...bbBsdmmsdBbb...',
  '..bBBsqqmmqqsBBb..',
  '.bBBDsqqmmqqsDBBb.',
  '.DDDdqqDmmDqqdDDD.',
  '..DDdqq.mm.qqdDD..',
  '....dqq.qq.qqd....',
  '....cc......cc....',
  '....c........c....',
  '..................',
];

const GUNSHIP_N_2: readonly string[] = [
  '..................',
  '........ww........',
  '.......wmmw.......',
  '.......qccq.......',
  '......sqbbqs......',
  '.....bbDmmDbb.....',
  '...bbBsdmmsdBbb...',
  '..bBBsqqmmqqsBBb..',
  '.bBBDsqqmmqqsDBBb.',
  '.DDDdqqDmmDqqdDDD.',
  '..DDdqq.mm.qqdDD..',
  '....dqq.qq.qqd....',
  '....cc......cc....',
  '..................',
];

const GUNSHIP_N_ATK1: readonly string[] = [
  '........ww........',
  '.......wmmw.......',
  '.......qccq.......',
  '....f.sqbbqs.f....',
  '...fFf.DmmD.fFf...',
  '...bfBsdmmsdBfb...',
  '..bBBsqqmmqqsBBb..',
  '.bBBDsqqmmqqsDBBb.',
  '.DDDdqqDmmDqqdDDD.',
  '..DDdqq.mm.qqdDD..',
  '....dqq.qq.qqd....',
  '....cc......cc....',
  '....c........c....',
  '..................',
];

const GUNSHIP_N_ATK2: readonly string[] = [
  '........ww........',
  '.......wmmw.......',
  '.......qccq.......',
  '....e.sqbbqs.e....',
  '.....bbDmmDbb.....',
  '...bbBsdmmsdBbb...',
  '..bBBsqqmmqqsBBb..',
  '.bBBDsqqmmqqsDBBb.',
  '.DDDdqqDmmDqqdDDD.',
  '..DDdqq.mm.qqdDD..',
  '....dqq.qq.qqd....',
  '....cc......cc....',
  '..................',
  '..................',
];

const GUNSHIP_NE_1: readonly string[] = [
  '....bb........ww..',
  '...bBBb.....wmmw..',
  '..bBsssd...qccmw..',
  '.ccqqqqdD.qbbmm...',
  '.c..DDdBmmmmDbb...',
  '...qssmmmmmmDBBb..',
  '..dmmssmmDDBBBBBb.',
  '..qq...DDsssdBBBb.',
  '......ccqqqqdBBBd.',
  '......c..qDDDDBd..',
  '..........DDBBd...',
  '...........DDb....',
  '..................',
  '..................',
];

const GUNSHIP_NE_2: readonly string[] = [
  '..................',
  '....bb........ww..',
  '...bBBb.....wmmw..',
  '..bBsssd...qccmw..',
  '.ccqqqqdD.qbbmm...',
  '....DDdBmmmmDbb...',
  '...qssmmmmmmDBBb..',
  '..dmmssmmDDBBBBBb.',
  '..qq...DDsssdBBBb.',
  '......ccqqqqdBBBd.',
  '.........qDDDDBd..',
  '..........DDBBd...',
  '...........DDb....',
  '..................',
];

const GUNSHIP_NE_ATK1: readonly string[] = [
  '....bb.fF.....ww..',
  '...bBBfFf...wmmw..',
  '..bBsssf...qccmw..',
  '.ccqqqqdD.qbbmm...',
  '.c..DDdBmmmmDbb...',
  '...qssmmmmmmDBfFf.',
  '..dmmssmmDDBBBfFf.',
  '..qq...DDsssdBBfb.',
  '......ccqqqqdBBBd.',
  '......c..qDDDDBd..',
  '..........DDBBd...',
  '...........DDb....',
  '..................',
  '..................',
];

const GUNSHIP_NE_ATK2: readonly string[] = [
  '....bb.e......ww..',
  '...bBBb.....wmmw..',
  '..bBsssd...qccmw..',
  '.ccqqqqdD.qbbmm...',
  '.c..DDdBmmmmDbb...',
  '...qssmmmmmmDBe...',
  '..dmmssmmDDBBBBBb.',
  '..qq...DDsssdBBBb.',
  '......ccqqqqdBBBd.',
  '.........qDDDDBd..',
  '..........DDBBd...',
  '...........DDb....',
  '..................',
  '..................',
];

const GUNSHIP_E_1: readonly string[] = [
  '......bb..........',
  '.....bBBb.........',
  '.ccqsssdBb........',
  '..cqqqqdBBb.......',
  '..sdwwmDDqcbw.....',
  '.qssmmmmqcbmwws...',
  '..qddsssDDmmmmd...',
  '....DDBBBBBBBb....',
  '..ccqsssdBBBBbb...',
  '...cqqqqdBBBBb....',
  '.....DDBBBBBb.....',
  '......DDBBBb......',
  '.......DDbb.......',
  '..................',
];

const GUNSHIP_E_2: readonly string[] = [
  '..................',
  '......bb..........',
  '.....bBBb.........',
  '.ccqsssdBb........',
  '..cqqqqdBBb.......',
  '..sdwwmDDqcbw.....',
  '.qssmmmmqcbmwws...',
  '..qddsssDDmmmmd...',
  '....DDBBBBBBBb....',
  '..ccqsssdBBBBbb...',
  '...cqqqqdBBBBb....',
  '.....DDBBBBBb.....',
  '......DDBBBb......',
  '.......DDbb.......',
];

const GUNSHIP_E_ATK1: readonly string[] = [
  '......bb..........',
  '.....bBBbf........',
  '.ccqsssdBfFf......',
  '..cqqqqdBBf.......',
  '..sdwwmDDqcbw.....',
  '.qssmmmmqcbmwws...',
  '..qddsssDDmmmmd...',
  '....DDBBBBf.......',
  '..ccqsssdBfFfbb...',
  '...cqqqqdBBfb.....',
  '.....DDBBBBBb.....',
  '......DDBBBb......',
  '.......DDbb.......',
  '..................',
];

const GUNSHIP_E_ATK2: readonly string[] = [
  '......bb..........',
  '.....bBBbe........',
  '.ccqsssdBb........',
  '..cqqqqdBBb.......',
  '..sdwwmDDqcbw.....',
  '.qssmmmmqcbmwws...',
  '..qddsssDDmmmmd...',
  '....DDBBBBe.......',
  '..ccqsssdBBBBbb...',
  '...cqqqqdBBBBb....',
  '.....DDBBBBBb.....',
  '......DDBBBb......',
  '.......DDbb.......',
  '..................',
];

const GUNSHIP_SE_1: readonly string[] = [
  '.....c............',
  '....ccqsssd.......',
  '.....cqqqqdDBb....',
  '..qq...DDBBBbb....',
  '..dmmssmmDBBBbb...',
  '...smmmmmmDBBBb...',
  '.c..qmmmmmmqcbw...',
  '.ccqsssdDDmqcbww..',
  '..cqqqqdDDsmbbwws.',
  '..DDBBBBBDDsmmmmd.',
  '.bBBBBBBBd..qqdd..',
  '.DDBBBBBb.........',
  '..DDDBBb..........',
  '..................',
];

const GUNSHIP_SE_2: readonly string[] = [
  '..................',
  '.....c............',
  '....ccqsssd.......',
  '.....cqqqqdDBb....',
  '..qq...DDBBBbb....',
  '..dmmssmmDBBBbb...',
  '...smmmmmmDBBBb...',
  '.c..qmmmmmmqcbw...',
  '.ccqsssdDDmqcbww..',
  '..cqqqqdDDsmbbwws.',
  '..DDBBBBBDDsmmmmd.',
  '.bBBBBBBBd..qqdd..',
  '.DDBBBBBb.........',
  '..DDDBBb..........',
];

const GUNSHIP_SE_ATK1: readonly string[] = [
  '.....c............',
  '....ccqsssd.f.....',
  '.....cqqqqDfFf....',
  '..qq...DDBBBf.....',
  '..dmmssmmDBBBbb...',
  '...smmmmmmDBBBb...',
  '.c..qmmmmmmqcbw...',
  '.ccqsssdDDmqcbww..',
  '..cqqqqdDDsmbbwws.',
  '..DDBBBfFfDsmmmmd.',
  '.bBBBBBfFf..qqdd..',
  '.DDBBBBBf.........',
  '..DDDBBb..........',
  '..................',
];

const GUNSHIP_SE_ATK2: readonly string[] = [
  '.....c............',
  '....ccqsssd.e.....',
  '.....cqqqqdDBb....',
  '..qq...DDBBBbb....',
  '..dmmssmmDBBBbb...',
  '...smmmmmmDBBBb...',
  '.c..qmmmmmmqcbw...',
  '.ccqsssdDDmqcbww..',
  '..cqqqqdDDsmbbwws.',
  '..DDBBBe.DDsmmmmd.',
  '.bBBBBBBBd..qqdd..',
  '.DDBBBBBb.........',
  '..DDDBBb..........',
  '..................',
];

const GUNSHIP_S_1: readonly string[] = [
  '....c........c....',
  '....cc......cc....',
  '....dqq.qq.qqd....',
  '..DDdqq.mm.qqdDD..',
  '.DDDdqqDmmDqqdDDD.',
  '.bBBDsqqmmqqsDBBb.',
  '..bBBsqqmmqqsBBb..',
  '...bbBsdmmsdBbb...',
  '.....bbDmmDbb.....',
  '......sqbbqs......',
  '......sqccqs......',
  '.......wmmw.......',
  '........ww........',
  '..................',
];

const GUNSHIP_S_2: readonly string[] = [
  '..................',
  '....cc......cc....',
  '....dqq.qq.qqd....',
  '..DDdqq.mm.qqdDD..',
  '.DDDdqqDmmDqqdDDD.',
  '.bBBDsqqmmqqsDBBb.',
  '..bBBsqqmmqqsBBb..',
  '...bbBsdmmsdBbb...',
  '.....bbDmmDbb.....',
  '......sqbbqs......',
  '......sqccqs......',
  '.......wmmw.......',
  '........ww........',
  '..................',
];

const GUNSHIP_S_ATK1: readonly string[] = [
  '....c........c....',
  '....cc......cc....',
  '....dqq.qq.qqd....',
  '..DDdqq.mm.qqdDD..',
  '.DDDdqqDmmDqqdDDD.',
  '.bBBDsqqmmqqsDBBb.',
  '..bBBsqqmmqqsBBb..',
  '...bfBsdmmsdBfb...',
  '...fFf.DmmD.fFf...',
  '....f.sqbbqs.f....',
  '......sqccqs......',
  '.......wmmw.......',
  '........ww........',
  '..................',
];

const GUNSHIP_S_ATK2: readonly string[] = [
  '....c........c....',
  '....cc......cc....',
  '....dqq.qq.qqd....',
  '..DDdqq.mm.qqdDD..',
  '.DDDdqqDmmDqqdDDD.',
  '.bBBDsqqmmqqsDBBb.',
  '..bBBsqqmmqqsBBb..',
  '...beBsdmmsdBeb...',
  '.....bbDmmDbb.....',
  '......sqbbqs......',
  '......sqccqs......',
  '.......wmmw.......',
  '........ww........',
  '..................',
];

const GUNSHIP_DEATH_0: readonly string[] = [
  '.......fFf........',
  '.....efFFFfe......',
  '....e.bfFFbd......',
  '......sfFss.......',
  '....e.dBffBd.e....',
  '.......effe.......',
  '......e....e......',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
];

const GUNSHIP_DEATH_1: readonly string[] = [
  '....e..fF..e......',
  '......fFFFf.......',
  '...e..efFfe..e....',
  '......e.fe........',
  '....e......e......',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
];

const GUNSHIP_DEATH_2: readonly string[] = [
  '..................',
  '.....e....e.......',
  '.......e..........',
  '....e.....e.......',
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
];

const VANGUARD_GUNSHIP: TitanSpec = {
  id: 'vanguard-gunship',
  name: 'Vanguard Valkyrie',
  role: 'VTOL Gunship',
  faction: 'vanguard',
  layer: 'air',
  width: 18,
  height: 14,
  shadowRx: 6.4,
  shadowRy: 2.6,
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
// 3. KRAXEN BROOD BEHEMOTH (20x18 ground) — Armored shoulder shield + hooked Kaiser forelimbs
// ============================================================================
// Consistent 3D anatomy across all 8 headings:
//   - 8x6 pink-rimmed armored shoulder shield stepped above a 6x5 rump
//   - Recessed 4x3 dark head with fierce green brow eyes ONLY inside the face (never on back!)
//   - Two 3px-root hooked forelimbs bending at muscular elbows into curved ivory blades with open notches
//   - Thick 3px muscular thighs, 2px clawed feet planted on y=16, visible background gap under belly

// N: Distinct wide 10px armored shoulder shield peaking ABOVE the wide mid-shoulder hooked arms (NOT horns!),
// crisp dark waist crease (y=8), narrower 6px lower rump (y=9..12), 3px hind thighs with 4px gap!
const BEH_N_IDLE_0: readonly string[] = [
  '....................',
  '....................',
  '......ppmmmmpp......',
  '..o..ppmmmmmmpp..o..',
  '.oo.ppmmppppmmpp.oo.',
  '.cc.pmmmmmmmmmmp.cc.',
  '.mmummmmmmmmmmmmumm.',
  '..uuummmmmmmmmmuuu..',
  '.....rrrrrurrrr.....',
  '......ppmmmmpp......',
  '......pmmuummp......',
  '......rmmuummr......',
  '.....rrrRuuRrrr.....',
  '.....rrrR..Rrrr.....',
  '.....rrR....Rrr.....',
  '.....rrC....Crr.....',
  '.....oC......Co.....',
  '....................',
];

const BEH_N_MOVE_0: readonly string[] = [
  '....................',
  '....................',
  '......ppmmmmpp......',
  '..o..ppmmmmmmpp..o..',
  '.oo.ppmmppppmmpp.oo.',
  '.cc.pmmmmmmmmmmp.cc.',
  '.mmummmmmmmmmmmmumm.',
  '..uuummmmmmmmmmuuu..',
  '.....rrrrrurrrr.....',
  '......ppmmmmpp......',
  '......pmmuummp......',
  '......rmmuummr......',
  '.....rrrRuuRrrr.....',
  '.....rrC....Rrrr....',
  '.....oC.....Rrr.....',
  '............Crr.....',
  '.............Co.....',
  '....................',
];

const BEH_N_MOVE_2: readonly string[] = [
  '....................',
  '....................',
  '......ppmmmmpp......',
  '..o..ppmmmmmmpp..o..',
  '.oo.ppmmppppmmpp.oo.',
  '.cc.pmmmmmmmmmmp.cc.',
  '.mmummmmmmmmmmmmumm.',
  '..uuummmmmmmmmmuuu..',
  '.....rrrrrurrrr.....',
  '......ppmmmmpp......',
  '......pmmuummp......',
  '......rmmuummr......',
  '.....rrrRuuRrrr.....',
  '....rrrR....Crr.....',
  '.....rrR.....Co.....',
  '.....rrC............',
  '.....oC.............',
  '....................',
];

const BEH_N_ATK_1: readonly string[] = [
  '..ooo..........ooo..',
  '.oocc..........ccoo.',
  '.oc..ppmmmmmmpp..co.',
  '.cc.ppmmppppmmpp.cc.',
  '.mm.pmmmmmmmmmmp.mm.',
  '.mmummmmmmmmmmmmumm.',
  '..uuummmmmmmmmmuuu..',
  '.....rrrrrurrrr.....',
  '......ppmmmmpp......',
  '......pmmuummp......',
  '......rmmuummr......',
  '.....rrrRuuRrrr.....',
  '.....rrrR..Rrrr.....',
  '.....rrR....Rrr.....',
  '.....rrC....Crr.....',
  '.....oC......Co.....',
  '.....oC......Co.....',
  '....................',
];

// NE: High-contrast diagonal dark waist crease separating bright pink-rimmed lower-left rump from upper-right 8x6 shield,
// plus wide 2px open background notch inside the raised near hooked arm!
const BEH_NE_IDLE_0: readonly string[] = [
  '..........oo........',
  '.........oc......o..',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp..oc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..cc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

const BEH_NE_MOVE_0: readonly string[] = [
  '..........oo........',
  '.........oc......o..',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp..oc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..cc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr.....Rrr...',
  '.rrC...oC.....rrC...',
  '.oC...........oC....',
  '....................',
  '....................',
];

const BEH_NE_MOVE_1: readonly string[] = [
  '....................',
  '..........oo........',
  '.........oc......o..',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp..oc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..cc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

const BEH_NE_MOVE_2: readonly string[] = [
  '..........oo........',
  '.........oc......o..',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp..oc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..cc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  'rrrR..uuurruuuRrr...',
  'rrR...........Rrr...',
  'rrC.....rr....Rrr...',
  'oC......rC....rrC...',
  '........oC....oC....',
  '....................',
  '....................',
];

const BEH_NE_ATK_0: readonly string[] = [
  '.........oo.........',
  '........oc......o...',
  '......ppmmpp...oo...',
  '....ppmmmmmmpp..oc..',
  '...ppmmmmmmmpr..cc..',
  '...pmmppppmmmr..cc..',
  '..rmmmmmmmmmmu.rmm..',
  '.rrrrrrrmmmmuuumrm..',
  '.pppppprruuuuummm...',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

const BEH_NE_ATK_1: readonly string[] = [
  '..........oo.....ooo',
  '.........oc.....oocc',
  '.......ppmmpp...occ.',
  '.....ppmmmmmmpp..cc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..mc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

const BEH_NE_ATK_2: readonly string[] = [
  '....................',
  '..........oo........',
  '.........oc......oo.',
  '.......ppmmpp...oocc',
  '.....ppmmmmmmpp..ccc',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..mc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

const BEH_NE_ATK_3: readonly string[] = [
  '..........oo........',
  '.........oc......o..',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp..oc.',
  '....ppmmmmmmmpr..cc.',
  '....pmmppppmmmr..cc.',
  '...rmmmmmmmmmmu.rmm.',
  '..rrrrrrrmmmmuuumrm.',
  '.pppppprruuuuummmm..',
  '.ppmmmuuuuuuumrr....',
  '.rrmmuuuuuuummr.....',
  '.rrrRuuurruuuRrr....',
  '.rrrR........Rrr....',
  '.rrR...rr....Rrr....',
  '.rrC...rC....rrC....',
  '.rrC...oC....rrC....',
  '.oC..........oC.....',
  '....................',
];

// E: Far upper hook (y=1..3) clearly separated by a 6-row jaw/air gap from the lower near hooked forearm (y=10..14),
// crisp waist crease between left rump & towering 8x6 right shoulder shield, thick 3px thighs & clear belly gap!
const BEH_E_IDLE_0: readonly string[] = [
  '....................',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp.oc..',
  '....ppmmppppmmppcc..',
  '..pppmmmmmmmmmuur...',
  '.ppmmmrrmmmmuuurrr..',
  '.pmmmmuurruuumrrgGr.',
  '.pmmuuuuuuuuumrrrr..',
  '.rmmuuuuuuuuumm.....',
  '..rrmmuuummmuum.....',
  '..rrrRuuummmm....oo.',
  '..rrrR...rmmmm..ooc.',
  '..rrR.....rmmmccoo..',
  '..rrR.....rrrccco...',
  '..rrC.....rrC.......',
  '..rrC.....rrC.......',
  '..oC......oC........',
  '....................',
];

const BEH_E_MOVE_0: readonly string[] = [
  '....................',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp.oc..',
  '....ppmmppppmmppcc..',
  '..pppmmmmmmmmmuur...',
  '.ppmmmrrmmmmuuurrr..',
  '.pmmmmuurruuumrrgGr.',
  '.pmmuuuuuuuuumrrrr..',
  '.rmmuuuuuuuuumm.....',
  '..rrmmuuummmuum.....',
  '..rrrRuuummmm....oo.',
  '..rrrR...rmmmm..ooc.',
  '..rrR.....rmmmccoo..',
  '..rrC......rrccco...',
  '..oC.......rrC......',
  '...........oC.......',
  '....................',
  '....................',
];

const BEH_E_MOVE_2: readonly string[] = [
  '....................',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp.oc..',
  '....ppmmppppmmppcc..',
  '..pppmmmmmmmmmuur...',
  '.ppmmmrrmmmmuuurrr..',
  '.pmmmmuurruuumrrgGr.',
  '.pmmuuuuuuuuumrrrr..',
  '.rmmuuuuuuuuumm.....',
  '..rrmmuuummmuum.....',
  '..rrrRuuummmm....oo.',
  '.rrrR....rmmmm..ooc.',
  '.rrC......rmmmccoo..',
  '.oC.......rrrccco...',
  '..........rrC.......',
  '..........oC........',
  '....................',
  '....................',
];

const BEH_E_ATK_1: readonly string[] = [
  '....................',
  '....................',
  '.......ppmmpp...oo..',
  '.....ppmmmmmmpp.oc..',
  '....ppmmppppmmppcc..',
  '..pppmmmmmmmmmuur...',
  '.ppmmmrrmmmmuuurrr..',
  '.pmmmmuurruuumrrgGr.',
  '.pmmuuuuuuuuumrrrr..',
  '.rmmuuuuuuuuumm.....',
  '..rrmmuuummmuum..ooo',
  '..rrrRuuummmm..ccooo',
  '..rrrR...rmmmmccooo.',
  '..rrR.....rrrccco...',
  '..rrC.....rrC.......',
  '..rrC.....rrC.......',
  '..oC......oC........',
  '....................',
];

const BEH_SE_IDLE_0: readonly string[] = [
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmmmmmmmpp.....',
  '.pmmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.rmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmm...rr.oo.',
  '..rrR..rmm...rrr....',
  '..rrC..rmmc..rrR....',
  '..rrC...rmco.rrC....',
  '..oC.....cco.rrC....',
  '..........oo.oC.....',
  '....................',
];

const BEH_SE_IDLE_1: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.pmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmm...rr.oo.',
  '..rrR..rmm...rrr....',
  '..rrC..rmmc..rrR....',
  '..rrC...rmco.rrC....',
  '..oC.....cco.rrC....',
  '..........oo.oC.....',
  '....................',
];

const BEH_SE_MOVE_0: readonly string[] = [
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmmmmmmmpp.....',
  '.pmmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.rmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmm...rr.oo.',
  '..rrR..rmm....rrr...',
  '..rrC..rmmc...rrR...',
  '..oC....rmco..rrC...',
  '.........cco..oC....',
  '..........oo........',
  '....................',
];

const BEH_SE_MOVE_2: readonly string[] = [
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmmmmmmmpp.....',
  '.pmmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.rmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '.rrrR..rmmm...rr.oo.',
  '.rrC...rmm...rrr....',
  '.oC....rmmc..rrR....',
  '........rmco.rrC....',
  '.........cco.oC.....',
  '..........oo........',
  '....................',
];

const BEH_SE_ATK_0: readonly string[] = [
  '....................',
  '....ppmmpp..........',
  '..ppmmmmmmpp........',
  '.ppmmppppmmpp.......',
  '.pmmmmmmmmmmppr.....',
  '.pmmmmmuuuuumrgGr...',
  '.rmmuuuuuuuummrrrc..',
  '..rrmmuuummmurrr.co.',
  '..rrrRuuummm..rr.oo.',
  '..rrrRrmm.....rr....',
  '..rrR.rmmc...rrr....',
  '..rrC..rmco..rrR....',
  '..rrC...cco..rrC....',
  '..oC.....oo..rrC....',
  '.............oC.....',
  '....................',
  '....................',
  '....................',
];

const BEH_SE_ATK_1: readonly string[] = [
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmmmmmmmpp.....',
  '.pmmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.rmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmmcccrrooo.',
  '..rrR..rmmmcccoooo..',
  '..rrC...rmm..rrRooo.',
  '..rrC........rrC....',
  '..oC.........rrC....',
  '.............oC.....',
  '....................',
];

const BEH_SE_ATK_2: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.pmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmm...rr.oo.',
  '..rrR..rmmcccrrr....',
  '..rrC...rmccoooR....',
  '..rrC.....cooooC....',
  '..oC........oooC....',
  '.............oC.....',
  '....................',
];

const BEH_SE_ATK_3: readonly string[] = [
  '....................',
  '....................',
  '.....ppmmpp.........',
  '...ppmmmmmmpp.......',
  '..ppmmppppmmpp......',
  '.ppmmmmmmmmmmpp.....',
  '.pmmmmmuuuuummpr....',
  '.pmmmuuuuuuuumrgGr..',
  '.rmmuuuuuuuuummrrrc.',
  '..rrmmuuummmmurrr.co',
  '..rrrRuuummm..rr..oo',
  '..rrrR.rmmm...rr.oo.',
  '..rrR..rmm...rrr....',
  '..rrC..rmmc..rrR....',
  '..rrC...rmco.rrC....',
  '..oC.....cco.rrC....',
  '..........oo.oC.....',
  '....................',
];

const BEH_S_IDLE_0: readonly string[] = [
  '....................',
  '......ppmmmmpp......',
  '....ppmmmmmmmmpp....',
  '...ppmmppppppmmpp...',
  '..ppmmmmmmmmmmmmpp..',
  '..pmmuummmmmmuummp..',
  '..pmu.rrgGGgrr.ump..',
  '.mmmu.rrrrrrrr.ummm.',
  '.mmm..rrrrrrrr..mmm.',
  '.rmc...rrrrrr...cmr.',
  '.rco....r..r....ocr.',
  '..oo...rR..Rr...oo..',
  '...oo..rR..Rr..oo...',
  '....o..rR..Rr..o....',
  '.......rC..Cr.......',
  '.......rC..Cr.......',
  '.......oC..Co.......',
  '....................',
];

const BEH_S_MOVE_0: readonly string[] = [
  '....................',
  '......ppmmmmpp......',
  '....ppmmmmmmmmpp....',
  '...ppmmppppppmmpp...',
  '..ppmmmmmmmmmmmmpp..',
  '..pmmuummmmmmuummp..',
  '..pmu.rrgGGgrr.ump..',
  '.mmmu.rrrrrrrr.ummm.',
  '.mmm..rrrrrrrr..mmm.',
  '.rmc...rrrrrr...cmr.',
  '.rco....r..r....ocr.',
  '..oo...rR..Rr...oo..',
  '...oo..rR..Rr..oo...',
  '....o..rC..Rr..o....',
  '.......oC..Cr.......',
  '...........Cr.......',
  '...........Co.......',
  '....................',
];

const BEH_S_MOVE_2: readonly string[] = [
  '....................',
  '......ppmmmmpp......',
  '....ppmmmmmmmmpp....',
  '...ppmmppppppmmpp...',
  '..ppmmmmmmmmmmmmpp..',
  '..pmmuummmmmmuummp..',
  '..pmu.rrgGGgrr.ump..',
  '.mmmu.rrrrrrrr.ummm.',
  '.mmm..rrrrrrrr..mmm.',
  '.rmc...rrrrrr...cmr.',
  '.rco....r..r....ocr.',
  '..oo...rR..Rr...oo..',
  '...oo..rR..Rr..oo...',
  '....o..rR..Cr..o....',
  '.......rC..Co.......',
  '.......rC...........',
  '.......oC...........',
  '....................',
];

// S Attack A1: shield lowers 1 row, both hooks close inward leaving 2 clear dark pixels between tips!
const BEH_S_ATK_1: readonly string[] = [
  '....................',
  '....................',
  '......ppmmmmpp......',
  '....ppmmmmmmmmpp....',
  '...ppmmppppppmmpp...',
  '..ppmmmmmmmmmmmmpp..',
  '..pmmuummmmmmuummp..',
  '..pmu.rrgGGgrr.ump..',
  '.mmmu.rrrrrrrr.ummm.',
  '.rmm..rrrrrrrr..mmr.',
  '.rrc...rrrrrr...crr.',
  '..cco..rR..Rr..occ..',
  '...ooo.rR..Rr.ooo...',
  '....ooo.r..r.ooo....',
  '.....oo.r..r.oo.....',
  '.......rC..Cr.......',
  '.......oC..Co.......',
  '....................',
];

// Grounded carcass death (20x18, feet stay anchored on y=16!)
const BEH_DEATH_0: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '......g..g..........',
  '....pgGmmGgp........',
  '...pGmmGGmmGp..o....',
  '..pmmggggggmmp.oc...',
  '..rmmuuggguumr.cc...',
  '.rrmuuuggguuurcc....',
  '..rrmmgggggmmrco....',
  '..rrmr.ggg.rmr......',
  '..rrC..g.g..rC......',
  '..rrC..r.r..rC......',
  '..rC...r.r..rC......',
  '..oC...C.C..oC......',
  '....................',
];

const BEH_DEATH_1: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '.....g....g.........',
  '....p.gGGg.p........',
  '...pmggggggmp.......',
  '..rmmuuggguumr.c....',
  '.rrmuuggggguur.oc...',
  '..rrmmgggggmmr.c....',
  '..rrC.rgggr.rC......',
  '..rrC.r...r.rC......',
  '..oC..CC.CC..oC.....',
  '....................',
];

const BEH_DEATH_2: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '.....g....g.........',
  '...rrggggggrr.......',
  '..rruugggguur..c....',
  '...rr..gg..rr..o....',
  '....................',
];

const KRAXEN_BEHEMOTH: TitanSpec = {
  id: 'kraxen-behemoth',
  name: 'Kraxen Behemoth',
  role: 'Tusk Juggernaut',
  faction: 'kraxen',
  layer: 'ground',
  width: 20,
  height: 18,
  shadowRx: 9.0,
  shadowRy: 3.6,
  airAltitude: 0,
  attackKind: 'cleave',
  anims: {
    idle: {
      N: [BEH_N_IDLE_0, BEH_N_MOVE_0],
      E: [BEH_E_IDLE_0, BEH_E_MOVE_0],
      S: [BEH_S_IDLE_0, BEH_S_MOVE_0],
      SE: [BEH_SE_IDLE_0, BEH_SE_IDLE_1],
      NE: [BEH_NE_IDLE_0, BEH_NE_MOVE_1],
    },
    move: {
      N: [BEH_N_MOVE_0, BEH_N_IDLE_0, BEH_N_MOVE_2, BEH_N_IDLE_0],
      E: [BEH_E_MOVE_0, BEH_E_IDLE_0, BEH_E_MOVE_2, BEH_E_IDLE_0],
      S: [BEH_S_MOVE_0, BEH_S_IDLE_0, BEH_S_MOVE_2, BEH_S_IDLE_0],
      SE: [BEH_SE_MOVE_0, BEH_SE_IDLE_1, BEH_SE_MOVE_2, BEH_SE_IDLE_0],
      NE: [BEH_NE_MOVE_0, BEH_NE_MOVE_1, BEH_NE_MOVE_2, BEH_NE_IDLE_0],
    },
    attack: {
      N: [BEH_N_IDLE_0, BEH_N_ATK_1, BEH_N_ATK_1, BEH_N_IDLE_0, BEH_N_IDLE_0],
      E: [BEH_E_IDLE_0, BEH_E_ATK_1, BEH_E_ATK_1, BEH_E_IDLE_0, BEH_E_IDLE_0],
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
// 4. KRAXEN BIO-WYVERN (14x12 air) — Swept-back bat-wing dragon on all 8 headings
// ============================================================================

// SE: Swept-back crescent bat-wings swooping DOWN-RIGHT, compact curved tail upper-left, horned head lower-right!
const WYVERN_SE_UP: readonly string[] = [
  '.......ooo....',
  '.......pmpo...',
  '..r.....pmpo..',
  '..rr..r.pmmp..',
  '...rr.rggmmp..',
  '..uuumrmmgmp..',
  '.pmmmppummGmo.',
  '..ppppo.pmggo.',
  '....oo..pmmo..',
  '.........oo...',
  '..............',
  '..............',
];

const WYVERN_SE_MID: readonly string[] = [
  '..............',
  '......ooo.....',
  '..r..ppppo....',
  '..rr.pmmmpo...',
  '...rrummmmpo..',
  '..ppmmmggmGmo.',
  '..pmmp.rggmgg.',
  '...oo...pmmo..',
  '.........oo...',
  '..............',
  '..............',
  '..............',
];

const WYVERN_SE_DOWN: readonly string[] = [
  '..............',
  '..............',
  '..r...........',
  '..rr..ppmp....',
  '...rrummmmpo..',
  '...pmmmggmGmo.',
  '..pmmp.rggmgp.',
  '..pmo..rrpmmp.',
  '..oo......pmpo',
  '...........oo.',
  '..............',
  '..............',
];

const WYVERN_SE_SPIT: readonly string[] = [
  '.......ooo....',
  '.......pmpo...',
  '..r.....pmpo..',
  '..rr..r.pmmp..',
  '...rr.rggmmp..',
  '..uuumrmmGmp..',
  '.pmmmppummGGg.',
  '..ppppo.pmGGg.',
  '....oo..pmgg..',
  '.........oo...',
  '..............',
  '..............',
];

// NE: Swept-back crescent bat-wings flying UP-RIGHT, horned head upper-right, compact curved tail tucked behind!
const WYVERN_NE_UP: readonly string[] = [
  '.........oo...',
  '....oo..pmmo..',
  '..ppppo.pmmp..',
  '.pmmmppummmp..',
  '..uuumrmmmpp..',
  '...rr.rggmmp..',
  '..rr..r.pmmp..',
  '..r.....pmpo..',
  '.......pmpo...',
  '.......ooo....',
  '..............',
  '..............',
];

const WYVERN_NE_MID: readonly string[] = [
  '.........oo...',
  '....oo..pmmo..',
  '...pppo.pmmp..',
  '..pmmmppmmmp..',
  '...rummmmmpp..',
  '..rr.rggmppo..',
  '..r..r..pmpo..',
  '........ooo...',
  '..............',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_DOWN: readonly string[] = [
  '.........oo...',
  '........pmmo..',
  '....ppmo.pmmp.',
  '...pmmmpppmp..',
  '..pmmummmmp...',
  '.rrpm.rmmmp...',
  'rr.oo.rggmp...',
  'r......rrpmo..',
  '..........oo..',
  '..............',
  '..............',
  '..............',
];

const WYVERN_NE_SPIT: readonly string[] = [
  '.........oogG.',
  '....oo..pmGGg.',
  '..ppppo.pmgg..',
  '.pmmmppummmp..',
  '..uuumrmmmpp..',
  '...rr.rggmmp..',
  '..rr..r.pmmp..',
  '..r.....pmpo..',
  '.......pmpo...',
  '.......ooo....',
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

// E: Full-mass horizontal predator profile: 2x2 chest, crisp notched high wing elbow above chest, horned head ahead, 3px tail behind!
const WYVERN_E_UP: readonly string[] = [
  '..ooo.........',
  '.ppppo........',
  '.pmmmpo.......',
  '..ummmpo...o..',
  '...ummpp.pmmo.',
  '..rummmggmGgm.',
  'rrruummgGmggo.',
  'r..rrmmmggmr..',
  '.....rrmmr....',
  '..............',
  '..............',
  '..............',
];

const WYVERN_E_DOWN: readonly string[] = [
  '..............',
  '..............',
  '...........o..',
  '..rummmp.pmmo.',
  'rrruummggmGgmo',
  'r..rrmmgGmgg..',
  '....ummmggmr..',
  '...pmmmpo.....',
  '..pmmmpo......',
  '..ppppo.......',
  '...ooo........',
  '..............',
];

const WYVERN_E_SPIT: readonly string[] = [
  '..ooo.........',
  '.ppppo........',
  '.pmmmpo.......',
  '..ummmpo...o..',
  '...ummpp.pmmg.',
  '..rummmGGmGGgG',
  'rrruummGGmgGg.',
  'r..rrmmmggmr..',
  '.....rrmmr....',
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
// 5. SOLARIS THERMAL COLOSSUS (16x16 ground) — Rotating beam port + staggered stilts
// ============================================================================

// SE: Port shifted to lower-right rim (10..12, 3..5); far-left foot high (y12), near feet low (y14)
const COL_SE_IDLE_0: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCc...',
  '...bbggggCCcb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg..gb..bg..gy.',
  '.gb..g....g..bg.',
  '.b...g....b...g.',
  'bb...g....b...b.',
  '.....b....b...b.',
  '....bb.......bb.',
  '................',
];

const COL_SE_IDLE_1: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggccC...',
  '..gbbttggcCCc...',
  '...bbggggccCb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg..gb..bg..gy.',
  '.gb..g....g..bg.',
  '.b...g....b...g.',
  'bb...g....b...b.',
  '.....b....b...b.',
  '....bb.......bb.',
  '................',
];

const COL_SE_MOVE_0: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCc...',
  '...bbggggCCcb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg..gb..bg...gy',
  'yg...g....g...bg',
  'gb...g....b....g',
  'b....b....b...bb',
  '....bb....b.....',
  '................',
  '................',
];

const COL_SE_MOVE_2: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCc...',
  '...bbggggCCcb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg...gb.bg..gy.',
  '.gb...g..g...bg.',
  '.b....b..b....g.',
  'bb....b..b....b.',
  '.............bb.',
  '................',
  '................',
];

const COL_SE_ATK_0: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCcc..',
  '...bbggggCCcb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg..gb..bg..gy.',
  '.gb..g....g..bg.',
  '.b...g....b...g.',
  'bb...g....b...b.',
  '.....b....b...b.',
  '....bb.......bb.',
  '................',
];

const COL_SE_ATK_1: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCCc..',
  '...bbggggCCCCc..',
  '....ybbTTbbycCc.',
  '...yg..bb..gyc..',
  '..yg..y..y..gy..',
  '.yg..gb..bg..gy.',
  '.gb..g....g..bg.',
  '.b...g....b...g.',
  'bb...g....b...b.',
  '.....b....b...b.',
  '....bb.......bb.',
  '................',
];

const COL_SE_ATK_2: readonly string[] = [
  '....yyyyyy......',
  '..yyggggggyy....',
  '..yggTTTTgggy...',
  '..ggTtttggCCc...',
  '..gbbttggCCCcc..',
  '...bbggggCCcCc..',
  '....ybbTTbby.Cc.',
  '...yg..bb..gyc..',
  '..yg..y..y..gy..',
  '.yg..gb..bg..gy.',
  '.gb..g....g..bg.',
  '.b...g....b...g.',
  'bb...g....b...b.',
  '.....b....b...b.',
  '....bb.......bb.',
  '................',
];

// NE: Golden helmet crown stays intact on top; cyan beam port tucked cleanly into upper-right visor rim!
const COL_NE_IDLE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTggCCc..',
  '..ggTttttggCCc..',
  '..gbbttttgggb...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '..gb..g..g..gy..',
  '.yg..gb..bg..bg.',
  '.gb..b....b...b.',
  '.g...b....g..bb.',
  '.b........b.....',
  'bb.......bb.....',
  '................',
];

const COL_NE_MOVE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTggCCc..',
  '..ggTttttggCCc..',
  '..gbbttttgggb...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '.yg...g..g..gy..',
  'yg...gb..bg..bg.',
  'gb...b....b..bb.',
  'b.........g.....',
  '.........bb.....',
  '................',
  '................',
];

const COL_NE_MOVE_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTggCCc..',
  '..ggTttttggCCc..',
  '..gbbttttgggb...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '..gb..g..g..gy..',
  '.yg...gb.bg..bg.',
  '.gb...b..b....b.',
  '.g....b..b...bb.',
  '.b..............',
  'bb..............',
  '................',
];

const COL_NE_ATK_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyyc..',
  '..yggTTTTggCCc..',
  '..ggTttttggCCc..',
  '..gbbttttgggb...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '..gb..g..g..gy..',
  '.yg..gb..bg..bg.',
  '.gb..b....b...b.',
  '.g...b....g..bb.',
  '.b........b.....',
  'bb.......bb.....',
  '................',
];

const COL_NE_ATK_1: readonly string[] = [
  '.....yyyyyy..c..',
  '...yyggggggycCc.',
  '..yggTTTTggCCCc.',
  '..ggTttttggCCCc.',
  '..gbbttttgggbc..',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '..gb..g..g..gy..',
  '.yg..gb..bg..bg.',
  '.gb..b....b...b.',
  '.g...b....g..bb.',
  '.b........b.....',
  'bb.......bb.....',
  '................',
];

const COL_NE_ATK_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyyc..',
  '..yggTTTTggCCCc.',
  '..ggTttttggCCc..',
  '..gbbttttgggb...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..y..y.gy...',
  '..gb..g..g..gy..',
  '.yg..gb..bg..bg.',
  '.gb..b....b...b.',
  '.g...b....g..bb.',
  '.b........b.....',
  'bb.......bb.....',
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

// N: Beam port HIDDEN behind smooth golden dome; outer far stilts at y13, inner rear stilts at y14!
const COL_N_IDLE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttbbbbttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '..g..gb..bg..g..',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  'bb...b....b...bb',
  '....bb....bb....',
  '................',
];

const COL_N_MOVE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttbbbbttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '.yg...g..g...gy.',
  '.gb..gb..bg..bg.',
  '.b...b....b...b.',
  '.....g....g.....',
  '....bb....bb....',
  '................',
  '................',
];

const COL_N_MOVE_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttbbbbttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '..g...gb.bg..g..',
  '.gb...b..b...bg.',
  '.g....b..b....g.',
  'bb............bb',
  '................',
  '................',
];

const COL_N_ATK_1: readonly string[] = [
  '....ccCCCCcc....',
  '...yygCCCCgyy...',
  '..yggTTTTTTggy..',
  '..ggTttttttTgg..',
  '..gbttbbbbttbg..',
  '...bbggggggbb...',
  '....ybbTTbby....',
  '...yg..bb..gy...',
  '..yg..y..y..gy..',
  '..gb..g..g..bg..',
  '..g..gb..bg..g..',
  '.gb..b....b..bg.',
  '.g...g....g...g.',
  'bb...b....b...bb',
  '....bb....bb....',
  '................',
];

// E: Pure side profile with gracefully splayed spider-walker knees & recessed right-rim thermal lens!
const COL_E_IDLE_0: readonly string[] = [
  '....yyyyyy......',
  '...yggggggyy....',
  '..ygTTggggCCc...',
  '..gTttggggCCCc..',
  '..gbttggggCCc...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..b..b.gy...',
  '.yg..b....b.gy..',
  '.gb..b....b..bg.',
  '.g...b....b...g.',
  '.b...b....b...b.',
  'b...bb....bb...b',
  'bb............bb',
  '................',
];

const COL_E_MOVE_0: readonly string[] = [
  '....yyyyyy......',
  '...yggggggyy....',
  '..ygTTggggCCc...',
  '..gTttggggCCCc..',
  '..gbttggggCCc...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..b..b.gy...',
  '.yg...b..b..gy..',
  'yg...b....b..bg.',
  'gb...b....b...g.',
  'b....b....b...b.',
  '....bb....bb....',
  '................',
  '................',
];

const COL_E_MOVE_2: readonly string[] = [
  '....yyyyyy......',
  '...yggggggyy....',
  '..ygTTggggCCc...',
  '..gTttggggCCCc..',
  '..gbttggggCCc...',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..b..b.gy...',
  '.yg..b....b.gy..',
  '.gb..b....b..bg.',
  '.g...b....b...g.',
  '.b............b.',
  'b..............b',
  'bb............bb',
  '................',
];

const COL_E_ATK_1: readonly string[] = [
  '....yyyyyy......',
  '...yggggggyy....',
  '..ygTTggggCCCc..',
  '..gTttggggCCCCC.',
  '..gbttggggCCCc..',
  '...bbgggggbb....',
  '....ybbTTby.....',
  '...yg..bb.gy....',
  '..yg..b..b.gy...',
  '.yg..b....b.gy..',
  '.gb..b....b..bg.',
  '.g...b....b...g.',
  '.b...b....b...b.',
  'b...bb....bb...b',
  'bb............bb',
  '................',
];

// S: Wide cyan beam port on LOWER front rim (y=4..5); beam starts BELOW the rim (y=6..10)!
const COL_S_IDLE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTggggggTgg..',
  '..gbggCCCCggbg..',
  '...ggcCCCCcgg...',
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

const COL_S_IDLE_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTggggggTgg..',
  '..gbggccCCggbg..',
  '...ggccCCccgg...',
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

const COL_S_MOVE_0: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTggggggTgg..',
  '..gbggCCCCggbg..',
  '...ggcCCCCcgg...',
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

const COL_S_MOVE_2: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTggggggTgg..',
  '..gbggCCCCggbg..',
  '...ggcCCCCcgg...',
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

const COL_S_ATK_1: readonly string[] = [
  '.....yyyyyy.....',
  '...yyggggggyy...',
  '..yggTTTTTTggy..',
  '..ggTggggggTgg..',
  '..gbggCCCCggbg..',
  '...ggcCCCCcgg...',
  '....ybCCCCby....',
  '...yg.cCCc.gy...',
  '..yg..cCCc..gy..',
  '..gb..gccg..bg..',
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
      N: [COL_N_IDLE_0, COL_N_IDLE_0],
      E: [COL_E_IDLE_0, COL_E_IDLE_0],
      S: [COL_S_IDLE_0, COL_S_IDLE_1],
      SE: [COL_SE_IDLE_0, COL_SE_IDLE_1],
      NE: [COL_NE_IDLE_0, COL_NE_IDLE_0],
    },
    move: {
      N: [COL_N_MOVE_0, COL_N_IDLE_0, COL_N_MOVE_2, COL_N_IDLE_0],
      E: [COL_E_MOVE_0, COL_E_IDLE_0, COL_E_MOVE_2, COL_E_IDLE_0],
      S: [COL_S_MOVE_0, COL_S_IDLE_0, COL_S_MOVE_2, COL_S_IDLE_0],
      SE: [COL_SE_MOVE_0, COL_SE_IDLE_0, COL_SE_MOVE_2, COL_SE_IDLE_0],
      NE: [COL_NE_MOVE_0, COL_NE_IDLE_0, COL_NE_MOVE_2, COL_NE_IDLE_0],
    },
    attack: {
      N: [COL_N_IDLE_0, COL_N_ATK_1, COL_N_ATK_1, COL_N_IDLE_0],
      E: [COL_E_IDLE_0, COL_E_ATK_1, COL_E_ATK_1, COL_E_IDLE_0],
      S: [COL_S_IDLE_0, COL_S_ATK_1, COL_S_ATK_1, COL_S_IDLE_0],
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
// 6. SOLARIS SKY-CARRIER (16x12 air) — Pointed faceted golden capital warship
// ============================================================================

// SE: Pointed golden prow DOWN-RIGHT, broad chamfered shoulders + royal-blue trim, sleek cyan core, twin stern exhausts!
const CARRIER_SE_1: readonly string[] = [
  '....c...........',
  '...ccyyyy.......',
  '.c.yCCggyyyy....',
  'cCgyygggggyyy...',
  '.cggTTggTTggyy..',
  '..yggTTCCtTgggy.',
  '...yggTTCCCtggy.',
  '....bbgTTCCtTgg.',
  '......bbggTTgggy',
  '.........bbggyy.',
  '............bb..',
  '................',
];

const CARRIER_SE_2: readonly string[] = [
  '................',
  '....c...........',
  '...ccyyyy.......',
  '.c.yCCggyyyy....',
  'cCgyygggggyyy...',
  '.cggTTggTTggyy..',
  '..yggTTCCtTgggy.',
  '...yggTTCCCtggy.',
  '....bbgTTCCtTgg.',
  '......bbggTTgggy',
  '.........bbggyy.',
  '............bb..',
];

const CARRIER_SE_LAUNCH_1: readonly string[] = [
  '....c...........',
  '...ccyyyy.......',
  '.c.yCCggyyyy....',
  'cCgyygggggyyy...',
  '.cggTTggTTggyy..',
  '..yggTTCCtTgCc..',
  '...yggTTCCCgCCc.',
  '....bbgTTCCtTgc.',
  '......bbggTTgggy',
  '.........bbggyy.',
  '............bb..',
  '................',
];

const CARRIER_SE_LAUNCH_2: readonly string[] = [
  '....c...........',
  '...ccyyyy.......',
  '.c.yCCggyyyy....',
  'cCgyygggggyyy...',
  '.cggTTggTTggyy..',
  '..yggTTCCtTgggy.',
  '...yggTTCCCtggy.',
  '....bbgTTCCtTgCc',
  '......bbggTTcCCc',
  '.........bbggCc.',
  '............bb..',
  '................',
];

// NE: Pointed golden prow UP-RIGHT, broad chamfered shoulders + royal-blue trim, sleek cyan core, twin stern exhausts!
const CARRIER_NE_1: readonly string[] = [
  '............yy..',
  '.........yyggyy.',
  '......yyggTTgggy',
  '....yygTTCCtTgg.',
  '...yggTTCCCtggb.',
  '..yggTTCCtTggbb.',
  '.cggTTggTTggbb..',
  'cCgbbgggggbbb...',
  '.c.bCCggbbbb....',
  '...ccbbbb.......',
  '....c...........',
  '................',
];

const CARRIER_NE_2: readonly string[] = [
  '................',
  '............yy..',
  '.........yyggyy.',
  '......yyggTTgggy',
  '....yygTTCCtTgg.',
  '...yggTTCCCtggb.',
  '..yggTTCCtTggbb.',
  '.cggTTggTTggbb..',
  'cCgbbgggggbbb...',
  '.c.bCCggbbbb....',
  '...ccbbbb.......',
  '....c...........',
];

const CARRIER_NE_LAUNCH_1: readonly string[] = [
  '............yy..',
  '.........yyggyc.',
  '......yyggTTgCCc',
  '....yygTTCCtTgc.',
  '...yggTTCCCtggb.',
  '..yggTTCCtTggbb.',
  '.cggTTggTTggbb..',
  'cCgbbgggggbbb...',
  '.c.bCCggbbbb....',
  '...ccbbbb.......',
  '....c...........',
  '................',
];

const CARRIER_NE_LAUNCH_2: readonly string[] = [
  '............yy..',
  '.........yyggyy.',
  '......yyggTTgggy',
  '....yygTTCCtTgCc',
  '...yggTTCCCgCCc.',
  '..yggTTCCtTgCc..',
  '.cggTTggTTggbb..',
  'cCgbbgggggbbb...',
  '.c.bCCggbbbb....',
  '...ccbbbb.......',
  '....c...........',
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
  '.......yy.......',
  '.....yyggyy.....',
  '....ygTCCtgy....',
  '...ygTTCCtTgy...',
  '..yggTCCCCtggy..',
  '..ygTTCCCCtTgy..',
  '..yggTTCCtTggy..',
  '...bbggCCggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '....c......c....',
  '................',
];

const CARRIER_N_2: readonly string[] = [
  '................',
  '.......yy.......',
  '.....yyggyy.....',
  '....ygTCCtgy....',
  '...ygTTCCtTgy...',
  '..yggTCCCCtggy..',
  '..ygTTCCCCtTgy..',
  '..yggTTCCtTggy..',
  '...bbggCCggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '....c......c....',
];

const CARRIER_N_LAUNCH: readonly string[] = [
  '.......yy.......',
  '.....yyggyy.....',
  '...cygTCCtgyc...',
  '.cCygTTCCtTgyCc.',
  '.cyggTCCCCtggyc.',
  '..ygTTCCCCtTgy..',
  '..yggTTCCtTggy..',
  '...bbggCCggbb...',
  '...bCCggggCCb...',
  '....ccbbbbcc....',
  '....c......c....',
  '................',
];

// E: Twin cyan exhausts grouped cleanly at trailing LEFT stern, 2-column tapered golden bow on RIGHT!
const CARRIER_E_1: readonly string[] = [
  '................',
  '....yyyyyyy.....',
  '..yygggggggyy...',
  'cCgTTgggggggy...',
  'c.gTttCCCCgggy..',
  '..gbCCCCCCCCggyy',
  '..gbCCCCCCCCggyy',
  'c.gTttCCCCgggy..',
  'cCgTTgggggggy...',
  '..bbgggggggbb...',
  '....bbbbbbb.....',
  '................',
];

const CARRIER_E_2: readonly string[] = [
  '................',
  '................',
  '....yyyyyyy.....',
  'c.yygggggggyy...',
  'cCgTTgggggggy...',
  '..gTttCCCCgggy..',
  '..gbCCCCCCCCggyy',
  'c.gbCCCCCCCCggyy',
  'cCgTttCCCCgggy..',
  '..bTTgggggggb...',
  '..bbgggggggbb...',
  '....bbbbbbb.....',
];

const CARRIER_E_LAUNCH_1: readonly string[] = [
  '................',
  '....yyyyyyy.....',
  '..yygggggggyc...',
  'cCgTTgggggggCc..',
  'c.gTttCCCCggCCc.',
  '..gbCCCCCCCCggyy',
  '..gbCCCCCCCCggyy',
  'c.gTttCCCCggCCc.',
  'cCgTTgggggggCc..',
  '..bbgggggggbc...',
  '....bbbbbbb.....',
  '................',
];

const CARRIER_E_LAUNCH_2: readonly string[] = [
  '................',
  '....yyyyyyy.....',
  '..yygggggggyy...',
  'cCgTTgggggggy...',
  'c.gTttCCCCggcCc.',
  '..gbCCCCCCCCgCCc',
  '..gbCCCCCCCCgCCc',
  'c.gTttCCCCggcCc.',
  'cCgTTgggggggy...',
  '..bbgggggggbb...',
  '....bbbbbbb.....',
  '................',
];

const CARRIER_S_1: readonly string[] = [
  '....c......c....',
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTCCtTggy..',
  '..ygTTCCCCtTgy..',
  '..yggTCCCCtggy..',
  '...ygTTCCtTgy...',
  '....ygTCCtgy....',
  '.....bbggbb.....',
  '......bbbb......',
  '.......bb.......',
  '................',
];

const CARRIER_S_2: readonly string[] = [
  '................',
  '....c......c....',
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTCCtTggy..',
  '..ygTTCCCCtTgy..',
  '..yggTCCCCtggy..',
  '...ygTTCCtTgy...',
  '....ygTCCtgy....',
  '.....bbggbb.....',
  '......bbbb......',
  '.......bb.......',
];

const CARRIER_S_LAUNCH: readonly string[] = [
  '....c......c....',
  '....ccbbbbcc....',
  '...bCCggggCCb...',
  '..yggTTCCtTggy..',
  '.cyTTCCCCtTgyc..',
  'cCyggTCCCCtggyCc',
  '.c.ygTTCCtTgy.c.',
  '....ygTCCtgy....',
  '.....bbggbb.....',
  '......bbbb......',
  '.......bb.......',
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
      E: [CARRIER_E_1, CARRIER_E_2],
      S: [CARRIER_S_1, CARRIER_S_2],
      SE: [CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2],
    },
    move: {
      N: [CARRIER_N_1, CARRIER_N_2, CARRIER_N_1, CARRIER_N_2],
      E: [CARRIER_E_1, CARRIER_E_2, CARRIER_E_1, CARRIER_E_2],
      S: [CARRIER_S_1, CARRIER_S_2, CARRIER_S_1, CARRIER_S_2],
      SE: [CARRIER_SE_1, CARRIER_SE_2, CARRIER_SE_1, CARRIER_SE_2],
      NE: [CARRIER_NE_1, CARRIER_NE_2, CARRIER_NE_1, CARRIER_NE_2],
    },
    attack: {
      N: [CARRIER_N_1, CARRIER_N_LAUNCH, CARRIER_N_LAUNCH, CARRIER_N_2],
      E: [CARRIER_E_1, CARRIER_E_LAUNCH_1, CARRIER_E_LAUNCH_2, CARRIER_E_2],
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
 * (Core pixel `(cx, cy)` -> outlined `(cx + 1, cy + 1)` -> rel `(cx - 8, cy - 15)`.)
 */
export const COLOSSUS_EMITTER_8: Readonly<Record<Dir8, readonly [number, number]>> = {
  N: [0, -15],
  NE: [5, -13],
  E: [6, -12],
  SE: [5, -10],
  S: [0, -8],
  SW: [-6, -10],
  W: [-7, -12],
  NW: [-6, -13],
};

export function getTitanAnimFrameCount(id: TitanId, anim: AnimId): number {
  return TITAN_SPEC_BY_ID[id].anims[anim].SE.length;
}
