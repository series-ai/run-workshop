/** Player slots own their robot design, paint, and tool grip. Coordinates face +Z. */
export const ROBOT_SLOTS = [
  { id: 'scrapper', name: 'Scrapper', note: 'One wheel, camera eye with a shutter',
    colors: { paint: '#e07a2c', trim: '#8a4218', glow: '#ffd66b', flame: '#ff9a3c' },
    seatOffsetY: -0.22, toolGrip: [-0.38, 0.90, 0.24] },
  { id: 'drum', name: 'Drum-Bot', note: 'Oil drum on hydraulic legs, periscope head',
    colors: { paint: '#3f8f84', trim: '#245a53', glow: '#7ff7e1', flame: '#3fd0c0' },
    seatOffsetY: -0.45, toolGrip: [-0.60, 0.82, 0.30] },
  { id: 'tread', name: 'Tread-Bot', note: 'Tracks, CRT head with LED eyes, crane arm',
    colors: { paint: '#dcbd45', trim: '#7d6420', glow: '#ffe066', flame: '#ffc04a' },
    seatOffsetY: -0.28, toolGrip: [-0.38, 0.52, 0.26] },
  { id: 'hover', name: 'Hover-Welder', note: 'Floating shell, flip-up welder mask',
    colors: { paint: '#cc3346', trim: '#6e1824', glow: '#ff9aa6', flame: '#ff5a5a' },
    seatOffsetY: -0.16, toolGrip: [-0.44, 0.70, 0.30] },
] as const;

/** Distance from the tool grip to its nozzle tip, in metres. */
export const ROBOT_TOOL_LENGTH = 0.245;

export type RobotId = typeof ROBOT_SLOTS[number]['id'];

/** Torso tilt in radians. The tool cancels this tilt to keep the player's aim. */
export function robotBodyTilt(id: RobotId, time: number): readonly [number, number] {
  switch (id) {
    case 'scrapper': return [Math.sin(time * 1.6) * 0.04 - 0.04, 0];
    case 'hover': return [0, Math.sin(time * 1.3) * 0.04];
    case 'drum':
    case 'tread': return [0, 0];
  }
}
