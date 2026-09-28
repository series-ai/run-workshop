import { buildCar, buildConcreteBlock, buildScrapScatter } from './voxelProps';
import type { VoxelPlacement } from './voxelMesher';
import { CLUTTER_BARRIER, CLUTTER_CAR, FLOOR_Y, YARD_CLUTTER, type ClutterItem } from '../../sim/constants';
import type { PaletteKey } from '../style/artStyle';

export const DRESSING_LAYOUT: readonly VoxelPlacement[] = [
  // West scrap car stacks / rows
  {
    grid: buildCar(101, 'rust', 0.4),
    position: [-19.5, FLOOR_Y + 1, -8],
    rotationY: 0.1,
    scale: 0.22,
  },
  {
    grid: buildCar(102, 'signalOrange', 0.7),
    position: [-19.5, FLOOR_Y + 1.9, -8],
    rotationY: 0.25,
    scale: 0.22,
  },
  {
    grid: buildCar(103, 'teal', 0.2),
    position: [-19.5, FLOOR_Y + 1, -3],
    rotationY: -0.15,
    scale: 0.22,
  },
  {
    grid: buildCar(104, 'mustard', 0.5),
    position: [-19.5, FLOOR_Y + 1, 2],
    rotationY: 0.05,
    scale: 0.22,
  },
  {
    grid: buildCar(105, 'rust', 0.8),
    position: [-19.5, FLOOR_Y + 1.85, 2],
    rotationY: -0.2,
    scale: 0.22,
  },

  // East perimeter car row
  {
    grid: buildCar(201, 'teal', 0.3),
    position: [19, FLOOR_Y, -10],
    rotationY: Math.PI - 0.1,
    scale: 0.22,
  },
  {
    grid: buildCar(202, 'signalOrange', 0.6),
    position: [19, FLOOR_Y, -5],
    rotationY: Math.PI + 0.15,
    scale: 0.22,
  },
  {
    grid: buildCar(203, 'rust', 0.9),
    position: [19, FLOOR_Y + 0.8, -5],
    rotationY: Math.PI - 0.05,
    scale: 0.22,
  },
  {
    grid: buildCar(204, 'mustard', 0.4),
    position: [19, FLOOR_Y, 0],
    rotationY: Math.PI + 0.05,
    scale: 0.22,
  },

  // Concrete barrier / block clusters at bay dividers
  {
    grid: buildConcreteBlock(301, [12, 4, 3]),
    position: [-14, FLOOR_Y, 8],
    rotationY: 0,
    scale: 0.25,
  },
  {
    grid: buildConcreteBlock(302, [8, 4, 3]),
    position: [-14, FLOOR_Y, 12],
    rotationY: 0.2,
    scale: 0.25,
  },
  {
    grid: buildConcreteBlock(303, [12, 4, 3]),
    position: [20, FLOOR_Y, 10],
    rotationY: 0,
    scale: 0.25,
  },
  {
    grid: buildConcreteBlock(304, [6, 4, 3]),
    position: [19, FLOOR_Y, -20],
    rotationY: -0.3,
    scale: 0.25,
  },

  // Scrap debris chips clusters around central pad perimeter
  {
    grid: buildScrapScatter(401, 26),
    position: [-6, FLOOR_Y, -4],
    rotationY: 0.4,
    scale: 0.1,
  },
  {
    grid: buildScrapScatter(402, 26),
    position: [6, FLOOR_Y, -4],
    rotationY: -0.5,
    scale: 0.1,
  },
  {
    grid: buildScrapScatter(403, 26),
    position: [-5, FLOOR_Y, 5],
    rotationY: 1.1,
    scale: 0.1,
  },
  {
    grid: buildScrapScatter(404, 26),
    position: [5, FLOOR_Y, 5],
    rotationY: -0.8,
    scale: 0.1,
  },
];

const CAR_PAINTS: readonly PaletteKey[] = ['rust', 'teal', 'mustard', 'signalOrange', 'concreteShade'];

/** Voxel props for one solid clutter item. Sizes match its collider in sim/constants. */
function clutterPlacements(item: ClutterItem): VoxelPlacement[] {
  switch (item.kind) {
    case 'cars':
      return Array.from({ length: item.count }, (_, tier) => ({
        grid: buildCar(item.seed * 10 + tier, CAR_PAINTS[(item.seed + tier) % CAR_PAINTS.length]!, 0.8),
        position: [item.x, FLOOR_Y + tier * CLUTTER_CAR.tierHeight, item.z] as const,
        // Grid length runs along its z; a quarter turn lays it along world X.
        rotationY: (item.alongX ? Math.PI / 2 : 0) + (tier % 2 === 0 ? 0.03 : -0.04),
        scale: CLUTTER_CAR.voxelScale,
      }));
    case 'barriers': {
      const pitch = CLUTTER_BARRIER.length + CLUTTER_BARRIER.gap;
      const start = -(item.count - 1) * pitch / 2;
      return Array.from({ length: item.count }, (_, index) => {
        const offset = start + index * pitch;
        return {
          grid: buildConcreteBlock(item.seed + index, [7, 4, 4]),
          position: [item.x + (item.alongX ? offset : 0), FLOOR_Y, item.z + (item.alongX ? 0 : offset)] as const,
          rotationY: item.alongX ? 0 : Math.PI / 2,
          scale: CLUTTER_BARRIER.voxelScale,
        };
      });
    }
    default: {
      const unreachable: never = item.kind;
      throw new Error(`WRECK_YARD_CLUTTER_KIND_INVALID: ${String(unreachable)}`);
    }
  }
}

/** Flat debris patches: ground detail only, too low to need collision. */
const DEBRIS_PATCHES: readonly (readonly [number, number])[] = [
  [-12, 22], [-6, 23], [0, 22.5], [5, 23], [-11, -22], [-1, -22.5], [5, -22], [10, -23],
  [-3, 6], [6, -6], [-8, -8], [9, 6], [17, 21], [-17, -17], [-9, 3], [3, -10],
  [-10, -13], [-14, -19], [3, -14], [8, -19], [-17, 14], [-12, 19.5], [1, 16], [6, 21],
  [-4, -5], [10, -4], [-8, 8], [18, -21], [-19, 9], [20, 2], [-2, 13], [12, 22],
];

export const CLUTTER_LAYOUT: readonly VoxelPlacement[] = [
  ...YARD_CLUTTER.flatMap(clutterPlacements),
  ...DEBRIS_PATCHES.map(([x, z], index) => ({
    grid: buildScrapScatter(900 + index, 26),
    position: [x, FLOOR_Y, z] as const,
    rotationY: index * 0.7,
    scale: 0.1,
  })),
];
