/**
 * Micro-scale pixel-art RTS faction buildings, defensive structures, mineral patches,
 * and battlefield props proportioned to true 8x8 infantry and the 22x20 3/4 Siege Tank.
 *
 * Architectural & visual discipline:
 *  - Consistent 3/4 top-down camera matching the 22x20 Siege Tank and Wang-16 cliffs:
 *    sunlit upper roof/platform planes in depth + short darker front faces for height.
 *  - Headquarters footprint parity across all 3 factions (~30x24):
 *    Vanguard Bastion (30x24), Kraxen Hatchery (31x23), Solaris Nexus (30x24).
 *  - Secondary/defense structure parity (~16-18px):
 *    Vanguard Bunker (18x13), Kraxen Spore Colony (17x14), Solaris Pylon (16x15).
 *  - Single-pass 1px #130f1e exterior outline with lighter material shades immediately
 *    inside lower/side edges (never near-black k doubling).
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

// 1. Vanguard Command Bastion (30x24 core -> 32x26 outlined)
// 3/4 top-down HQ: 18x9 sunlit chamfered command roof with recessed steel landing deck & cobalt trim,
// blue radar tower rear-left, twin exhaust stacks pulled inward rear-right, 7x3 recessed bay door.
const VANGUARD_BASTION_ROWS: readonly string[] = [
  '....w.........................',
  '...wsw........................',
  '....d.........................',
  '..wwwww...............ss.ss...',
  '.wmmmmmd.............sdd.sdd..',
  '.sbbbbbBd............sBBdsBBd.',
  '.sBvccBBD............sDDdsDDd.',
  '.sBBBBBdwwwwwwwwwwwwwwddddd...',
  '.sDDDDDwmmmmmmmmmmmmmmmwdddds.',
  'bBBsddwmmsddddddddddsmmwddddds',
  'bBBsddwmmdBBsssssssssmmwddddds',
  'bBDsddwmmdsssmmwwssssmmwddddds',
  'dDDsddwmmdsssmmmmssssmmwddddds',
  'dDDsddwmmdssssssBBBBsmmwddddds',
  'dDDsdddsmmmmmmmmmmmmmmsdddddds',
  'dDDsddddssssssssssssssddBBBBds',
  'dDDssddddddddddddddddddsdDDDds',
  'dDDssmmssddssssssssddssdsDDDds',
  '.dDssmmssddskkkkkkkdsddsdDDds.',
  '.dDssddssddskkkkkkkdsddsdDDds.',
  '.dDssddssddskkkkkkkdsfddsDDds.',
  '..dsddddsddssssssssddssdsddds.',
  '..ddddddsddddddddddddssddddds.',
  '...dddddddddddddddddddddddds..',
];

// 2. Vanguard Armored Bunker (18x13 core -> 20x15 outlined)
// 3/4 top-down octagonal pillbox: 16x7 chamfered roof with upper-left bright bevel,
// 3x2 blue hatch on rear-right corner, 4-row front wall with crisp 7x1 firing port.
const VANGUARD_TURRET_ROWS: readonly string[] = [
  '...........bbb....',
  '...wwwwwwwwBBBd...',
  '..wmmmmmmmmmmmsd..',
  '.wmmssssssssmmmsd.',
  '.wmmssmmmmssmmmsd.',
  '.wmmssmmmmssmmmsd.',
  '.smmssssssssmmmsd.',
  '..smmmmmmmmmmmssd.',
  '.bBBddddddddddBBds',
  '.bBDsskkvkkkkssBds',
  '.dDDssdddddddssDds',
  '..dDssmmsssddssds.',
  '...dddddddddddds..',
];

// 3. Kraxen Brood Hatchery (31x23 core -> 33x25 outlined)
// 3/4 top-down organic nest: 3 curved bone horns at varied heights, 2px raised bright-pink rear rim,
// 10x5 oval spawning cavity with asymmetric organic egg clutch, 2px-thick rooted tendrils & warm skirt edge.
const KRAXEN_SPIRE_ROWS: readonly string[] = [
  '............o..................',
  '...........oc.........o........',
  '......o....ocC.......co........',
  '.....oc...ppC.......cCo........',
  '.....ocC.ppmmpp....ppC.........',
  '....ppC.ppmmmmpppppmmpp........',
  '...ppmmpppmmppmpppmmmmpp.......',
  '..ppmmmmpppmmmmmmmmpmmmpp......',
  '..pmmmuurrrxxxxxxrrruummmp.....',
  '.ppmmurrrxxexxxxxxxrrruummp....',
  '.pmmmurxxaeexxxrxxxxxruummp....',
  '.pmmuurxxxexxxrrxxexxruummp....',
  '.rmmuurrrxxxxrRxxxxrrruummmr...',
  '.rrmmpmmrrrxxxxxxrrrppmmummr...',
  '.trrmppmmuurrrrrruummppmmrrt...',
  '.ttrrmmmmuurrrrrruummmmrrtt....',
  '..ttrrRmmuurrRRrruummRrrttt....',
  '.tttrrRRrrrrRRRRrrrrRRrrtttt...',
  '.tnttrrRrrtRRrrRRtrrRrrttntt...',
  '..nttrrrttttRrrRttttrrrttnn....',
  '...nnttrrRtRrrrrRtRrrttnn......',
  '.....nnttRRRRRRRRRRttnn........',
  '.......tttttttttttttt..........',
];

// 4. Kraxen Spore Colony (17x14 core -> 19x16 outlined)
// Distinct upward-facing 7x4 spore cannon opening with 3x2 dark wet center, brightest pink cluster
// on rear rim for 1x readability on creep, 2 asymmetric angled bone barbs, 15px grounded fleshy lobes.
const KRAXEN_COLONY_ROWS: readonly string[] = [
  '......ppppp......',
  '....pppaapppp....',
  '...ppmmRRRmmpp.o.',
  '..opmRxxxRmmppco.',
  '.ocpmRxxxRmmmpCc.',
  '..CpmmmRRRmmppC..',
  '...pppmmmmmmmpp..',
  '..ppmmmuuuummmpp.',
  '..pmmuuRRRRuummp.',
  '.RmmuurRRRRruummR',
  '.tRruurRrrRruurRt',
  '.ttRrrrRRRRrrrRtt',
  '..ttRRttRRttRRtt.',
  '...tttttttttttt..',
];

// 5. Solaris Nexus Monument (30x24 core -> 32x26 outlined)
// Full HQ footprint parity: faceted cyan crown seated toward rear of a 28x10 octagonal gold ziggurat
// with continuous royal-blue geometric step-ring, sweeping outer arms (2px air gap), 3px amber front face.
const SOLARIS_NEXUS_ROWS: readonly string[] = [
  '..............CC..............',
  '.............cCCc.............',
  '............cCCCCc............',
  '............cCCCCc............',
  '...........ccCCCCcc...........',
  '.....yy....cCCCCCCc....yy.....',
  '....yggy...cCCCCCCc...yggy....',
  '...yggby...ccCCCCcc...ybggy...',
  '...yggb.....cCCCCc.....bggy...',
  '..ygggb.....vcCCcv.....bgggy..',
  '..yggb...yy..vccv..yy...bggy..',
  '.yggb..yyggyyvccvyyggyy..bggy.',
  '.yggyyyggTTTTCCCCtTTTggyyyggy.',
  '.yggggggTttggCCCCggttTggggggy.',
  '.ygggggTttgggCCCCgggttTgggggy.',
  '.yggbgggTTgggTccTgggTTgggbggy.',
  '.ygbbgggyygggTTTTgggyygggbbgy.',
  '..gbbggyyyyyyyyyyyyyyyyggbbg..',
  '..ggbbggggggggggggggggggbbgg..',
  '...ggbbggbbggggggggbbggbbgg...',
  '...ggbbbbggggggggggggbbbbgg...',
  '...ggggbbggggbbbbggggbbgggg...',
  '....gggggggggggggggggggggg....',
  '.....gggggggggggggggggggg.....',
];

// 6. Solaris Warp Pylon (16x15 core -> 18x17 outlined)
// Distinct from Nexus: single 6x8 faceted cyan crystal locked into a grounded 14x6 golden socket
// with pale-gold upper-left bevel, warm amber front face, and flat 8px contact edge.
const SOLARIS_PYLON_ROWS: readonly string[] = [
  '.......CC.......',
  '......cCCc......',
  '.....cCCCCc.....',
  '.....cCCCCc.....',
  '.....cCCCCc.....',
  '.....vcCCcv.....',
  '......vccv......',
  '......vvvv......',
  '...yyyyccyyyy...',
  '..yygggCCggggy..',
  '.yyggTTCCtTgggy.',
  '.ygggTttttTgggb.',
  '..gggbggggbggg..',
  '...ggbggggbgg...',
  '....gggggggg....',
];

// 7. Azure Mineral Patch (10x8 core -> 12x10 outlined)
// Low-profile cluster: 3 clearly separated tips (6, 4, 3px), tallest off-center with 1px white glint,
// 1px clean air gap between tips, and an exposed blue crystal facet breaking the rocky base.
const MINERAL_CLUSTER_ROWS: readonly string[] = [
  '....w.....',
  '....cc....',
  '.c..cbc.c.',
  '.cb.cbdcc.',
  '.cbdbbdbb.',
  '.cbdbbdbb.',
  'rRRdbddRRr',
  '.rrrbdrrr.',
];

// 8. Highland Pine Tree (7x9 core -> 9x11 outlined)
// Pointed crown with consolidated 2px light-green upper-left branch, dark lower-right shadow branch,
// and a sunlit-edge 2x2 brown trunk that reads cleanly on grass and dirt.
const PINE_TREE_ROWS: readonly string[] = [
  '...h...',
  '..hlh..',
  '..lgg..',
  '.hhggd.',
  '.llggd.',
  '.lggddd',
  '..gddd.',
  '..Ht...',
  '..tt...',
];

// 9. Directional Boulder Crag (9x6 core -> 11x8 outlined)
// 5x3 light upper-left facet stepping down 1px right, 2-row mid-gray front face, 6px contact edge.
const ROCK_CRAG_ROWS: readonly string[] = [
  '..HHH....',
  '.HHHSS...',
  '.HHSSSS..',
  '.SssssSS.',
  '.sssssss.',
  '..ssssss.',
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
    anchorOffsetX = 0,
  ): BuildingAsset => {
    const raw = compilePattern(rows, palette);
    const surface = addPixelOutline(raw, INK_OUTLINE);
    // Anchor strictly on the actual lowest opaque pixel row (tucked 2px inside the base skirt
    // so contact shadows hug the seated footprint with only 1-2px peeking below at 1x!)
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
      anchorX: Math.floor(surface.width / 2) + anchorOffsetX,
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
      13.6,
      4.0,
    ),
    'vanguard-turret': make(
      'vanguard-turret',
      'Vanguard Bunker',
      'vanguard',
      VANGUARD_TURRET_ROWS,
      vanPal,
      8.0,
      3.0,
    ),
    'kraxen-spire': make(
      'kraxen-spire',
      'Kraxen Hatchery',
      'kraxen',
      KRAXEN_SPIRE_ROWS,
      krxPal,
      13.8,
      4.2,
    ),
    'kraxen-colony': make(
      'kraxen-colony',
      'Kraxen Spore',
      'kraxen',
      KRAXEN_COLONY_ROWS,
      krxPal,
      7.8,
      3.0,
    ),
    'solaris-nexus': make(
      'solaris-nexus',
      'Solaris Nexus',
      'solaris',
      SOLARIS_NEXUS_ROWS,
      solPal,
      13.0,
      3.9,
    ),
    'solaris-pylon': make(
      'solaris-pylon',
      'Solaris Pylon',
      'solaris',
      SOLARIS_PYLON_ROWS,
      solPal,
      6.8,
      2.6,
    ),
    'mineral-cluster': make(
      'mineral-cluster',
      'Mineral Patch',
      'neutral',
      MINERAL_CLUSTER_ROWS,
      MINERAL_PALETTE,
      5.2,
      2.0,
    ),
    'pine-tree': make('pine-tree', 'Highland Pine', 'neutral', PINE_TREE_ROWS, PROP_PALETTE, 3.4, 1.4, -1),
    'rock-crag': make('rock-crag', 'Boulder Crag', 'neutral', ROCK_CRAG_ROWS, PROP_PALETTE, 4.6, 1.8),
  };
}
