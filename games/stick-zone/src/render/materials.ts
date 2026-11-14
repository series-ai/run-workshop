/**
 * @file materials.ts
 * Centralized immutable material and geometry cache.
 * Deduplicates Three.js WebGL material allocations, eliminating redundant shader uniform
 * rebinding and reducing GPU pipeline state switching.
 */
import * as THREE from "three";

// Shared Immutable Basic Materials
export const SharedMaterials = {
  inkBlack: new THREE.MeshBasicMaterial({ color: "#151716" }),
  inkBlackDoubleSided: new THREE.MeshBasicMaterial({ color: "#151716", side: THREE.DoubleSide }),
  seamJoint: new THREE.MeshBasicMaterial({ color: "#475569", transparent: true, opacity: 0.55 }),
  shadowDark: new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.45 }),
  cyanGlow: new THREE.MeshBasicMaterial({ color: "#38bdf8" }),
  cyanVisor: new THREE.MeshBasicMaterial({ color: "#51E5F0" }),
  amberWarning: new THREE.MeshBasicMaterial({ color: "#f59e0b" }),
  goldBullet: new THREE.MeshBasicMaterial({ color: "#fde047" }),
  pelletBullet: new THREE.MeshBasicMaterial({ color: "#fef08a" }),
  redDamage: new THREE.MeshBasicMaterial({ color: "#ef4444" }),
  darkRedOutline: new THREE.MeshBasicMaterial({ color: "#450a0a" }),
  bloodRed: new THREE.MeshBasicMaterial({ color: "#dc2626" }),
  pureWhite: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  targetYellow: new THREE.MeshBasicMaterial({ color: "#facc15" }),
  darkNavy: new THREE.MeshBasicMaterial({ color: "#0f172a" }),
  projectileOutlineBackside: new THREE.MeshBasicMaterial({ color: "#05070a", side: THREE.BackSide }),
  slateJoint: new THREE.MeshBasicMaterial({ color: "#475569" }),
  hazardYellow: new THREE.MeshBasicMaterial({ color: "#eab308" }),
  effluentGreen: new THREE.MeshBasicMaterial({ color: "#10b981", transparent: true, opacity: 0.35 }),

  // Standard PBR Materials
  // Industrial Ground and Foundation
  asphaltGround: new THREE.MeshStandardMaterial({ color: "#1a1f26", roughness: 0.92, metalness: 0.05 }),
  concreteTarmac: new THREE.MeshStandardMaterial({ color: "#252d38", roughness: 0.88, metalness: 0.08 }),
  concretePad: new THREE.MeshStandardMaterial({ color: "#2d3748", roughness: 0.85, metalness: 0.1 }),
  runwayConcrete: new THREE.MeshStandardMaterial({ color: "#252d38", roughness: 0.85, metalness: 0.05 }),
  perimeterWall: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.8 }),
  fobFoundation: new THREE.MeshStandardMaterial({ color: "#1e242c", roughness: 0.88, metalness: 0.05 }),
  fobAirlockMat: new THREE.MeshStandardMaterial({ color: "#1e293b", transparent: true, opacity: 0.65, roughness: 0.8 }),
  fobWallSlate: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 }),
  bunkerPillar: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 }),
  bunkerDoor: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.6 }),
  crateStandard: new THREE.MeshStandardMaterial({ color: "#4a3c31", roughness: 0.85 }),
  crateMilitary: new THREE.MeshStandardMaterial({ color: "#2d372e", roughness: 0.75, metalness: 0.1 }),
  crateMedical: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.65, metalness: 0.1 }),

  // Industrial Runoff Sluice / Drainage Canal
  industrialEffluent: new THREE.MeshStandardMaterial({
    color: "#062c26",
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92,
  }),
  drainageFlumeBed: new THREE.MeshStandardMaterial({ color: "#031714", roughness: 0.95 }),
  culvertWall: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.75, metalness: 0.2 }),
  culvertPipe: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.6, metalness: 0.5 }),

  // Industrial Architecture & Prefabs
  corrugatedWall: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.65, metalness: 0.4 }),
  wallFooting: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8, metalness: 0.2 }),
  steelCoping: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.5, metalness: 0.6 }),
  steelFlange: new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5, metalness: 0.7 }),
  bridgeDeck: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8, metalness: 0.3 }),
  bridgeRailSteel: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.7, metalness: 0.3 }),
  bridgeCurb: new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 }),

  // Foliage Materials (Low-Draw PBR)
  oakBark: new THREE.MeshStandardMaterial({ color: "#382414", roughness: 0.88, metalness: 0.08 }),
  oakCanopy: new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.75 }),
  oakCanopyUpper: new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.75 }),
  oakCanopyDark: new THREE.MeshStandardMaterial({ color: "#14532d", roughness: 0.75 }),
  pineBark: new THREE.MeshStandardMaterial({ color: "#231709", roughness: 0.9 }),
  pineNeedles: new THREE.MeshStandardMaterial({ color: "#065f46", roughness: 0.75 }),
  pineNeedlesMid: new THREE.MeshStandardMaterial({ color: "#047857", roughness: 0.75 }),
  pineNeedlesTop: new THREE.MeshStandardMaterial({ color: "#059669", roughness: 0.75 }),
  bushLeaves: new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.8 }),
  bushLeavesLight: new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.8 }),
  bushLeavesDark: new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.8 }),
};

// Shared Unit Geometries to avoid redundant VBO allocations
export const SharedGeometries = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  unitPlane: new THREE.PlaneGeometry(1, 1),
  unitCircle16: new THREE.CircleGeometry(1, 16),
  projectileCore: new THREE.SphereGeometry(0.055, 10, 10),
  projectileOutline: new THREE.SphereGeometry(0.08, 10, 10),
  projectileTail: (() => {
    const geo = new THREE.CylinderGeometry(0.018, 0.055, 1.0, 8);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -0.5);
    return geo;
  })(),
  projectileShadow: new THREE.CircleGeometry(0.09, 12),

  // Fast low-poly foliage & prefab structures
  treeOakTrunk: new THREE.CylinderGeometry(0.35, 0.42, 3.2, 8),
  treeOakFlare: new THREE.CylinderGeometry(0.42, 0.65, 0.4, 8),
  dodecMain: new THREE.DodecahedronGeometry(1.85, 0),
  dodecUpper: new THREE.DodecahedronGeometry(1.2, 0),
  dodecSideWest: new THREE.DodecahedronGeometry(1.35, 0),
  dodecSideEast: new THREE.DodecahedronGeometry(1.25, 0),
  treePineTrunk: new THREE.CylinderGeometry(0.22, 0.3, 4.2, 8),
  coneBottom: new THREE.ConeGeometry(1.7, 2.1, 6),
  coneMid: new THREE.ConeGeometry(1.3, 1.8, 6),
  coneTop: new THREE.ConeGeometry(0.85, 1.5, 6),
  bushDodec1: new THREE.DodecahedronGeometry(0.75, 0),
  bushDodec2: new THREE.DodecahedronGeometry(0.55, 0),
  bushDodec3: new THREE.DodecahedronGeometry(0.5, 0),
  culvertPipeGeo: (() => {
    const geo = new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12);
    geo.rotateX(Math.PI / 2);
    return geo;
  })(),
};
