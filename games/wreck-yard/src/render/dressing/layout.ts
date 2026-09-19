import { buildCar, buildConcreteBlock, buildDebrisChips } from './voxelProps';
import type { VoxelPlacement } from './voxelMesher';
import { FLOOR_Y } from '../../sim/constants';

export const DRESSING_LAYOUT: readonly VoxelPlacement[] = [
  // West scrap car stacks / rows
  {
    grid: buildCar(101, 'rust', 0.4),
    position: [-18, FLOOR_Y, -8],
    rotationY: 0.1,
    scale: 0.22,
  },
  {
    grid: buildCar(102, 'signalOrange', 0.7),
    position: [-18, FLOOR_Y + 0.9, -8],
    rotationY: 0.25,
    scale: 0.22,
  },
  {
    grid: buildCar(103, 'teal', 0.2),
    position: [-18, FLOOR_Y, -3],
    rotationY: -0.15,
    scale: 0.22,
  },
  {
    grid: buildCar(104, 'mustard', 0.5),
    position: [-18, FLOOR_Y, 2],
    rotationY: 0.05,
    scale: 0.22,
  },
  {
    grid: buildCar(105, 'rust', 0.8),
    position: [-18, FLOOR_Y + 0.85, 2],
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
    position: [15, FLOOR_Y, 8],
    rotationY: 0,
    scale: 0.25,
  },
  {
    grid: buildConcreteBlock(304, [6, 4, 3]),
    position: [15, FLOOR_Y, -14],
    rotationY: -0.3,
    scale: 0.25,
  },

  // Scrap debris chips clusters around central pad perimeter
  {
    grid: buildDebrisChips(401, 35),
    position: [-6, FLOOR_Y, -4],
    rotationY: 0.4,
    scale: 0.2,
  },
  {
    grid: buildDebrisChips(402, 35),
    position: [6, FLOOR_Y, -4],
    rotationY: -0.5,
    scale: 0.2,
  },
  {
    grid: buildDebrisChips(403, 30),
    position: [-5, FLOOR_Y, 5],
    rotationY: 1.1,
    scale: 0.2,
  },
  {
    grid: buildDebrisChips(404, 30),
    position: [5, FLOOR_Y, 5],
    rotationY: -0.8,
    scale: 0.2,
  },
];
