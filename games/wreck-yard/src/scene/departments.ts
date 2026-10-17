import { FLOOR_Y } from '../sim/constants';

export type DepartmentId = 'storage' | 'incoming' | 'claims' | 'roadworthy' | 'express' | 'lost-property' | 'impact' | 'assembly' | 'balance' | 'warranty' | 'float' | 'returns';
export type DepartmentAccent = 'signalOrange' | 'teal' | 'mustard' | 'rust';
export type DepartmentPoint = readonly [number, number];
export interface DepartmentPanel {
  readonly mount: string;
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number];
  readonly yaw: number;
}
export interface Department {
  readonly id: DepartmentId;
  readonly number: string;
  readonly title: string;
  readonly headline: readonly [string, string];
  readonly action: string;
  readonly joke: string;
  readonly accent: DepartmentAccent;
  readonly zone: string;
  readonly target: DepartmentPoint;
  readonly sign: DepartmentPanel;
  readonly paint: { readonly center: DepartmentPoint; readonly size: readonly [number, number]; readonly yaw: number };
}

/** The deck curb extends 0.04 m. Leave 0.012 m between it and the panel. */
const westPanel = (z: number): DepartmentPanel => ({ mount: 'set-deck', center: [-17.948, FLOOR_Y + 0.51, z], size: [4.3, 0.9], yaw: Math.PI / 2 });
/** Wall ribs extend 0.07 m. Mount panels 0.09 m in front of the wall face. */
const WALL_PANEL_FACE = 25.61;

/** The same station data supplies world signs, floor numbers, and the directory. */
export const DEPARTMENTS = [
  {
    id: 'storage', number: '01', title: 'Perfectly Safe Storage', headline: ['PERFECTLY SAFE', 'STORAGE'],
    action: 'Use the lift. Remove a lower crate.', joke: 'Stack limit: 4. Actual: 10.', accent: 'signalOrange', zone: 'NORTHWEST', target: [-13, -21],
    sign: { mount: 'wall-west', center: [-WALL_PANEL_FACE, FLOOR_Y + 2.05, -18.9], size: [4.7, 2.3], yaw: Math.PI / 2 },
    paint: { center: [-10.8, -12.9], size: [2.4, 2.4], yaw: 0 },
  },
  {
    id: 'incoming', number: '02', title: 'Incoming Liability', headline: ['INCOMING', 'LIABILITY'],
    action: 'Press DRUMS. Watch the belt.', joke: 'Contents may settle. So may claims.', accent: 'rust', zone: 'NORTH', target: [0.2, -15],
    sign: { mount: 'wall-north', center: [-1.8, FLOOR_Y + 1.02, -WALL_PANEL_FACE], size: [4.3, 1.8], yaw: 0 },
    paint: { center: [2.9, -8.3], size: [2.6, 2.6], yaw: 0 },
  },
  {
    id: 'claims', number: '03', title: 'Claims Assessment', headline: ['CLAIMS', 'ASSESSMENT'],
    action: 'Put a loose part through the hoop.', joke: 'Every claim needs a clear result.', accent: 'mustard', zone: 'NORTHEAST', target: [13, -22.6],
    sign: { mount: 'wall-east', center: [WALL_PANEL_FACE, FLOOR_Y + 2.02, -21.2], size: [4.4, 2.2], yaw: -Math.PI / 2 },
    paint: { center: [13, -18.8], size: [2.6, 2.6], yaw: 0 },
  },
  {
    id: 'roadworthy', number: '04', title: 'Roadworthy Until Impact', headline: ['ROADWORTHY', 'UNTIL IMPACT'],
    action: 'Drive the buggy over the ramp.', joke: 'Final approval is at the wall.', accent: 'signalOrange', zone: 'EAST CIRCUIT', target: [14, 0],
    sign: { mount: 'wall-east', center: [WALL_PANEL_FACE, FLOOR_Y + 2, -0.5], size: [5.2, 2.3], yaw: -Math.PI / 2 },
    paint: { center: [10.4, -4.3], size: [2.5, 2.5], yaw: Math.PI },
  },
  {
    id: 'express', number: '05', title: 'Express Claims', headline: ['EXPRESS', 'CLAIMS'],
    action: 'Load the bucket. Press LAUNCH.', joke: 'Delivery time: brief.', accent: 'rust', zone: 'SOUTHEAST', target: [8.5, 24.1],
    sign: { mount: 'wall-south', center: [8.5, FLOOR_Y + 2.55, WALL_PANEL_FACE], size: [4.2, 1.8], yaw: Math.PI },
    paint: { center: [8.4, 18.3], size: [2.5, 2.5], yaw: Math.PI },
  },
  {
    id: 'lost-property', number: '06', title: 'Lost Property', headline: ['LOST', 'PROPERTY'],
    action: 'Put a loose part on the belt.', joke: 'Collection is not guaranteed.', accent: 'teal', zone: 'SOUTHWEST', target: [-8.5, 20.8],
    sign: { mount: 'wall-south', center: [-8.4, FLOOR_Y + 2.7, WALL_PANEL_FACE], size: [4.4, 1.8], yaw: Math.PI },
    paint: { center: [-8.5, 18.2], size: [2.5, 2.5], yaw: Math.PI },
  },
  {
    id: 'impact', number: '07', title: 'Impact Inspection', headline: ['IMPACT', 'INSPECTION'],
    action: 'Use a heavy ball on the pins.', joke: 'Please inspect the damage.', accent: 'mustard', zone: 'SOUTHWEST', target: [-6, 13.6],
    sign: { mount: 'ball-drop-platform', center: [-9.988, FLOOR_Y + 2.05, 12], size: [3.5, 1.8], yaw: Math.PI / 2 },
    paint: { center: [-7.3, 10.1], size: [2.4, 2.4], yaw: Math.PI },
  },
  {
    id: 'assembly', number: '08', title: 'Some Assembly Required', headline: ['SOME ASSEMBLY', 'REQUIRED'],
    action: 'Cut a loose container into parts.', joke: 'Instructions were inside.', accent: 'teal', zone: 'WEST DECK', target: [-21.5, 6],
    sign: westPanel(6.8), paint: { center: [-15.4, 5.3], size: [2.4, 2.4], yaw: Math.PI / 2 },
  },
  {
    id: 'balance', number: '09', title: 'Load Balance Office', headline: ['LOAD BALANCE', 'OFFICE'],
    action: 'Put scrap on one end of the plank.', joke: 'Management accepts no weight.', accent: 'mustard', zone: 'WEST INNER', target: [-14, -6],
    sign: westPanel(-6), paint: { center: [-11.5, -5.2], size: [2.4, 2.4], yaw: Math.PI / 2 },
  },
  {
    id: 'warranty', number: '10', title: 'Warranty Reduction', headline: ['WARRANTY', 'REDUCTION'],
    action: 'Cut one lower tower support.', joke: 'Warranty void.', accent: 'rust', zone: 'WEST CENTER', target: [-16, 0],
    sign: westPanel(0), paint: { center: [-14.5, 2.2], size: [2.4, 2.4], yaw: Math.PI / 2 },
  },
  {
    id: 'float', number: '11', title: 'Float Test', headline: ['FLOAT', 'TEST'],
    action: 'Compare a crate and heavy ballast.', joke: 'No refunds below this line.', accent: 'teal', zone: 'CENTER', target: [2.95, 0.55],
    sign: { mount: 'tank-south', center: [2.95, -0.14, 2.194], size: [3.6, 0.87], yaw: 0 },
    paint: { center: [3, 4], size: [2.2, 2.2], yaw: 0 },
  },
  {
    id: 'returns', number: '12', title: 'Delivery / Returns', headline: ['DELIVERY /', 'RETURNS'],
    action: 'Walk through the opening.', joke: 'Your return has already arrived.', accent: 'signalOrange', zone: 'PORTAL BAYS', target: [-2, 20],
    sign: { mount: 'wall-south', center: [-2.3, FLOOR_Y + 2.55, WALL_PANEL_FACE], size: [4.3, 1.8], yaw: Math.PI },
    paint: { center: [-2, 16.7], size: [2.3, 2.3], yaw: Math.PI },
  },
] as const satisfies readonly Department[];

export const DEPARTMENT_DIRECTORY = {
  center: [0, 7.5] as const,
  size: [6, 4.5] as const,
  yaw: 0,
  title: 'SITE DIRECTORY',
} as const;

export const DEPARTMENT_RENDER_BUDGET = { mainSceneDrawCalls: 6, atlasSize: 2048, atlasTiles: 14 } as const;
