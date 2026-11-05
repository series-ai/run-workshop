import { ARENA_EXTENT, FLOOR_Y } from './constants';
import { CONVEYOR } from './contraptions';
import { SHELL_BOXES } from './shell';

/**
 * The arena cage: invisible static panels that continue the perimeter walls
 * up to a ceiling, so nothing thrown, punted, or launched leaves the yard.
 * render/ArenaCage.tsx draws a faint grid on the same panels.
 */

type Vec3Tuple = [number, number, number];

/** Top of the cage: above the catapult's arc (~16 m) and the floodlight masts (~11 m). */
export const CAGE_TOP = FLOOR_Y + 25;
/**
 * Collision categories (Box3D filter bits, Syncplay rc.78). Aim rays hit only WORLD_CATEGORY,
 * so the cage never blocks a tool. Every body collides with every category.
 */
export const WORLD_CATEGORY = 1n;
export const CAGE_CATEGORY = 2n;
/** The fluid layer of the water tank (fluids keep a 32-bit layer and mask). */
export const WORLD_LAYER = 1;
const THICKNESS = 1;

export interface CagePanel {
  readonly id: string;
  readonly center: Vec3Tuple;
  readonly size: Vec3Tuple;
  /** Unit normal of the face toward the yard; the grid is drawn on that face. */
  readonly inward: Vec3Tuple;
}

function wallTop(id: string): number {
  const wall = SHELL_BOXES.find((box) => box.id === id);
  if (!wall) throw new Error(`WRECK_YARD_CAGE_WALL_MISSING: ${id}`);
  return wall.center[1] + wall.size[1] / 2;
}

/** Inner face of the perimeter walls (the walls are 0.6 m thick, centered on ARENA_EXTENT). */
const INNER = ARENA_EXTENT - 0.3;
const SPAN = 2 * (INNER + THICKNESS);
const OUTSIDE = INNER + THICKNESS / 2;

/** Vertical panel from `bottom` to `top` along one wall. `along` is the [min, max] extent on its long axis. */
function wallPanel(id: string, side: 'north' | 'south' | 'east' | 'west', bottom: number, top: number, along: readonly [number, number] = [-SPAN / 2, SPAN / 2]): CagePanel {
  const mid = (along[0] + along[1]) / 2;
  const length = along[1] - along[0];
  const y = (bottom + top) / 2;
  const height = top - bottom;
  switch (side) {
    case 'north': return { id, center: [mid, y, -OUTSIDE], size: [length, height, THICKNESS], inward: [0, 0, 1] };
    case 'south': return { id, center: [mid, y, OUTSIDE], size: [length, height, THICKNESS], inward: [0, 0, -1] };
    case 'west': return { id, center: [-OUTSIDE, y, mid], size: [THICKNESS, height, length], inward: [1, 0, 0] };
    case 'east': return { id, center: [OUTSIDE, y, mid], size: [THICKNESS, height, length], inward: [-1, 0, 0] };
    default: {
      const unreachable: never = side;
      throw new Error(`WRECK_YARD_CAGE_SIDE_INVALID: ${String(unreachable)}`);
    }
  }
}

/** The sky conveyor passes through the north panel: leave a tunnel for its belt, rails, and crates. */
const TUNNEL = {
  x: [CONVEYOR.x - CONVEYOR.width / 2 - 0.6, CONVEYOR.x + CONVEYOR.width / 2 + 0.6] as const,
  y: [CONVEYOR.topY - 0.35, CONVEYOR.topY + 2.4] as const,
};

const northTop = wallTop('wall-north');

export const CAGE_PANELS: readonly CagePanel[] = [
  wallPanel('cage-south', 'south', wallTop('wall-south'), CAGE_TOP),
  wallPanel('cage-west', 'west', wallTop('wall-west'), CAGE_TOP),
  wallPanel('cage-east', 'east', wallTop('wall-east'), CAGE_TOP),
  wallPanel('cage-north-left', 'north', northTop, CAGE_TOP, [-SPAN / 2, TUNNEL.x[0]]),
  wallPanel('cage-north-right', 'north', northTop, CAGE_TOP, [TUNNEL.x[1], SPAN / 2]),
  wallPanel('cage-north-under-belt', 'north', northTop, TUNNEL.y[0], TUNNEL.x),
  wallPanel('cage-north-over-belt', 'north', TUNNEL.y[1], CAGE_TOP, TUNNEL.x),
  { id: 'cage-ceiling', center: [0, CAGE_TOP + THICKNESS / 2, 0], size: [SPAN, THICKNESS, SPAN], inward: [0, -1, 0] },
];
