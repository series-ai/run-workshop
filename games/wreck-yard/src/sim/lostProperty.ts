import { FLOOR_Y } from './constants';
import { ofMaterial, type ShellShape } from './setPieces';

/** One shared box for the visible belt and its native moving surface. */
export const LOST_PROPERTY_BELT = {
  id: 'lost-property-belt',
  center: [-8.5, FLOOR_Y + 0.22, 20.8],
  size: [4.6, 0.44, 1.5],
  surfaceVelocity: [1.35, 0, 0],
} satisfies ShellShape;

export const LOST_PROPERTY_SOLIDS = ofMaterial('rubber', [LOST_PROPERTY_BELT]);
