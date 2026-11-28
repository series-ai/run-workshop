/**
 * 12 Neutral Map Units (N01..N12) — 6 Ambient Biome Critters + 6 Neutral Guardians.
 *
 * Uses the dedicated 'neutral' material palette (weathered granite, obsidian, moss-olive,
 * warm fur, terracotta rust, desert ochre, frost ivory, molten ember) so neutral critters
 * and camp defenders NEVER visually collide with Vanguard, Kraxen, or Solaris team colors!
 *
 * - N01..N06: Ambient Biome Critters (Meadow Boar, Canyon Scuttler, Frost Yeti-Ram,
 *             Ash-Salamander, Cliff Hawk, Drift-Lantern Jelly).
 * - N07..N12: Neutral Creep / Expansion Guardians (Stone Golem, Magma Elemental,
 *             Frost Stalker, Dune Wyrm, Auto-Sentry Relic [2-Layer], Rogue Mech-Scrapper [2-Layer]).
 */

import type { UnitRigSpec } from './voxel-baker.ts';

export const NEUTRAL_RIGS: readonly UnitRigSpec[] = [
  // === 6 AMBIENT BIOME CRITTERS ===

  // N01: Meadow Boar (Temperate — shaggy russet tusker grazing on frontier meadows)
  {
    id: 'N01',
    name: 'Meadow Boar',
    faction: 'neutral',
    role: 'Critter (Temperate)',
    layer: 'ground',
    coreW: 13,
    coreH: 10,
    parts: [
      { kind: 'seg', a: [1.6, -1.5, 2.0], b: [1.8, -1.6, 0.3], ra: 0.55, mat: 'bronze', anim: 'legFL' },
      { kind: 'seg', a: [1.6, 1.5, 2.0], b: [1.8, 1.6, 0.3], ra: 0.55, mat: 'bronze', anim: 'legFR' },
      { kind: 'seg', a: [-1.8, -1.5, 2.0], b: [-2.0, -1.6, 0.3], ra: 0.55, mat: 'bronze', anim: 'legBL' },
      { kind: 'seg', a: [-1.8, 1.5, 2.0], b: [-2.0, 1.6, 0.3], ra: 0.55, mat: 'bronze', anim: 'legBR' },
      { kind: 'ellipsoid', x: -0.2, y: 0, z: 3.0, rx: 3.4, ry: 2.3, rz: 2.0, mat: 'chitin', detail: 'rib' },
      { kind: 'ellipsoid', x: 2.6, y: 0, z: 3.0, rx: 1.6, ry: 1.5, rz: 1.4, mat: 'bronze' },
      // Curved ivory tusks + short wagging tail
      { kind: 'seg', a: [3.4, -1.0, 2.4], b: [5.2, -1.5, 3.6], ra: 0.5, rb: 0.25, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [3.4, 1.0, 2.4], b: [5.2, 1.5, 3.6], ra: 0.5, rb: 0.25, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [-3.2, 0, 3.2], b: [-4.6, 0, 2.4], ra: 0.45, mat: 'bronze', anim: 'tail' },
    ],
  },

  // N02: Canyon Scuttler (Desert — low armored sandy 6-leg desert tortoise-crab)
  {
    id: 'N02',
    name: 'Canyon Scuttler',
    faction: 'neutral',
    role: 'Critter (Desert)',
    layer: 'ground',
    coreW: 13,
    coreH: 10,
    parts: [
      { kind: 'seg', a: [1.8, -2.0, 1.8], b: [2.4, -3.6, 0.3], ra: 0.45, mat: 'bronze', anim: 'legFL' },
      { kind: 'seg', a: [1.8, 2.0, 1.8], b: [2.4, 3.6, 0.3], ra: 0.45, mat: 'bronze', anim: 'legFR' },
      { kind: 'seg', a: [0, -2.2, 1.8], b: [0, -3.8, 0.3], ra: 0.45, mat: 'bronze', anim: 'legML' },
      { kind: 'seg', a: [0, 2.2, 1.8], b: [0, 3.8, 0.3], ra: 0.45, mat: 'bronze', anim: 'legMR' },
      { kind: 'seg', a: [-1.8, -2.0, 1.8], b: [-2.4, -3.6, 0.3], ra: 0.45, mat: 'bronze', anim: 'legBL' },
      { kind: 'seg', a: [-1.8, 2.0, 1.8], b: [-2.4, 3.6, 0.3], ra: 0.45, mat: 'bronze', anim: 'legBR' },
      { kind: 'ellipsoid', x: -0.2, y: 0, z: 2.6, rx: 3.4, ry: 2.8, rz: 1.9, mat: 'ochre', detail: 'plate' },
      { kind: 'ellipsoid', x: 3.2, y: 0, z: 2.4, rx: 1.2, ry: 1.1, rz: 1.0, mat: 'chitin' },
      { kind: 'seg', a: [3.6, -0.8, 2.4], b: [5.0, -1.2, 2.6], ra: 0.4, mat: 'bone' },
      { kind: 'seg', a: [3.6, 0.8, 2.4], b: [5.0, 1.2, 2.6], ra: 0.4, mat: 'bone' },
    ],
  },

  // N03: Frost Yeti-Ram (Tundra — shaggy pale-cream mountain ram w/ big curved dark horns!)
  {
    id: 'N03',
    name: 'Frost Yeti-Ram',
    faction: 'neutral',
    role: 'Critter (Tundra)',
    layer: 'ground',
    coreW: 14,
    coreH: 12,
    parts: [
      { kind: 'seg', a: [1.6, -1.6, 2.6], b: [1.8, -1.8, 0.3], ra: 0.6, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [1.6, 1.6, 2.6], b: [1.8, 1.8, 0.3], ra: 0.6, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'seg', a: [-1.8, -1.6, 2.6], b: [-2.0, -1.8, 0.3], ra: 0.6, mat: 'darkSteel', anim: 'legBL' },
      { kind: 'seg', a: [-1.8, 1.6, 2.6], b: [-2.0, 1.8, 0.3], ra: 0.6, mat: 'darkSteel', anim: 'legBR' },
      { kind: 'ellipsoid', x: -0.2, y: 0, z: 3.8, rx: 3.4, ry: 2.6, rz: 2.4, mat: 'bone', detail: 'rib' },
      { kind: 'ellipsoid', x: 2.8, y: 0, z: 4.4, rx: 1.6, ry: 1.5, rz: 1.5, mat: 'steel' },
      // Big curved obsidian ram horns
      { kind: 'seg', a: [2.8, -1.2, 5.4], b: [1.4, -3.2, 6.8], ra: 0.65, rb: 0.4, mat: 'darkSteel' },
      { kind: 'seg', a: [1.4, -3.2, 6.8], b: [3.4, -3.4, 5.0], ra: 0.5, rb: 0.3, mat: 'darkSteel' },
      { kind: 'seg', a: [2.8, 1.2, 5.4], b: [1.4, 3.2, 6.8], ra: 0.65, rb: 0.4, mat: 'darkSteel' },
      { kind: 'seg', a: [1.4, 3.2, 6.8], b: [3.4, 3.4, 5.0], ra: 0.5, rb: 0.3, mat: 'darkSteel' },
    ],
  },

  // N04: Ash-Salamander (Volcanic — dark charcoal newt w/ subtle glowing ember spine!)
  {
    id: 'N04',
    name: 'Ash-Salamander',
    faction: 'neutral',
    role: 'Critter (Volcanic)',
    layer: 'ground',
    coreW: 15,
    coreH: 10,
    parts: [
      { kind: 'seg', a: [2.0, -1.6, 1.6], b: [2.8, -3.2, 0.3], ra: 0.5, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [2.0, 1.6, 1.6], b: [2.8, 3.2, 0.3], ra: 0.5, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'seg', a: [-2.0, -1.6, 1.6], b: [-2.8, -3.2, 0.3], ra: 0.5, mat: 'darkSteel', anim: 'legBL' },
      { kind: 'seg', a: [-2.0, 1.6, 1.6], b: [-2.8, 3.2, 0.3], ra: 0.5, mat: 'darkSteel', anim: 'legBR' },
      { kind: 'ellipsoid', x: 0.2, y: 0, z: 2.0, rx: 4.0, ry: 1.8, rz: 1.3, mat: 'darkSteel', detail: 'rib' },
      { kind: 'seg', a: [-3.2, 0, 1.8], b: [-6.8, 0, 2.2], ra: 0.9, rb: 0.3, mat: 'darkSteel', anim: 'tail' },
      { kind: 'seg', a: [-2.2, 0, 3.0], b: [2.6, 0, 3.0], ra: 0.55, mat: 'amber', glow: true },
      { kind: 'ellipsoid', x: 4.4, y: 0, z: 2.2, rx: 1.4, ry: 1.2, rz: 1.0, mat: 'flesh' },
    ],
  },

  // N05: Cliff Hawk (Air Critter — soaring natural brown-and-cream coastal raptor!)
  {
    id: 'N05',
    name: 'Cliff Hawk',
    faction: 'neutral',
    role: 'Critter (Air)',
    layer: 'air',
    coreW: 16,
    coreH: 12,
    parts: [
      { kind: 'ellipsoid', x: 0.4, y: 0, z: 5.0, rx: 3.2, ry: 1.2, rz: 1.0, mat: 'chitin', anim: 'bob' },
      { kind: 'wing', a: [1.6, -0.6, 5.2], b: [-1.0, -6.6, 6.2], c: [-2.2, -0.8, 5.0], mat: 'chitin', anim: 'wingL' },
      { kind: 'wing', a: [1.6, 0.6, 5.2], b: [-1.0, 6.6, 6.2], c: [-2.2, 0.8, 5.0], mat: 'chitin', anim: 'wingR' },
      { kind: 'seg', a: [1.6, -0.6, 5.3], b: [-1.0, -6.8, 6.3], ra: 0.45, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [1.6, 0.6, 5.3], b: [-1.0, 6.8, 6.3], ra: 0.45, mat: 'bone', anim: 'wingR' },
      { kind: 'wing', a: [-2.4, 0, 5.0], b: [-5.6, -2.0, 5.2], c: [-5.6, 2.0, 5.2], mat: 'bronze', anim: 'tail' },
      { kind: 'seg', a: [3.0, 0, 5.2], b: [4.8, 0, 4.8], ra: 0.7, rb: 0.3, mat: 'bone', anim: 'bob' },
    ],
  },

  // N06: Drift-Lantern Jelly (Air Critter — rounded glowing amber sky-jellyfish w/ 4 trailing filaments!)
  {
    id: 'N06',
    name: 'Drift-Lantern',
    faction: 'neutral',
    role: 'Critter (Air)',
    layer: 'air',
    coreW: 14,
    coreH: 14,
    parts: [
      { kind: 'ellipsoid', x: 0, y: 0, z: 8.6, rx: 3.1, ry: 3.1, rz: 2.9, mat: 'ochre', anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 7.4, rx: 2.2, ry: 2.2, rz: 1.9, mat: 'amber', glow: true, anim: 'bob' },
      { kind: 'seg', a: [1.4, -1.6, 6.2], b: [1.8, -2.4, 2.0], ra: 0.45, mat: 'ochre', anim: 'tail' },
      { kind: 'seg', a: [1.4, 1.6, 6.2], b: [1.8, 2.4, 2.0], ra: 0.45, mat: 'ochre', anim: 'tail' },
      { kind: 'seg', a: [-1.4, -1.4, 6.2], b: [-2.0, -2.0, 2.2], ra: 0.45, mat: 'bone', anim: 'tail' },
      { kind: 'seg', a: [-1.4, 1.4, 6.2], b: [-2.0, 2.0, 2.2], ra: 0.45, mat: 'bone', anim: 'tail' },
      { kind: 'seg', a: [0, 0, 5.8], b: [0, 0, 1.2], ra: 0.55, mat: 'amber', glow: true, anim: 'tail' },
    ],
  },

  // === 6 NEUTRAL CREEP GUARDIANS (Defend expansions, ruins & Watchtowers!) ===

  // N07: Stone Golem (Heavy Ground — ancient mossy granite boulder-giant w/ synced overhead ground-slam!)
  {
    id: 'N07',
    name: 'Stone Golem',
    faction: 'neutral',
    role: 'Guardian (Heavy)',
    layer: 'ground',
    coreW: 22,
    coreH: 21,
    parts: [
      // Heavy cracked granite legs
      { kind: 'box', x: 0, y: -3.2, z: 3.2, sx: 3.6, sy: 3.0, sz: 5.4, mat: 'steel', detail: 'plate', anim: 'legFL' },
      { kind: 'box', x: 0, y: 3.2, z: 3.2, sx: 3.6, sy: 3.0, sz: 5.4, mat: 'steel', detail: 'plate', anim: 'legFR' },
      // Broad hunched boulder torso + moss-draped shoulders!
      { kind: 'ellipsoid', x: 0, y: 0, z: 8.4, rx: 5.4, ry: 6.0, rz: 4.2, mat: 'steel', detail: 'plate', anim: 'meleeBody' },
      { kind: 'ellipsoid', x: -0.4, y: -3.6, z: 10.8, rx: 2.8, ry: 2.4, rz: 1.8, mat: 'team', anim: 'meleeBody' },
      { kind: 'ellipsoid', x: -0.4, y: 3.6, z: 10.8, rx: 2.8, ry: 2.4, rz: 1.8, mat: 'team', anim: 'meleeBody' },
      // Recessed glowing amber rune face + chest rune
      { kind: 'box', x: 4.6, y: 0, z: 9.8, sx: 1.2, sy: 2.8, sz: 1.2, mat: 'amber', glow: true, anim: 'meleeBody' },
      { kind: 'ellipsoid', x: 4.8, y: 0, z: 7.4, rx: 1.3, ry: 1.4, rz: 1.4, mat: 'amber', glow: true, anim: 'meleeBody' },
      // Huge overhead-slamming granite boulder-fists!
      { kind: 'box', x: 2.2, y: -6.2, z: 6.0, sx: 4.6, sy: 3.0, sz: 4.8, mat: 'steel', detail: 'plate', anim: 'slam' },
      { kind: 'box', x: 2.2, y: 6.2, z: 6.0, sx: 4.6, sy: 3.0, sz: 4.8, mat: 'steel', detail: 'plate', anim: 'slam' },
    ],
  },

  // N08: Magma Elemental (Heavy Ground — jagged obsidian crust brute cracked open w/ molten lava core!)
  {
    id: 'N08',
    name: 'Magma Elemental',
    faction: 'neutral',
    role: 'Guardian (Volcanic)',
    layer: 'ground',
    coreW: 20,
    coreH: 19,
    parts: [
      { kind: 'seg', a: [0, 0, 1.0], b: [0, 0, 6.2], ra: 3.2, rb: 1.8, mat: 'amber', glow: true, anim: 'bob' },
      { kind: 'ring', x: 0, y: 0, z: 1.6, r: 4.0, tube: 1.2, mat: 'darkSteel', anim: 'bob' },
      // Molten torso framed by floating jagged obsidian armor shards
      { kind: 'ellipsoid', x: 0, y: 0, z: 8.6, rx: 3.8, ry: 4.2, rz: 3.6, mat: 'amber', glow: true, anim: 'bob' },
      { kind: 'box', x: -1.4, y: -4.4, z: 10.0, sx: 3.6, sy: 2.8, sz: 4.2, mat: 'darkSteel', detail: 'plate', anim: 'bob' },
      { kind: 'box', x: -1.4, y: 4.4, z: 10.0, sx: 3.6, sy: 2.8, sz: 4.2, mat: 'darkSteel', detail: 'plate', anim: 'bob' },
      { kind: 'seg', a: [0, 0, 11.2], b: [-1.4, 0, 14.2], ra: 1.8, rb: 0.6, mat: 'darkSteel', anim: 'bob' },
      // Molten slam gauntlets
      { kind: 'seg', a: [1.4, -5.0, 8.2], b: [5.8, -5.0, 6.4], ra: 1.6, rb: 1.1, mat: 'flesh', anim: 'slam' },
      { kind: 'seg', a: [1.4, 5.0, 8.2], b: [5.8, 5.0, 6.4], ra: 1.6, rb: 1.1, mat: 'flesh', anim: 'slam' },
      { kind: 'ellipsoid', x: 6.4, y: -5.0, z: 6.4, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'amber', glow: true, anim: 'slam' },
      { kind: 'ellipsoid', x: 6.4, y: 5.0, z: 6.4, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'amber', glow: true, anim: 'slam' },
    ],
  },

  // N09: Frost Stalker (Raider — lean savage arctic prowler-wolf w/ crystalline ice ridge!)
  {
    id: 'N09',
    name: 'Frost Stalker',
    faction: 'neutral',
    role: 'Guardian (Tundra)',
    layer: 'ground',
    coreW: 19,
    coreH: 14,
    parts: [
      { kind: 'seg', a: [3.2, -1.8, 2.8], b: [5.6, -2.4, 0.3], ra: 0.7, mat: 'steel', anim: 'legFL' },
      { kind: 'seg', a: [3.2, 1.8, 2.8], b: [5.6, 2.4, 0.3], ra: 0.7, mat: 'steel', anim: 'legFR' },
      { kind: 'seg', a: [-3.2, -1.8, 2.8], b: [-5.6, -2.4, 0.3], ra: 0.7, mat: 'steel', anim: 'legBL' },
      { kind: 'seg', a: [-3.2, 1.8, 2.8], b: [-5.6, 2.4, 0.3], ra: 0.7, mat: 'steel', anim: 'legBR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 3.4, rx: 4.8, ry: 2.2, rz: 1.9, mat: 'bone', detail: 'rib', anim: 'meleeBody' },
      // Jagged dorsal glacial ice-crystal spine!
      { kind: 'seg', a: [1.4, 0, 4.6], b: [0.4, 0, 8.2], ra: 0.9, rb: 0.35, mat: 'cyan', glow: true, anim: 'meleeBody' },
      { kind: 'seg', a: [-1.4, 0, 4.4], b: [-2.8, 0, 7.6], ra: 0.8, rb: 0.3, mat: 'cyan', glow: true, anim: 'meleeBody' },
      { kind: 'seg', a: [-4.2, 0, 3.4], b: [-7.6, 0, 4.4], ra: 0.85, rb: 0.35, mat: 'steel', anim: 'tail' },
      // Snarling wolf lunge bite
      { kind: 'seg', a: [3.6, 0, 3.8], b: [7.4, 0, 4.2], ra: 1.35, rb: 0.65, mat: 'bone', anim: 'swingR' },
      { kind: 'ellipsoid', x: 5.6, y: -0.9, z: 4.8, rx: 0.6, ry: 0.5, rz: 0.5, mat: 'cyan', glow: true, anim: 'swingR' },
      { kind: 'ellipsoid', x: 5.6, y: 0.9, z: 4.8, rx: 0.6, ry: 0.5, rz: 0.5, mat: 'cyan', glow: true, anim: 'swingR' },
    ],
  },

  // N10: Dune Wyrm (Heavy — giant segmented ochre sand-worm erupting from burrow ring w/ 3-way tooth maw!)
  {
    id: 'N10',
    name: 'Dune Wyrm',
    faction: 'neutral',
    role: 'Guardian (Desert)',
    layer: 'ground',
    coreW: 19,
    coreH: 18,
    parts: [
      // Cracked desert burrow dirt ring
      { kind: 'ring', x: 0, y: 0, z: 1.0, r: 4.8, tube: 1.3, mat: 'bronze' },
      // Towering coiled armored ochre worm body
      { kind: 'seg', a: [-1.2, 0, 1.8], b: [-1.8, 0, 7.4], ra: 3.0, rb: 2.6, mat: 'ochre', detail: 'rib', anim: 'bob' },
      { kind: 'seg', a: [-1.8, 0, 7.4], b: [2.8, 0, 10.6], ra: 2.6, rb: 2.2, mat: 'chitin', detail: 'rib', anim: 'recoil' },
      // Open dark gullet ringed with ivory fangs!
      { kind: 'ellipsoid', x: 4.2, y: 0, z: 10.4, rx: 1.6, ry: 2.0, rz: 2.0, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'seg', a: [3.2, -1.8, 10.4], b: [6.8, -3.2, 11.0], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [3.2, 1.8, 10.4], b: [6.8, 3.2, 11.0], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [3.2, 0, 12.0], b: [6.6, 0, 14.2], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.4, y: 0, z: 10.8, rx: 2.2, ry: 2.2, rz: 2.0, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // N11: Auto-Sentry Relic (TWO-LAYER Neutral Guardian Turret — weathered stone pedestal + rotating bronze laser eye!)
  {
    id: 'N11',
    name: 'Auto-Sentry Relic',
    faction: 'neutral',
    role: 'Guardian (2-Layer)',
    layer: 'ground',
    coreW: 16,
    coreH: 16,
    twoLayer: true,
    turretPivot: [0, 0, 4.8],
    parts: [
      { kind: 'box', x: 0, y: 0, z: 1.4, sx: 8.0, sy: 8.0, sz: 2.4, mat: 'steel', detail: 'plate' },
      { kind: 'box', x: 0, y: 0, z: 3.4, sx: 5.6, sy: 5.6, sz: 2.4, mat: 'bronze', detail: 'plate' },
      { kind: 'ring', x: 0, y: 0, z: 4.6, r: 3.2, tube: 0.7, mat: 'gold' },
    ],
    turretParts: [
      { kind: 'ellipsoid', x: -0.4, y: 0, z: 2.2, rx: 3.4, ry: 3.4, rz: 2.4, mat: 'gold', detail: 'plate' },
      { kind: 'box', x: -1.4, y: 0, z: 3.2, sx: 3.4, sy: 4.0, sz: 1.4, mat: 'team' },
      { kind: 'seg', a: [1.8, 0, 2.2], b: [6.4, 0, 2.2], ra: 1.15, rb: 0.75, mat: 'bronze', anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.4, y: 0, z: 2.2, rx: 1.1, ry: 1.1, rz: 1.1, mat: 'amber', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.6, y: 0, z: 2.2, rx: 1.8, ry: 1.6, rz: 1.6, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // N12: Rogue Mech-Scrapper (TWO-LAYER Neutral Guardian — rusted olive-and-iron mercenary walker!)
  {
    id: 'N12',
    name: 'Rogue Scrapper',
    faction: 'neutral',
    role: 'Guardian (2-Layer)',
    layer: 'ground',
    coreW: 19,
    coreH: 19,
    twoLayer: true,
    turretPivot: [0, 0, 7.0],
    parts: [
      { kind: 'seg', a: [0, -3.2, 6.8], b: [-1.2, -3.6, 3.6], ra: 1.1, mat: 'flesh', anim: 'legFL' },
      { kind: 'seg', a: [-1.2, -3.6, 3.6], b: [0.8, -3.8, 0.7], ra: 1.0, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'box', x: 1.0, y: -3.8, z: 0.6, sx: 3.4, sy: 2.4, sz: 1.2, mat: 'steel', anim: 'legFL' },
      { kind: 'seg', a: [0, 3.2, 6.8], b: [-1.2, 3.6, 3.6], ra: 1.1, mat: 'flesh', anim: 'legFR' },
      { kind: 'seg', a: [-1.2, 3.6, 3.6], b: [0.8, 3.8, 0.7], ra: 1.0, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'box', x: 1.0, y: 3.8, z: 0.6, sx: 3.4, sy: 2.4, sz: 1.2, mat: 'steel', anim: 'legFR' },
      { kind: 'box', x: 0, y: 0, z: 6.6, sx: 4.4, sy: 5.8, sz: 1.8, mat: 'darkSteel' },
    ],
    turretParts: [
      { kind: 'box', x: 0, y: 0, z: 2.4, sx: 6.2, sy: 6.0, sz: 4.2, mat: 'team', detail: 'panel' },
      { kind: 'box', x: -2.8, y: 0, z: 3.4, sx: 2.2, sy: 4.6, sz: 3.0, mat: 'flesh', detail: 'panel' },
      { kind: 'box', x: 3.2, y: 0, z: 2.8, sx: 1.0, sy: 2.8, sz: 1.1, mat: 'amber', glow: true },
      // Asymmetric mercenary weaponry: heavy scrap-autocannon right + saw-claw left!
      { kind: 'seg', a: [0.8, 4.0, 2.2], b: [7.2, 4.0, 2.2], ra: 0.95, rb: 0.75, mat: 'steel', anim: 'recoil' },
      { kind: 'box', x: 1.6, y: -4.2, z: 2.2, sx: 3.4, sy: 2.2, sz: 2.2, mat: 'flesh', anim: 'recoil' },
      { kind: 'ring', x: 4.4, y: -4.2, z: 2.2, r: 1.8, tube: 0.6, mat: 'steel', vertical: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.8, y: 4.0, z: 2.2, rx: 1.8, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },
];
