/**
 * Full 24-Unit Articulated 3D Micro-Pixel Rigs for KRAXEN (K01..K24).
 *
 * - K16 (Behemoth) reuses its verified 4-pass hand-authored 8-way sheet from titans.ts.
 * - K14 (Scorpion-Lash) & K17 (Artillery Beetle) are baked as true 2-layer split units.
 * - K18 (Bone-Centipede) exports articulated head + body + tail path-following segments.
 * - K01-K03 are tagged as workers.
 */

import type { RigPart, UnitRigSpec } from './voxel-baker.ts';

function insectLegs(spanX: number, spanY: number, zTop = 2.0, r = 0.55): readonly RigPart[] {
  return [
    { kind: 'seg', a: [spanX, -spanY * 0.5, zTop], b: [spanX + 0.8, -spanY, 0.3], ra: r, mat: 'chitin', anim: 'legFL' },
    { kind: 'seg', a: [spanX, spanY * 0.5, zTop], b: [spanX + 0.8, spanY, 0.3], ra: r, mat: 'chitin', anim: 'legFR' },
    { kind: 'seg', a: [-spanX, -spanY * 0.5, zTop], b: [-spanX - 0.8, -spanY, 0.3], ra: r, mat: 'chitin', anim: 'legBL' },
    { kind: 'seg', a: [-spanX, spanY * 0.5, zTop], b: [-spanX - 0.8, spanY, 0.3], ra: r, mat: 'chitin', anim: 'legBR' },
  ];
}

export const KRAXEN_RIGS: readonly UnitRigSpec[] = [
  // K01: Grub-Mite (Worker — open forward ivory pincers + ochre cargo sac + 4 legs)
  {
    id: 'K01',
    name: 'Grub-Mite',
    faction: 'kraxen',
    role: 'Worker',
    layer: 'ground',
    coreW: 13,
    coreH: 10,
    special: 'worker',
    parts: [
      ...insectLegs(1.4, 2.8, 1.8, 0.5),
      { kind: 'ellipsoid', x: -1.4, y: 0, z: 2.6, rx: 2.8, ry: 2.2, rz: 2.0, mat: 'ochre', anim: 'meleeBody' },
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 2.5, rx: 2.0, ry: 2.1, rz: 1.8, mat: 'team', anim: 'meleeBody' },
      { kind: 'seg', a: [2.0, -1.2, 2.2], b: [5.0, -2.0, 2.6], ra: 0.65, rb: 0.4, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [2.0, 1.2, 2.2], b: [5.0, 2.0, 2.6], ra: 0.65, rb: 0.4, mat: 'bone', anim: 'swingR' },
    ],
  },

  // K02: Tusk-Digger (Worker — broad curved ivory shovel-scoop + 4 splayed legs)
  {
    id: 'K02',
    name: 'Tusk-Digger',
    faction: 'kraxen',
    role: 'Worker',
    layer: 'ground',
    coreW: 14,
    coreH: 11,
    special: 'worker',
    parts: [
      ...insectLegs(1.5, 3.0, 1.9, 0.55),
      { kind: 'ellipsoid', x: -1.0, y: 0, z: 2.6, rx: 3.0, ry: 2.4, rz: 2.0, mat: 'team', anim: 'meleeBody' },
      { kind: 'wing', a: [1.6, 0, 2.0], b: [5.4, -2.6, 3.4], c: [5.4, 2.6, 3.4], mat: 'bone', anim: 'slam' },
    ],
  },

  // K03: Spore-Carrier (Worker — ribbed horned bio-jellyfish w/ 5 long dangling bone-tipped tentacles!)
  {
    id: 'K03',
    name: 'Spore-Carrier',
    faction: 'kraxen',
    role: 'Worker',
    layer: 'air',
    coreW: 15,
    coreH: 14,
    special: 'worker',
    parts: [
      { kind: 'ellipsoid', x: 0, y: 0, z: 8.2, rx: 3.6, ry: 3.4, rz: 2.4, mat: 'team', detail: 'rib', anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 9.8, rx: 2.4, ry: 2.4, rz: 1.2, mat: 'ochre', anim: 'bob' },
      { kind: 'seg', a: [1.4, -2.0, 9.2], b: [3.2, -3.4, 11.4], ra: 0.7, rb: 0.35, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [1.4, 2.0, 9.2], b: [3.2, 3.4, 11.4], ra: 0.7, rb: 0.35, mat: 'bone', anim: 'bob' },
      // 5 wide splayed dangling tentacles with clear air gaps
      { kind: 'seg', a: [1.6, -2.2, 6.6], b: [2.2, -3.2, 1.8], ra: 0.55, rb: 0.35, mat: 'flesh', anim: 'tail' },
      { kind: 'seg', a: [1.6, 2.2, 6.6], b: [2.2, 3.2, 1.8], ra: 0.55, rb: 0.35, mat: 'flesh', anim: 'tail' },
      { kind: 'seg', a: [-2.0, -1.8, 6.6], b: [-3.0, -2.6, 2.0], ra: 0.55, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [-2.0, 1.8, 6.6], b: [-3.0, 2.6, 2.0], ra: 0.55, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [0, 0, 6.2], b: [0.2, 0, 1.2], ra: 0.7, rb: 0.4, mat: 'bone', anim: 'tail' },
      { kind: 'ellipsoid', x: 3.8, y: 0, z: 6.4, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K04: Swarmling (Tier-1 Swarm — lean sprinting hound w/ streaming tail & snapping melee jaws)
  {
    id: 'K04',
    name: 'Swarmling',
    faction: 'kraxen',
    role: 'Tier-1 Swarm',
    layer: 'ground',
    coreW: 14,
    coreH: 11,
    parts: [
      ...insectLegs(2.0, 2.6, 2.0, 0.5),
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.5, rx: 3.0, ry: 1.8, rz: 1.6, mat: 'team', anim: 'meleeBody' },
      { kind: 'seg', a: [-2.4, 0, 2.4], b: [-5.4, 0, 3.4], ra: 0.7, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [2.0, -0.8, 2.4], b: [4.8, -1.2, 2.8], ra: 0.6, rb: 0.35, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [2.0, 0.8, 2.4], b: [4.8, 1.2, 2.8], ra: 0.6, rb: 0.35, mat: 'bone', anim: 'swingR' },
    ],
  },

  // K05: Mantis-Ripper (Tier-1 Swarm — tall twin raised ivory scythe claws w/ full synced melee rend!)
  {
    id: 'K05',
    name: 'Mantis-Ripper',
    faction: 'kraxen',
    role: 'Tier-1 Swarm',
    layer: 'ground',
    coreW: 15,
    coreH: 13,
    parts: [
      ...insectLegs(1.3, 2.8, 2.2, 0.5),
      { kind: 'ellipsoid', x: 0, y: 0, z: 3.4, rx: 1.8, ry: 2.0, rz: 2.2, mat: 'team', anim: 'meleeBody' },
      { kind: 'seg', a: [0.6, -1.8, 4.2], b: [3.2, -3.4, 7.6], ra: 0.75, rb: 0.45, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [0.6, 1.8, 4.2], b: [3.2, 3.4, 7.6], ra: 0.75, rb: 0.45, mat: 'bone', anim: 'swingR' },
    ],
  },

  // K06: Bile-Tick (Tier-1 Swarm — armored chitin cradle gripping pulsing acid-lime bomb sac + jaws!)
  {
    id: 'K06',
    name: 'Bile-Tick',
    faction: 'kraxen',
    role: 'Tier-1 Swarm',
    layer: 'ground',
    coreW: 15,
    coreH: 13,
    parts: [
      ...insectLegs(2.2, 3.8, 2.0, 0.55),
      { kind: 'seg', a: [0, -1.8, 2.0], b: [0, -4.0, 0.3], ra: 0.55, mat: 'chitin', anim: 'legML' },
      { kind: 'seg', a: [0, 1.8, 2.0], b: [0, 4.0, 0.3], ra: 0.55, mat: 'chitin', anim: 'legMR' },
      // Pulsing neon-lime volatile sac cradled inside dark chitin & magenta armor ribs
      { kind: 'ellipsoid', x: -1.4, y: 0, z: 4.8, rx: 3.6, ry: 3.1, rz: 3.1, mat: 'acid', glow: true },
      { kind: 'ring', x: -1.4, y: 0, z: 3.8, r: 3.3, tube: 0.85, mat: 'chitin' },
      { kind: 'seg', a: [-1.4, -3.2, 3.8], b: [-1.4, 3.2, 7.2], ra: 0.65, mat: 'team' },
      // Armored beetle head + snapping bone mandibles in front
      { kind: 'ellipsoid', x: 2.4, y: 0, z: 2.6, rx: 2.2, ry: 2.4, rz: 1.7, mat: 'team' },
      { kind: 'seg', a: [3.6, -1.2, 2.4], b: [5.8, -1.8, 2.8], ra: 0.65, rb: 0.35, mat: 'bone' },
      { kind: 'seg', a: [3.6, 1.2, 2.4], b: [5.8, 1.8, 2.8], ra: 0.65, rb: 0.35, mat: 'bone' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 4.8, rx: 4.8, ry: 4.4, rz: 4.0, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K07: Stalker (Ranged — distinct hunched spitter w/ elongated glowing acid snout)
  {
    id: 'K07',
    name: 'Stalker',
    faction: 'kraxen',
    role: 'Ranged',
    layer: 'ground',
    coreW: 13,
    coreH: 10,
    parts: [
      ...insectLegs(1.8, 2.8, 2.2, 0.55),
      { kind: 'ellipsoid', x: -0.6, y: 0, z: 3.2, rx: 2.6, ry: 2.2, rz: 2.0, mat: 'team' },
      { kind: 'seg', a: [1.0, 0, 3.6], b: [4.8, 0, 3.8], ra: 1.0, rb: 0.65, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.0, y: 0, z: 3.8, rx: 0.9, ry: 0.9, rz: 0.9, mat: 'acid', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 0, z: 3.8, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K08: Quill-Fiend (Ranged — 5 radiating dorsal ivory spine-quills over splayed legs!)
  {
    id: 'K08',
    name: 'Quill-Fiend',
    faction: 'kraxen',
    role: 'Ranged',
    layer: 'ground',
    coreW: 13,
    coreH: 11,
    parts: [
      ...insectLegs(1.8, 3.0, 2.0, 0.55),
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.8, rx: 3.2, ry: 2.6, rz: 2.0, mat: 'team' },
      { kind: 'seg', a: [0.8, 0, 4.0], b: [3.6, 0, 7.2], ra: 0.65, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [-0.8, -1.6, 3.8], b: [-2.4, -3.4, 7.0], ra: 0.65, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [-0.8, 1.6, 3.8], b: [-2.4, 3.4, 7.0], ra: 0.65, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [1.2, -1.4, 3.6], b: [4.0, -2.6, 5.8], ra: 0.6, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [1.2, 1.4, 3.6], b: [4.0, 2.6, 5.8], ra: 0.6, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 4.8, y: 0, z: 6.2, rx: 1.6, ry: 1.6, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K09: Venom-Cobra (Ranged — muscular coiled hydralisk/cobra w/ wide bone-rimmed hood & spitting jaws!)
  {
    id: 'K09',
    name: 'Venom-Cobra',
    faction: 'kraxen',
    role: 'Ranged',
    layer: 'ground',
    coreW: 16,
    coreH: 15,
    parts: [
      // Coiled sinuous chitin tail base + rear sweeping tail tip
      { kind: 'ring', x: -1.0, y: 0, z: 1.3, r: 3.2, tube: 1.2, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [-3.4, -1.2, 1.4], b: [-6.4, -2.4, 2.2], ra: 1.0, rb: 0.4, mat: 'chitin', anim: 'tail' },
      // Muscular arched S-neck
      { kind: 'seg', a: [-1.4, 0, 2.0], b: [-0.4, 0, 6.2], ra: 1.5, rb: 1.3, mat: 'flesh', detail: 'rib' },
      { kind: 'seg', a: [-0.4, 0, 6.2], b: [1.4, 0, 8.8], ra: 1.3, rb: 1.1, mat: 'flesh' },
      // Wide dramatic bone-spined cobra hood
      { kind: 'wing', a: [1.2, 0, 9.6], b: [-1.2, -4.6, 8.0], c: [-0.4, -1.0, 5.2], mat: 'team', thickness: 0.9 },
      { kind: 'wing', a: [1.2, 0, 9.6], b: [-1.2, 4.6, 8.0], c: [-0.4, 1.0, 5.2], mat: 'team', thickness: 0.9 },
      { kind: 'seg', a: [1.2, 0, 9.8], b: [-1.4, -4.8, 8.2], ra: 0.65, mat: 'bone' },
      { kind: 'seg', a: [1.2, 0, 9.8], b: [-1.4, 4.8, 8.2], ra: 0.65, mat: 'bone' },
      // Projecting horned head + glowing acid fangs
      { kind: 'seg', a: [1.4, 0, 8.8], b: [5.4, 0, 8.6], ra: 1.2, rb: 0.7, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.6, y: 0, z: 8.6, rx: 1.1, ry: 1.1, rz: 1.0, mat: 'acid', glow: true },
      { kind: 'ellipsoid', x: 6.8, y: 0, z: 8.6, rx: 1.6, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K10: Spore-Mantis (Specialist — slender tall mantis raising TWO glowing lime spore lanterns!)
  {
    id: 'K10',
    name: 'Spore-Mantis',
    faction: 'kraxen',
    role: 'Specialist',
    layer: 'ground',
    coreW: 14,
    coreH: 14,
    parts: [
      ...insectLegs(1.4, 3.2, 2.6, 0.55),
      { kind: 'seg', a: [0, 0, 2.4], b: [0.2, 0, 6.8], ra: 1.5, rb: 1.2, mat: 'team', detail: 'rib' },
      { kind: 'seg', a: [0.4, -1.4, 5.8], b: [1.4, -4.2, 9.2], ra: 0.7, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [0.4, 1.4, 5.8], b: [1.4, 4.2, 9.2], ra: 0.7, mat: 'bone', anim: 'bob' },
      { kind: 'ellipsoid', x: 1.6, y: -4.4, z: 9.6, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'acid', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 1.6, y: 4.4, z: 9.6, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'acid', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 2.2, y: 0, z: 9.8, rx: 2.2, ry: 3.4, rz: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K11: Leech-Weaver (Specialist — fierce dragonfly-wasp parasite w/ double bone-ribbed wings & long curved stinger!)
  {
    id: 'K11',
    name: 'Leech-Weaver',
    faction: 'kraxen',
    role: 'Specialist',
    layer: 'air',
    coreW: 17,
    coreH: 15,
    parts: [
      // Elongated curved dark-chitin wasp body + glowing acid abdomen tip
      { kind: 'ellipsoid', x: 1.2, y: 0, z: 6.8, rx: 3.4, ry: 2.1, rz: 1.9, mat: 'team', detail: 'rib', anim: 'bob' },
      { kind: 'seg', a: [-1.4, 0, 6.4], b: [-6.0, 0, 4.8], ra: 1.4, rb: 0.65, mat: 'chitin', anim: 'tail' },
      { kind: 'ellipsoid', x: -6.2, y: 0, z: 4.6, rx: 1.1, ry: 0.9, rz: 0.9, mat: 'acid', glow: true, anim: 'tail' },
      // Wide double-pair dragonfly wings (front + rear)
      { kind: 'wing', a: [2.2, 0, 7.2], b: [-0.8, -7.2, 8.6], c: [-1.8, -1.2, 7.0], mat: 'bone', anim: 'wingL' },
      { kind: 'wing', a: [2.2, 0, 7.2], b: [-0.8, 7.2, 8.6], c: [-1.8, 1.2, 7.0], mat: 'bone', anim: 'wingR' },
      { kind: 'wing', a: [-0.6, 0, 6.8], b: [-4.6, -5.4, 7.6], c: [-3.8, -0.8, 6.6], mat: 'team', anim: 'wingL' },
      { kind: 'wing', a: [-0.6, 0, 6.8], b: [-4.6, 5.4, 7.6], c: [-3.8, 0.8, 6.6], mat: 'team', anim: 'wingR' },
      // Long sharp downward-forward acid proboscis needle
      { kind: 'seg', a: [2.4, 0, 5.8], b: [4.6, 0, 1.4], ra: 0.8, rb: 0.35, mat: 'acid', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 4.8, y: 0, z: 1.2, rx: 1.5, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K12: Burrow-Lurker (Specialist — low 6-legged crab w/ 3 huge forward-angled ivory spear-spines!)
  {
    id: 'K12',
    name: 'Burrow-Lurker',
    faction: 'kraxen',
    role: 'Specialist',
    layer: 'ground',
    coreW: 16,
    coreH: 13,
    parts: [
      ...insectLegs(2.6, 4.4, 2.0, 0.65),
      { kind: 'seg', a: [0, -2.0, 2.0], b: [0, -4.8, 0.3], ra: 0.65, mat: 'chitin', anim: 'legML' },
      { kind: 'seg', a: [0, 2.0, 2.0], b: [0, 4.8, 0.3], ra: 0.65, mat: 'chitin', anim: 'legMR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.5, rx: 4.5, ry: 3.5, rz: 1.9, mat: 'team', detail: 'rib' },
      { kind: 'seg', a: [0, 0, 3.2], b: [5.6, 0, 7.0], ra: 0.95, rb: 0.4, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [-1.2, -1.8, 3.0], b: [3.8, -3.0, 6.6], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [-1.2, 1.8, 3.0], b: [3.8, 3.0, 6.6], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.2, y: 0, z: 6.8, rx: 1.8, ry: 1.8, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K13: Scarab Roller (Raider / AA — heavily ribbed rhinoceros-scarab beetle w/ massive curved horn & cheek tusks!)
  {
    id: 'K13',
    name: 'Scarab Roller',
    faction: 'kraxen',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 18,
    coreH: 14,
    parts: [
      ...insectLegs(2.8, 5.0, 2.2, 0.7),
      { kind: 'seg', a: [0, -2.4, 2.2], b: [0, -5.2, 0.3], ra: 0.7, mat: 'chitin', anim: 'legML' },
      { kind: 'seg', a: [0, 2.4, 2.2], b: [0, 5.2, 0.3], ra: 0.7, mat: 'chitin', anim: 'legMR' },
      // Ribbed armored carapace plates (chitin base + magenta ribbed plates + bone ridge!)
      { kind: 'ellipsoid', x: -0.8, y: 0, z: 3.4, rx: 5.2, ry: 4.2, rz: 2.8, mat: 'chitin', detail: 'rib', anim: 'meleeBody' },
      { kind: 'ellipsoid', x: -1.4, y: 0, z: 4.4, rx: 4.2, ry: 3.4, rz: 2.2, mat: 'team', detail: 'rib', anim: 'meleeBody' },
      { kind: 'ring', x: -0.8, y: 0, z: 4.4, r: 4.4, tube: 0.75, mat: 'bone', arc: [-80, 80], anim: 'meleeBody' },
      // Massive upturned ivory rhino-horn + twin cheek tusks
      { kind: 'seg', a: [3.4, 0, 2.8], b: [7.6, 0, 5.6], ra: 1.15, rb: 0.45, mat: 'bone', anim: 'slam' },
      { kind: 'seg', a: [3.2, -2.0, 2.6], b: [6.0, -3.2, 3.2], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [3.2, 2.0, 2.6], b: [6.0, 3.2, 3.2], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'swingR' },
    ],
  },

  // K14: Scorpion-Lash (Raider / AA — TWO-LAYER: scurrying 6-leg body + independently arcing venom tail!)
  {
    id: 'K14',
    name: 'Scorpion-Lash',
    faction: 'kraxen',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 18,
    coreH: 15,
    twoLayer: true,
    turretPivot: [-2.4, 0, 3.0],
    parts: [
      ...insectLegs(2.6, 4.2, 2.0, 0.6),
      { kind: 'seg', a: [0, -2.0, 2.0], b: [0, -4.6, 0.3], ra: 0.55, mat: 'chitin', anim: 'legML' },
      { kind: 'seg', a: [0, 2.0, 2.0], b: [0, 4.6, 0.3], ra: 0.55, mat: 'chitin', anim: 'legMR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.6, rx: 4.6, ry: 3.2, rz: 2.0, mat: 'team' },
      // Twin front bone pincers
      { kind: 'seg', a: [3.2, -1.6, 2.4], b: [6.8, -3.0, 2.6], ra: 0.85, rb: 0.45, mat: 'bone' },
      { kind: 'seg', a: [3.2, 1.6, 2.4], b: [6.8, 3.0, 2.6], ra: 0.85, rb: 0.45, mat: 'bone' },
    ],
    turretParts: [
      // Towering arched scorpion tail + sharp dripping neon-lime stinger aiming along turretDir!
      { kind: 'seg', a: [-0.8, 0, 0.4], b: [-2.8, 0, 5.2], ra: 1.15, rb: 0.9, mat: 'chitin', anim: 'recoil' },
      { kind: 'seg', a: [-2.8, 0, 5.2], b: [1.8, 0, 7.6], ra: 0.95, rb: 0.8, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [1.8, 0, 7.6], b: [5.4, 0, 6.4], ra: 0.85, rb: 0.4, mat: 'acid', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.0, y: 0, z: 6.2, rx: 1.6, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K15: Sail-Hound (Raider / AA — long stretched full-sprint shark-fin pack hunter!)
  {
    id: 'K15',
    name: 'Sail-Hound',
    faction: 'kraxen',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 18,
    coreH: 13,
    parts: [
      { kind: 'seg', a: [3.2, -1.6, 2.4], b: [6.2, -2.4, 0.3], ra: 0.65, mat: 'chitin', anim: 'legFL' },
      { kind: 'seg', a: [3.2, 1.6, 2.4], b: [6.2, 2.4, 0.3], ra: 0.65, mat: 'chitin', anim: 'legFR' },
      { kind: 'seg', a: [-3.4, -1.6, 2.4], b: [-6.4, -2.4, 0.3], ra: 0.65, mat: 'chitin', anim: 'legBL' },
      { kind: 'seg', a: [-3.4, 1.6, 2.4], b: [-6.4, 2.4, 0.3], ra: 0.65, mat: 'chitin', anim: 'legBR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 2.8, rx: 4.8, ry: 2.0, rz: 1.6, mat: 'chitin', anim: 'meleeBody' },
      // Tall shark-fin dorsal bio-sail
      { kind: 'wing', a: [2.6, 0, 3.6], b: [-1.0, 0, 8.2], c: [-4.0, 0, 3.4], mat: 'team', thickness: 0.9, anim: 'meleeBody' },
      { kind: 'seg', a: [-1.0, 0, 8.2], b: [2.6, 0, 3.6], ra: 0.6, mat: 'bone', anim: 'meleeBody' },
      { kind: 'seg', a: [-4.4, 0, 2.8], b: [-7.4, 0, 4.0], ra: 0.7, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [4.2, 0, 3.0], b: [7.2, 0, 3.2], ra: 0.9, rb: 0.45, mat: 'bone', anim: 'swingR' },
    ],
  },

  // K17: Artillery Beetle (Heavy Ground — TWO-LAYER: 6-leg heavy beetle + elevating acid-mortar sac!)
  {
    id: 'K17',
    name: 'Artillery Beetle',
    faction: 'kraxen',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 20,
    coreH: 18,
    twoLayer: true,
    turretPivot: [-0.6, 0, 4.8],
    parts: [
      ...insectLegs(3.6, 6.2, 2.6, 0.95),
      { kind: 'seg', a: [0, -3.2, 2.6], b: [0, -6.6, 0.5], ra: 0.95, mat: 'chitin', anim: 'legML' },
      { kind: 'seg', a: [0, 3.2, 2.6], b: [0, 6.6, 0.5], ra: 0.95, mat: 'chitin', anim: 'legMR' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 3.6, rx: 6.4, ry: 5.4, rz: 3.0, mat: 'team' },
      { kind: 'seg', a: [5.4, -1.6, 2.8], b: [8.2, -2.0, 3.2], ra: 0.9, rb: 0.45, mat: 'bone' },
      { kind: 'seg', a: [5.4, 1.6, 2.8], b: [8.2, 2.0, 3.2], ra: 0.9, rb: 0.45, mat: 'bone' },
    ],
    turretParts: [
      { kind: 'ellipsoid', x: -0.6, y: 0, z: 1.6, rx: 4.4, ry: 4.0, rz: 3.0, mat: 'acid', glow: true, anim: 'recoil' },
      { kind: 'seg', a: [0.4, 0, 2.6], b: [4.8, 0, 6.4], ra: 1.8, rb: 1.3, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.0, y: 0, z: 6.6, rx: 1.4, ry: 1.4, rz: 1.4, mat: 'acid', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 0, z: 7.4, rx: 2.2, ry: 2.2, rz: 2.0, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K18: Bone-Centipede (Heavy Ground — MULTI-SEGMENT: wide serrated dread-centipede head w/ giant open bone jaws!)
  {
    id: 'K18',
    name: 'Bone-Centipede',
    faction: 'kraxen',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 22,
    coreH: 17,
    special: 'centipede',
    parts: [
      // Dread-Head: broad flattened chitin headshield + massive curved pincer mandibles + swept feelers!
      ...insectLegs(2.6, 5.4, 2.2, 0.8),
      { kind: 'seg', a: [-2.4, -2.4, 2.2], b: [-3.4, -5.8, 0.4], ra: 0.8, mat: 'chitin', anim: 'legBL' },
      { kind: 'seg', a: [-2.4, 2.4, 2.2], b: [-3.4, 5.8, 0.4], ra: 0.8, mat: 'chitin', anim: 'legBR' },
      { kind: 'ellipsoid', x: -1.6, y: 0, z: 3.4, rx: 4.8, ry: 4.0, rz: 2.6, mat: 'chitin', detail: 'rib' },
      { kind: 'ellipsoid', x: 0.8, y: 0, z: 4.4, rx: 4.2, ry: 4.4, rz: 2.4, mat: 'team', detail: 'rib' },
      // Swept bone head-crest horns
      { kind: 'seg', a: [-0.4, -3.2, 5.4], b: [-4.6, -5.8, 7.6], ra: 0.9, rb: 0.4, mat: 'bone' },
      { kind: 'seg', a: [-0.4, 3.2, 5.4], b: [-4.6, 5.8, 7.6], ra: 0.9, rb: 0.4, mat: 'bone' },
      // Huge curved caliper pincer-jaws snapping forward & inward!
      { kind: 'seg', a: [3.6, -2.4, 3.4], b: [7.6, -4.4, 3.6], ra: 1.05, rb: 0.7, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [7.6, -4.4, 3.6], b: [9.8, -1.8, 3.8], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'swingL' },
      { kind: 'seg', a: [3.6, 2.4, 3.4], b: [7.6, 4.4, 3.6], ra: 1.05, rb: 0.7, mat: 'bone', anim: 'swingR' },
      { kind: 'seg', a: [7.6, 4.4, 3.6], b: [9.8, 1.8, 3.8], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'swingR' },
      { kind: 'ellipsoid', x: 4.2, y: -1.4, z: 5.0, rx: 1.0, ry: 0.9, rz: 0.9, mat: 'acid', glow: true, anim: 'meleeBody' },
      { kind: 'ellipsoid', x: 4.2, y: 1.4, z: 5.0, rx: 1.0, ry: 0.9, rz: 0.9, mat: 'acid', glow: true, anim: 'meleeBody' },
    ],
    bodyParts: [
      ...insectLegs(2.2, 5.0, 2.0, 0.75),
      { kind: 'ellipsoid', x: 0, y: 0, z: 3.2, rx: 4.2, ry: 3.6, rz: 2.6, mat: 'team', detail: 'rib' },
      { kind: 'ring', x: 0, y: 0, z: 3.8, r: 3.4, tube: 0.75, mat: 'bone', vertical: true, arc: [-60, 240] },
    ],
    tailParts: [
      { kind: 'seg', a: [2.8, 0, 2.4], b: [-6.4, 0, 4.4], ra: 2.2, rb: 0.5, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [-3.8, 0, 3.8], b: [-7.2, 0, 6.0], ra: 0.9, rb: 0.4, mat: 'bone', anim: 'tail' },
    ],
  },

  // K19: Bio-Wyvern (Light Air — horizontal winged wyvern w/ pointed snout & whip tail)
  {
    id: 'K19',
    name: 'Bio-Wyvern',
    faction: 'kraxen',
    role: 'Light Air',
    layer: 'air',
    coreW: 18,
    coreH: 14,
    parts: [
      { kind: 'ellipsoid', x: 0.4, y: 0, z: 4.2, rx: 3.8, ry: 1.8, rz: 1.6, mat: 'chitin', anim: 'bob' },
      { kind: 'wing', a: [2.0, 0, 4.4], b: [-1.2, -7.0, 5.4], c: [-3.6, -1.0, 4.2], mat: 'team', anim: 'wingL' },
      { kind: 'wing', a: [2.0, 0, 4.4], b: [-1.2, 7.0, 5.4], c: [-3.6, 1.0, 4.2], mat: 'team', anim: 'wingR' },
      { kind: 'seg', a: [2.0, 0, 4.6], b: [-1.2, -7.2, 5.6], ra: 0.6, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [2.0, 0, 4.6], b: [-1.2, 7.2, 5.6], ra: 0.6, mat: 'bone', anim: 'wingR' },
      { kind: 'seg', a: [-3.0, 0, 4.2], b: [-7.4, 0, 4.6], ra: 0.75, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'seg', a: [3.4, 0, 4.4], b: [6.8, 0, 4.6], ra: 1.0, rb: 0.5, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.0, y: 0, z: 4.6, rx: 0.9, ry: 0.9, rz: 0.9, mat: 'acid', glow: true },
      { kind: 'ellipsoid', x: 7.6, y: 0, z: 4.6, rx: 1.5, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K20: Locust-Wasp (Light Air — transverse winged dart w/ glowing lime abdomen)
  {
    id: 'K20',
    name: 'Locust-Wasp',
    faction: 'kraxen',
    role: 'Light Air',
    layer: 'air',
    coreW: 16,
    coreH: 14,
    parts: [
      { kind: 'ellipsoid', x: -3.2, y: 0, z: 4.2, rx: 2.2, ry: 1.6, rz: 1.5, mat: 'acid', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 1.0, y: 0, z: 4.2, rx: 3.4, ry: 1.8, rz: 1.6, mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [2.2, 0, 4.6], b: [-1.4, -6.2, 5.4], c: [-2.4, -0.8, 4.4], mat: 'bone', anim: 'wingL' },
      { kind: 'wing', a: [2.2, 0, 4.6], b: [-1.4, 6.2, 5.4], c: [-2.4, 0.8, 4.4], mat: 'bone', anim: 'wingR' },
      { kind: 'seg', a: [3.4, 0, 4.2], b: [6.2, 0, 4.2], ra: 0.85, rb: 0.35, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.6, y: 0, z: 4.2, rx: 1.4, ry: 1.1, rz: 1.1, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K21: Sickle-Swallow (Light Air — forward-swept sickle wings + deep forked tail!)
  {
    id: 'K21',
    name: 'Sickle-Swallow',
    faction: 'kraxen',
    role: 'Light Air',
    layer: 'air',
    coreW: 18,
    coreH: 14,
    parts: [
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 4.2, rx: 4.0, ry: 1.6, rz: 1.4, mat: 'chitin', anim: 'bob' },
      { kind: 'wing', a: [-1.0, 0, 4.4], b: [4.6, -6.6, 5.0], c: [2.2, -1.0, 4.4], mat: 'team', anim: 'wingL' },
      { kind: 'wing', a: [-1.0, 0, 4.4], b: [4.6, 6.6, 5.0], c: [2.2, 1.0, 4.4], mat: 'team', anim: 'wingR' },
      { kind: 'seg', a: [2.2, -1.0, 4.6], b: [4.8, -6.8, 5.2], ra: 0.6, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [2.2, 1.0, 4.6], b: [4.8, 6.8, 5.2], ra: 0.6, mat: 'bone', anim: 'wingR' },
      // Deep forked tail left
      { kind: 'seg', a: [-2.8, -0.6, 4.2], b: [-7.2, -3.2, 4.6], ra: 0.65, rb: 0.35, mat: 'bone', anim: 'tail' },
      { kind: 'seg', a: [-2.8, 0.6, 4.2], b: [-7.2, 3.2, 4.6], ra: 0.65, rb: 0.35, mat: 'bone', anim: 'tail' },
      { kind: 'ellipsoid', x: 5.4, y: 0, z: 4.4, rx: 1.5, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K22: Brood-Manta (Heavy Air — organic swept crescent sky-manta w/ scalloped wings, dorsal bone spine, cephalic horns & whip tail!)
  {
    id: 'K22',
    name: 'Brood-Manta',
    faction: 'kraxen',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 24,
    coreH: 19,
    parts: [
      // Muscular dark-chitin central fuselage & dorsal bone ridge
      { kind: 'ellipsoid', x: 0.2, y: 0, z: 5.0, rx: 5.6, ry: 2.8, rz: 2.2, mat: 'chitin', detail: 'rib', anim: 'bob' },
      { kind: 'ellipsoid', x: 0.6, y: 0, z: 6.2, rx: 3.6, ry: 1.8, rz: 1.4, mat: 'ochre', detail: 'rib', anim: 'bob' },
      // Swept crescent manta wings (deep scalloped trailing cutout — NOT a flat diamond!)
      { kind: 'wing', a: [5.4, -1.4, 5.0], b: [-2.6, -10.2, 6.2], c: [-2.2, -1.6, 4.8], mat: 'team', thickness: 1.0, anim: 'wingL' },
      { kind: 'wing', a: [5.4, 1.4, 5.0], b: [-2.6, 10.2, 6.2], c: [-2.2, 1.6, 4.8], mat: 'team', thickness: 1.0, anim: 'wingR' },
      { kind: 'seg', a: [5.4, -1.4, 5.3], b: [-2.6, -10.4, 6.4], ra: 0.9, rb: 0.45, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [5.4, 1.4, 5.3], b: [-2.6, 10.4, 6.4], ra: 0.9, rb: 0.45, mat: 'bone', anim: 'wingR' },
      // Mid-wing bone ribs for organic texture
      { kind: 'seg', a: [1.8, -1.4, 5.2], b: [-2.8, -7.0, 5.8], ra: 0.55, rb: 0.35, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [1.8, 1.4, 5.2], b: [-2.8, 7.0, 5.8], ra: 0.55, rb: 0.35, mat: 'bone', anim: 'wingR' },
      // Twin forward cephalic horn-lobes framing glowing acid maw
      { kind: 'seg', a: [4.6, -2.0, 5.0], b: [9.2, -3.2, 5.2], ra: 0.95, rb: 0.45, mat: 'bone', anim: 'recoil' },
      { kind: 'seg', a: [4.6, 2.0, 5.0], b: [9.2, 3.2, 5.2], ra: 0.95, rb: 0.45, mat: 'bone', anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.2, y: 0, z: 5.0, rx: 1.5, ry: 1.4, rz: 1.2, mat: 'acid', glow: true, anim: 'bob' },
      // Long barbed whip-tail trailing aft
      { kind: 'seg', a: [-4.6, 0, 4.8], b: [-10.8, 0, 5.4], ra: 1.0, rb: 0.35, mat: 'chitin', anim: 'tail' },
      { kind: 'ellipsoid', x: 9.8, y: 0, z: 5.0, rx: 2.0, ry: 2.0, rz: 1.6, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K23: Hive-Zeppelin (Heavy Air — menacing ribbed Overlord bio-carrier w/ 4 armored bone-horns & hanging brood sacs!)
  {
    id: 'K23',
    name: 'Hive-Zeppelin',
    faction: 'kraxen',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 23,
    coreH: 19,
    parts: [
      // Deeply ribbed chitin & magenta gas carapace dome (sculpted bio-hull, NOT a cupcake!)
      { kind: 'ellipsoid', x: -0.6, y: 0, z: 8.2, rx: 7.2, ry: 6.0, rz: 3.4, mat: 'chitin', detail: 'rib', anim: 'bob' },
      { kind: 'ellipsoid', x: 0.0, y: 0, z: 9.4, rx: 6.4, ry: 5.4, rz: 3.0, mat: 'team', detail: 'rib', anim: 'bob' },
      { kind: 'ellipsoid', x: 0.8, y: 0, z: 11.4, rx: 2.8, ry: 2.4, rz: 1.4, mat: 'ochre', anim: 'bob' },
      // 4 dramatic outward-swept bone carapace horns + dorsal spine ridge
      { kind: 'seg', a: [3.2, -4.4, 8.8], b: [7.8, -6.8, 10.6], ra: 1.1, rb: 0.45, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [3.2, 4.4, 8.8], b: [7.8, 6.8, 10.6], ra: 1.1, rb: 0.45, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [-3.8, -4.8, 8.6], b: [-7.8, -7.2, 9.8], ra: 1.0, rb: 0.45, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [-3.8, 4.8, 8.6], b: [-7.8, 7.2, 9.8], ra: 1.0, rb: 0.45, mat: 'bone', anim: 'bob' },
      // Glowing ventral brood-core + dark fleshy hanging egg pods & bone-barbed tentacles!
      { kind: 'ellipsoid', x: 3.8, y: 0, z: 7.2, rx: 2.2, ry: 2.4, rz: 1.6, mat: 'acid', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -2.0, y: -2.6, z: 5.0, rx: 1.8, ry: 1.6, rz: 2.0, mat: 'ochre', anim: 'bob' },
      { kind: 'ellipsoid', x: -2.0, y: 2.6, z: 5.0, rx: 1.8, ry: 1.6, rz: 2.0, mat: 'ochre', anim: 'bob' },
      { kind: 'seg', a: [2.4, -3.4, 6.0], b: [3.4, -4.6, 1.4], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'tail' },
      { kind: 'seg', a: [2.4, 3.4, 6.0], b: [3.4, 4.6, 1.4], ra: 0.75, rb: 0.35, mat: 'bone', anim: 'tail' },
      { kind: 'seg', a: [-3.6, -2.6, 5.4], b: [-5.0, -3.4, 1.2], ra: 0.75, rb: 0.35, mat: 'flesh', anim: 'tail' },
      { kind: 'seg', a: [-3.6, 2.6, 5.4], b: [-5.0, 3.4, 1.2], ra: 0.75, rb: 0.35, mat: 'flesh', anim: 'tail' },
      { kind: 'seg', a: [0, 0, 5.4], b: [-0.4, 0, 1.0], ra: 0.85, rb: 0.4, mat: 'bone', anim: 'tail' },
      { kind: 'ellipsoid', x: 5.6, y: 0, z: 6.4, rx: 2.4, ry: 2.4, rz: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // K24: Leviathan-Wyrm (Heavy Air — massive connected horned sky-dragon apex flyer!)
  {
    id: 'K24',
    name: 'Leviathan-Wyrm',
    faction: 'kraxen',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 24,
    coreH: 17,
    parts: [
      { kind: 'ellipsoid', x: -1.2, y: 0, z: 4.8, rx: 5.4, ry: 2.8, rz: 2.4, mat: 'chitin', anim: 'bob' },
      { kind: 'wing', a: [2.2, 0, 5.2], b: [-2.8, -9.2, 6.4], c: [-6.4, -1.2, 4.8], mat: 'team', thickness: 1.1, anim: 'wingL' },
      { kind: 'wing', a: [2.2, 0, 5.2], b: [-2.8, 9.2, 6.4], c: [-6.4, 1.2, 4.8], mat: 'team', thickness: 1.1, anim: 'wingR' },
      { kind: 'seg', a: [2.2, 0, 5.4], b: [-2.8, -9.4, 6.6], ra: 0.85, mat: 'bone', anim: 'wingL' },
      { kind: 'seg', a: [2.2, 0, 5.4], b: [-2.8, 9.4, 6.6], ra: 0.85, mat: 'bone', anim: 'wingR' },
      // Thick armored neck -> massive horned skull head!
      { kind: 'seg', a: [2.6, 0, 5.0], b: [7.6, 0, 5.8], ra: 2.0, rb: 1.6, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 8.2, y: 0, z: 5.8, rx: 2.6, ry: 2.4, rz: 2.2, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [7.6, -1.8, 7.0], b: [5.4, -3.8, 8.6], ra: 0.75, rb: 0.4, mat: 'bone', anim: 'bob' },
      { kind: 'seg', a: [7.6, 1.8, 7.0], b: [5.4, 3.8, 8.6], ra: 0.75, rb: 0.4, mat: 'bone', anim: 'bob' },
      { kind: 'ellipsoid', x: 9.8, y: 0, z: 5.4, rx: 1.2, ry: 1.2, rz: 1.2, mat: 'acid', glow: true },
      { kind: 'seg', a: [-5.6, 0, 4.6], b: [-10.6, 0, 5.2], ra: 1.1, rb: 0.4, mat: 'chitin', anim: 'tail' },
      { kind: 'ellipsoid', x: 10.6, y: 0, z: 5.4, rx: 2.2, ry: 1.8, rz: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },
];
