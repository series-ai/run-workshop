/**
 * Complete Micro-RTS Attack & Combat VFX System (12 Archetypes + 84-Unit Attack Mapping).
 *
 * Covers:
 *  1. melee          — Directional claw/psi/seismic slash arcs + hit-stop spark
 *  2. beam_ramp      — Discrete integer-pixel Bresenham beam escalating through 3 visible DPS tiers (1x -> 2x -> 3.5x)
 *  3. hitscan_burst  — Staccato 3-round burst: muzzle flash -> brief 1-2f tracer -> delayed hit spark on target
 *  4. explosive_aoe  — Ballistic shell/rocket -> fireball + expanding pixel AOE splash ring + smoke + scorch
 *  5. ballistic_arc  — High parabolic lob with ground-projected shadow + target telegraph ring + splash/puddle
 *  6. homing_missile — Curved-steering salvo rockets leaving discrete smoke-puff trails
 *  7. rail_pierce    — Instant penetrative railgun slug punching through multiple targets + shock rings
 *  8. cone_flame     — 45-deg expanding wedge of discrete animated flame clouds + burn DOT
 *  9. projectile_dot — Dodgable acid/spine projectile -> splatter + lingering corrosive puddle DOT
 * 10. chain_arc      — Procedural jagged integer-pixel lightning jumping across 3 targets
 * 11. swarm_launch   — Autonomous 4x4 micro-interceptors/broodlings orbiting & dive-strafing
 * 12. support_utility— Heal/repair tether, Aegis shield-absorb ripple, EMP/spore nova, worker harvest sparks
 */

import { INK_OUTLINE } from './palette.ts';
import {
  addPixelOutline,
  blendPixel,
  blitScaled,
  compilePattern,
  createSurface,
  hexToU32,
  packRGBA,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';

export type AttackArchetype =
  | 'melee'
  | 'beam_ramp'
  | 'hitscan_burst'
  | 'explosive_aoe'
  | 'ballistic_arc'
  | 'homing_missile'
  | 'rail_pierce'
  | 'cone_flame'
  | 'projectile_dot'
  | 'chain_arc'
  | 'swarm_launch'
  | 'support_utility';

export interface UnitAttackProfile {
  readonly id: string;
  readonly archetype: AttackArchetype;
  readonly colorTheme: 'kinetic' | 'plasma' | 'acid' | 'flame' | 'emp' | 'heal' | 'earth';
  readonly burstCount?: number;
  readonly aoeRadiusPx?: number;
  readonly rampTiers?: readonly [number, number, number]; // DPS multiplier at T1, T2, T3
  readonly chainBounces?: number;
  readonly leavesHazard?: 'scorch' | 'acid_pool' | 'burn';
}

export const VFX_PAL: Readonly<Record<string, RGBA32>> = {
  K: INK_OUTLINE,
  w: hexToU32('#ffffff'),
  // Warm kinetic / fire / explosion
  Y: hexToU32('#fff5b8'),
  y: hexToU32('#ffd042'),
  o: hexToU32('#ff7e24'),
  r: hexToU32('#cc2f1f'),
  R: hexToU32('#73181a'),
  // Smoke / scorch / steel
  s: hexToU32('#b8c4d4'),
  S: hexToU32('#7b8699'),
  d: hexToU32('#474d5e'),
  q: hexToU32('#272936'),
  // Plasma / cyan / shield / EMP
  C: hexToU32('#e3ffff'),
  c: hexToU32('#5eeeff'),
  b: hexToU32('#1fa4e6'),
  B: hexToU32('#134f94'),
  // Acid / venom / bio / heal
  G: hexToU32('#f0ffb8'),
  g: hexToU32('#9dff3b'),
  l: hexToU32('#43a839'),
  L: hexToU32('#21592b'),
  // Heal mint
  M: hexToU32('#b8ffdc'),
  m: hexToU32('#3be096'),
  // Bone / slash / earth
  e: hexToU32('#f5ebd0'),
  E: hexToU32('#c7a778'),
  n: hexToU32('#7d5a3c'),
  // Translucent glow halo pixels
  h: packRGBA(94, 238, 255, 130),
  f: packRGBA(255, 150, 40, 140),
  a: packRGBA(157, 255, 59, 130),
};

export interface VfxSpriteSpec {
  readonly id: string;
  readonly name: string;
  readonly category: 'projectile' | 'slash' | 'explosion' | 'status';
  readonly outline: boolean;
  readonly frames: readonly (readonly string[])[];
}

export const VFX_SPRITE_SPECS: readonly VfxSpriteSpec[] = [
  // === PROJECTILES ===
  {
    id: 'proj-shell',
    name: 'Tank Shell / Slug',
    category: 'projectile',
    outline: true,
    frames: [
      ['.oY.', 'oYwY', '.oY.'],
      ['.yY.', 'yYwY', '.yY.'],
    ],
  },
  {
    id: 'proj-missile',
    name: 'Homing Missile',
    category: 'projectile',
    outline: true,
    frames: [
      ['oYsw'],
      ['yosY'],
    ],
  },
  {
    id: 'proj-mortar',
    name: 'Artillery Bomb',
    category: 'projectile',
    outline: true,
    frames: [
      ['.sd.', 'sddq', 'ddqo', '.qq.'],
      ['.sd.', 'sddy', 'ddqY', '.qq.'],
    ],
  },
  {
    id: 'proj-acid',
    name: 'Corrosive Acid Glob',
    category: 'projectile',
    outline: true,
    frames: [
      ['.lgg.', 'lgGgG', '.lgl.'],
      ['.lgG.', 'lggGg', '.llg.'],
    ],
  },
  {
    id: 'proj-quill',
    name: 'Bone Spine Dart',
    category: 'projectile',
    outline: true,
    frames: [
      ['.Eeee', 'nEeeG', '.Eeee'],
    ],
  },
  {
    id: 'proj-plasma',
    name: 'Solaris Plasma Orb',
    category: 'projectile',
    outline: true,
    frames: [
      ['.bc.', 'cCwC', '.bc.'],
      ['.cC.', 'CwwC', '.cC.'],
    ],
  },
  {
    id: 'proj-interceptor',
    name: 'Micro-Interceptor (4x4)',
    category: 'projectile',
    outline: true,
    frames: [
      ['.yy.', 'cCyY', '.yy.'],
      ['.yy.', 'CwyY', '.yy.'],
    ],
  },

  // === MELEE SLASH ARCS (Bold sweeping 11x11 tapered smears + seismic ground slam!) ===
  {
    id: 'slash-claw',
    name: 'Bone Claw Cleave',
    category: 'slash',
    outline: false,
    frames: [
      // Frame 0: Upper-arc snap entry (white-hot tip + bone sweep)
      [
        '..eeew.....',
        '....eeeww..',
        '......eeew.',
        '.......Eee.',
        '........Ee.',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
      ],
      // Frame 1: Full wide sweeping claw rend (twin raking lines + hot leading edge!)
      [
        '...nE......',
        '.....nEe...',
        '......nEee.',
        '....eE..eew',
        '.....eeE.ew',
        '......eewww',
        '.....Eeeww.',
        '....Eeeew..',
        '...nEee....',
        '..nEe......',
        '...........',
      ],
      // Frame 2: Lower follow-through dissipation + flying tip sparks
      [
        '...........',
        '...........',
        '.......n...',
        '........n..',
        '.......nE..',
        '......nEe..',
        '.....nEe..w',
        '...nnEe....',
        '..nEEe...e.',
        '.nEn.......',
        '...........',
      ],
      // Frame 3: Faint trailing claw wisps
      [
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '......n....',
        '....n......',
        '..n....n...',
        '...........',
        '...........',
      ],
    ],
  },
  {
    id: 'slash-psi',
    name: 'Psi-Blade Arc',
    category: 'slash',
    outline: false,
    frames: [
      // Frame 0: Razor cyan-white ignition arc
      [
        '..cCCw.....',
        '....cCCww..',
        '......CCww.',
        '.......cCC.',
        '........bC.',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
      ],
      // Frame 1: Full dramatic 120-deg electric crescent smear!
      [
        '...hb......',
        '.....bcC...',
        '......bcCC.',
        '.......cCCw',
        '.......CCww',
        '......CCCww',
        '.....cCCww.',
        '....cCCCw..',
        '...bcCC....',
        '..hbc......',
        '...........',
      ],
      // Frame 2: Thin glowing after-image sweeping through bottom
      [
        '...........',
        '...........',
        '.......h...',
        '........h..',
        '.......hb..',
        '......hbc..',
        '.....hcC..C',
        '...hbcC....',
        '..hbc....h.',
        '.hh........',
        '...........',
      ],
      // Frame 3: Fading plasma dust
      [
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '......h....',
        '....h......',
        '..h....h...',
        '...........',
        '...........',
      ],
    ],
  },
  {
    id: 'slash-slam',
    name: 'Seismic Ground Slam',
    category: 'slash',
    outline: false,
    frames: [
      // Frame 0: Crisp compressed shock impact core
      [
        '..............',
        '.....eYYe.....',
        '...eeYwwYee...',
        '.....eYYe.....',
        '..............',
        '..............',
        '..............',
      ],
      // Frame 1: Expanding broken dust-and-pebble shockwave ellipse
      [
        '....eE..Ee....',
        '..eE..nn..Ee..',
        '.E.n......n.E.',
        'E............E',
        '.E.n......n.E.',
        '..eE..nn..Ee..',
        '....eE..Ee....',
      ],
      // Frame 2: Wide dissipating dirt flecks
      [
        '...n......n...',
        '.E..........E.',
        'n............n',
        '..............',
        'n............n',
        '.E..........E.',
        '...n......n...',
      ],
    ],
  },

  // === EXPLOSIONS & IMPACTS (Crisp, tight micro-RTS hits — never bloated!) ===
  {
    id: 'fx-hitscan-spark',
    name: 'Hitscan Impact Spark',
    category: 'explosion',
    outline: false,
    frames: [
      ['.Y.', 'YwY', '.Y.'],
      ['y.y', '.o.', 'y.y'],
      ['...', 'f.f', '...'],
    ],
  },
  {
    id: 'fx-explosion-sm',
    name: 'Small Explosion',
    category: 'explosion',
    outline: false,
    frames: [
      ['...Y...', '..YwY..', '...Y...'],
      ['..oy...', '.oyYo..', '..ro...'],
      ['.d.o...', 'dSqod..', '..dd...'],
      ['..d....', '.d..d..', '.......'],
    ],
  },
  {
    id: 'fx-explosion-lg',
    name: 'AOE Artillery Blast',
    category: 'explosion',
    outline: false,
    frames: [
      ['....Y....', '..YYwYY..', '.YwwwwwY.', '..YYwYY..', '....Y....'],
      ['...oyo...', '.foYwwYo.', 'foYwwwYof', '.foYwwYo.', '...rfr...'],
      ['..f.o.f..', '.roYyyor.', 'rooyyyoor', '.drooord.', '..d.d.d..'],
      ['..d...d..', '.dSqrrSd.', 'dSqqrqqSd', '.dSSqSSd.', '..d...d..'],
      ['...d.d...', '.d.....d.', '....d....', '.d.....d.', '...d.d...'],
    ],
  },
  {
    id: 'fx-acid-splash',
    name: 'Acid Splash & Puddle',
    category: 'explosion',
    outline: false,
    frames: [
      ['....G....', '...GwG...', '..GgggG..', '...GgG...', '....G....'],
      ['..g.G.g..', '.glgGgll.', 'glgGggglg', '.llggglg.', '..l.g.l..'],
      ['.g.....g.', '..llgll..', '.lggGggl.', '..llgll..', '.l.....l.'],
      ['.........', '..LlllL..', '.LllgllL.', '..LlllL..', '.........'],
    ],
  },
  {
    id: 'fx-psi-burst',
    name: 'Plasma / Psi Burst',
    category: 'explosion',
    outline: false,
    frames: [
      ['....C....', '...CwC...', '..CwwwC..', '...CwC...', '....C....'],
      ['..h.C.h..', '.bcCwCcb.', 'hcCwwwCch', '.bcCwCcb.', '..h.C.h..'],
      ['.h..c..h.', '.b.cCc.b.', 'c.cCwCc.c', '.b.cCc.b.', '.h..c..h.'],
      ['h.......h', '..h...h..', '....h....', '..h...h..', 'h.......h'],
    ],
  },

  // === STATUS & UTILITY VFX ===
  {
    id: 'fx-shield-ripple',
    name: 'Shield Absorb Ripple',
    category: 'status',
    outline: false,
    frames: [
      ['...CC...', '..CwwC..', '.CwCCwC.', '..CwwC..', '...CC...'],
      ['..hCCh..', '.hC..Ch.', 'hC....Ch', '.hC..Ch.', '..hCCh..'],
      ['.h....h.', 'h......h', 'h......h', 'h......h', '.h....h.'],
    ],
  },
  {
    id: 'fx-emp-nova',
    name: 'EMP / Null Shockwave',
    category: 'status',
    outline: false,
    frames: [
      ['......C......', '....CCwCC....', '...CwwwwwC...', '....CCwCC....', '......C......'],
      ['...hCCCCC....', '..hC.....Ch..', '.hC..CwC..Ch.', '..hC.....Ch..', '...hCCCCC....'],
      ['.hC.......Ch.', 'h...........h', 'C...........C', 'h...........h', '.hC.......Ch.'],
    ],
  },
  {
    id: 'fx-heal-plus',
    name: 'Heal / Repair Cross',
    category: 'status',
    outline: false,
    frames: [
      ['..M..', '..M..', 'MMwMM', '..M..', '..M..'],
      ['..m..', '.mMm.', 'mmMww', '.mMm.', '..m..'],
      ['..m..', '..m..', 'mmmmm', '..m..', '..m..'],
    ],
  },
  {
    id: 'fx-smoke-puff',
    name: 'Missile Contrail Specks',
    category: 'status',
    outline: false,
    frames: [
      ['.s.', 'sSs', '.s.'],
      ['.S.', 'SdS', '...'],
      ['...', '.d.', '...'],
      ['...', '.q.', '...'],
    ],
  },
];

/**
 * Complete 84-Unit Attack Mapping (V01..V24, K01..K24, S01..S24, N01..N12).
 * Gives every unit in the roster an engine-ready attack archetype + combat parameters!
 */
export const UNIT_ATTACK_CATALOG: readonly UnitAttackProfile[] = [
  // VANGUARD (24)
  { id: 'V01', archetype: 'melee', colorTheme: 'kinetic' },
  { id: 'V02', archetype: 'support_utility', colorTheme: 'plasma' },
  { id: 'V03', archetype: 'support_utility', colorTheme: 'heal' },
  { id: 'V04', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 3 },
  { id: 'V05', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 2 },
  { id: 'V06', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 4 },
  { id: 'V07', archetype: 'explosive_aoe', colorTheme: 'kinetic', aoeRadiusPx: 9, leavesHazard: 'scorch' },
  { id: 'V08', archetype: 'rail_pierce', colorTheme: 'plasma' },
  { id: 'V09', archetype: 'cone_flame', colorTheme: 'flame', leavesHazard: 'burn' },
  { id: 'V10', archetype: 'support_utility', colorTheme: 'heal' },
  { id: 'V11', archetype: 'support_utility', colorTheme: 'plasma' },
  { id: 'V12', archetype: 'ballistic_arc', colorTheme: 'kinetic', aoeRadiusPx: 12, leavesHazard: 'scorch' },
  { id: 'V13', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 4, aoeRadiusPx: 6 },
  { id: 'V14', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 3 },
  { id: 'V15', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 2 },
  { id: 'V16', archetype: 'explosive_aoe', colorTheme: 'kinetic', aoeRadiusPx: 14, leavesHazard: 'scorch' },
  { id: 'V17', archetype: 'homing_missile', colorTheme: 'kinetic', burstCount: 2, aoeRadiusPx: 7 },
  { id: 'V18', archetype: 'rail_pierce', colorTheme: 'plasma' },
  { id: 'V19', archetype: 'homing_missile', colorTheme: 'kinetic', burstCount: 2 },
  { id: 'V20', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 4 },
  { id: 'V21', archetype: 'ballistic_arc', colorTheme: 'kinetic', aoeRadiusPx: 14, leavesHazard: 'scorch' },
  { id: 'V22', archetype: 'homing_missile', colorTheme: 'kinetic', burstCount: 4, aoeRadiusPx: 8 },
  { id: 'V23', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 2 },
  { id: 'V24', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 2.2, 4.0], aoeRadiusPx: 10 },

  // KRAXEN (24)
  { id: 'K01', archetype: 'melee', colorTheme: 'acid' },
  { id: 'K02', archetype: 'melee', colorTheme: 'earth' },
  { id: 'K03', archetype: 'support_utility', colorTheme: 'acid' },
  { id: 'K04', archetype: 'melee', colorTheme: 'earth' },
  { id: 'K05', archetype: 'melee', colorTheme: 'earth' },
  { id: 'K06', archetype: 'explosive_aoe', colorTheme: 'acid', aoeRadiusPx: 13, leavesHazard: 'acid_pool' },
  { id: 'K07', archetype: 'projectile_dot', colorTheme: 'acid', leavesHazard: 'acid_pool' },
  { id: 'K08', archetype: 'projectile_dot', colorTheme: 'earth', burstCount: 3 },
  { id: 'K09', archetype: 'projectile_dot', colorTheme: 'acid', leavesHazard: 'acid_pool' },
  { id: 'K10', archetype: 'support_utility', colorTheme: 'acid', aoeRadiusPx: 14 },
  { id: 'K11', archetype: 'beam_ramp', colorTheme: 'acid', rampTiers: [1, 1.8, 2.8] },
  { id: 'K12', archetype: 'rail_pierce', colorTheme: 'earth' },
  { id: 'K13', archetype: 'melee', colorTheme: 'earth', aoeRadiusPx: 8 },
  { id: 'K14', archetype: 'projectile_dot', colorTheme: 'acid', leavesHazard: 'acid_pool' },
  { id: 'K15', archetype: 'melee', colorTheme: 'earth' },
  { id: 'K16', archetype: 'melee', colorTheme: 'earth', aoeRadiusPx: 12 },
  { id: 'K17', archetype: 'ballistic_arc', colorTheme: 'acid', aoeRadiusPx: 14, leavesHazard: 'acid_pool' },
  { id: 'K18', archetype: 'melee', colorTheme: 'acid', aoeRadiusPx: 10 },
  { id: 'K19', archetype: 'projectile_dot', colorTheme: 'acid' },
  { id: 'K20', archetype: 'projectile_dot', colorTheme: 'acid', burstCount: 2 },
  { id: 'K21', archetype: 'homing_missile', colorTheme: 'acid', burstCount: 2 },
  { id: 'K22', archetype: 'swarm_launch', colorTheme: 'acid', burstCount: 4 },
  { id: 'K23', archetype: 'swarm_launch', colorTheme: 'acid', burstCount: 6 },
  { id: 'K24', archetype: 'beam_ramp', colorTheme: 'acid', rampTiers: [1, 2.0, 3.5], leavesHazard: 'acid_pool' },

  // SOLARIS (24)
  { id: 'S01', archetype: 'support_utility', colorTheme: 'plasma' },
  { id: 'S02', archetype: 'support_utility', colorTheme: 'plasma' },
  { id: 'S03', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 1.5, 2.2] },
  { id: 'S04', archetype: 'melee', colorTheme: 'plasma' },
  { id: 'S05', archetype: 'melee', colorTheme: 'plasma' },
  { id: 'S06', archetype: 'melee', colorTheme: 'plasma' },
  { id: 'S07', archetype: 'chain_arc', colorTheme: 'plasma', chainBounces: 3 },
  { id: 'S08', archetype: 'rail_pierce', colorTheme: 'plasma' },
  { id: 'S09', archetype: 'chain_arc', colorTheme: 'plasma', chainBounces: 2 },
  { id: 'S10', archetype: 'support_utility', colorTheme: 'emp', aoeRadiusPx: 14 },
  { id: 'S11', archetype: 'melee', colorTheme: 'plasma' },
  { id: 'S12', archetype: 'support_utility', colorTheme: 'emp', aoeRadiusPx: 16 },
  { id: 'S13', archetype: 'hitscan_burst', colorTheme: 'plasma', burstCount: 2 },
  { id: 'S14', archetype: 'hitscan_burst', colorTheme: 'plasma', burstCount: 3 },
  { id: 'S15', archetype: 'projectile_dot', colorTheme: 'plasma' },
  { id: 'S16', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 2.0, 3.5], aoeRadiusPx: 9 },
  { id: 'S17', archetype: 'explosive_aoe', colorTheme: 'plasma', aoeRadiusPx: 10 },
  { id: 'S18', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 2.2, 3.8], aoeRadiusPx: 11 },
  { id: 'S19', archetype: 'hitscan_burst', colorTheme: 'plasma', burstCount: 2 },
  { id: 'S20', archetype: 'rail_pierce', colorTheme: 'plasma' },
  { id: 'S21', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 1.8, 3.2] },
  { id: 'S22', archetype: 'swarm_launch', colorTheme: 'plasma', burstCount: 6 },
  { id: 'S23', archetype: 'chain_arc', colorTheme: 'plasma', chainBounces: 4 },
  { id: 'S24', archetype: 'beam_ramp', colorTheme: 'plasma', rampTiers: [1, 2.5, 4.5], aoeRadiusPx: 14 },

  // NEUTRALS (12)
  { id: 'N01', archetype: 'melee', colorTheme: 'earth' },
  { id: 'N02', archetype: 'melee', colorTheme: 'earth' },
  { id: 'N03', archetype: 'melee', colorTheme: 'earth' },
  { id: 'N04', archetype: 'cone_flame', colorTheme: 'flame' },
  { id: 'N05', archetype: 'melee', colorTheme: 'earth' },
  { id: 'N06', archetype: 'support_utility', colorTheme: 'emp' },
  { id: 'N07', archetype: 'melee', colorTheme: 'earth', aoeRadiusPx: 11 },
  { id: 'N08', archetype: 'cone_flame', colorTheme: 'flame', aoeRadiusPx: 11, leavesHazard: 'burn' },
  { id: 'N09', archetype: 'melee', colorTheme: 'plasma' },
  { id: 'N10', archetype: 'projectile_dot', colorTheme: 'earth', aoeRadiusPx: 8 },
  { id: 'N11', archetype: 'beam_ramp', colorTheme: 'flame', rampTiers: [1, 1.9, 3.2] },
  { id: 'N12', archetype: 'hitscan_burst', colorTheme: 'kinetic', burstCount: 4 },
];

/** Integer Bresenham line pixel iterator for razor-sharp discrete pixel-art beams & tracers. */
export function forEachBresenhamPixel(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cb: (x: number, y: number, step: number, total: number) => void,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;
  const total = Math.max(1, Math.max(dx, dy));
  let step = 0;

  while (true) {
    cb(x, y, step, total);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    step++;
  }
}

function plotSafe(dst: PixelSurface, x: number, y: number, col: RGBA32): void {
  if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
  blendPixel(dst.pixels, y * dst.width + x, col);
}

/**
 * Draws a discrete procedural ramping laser beam (Tier 1 -> Tier 2 -> Tier 3 over lock-on time!).
 *  - tier 1: 1px crisp line + tiny lock spark
 *  - tier 2: 2px core + outer translucent aura + traveling charge pulses
 *  - tier 3: 3px white-hot overcharge core + vibrant aura + burning impact ring!
 */
export function drawDiscreteRampBeam(
  dst: PixelSurface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tier: 1 | 2 | 3,
  tick: number,
  theme: 'plasma' | 'acid' | 'flame' = 'plasma',
): void {
  const outer =
    theme === 'acid'
      ? packRGBA(157, 255, 59, 120)
      : theme === 'flame'
        ? packRGBA(255, 130, 35, 130)
        : packRGBA(65, 225, 255, 125);
  const mid =
    theme === 'acid'
      ? VFX_PAL.g
      : theme === 'flame'
        ? VFX_PAL.o
        : VFX_PAL.c;
  const core =
    theme === 'acid'
      ? VFX_PAL.G
      : theme === 'flame'
        ? VFX_PAL.Y
        : VFX_PAL.C;
  const hot = VFX_PAL.w;

  const isSteep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  const pxOff = isSteep ? 1 : 0;
  const pyOff = isSteep ? 0 : 1;

  forEachBresenhamPixel(x0, y0, x1, y1, (x, y, step) => {
    const pulse = ((step - tick * 2) & 7) === 0;
    if (tier === 1) {
      plotSafe(dst, x, y, pulse ? core : mid);
    } else if (tier === 2) {
      plotSafe(dst, x - pxOff, y - pyOff, outer);
      plotSafe(dst, x + pxOff, y + pyOff, outer);
      plotSafe(dst, x, y, pulse ? hot : core);
    } else {
      // Tier 3: Max thermal melt — 3px core + wide pulsing halo + traveling super-nodes!
      plotSafe(dst, x - pxOff * 2, y - pyOff * 2, outer);
      plotSafe(dst, x + pxOff * 2, y + pyOff * 2, outer);
      plotSafe(dst, x - pxOff, y - pyOff, pulse ? core : mid);
      plotSafe(dst, x + pxOff, y + pyOff, pulse ? core : mid);
      plotSafe(dst, x, y, hot);
    }
  });

  // Impact scorch flare proportional to ramp tier
  const r = tier === 1 ? 1 : tier === 2 ? 2 : 3;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0) plotSafe(dst, Math.round(x1), Math.round(y1), hot);
      else if (d <= r) plotSafe(dst, Math.round(x1) + dx, Math.round(y1) + dy, d === r ? outer : mid);
    }
  }
}

/** Draws a jagged discrete-pixel chain lightning bolt between two points. */
export function drawDiscreteChainArc(
  dst: PixelSurface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  thick = false,
): void {
  const segs = 5;
  const pts: Array<[number, number]> = [[x0, y0]];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jig = Math.sin(i * 12.7 + seed * 5.3) * 3.2;
    pts.push([x0 + dx * t + nx * jig, y0 + dy * t + ny * jig]);
  }
  pts.push([x1, y1]);

  for (let i = 0; i < pts.length - 1; i++) {
    forEachBresenhamPixel(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], (x, y) => {
      if (thick) {
        plotSafe(dst, x, y - 1, VFX_PAL.h);
        plotSafe(dst, x, y + 1, VFX_PAL.h);
      }
      plotSafe(dst, x, y, thick ? VFX_PAL.w : VFX_PAL.c);
    });
  }
}

export interface BakedVfxSprite {
  readonly spec: VfxSpriteSpec;
  readonly cellW: number;
  readonly cellH: number;
  readonly strip: PixelSurface;
  readonly frames: readonly PixelSurface[];
}

export function bakeAllVfxSprites(): readonly BakedVfxSprite[] {
  return VFX_SPRITE_SPECS.map((spec) => {
    const frames = spec.frames.map((pat) => {
      const raw = compilePattern(pat, VFX_PAL);
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
