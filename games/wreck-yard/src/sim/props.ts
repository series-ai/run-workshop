import { makeEmptyVoxelField, stampBox, type VoxelDims } from 'voxel-kit';
import { BURNT_MATERIAL, FLOOR_Y, VOXEL_SIZE } from './constants';
import type { YardMaterial } from './materials';
import type { Quat, Vec3 } from './math';
import { RIG, RIG_TORCH_X } from './setPieces';

/**
 * Every prop in the yard is a dynamic voxel body: grab it, punt it, cut it,
 * drive into it. Only level structure (floor, walls, deck, crane, masts, ramp,
 * tank, hopper, rig) is static; see setPieces.ts and shell.ts.
 */

/**
 * Prop palette band, shared with the buggy. render/VoxelBodies.tsx maps each
 * code to an ART_STYLE color. Only `spark` and `glow` emit light.
 */
export const PROP_COLOR = {
  orange: 16, orangeShade: 17, white: 18, grey: 19, teal: 20, mustard: 21, rust: 22, ink: 23, spark: 24, glow: 25, metal: 26, red: 27,
  burnt: BURNT_MATERIAL,
} as const;
export type PropColor = keyof typeof PROP_COLOR;

export interface VolumePreset {
  readonly dims: VoxelDims;
  readonly voxels: Uint8Array;
}

export interface PropSpawn {
  readonly id: string;
  readonly label: string;
  readonly material: YardMaterial;
  readonly preset: VolumePreset;
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly buoyancy: number;
}

/** Top of the west loading deck above the floor (the setPieces `deck` collider). */
export const DECK_HEIGHT = 1.0;

function lcg(seed: number): () => number {
  let state = Math.imul(seed, 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function field(x: number, y: number, z: number) {
  const dims = { x, y, z };
  const voxels = makeEmptyVoxelField(dims);
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: PropColor | 0) =>
    stampBox(voxels, dims, { x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }, color === 0 ? 0 : PROP_COLOR[color]);
  return { dims, voxels, box };
}

/**
 * Wrecked car, 2.08 m wide and 4.0 m long (local z). `crush` 0 is whole, 1 is
 * flat. The hull is two boxes (body, cabin) so stacks stay cheap to simulate;
 * wheels and glass are color only.
 */
export function carPreset(seed: number, paint: PropColor, crush: number): VolumePreset {
  const random = lcg(seed);
  const cabinTop = Math.round(15 - crush * 6);
  const bodyTop = Math.max(5, cabinTop - 6);
  const { dims, voxels, box } = field(26, cabinTop + 1, 50);
  box(1, 0, 3, 24, 1, 46, 'ink');
  box(1, 2, 3, 24, bodyTop, 46, paint);
  box(3, bodyTop + 1, 15, 22, cabinTop, 33, paint);
  // Dark window bands on the cabin sides, windshield, and rear glass.
  box(3, bodyTop + 2, 16, 3, cabinTop - 1, 32, 'ink');
  box(22, bodyTop + 2, 16, 22, cabinTop - 1, 32, 'ink');
  box(4, bodyTop + 2, 15, 21, cabinTop - 1, 15, 'ink');
  box(4, bodyTop + 2, 33, 21, cabinTop - 1, 33, 'ink');
  // Wheels on the body sides, headlights, taillights.
  for (const z of [8, 38]) for (const x of [1, 24]) box(x, 0, z, x, 4, z + 5, 'ink');
  box(3, bodyTop - 1, 3, 6, bodyTop, 3, 'white');
  box(19, bodyTop - 1, 3, 22, bodyTop, 3, 'white');
  box(3, bodyTop - 1, 46, 6, bodyTop, 46, 'rust');
  box(19, bodyTop - 1, 46, 22, bodyTop, 46, 'rust');
  // Rust patches on the paint.
  for (let i = 0; i < 9; i += 1) {
    const x = 1 + Math.floor(random() * 20);
    const z = 3 + Math.floor(random() * 40);
    const y = 2 + Math.floor(random() * Math.max(1, bodyTop - 2));
    box(x, y, z, Math.min(24, x + 3), Math.min(bodyTop, y + 2), Math.min(46, z + 4), 'rust');
  }
  return { dims, voxels };
}

/** Shipping container, 6.0 m long (local x), 2.48 m high, 2.4 m wide, with hollow walls. */
export function containerPreset(color: PropColor): VolumePreset {
  const { dims, voxels, box } = field(75, 31, 30);
  box(0, 0, 0, 74, 30, 29, color);
  box(2, 2, 2, 72, 28, 27, 0);
  // Corrugation ribs on the long walls, corner posts, and door bars at +x.
  for (let x = 4; x < 72; x += 4) {
    box(x, 2, 0, x, 28, 0, 'ink');
    box(x, 2, 29, x, 28, 29, 'ink');
  }
  for (const x of [0, 74]) for (const z of [0, 29]) box(x, 0, z, x, 30, z, 'ink');
  for (const z of [7, 14, 15, 22]) box(74, 2, z, 74, 28, z, 'metal');
  box(30, 16, 29, 44, 20, 29, 'mustard');
  return { dims, voxels };
}

/** Concrete jersey barrier, 0.64 m wide, 0.88 m high, 3.2 m long (local z), tapered. */
export function jerseyBarrierPreset(): VolumePreset {
  const { dims, voxels, box } = field(8, 11, 40);
  box(0, 0, 0, 7, 2, 39, 'white');
  box(1, 3, 0, 6, 6, 39, 'white');
  box(2, 7, 0, 5, 10, 39, 'white');
  box(1, 5, 0, 1, 5, 39, 'mustard');
  box(6, 5, 0, 6, 5, 39, 'mustard');
  return { dims, voxels };
}

/** Concrete block with a light top face. Size in voxels; the long side is local x. */
export function blockPreset(x: number, y: number, z: number): VolumePreset {
  const { dims, voxels, box } = field(x, y, z);
  box(0, 0, 0, x - 1, y - 1, z - 1, 'grey');
  box(0, y - 1, 0, x - 1, y - 1, z - 1, 'white');
  return { dims, voxels };
}

/** Compacted scrap bale, 0.96 m across and 0.88 m high: chunks of crushed scrap in two steel straps. */
export function balePreset(seed: number): VolumePreset {
  const random = lcg(seed);
  const colors: readonly PropColor[] = ['rust', 'grey', 'metal', 'teal', 'mustard', 'orange', 'rust'];
  const { dims, voxels, box } = field(12, 11, 12);
  for (let y = 0; y < 11; y += 3) {
    for (let z = 0; z < 12; z += 4) {
      for (let x = 0; x < 12; x += 4) {
        const shift = Math.floor(random() * 3) - 1;
        box(x + shift, y, z, x + shift + 4, y + 2, z + 3, colors[Math.floor(random() * colors.length)]!);
      }
    }
  }
  for (const x of [3, 8]) box(x, 0, 0, x, 10, 11, 'ink');
  return { dims, voxels };
}

/**
 * One loose tire lying flat: 1.04 m across and 0.32 m wide, a black tread
 * ring around a grey wheel rim and an open hole. Its collider is a cylinder
 * (physics.ts LOOSE_TIRE), so it rolls on its tread and stacks on its side.
 */
export function looseTirePreset(): VolumePreset {
  const { dims, voxels } = field(13, 4, 13);
  for (let z = 0; z < 13; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 13; x++) {
    const radius = Math.hypot(x - 6, z - 6);
    if (radius > 6.4 || radius < 2.4) continue;
    // The rim shows on the two side faces only. The tread wraps the whole ring.
    const rim = radius < 3.6 && (y === 0 || y === 3);
    voxels[x + y * dims.x + z * dims.x * dims.y] = PROP_COLOR[rim ? 'grey' : 'ink'];
  }
  return { dims, voxels };
}

/**
 * Four tires stacked flat, 1.04 m across and 0.96 m high. The outline is a
 * chamfered square with a solid core: a ring shape rocks and never sleeps.
 */
export function tireStackPreset(): VolumePreset {
  const { dims, voxels, box } = field(13, 12, 13);
  for (const y of [0, 3, 6, 9]) {
    box(2, y, 0, 10, y + 2, 12, 'ink');
    box(0, y, 2, 12, y + 2, 10, 'ink');
    box(1, y, 1, 11, y + 2, 11, 'ink');
    // A grey seam line between tires, and the rim and hole on top.
    box(2, y + 2, 0, 10, y + 2, 12, 'grey');
    box(0, y + 2, 2, 12, y + 2, 10, 'grey');
    box(1, y + 2, 1, 11, y + 2, 11, 'ink');
    box(3, y, 3, 9, y + 2, 9, 'grey');
    box(5, y, 5, 7, y + 2, 7, 'ink');
  }
  return { dims, voxels };
}

/**
 * Fuel drum from the sky conveyor (sim/fuelDrum.ts), 0.72 m across and 0.96 m
 * tall: red paint, steel lids, dark rolling hoops, and a hazard band.
 */
export function fuelDrumPreset(): VolumePreset {
  const { dims, voxels } = field(9, 12, 9);
  const radius = 4.4;
  for (let y = 0; y < dims.y; y += 1) {
    for (let z = 0; z < dims.z; z += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const dx = x - 4;
        const dz = z - 4;
        if (dx * dx + dz * dz > radius * radius) continue;
        const rim = dx * dx + dz * dz > (radius - 1.2) * (radius - 1.2);
        // Diagonal stripes around the band: the angle term turns with height.
        const stripe = (Math.round((Math.atan2(dz, dx) / Math.PI) * 6 + y) & 1) === 0;
        const color: PropColor = y === 0 || y === dims.y - 1 ? (rim ? 'metal' : 'grey')
          : !rim ? 'red'
          : y === 2 || y === 9 ? 'ink'
          : y === 5 || y === 6 ? (stripe ? 'mustard' : 'ink')
          : 'red';
        voxels[x + y * dims.x + z * dims.x * dims.y] = PROP_COLOR[color];
      }
    }
  }
  // Filler cap on the lid.
  voxels[6 + (dims.y - 1) * dims.x + 4 * dims.x * dims.y] = PROP_COLOR.white;
  return { dims, voxels };
}

export type ScrapKind = 'beam' | 'pipe' | 'plate' | 'engine';

/** Loose scrap: I-beam, pipe, plate, engine block. The long side is local x. */
export function scrapPreset(kind: ScrapKind, seed: number): VolumePreset {
  const random = lcg(seed);
  switch (kind) {
    case 'beam': {
      const length = 22 + Math.floor(random() * 14);
      const { dims, voxels, box } = field(length, 5, 4);
      box(0, 0, 0, length - 1, 0, 3, 'rust');
      box(0, 4, 0, length - 1, 4, 3, 'rust');
      box(0, 1, 1, length - 1, 3, 2, 'metal');
      return { dims, voxels };
    }
    case 'pipe': {
      const length = 18 + Math.floor(random() * 12);
      const { dims, voxels, box } = field(length, 4, 4);
      box(0, 1, 0, length - 1, 2, 3, 'grey');
      box(0, 0, 1, length - 1, 3, 2, 'grey');
      box(0, 1, 1, length - 1, 2, 2, 'ink');
      return { dims, voxels };
    }
    case 'plate': {
      const { dims, voxels, box } = field(15, 1, 11);
      box(0, 0, 0, 14, 0, 10, random() < 0.5 ? 'rust' : 'metal');
      box(3, 0, 3, 5, 0, 5, 'ink');
      return { dims, voxels };
    }
    case 'engine': {
      const { dims, voxels, box } = field(10, 8, 8);
      box(0, 0, 0, 9, 5, 7, 'metal');
      box(1, 6, 1, 8, 7, 2, 'orange');
      box(1, 6, 5, 8, 7, 6, 'orange');
      box(3, 6, 3, 6, 7, 4, 'mustard');
      box(0, 1, 0, 0, 4, 7, 'ink');
      return { dims, voxels };
    }
    default: {
      const unreachable: never = kind;
      throw new Error(`WRECK_YARD_SCRAP_KIND_INVALID: ${String(unreachable)}`);
    }
  }
}

/** Yaw about +Y. Deterministic because installDeterministicMath() runs before any sim module loads. */
export function yawQuat(yaw: number): Quat {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

const QUARTER = Math.PI / 2;
const heightOf = (preset: VolumePreset) => preset.dims.y * VOXEL_SIZE;

/** Center height for a preset that rests on a surface `base` meters above the floor. */
function restAt(preset: VolumePreset, base = 0): number {
  return FLOOR_Y + base + heightOf(preset) * 0.5 + 0.02;
}

/** Height of the top of the work beam under the torch. The torch sparks start above it. */
export function rigBeamTop(): number {
  const beam = scrapPreset('beam', 70);
  return restAt(beam) + heightOf(beam) * 0.5;
}

const CAR_PAINTS: readonly PropColor[] = ['rust', 'teal', 'mustard', 'orange', 'grey'];

/** A stack of crushed cars. `alongX` lays the car length along world x. */
function carStack(id: string, x: number, z: number, alongX: boolean, tiers: number, seed: number, base = 0): PropSpawn[] {
  const spawns: PropSpawn[] = [];
  let level = base;
  for (let tier = 0; tier < tiers; tier += 1) {
    const preset = carPreset(seed * 10 + tier, CAR_PAINTS[(seed + tier) % CAR_PAINTS.length]!, 0.55 + (tier % 2) * 0.3);
    const jitter = tier % 2 === 0 ? 0.03 : -0.04;
    spawns.push({ id: `${id}-${tier}`, label: 'Wrecked Car', material: 'steel', preset, position: [x, restAt(preset, level), z], rotation: yawQuat((alongX ? QUARTER : 0) + jitter), buoyancy: 0.2 });
    level += heightOf(preset) + 0.03;
  }
  return spawns;
}

/** A row of 1.44 m concrete blocks with 0.06 m gaps. */
function blockRow(id: string, x: number, z: number, alongX: boolean, count: number): PropSpawn[] {
  const preset = blockPreset(18, 10, 10);
  const pitch = 1.5;
  const start = -(count - 1) * pitch / 2;
  return Array.from({ length: count }, (_, index) => ({
    id: `${id}-${index}`,
    label: 'Concrete Block',
    material: 'concrete',
    preset,
    position: [x + (alongX ? start + index * pitch : 0), restAt(preset), z + (alongX ? 0 : start + index * pitch)] as Vec3,
    rotation: yawQuat(alongX ? 0 : QUARTER),
    buoyancy: 0.05,
  }));
}

function slab(id: string, lengthVoxels: number, x: number, z: number, yaw: number): PropSpawn {
  const preset = blockPreset(lengthVoxels, 4, 9);
  return { id, label: 'Concrete Block', material: 'concrete', preset, position: [x, restAt(preset), z], rotation: yawQuat(yaw), buoyancy: 0.05 };
}

/** `iso` turns the container a quarter so its length runs along world z. */
function container(id: string, x: number, z: number, yaw: number, color: PropColor, base = 0, iso = false): PropSpawn {
  const preset = containerPreset(color);
  return { id, label: 'Shipping Container', material: 'steel', preset, position: [x, restAt(preset, base), z], rotation: yawQuat(yaw + (iso ? QUARTER : 0)), buoyancy: 0.6 };
}

function jersey(id: string, x: number, z: number, yaw: number): PropSpawn {
  const preset = jerseyBarrierPreset();
  return { id, label: 'Jersey Barrier', material: 'concrete', preset, position: [x, restAt(preset), z], rotation: yawQuat(yaw), buoyancy: 0.05 };
}

function tireWall(id: string, x: number, z: number): PropSpawn[] {
  const preset = tireStackPreset();
  return [-1.1, 0, 1.1].map((offset, index) => ({
    id: `${id}-${index}`, label: 'Tire Stack', material: 'rubber', preset, position: [x + offset, restAt(preset), z] as Vec3, rotation: yawQuat(index * 0.4), buoyancy: 0.5,
  }));
}

function bale(id: string, seed: number, x: number, z: number, yaw: number, base = 0): PropSpawn {
  const preset = balePreset(seed);
  return { id, label: 'Scrap Bale', material: 'steel', preset, position: [x, restAt(preset, base), z], rotation: yawQuat(yaw), buoyancy: 0.1 };
}

/** Loose scrap on open ground, clear of the play zones and the contraptions (sim/contraptions.ts). */
const SCRAP_SPOTS: readonly (readonly [number, number])[] = [
  [-3, 6], [6, -6], [-8, -8], [9, 6], [-9, 3], [-3, -9], [-10, -12.5], [3, -14],
  [8, -19.5], [-17, 13.5], [-12, 19.5], [1, 16], [5, 19.5], [-4, -5], [10, -4], [-2, 13],
  [14, 21], [17, 21.5], [-17.5, -18], [11, -8],
];
const SCRAP_KINDS: readonly ScrapKind[] = ['beam', 'pipe', 'plate', 'engine'];

/** Every prop in the yard. props.test.ts checks that none overlaps at spawn. */
export function yardProps(): PropSpawn[] {
  const bale0 = balePreset(60);
  const workBeam = scrapPreset('beam', 70);
  return [
    // Car stacks and block rows along the south and north walls.
    ...carStack('south-cars-a', -14, 24.3, true, 2, 11),
    ...carStack('south-cars-b', -9.4, 24.3, true, 2, 12),
    ...blockRow('south-blocks', -3.2, 25.0, true, 4),
    ...carStack('south-cars-c', 2.4, 24.3, true, 1, 14),
    ...carStack('north-cars-a', -9, -24.3, true, 2, 21),
    ...blockRow('north-blocks', -3.4, -25.0, true, 3),
    ...carStack('north-cars-b', 2.6, -24.3, true, 2, 23),
    ...carStack('north-cars-c', 7.2, -24.3, true, 1, 24),

    // Open yard areas away from the play zones (seesaw, tower, bowling, slalom, buggy lane).
    ...carStack('yard-nw-cars', -12.5, -16, false, 2, 31),
    ...blockRow('yard-nw-blocks', -12.5, -11.2, true, 3),
    ...carStack('yard-ne-cars', 5.5, -16.5, true, 2, 33),
    ...carStack('yard-ne-cars-b', 1.6, -19.2, false, 1, 34),
    ...carStack('yard-sw-cars', -15, 17.5, true, 2, 35),
    ...blockRow('yard-sw-blocks', -15, 21.2, true, 2),
    ...carStack('east-cars-a', 17.6, -10, false, 1, 45),
    ...carStack('east-cars-b', 17.6, -5, false, 2, 46),
    ...carStack('east-cars-c', 17.6, 0, false, 1, 47),
    ...carStack('bay-wreck', -9.5, 7.5, true, 1, 48),

    // West loading deck: containers and car stacks between the bay dividers.
    container('container-deck-north', -21, -10.3, 0, 'teal', DECK_HEIGHT),
    ...carStack('deck-cars-a', -19.5, -7, false, 2, 41, DECK_HEIGHT),
    container('container-iso-west', -22.3, 0, 0.08, 'rust', DECK_HEIGHT, true),
    ...carStack('deck-cars-b', -19.3, 0, false, 1, 42, DECK_HEIGHT),
    ...carStack('deck-wreck', -21.5, 6, true, 2, 44, DECK_HEIGHT),
    container('container-deck-south', -21, 13.6, 0.03, 'orange', DECK_HEIGHT),

    // Containers on the yard floor.
    container('container-east', 22, -7.5, 0.28, 'rust'),
    container('container-iso-east', 21.5, -15, -0.3, 'teal', 0, true),
    container('container-sw', -21, 17.6, -0.22, 'white'),
    container('container-se', 21.5, 15.4, 0.14, 'mustard'),

    // Concrete: slabs, jersey barriers, and tire walls on the east circuit.
    slab('block-bay', 38, -14, 8, 0),
    slab('block-hopper', 25, -15.4, 12, 0.2),
    slab('block-east', 38, 20, 9.4, 0),
    slab('block-north', 19, 19, -20, -0.3),
    jersey('jersey-east-a', 20.5, 6.0, 0),
    jersey('jersey-east-b', 20.5, 11.9, 0),
    jersey('jersey-tank', -11, -3.45, QUARTER),
    ...tireWall('tires-a', 20, 8.2),
    ...tireWall('tires-b', 20, 18.8),

    // Scrap bales west of the yard centre, off the walk to the lift front: two on the floor, one on top.
    bale('bale-0', 60, -10.4, -0.6, 0),
    bale('bale-1', 61, -9.35, -0.5, 0.1),
    bale('bale-2', 62, -9.9, -0.55, -0.15, heightOf(bale0) + 0.03),

    // Demolition rig: the work beam lies under the torch head; the target car waits south of the rig.
    { id: 'rig-work-beam', label: 'Steel Beam', material: 'steel', preset: workBeam, position: [RIG[0] + RIG_TORCH_X, restAt(workBeam), RIG[2]], rotation: yawQuat(QUARTER), buoyancy: 0.05 },
    // East of the walk from the yard centre to the lift front.
    ...carStack('rig-target-car', RIG[0] + 1.5, -12.4, true, 1, 49),

    ...SCRAP_SPOTS.map(([x, z], index): PropSpawn => {
      const kind = SCRAP_KINDS[index % SCRAP_KINDS.length]!;
      const preset = scrapPreset(kind, 100 + index);
      return { id: `scrap-${index}`, label: 'Scrap', material: 'steel', preset, position: [x, restAt(preset), z] as Vec3, rotation: yawQuat(index * 0.9), buoyancy: kind === 'pipe' ? 0.4 : 0.1 };
    }),
  ];
}
