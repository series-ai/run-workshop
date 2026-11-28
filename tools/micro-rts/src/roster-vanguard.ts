/**
 * Full 24-Unit Articulated 3D Micro-Pixel Rigs for VANGUARD (V01..V24).
 *
 * - V16 (Siege Tank) and V22 (Valkyrie) reuse their verified hand-authored 8-way sheets
 *   from tankIso.ts and titans.ts.
 * - V12, V13, V14, V17, V18 are baked as true 2-layer independent hull + turret sheets.
 * - V20 exports a 2-frame spinning rotor overlay; V01-V03 are tagged as workers.
 */

import type { RigPart, UnitRigSpec } from './voxel-baker.ts';

function bipedBase(legH = 2.8, spread = 1.65, width = 1.15): readonly RigPart[] {
  return [
    // Wide heroic boot stance with clear negative-space gap between legs
    { kind: 'seg', a: [0.1, -spread, legH], b: [0.4, -spread, 0.4], ra: width * 0.6, mat: 'darkSteel', anim: 'legFL' },
    { kind: 'box', x: 0.6, y: -spread, z: 0.4, sx: 1.6, sy: 1.2, sz: 0.9, mat: 'darkSteel', anim: 'legFL' },
    { kind: 'seg', a: [-0.1, spread, legH], b: [-0.3, spread, 0.4], ra: width * 0.6, mat: 'darkSteel', anim: 'legFR' },
    { kind: 'box', x: -0.1, y: spread, z: 0.4, sx: 1.6, sy: 1.2, sz: 0.9, mat: 'darkSteel', anim: 'legFR' },
    // Dark tactical belt separating legs from torso
    { kind: 'box', x: 0, y: 0, z: legH + 0.3, sx: 2.6, sy: 3.4, sz: 0.9, mat: 'darkSteel' },
    // Broad cobalt chestplate + sculpted silver shoulder pauldrons
    { kind: 'box', x: 0, y: 0, z: legH + 1.8, sx: 3.0, sy: 3.8, sz: 2.4, mat: 'team' },
    { kind: 'ellipsoid', x: 0, y: -2.2, z: legH + 2.4, rx: 1.35, ry: 1.15, rz: 1.1, mat: 'steel' },
    { kind: 'ellipsoid', x: 0, y: 2.2, z: legH + 2.4, rx: 1.35, ry: 1.15, rz: 1.1, mat: 'steel' },
    // Crisp helmet dome + bright amber wrap-around visor
    { kind: 'ellipsoid', x: 0.1, y: 0, z: legH + 3.9, rx: 1.65, ry: 1.65, rz: 1.4, mat: 'steel' },
    { kind: 'box', x: 1.35, y: 0, z: legH + 3.9, sx: 0.9, sy: 2.0, sz: 0.9, mat: 'amber', glow: true },
  ];
}

export const VANGUARD_RIGS: readonly UnitRigSpec[] = [
  // V01: Rig-Bot (Worker — tracked chassis + projecting pincer crane arm)
  {
    id: 'V01',
    name: 'Rig-Bot',
    faction: 'vanguard',
    role: 'Worker',
    layer: 'ground',
    coreW: 12,
    coreH: 10,
    special: 'worker',
    parts: [
      { kind: 'box', x: 0, y: -2.0, z: 0.9, sx: 5.0, sy: 1.3, sz: 1.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: 0, y: 2.0, z: 0.9, sx: 5.0, sy: 1.3, sz: 1.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: -0.2, y: 0, z: 2.6, sx: 4.2, sy: 3.6, sz: 2.4, mat: 'team', anim: 'meleeBody' },
      { kind: 'ellipsoid', x: -0.3, y: 0, z: 4.1, rx: 1.8, ry: 1.8, rz: 1.2, mat: 'steel', anim: 'meleeBody' },
      { kind: 'seg', a: [1.5, -1.2, 3.0], b: [4.2, -1.5, 4.0], ra: 0.65, mat: 'steel', anim: 'swingL' },
      { kind: 'seg', a: [1.5, 1.2, 2.8], b: [4.2, 1.5, 2.2], ra: 0.65, mat: 'steel', anim: 'swingR' },
      { kind: 'box', x: 4.5, y: -1.5, z: 4.1, sx: 1.1, sy: 1.0, sz: 1.0, mat: 'amber', glow: true, anim: 'swingL' },
      { kind: 'box', x: 4.5, y: 1.5, z: 2.2, sx: 1.1, sy: 1.0, sz: 1.0, mat: 'amber', glow: true, anim: 'swingR' },
    ],
  },

  // V02: Hover-Mule (Worker — industrial dark-chassis hover-barge w/ 4 corner thrusters, cab & tall crystal cluster!)
  {
    id: 'V02',
    name: 'Hover-Mule',
    faction: 'vanguard',
    role: 'Worker',
    layer: 'ground',
    coreW: 16,
    coreH: 13,
    special: 'worker',
    parts: [
      // Dark flatbed chassis + 4 projecting corner thruster pods
      { kind: 'box', x: -0.4, y: 0, z: 2.2, sx: 8.6, sy: 5.0, sz: 1.6, mat: 'darkSteel', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: -4.2, y: -3.2, z: 2.0, sx: 2.2, sy: 1.8, sz: 1.4, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: -4.2, y: 3.2, z: 2.0, sx: 2.2, sy: 1.8, sz: 1.4, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: 3.4, y: -3.2, z: 2.0, sx: 2.2, sy: 1.8, sz: 1.4, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: 3.4, y: 3.2, z: 2.0, sx: 2.2, sy: 1.8, sz: 1.4, mat: 'steel', anim: 'bob' },
      { kind: 'ellipsoid', x: -4.2, y: -3.2, z: 1.0, rx: 0.9, ry: 0.9, rz: 0.7, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -4.2, y: 3.2, z: 1.0, rx: 0.9, ry: 0.9, rz: 0.7, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 3.4, y: -3.2, z: 1.0, rx: 0.9, ry: 0.9, rz: 0.7, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 3.4, y: 3.2, z: 1.0, rx: 0.9, ry: 0.9, rz: 0.7, mat: 'cyan', glow: true, anim: 'bob' },
      // Forward cobalt cab + amber windshield
      { kind: 'box', x: 3.2, y: 0, z: 3.6, sx: 2.8, sy: 3.8, sz: 2.0, mat: 'team', anim: 'bob' },
      { kind: 'box', x: 4.4, y: 0, z: 3.8, sx: 0.9, sy: 2.6, sz: 1.0, mat: 'amber', glow: true, anim: 'bob' },
      // Tall jagged cyan mineral cargo strapped in rear flatbed
      { kind: 'seg', a: [-1.4, 0, 2.8], b: [-1.8, 0, 7.6], ra: 1.35, rb: 0.45, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [-2.8, -1.4, 2.8], b: [-3.4, -2.0, 6.2], ra: 1.0, rb: 0.35, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [-2.4, 1.4, 2.8], b: [-2.8, 2.0, 5.8], ra: 0.95, rb: 0.35, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 5.4, y: 0, z: 3.4, rx: 1.3, ry: 1.2, rz: 1.1, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V03: Exo-Engi (Worker — bulky backpack welder w/ projecting plasma weld torch)
  {
    id: 'V03',
    name: 'Exo-Engi',
    faction: 'vanguard',
    role: 'Worker',
    layer: 'ground',
    coreW: 14,
    coreH: 12,
    special: 'worker',
    parts: [
      ...bipedBase(2.6, 1.6, 1.2),
      { kind: 'box', x: -2.0, y: 0, z: 4.4, sx: 2.0, sy: 3.0, sz: 3.0, mat: 'darkSteel', detail: 'panel' },
      { kind: 'seg', a: [1.0, 1.8, 4.0], b: [4.8, 1.4, 4.0], ra: 0.7, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.2, y: 1.4, z: 4.0, rx: 1.2, ry: 1.2, rz: 1.2, mat: 'amber', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 1.4, z: 4.0, rx: 1.6, ry: 1.5, rz: 1.5, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V04: Trooper (Tier-1 Line — chunky armored space-marine w/ bold projecting assault rifle!)
  {
    id: 'V04',
    name: 'Trooper',
    faction: 'vanguard',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 14,
    coreH: 12,
    parts: [
      ...bipedBase(2.7, 1.6, 1.15),
      { kind: 'box', x: -1.6, y: 0, z: 4.4, sx: 1.4, sy: 2.6, sz: 2.2, mat: 'darkSteel' },
      { kind: 'seg', a: [0.6, 1.6, 4.0], b: [5.4, 1.2, 4.1], ra: 0.75, rb: 0.55, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'seg', a: [1.6, 1.5, 4.3], b: [4.4, 1.3, 4.4], ra: 0.45, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 1.2, z: 4.1, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V05: Breacher (Tier-1 Line — marine + clearly detached angled cobalt riot shield w/ viewport slit!)
  {
    id: 'V05',
    name: 'Breacher',
    faction: 'vanguard',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 15,
    coreH: 12,
    parts: [
      ...bipedBase(2.6, 1.6, 1.15),
      // Detached heavy ballistic shield clearly separated from torso
      { kind: 'box', x: 3.8, y: -0.6, z: 3.8, sx: 1.3, sy: 4.6, sz: 6.2, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'box', x: 4.2, y: -0.6, z: 3.8, sx: 0.9, sy: 3.6, sz: 5.0, mat: 'team', anim: 'recoil' },
      { kind: 'box', x: 4.5, y: -0.6, z: 5.2, sx: 0.8, sy: 2.4, sz: 1.0, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'seg', a: [1.0, 2.0, 4.0], b: [5.0, 2.0, 4.1], ra: 0.65, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.6, y: 2.0, z: 4.1, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V06: Drop-Scout (Tier-1 Line — swept rear jump-pack w/ twin orange jets + sprint stride)
  {
    id: 'V06',
    name: 'Drop-Scout',
    faction: 'vanguard',
    role: 'Tier-1 Line',
    layer: 'ground',
    coreW: 15,
    coreH: 12,
    parts: [
      ...bipedBase(2.8, 1.7, 1.1),
      { kind: 'seg', a: [-1.2, -1.4, 4.8], b: [-4.4, -2.6, 6.2], ra: 0.85, rb: 0.5, mat: 'steel' },
      { kind: 'seg', a: [-1.2, 1.4, 4.8], b: [-4.4, 2.6, 6.2], ra: 0.85, rb: 0.5, mat: 'steel' },
      { kind: 'ellipsoid', x: -4.8, y: -2.2, z: 4.6, rx: 1.2, ry: 1.0, rz: 1.2, mat: 'amber', glow: true },
      { kind: 'ellipsoid', x: -4.8, y: 2.2, z: 4.6, rx: 1.2, ry: 1.0, rz: 1.2, mat: 'amber', glow: true },
      { kind: 'seg', a: [1.0, 1.5, 4.0], b: [4.8, 1.2, 4.0], ra: 0.6, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.4, y: 1.2, z: 4.0, rx: 1.3, ry: 1.1, rz: 1.1, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V07: Heavy (Ranged — chunky exo-trooper w/ unmistakable over-the-shoulder rocket launcher tube!)
  {
    id: 'V07',
    name: 'Heavy',
    faction: 'vanguard',
    role: 'Ranged',
    layer: 'ground',
    coreW: 15,
    coreH: 12,
    parts: [
      ...bipedBase(2.6, 1.75, 1.25),
      { kind: 'seg', a: [-4.2, 1.8, 6.0], b: [5.0, 1.8, 6.2], ra: 1.2, rb: 1.1, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'box', x: 0.2, y: 1.8, z: 6.1, sx: 3.4, sy: 2.2, sz: 2.2, mat: 'steel', anim: 'recoil' },
      { kind: 'box', x: 5.4, y: 1.8, z: 6.2, sx: 1.0, sy: 1.3, sz: 1.3, mat: 'amber', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.0, y: 1.8, z: 6.2, rx: 1.8, ry: 1.6, rz: 1.6, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V08: Rail-Sniper (Ranged — dark recon cloak + ultra-long glowing cyan railgun projecting far forward!)
  {
    id: 'V08',
    name: 'Rail-Sniper',
    faction: 'vanguard',
    role: 'Ranged',
    layer: 'ground',
    coreW: 16,
    coreH: 12,
    parts: [
      ...bipedBase(2.6, 1.6, 1.05),
      // Flowing dark recon cape behind back
      { kind: 'wing', a: [-1.0, 0, 5.6], b: [-4.8, -2.0, 1.8], c: [-4.8, 2.0, 1.8], mat: 'darkSteel', anim: 'tail' },
      // Ultra-long sniper railgun + cyan coils
      { kind: 'seg', a: [-0.8, 1.4, 4.2], b: [6.8, 1.2, 4.3], ra: 0.75, rb: 0.55, mat: 'steel', anim: 'recoil' },
      { kind: 'seg', a: [3.4, 1.3, 4.6], b: [6.9, 1.2, 4.6], ra: 0.5, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 7.2, y: 1.2, z: 4.3, rx: 1.5, ry: 1.2, rz: 1.2, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // V09: Flamer-Exo (Ranged — massive orange twin fuel tanks + heavy flamethrower nozzle)
  {
    id: 'V09',
    name: 'Flamer-Exo',
    faction: 'vanguard',
    role: 'Ranged',
    layer: 'ground',
    coreW: 15,
    coreH: 12,
    parts: [
      ...bipedBase(2.6, 1.75, 1.25),
      { kind: 'ellipsoid', x: -2.6, y: -1.1, z: 4.8, rx: 1.6, ry: 1.3, rz: 2.2, mat: 'amber', glow: true },
      { kind: 'ellipsoid', x: -2.6, y: 1.1, z: 4.8, rx: 1.6, ry: 1.3, rz: 2.2, mat: 'amber', glow: true },
      { kind: 'seg', a: [0.8, 1.6, 3.8], b: [5.0, 1.4, 3.8], ra: 0.85, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.5, y: 1.4, z: 3.9, rx: 1.2, ry: 1.1, rz: 1.2, mat: 'amber', glow: true },
      { kind: 'seg', a: [5.4, 1.4, 3.9], b: [7.0, 1.4, 4.1], ra: 1.2, rb: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V10: Field Medic (Specialist — white-and-cobalt medic + clearly detached hovering cyan med-cross drone!)
  {
    id: 'V10',
    name: 'Field Medic',
    faction: 'vanguard',
    role: 'Specialist',
    layer: 'ground',
    coreW: 15,
    coreH: 13,
    parts: [
      { kind: 'seg', a: [0.1, -1.6, 2.7], b: [0.3, -1.6, 0.4], ra: 0.65, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [-0.1, 1.6, 2.7], b: [-0.3, 1.6, 0.4], ra: 0.65, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'box', x: 0, y: 0, z: 3.1, sx: 2.6, sy: 3.4, sz: 0.9, mat: 'darkSteel' },
      { kind: 'box', x: 0, y: 0, z: 4.5, sx: 3.0, sy: 4.0, sz: 2.5, mat: 'steel' },
      { kind: 'box', x: 0.9, y: 0, z: 4.6, sx: 1.6, sy: 2.4, sz: 1.8, mat: 'team' },
      { kind: 'ellipsoid', x: 0.1, y: 0, z: 6.5, rx: 1.65, ry: 1.65, rz: 1.4, mat: 'steel' },
      { kind: 'box', x: 1.3, y: 0, z: 6.5, sx: 0.8, sy: 1.8, sz: 0.8, mat: 'cyan', glow: true },
      // Forward healing emitter wand
      { kind: 'seg', a: [1.0, -1.6, 4.2], b: [4.6, -1.4, 4.4], ra: 0.6, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.0, y: -1.4, z: 4.4, rx: 1.1, ry: 1.1, rz: 1.1, mat: 'cyan', glow: true },
      // Detached floating med-drone pod over right shoulder with crisp compact cyan cross!
      { kind: 'ellipsoid', x: -1.4, y: 2.4, z: 7.0, rx: 1.2, ry: 1.2, rz: 1.0, mat: 'team', anim: 'bob' },
      { kind: 'seg', a: [-1.4, 2.4, 6.8], b: [-1.4, 2.4, 10.0], ra: 0.55, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [-1.4, 1.1, 8.4], b: [-1.4, 3.7, 8.4], ra: 0.55, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [-2.6, 2.4, 8.4], b: [-0.2, 2.4, 8.4], ra: 0.55, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 5.4, y: -1.4, z: 4.4, rx: 1.8, ry: 1.8, rz: 1.8, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // V11: Aegis Drone (Specialist — sleek X-frame 4-pylon floating shield generator around dark ring & cyan orb!)
  {
    id: 'V11',
    name: 'Aegis Drone',
    faction: 'vanguard',
    role: 'Specialist',
    layer: 'air',
    coreW: 16,
    coreH: 14,
    parts: [
      // Dark mechanical collar + glowing cyan shield core
      { kind: 'ring', x: 0, y: 0, z: 5.2, r: 3.4, tube: 0.85, mat: 'darkSteel', anim: 'bob' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 5.4, rx: 2.1, ry: 2.1, rz: 2.2, mat: 'cyan', glow: true, anim: 'bob' },
      // 4 sharp cantilevered cobalt-and-steel projector pylons (unmistakable X-silhouette!)
      { kind: 'seg', a: [2.2, -2.2, 5.2], b: [5.4, -4.8, 6.2], ra: 0.9, rb: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'seg', a: [2.2, 2.2, 5.2], b: [5.4, 4.8, 6.2], ra: 0.9, rb: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'seg', a: [-2.2, -2.2, 5.2], b: [-5.4, -4.8, 6.2], ra: 0.9, rb: 0.55, mat: 'team', anim: 'bob' },
      { kind: 'seg', a: [-2.2, 2.2, 5.2], b: [-5.4, 4.8, 6.2], ra: 0.9, rb: 0.55, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 5.6, y: -4.9, z: 6.3, rx: 0.9, ry: 0.9, rz: 0.9, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 5.6, y: 4.9, z: 6.3, rx: 0.9, ry: 0.9, rz: 0.9, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ring', x: 0, y: 0, z: 5.4, r: 5.6, tube: 0.65, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // V12: Mortar-Rig (Specialist — TWO-LAYER: armored 3-spade tripod + heavy rifled 45-deg mortar tube!)
  {
    id: 'V12',
    name: 'Mortar-Rig',
    faction: 'vanguard',
    role: 'Specialist',
    layer: 'ground',
    coreW: 16,
    coreH: 15,
    twoLayer: true,
    turretPivot: [0, 0, 3.0],
    parts: [
      { kind: 'seg', a: [0, 0, 3.0], b: [4.6, 0, 0.5], ra: 0.85, mat: 'darkSteel' },
      { kind: 'box', x: 4.8, y: 0, z: 0.5, sx: 1.6, sy: 2.0, sz: 1.0, mat: 'steel' },
      { kind: 'seg', a: [0, 0, 3.0], b: [-3.4, -4.0, 0.5], ra: 0.85, mat: 'darkSteel' },
      { kind: 'box', x: -3.6, y: -4.2, z: 0.5, sx: 1.6, sy: 1.8, sz: 1.0, mat: 'steel' },
      { kind: 'seg', a: [0, 0, 3.0], b: [-3.4, 4.0, 0.5], ra: 0.85, mat: 'darkSteel' },
      { kind: 'box', x: -3.6, y: 4.2, z: 0.5, sx: 1.6, sy: 1.8, sz: 1.0, mat: 'steel' },
      { kind: 'ellipsoid', x: 0, y: 0, z: 3.0, rx: 2.8, ry: 2.8, rz: 1.5, mat: 'team' },
    ],
    turretParts: [
      { kind: 'box', x: -1.0, y: 0, z: 1.2, sx: 3.4, sy: 3.2, sz: 2.2, mat: 'team', detail: 'panel' },
      { kind: 'box', x: -2.2, y: 0, z: 1.6, sx: 1.4, sy: 2.6, sz: 1.4, mat: 'darkSteel' },
      { kind: 'seg', a: [-0.8, 0, 1.4], b: [5.4, 0, 7.2], ra: 1.45, rb: 1.25, mat: 'steel', anim: 'recoil' },
      { kind: 'ring', x: 4.4, y: 0, z: 6.2, r: 1.35, tube: 0.55, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 0, z: 7.6, rx: 1.8, ry: 1.8, rz: 1.8, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V13: Flak Halftrack (Raider / AA — TWO-LAYER: sharp angular armored halftrack + long twin rotary AA cannons!)
  {
    id: 'V13',
    name: 'Flak Halftrack',
    faction: 'vanguard',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 19,
    coreH: 16,
    twoLayer: true,
    turretPivot: [-1.4, 0, 4.0],
    parts: [
      // Distinct separated rear treads + front armored wheel pods
      { kind: 'box', x: -2.8, y: -3.8, z: 1.3, sx: 6.0, sy: 1.7, sz: 2.2, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: -2.8, y: 3.8, z: 1.3, sx: 6.0, sy: 1.7, sz: 2.2, mat: 'darkSteel', anim: 'tread' },
      { kind: 'ellipsoid', x: 4.0, y: -3.6, z: 1.3, rx: 1.6, ry: 1.2, rz: 1.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'ellipsoid', x: 4.0, y: 3.6, z: 1.3, rx: 1.6, ry: 1.2, rz: 1.6, mat: 'darkSteel', anim: 'tread' },
      // Angular paneled lower hull + sloped cobalt forward cab + amber visor
      { kind: 'box', x: -0.2, y: 0, z: 2.8, sx: 11.4, sy: 5.4, sz: 2.2, mat: 'steel', detail: 'panel' },
      { kind: 'box', x: 3.4, y: 0, z: 4.2, sx: 3.8, sy: 4.8, sz: 2.0, mat: 'team', detail: 'panel' },
      { kind: 'box', x: 5.4, y: 0, z: 4.0, sx: 1.0, sy: 3.4, sz: 1.0, mat: 'amber', glow: true },
      { kind: 'box', x: -5.6, y: 0, z: 3.0, sx: 1.2, sy: 4.2, sz: 1.6, mat: 'darkSteel' },
    ],
    turretParts: [
      { kind: 'box', x: -0.4, y: 0, z: 1.2, sx: 4.4, sy: 4.4, sz: 2.2, mat: 'team', detail: 'panel' },
      { kind: 'box', x: -2.4, y: 0, z: 1.8, sx: 1.6, sy: 3.6, sz: 1.6, mat: 'darkSteel' },
      { kind: 'seg', a: [1.0, -1.4, 1.6], b: [7.6, -1.4, 4.4], ra: 0.75, rb: 0.55, mat: 'steel', anim: 'recoil' },
      { kind: 'seg', a: [1.0, 1.4, 1.6], b: [7.6, 1.4, 4.4], ra: 0.75, rb: 0.55, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 8.0, y: -1.4, z: 4.6, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
      { kind: 'ellipsoid', x: 8.0, y: 1.4, z: 4.6, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V14: Strider Mech (Raider / AA — TWO-LAYER: crisp chicken-walker legs + armored scout cockpit & twin cannons!)
  {
    id: 'V14',
    name: 'Strider Mech',
    faction: 'vanguard',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 17,
    coreH: 18,
    twoLayer: true,
    turretPivot: [0, 0, 6.8],
    parts: [
      // Left reverse-joint chicken leg with dark knee cap
      { kind: 'seg', a: [0, -2.7, 6.6], b: [-1.8, -3.0, 3.6], ra: 0.95, mat: 'steel', anim: 'legFL' },
      { kind: 'box', x: -1.8, y: -3.0, z: 3.6, sx: 1.8, sy: 1.8, sz: 1.6, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [-1.8, -3.0, 3.6], b: [0.8, -3.2, 0.7], ra: 0.85, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'box', x: 1.1, y: -3.2, z: 0.6, sx: 3.2, sy: 2.2, sz: 1.1, mat: 'team', anim: 'legFL' },
      // Right reverse-joint chicken leg
      { kind: 'seg', a: [0, 2.7, 6.6], b: [-1.8, 3.0, 3.6], ra: 0.95, mat: 'steel', anim: 'legFR' },
      { kind: 'box', x: -1.8, y: 3.0, z: 3.6, sx: 1.8, sy: 1.8, sz: 1.6, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'seg', a: [-1.8, 3.0, 3.6], b: [0.8, 3.2, 0.7], ra: 0.85, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'box', x: 1.1, y: 3.2, z: 0.6, sx: 3.2, sy: 2.2, sz: 1.1, mat: 'team', anim: 'legFR' },
      { kind: 'box', x: 0, y: 0, z: 6.4, sx: 3.8, sy: 5.0, sz: 1.8, mat: 'darkSteel' },
    ],
    turretParts: [
      { kind: 'box', x: 0.4, y: 0, z: 2.2, sx: 5.8, sy: 5.2, sz: 3.8, mat: 'steel', detail: 'panel' },
      { kind: 'box', x: 0.2, y: 0, z: 4.0, sx: 4.8, sy: 4.4, sz: 1.6, mat: 'team' },
      { kind: 'box', x: -2.8, y: 0, z: 2.4, sx: 1.6, sy: 3.8, sz: 2.6, mat: 'darkSteel' },
      { kind: 'box', x: 3.4, y: 0, z: 2.5, sx: 1.0, sy: 3.0, sz: 1.2, mat: 'amber', glow: true },
      { kind: 'seg', a: [0.8, -3.5, 1.8], b: [6.4, -3.5, 1.8], ra: 0.8, rb: 0.6, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'seg', a: [0.8, 3.5, 1.8], b: [6.4, 3.5, 1.8], ra: 0.8, rb: 0.6, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'box', x: 1.2, y: -3.5, z: 2.0, sx: 2.4, sy: 1.6, sz: 1.6, mat: 'steel', anim: 'recoil' },
      { kind: 'box', x: 1.2, y: 3.5, z: 2.0, sx: 2.4, sy: 1.6, sz: 1.6, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 6.8, y: -3.5, z: 1.8, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
      { kind: 'ellipsoid', x: 6.8, y: 3.5, z: 1.8, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V15: Hover-Trike (Raider / AA — dramatic V-forked starfighter hover-bike w/ wide stabilizer blades!)
  {
    id: 'V15',
    name: 'Hover-Trike',
    faction: 'vanguard',
    role: 'Raider / AA',
    layer: 'ground',
    coreW: 19,
    coreH: 14,
    parts: [
      // Dark central engine chassis + cobalt side intake wings
      { kind: 'box', x: -1.6, y: 0, z: 2.4, sx: 6.8, sy: 3.6, sz: 2.0, mat: 'darkSteel', detail: 'panel', anim: 'bob' },
      { kind: 'wing', a: [0.2, -1.6, 2.6], b: [-4.6, -5.2, 2.4], c: [-4.8, -1.6, 2.4], mat: 'team', thickness: 0.9, anim: 'bob' },
      { kind: 'wing', a: [0.2, 1.6, 2.6], b: [-4.6, 5.2, 2.4], c: [-4.8, 1.6, 2.4], mat: 'team', thickness: 0.9, anim: 'bob' },
      // Wide open V-forked forward stabilizer prongs (clear negative-space nose gap!)
      { kind: 'seg', a: [1.2, -1.8, 2.4], b: [7.6, -2.6, 2.2], ra: 0.95, rb: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'seg', a: [1.2, 1.8, 2.4], b: [7.6, 2.6, 2.2], ra: 0.95, rb: 0.55, mat: 'steel', anim: 'bob' },
      // Armored rider + bright amber windscreen
      { kind: 'ellipsoid', x: -0.8, y: 0, z: 4.5, rx: 1.9, ry: 1.7, rz: 1.6, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: 0.8, y: 0, z: 4.4, sx: 1.0, sy: 2.0, sz: 1.0, mat: 'amber', glow: true, anim: 'bob' },
      // Twin glowing cyan rear jets
      { kind: 'ellipsoid', x: -5.4, y: -2.2, z: 2.4, rx: 1.4, ry: 1.0, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -5.4, y: 2.2, z: 2.4, rx: 1.4, ry: 1.0, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 8.0, y: 0, z: 2.2, rx: 1.6, ry: 2.4, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V17: Goliath Walker (Heavy Ground — TWO-LAYER: heavy bipedal legs + detailed twin-missile upper torso!)
  {
    id: 'V17',
    name: 'Goliath Walker',
    faction: 'vanguard',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 21,
    coreH: 21,
    twoLayer: true,
    turretPivot: [0, 0, 8.0],
    parts: [
      { kind: 'seg', a: [0, -3.6, 7.8], b: [-0.8, -4.2, 4.2], ra: 1.3, mat: 'steel', anim: 'legFL' },
      { kind: 'box', x: -0.6, y: -4.2, z: 4.2, sx: 2.2, sy: 2.2, sz: 1.8, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [-0.8, -4.2, 4.2], b: [0.6, -4.4, 0.8], ra: 1.25, mat: 'team', anim: 'legFL' },
      { kind: 'box', x: 0.9, y: -4.4, z: 0.7, sx: 4.0, sy: 2.8, sz: 1.4, mat: 'darkSteel', anim: 'legFL' },
      { kind: 'seg', a: [0, 3.6, 7.8], b: [-0.8, 4.2, 4.2], ra: 1.3, mat: 'steel', anim: 'legFR' },
      { kind: 'box', x: -0.6, y: 4.2, z: 4.2, sx: 2.2, sy: 2.2, sz: 1.8, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'seg', a: [-0.8, 4.2, 4.2], b: [0.6, 4.4, 0.8], ra: 1.25, mat: 'team', anim: 'legFR' },
      { kind: 'box', x: 0.9, y: 4.4, z: 0.7, sx: 4.0, sy: 2.8, sz: 1.4, mat: 'darkSteel', anim: 'legFR' },
      { kind: 'box', x: 0, y: 0, z: 7.5, sx: 4.8, sy: 6.8, sz: 2.2, mat: 'darkSteel', detail: 'panel' },
    ],
    turretParts: [
      { kind: 'box', x: 0, y: 0, z: 2.8, sx: 6.8, sy: 6.8, sz: 4.8, mat: 'team', detail: 'panel' },
      { kind: 'box', x: -3.2, y: 0, z: 3.0, sx: 1.8, sy: 5.0, sz: 3.6, mat: 'darkSteel' },
      { kind: 'box', x: 0.4, y: 0, z: 5.2, sx: 4.6, sy: 4.4, sz: 2.2, mat: 'steel', detail: 'panel' },
      { kind: 'box', x: 2.8, y: 0, z: 5.0, sx: 1.0, sy: 2.8, sz: 1.1, mat: 'amber', glow: true },
      // High twin shoulder missile pods with recessed dark vents
      { kind: 'box', x: -0.6, y: -5.0, z: 5.8, sx: 4.0, sy: 3.0, sz: 3.4, mat: 'steel', detail: 'panel', anim: 'recoil' },
      { kind: 'box', x: 1.4, y: -5.0, z: 6.0, sx: 1.0, sy: 2.0, sz: 2.0, mat: 'amber', glow: true, anim: 'recoil' },
      { kind: 'box', x: -0.6, y: 5.0, z: 5.8, sx: 4.0, sy: 3.0, sz: 3.4, mat: 'steel', detail: 'panel', anim: 'recoil' },
      { kind: 'box', x: 1.4, y: 5.0, z: 6.0, sx: 1.0, sy: 2.0, sz: 2.0, mat: 'amber', glow: true, anim: 'recoil' },
      // Twin arm cannons with dark receivers + steel barrels
      { kind: 'box', x: 0.4, y: -4.8, z: 2.2, sx: 3.6, sy: 2.0, sz: 2.2, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'box', x: 0.4, y: 4.8, z: 2.2, sx: 3.6, sy: 2.0, sz: 2.2, mat: 'darkSteel', anim: 'recoil' },
      { kind: 'seg', a: [1.6, -4.8, 2.2], b: [7.4, -4.8, 2.2], ra: 0.95, rb: 0.75, mat: 'steel', anim: 'recoil' },
      { kind: 'seg', a: [1.6, 4.8, 2.2], b: [7.4, 4.8, 2.2], ra: 0.95, rb: 0.75, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 8.0, y: -4.8, z: 2.2, rx: 1.7, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
      { kind: 'ellipsoid', x: 8.0, y: 4.8, z: 2.2, rx: 1.7, ry: 1.4, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V18: Rail-Crawler (Heavy Ground — TWO-LAYER: 4 separated outrigger quad-tread pods + sleek split-railgun turret!)
  {
    id: 'V18',
    name: 'Rail-Crawler',
    faction: 'vanguard',
    role: 'Heavy Ground',
    layer: 'ground',
    coreW: 24,
    coreH: 19,
    twoLayer: true,
    turretPivot: [-1.0, 0, 4.8],
    parts: [
      // 4 clearly separated cantilevered outrigger quad-tread pods (open gaps between front & rear!)
      { kind: 'box', x: -4.8, y: -5.8, z: 1.4, sx: 5.0, sy: 2.2, sz: 2.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: 4.6, y: -5.8, z: 1.4, sx: 5.0, sy: 2.2, sz: 2.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: -4.8, y: 5.8, z: 1.4, sx: 5.0, sy: 2.2, sz: 2.6, mat: 'darkSteel', anim: 'tread' },
      { kind: 'box', x: 4.6, y: 5.8, z: 1.4, sx: 5.0, sy: 2.2, sz: 2.6, mat: 'darkSteel', anim: 'tread' },
      // Dark steel outrigger suspension cross-beams
      { kind: 'box', x: -4.6, y: 0, z: 2.2, sx: 2.6, sy: 10.6, sz: 1.6, mat: 'darkSteel' },
      { kind: 'box', x: 4.4, y: 0, z: 2.2, sx: 2.6, sy: 10.6, sz: 1.6, mat: 'darkSteel' },
      // Paneled armored core hull + rear dark engine deck + sloped cobalt glacis
      { kind: 'box', x: -0.2, y: 0, z: 3.4, sx: 13.0, sy: 7.8, sz: 2.8, mat: 'steel', detail: 'panel' },
      { kind: 'box', x: -5.2, y: 0, z: 4.4, sx: 3.2, sy: 6.2, sz: 1.4, mat: 'darkSteel', detail: 'panel' },
      { kind: 'box', x: 5.2, y: 0, z: 3.8, sx: 3.6, sy: 6.8, sz: 2.0, mat: 'team', detail: 'panel' },
      { kind: 'box', x: 7.0, y: -2.2, z: 3.6, sx: 0.9, sy: 1.4, sz: 0.9, mat: 'amber', glow: true },
      { kind: 'box', x: 7.0, y: 2.2, z: 3.6, sx: 0.9, sy: 1.4, sz: 0.9, mat: 'amber', glow: true },
    ],
    turretParts: [
      { kind: 'box', x: -1.0, y: 0, z: 1.8, sx: 7.4, sy: 5.8, sz: 3.0, mat: 'team', detail: 'panel' },
      { kind: 'box', x: -0.6, y: 0, z: 3.4, sx: 5.2, sy: 4.2, sz: 1.2, mat: 'steel', detail: 'panel' },
      { kind: 'box', x: -4.2, y: 0, z: 2.2, sx: 1.8, sy: 4.6, sz: 2.2, mat: 'darkSteel' },
      // Split twin accelerator rail tines framing glowing cyan magnetic core!
      { kind: 'seg', a: [2.4, -1.6, 2.0], b: [10.4, -1.6, 2.2], ra: 0.9, rb: 0.7, mat: 'steel', anim: 'recoil' },
      { kind: 'seg', a: [2.4, 1.6, 2.0], b: [10.4, 1.6, 2.2], ra: 0.9, rb: 0.7, mat: 'steel', anim: 'recoil' },
      { kind: 'seg', a: [2.2, 0, 2.2], b: [9.8, 0, 2.3], ra: 0.85, rb: 0.55, mat: 'cyan', glow: true, anim: 'recoil' },
      { kind: 'ellipsoid', x: 10.8, y: 0, z: 2.2, rx: 2.0, ry: 2.6, rz: 1.8, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },

  // V19: Dart Fighter (Light Air — needle jet w/ swept wings & cyan afterburner)
  {
    id: 'V19',
    name: 'Dart Fighter',
    faction: 'vanguard',
    role: 'Light Air',
    layer: 'air',
    coreW: 16,
    coreH: 14,
    parts: [
      { kind: 'seg', a: [-5.4, 0, 4.0], b: [6.4, 0, 4.0], ra: 1.5, rb: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'wing', a: [1.4, 0, 4.0], b: [-3.4, -6.2, 3.8], c: [-4.4, 0, 4.0], mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [1.4, 0, 4.0], b: [-3.4, 6.2, 3.8], c: [-4.4, 0, 4.0], mat: 'team', anim: 'bob' },
      { kind: 'box', x: 1.6, y: 0, z: 4.9, sx: 2.8, sy: 1.6, sz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -6.0, y: 0, z: 4.0, rx: 1.3, ry: 1.1, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 6.8, y: 0, z: 4.0, rx: 1.5, ry: 1.1, rz: 1.1, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V20: Wasp Rotor (Light Air — 4-pod quad-rotor drone + 2-frame spinning rotor overlay!)
  {
    id: 'V20',
    name: 'Wasp Rotor',
    faction: 'vanguard',
    role: 'Light Air',
    layer: 'air',
    coreW: 16,
    coreH: 14,
    special: 'rotor',
    parts: [
      { kind: 'ellipsoid', x: 0, y: 0, z: 4.0, rx: 3.0, ry: 2.6, rz: 2.0, mat: 'team', anim: 'bob' },
      { kind: 'box', x: 1.4, y: 0, z: 4.6, sx: 2.0, sy: 1.8, sz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'seg', a: [-3.8, -4.0, 4.2], b: [3.8, 4.0, 4.2], ra: 0.7, mat: 'darkSteel', anim: 'bob' },
      { kind: 'seg', a: [-3.8, 4.0, 4.2], b: [3.8, -4.0, 4.2], ra: 0.7, mat: 'darkSteel', anim: 'bob' },
      { kind: 'ring', x: 3.8, y: -4.0, z: 4.5, r: 1.8, tube: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'ring', x: 3.8, y: 4.0, z: 4.5, r: 1.8, tube: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'ring', x: -3.8, y: -4.0, z: 4.5, r: 1.8, tube: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'ring', x: -3.8, y: 4.0, z: 4.5, r: 1.8, tube: 0.55, mat: 'steel', anim: 'bob' },
      { kind: 'seg', a: [2.2, 0, 3.0], b: [5.4, 0, 2.8], ra: 0.65, mat: 'steel', anim: 'recoil' },
      { kind: 'ellipsoid', x: 5.8, y: 0, z: 2.8, rx: 1.4, ry: 1.2, rz: 1.2, mat: 'muzzle', anim: 'muzzle' },
    ],
    overlayParts: [
      { kind: 'ring', x: 3.8, y: -4.0, z: 5.1, r: 1.6, tube: 0.45, mat: 'steel', anim: 'rotor', arc: [0, 120] },
      { kind: 'ring', x: 3.8, y: 4.0, z: 5.1, r: 1.6, tube: 0.45, mat: 'steel', anim: 'rotor', arc: [90, 210] },
      { kind: 'ring', x: -3.8, y: -4.0, z: 5.1, r: 1.6, tube: 0.45, mat: 'steel', anim: 'rotor', arc: [45, 165] },
      { kind: 'ring', x: -3.8, y: 4.0, z: 5.1, r: 1.6, tube: 0.45, mat: 'steel', anim: 'rotor', arc: [135, 255] },
    ],
  },

  // V21: Bomber Wing (Light Air — notched stealth B-2 W-wing tactical bomber w/ recessed twin engines!)
  {
    id: 'V21',
    name: 'Bomber Wing',
    faction: 'vanguard',
    role: 'Light Air',
    layer: 'air',
    coreW: 19,
    coreH: 15,
    parts: [
      // Split notched W-wing silhouette (crisp open V-notch at trailing center!)
      { kind: 'wing', a: [7.2, 0, 4.4], b: [-5.4, -7.6, 4.0], c: [-2.6, 0, 4.2], mat: 'steel', thickness: 1.1, anim: 'bob' },
      { kind: 'wing', a: [7.2, 0, 4.4], b: [-5.4, 7.6, 4.0], c: [-2.6, 0, 4.2], mat: 'steel', thickness: 1.1, anim: 'bob' },
      { kind: 'wing', a: [3.6, 0, 5.0], b: [-4.4, -5.0, 4.6], c: [-2.4, 0, 4.8], mat: 'team', anim: 'bob' },
      { kind: 'wing', a: [3.6, 0, 5.0], b: [-4.4, 5.0, 4.6], c: [-2.4, 0, 4.8], mat: 'team', anim: 'bob' },
      { kind: 'box', x: 1.8, y: 0, z: 5.4, sx: 3.4, sy: 2.2, sz: 1.2, mat: 'darkSteel', anim: 'bob' },
      { kind: 'box', x: 3.2, y: 0, z: 5.5, sx: 1.8, sy: 1.6, sz: 0.9, mat: 'amber', glow: true, anim: 'bob' },
      { kind: 'box', x: -3.2, y: -2.4, z: 4.3, sx: 1.6, sy: 1.6, sz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'box', x: -3.2, y: 2.4, z: 4.3, sx: 1.6, sy: 1.6, sz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 1.0, y: 0, z: 2.4, rx: 1.8, ry: 1.8, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V23: Drop-Barge (Heavy Air — sleek Pelican/dropship w/ 4 cantilevered VTOL thruster nacelles & twin tail fins!)
  {
    id: 'V23',
    name: 'Drop-Barge',
    faction: 'vanguard',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 24,
    coreH: 18,
    parts: [
      // Tapered armored fuselage + dark ventral cargo bay + sloped cyan canopy
      { kind: 'box', x: -0.6, y: 0, z: 4.4, sx: 13.4, sy: 5.2, sz: 3.4, mat: 'steel', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: -1.4, y: 0, z: 6.2, sx: 8.6, sy: 3.8, sz: 1.4, mat: 'team', detail: 'panel', anim: 'bob' },
      { kind: 'seg', a: [4.4, 0, 4.4], b: [8.8, 0, 3.8], ra: 2.2, rb: 1.1, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: 6.4, y: 0, z: 5.2, sx: 2.8, sy: 2.8, sz: 1.4, mat: 'cyan', glow: true, anim: 'bob' },
      // Dark rear cargo bay hatch + twin angled vertical tail fins
      { kind: 'box', x: -7.4, y: 0, z: 4.0, sx: 2.0, sy: 4.2, sz: 2.4, mat: 'darkSteel', anim: 'bob' },
      { kind: 'wing', a: [-5.6, -2.0, 5.8], b: [-9.2, -3.6, 8.8], c: [-8.6, -2.0, 5.4], mat: 'team', thickness: 0.9, anim: 'bob' },
      { kind: 'wing', a: [-5.6, 2.0, 5.8], b: [-9.2, 3.6, 8.8], c: [-8.6, 2.0, 5.4], mat: 'team', thickness: 0.9, anim: 'bob' },
      // 4 cantilevered outrigger VTOL thruster pods (clear open gaps!)
      { kind: 'box', x: 2.4, y: -5.4, z: 4.2, sx: 3.6, sy: 2.8, sz: 2.0, mat: 'darkSteel', anim: 'bob' },
      { kind: 'box', x: 2.4, y: 5.4, z: 4.2, sx: 3.6, sy: 2.8, sz: 2.0, mat: 'darkSteel', anim: 'bob' },
      { kind: 'box', x: -4.2, y: -6.2, z: 4.4, sx: 4.0, sy: 3.0, sz: 2.2, mat: 'team', anim: 'bob' },
      { kind: 'box', x: -4.2, y: 6.2, z: 4.4, sx: 4.0, sy: 3.0, sz: 2.2, mat: 'team', anim: 'bob' },
      // Connecting wing spars + glowing VTOL exhausts
      { kind: 'box', x: 2.4, y: 0, z: 4.4, sx: 2.0, sy: 9.6, sz: 1.0, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: -4.2, y: 0, z: 4.6, sx: 2.2, sy: 11.0, sz: 1.0, mat: 'steel', anim: 'bob' },
      { kind: 'ellipsoid', x: -6.4, y: -6.2, z: 4.0, rx: 1.2, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -6.4, y: 6.2, z: 4.0, rx: 1.2, ry: 1.2, rz: 1.0, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 9.2, y: 0, z: 3.8, rx: 1.6, ry: 1.6, rz: 1.4, mat: 'muzzle', anim: 'muzzle' },
    ],
  },

  // V24: Sky-Dreadnought (Heavy Air — iconic Battlecruiser hammerhead capital ship w/ split bow & quad stern engines!)
  {
    id: 'V24',
    name: 'Sky-Dreadnought',
    faction: 'vanguard',
    role: 'Heavy Air',
    layer: 'air',
    coreW: 26,
    coreH: 19,
    parts: [
      // Narrow armored mid-spine connecting hammerhead bow to wide stern hull
      { kind: 'box', x: 0.4, y: 0, z: 5.0, sx: 14.0, sy: 4.2, sz: 2.8, mat: 'darkSteel', detail: 'panel', anim: 'bob' },
      // Iconic split-prong Hammerhead Bow framing glowing cyan Yamato cannon core!
      { kind: 'box', x: 7.4, y: -3.2, z: 5.0, sx: 5.8, sy: 2.8, sz: 2.8, mat: 'steel', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: 7.4, y: 3.2, z: 5.0, sx: 5.8, sy: 2.8, sz: 2.8, mat: 'steel', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: 6.8, y: -3.2, z: 6.4, sx: 4.2, sy: 2.2, sz: 1.0, mat: 'team', anim: 'bob' },
      { kind: 'box', x: 6.8, y: 3.2, z: 6.4, sx: 4.2, sy: 2.2, sz: 1.0, mat: 'team', anim: 'bob' },
      { kind: 'ellipsoid', x: 8.0, y: 0, z: 5.0, rx: 2.2, ry: 1.6, rz: 1.6, mat: 'cyan', glow: true, anim: 'bob' },
      // Wide swept stern armored wing-hull + raised command bridge tower
      { kind: 'box', x: -4.2, y: 0, z: 5.2, sx: 8.6, sy: 10.6, sz: 3.0, mat: 'steel', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: -3.8, y: 0, z: 6.8, sx: 6.8, sy: 7.4, sz: 1.6, mat: 'team', detail: 'panel', anim: 'bob' },
      { kind: 'box', x: -3.4, y: 0, z: 8.4, sx: 4.0, sy: 4.2, sz: 2.0, mat: 'steel', anim: 'bob' },
      { kind: 'box', x: -1.4, y: 0, z: 8.6, sx: 1.0, sy: 3.0, sz: 0.9, mat: 'amber', glow: true, anim: 'bob' },
      // Quad glowing cyan engine nacelles across stern
      { kind: 'box', x: -9.0, y: -4.2, z: 5.2, sx: 2.2, sy: 2.2, sz: 2.0, mat: 'darkSteel', anim: 'bob' },
      { kind: 'box', x: -9.0, y: 4.2, z: 5.2, sx: 2.2, sy: 2.2, sz: 2.0, mat: 'darkSteel', anim: 'bob' },
      { kind: 'ellipsoid', x: -10.2, y: -4.2, z: 5.2, rx: 1.3, ry: 1.2, rz: 1.2, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -10.2, y: 4.2, z: 5.2, rx: 1.3, ry: 1.2, rz: 1.2, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: -9.4, y: 0, z: 5.2, rx: 1.4, ry: 1.8, rz: 1.3, mat: 'cyan', glow: true, anim: 'bob' },
      { kind: 'ellipsoid', x: 11.2, y: 0, z: 5.0, rx: 2.6, ry: 2.2, rz: 2.0, mat: 'cyan', glow: true, anim: 'muzzle' },
    ],
  },
];
