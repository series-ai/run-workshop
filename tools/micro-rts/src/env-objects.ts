/**
 * Comprehensive RTS Environment Objects & Map Props Pack (31 Objects + Multi-State Strips).
 *
 * Categories:
 *  1. Resources (4)          : Blue Minerals (4 depletion stages), Rich Gold Minerals (4 stages),
 *                              Vespene Gas Geyser (3f anim), Geothermal Magma Vent (3f anim).
 *  2. Destructible Chokes (4): Boulder Wall, Steel Barricade, Fallen Temple Pillar, Bone Rib-Gate
 *                              (each exports 3 damage states: intact, cracked, rubble).
 *  3. Neutral Objectives (3) : Horizon Watchtower (3f sweep), Relic Beacon Shrine (3f pulse),
 *                              Field Repair Pad (2f pulse).
 *  4. Biome Flora & Cover(16): Temperate (Pine, Oak, Sight-Blocker Reeds, Mossy Rock, Fallen Log),
 *                              Tundra (Frost Pine, Glacial Ice Spire, Frozen Boulder),
 *                              Volcanic (Charred Tree, Obsidian Spire, Basalt Arch, Scorch Vent),
 *                              Desert (Date Palm, Broken Obelisk, Sunken Arch, Desert Cactus).
 *  5. Battlefield Doodads (4): Wrecked Siege Tank, Crashed Drop-Pod, Supply Crates, Leviathan Fossil.
 */

import { INK_OUTLINE, SHADOW_GROUND, SHADOW_SOFT } from './palette.ts';
import {
  addPixelOutline,
  blitScaled,
  compilePattern,
  createSurface,
  drawEllipse,
  hexToU32,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';
import type { PlanetThemeId } from './env-tileset.ts';

export type EnvObjectCategory =
  | 'resource'
  | 'obstacle'
  | 'objective'
  | 'flora'
  | 'wreckage';

export interface EnvObjectSpec {
  readonly id: string;
  readonly name: string;
  readonly category: EnvObjectCategory;
  readonly biome: PlanetThemeId | 'any';
  readonly stateMode: 'static' | 'depletion' | 'damage' | 'animated';
  readonly stateLabels: readonly string[];
  readonly frames: readonly (readonly string[])[];
  readonly blocksMovement: boolean;
  readonly blocksVision?: boolean;
}

export const ENV_PAL: Readonly<Record<string, RGBA32>> = {
  K: INK_OUTLINE,
  // Foliage (temperate + palm)
  d: hexToU32('#1e3827'),
  g: hexToU32('#2f5737'),
  l: hexToU32('#4b7d45'),
  h: hexToU32('#77ab59'),
  // Bark / wood / earth
  b: hexToU32('#3b2820'),
  B: hexToU32('#5c3e2e'),
  t: hexToU32('#825a41'),
  // Granite / rock
  r: hexToU32('#3d3e47'),
  R: hexToU32('#626570'),
  S: hexToU32('#8f929c'),
  H: hexToU32('#bcc0c9'),
  // Obsidian / dark steel
  q: hexToU32('#24222e'),
  Q: hexToU32('#3e3b4d'),
  m: hexToU32('#65687a'),
  M: hexToU32('#9ca5b8'),
  // Frost / snow / ice
  i: hexToU32('#35617a'),
  I: hexToU32('#5a98b8'),
  f: hexToU32('#9ad5eb'),
  F: hexToU32('#e0f7ff'),
  // Blue minerals & cyan energy
  c: hexToU32('#16629e'),
  C: hexToU32('#2eaef0'),
  a: hexToU32('#8ceeff'),
  w: hexToU32('#f2ffff'),
  // Rich Gold minerals & Solaris sandstone/gold
  o: hexToU32('#7a4b1b'),
  O: hexToU32('#b87828'),
  y: hexToU32('#e8b238'),
  Y: hexToU32('#ffe87a'),
  // Desert sandstone / bone fossils
  n: hexToU32('#69503b'),
  N: hexToU32('#967654'),
  e: hexToU32('#c7a77b'),
  E: hexToU32('#efe0bf'),
  // Gas emerald / healing green
  v: hexToU32('#1c6b4d'),
  V: hexToU32('#34b878'),
  p: hexToU32('#8cf5b2'),
  // Lava / rust / ember / caution orange
  u: hexToU32('#6e231c'),
  U: hexToU32('#b53d1f'),
  z: hexToU32('#ed7824'),
  Z: hexToU32('#ffd359'),
};

function renderPropFrame(pattern: readonly string[], shadowAlpha: 'ground' | 'soft' | 'none' = 'ground'): PixelSurface {
  const raw = compilePattern(pattern, ENV_PAL);
  const outlined = addPixelOutline(raw, INK_OUTLINE);
  const out = createSurface(outlined.width, outlined.height + 2, 0);
  if (shadowAlpha !== 'none') {
    const rx = Math.max(3, Math.floor(raw.width * 0.44));
    const ry = Math.max(2, Math.round(rx * 0.34));
    drawEllipse(
      out,
      Math.floor(out.width / 2),
      out.height - 2,
      rx,
      ry,
      shadowAlpha === 'ground' ? SHADOW_GROUND : SHADOW_SOFT,
    );
  }
  blitScaled(out, outlined, 0, 0, 1);
  return out;
}

export const ENV_OBJECT_SPECS: readonly EnvObjectSpec[] = [
  // =========================================================================
  // 1. RESOURCE NODES (4)
  // =========================================================================
  {
    id: 'mineral-blue',
    name: 'Mineral Cluster',
    category: 'resource',
    biome: 'any',
    stateMode: 'depletion',
    stateLabels: ['full', 'mid', 'low', 'depleted'],
    blocksMovement: true,
    frames: [
      // Full (rich multi-spire cyan crystal formation)
      [
        '......w.......',
        '.....waa...a..',
        '..a..aCC..aC..',
        '.aC..aCC.aCC..',
        '.CCa.CCc.CCc..',
        '.CCc.Ccc.Ccc..',
        'aCCcRCccRCcc..',
        'RccRRccRRccR..',
        'rRRRrrrrRRRr..',
        '.rrrrrrrrrr...',
      ],
      // Mid (~60%)
      [
        '..............',
        '.....a........',
        '....waC...a...',
        '..a.aCC..aC...',
        '.aC.CCc..CC...',
        '.Cc.Ccc.RCc...',
        'RCcRCccRRcR...',
        'RrrRRrrRRrr...',
        'rRRRrrrrRRr...',
        '.rrrrrrrrr....',
      ],
      // Low (~25%)
      [
        '..............',
        '..............',
        '..............',
        '.....a........',
        '....aC........',
        '..a.Cc...a....',
        '.RC.cc..RC....',
        'RRrRrrRRrr....',
        'rRRRRrrrRRr...',
        '.rrrrrrrrr....',
      ],
      // Depleted (rock bed stump)
      [
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '...R....R.....',
        '..RRr..RRr....',
        '.rRRRRrrrRr...',
        '..rrrrrrrr....',
      ],
    ],
  },
  {
    id: 'mineral-gold',
    name: 'Rich Gold Crystals',
    category: 'resource',
    biome: 'any',
    stateMode: 'depletion',
    stateLabels: ['full', 'mid', 'low', 'depleted'],
    blocksMovement: true,
    frames: [
      [
        '......w.......',
        '.....wYY...Y..',
        '..Y..Yyy..Yy..',
        '.Yy..Yyy.Yyy..',
        '.yyY.yyO.yyO..',
        '.yyO.yOO.yOO..',
        'YyyORyOORyOO..',
        'ROORROORROOR..',
        'rRRRrrrrRRRr..',
        '.rrrrrrrrrr...',
      ],
      [
        '..............',
        '.....Y........',
        '....wYy...Y...',
        '..Y.Yyy..Yy...',
        '.Yy.yyO..yy...',
        '.yO.yOO.RyO...',
        'RyORyOORROR...',
        'RrrRRrrRRrr...',
        'rRRRrrrrRRr...',
        '.rrrrrrrrr....',
      ],
      [
        '..............',
        '..............',
        '..............',
        '.....Y........',
        '....Yy........',
        '..Y.yO...Y....',
        '.Ry.OO..Ry....',
        'RRrRrrRRrr....',
        'rRRRRrrrRRr...',
        '.rrrrrrrrr....',
      ],
      [
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '...R....R.....',
        '..RRr..RRr....',
        '.rRRRRrrrRr...',
        '..rrrrrrrr....',
      ],
    ],
  },
  {
    id: 'gas-geyser',
    name: 'Plasma Gas Geyser',
    category: 'resource',
    biome: 'any',
    stateMode: 'animated',
    stateLabels: ['plume_0', 'plume_1', 'plume_2'],
    blocksMovement: true,
    frames: [
      [
        '......pp......',
        '.....pVV......',
        '......VVp.....',
        '.....VVv......',
        '....SvvVS.....',
        '..SSRRvvRSS...',
        '.SRRRvvvvRRS..',
        'rRRRrvvvvrRRr.',
        'rRRRRrrrrRRRr.',
        '.rrrrrrrrrrr..',
      ],
      [
        '.....p........',
        '......pp......',
        '.....pVV......',
        '......VVv.....',
        '....SvvVS.....',
        '..SSRRvvRSS...',
        '.SRRRvvvvRRS..',
        'rRRRrvvvvrRRr.',
        'rRRRRrrrrRRRr.',
        '.rrrrrrrrrrr..',
      ],
      [
        '.......pp.....',
        '......pV......',
        '.....pVV......',
        '.....vVV......',
        '....SvvVS.....',
        '..SSRRvvRSS...',
        '.SRRRvvvvRRS..',
        'rRRRrvvvvrRRr.',
        'rRRRRrrrrRRRr.',
        '.rrrrrrrrrrr..',
      ],
    ],
  },
  {
    id: 'magma-vent',
    name: 'Geothermal Vent',
    category: 'resource',
    biome: 'volcanic',
    stateMode: 'animated',
    stateLabels: ['vent_0', 'vent_1', 'vent_2'],
    blocksMovement: true,
    frames: [
      [
        '......Z.......',
        '.....zZ.......',
        '......zU......',
        '....QQUzQQ....',
        '..QQQqzZzQQQ..',
        '.QqqqzZZZzqqQ.',
        'qqqqqUzzZUqqqq',
        'qQQQQquuuqQQQq',
        '.qqqqqqqqqqqq.',
      ],
      [
        '.....z........',
        '......Z.......',
        '.....zZ.......',
        '....QQUzQQ....',
        '..QQQqzZzQQQ..',
        '.QqqqUZZZUqqQ.',
        'qqqqquzzzuqqqq',
        'qQQQQquuuqQQQq',
        '.qqqqqqqqqqqq.',
      ],
      [
        '.......Z......',
        '......z.......',
        '.....Uz.......',
        '....QQUzQQ....',
        '..QQQqZZzQQQ..',
        '.QqqqzZZZzqqQ.',
        'qqqqqUzzZUqqqq',
        'qQQQQquuuqQQQq',
        '.qqqqqqqqqqqq.',
      ],
    ],
  },

  // =========================================================================
  // 2. DESTRUCTIBLE CHOKE OBSTACLES (4 — each with intact / cracked / rubble)
  // =========================================================================
  {
    id: 'obstacle-rocks',
    name: 'Destructible Rocks',
    category: 'obstacle',
    biome: 'temperate',
    stateMode: 'damage',
    stateLabels: ['intact', 'cracked', 'rubble'],
    blocksMovement: true,
    frames: [
      [
        '......HHSS............',
        '....HHSSSSRR...HHSS...',
        '...HSSSRRRRRS.HSSSRR..',
        '..HSSRRrrRRRSHSSRRRR..',
        '.SSRRRRrrRRRRSSRRRRRr.',
        'SRRRrRRrrRRRRRRRRrRRRr',
        'RRRRrRRRRrrRRRRRRrRRRr',
        'rRRrrrRRrrrRRrrrRRrrr.',
        '.rrrrrrrrrrrrrrrrrrr..',
      ],
      [
        '......H.SS............',
        '....HHqSSSRR...H.SS...',
        '...HSSqRRRRRS.HSqSRR..',
        '..HSSqqrrRRRSHSqRRRR..',
        '.SSRRqqrrRRRRSSqRRRRr.',
        'SRRRrRqrrRRRRRRqrRRRRr',
        'RRRRrRRRRqqRRRRRRrRRRr',
        'rRRrrrRRrrrRRrrrRRrrr.',
        '.rrrrrrrrrrrrrrrrrrr..',
      ],
      [
        '......................',
        '......................',
        '......................',
        '......................',
        '....SS.......SS.......',
        '..SSRRr..S..SRRr..S...',
        '.SRRRr..SRr.RRRr.SRr..',
        'rRRrr..rRRrrRRr.rRRr..',
        '.rrrr...rrrrrr...rrr..',
      ],
    ],
  },
  {
    id: 'obstacle-barricade',
    name: 'Steel Barricade',
    category: 'obstacle',
    biome: 'any',
    stateMode: 'damage',
    stateLabels: ['intact', 'cracked', 'rubble'],
    blocksMovement: true,
    frames: [
      [
        '..M.....M.....M.....M.',
        '..mM...Mm.....mM...Mm.',
        '.MZMZZMZMMZZMMZMZZMZM.',
        '.mQmqmQmqmQmqmQmqmQmq.',
        'MMmmmmmmmmmmmmmmmmmmMM',
        'mQQQQQmmQQQQQmmQQQQQmm',
        'qQQQQQqqQQQQQqqQQQQQqq',
        '.qqqqqqqqqqqqqqqqqqqq.',
      ],
      [
        '..M...........M.......',
        '..mM....q.....mM...m..',
        '.MZqZZqqMMZZMMZqqZMZM.',
        '.mQqqmQmqmQqqmQmqmQmq.',
        'MMmmmqqmmmmqmmmmmmmmMM',
        'mQQQQQmmQQqqQmmQQQQQmm',
        'qQQQQQqqQQQQQqqQQQQQqq',
        '.qqqqqqqqqqqqqqqqqqqq.',
      ],
      [
        '......................',
        '......................',
        '......................',
        '......................',
        '...M........mZ........',
        '.mZMq..qQ..qQmM..Qq...',
        'qQQqq.qQQq.qQQq.qQQq..',
        '.qqq...qq...qq...qq...',
      ],
    ],
  },
  {
    id: 'obstacle-pillar',
    name: 'Collapsed Pillar',
    category: 'obstacle',
    biome: 'desert',
    stateMode: 'damage',
    stateLabels: ['intact', 'cracked', 'rubble'],
    blocksMovement: true,
    frames: [
      [
        '..EEee................',
        '.EeNNNeYYeeEEeeYYee...',
        '.eNNNNNyyNNNNNNyyNNn..',
        'eNNnnNNooNNnnNNooNNnn.',
        'NNnnnnNNNNnnnnNNNNnnn.',
        'NNnNNnNNNNnNNnNNNNnnn.',
        'nNNNNnnNNnNNNNnnNNnnn.',
        '.nnnnnnnnnnnnnnnnnnn..',
      ],
      [
        '..E.ee................',
        '.EeNqqeYYeeE.eeY.ee...',
        '.eNNqNNyyNNqqNNyyNNn..',
        'eNNnqNNooNNnqNNooNNnn.',
        'NNnnqnNNNNnnqnNNNNnnn.',
        'NNnNNnNNNNnNNnNNNNnnn.',
        'nNNNNnnNNnNNNNnnNNnnn.',
        '.nnnnnnnnnnnnnnnnnnn..',
      ],
      [
        '......................',
        '......................',
        '......................',
        '......................',
        '...ee.......Yy........',
        '.eNNn..eN..eNNn..eN...',
        'nNNNnn.nNn.nNNnn.nNn..',
        '.nnnn...nn..nnn...nn..',
      ],
    ],
  },
  {
    id: 'obstacle-ribwall',
    name: 'Calcified Rib-Gate',
    category: 'obstacle',
    biome: 'any',
    stateMode: 'damage',
    stateLabels: ['intact', 'cracked', 'rubble'],
    blocksMovement: true,
    frames: [
      [
        '...E.....E.....E......',
        '..EeE...EeE...EeE...E.',
        '..eNE...eNE...eNE..Ee.',
        '.EeNne.EeNne.EeNne.eN.',
        '.eNnnN.eNnnN.eNnnN.Nn.',
        'bBnnnBbBnnnBbBnnnBbBnb',
        'bBBBBbbBBBBbbBBBBbbBBb',
        '.bbbbbbbbbbbbbbbbbbbb.',
      ],
      [
        '.........E............',
        '..Ee....EeE....eE.....',
        '..eN....eNE...eNE..E..',
        '.EeNne..eNne.EeNne.eN.',
        '.eNnnN.eNnnN.eNnnN.Nn.',
        'bBnnnBbBnnnBbBnnnBbBnb',
        'bBBBBbbBBBBbbBBBBbbBBb',
        '.bbbbbbbbbbbbbbbbbbbb.',
      ],
      [
        '......................',
        '......................',
        '......................',
        '......................',
        '...E.......e..........',
        '.EeNn..eN..eNn..Ee....',
        'bBBBbb.bBb.bBBb.bBb...',
        '.bbbb...bb..bbb..bb...',
      ],
    ],
  },

  // =========================================================================
  // 3. STRATEGIC NEUTRAL CAPTURE POINTS (3 — animated!)
  // =========================================================================
  {
    id: 'neutral-watchtower',
    name: 'Horizon Watchtower',
    category: 'objective',
    biome: 'any',
    stateMode: 'animated',
    stateLabels: ['scan_L', 'scan_C', 'scan_R'],
    blocksMovement: true,
    frames: [
      [
        '....aw........',
        '...aCC........',
        '....mCM.......',
        '....mMMm......',
        '....mQMm......',
        '....mQMm......',
        '...MMQQMM.....',
        '..MMmQQmMM....',
        '.mQQQccQQQm...',
        '.qQQQQQQQQq...',
        '..qqqqqqqq....',
      ],
      [
        '......wa......',
        '......CC......',
        '.....MCMC.....',
        '....mMMm......',
        '....mQMm......',
        '....mQMm......',
        '...MMQQMM.....',
        '..MMmQQmMM....',
        '.mQQQaaQQQm...',
        '.qQQQQQQQQq...',
        '..qqqqqqqq....',
      ],
      [
        '........wa....',
        '........CCa...',
        '.......MCm....',
        '......mMMm....',
        '....mQMm......',
        '....mQMm......',
        '...MMQQMM.....',
        '..MMmQQmMM....',
        '.mQQQccQQQm...',
        '.qQQQQQQQQq...',
        '..qqqqqqqq....',
      ],
    ],
  },
  {
    id: 'neutral-shrine',
    name: 'Relic Relay Shrine',
    category: 'objective',
    biome: 'any',
    stateMode: 'animated',
    stateLabels: ['pulse_0', 'pulse_1', 'pulse_2'],
    blocksMovement: true,
    frames: [
      [
        '.....Y......',
        '....YyY.....',
        '....yOy.....',
        '....oCo.....',
        '...OoaoO....',
        '...OoooO....',
        '..SSoooSS...',
        '.SRROOORRS..',
        'rRRRRRRRRRr.',
        '.rrrrrrrrr..',
      ],
      [
        '.....w......',
        '....YCY.....',
        '....ywy.....',
        '....oao.....',
        '...OoCoO....',
        '...OoooO....',
        '..SSoooSS...',
        '.SRROOORRS..',
        'rRRRRRRRRRr.',
        '.rrrrrrrrr..',
      ],
      [
        '.....Y......',
        '....YwY.....',
        '....yCy.....',
        '....oao.....',
        '...OoaoO....',
        '...OoooO....',
        '..SSoooSS...',
        '.SRROOORRS..',
        'rRRRRRRRRRr.',
        '.rrrrrrrrr..',
      ],
    ],
  },
  {
    id: 'neutral-medpad',
    name: 'Field Repair Pad',
    category: 'objective',
    biome: 'any',
    stateMode: 'animated',
    stateLabels: ['idle', 'pulse'],
    blocksMovement: false,
    frames: [
      [
        '..MMMMMMMM..',
        '.MmQQVVQQmM.',
        'MmQQQVVQQQmM',
        'mQVVVVVVVVQm',
        'mQVVVppVVVQm',
        'MmQQQVVQQQmM',
        '.MmQQVVQQmM.',
        '..qqqqqqqq..',
      ],
      [
        '..MMMMMMMM..',
        '.MmQQppQQmM.',
        'MmQQQppQQQmM',
        'mQppVwwVppQm',
        'mQppVwwVppQm',
        'MmQQQppQQQmM',
        '.MmQQppQQmM.',
        '..qqqqqqqq..',
      ],
    ],
  },

  // =========================================================================
  // 4. BIOME FLORA & TACTICAL COVER (16)
  // =========================================================================
  {
    id: 'tree-pine',
    name: 'Frontier Pine',
    category: 'flora',
    biome: 'temperate',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '.....h.....',
      '....hlh....',
      '...hllgh...',
      '....lgg....',
      '..hhllgg...',
      '.hlllgggd..',
      '...llggd...',
      '.hhllgggd..',
      'hlllggggdd.',
      '.ddddbddd..',
      '....bBb....',
      '....bbb....',
    ]],
  },
  {
    id: 'tree-oak',
    name: 'Meadow Oak',
    category: 'flora',
    biome: 'temperate',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...hhhh.....',
      '..hhllhh....',
      '.hhlllllh...',
      'hllllggllg..',
      'hllggggggd..',
      '.lggggggdd..',
      '..dddgddd...',
      '....bBtb....',
      '....bBb.....',
      '...bbbbb....',
    ]],
  },
  {
    id: 'brush-reeds',
    name: 'Sight-Blocker Reeds',
    category: 'flora',
    biome: 'temperate',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: false,
    blocksVision: true,
    frames: [[
      '..h...h...h..',
      '.hl..hl..hl..',
      '.lg.hlg.hlg..',
      'hlg.lgg.lgg.h',
      'lggdlggdlggdl',
      'ggddggddggddg',
      '.ddddddddddd.',
    ]],
  },
  {
    id: 'rock-mossy',
    name: 'Mossy Boulder',
    category: 'flora',
    biome: 'temperate',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...hhlS.....',
      '..hllSSR....',
      '.glSSSRRR...',
      '.SSSRRRRRr..',
      'SRRRRRrRRRr.',
      'rRRRRrrrrRr.',
      '.rrrrrrrrr..',
    ]],
  },
  {
    id: 'fallen-log',
    name: 'Fallen Timber',
    category: 'flora',
    biome: 'temperate',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '....hl.........',
      '..ttBgtBttBB...',
      '.tBBBtBBBtBBb..',
      '.BBBBbBBBBbBbb.',
      '..bbbbbbbbbbb..',
    ]],
  },
  {
    id: 'tree-frost-pine',
    name: 'Frost Pine',
    category: 'flora',
    biome: 'tundra',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '.....F.....',
      '....FfF....',
      '...FfIIf...',
      '....Iii....',
      '..FFffII...',
      '.FffIIiii..',
      '...fIIii...',
      '.FFffIIii..',
      'FffIIiiiiq.',
      '.qqqqbqqq..',
      '....bBb....',
      '....bbb....',
    ]],
  },
  {
    id: 'ice-spire',
    name: 'Glacial Spire',
    category: 'flora',
    biome: 'tundra',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '.....F......',
      '....Ff......',
      '....fI..F...',
      '..F.fI.Ff...',
      '.Ff.II.fI...',
      '.fI.IiiII...',
      'fII.IiiIii..',
      'IIiIIiiIii..',
      'iiiqiiiiii..',
      '.qqqqqqqq...',
    ]],
  },
  {
    id: 'rock-frozen',
    name: 'Permafrost Crag',
    category: 'flora',
    biome: 'tundra',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...FFfS.....',
      '..FfISSR....',
      '.fISSSRRR...',
      '.SSSRRRRRr..',
      'SRRRRRrRRRr.',
      'rRRRRrrrrRr.',
      '.rrrrrrrrr..',
    ]],
  },
  {
    id: 'tree-charred',
    name: 'Charred Deadwood',
    category: 'flora',
    biome: 'volcanic',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '..Q.....Q...',
      '...Q...Q....',
      '.Q..Q.Q..Q..',
      '..Q..Q..Q...',
      '...qqQqq....',
      '....qQq.....',
      '....qQq.....',
      '....qUq.....',
      '...qqzqq....',
      '..qqqqqqq...',
    ]],
  },
  {
    id: 'obsidian-spire',
    name: 'Obsidian Spire',
    category: 'flora',
    biome: 'volcanic',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '.....m......',
      '....mQ......',
      '....QQ..m...',
      '..m.QQ.mQ...',
      '.mQ.Qq.QQ...',
      '.QQ.QqqQq...',
      'QQqQQqUqq...',
      'QqqQqUzqqq..',
      'qqqqquuqqq..',
      '.qqqqqqqq...',
    ]],
  },
  {
    id: 'basalt-arch',
    name: 'Basalt Rib-Arch',
    category: 'flora',
    biome: 'volcanic',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '....mmmQQ.....',
      '..mmQQQQQQ....',
      '.mQQQq..qQQ...',
      'mQQq......QQq.',
      'QQq.......qQq.',
      'Qqq.......qqq.',
      'qqq.......qqq.',
    ]],
  },
  {
    id: 'ash-crater',
    name: 'Ember Fissure',
    category: 'flora',
    biome: 'volcanic',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: false,
    frames: [[
      '..qqQQQQqq..',
      '.qQQquuQQQq.',
      'qQquzZZzuQQq',
      'qQquUzzUuQQq',
      '.qQQquuQQQq.',
      '..qqqqqqqq..',
    ]],
  },
  {
    id: 'tree-palm',
    name: 'Oasis Palm',
    category: 'flora',
    biome: 'desert',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...hh..hh....',
      '.hhllhhllhh..',
      'hlggllllgghl.',
      '.g..lggl..g..',
      '....gBtg.....',
      '.....Btb.....',
      '.....bBt.....',
      '....bBb......',
      '....Btb......',
      '...bbbbb.....',
    ]],
  },
  {
    id: 'ruin-obelisk',
    name: 'Broken Obelisk',
    category: 'flora',
    biome: 'desert',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...Y........',
      '..Yy........',
      '..yOe.......',
      '..eNNn......',
      '..eNcN......',
      '..NNcNn.....',
      '.eNNNNne....',
      '.NNNNNNn....',
      'nNNNNNNnn...',
      '.nnnnnnn....',
    ]],
  },
  {
    id: 'ruin-arch',
    name: 'Sunken Sun-Arch',
    category: 'flora',
    biome: 'desert',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: false,
    frames: [[
      '...EEYYyyEE...',
      '..EeNNNNNNeE..',
      '.eNNn....nNNe.',
      '.NNn......nNN.',
      '.NNn......nNN.',
      'nNNn......nNNn',
      'nnnn......nnnn',
    ]],
  },
  {
    id: 'desert-cactus',
    name: 'Dune Cactus',
    category: 'flora',
    biome: 'desert',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '....hl......',
      '.hl.lg......',
      '.lg.lg..hl..',
      '.lgglg..lg..',
      '..dglggglg..',
      '....lgggd...',
      '....lgd.....',
      '...dddd.....',
    ]],
  },

  // =========================================================================
  // 5. BATTLEFIELD WRECKAGE & STORYTELLING DOODADS (4)
  // =========================================================================
  {
    id: 'wreck-tank',
    name: 'Wrecked Siege Hull',
    category: 'wreckage',
    biome: 'any',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '...........MMm..',
      '.........MMm....',
      '.....MMMmq..z...',
      '...MMmmQQm.UzZ..',
      '..MmQQQQQmqUuQ..',
      '.MMmQQquQQmmQQm.',
      'qQQQmmqqqmmQQQQq',
      'qQmqQmqQmqQmqQmq',
      '.qqqqqqqqqqqqqq.',
    ]],
  },
  {
    id: 'wreck-droppod',
    name: 'Crashed Drop-Pod',
    category: 'wreckage',
    biome: 'any',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '.....MM.....',
      '....MZZM....',
      '...MmQQmM...',
      '..MmQqqQmM..',
      '.mQmmqqmmQm.',
      'MmQqqQQqqQmM',
      'qQqqmQQmqqQq',
      '.qqq.qq.qqq.',
    ]],
  },
  {
    id: 'prop-crates',
    name: 'Supply Crate Stack',
    category: 'wreckage',
    biome: 'any',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '....MMMM....',
      '...MmZZmM...',
      '...mQQQQm...',
      '.MMMMmmMMMM.',
      'MmZZmMMmZZmM',
      'mQQQmQQmQQQm',
      'qQQQqqqqQQQq',
      '.qqqqqqqqqq.',
    ]],
  },
  {
    id: 'fossil-leviathan',
    name: 'Leviathan Fossil',
    category: 'wreckage',
    biome: 'desert',
    stateMode: 'static',
    stateLabels: ['idle'],
    blocksMovement: true,
    frames: [[
      '....E...E...E.........',
      '...Ee..Ee..Ee...EEE...',
      '..EeN.EeN.EeN..EEeeE..',
      '..eNn.eNn.eNn.EeeqqeE.',
      '.eNnn.eNnn.eNnEeNnnNe.',
      '.nnnnnNNNNnnnnnNNNNnn.',
      '..nnnnnnnnnnnnnnnnnn..',
    ]],
  },
];

export interface BakedEnvObject {
  readonly spec: EnvObjectSpec;
  readonly cellW: number;
  readonly cellH: number;
  readonly strip: PixelSurface; // horizontal strip of all states/frames!
  readonly frameSurfaces: readonly PixelSurface[];
}

export function bakeAllEnvObjects(): readonly BakedEnvObject[] {
  const results: BakedEnvObject[] = [];
  for (const spec of ENV_OBJECT_SPECS) {
    const shadowMode =
      spec.id === 'neutral-medpad' || spec.id === 'ash-crater'
        ? 'none'
        : spec.id === 'brush-reeds'
          ? 'soft'
          : 'ground';
    const frameSurfaces = spec.frames.map((pat) => renderPropFrame(pat, shadowMode));
    const cellW = Math.max(...frameSurfaces.map((s) => s.width));
    const cellH = Math.max(...frameSurfaces.map((s) => s.height));
    const strip = createSurface(cellW * frameSurfaces.length, cellH, 0);
    for (let i = 0; i < frameSurfaces.length; i++) {
      const fs = frameSurfaces[i];
      const ox = i * cellW + Math.floor((cellW - fs.width) / 2);
      const oy = cellH - fs.height;
      blitScaled(strip, fs, ox, oy, 1);
    }
    results.push({ spec, cellW, cellH, strip, frameSurfaces });
  }
  return results;
}
