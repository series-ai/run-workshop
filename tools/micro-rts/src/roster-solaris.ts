/**
 * Full 24-Unit Articulated 3D Micro-Pixel Rigs for SOLARIS (S01..S24).
 *
 * - S22 (Sky-Carrier) reuses its verified hand-authored 8-way sheet from titans.ts.
 * - S14 (Quad-Strider), S16 (Colossus — upgraded!), S17 (Sun-Golem), and S18 (Obelisk-Barge)
 *   are baked as true 2-layer independent hull/legs + aiming turret/torso/cannon sheets.
 * - S01-S03 are tagged as workers.
 */

import type { RigPart, UnitRigSpec } from './voxel-baker.ts';

function templarBiped(legH = 2.8, spread = 1.6): readonly RigPart[] {
  return [
    // Wide heroic leg stance with bronze greaves + gold knee guards
    { kind: 'seg', a: [0.1, -spread, legH], b: [0.4, -spread, 0.4], ra: 0.62, mat: 'bronze', anim: 'legFL' },
    { kind: 'box', x: 0.5, y: -spread, z: 0.4, sx: 1.6, sy: 1.2, sz: 0.9, mat: 'gold', anim: 'legFL' },
    { kind: 'seg', a: [-0.1, spread, legH], b: [-0.3, spread, 0.4], ra: 0.62, mat: 'bronze', anim: 'legFR' },
    { kind: 'box', x: -0.1, y: spread, z: 0.4, sx: 1.6, sy: 1.2, sz: 0.9, mat: 'gold', anim: 'legFR' },
    // Dark bronze waist sash + royal-blue tabard + sculpted golden wing-pauldrons
    { kind: 'box', x: 0, y: 0, z: legH + 0.3, sx: 2.4, sy: 3.2, sz: 0.9, mat: 'bronze' },
    { kind: 'box', x: 0, y: 0, z: legH + 1.8, sx: 2.8, sy: 3.6, sz: 2.6, mat: 'team' },
    { kind: 'wing', a: [0, -1.6, legH + 2.8], b: [-0.8, -3.4, legH + 3.6], c: [0.4, -1.8, legH + 1.4], mat: 'gold', thickness: 1.0 },
    { kind: 'wing', a: [0, 1.6, legH + 2.8], b: [-0.8, 3.4, legH + 3.6], c: [0.4, 1.8, legH + 1.4], mat: 'gold', thickness: 1.0 },
    // Iconic peaked Solaris crest-helm + glowing cyan eye-visor
    { kind: 'ellipsoid', x: 0.1, y: 0, z: legH + 4.0, rx: 1.5, ry: 1.5, rz: 1.7, mat: 'gold' },
    { kind: 'box', x: 1.25, y: 0, z: legH + 3.9, sx: 0.85, sy: 1.7, sz: 0.8, mat: 'cyan', glow: true },
  ];
}

export const SOLARIS_RIGS: readonly UnitRigSpec[] = [
  // S01: Sun-Wisp (Worker — golden crescent halo probe w/ cyan heart & twin caliper prongs!)
  {
    id: 'S01',
    name: 'Sun-Wisp',
    faction: 'solaris',
    role: 'Worker',
    layer: 'air',
    coreW: 14,
    coreH: 12,
    special: 'worker',
    parts: [
      { kind: 'ring', x: -0.6, y: 0, z: 4.8, r: 3.2, tube: 0.85, mat: 'gold', arc: [85, 275], anim: 'bob' },
      { kind: 'ellipsoid', x: -1.4, y: 0, z: 5.0, rx: 1.8, ry: 2.0, rz: 1.8, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 4.8, rx: 1.5, ry: 1.5, rz: 1.5, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [0.6, -2.4, 4.8], b: [5.0, -2.2, 4.8], ra: 0.7, rb: 0.4, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0.6, 2.4, 4.8], b: [5.0, 2.2, 4.8], ra: 0.7, rb: 0.4, mat: 'gold', anim: 'bob' },
      { kind: 'ellipsoid', x: 5.4, y: 0, z: 4.8, rx: 1.6, ry: 1.6, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S02: Glyph-Servitor (Worker — 3D crossed golden astrolabe rings cradling glowing cyan energy cube!)
  {
    id: 'S02',
    name: 'Glyph-Servitor',
    faction: 'solaris',
    role: 'Worker',
    layer: 'air',
    coreW: 14,
    coreH: 13,
    special: 'worker',
    parts: [
      // Open crossed astrolabe ring + tall arched crown so negative space reads cleanly on all 8 headings!
      { kind: 'ring', x: 0, y: 0, z: 5.2, r: 4.3, tube: 0.65, mat: 'gold', anim: 'bob' },
      { kind: 'ring', x: 0, y: 0, z: 6.2, r: 3.8, tube: 0.65, mat: 'gold', vertical: true, arc: [15, 165], anim: 'bob' },
      { kind: 'box', x: 0, y: 0, z: 9.6, sx: 2.0, sy: 2.0, sz: 1.2, mat: 'team', anim: 'bob' },
      { kind: 'box', x: 0, y: 0, z: 5.2, sx: 2.4, sy: 2.4, sz: 2.4, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 4.2, y: 0, z: 5.4, rx: 1.5, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S03: Prism-Scribe (Worker — floating fluted obelisk w/ flanking wing-fins & diagonal cyan laser beam!)
  {
    id: 'S03',
    name: 'Prism-Scribe',
    faction: 'solaris',
    role: 'Worker',
    layer: 'air',
    coreW: 15,
    coreH: 13,
    special: 'worker',
    parts: [
      { kind: 'seg', a: [-1.6, 0, 2.6], b: [-1.6, 0, 9.4], ra: 0.75, rb: 1.6, mat: 'gold', anim: 'bob' },
      { kind: 'box', x: -1.6, y: 0, z: 6.2, sx: 2.2, sy: 2.2, sz: 2.2, mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [-1.6, -1.2, 7.6], b: [-3.2, -3.8, 9.2], c: [-2.4, -1.2, 4.6], mat: 'gold', anim: 'bob' },
      { kind: 'wing', a: [-1.6, 1.2, 7.6], b: [-3.2, 3.8, 9.2], c: [-2.4, 1.2, 4.6], mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [-0.2, 0, 6.2], b: [5.6, 0, 3.2], ra: 0.8, rb: 0.45, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.0, y: 0, z: 3.0, rx: 1.5, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S04: Blade (Tier-1 Line — wide warrior w/ TWO synced sweeping electric-cyan wrist psi-blades!)
  {
    id: 'S04',
    name: 'Blade',
    faction: 'solaris',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 17,
    coreH: 13,
    parts: [
      ...templarBiped(2.7, 1.7),
      { kind: 'seg', a: [0.6, -2.2, 4.2], b: [5.4, -3.8, 3.8], ra: 0.75, rb: 0.35, mat: 'cyan', glow: true, anim: 'swingL' },
      { kind: 'seg', a: [0.6, 2.2, 4.2], b: [5.4, 3.8, 3.8], ra: 0.75, rb: 0.35, mat: 'cyan', glow: true, anim: 'swingR' },
    ],
  },

  // S05: Sun-Lancer (Tier-1 Line — golden warrior w/ tall thrusting cyan sun-glaive!)
  {
    id: 'S05',
    name: 'Sun-Lancer',
    faction: 'solaris',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 16,
    coreH: 14,
    parts: [
      ...templarBiped(2.7, 1.6),
      { kind: 'seg', a: [0.8, 2.4, 1.6], b: [3.6, 2.4, 10.2], ra: 0.55, mat: 'gold', anim: 'swingR' },
      { kind: 'seg', a: [2.6, 2.4, 6.8], b: [4.2, 2.4, 11.0], ra: 1.0, rb: 0.35, mat: 'cyan', glow: true, anim: 'swingR' },
    ],
  },

  // S06: Aegis-Guard (Tier-1 Line — golden templar + clearly detached curved cyan-rimmed energy kite-shield!)
  {
    id: 'S06',
    name: 'Aegis-Guard',
    faction: 'solaris',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 15,
    coreH: 12,
    parts: [
      ...templarBiped(2.6, 1.6),
      // Floating detached energy kite-shield + synced melee glaive slash!
      { kind: 'box', x: 3.8, y: -0.6, z: 4.2, sx: 1.1, sy: 4.4, sz: 6.2, mat: 'cyan', glow: true, anim: 'meleeBody' },
      { kind: 'box', x: 4.0, y: -0.6, z: 4.2, sx: 1.3, sy: 3.4, sz: 5.0, mat: 'gold', anim: 'meleeBody' },
      { kind: 'box', x: 4.3, y: -0.6, z: 4.4, sx: 0.9, sy: 2.0, sz: 3.2, mat: 'team', anim: 'meleeBody' },
      { kind: 'seg', a: [1.0, 2.4, 3.8], b: [4.8, 2.4, 5.2], ra: 0.65, rb: 0.35, mat: 'cyan', glow: true, anim: 'swingR' },
    ],
  },

  // S07: Arcanist (Ranged — robed priest holding a tall projecting golden sun-staff + radiant cyan orb!)
  {
    id: 'S07',
    name: 'Arcanist',
    faction: 'solaris',
    role: 'Ranged',
    layer: 'ground',
    coreW: 15,
    coreH: 13,
    parts: [
      ...templarBiped(2.6, 1.5),
      { kind: 'seg', a: [2.2, 2.4, 1.2], b: [3.8, 2.4, 9.2], ra: 0.6, mat: 'gold', anim: 'recoil' },
      { kind: 'ellipsoid', x: 4.0, y: 2.4, z: 9.8, rx: 1.6, ry: 1.6, rz: 1.6, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.6, y: 2.4, z: 9.6, rx: 1.9, ry: 1.7, rz: 1.7, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S08: Solar-Archer (Ranged — HUGE glowing cyan recurve energy longbow + nocked sun-arrow!)
  {
    id: 'S08',
    name: 'Solar-Archer',
    faction: 'solaris',
    role: 'Ranged',
    layer: 'ground',
    coreW: 16,
    coreH: 13,
    parts: [
      ...templarBiped(2.6, 1.6),
      // Wide dramatic C-arc recurve energy bow clearly separated forward!
      { kind: 'seg', a: [2.4, -1.6, 8.8], b: [5.2, 0.2, 4.8], ra: 0.65, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'seg', a: [5.2, 0.2, 4.8], b: [2.4, 2.0, 1.2], ra: 0.65, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'seg', a: [1.2, 0.2, 4.8], b: [6.8, 0.2, 4.8], ra: 0.6, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.2, y: 0.2, z: 4.8, rx: 1.7, ry: 1.3, rz: 1.3, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S09: Shard-Adept (Ranged — floating priest surrounded by 3 clearly detached diamond shards!)
  {
    id: 'S09',
    name: 'Shard-Adept',
    faction: 'solaris',
    role: 'Ranged',
    layer: 'ground',
    coreW: 13,
    coreH: 12,
    parts: [
      { kind: 'seg', a: [0, 0, 1.6], b: [0, 0, 5.4], ra: 1.0, rb: 1.8, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 6.2, rx: 1.5, ry: 1.5, rz: 1.4, mat: 'gold', anim: 'bob' },
      // 3 detached floating cyan diamond shards
      { kind: 'ellipsoid', x: 0, y: -4.2, z: 5.8, rx: 0.9, ry: 0.9, rz: 1.4, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 4.2, z: 5.8, rx: 0.9, ry: 0.9, rz: 1.4, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 9.2, rx: 1.0, ry: 1.0, rz: 1.4, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 4.6, y: 0, z: 6.0, rx: 1.6, ry: 1.6, rz: 1.6, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S10: Orrery Weaver (Specialist — floating winged golden seraph raising overhead cyan sun!)
  {
    id: 'S10',
    name: 'Orrery Weaver',
    faction: 'solaris',
    role: 'Specialist',
    layer: 'air',
    coreW: 13,
    coreH: 13,
    parts: [
      { kind: 'seg', a: [0, 0, 2.2], b: [0, 0, 6.4], ra: 0.9, rb: 1.9, mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [0.2, -1.2, 5.8], b: [-3.4, -4.8, 9.8], c: [-2.4, -2.0, 4.4], mat: 'gold', thickness: 0.9, anim: 'wingL' },
      { kind: 'wing', a: [0.2, 1.2, 5.8], b: [-3.4, 4.8, 9.8], c: [-2.4, 2.0, 4.4], mat: 'gold', thickness: 0.9, anim: 'wingR' },
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 8.8, rx: 1.8, ry: 1.8, rz: 1.8, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ring', x: 0.6, y: 0, z: 8.8, r: 3.2, tube: 0.55, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // S11: Mirage-Wraith (Specialist — slim crouched dark-cloaked assassin w/ long curved cyan scythe!)
  {
    id: 'S11',
    name: 'Mirage-Wraith',
    faction: 'solaris',
    role: 'Specialist',
    layer: 'ground',
    coreW: 14,
    coreH: 11,
    parts: [
      { kind: 'seg', a: [0.8, -1.2, 2.4], b: [2.2, -1.5, 0.3], ra: 0.55, mat: 'bronze', anim: 'legFL' },
      { kind: 'seg', a: [-0.8, 1.2, 2.4], b: [-2.0, 1.5, 0.3], ra: 0.55, mat: 'bronze', anim: 'legFR' },
      { kind: 'ellipsoid', x: 0.4, y: 0, z: 3.4, rx: 2.0, ry: 1.6, rz: 1.6, mat: 'team' },
      { kind: 'ellipsoid', x: 1.0, y: 0, z: 4.8, rx: 1.2, ry: 1.2, rz: 1.2, mat: 'gold' },
      // Streaming dark cloak tail left
      { kind: 'wing', a: [-0.8, 0, 4.2], b: [-5.6, -1.2, 3.2], c: [-5.2, 1.2, 2.6], mat: 'bronze', anim: 'tail' },
      // Long curved cyan crescent scythe sweeping cleanly on attack!
      { kind: 'seg', a: [1.4, 1.2, 3.4], b: [5.4, 1.4, 6.2], ra: 0.65, rb: 0.4, mat: 'cyan', glow: true, anim: 'swingR' },
      { kind: 'seg', a: [5.4, 1.4, 6.2], b: [6.2, 1.4, 3.4], ra: 0.55, rb: 0.3, mat: 'cyan', glow: true, anim: 'swingR' },
    ],
  },

  // S12: Null-Beacon (Specialist — dramatic split golden crescent tuning-fork spires around floating cyan crystal!)
  {
    id: 'S12',
    name: 'Null-Beacon',
    faction: 'solaris',
    role: 'Specialist',
    layer: 'air',
    coreW: 16,
    coreH: 15,
    parts: [
      // Dark bronze hover pedestal ring + royal-blue waist anchor
      { kind: 'ring', x: 0, y: 0, z: 3.4, r: 3.0, tube: 0.75, mat: 'bronze', anim: 'bob' },
      { kind: 'box', x: 0, y: 0, z: 4.2, sx: 2.6, sy: 3.2, sz: 1.8, mat: 'team', anim: 'bob' },
      // Wide unmistakable golden tuning-fork crescent prongs with wide open central gap!
      { kind: 'seg', a: [0, -2.0, 4.2], b: [0.4, -5.2, 6.4], ra: 0.95, rb: 0.85, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0.4, -5.2, 6.4], b: [0.8, -4.4, 11.4], ra: 0.9, rb: 0.5, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0, 2.0, 4.2], b: [0.4, 5.2, 6.4], ra: 0.95, rb: 0.85, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0.4, 5.2, 6.4], b: [0.8, 4.4, 11.4], ra: 0.9, rb: 0.5, mat: 'gold', anim: 'bob' },
      // Floating glowing cyan prism obelisk suspended in the open center!
      { kind: 'seg', a: [0.6, 0, 6.4], b: [0.6, 0, 10.6], ra: 1.2, rb: 0.45, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ring', x: 0.6, y: 0, z: 8.4, r: 4.6, tube: 0.6, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // S13: Sun-Chariot (Raider / AA — elongated twin-prong golden chariot-skimmer!)
  {
    id: 'S13',
    name: 'Sun-Chariot',
    faction: 'solaris',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 17,
    coreH: 12,
    parts: [
      { kind: 'box', x: -2.2, y: 0, z: 2.6, sx: 5.2, sy: 6.2, sz: 2.2, mat: 'gold', anim: 'bob' },
      { kind: 'box', x: -1.8, y: 0, z: 3.4, sx: 3.4, sy: 3.4, sz: 1.4, mat: 'team', anim: 'bob' },
      // Twin long forward golden lance-prongs
      { kind: 'seg', a: [0.4, -2.8, 2.6], b: [7.0, -2.6, 2.4], ra: 1.0, rb: 0.55, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0.4, 2.8, 2.6], b: [7.0, 2.6, 2.4], ra: 1.0, rb: 0.55, mat: 'gold', anim: 'bob' },
      { kind: 'ellipsoid', x: 7.2, y: -2.6, z: 2.4, rx: 0.9, ry: 0.8, rz: 0.8, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 7.2, y: 2.6, z: 2.4, rx: 0.9, ry: 0.8, rz: 0.8, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -5.6, y: 0, z: 2.6, rx: 1.4, ry: 1.4, rz: 1.2, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 7.6, y: 0, z: 2.4, rx: 1.5, ry: 2.8, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S14: Quad-Strider (Raider / AA — TWO-LAYER: 4 golden legs + independently swiveling cyan pulse-crown!)
  {
    id: 'S14',
    name: 'Quad-Strider',
    faction: 'solaris',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 16,
    coreH: 14,
    twoLayer: true,
    turretPivot: [0, 0, 4.4],
    parts: [
      { kind: 'seg', a: [2.2, -2.2, 4.2], b: [4.6, -4.6, 0.4], ra: 0.85, rb: 0.55, mat: 'gold', anim: 'legFL' },
      { kind: 'seg', a: [2.2, 2.2, 4.2], b: [4.6, 4.6, 0.4], ra: 0.85, rb: 0.55, mat: 'gold', anim: 'legFR' },
      { kind: 'seg', a: [-2.2, -2.2, 4.2], b: [-4.6, -4.6, 0.4], ra: 0.85, rb: 0.55, mat: 'gold', anim: 'legBL' },
      { kind: 'seg', a: [-2.2, 2.2, 4.2], b: [-4.6, 4.6, 0.4], ra: 0.85, rb: 0.55, mat: 'gold', anim: 'legBR' },
      { kind: 'box', x: 0, y: 0, z: 4.2, sx: 5.4, sy: 5.4, sz: 1.6, mat: 'bronze' },
    ],
    turretParts: [
      { kind: 'ellipsoid', x: 0, y: 0, z: 1.5, rx: 3.3, ry: 3.3, rz: 1.9, mat: 'gold' },
      { kind: 'box', x: -0.6, y: 0, z: 2.6, sx: 4.0, sy: 4.4, sz: 1.6, mat: 'team' },
      { kind: 'seg', a: [1.4, 0, 2.2], b: [6.0, 0, 2.5], ra: 1.05, rb: 0.75, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.4, y: 0, z: 2.5, rx: 1.6, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S15: Tri-Skimmer (Raider / AA — distinct 3-pronged star/Y-frame skimmer w/ forward cyan cannon!)
  {
    id: 'S15',
    name: 'Tri-Skimmer',
    faction: 'solaris',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 16,
    coreH: 13,
    parts: [
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.8, rx: 3.2, ry: 3.0, rz: 2.0, mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [0.4, -1.2, 3.0], b: [-6.4, -5.6, 3.2], c: [-2.4, -0.6, 2.8], mat: 'gold', anim: 'bob' },
      { kind: 'wing', a: [0.4, 1.2, 3.0], b: [-6.4, 5.6, 3.2], c: [-2.4, 0.6, 2.8], mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [1.4, 0, 3.0], b: [6.4, 0, 3.0], ra: 1.4, rb: 0.9, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.0, y: 0, z: 3.0, rx: 1.6, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S16: Colossus (Heavy Ground — UPGRADED TO TRUE 2-LAYER: tall 4 striding legs + tracking thermal-beam head!)
  {
    id: 'S16',
    name: 'Colossus',
    faction: 'solaris',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 18,
    coreH: 19,
    twoLayer: true,
    turretPivot: [0, 0, 10.6],
    parts: [
      { kind: 'seg', a: [1.6, -2.0, 10.4], b: [3.2, -5.4, 5.4], ra: 0.85, mat: 'gold', anim: 'legFL' },
      { kind: 'seg', a: [3.2, -5.4, 5.4], b: [3.6, -6.2, 0.5], ra: 0.75, rb: 0.5, mat: 'bronze', anim: 'legFL' },
      { kind: 'seg', a: [1.6, 2.0, 10.4], b: [3.2, 5.4, 5.4], ra: 0.85, mat: 'gold', anim: 'legFR' },
      { kind: 'seg', a: [3.2, 5.4, 5.4], b: [3.6, 6.2, 0.5], ra: 0.75, rb: 0.5, mat: 'bronze', anim: 'legFR' },
      { kind: 'seg', a: [-1.8, -2.0, 10.4], b: [-3.8, -5.2, 5.4], ra: 0.85, mat: 'gold', anim: 'legBL' },
      { kind: 'seg', a: [-3.8, -5.2, 5.4], b: [-4.2, -6.0, 0.5], ra: 0.75, rb: 0.5, mat: 'bronze', anim: 'legBL' },
      { kind: 'seg', a: [-1.8, 2.0, 10.4], b: [-3.8, 5.2, 5.4], ra: 0.85, mat: 'gold', anim: 'legBR' },
      { kind: 'seg', a: [-3.8, 5.2, 5.4], b: [-4.2, 6.0, 0.5], ra: 0.75, rb: 0.5, mat: 'bronze', anim: 'legBR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 10.2, rx: 3.0, ry: 3.0, rz: 1.4, mat: 'bronze' },
    ],
    turretParts: [
      { kind: 'ellipsoid', x: 0.2, y: 0, z: 1.8, rx: 4.8, ry: 3.8, rz: 2.2, mat: 'gold' },
      { kind: 'box', x: -0.8, y: 0, z: 3.2, sx: 4.4, sy: 4.6, sz: 1.8, mat: 'team' },
      { kind: 'seg', a: [2.2, 0, 1.8], b: [5.8, 0, 1.6], ra: 1.4, rb: 1.0, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'seg', a: [4.8, 0, 1.6], b: [8.0, 0, 0.2], ra: 1.1, rb: 0.7, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S17: Sun-Golem (Heavy Ground — TWO-LAYER: sculpted golden temple-golem w/ dorsal cyan power-spine & twin prism gauntlets!)
  {
    id: 'S17',
    name: 'Sun-Golem',
    faction: 'solaris',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 21,
    coreH: 21,
    twoLayer: true,
    turretPivot: [0, 0, 7.8],
    parts: [
      { kind: 'box', x: 0, y: -3.8, z: 4.0, sx: 3.2, sy: 2.8, sz: 6.4, mat: 'gold', detail: 'plate', anim: 'legFL' },
      { kind: 'box', x: 0.6, y: -3.8, z: 4.0, sx: 2.2, sy: 2.0, sz: 1.8, mat: 'bronze', anim: 'legFL' },
      { kind: 'box', x: 0.5, y: -3.8, z: 0.8, sx: 4.2, sy: 3.2, sz: 1.6, mat: 'bronze', anim: 'legFL' },
      { kind: 'box', x: 0, y: 3.8, z: 4.0, sx: 3.2, sy: 2.8, sz: 6.4, mat: 'gold', detail: 'plate', anim: 'legFR' },
      { kind: 'box', x: 0.6, y: 3.8, z: 4.0, sx: 2.2, sy: 2.0, sz: 1.8, mat: 'bronze', anim: 'legFR' },
      { kind: 'box', x: 0.5, y: 3.8, z: 0.8, sx: 4.2, sy: 3.2, sz: 1.6, mat: 'bronze', anim: 'legFR' },
      { kind: 'box', x: 0, y: 0, z: 7.4, sx: 4.6, sy: 7.0, sz: 2.2, mat: 'team', detail: 'plate' },
    ],
    turretParts: [
      { kind: 'box', x: 0, y: 0, z: 3.0, sx: 6.4, sy: 8.4, sz: 5.0, mat: 'gold', detail: 'plate' },
      { kind: 'box', x: 0.8, y: 0, z: 3.4, sx: 5.6, sy: 4.8, sz: 3.8, mat: 'team', detail: 'plate' },
      // Dorsal cyan power-spine + twin swept golden halo-wings on back (so N/NE/NW look epic!)
      { kind: 'box', x: -3.2, y: 0, z: 3.4, sx: 1.4, sy: 2.2, sz: 4.4, mat: 'cyan', glow: true },
      { kind: 'wing', a: [-2.4, -1.8, 4.8], b: [-4.6, -5.6, 8.6], c: [-3.4, -2.0, 2.2], mat: 'gold', thickness: 1.0 },
      { kind: 'wing', a: [-2.4, 1.8, 4.8], b: [-4.6, 5.6, 8.6], c: [-3.4, 2.0, 2.2], mat: 'gold', thickness: 1.0 },
      // Peaked crest-helm + glowing cyan chest core
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 6.5, rx: 2.3, ry: 2.3, rz: 2.0, mat: 'gold' },
      { kind: 'box', x: 2.6, y: 0, z: 6.4, sx: 0.9, sy: 2.0, sz: 0.9, mat: 'cyan', glow: true },
      { kind: 'ellipsoid', x: 3.4, y: 0, z: 3.4, rx: 1.3, ry: 1.5, rz: 1.5, mat: 'cyan', glow: true },
      // Stepped bronze shoulder joints + armored golden forearm prism-cannons
      { kind: 'box', x: 0.4, y: -5.4, z: 3.2, sx: 3.4, sy: 2.2, sz: 2.6, mat: 'bronze', anim: 'recoil' },
      { kind: 'box', x: 0.4, y: 5.4, z: 3.2, sx: 3.4, sy: 2.2, sz: 2.6, mat: 'bronze', anim: 'recoil' },
      { kind: 'box', x: 2.0, y: -5.6, z: 2.0, sx: 5.0, sy: 2.8, sz: 3.2, mat: 'gold', detail: 'plate', anim: 'recoil' },
      { kind: 'box', x: 2.0, y: 5.6, z: 2.0, sx: 5.0, sy: 2.8, sz: 3.2, mat: 'gold', detail: 'plate', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.2, y: -5.6, z: 2.0, rx: 1.8, ry: 1.4, rz: 1.5, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.2, y: 5.6, z: 2.0, rx: 1.8, ry: 1.4, rz: 1.5, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.8, y: -5.6, z: 2.0, rx: 1.8, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
      { kind: 'ellipsoid', x: 6.8, y: 5.6, z: 2.0, rx: 1.8, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S18: Obelisk-Barge (Heavy Ground — TWO-LAYER: sleek arrowhead hovering temple-barge + twin-rail cyan prism cannon!)
  {
    id: 'S18',
    name: 'Obelisk-Barge',
    faction: 'solaris',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 24,
    coreH: 18,
    twoLayer: true,
    turretPivot: [-1.0, 0, 4.6],
    parts: [
      // Sharp diamond/arrowhead hovering temple-barge hull (NOT a rubber duck!)
      { kind: 'wing', a: [9.4, 0, 3.0], b: [-5.4, -7.2, 2.8], c: [-7.4, 0, 2.8], mat: 'gold', thickness: 1.3, anim: 'bob' },
      { kind: 'wing', a: [9.4, 0, 3.0], b: [-5.4, 7.2, 2.8], c: [-7.4, 0, 2.8], mat: 'gold', thickness: 1.3, anim: 'bob' },
      { kind: 'box', x: -0.6, y: 0, z: 3.4, sx: 10.6, sy: 7.4, sz: 2.2, mat: 'bronze', detail: 'plate', anim: 'bob' },
      { kind: 'box', x: -0.4, y: 0, z: 4.0, sx: 8.6, sy: 6.2, sz: 1.4, mat: 'team', detail: 'plate', anim: 'bob' },
      // Glowing cyan levitation thrusters under prow & stern flanks
      { kind: 'ellipsoid', x: 6.6, y: 0, z: 2.0, rx: 1.6, ry: 1.4, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -5.4, y: -4.8, z: 2.0, rx: 1.4, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -5.4, y: 4.8, z: 2.0, rx: 1.4, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
    ],
    turretParts: [
      { kind: 'box', x: -0.8, y: 0, z: 1.6, sx: 6.4, sy: 5.2, sz: 2.8, mat: 'gold', detail: 'plate' },
      { kind: 'box', x: -1.6, y: 0, z: 3.0, sx: 4.4, sy: 5.6, sz: 1.6, mat: 'team', detail: 'plate' },
      { kind: 'seg', a: [1.6, -1.3, 2.0], b: [10.4, -1.0, 2.8], ra: 0.95, rb: 0.65, mat: 'gold', anim: 'recoil' },
      { kind: 'seg', a: [1.6, 1.3, 2.0], b: [10.4, 1.0, 2.8], ra: 0.95, rb: 0.65, mat: 'gold', anim: 'recoil' },
      { kind: 'seg', a: [1.0, 0, 2.2], b: [10.8, 0, 3.0], ra: 1.25, rb: 0.85, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 11.4, y: 0, z: 3.0, rx: 2.2, ry: 2.0, rz: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S19: Crescent-Dart (Light Air — tall swept vertical lunar-crescent needle-blade fighter!)
  {
    id: 'S19',
    name: 'Crescent-Dart',
    faction: 'solaris',
    role: 'Light Air',
    layer: 'air',
    coreW: 16,
    coreH: 15,
    parts: [
      { kind: 'ring', x: 1.4, y: 0, z: 4.4, r: 5.4, tube: 1.05, mat: 'gold', arc: [105, 255], anim: 'bob' },
      { kind: 'ring', x: 1.0, y: 0, z: 4.4, r: 4.8, tube: 0.7, mat: 'team', arc: [125, 235], anim: 'bob' },
      { kind: 'seg', a: [-4.0, 0, 4.4], b: [5.4, 0, 4.4], ra: 1.3, rb: 0.5, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.0, y: 0, z: 4.4, rx: 1.5, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S20: Sun-Scythe (Light Air — forked-tail fast golden interceptor!)
  {
    id: 'S20',
    name: 'Sun-Scythe',
    faction: 'solaris',
    role: 'Light Air',
    layer: 'air',
    coreW: 16,
    coreH: 14,
    parts: [
      { kind: 'wing', a: [6.4, 0, 4.2], b: [-5.8, -5.8, 4.2], c: [-1.4, 0, 4.2], mat: 'gold', thickness: 1.0, anim: 'bob' },
      { kind: 'wing', a: [6.4, 0, 4.2], b: [-5.8, 5.8, 4.2], c: [-1.4, 0, 4.2], mat: 'gold', thickness: 1.0, anim: 'bob' },
      { kind: 'wing', a: [3.2, 0, 4.8], b: [-3.4, -3.4, 4.6], c: [-1.2, 0, 4.6], mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [3.2, 0, 4.8], b: [-3.4, 3.4, 4.6], c: [-1.2, 0, 4.6], mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 1.6, y: 0, z: 4.8, rx: 2.2, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 7.0, y: 0, z: 4.2, rx: 1.5, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S21: Solar-Sloop (Light Air — sleek trimaran golden skiff w/ wide outrigger fins & tall glowing solar sail!)
  {
    id: 'S21',
    name: 'Solar-Sloop',
    faction: 'solaris',
    role: 'Light Air',
    layer: 'air',
    coreW: 18,
    coreH: 17,
    parts: [
      // Sleek central gun-keel + wide cantilevered twin trimaran outrigger blades (reads boldly on N/S too!)
      { kind: 'box', x: 0.4, y: 0, z: 3.6, sx: 11.4, sy: 3.0, sz: 2.0, mat: 'gold', detail: 'plate', anim: 'bob' },
      { kind: 'box', x: -1.6, y: 0, z: 3.6, sx: 2.0, sy: 10.4, sz: 1.0, mat: 'bronze', anim: 'bob' },
      { kind: 'seg', a: [-4.4, -5.2, 3.6], b: [3.2, -4.8, 3.6], ra: 0.95, rb: 0.5, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [-4.4, 5.2, 3.6], b: [3.2, 4.8, 3.6], ra: 0.95, rb: 0.5, mat: 'gold', anim: 'bob' },
      // Dramatic tall curved golden & royal-blue solar sail fin + cyan mast rib!
      { kind: 'wing', a: [4.2, 0, 4.4], b: [-2.6, 0, 12.2], c: [-4.6, 0, 4.2], mat: 'gold', thickness: 1.0, anim: 'bob' },
      { kind: 'wing', a: [2.0, 0, 4.8], b: [-2.0, 0, 10.2], c: [-3.4, 0, 4.6], mat: 'team', thickness: 1.2, anim: 'bob' },
      { kind: 'seg', a: [4.0, 0, 4.6], b: [-2.4, 0, 12.0], ra: 0.6, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 6.4, y: 0, z: 3.8, rx: 1.4, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -5.6, y: 0, z: 3.6, rx: 1.2, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 7.4, y: 0, z: 3.8, rx: 1.7, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S23: Solar-Ark (Heavy Air — dramatic split-hull golden catamaran w/ wide open central bay & floating solar prism sphere!)
  {
    id: 'S23',
    name: 'Solar-Ark',
    faction: 'solaris',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 25,
    coreH: 18,
    parts: [
      // Two razor-sharp golden catamaran hulls separated by a WIDE OPEN central channel (NOT a yellow brick!)
      { kind: 'box', x: 0.6, y: -5.0, z: 4.8, sx: 14.8, sy: 3.0, sz: 2.8, mat: 'gold', detail: 'plate', anim: 'bob' },
      { kind: 'box', x: 0.6, y: 5.0, z: 4.8, sx: 14.8, sy: 3.0, sz: 2.8, mat: 'gold', detail: 'plate', anim: 'bob' },
      { kind: 'seg', a: [6.4, -5.0, 4.8], b: [10.6, -4.4, 4.6], ra: 1.4, rb: 0.55, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [6.4, 5.0, 4.8], b: [10.6, 4.4, 4.6], ra: 1.4, rb: 0.55, mat: 'gold', anim: 'bob' },
      // Ornate royal-blue temple bridge deck spanning the stern + swept outer stabilizer fins
      { kind: 'box', x: -4.8, y: 0, z: 5.2, sx: 6.2, sy: 9.8, sz: 2.6, mat: 'team', detail: 'plate', anim: 'bob' },
      { kind: 'box', x: -4.6, y: 0, z: 6.8, sx: 4.4, sy: 5.6, sz: 1.6, mat: 'gold', detail: 'plate', anim: 'bob' },
      { kind: 'wing', a: [-2.2, -6.2, 5.0], b: [-7.6, -9.2, 5.6], c: [-7.8, -6.0, 4.8], mat: 'gold', thickness: 0.9, anim: 'bob' },
      { kind: 'wing', a: [-2.2, 6.2, 5.0], b: [-7.6, 9.2, 5.6], c: [-7.8, 6.0, 4.8], mat: 'gold', thickness: 0.9, anim: 'bob' },
      // Massive glowing cyan solar-prism sphere suspended inside the open central bow channel!
      { kind: 'ellipsoid', x: 3.6, y: 0, z: 5.0, rx: 3.2, ry: 3.0, rz: 2.6, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ring', x: 3.6, y: 0, z: 5.0, r: 3.8, tube: 0.65, mat: 'gold', anim: 'bob' },
      // Twin stern cyan drive jets
      { kind: 'ellipsoid', x: -8.2, y: -4.8, z: 4.8, rx: 1.4, ry: 1.2, rz: 1.1, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -8.2, y: 4.8, z: 4.8, rx: 1.4, ry: 1.2, rz: 1.1, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 10.4, y: 0, z: 5.0, rx: 2.4, ry: 2.4, rz: 2.0, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // S24: Astrolabe-Flagship (Heavy Air — monumental dreadnought: rear astrolabe ring + twin forward prows + super-beam!)
  {
    id: 'S24',
    name: 'Astrolabe-Flagship',
    faction: 'solaris',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 24,
    coreH: 17,
    parts: [
      { kind: 'ring', x: -3.4, y: 0, z: 4.8, r: 5.6, tube: 1.3, mat: 'gold', anim: 'bob' },
      { kind: 'ring', x: -3.4, y: 0, z: 5.4, r: 4.6, tube: 0.8, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: -3.4, y: 0, z: 4.8, rx: 3.4, ry: 3.4, rz: 2.0, mat: 'cyan', glow: true, anim: 'bob' },
      // Twin massive forward cathedral prows framing a central super-beam
      { kind: 'box', x: 4.2, y: -3.4, z: 4.8, sx: 10.4, sy: 2.4, sz: 2.6, mat: 'gold', anim: 'bob' },
      { kind: 'box', x: 4.2, y: 3.4, z: 4.8, sx: 10.4, sy: 2.4, sz: 2.6, mat: 'gold', anim: 'bob' },
      { kind: 'seg', a: [0.4, 0, 4.8], b: [9.2, 0, 4.8], ra: 1.2, rb: 0.9, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: -9.6, y: 0, z: 4.6, rx: 1.6, ry: 2.4, rz: 1.6, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 10.2, y: 0, z: 4.8, rx: 2.6, ry: 2.2, rz: 2.0, mat: 'muzzle', anim: 'muzzle' },
    ],
  },
];
