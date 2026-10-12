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
  seamJoint: new THREE.MeshBasicMaterial({ color: "#151716", transparent: true, opacity: 0.25 }),
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

  // Standard PBR Materials
  concreteTarmac: new THREE.MeshStandardMaterial({ color: "#dde0e4", roughness: 0.90, metalness: 0.05 }),
  runwayConcrete: new THREE.MeshStandardMaterial({ color: "#dde0e4", roughness: 0.85, metalness: 0.05 }),
  perimeterWall: new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.8 }),
  fobFoundation: new THREE.MeshStandardMaterial({ color: "#dde0e4", roughness: 0.88, metalness: 0.05 }),
  fobAirlockMat: new THREE.MeshStandardMaterial({ color: "#1e293b", transparent: true, opacity: 0.65, roughness: 0.8 }),
  fobWallSlate: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 }),
  bunkerPillar: new THREE.MeshStandardMaterial({ color: "#494c46", roughness: 0.8 }),
  bunkerDoor: new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.6 }),
  crateStandard: new THREE.MeshStandardMaterial({ color: "#4a3c31", roughness: 0.85 }),
  crateMilitary: new THREE.MeshStandardMaterial({ color: "#2d372e", roughness: 0.75, metalness: 0.1 }),
  crateMedical: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.65, metalness: 0.1 }),
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
};
