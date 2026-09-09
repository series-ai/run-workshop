import { Vector3, Quaternion } from "three";
import { PATIENT_LAYOUT } from "./patientLayout";
import type { Location } from "../game/model";

export type Vec3 = [number, number, number];

export interface LiveHandSocket {
  position: Vector3;
  gripPosition: Vector3;
  quaternion: Quaternion;
  isTracking: boolean;
  actionContact: boolean;
}

export function createHandSocket(): LiveHandSocket {
  return {
    position: new Vector3(-0.42, 0.14, 0.22),
    gripPosition: new Vector3(-0.42, 0.14, 0.22),
    quaternion: new Quaternion(),
    isTracking: false,
    actionContact: false,
  };
}

export const LAMP_HANDLE: Vec3 = [-0.15, 0.36, 0.3];

export const INSTRUMENT_TRAY: Vec3 = [-0.55, -0.57, 0.15];

// Default slot positions for locations
export const DEFAULT_SLOTS: Record<Location | string, Vec3> = {
  tray: INSTRUMENT_TRAY,
  cabinet: [-1.15, 0.12, -0.1],
  workbench: [-1, 0.06, 0.4],
  hand: [-0.42, 0.14, 0.22],
  patient: [...PATIENT_LAYOUT.care],
  pillow: [0.32, -0.84, -0.42],
  stand: [-0.72, -0.68, -0.25],
  floor: [0.45, -0.88, 0.55],
  consumed: [0.0, -100.0, 0.0],
};

// Offsets for known items so they sit naturally in containers
export const KNOWN_ITEM_OFFSETS: Record<string, Vec3> = {
  forceps: [-0.08, 0.01, -0.16],
  cloth: [0.08, 0.02, -0.14],
  needle: [-0.07, 0.01, -0.02],
  morphine: [0.06, 0.03, -0.02],
  scalpel: [-0.08, 0.01, 0.12],
  mirror: [0.07, 0.02, 0.12],
  lamp: [0.0, 0.0, 0.0],
  shard: [0.0, 0.02, 0.0],
  release: [0.0, 0.01, 0.22],
  scissors: [-0.04, 0.01, -0.08],
  wig: [-0.02, 0.02, 0.18],
  thread: [-0.05, 0.01, 0.15],
  blade: [-0.06, 0.01, 0.05],
  suture: [-0.07, 0.01, -0.05],
  bandage: [0.06, 0.02, -0.18],
  bowl: [0.02, 0.03, -0.1],
  blanket: [0.0, 0.04, -0.02],
  candle: [0.08, 0.04, 0.08],
  lantern: [0, 0.11, 0],
};

export function getItemSlot(location: string): Vec3 {
  return DEFAULT_SLOTS[location] ?? DEFAULT_SLOTS.tray;
}

export function getItemOffset(itemId: string): Vec3 {
  if (itemId in KNOWN_ITEM_OFFSETS) {
    return KNOWN_ITEM_OFFSETS[itemId];
  }
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash << 5) - hash + itemId.charCodeAt(i);
    hash |= 0;
  }
  const x = ((Math.abs(hash) % 20) - 10) * 0.01;
  const z = ((Math.abs(hash >> 3) % 20) - 10) * 0.015;
  return [x, 0.015, z];
}
