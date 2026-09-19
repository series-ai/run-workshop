import * as THREE from 'three';
import { ART_STYLE, type Hex } from './artStyle';

export type SkylineProfileKind = 'furnace' | 'pressFrame' | 'stack' | 'shed' | 'gasHolder';

export type SkylineProfile = {
  kind: SkylineProfileKind;
  azimuthDeg: number;
  width: number;
  height: number;
};

export type SkylineLayer = {
  distance: number;
  baseY: number;
  color: Hex;
  profiles: readonly SkylineProfile[];
};

export function buildProfileShape(profile: SkylineProfile): THREE.Shape {
  const { kind, width, height } = profile;
  const hw = width * 0.5;
  const shape = new THREE.Shape();

  switch (kind) {
    case 'furnace': {
      // Blast furnace silhouette: wider base, tapering shaft, top skip hoist and mantle
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw * 0.9, height * 0.35);
      shape.lineTo(hw * 0.65, height * 0.7);
      shape.lineTo(hw * 0.75, height * 0.75); // catwalk
      shape.lineTo(hw * 0.45, height * 0.9);
      shape.lineTo(hw * 0.2, height); // skip hoist top
      shape.lineTo(-hw * 0.2, height);
      shape.lineTo(-hw * 0.45, height * 0.9);
      shape.lineTo(-hw * 0.75, height * 0.75);
      shape.lineTo(-hw * 0.65, height * 0.7);
      shape.lineTo(-hw * 0.9, height * 0.35);
      shape.closePath();
      break;
    }
    case 'pressFrame': {
      // Massive industrial press A-frame silhouette with high header
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw * 0.8, height * 0.6);
      shape.lineTo(hw * 0.85, height * 0.65);
      shape.lineTo(hw * 0.85, height * 0.95);
      shape.lineTo(hw * 0.5, height);
      shape.lineTo(-hw * 0.5, height);
      shape.lineTo(-hw * 0.85, height * 0.95);
      shape.lineTo(-hw * 0.85, height * 0.65);
      shape.lineTo(-hw * 0.8, height * 0.6);
      shape.closePath();
      break;
    }
    case 'stack': {
      // Tall industrial smokestack with top cowl
      const topHw = hw * 0.65;
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(topHw, height * 0.92);
      shape.lineTo(topHw * 1.3, height * 0.94); // rim
      shape.lineTo(topHw * 1.3, height);
      shape.lineTo(-topHw * 1.3, height);
      shape.lineTo(-topHw * 1.3, height * 0.94);
      shape.lineTo(-topHw, height * 0.92);
      shape.closePath();
      break;
    }
    case 'shed': {
      // Sawtooth industrial mill shed
      const third = width / 3;
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.6);
      // Sawtooth 1
      shape.lineTo(hw - third * 0.2, height);
      shape.lineTo(hw - third, height * 0.6);
      // Sawtooth 2
      shape.lineTo(hw - third * 1.2, height);
      shape.lineTo(hw - third * 2, height * 0.6);
      // Sawtooth 3
      shape.lineTo(hw - third * 2.2, height);
      shape.lineTo(-hw, height * 0.6);
      shape.closePath();
      break;
    }
    case 'gasHolder': {
      // Cylindrical gasometer tank with shallow domed crown
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, height * 0.75);
      shape.quadraticCurveTo(0, height * 1.05, -hw, height * 0.75);
      shape.closePath();
      break;
    }
  }

  return shape;
}

export function computeShapeArea(shape: THREE.Shape): number {
  const pts = shape.getPoints();
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) * 0.5;
}

export const SKYLINE_LAYERS: readonly SkylineLayer[] = [
  // Distant layer: cooler / hazier skyline color, far back
  {
    distance: 140,
    baseY: 4,
    color: ART_STYLE.palette.skyline,
    profiles: [
      { kind: 'stack', azimuthDeg: -38, width: 8, height: 42 },
      { kind: 'furnace', azimuthDeg: -22, width: 28, height: 48 },
      { kind: 'shed', azimuthDeg: -6, width: 34, height: 24 },
      { kind: 'stack', azimuthDeg: 12, width: 9, height: 45 },
      { kind: 'gasHolder', azimuthDeg: 26, width: 32, height: 28 },
      { kind: 'stack', azimuthDeg: 42, width: 7, height: 38 },
    ],
  },
  // Mid-distance layer: darker / crisper silhouette in front of distant layer
  {
    distance: 105,
    baseY: 2,
    color: ART_STYLE.palette.ink,
    profiles: [
      { kind: 'pressFrame', azimuthDeg: -32, width: 24, height: 36 },
      { kind: 'stack', azimuthDeg: -15, width: 6, height: 34 },
      { kind: 'shed', azimuthDeg: 4, width: 30, height: 22 },
      { kind: 'furnace', azimuthDeg: 22, width: 22, height: 38 },
      { kind: 'stack', azimuthDeg: 35, width: 6, height: 36 },
    ],
  },
];
