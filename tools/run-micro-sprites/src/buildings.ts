/**
 * Micro-scale pixel-art RTS faction buildings, defensive turrets, mineral patches,
 * and subtle battlefield props proportioned to true 8x8 units (~2.5x-3.5x unit scale).
 */

import {
  buildFactionPalette,
  INK_OUTLINE,
  MINERAL_PALETTE,
  PROP_PALETTE,
  type FactionId,
  type TeamColorId,
} from './palette.ts';
import { addPixelOutline, compilePattern, type PixelSurface } from './pixel.ts';

export type BuildingId =
  | 'vanguard-bastion'
  | 'vanguard-turret'
  | 'kraxen-spire'
  | 'kraxen-colony'
  | 'solaris-nexus'
  | 'solaris-pylon'
  | 'mineral-cluster'
  | 'pine-tree'
  | 'rock-crag';

export interface BuildingAsset {
  readonly id: BuildingId;
  readonly name: string;
  readonly faction: FactionId | 'neutral';
  readonly surface: PixelSurface;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly shadowRx: number;
  readonly shadowRy: number;
}

// Vanguard Command Bastion (32x25 core -> 34x27 outlined, flush bottom row)
const VANGUARD_BASTION_ROWS: readonly string[] = [
  '.....w..........................',
  '....wsw.........................',
  '.....d...............dk..dk.....',
  '..wwwwwww............dk..dk.....',
  '.wmmmmmmmd..........sdd.sdd.....',
  '.sbbbbbbBd....bbbb..sdd.sdd.....',
  '.sBvvccBBD...sBBBBd.sBBdsBBd....',
  '.sBBBBBBBD..wssssssd.DDdsDDd....',
  '.sDDDDDDDd.wsvssssvdsddddddq....',
  '.sdddddddwsssssssssdqddkkddq....',
  '.sddkkddwsdsddddddsdqddddddq....',
  '.sddddddwsdsddddddsdqddddddq....',
  'bBBsddddwsdsddddddsdqddqqbBB....',
  'bBBsddddwsvsssssssvdqddqqbBB....',
  'bBDsddddwssssssssssdqddqqbBD....',
  'dDDsddddwwwssssssssdqddqqdDD....',
  'dDDssmmssddddddddddqqqqqqdDD....',
  'dDDssmmssdsddddddddqqqqqqdDD....',
  'dDDssddssdskkkkkkkskqqfqqdDD....',
  'dDDssddssdskkkkkkkskqqqqqdDD....',
  'dDDsdddssdskkkkkkkskqqqqqdDD....',
  '.dDsdddssdskkkkkkkskqqqqqdD.....',
  '..dsdddssdsdsssssdsqqqqqqd......',
  '..ddddddddddddddddqqqqqqqd......',
  '...ddddddddddddddqqqqqqqq.......',
];

// Vanguard Defense Bunker (18x13 core -> 20x15 outlined, flush bottom row)
const VANGUARD_TURRET_ROWS: readonly string[] = [
  '.........wbb......',
  '.........bBBd.....',
  '..wwwwwwwwBBd.....',
  '.wmmssssssmmdd....',
  'wssssssssssssdd...',
  'bBBddddddddddBBd..',
  'bBDsskkkkkkwwwwws.',
  'dDDsskkkkkkdkkkdk.',
  'dDDssddddddqqDDd..',
  'dDDssmmssddqqDDd..',
  'dDDssddssddqqDDd..',
  '.dDssddssddqqdD...',
  '.ddddddddddqqqd...',
];

// Kraxen Brood Hatchery (32x23 core -> 34x25 outlined, firmly grounded flat organic base!)
// Heavy wide fleshy root-skirt + thick grounded creep tendrils sitting flush on the bottom rows
// so the nest visibly grips and melts into the ground with ZERO floating shadow gap.
const KRAXEN_SPIRE_ROWS: readonly string[] = [
  '.............o..................',
  '......o.....oc..................',
  '.....oc....ocC.......o..........',
  '....ocC...ocC.......co..........',
  '....cC.pp.cC..Rmp..Cco..........',
  '...cC.papm...Rmmmu..Cc....o.....',
  '..Rmm.pmmmu.Rmmuuur..C...co.....',
  '.RpmmpmmuuuRmmuurxxr.Rm..Cc.....',
  '.pmmmmuurxxrrurxxxxxRmmr..C.....',
  'ppmmmuurxxxxeeexxxxxxmmur.......',
  'pmmmuuxxxxxeexxxxxxxxmuurR......',
  'rmmuuxxxxxxxxxxxexxxxuuurpm.....',
  'rrmurxxRrrxxxxxexRxxxurppamp....',
  'nnrurxxRRrrrrrrRRxxrRrrpmmmu....',
  '.nnruurRpmmrrRmmurRmmurmuurtn...',
  '..tnrurppmmuurmmurpmmuuuurntn...',
  '.ctntrrpmmuurruuurrmmuurrrtnct..',
  'ct.rrrrrrruurrrrruuuurrrrrrr.tc.',
  't.trrrCrruuurrrrruuurrrCrrrt..t.',
  '.cttrrCoCrrrrrurrrrrrCoCrrttc...',
  '..nrrrnCrrnrrrrrrrnrrCnrrrn.....',
  '....nnrrrtnrrrrrrrntrrrnn.......',
  '......nnnnrrrrrrrrrnnnn.........',
];

// Kraxen Sunken / Spore Maw (16x14 core -> 18x16 outlined, grounded wide root-skirt!)
const KRAXEN_COLONY_ROWS: readonly string[] = [
  '.......o........',
  '..o...oc........',
  '.oc..ocC..o.....',
  '.cC.RxxxRco.....',
  '..CRxxxexC......',
  '..pmmxxxmmu.....',
  '.ppammuummur....',
  '.pmmmuuummur....',
  'rrmmuuRruumrr...',
  'nrmuurrrruumrn..',
  'tnrruurrrruurnt.',
  'c.trrnrrRrrnt.c.',
  '.cttrrrrrrrttc..',
  '..nnrrrnrrrnn...',
];

// Solaris Nexus Spire (20x23 core -> 22x25 outlined)
const SOLARIS_NEXUS_ROWS: readonly string[] = [
  '.........CC.........',
  '........cCCc........',
  '.......cCCCCc.......',
  '.......cCCCCc.......',
  '......ccCCCCcc......',
  '......cCCCCCCc......',
  '......cCCCCCCc......',
  '....y.ccCCCCcc.y....',
  '...yg..cCCCCc..gy...',
  '...yg..vcCCcv..gy...',
  '..ygg.y.vccv.y.ggy..',
  '..ggb.yg.vv.gy.bgg..',
  '.yggb.ygTccTgy.bggy.',
  '.gbb..gTCCCCtg..bbg.',
  '.gbb.ygtCCCCtgy.bbg.',
  '.bbb.ggttCCttgg.bbb.',
  '..bb.ggbttttbgg.bb..',
  '..bbyyggbbbbggyybb..',
  '...ygggggggggggggy..',
  '...ggbbbbbbbbbbbgg..',
  '....gbbbbbbbbbbbg...',
  '.....bbbbbbbbbbb....',
  '.......bbbbbbb......',
];

// Solaris Warp Pylon (12x15 core -> 14x17 outlined)
const SOLARIS_PYLON_ROWS: readonly string[] = [
  '.....CC.....',
  '....cCCc....',
  '...cCCCCc...',
  '...cCCCCc...',
  '..ycCCCCcy..',
  '..ggcCCcgg..',
  '.yggvccvggy.',
  '.ggb.vv.bgg.',
  '.gbbTccTbbg.',
  '..bbtCCtbb..',
  '..yggttggy..',
  '..ggbbbbgg..',
  '...gbbbbg...',
  '....bbbb....',
  '.....bb.....',
];

// Azure Mineral Cluster (10x8 core -> 12x10 outlined)
const MINERAL_CLUSTER_ROWS: readonly string[] = [
  '....wc....',
  '...wcc....',
  '.w.ccb.w..',
  'wcbcbdcwb.',
  'cbdbbdbcb.',
  '.RddbddbR.',
  'rRRddddRRr',
  '.rrrrrrrr.',
];

// Micro Pine Tree (7x9 core -> 9x11 outlined)
const PINE_TREE_ROWS: readonly string[] = [
  '...h...',
  '..hlh..',
  '..lgl..',
  '.hlggh.',
  '.lgggl.',
  'hlgdglh',
  'dggdggd',
  '...t...',
  '..ttt..',
];

// Micro Rocky Crag (9x6 core -> 11x8 outlined)
const ROCK_CRAG_ROWS: readonly string[] = [
  '...HH....',
  '..HSSH...',
  '.HSSSSS..',
  'SSssssSS.',
  'ssssssss.',
  '.ssssss..',
];

export function buildAllBuildings(
  teams?: Partial<Record<FactionId, TeamColorId>>,
): Readonly<Record<BuildingId, BuildingAsset>> {
  const vanPal = buildFactionPalette('vanguard', teams?.vanguard ?? 'default');
  const krxPal = buildFactionPalette('kraxen', teams?.kraxen ?? 'default');
  const solPal = buildFactionPalette('solaris', teams?.solaris ?? 'default');

  const make = (
    id: BuildingId,
    name: string,
    faction: FactionId | 'neutral',
    rows: readonly string[],
    palette: Readonly<Record<string, number>>,
    shadowRx: number,
    shadowRy: number,
  ): BuildingAsset => {
    const raw = compilePattern(rows, palette);
    const surface = addPixelOutline(raw, INK_OUTLINE);
    // Anchor strictly on the actual lowest opaque pixel row (tucked 2px inside the base skirt
    // so contact shadows hug the footprint flush instead of floating underneath!)
    let bottomY = surface.height - 1;
    for (let y = surface.height - 1; y >= 0; y--) {
      let hasOpaque = false;
      for (let x = 0; x < surface.width; x++) {
        if ((surface.pixels[y * surface.width + x] >>> 24) > 0) {
          hasOpaque = true;
          break;
        }
      }
      if (hasOpaque) {
        bottomY = y;
        break;
      }
    }
    return {
      id,
      name,
      faction,
      surface,
      anchorX: Math.floor(surface.width / 2),
      anchorY: Math.max(0, bottomY - 2),
      shadowRx,
      shadowRy,
    };
  };

  return {
    'vanguard-bastion': make(
      'vanguard-bastion',
      'Vanguard Bastion',
      'vanguard',
      VANGUARD_BASTION_ROWS,
      vanPal,
      14.8,
      5.6,
    ),
    'vanguard-turret': make(
      'vanguard-turret',
      'Vanguard Bunker',
      'vanguard',
      VANGUARD_TURRET_ROWS,
      vanPal,
      8.2,
      3.5,
    ),
    'kraxen-spire': make(
      'kraxen-spire',
      'Kraxen Hatchery',
      'kraxen',
      KRAXEN_SPIRE_ROWS,
      krxPal,
      14.5,
      5.6,
    ),
    'kraxen-colony': make(
      'kraxen-colony',
      'Kraxen Spore',
      'kraxen',
      KRAXEN_COLONY_ROWS,
      krxPal,
      7.8,
      3.4,
    ),
    'solaris-nexus': make(
      'solaris-nexus',
      'Solaris Nexus',
      'solaris',
      SOLARIS_NEXUS_ROWS,
      solPal,
      10.5,
      4.5,
    ),
    'solaris-pylon': make(
      'solaris-pylon',
      'Solaris Pylon',
      'solaris',
      SOLARIS_PYLON_ROWS,
      solPal,
      6.2,
      2.8,
    ),
    'mineral-cluster': make(
      'mineral-cluster',
      'Mineral Patch',
      'neutral',
      MINERAL_CLUSTER_ROWS,
      MINERAL_PALETTE,
      5.8,
      2.4,
    ),
    'pine-tree': make('pine-tree', 'Highland Pine', 'neutral', PINE_TREE_ROWS, PROP_PALETTE, 3.8, 1.6),
    'rock-crag': make('rock-crag', 'Boulder Crag', 'neutral', ROCK_CRAG_ROWS, PROP_PALETTE, 5.0, 2.1),
  };
}
