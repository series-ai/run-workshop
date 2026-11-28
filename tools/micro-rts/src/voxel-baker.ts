/**
 * True 3/4 Top-Down Volumetric Micro-Pixel Rig Baker (Zero-Dependency).
 *
 * Renders concise 3D articulated anatomical blueprints into razor-sharp, flat-shaded,
 * 8-way (N, NE, E, SE, S, SW, W, NW) pixel-art sprite sheets and 2-layer split
 * (hull + independent turret + contact shadow) sprite sheets using each faction's
 * discrete 3-step palette ramps and single-pass #130f1e exterior outlining.
 *
 * Coordinate convention in blueprint space (unit facing +X = East):
 *   +X = Forward (nose / weapon aim)
 *   +Y = Right flank (starboard)
 *   +Z = Up (height above ground, z=0 is ground contact)
 *
 * Camera projection (true 3/4 RTS orthographic, matching Siege Tank & Wang-16 terrain):
 *   screenX =  cx + worldX
 *   screenY =  cy + worldY * 0.68 - worldZ * 0.88
 *   depth   =  worldY * 0.72 + worldZ * 0.68   (higher = closer to camera)
 *
 * Upper-left directional light is fixed in screen/world space across all 8 headings so
 * lighting never flips or breaks as a unit rotates through 360 degrees.
 */

import {
  buildFactionPalette,
  INK_OUTLINE,
  MINERAL_PALETTE,
  SHADOW_GROUND,
  SHADOW_SOFT,
  type FactionId,
  type TeamColorId,
} from './palette.ts';
import {
  addPixelOutline,
  blitScaled,
  createSurface,
  drawEllipse,
  hexToU32,
  type PixelSurface,
  type RGBA32,
} from './pixel.ts';
import { DIRS_8, type Dir8 } from './units.ts';

export type MaterialId =
  | 'steel'      // Vanguard neutral armor (w / m / s / d)
  | 'darkSteel'  // Vanguard treads / chassis / barrels (s / d / q / k)
  | 'team'       // Team-remappable color ramp (V: b/B/D, K: p/m/u, S: T/t/D)
  | 'amber'      // Emissive warm amber/orange optics, beacons, jets (F / v / f)
  | 'cyan'       // Emissive electric cyan plasma, lenses, shields (C / c / v)
  | 'bone'       // Kraxen ivory bone ribs, tusks, claws, mandibles (o / c / C)
  | 'chitin'     // Kraxen natural warm earthy chitin (h / t / n)
  | 'flesh'      // Kraxen organic wine-plum sinew & underbelly (a / R / r)
  | 'ochre'      // Kraxen warm egg/marrow glow (o / e / c)
  | 'acid'       // Kraxen bioluminescent acid-lime gland (G / g / l)
  | 'gold'       // Solaris sculpted sun-gold masonry/armor (w / y / g / b)
  | 'bronze'     // Solaris dark bronze/obsidian shadow (g / b / D)
  | 'muzzle';    // Attack-only bright weapon flash core (V: F/v/f, K: G/g/l, S: w/C/c)

export type AnimTag =
  | 'none'
  | 'legFL'
  | 'legFR'
  | 'legBL'
  | 'legBR'
  | 'legML'
  | 'legMR'
  | 'wingL'
  | 'wingR'
  | 'tread'
  | 'recoil'
  | 'swingL'
  | 'swingR'
  | 'slam'
  | 'meleeBody'
  | 'muzzle'
  | 'attackOnly'
  | 'tail'
  | 'rotor'
  | 'bob';

export type DetailPattern = 'none' | 'panel' | 'rib' | 'plate';

export interface RigPartBase {
  readonly mat: MaterialId;
  readonly anim?: AnimTag;
  /** Emissive parts ignore directional shadowing and stay bright at 1x. */
  readonly glow?: boolean;
  /** Optional local-space surface breakup (armor seams, chitin ribs, gold masonry fluting). */
  readonly detail?: DetailPattern;
}

export interface BoxPart extends RigPartBase {
  readonly kind: 'box';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

export interface EllipsoidPart extends RigPartBase {
  readonly kind: 'ellipsoid';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
}

export interface SegmentPart extends RigPartBase {
  readonly kind: 'seg';
  /** Start point [x, y, z] */
  readonly a: readonly [number, number, number];
  /** End point [x, y, z] */
  readonly b: readonly [number, number, number];
  /** Radius at start */
  readonly ra: number;
  /** Radius at end (defaults to ra) */
  readonly rb?: number;
}

export interface RingPart extends RigPartBase {
  readonly kind: 'ring';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Major radius in XY plane (or XZ if vertical=true) */
  readonly r: number;
  /** Tube thickness radius */
  readonly tube: number;
  readonly vertical?: boolean;
  /** Optional angular arc [startDeg, endDeg] in degrees (0 = +X, 90 = +Y) */
  readonly arc?: readonly [number, number];
}

export interface WingPart extends RigPartBase {
  readonly kind: 'wing';
  /** Triangle vertices [a, b, c] in local 3D blueprint space */
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly c: readonly [number, number, number];
  readonly thickness?: number;
}

export type RigPart = BoxPart | EllipsoidPart | SegmentPart | RingPart | WingPart;

export type RigFactionId = FactionId | 'neutral';

export interface UnitRigSpec {
  readonly id: string;
  readonly name: string;
  readonly faction: RigFactionId;
  readonly role: string;
  readonly layer: 'ground' | 'air';
  readonly coreW: number;
  readonly coreH: number;
  /** Optional ground contact offset from bottom of core canvas (default 3) */
  readonly baseOffsetY?: number;
  /** True 2-layer split unit (independent hull + aiming turret) */
  readonly twoLayer?: boolean;
  /** Special overlay/segment mode */
  readonly special?: 'worker' | 'rotor' | 'centipede';
  /** Moving chassis / legs / full single-layer body parts */
  readonly parts: readonly RigPart[];
  /** Independent aiming turret / torso / tail-stinger / mortar parts (when twoLayer=true) */
  readonly turretParts?: readonly RigPart[];
  /** Pivot [x, y, z] in local hull space where turret attaches (default [0, 0, 0]) */
  readonly turretPivot?: readonly [number, number, number];
  /** Optional rotor/overlay parts (e.g. V20 spinning blades) */
  readonly overlayParts?: readonly RigPart[];
  /** Optional body & tail segment parts for multi-segment creatures (K18) */
  readonly bodyParts?: readonly RigPart[];
  readonly tailParts?: readonly RigPart[];
}

// Direction angles matching standard RTS compass (E = 0 deg, SE = +45, S = +90, N = -90)
const DIR_ANGLE_RAD: Readonly<Record<Dir8, number>> = {
  N: -Math.PI / 2,
  NE: -Math.PI / 4,
  E: 0,
  SE: Math.PI / 4,
  S: Math.PI / 2,
  SW: (3 * Math.PI) / 4,
  W: Math.PI,
  NW: (-3 * Math.PI) / 4,
};

// Fixed screen-space upper-left directional light (consistent across all 8 headings!)
const LIGHT_X = -0.56;
const LIGHT_Y = -0.44;
const LIGHT_Z = 0.70;

interface MaterialRamp {
  readonly hi: RGBA32;
  readonly mid: RGBA32;
  readonly dark: RGBA32;
  readonly deep: RGBA32;
}

function buildMaterialMap(
  faction: RigFactionId,
  team: TeamColorId = 'default',
): Readonly<Record<MaterialId, MaterialRamp>> {
  if (faction === 'neutral') {
    return {
      steel: { hi: hexToU32('#c2c1bc'), mid: hexToU32('#8d8f8c'), dark: hexToU32('#5d6063'), deep: hexToU32('#373a40') },
      darkSteel: { hi: hexToU32('#625d6b'), mid: hexToU32('#423e4a'), dark: hexToU32('#2a2733'), deep: hexToU32('#1d1a26') },
      team: { hi: hexToU32('#97b06f'), mid: hexToU32('#657d47'), dark: hexToU32('#405230'), deep: hexToU32('#293621') },
      chitin: { hi: hexToU32('#b88961'), mid: hexToU32('#8a5f3e'), dark: hexToU32('#5c3c29'), deep: hexToU32('#3b251c') },
      flesh: { hi: hexToU32('#cf7751'), mid: hexToU32('#9c4c30'), dark: hexToU32('#692f21'), deep: hexToU32('#421c17') },
      bone: { hi: hexToU32('#f0e9d8'), mid: hexToU32('#c9bca6'), dark: hexToU32('#91826e'), deep: hexToU32('#5e5347') },
      ochre: { hi: hexToU32('#e0c38d'), mid: hexToU32('#b8955c'), dark: hexToU32('#85653a'), deep: hexToU32('#573f24') },
      gold: { hi: hexToU32('#c7a561'), mid: hexToU32('#94753d'), dark: hexToU32('#634c27'), deep: hexToU32('#3f301b') },
      bronze: { hi: hexToU32('#755d45'), mid: hexToU32('#523e2d'), dark: hexToU32('#36281f'), deep: hexToU32('#241a15') },
      amber: { hi: hexToU32('#fff2b8'), mid: hexToU32('#ffad38'), dark: hexToU32('#db521d'), deep: hexToU32('#8f2614') },
      cyan: { hi: hexToU32('#e8faff'), mid: hexToU32('#95d8ed'), dark: hexToU32('#5297b5'), deep: hexToU32('#2f5f7a') },
      acid: { hi: hexToU32('#e3ffbd'), mid: hexToU32('#9dd169'), dark: hexToU32('#5c873e'), deep: hexToU32('#355227') },
      muzzle: { hi: hexToU32('#fff7cc'), mid: hexToU32('#ffba4f'), dark: hexToU32('#e05b24'), deep: hexToU32('#8f2614') },
    };
  }
  const p = buildFactionPalette(faction, team);
  if (faction === 'vanguard') {
    return {
      steel: { hi: p.w, mid: p.m, dark: p.s, deep: p.d },
      darkSteel: { hi: p.s, mid: p.d, dark: p.q, deep: p.k },
      team: { hi: p.b, mid: p.B, dark: p.D, deep: p.D },
      amber: { hi: p.F, mid: p.v, dark: p.f, deep: p.f },
      cyan: { hi: p.w, mid: p.c, dark: p.b, deep: p.B },
      bone: { hi: p.w, mid: p.m, dark: p.s, deep: p.d },
      chitin: { hi: p.s, mid: p.d, dark: p.q, deep: p.k },
      flesh: { hi: p.d, mid: p.q, dark: p.k, deep: p.k },
      ochre: { hi: p.F, mid: p.v, dark: p.f, deep: p.f },
      acid: { hi: p.F, mid: p.v, dark: p.f, deep: p.f },
      gold: { hi: p.F, mid: p.v, dark: p.f, deep: p.d },
      bronze: { hi: p.s, mid: p.d, dark: p.q, deep: p.k },
      muzzle: { hi: p.F, mid: p.v, dark: p.f, deep: p.f },
    };
  }
  if (faction === 'kraxen') {
    return {
      steel: { hi: p.o, mid: p.c, dark: p.C, deep: p.n },
      darkSteel: { hi: p.t, mid: p.n, dark: p.r, deep: p.x },
      team: { hi: p.p, mid: p.m, dark: p.u, deep: p.u },
      amber: { hi: p.o, mid: p.e, dark: p.c, deep: p.C },
      cyan: { hi: p.G, mid: p.g, dark: p.l, deep: p.l },
      bone: { hi: p.o, mid: p.c, dark: p.C, deep: p.n },
      chitin: { hi: p.h, mid: p.t, dark: p.n, deep: p.r },
      flesh: { hi: p.a, mid: p.R, dark: p.r, deep: p.x },
      ochre: { hi: p.o, mid: p.e, dark: p.c, deep: p.C },
      acid: { hi: p.G, mid: p.g, dark: p.l, deep: p.l },
      gold: { hi: p.o, mid: p.e, dark: p.c, deep: p.C },
      bronze: { hi: p.t, mid: p.n, dark: p.r, deep: p.x },
      muzzle: { hi: p.G, mid: p.g, dark: p.l, deep: p.l },
    };
  }
  // Solaris
  return {
    steel: { hi: p.y, mid: p.g, dark: p.b, deep: p.D },
    darkSteel: { hi: p.g, mid: p.b, dark: p.D, deep: p.D },
    team: { hi: p.T, mid: p.t, dark: p.D, deep: p.D },
    amber: { hi: p.w, mid: p.y, dark: p.g, deep: p.b },
    cyan: { hi: p.w, mid: p.C, dark: p.c, deep: p.v },
    bone: { hi: p.y, mid: p.g, dark: p.b, deep: p.D },
    chitin: { hi: p.y, mid: p.g, dark: p.b, deep: p.b },
    flesh: { hi: p.g, mid: p.b, dark: p.D, deep: p.D },
    ochre: { hi: p.w, mid: p.y, dark: p.g, deep: p.b },
    acid: { hi: p.w, mid: p.C, dark: p.c, deep: p.v },
    gold: { hi: p.y, mid: p.g, dark: p.b, deep: p.b },
    bronze: { hi: p.g, mid: p.b, dark: p.D, deep: p.D },
    muzzle: { hi: p.w, mid: p.C, dark: p.c, deep: p.v },
  };
}

function pickToneIndex(dot: number, glow: boolean, treadStripe = false): number {
  // 0 = hi, 1 = mid, 2 = dark, 3 = deep
  if (glow) return dot > 0.35 ? 0 : dot > -0.15 ? 1 : 2;
  if (treadStripe) return dot > 0.2 ? 1 : 3;
  if (dot > 0.68) return 0;
  if (dot > 0.14) return 1;
  if (dot > -0.30) return 2;
  return 3;
}

function rampColorAt(ramp: MaterialRamp, toneIdx: number): RGBA32 {
  if (toneIdx <= 0) return ramp.hi;
  if (toneIdx === 1) return ramp.mid;
  if (toneIdx === 2) return ramp.dark;
  return ramp.deep;
}

function isDetailGroove(pattern: DetailPattern, lx: number, ly: number, lz: number): boolean {
  if (pattern === 'none') return false;
  if (pattern === 'panel') {
    // Crisp military hull seams along X and Y grid intervals
    const gx = Math.abs(((lx + 20) % 3.2) - 1.6);
    const gy = Math.abs(((ly + 20) % 3.6) - 1.8);
    return gx < 0.24 || gy < 0.22;
  }
  if (pattern === 'rib') {
    // Organic Kraxen carapace ribs spaced along longitudinal X
    const gx = Math.abs(((lx + 20) % 2.4) - 1.2);
    return gx < 0.34;
  }
  if (pattern === 'plate') {
    // Architectural Solaris stepped fluting along X & Z
    const gx = Math.abs(((lx + 20) % 3.4) - 1.7);
    const gz = Math.abs(((lz + 20) % 2.6) - 1.3);
    return gx < 0.22 || gz < 0.20;
  }
  return false;
}

interface FramePose {
  readonly anim: 'idle' | 'move' | 'attack' | 'death';
  readonly frame: number;
}

function renderPartListToRaw(
  parts: readonly RigPart[],
  coreW: number,
  coreH: number,
  baseOffsetY: number,
  dir: Dir8,
  pose: FramePose,
  faction: RigFactionId,
  team: TeamColorId,
  worldOffset: readonly [number, number, number] = [0, 0, 0],
): { raw: PixelSurface; muzzlePt: readonly [number, number] | null } {
  const mats = buildMaterialMap(faction, team);
  const raw = createSurface(coreW, coreH, 0);
  const totalPx = coreW * coreH;
  const zbuf = new Float32Array(totalPx);
  zbuf.fill(-1e9);
  const partBuf = new Int16Array(totalPx);
  partBuf.fill(-1);
  const matBuf: Array<MaterialId | null> = new Array(totalPx).fill(null);
  const toneBuf = new Int8Array(totalPx);
  const glowBuf = new Uint8Array(totalPx);
  const dotBuf = new Float32Array(totalPx);

  const ang = DIR_ANGLE_RAD[dir];
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  const cx = coreW / 2;
  const cy = coreH - baseOffsetY;

  // Global pose transforms (hover bob, recoil kick, death collapse)
  const isMove = pose.anim === 'move';
  const isAtk = pose.anim === 'attack';
  const isDeath = pose.anim === 'death';
  const phaseRad = (pose.frame * Math.PI) / 2;
  const globalBobZ = isMove ? Math.sin(phaseRad * 2) * 0.45 : pose.anim === 'idle' ? 0 : 0;
  const deathScaleZ = isDeath ? (pose.frame === 0 ? 0.72 : pose.frame === 1 ? 0.42 : 0.22) : 1;
  const deathSpread = isDeath ? (pose.frame === 0 ? 1.08 : pose.frame === 1 ? 1.24 : 1.38) : 1;

  let muzzleSumX = 0;
  let muzzleSumY = 0;
  let muzzleCount = 0;
  let currentPartIdx = 0;
  let currentDetail: DetailPattern = 'none';

  const plotVoxel = (
    lx: number,
    ly: number,
    lz: number,
    nx: number,
    ny: number,
    nz: number,
    mat: MaterialId,
    glow: boolean,
    isMuzzle: boolean,
    treadStripe = false,
  ) => {
    // Apply death scatter/squash cleanly
    let px = lx * deathSpread;
    let py = ly * deathSpread;
    let pz = Math.max(0, lz * deathScaleZ);
    if (isDeath && pose.frame === 2) {
      // Break up wreckage into crisp organic/metallic chunks
      const h = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
      if (h - Math.floor(h) > 0.56) return;
    }

    // Rotate local (px, py) by heading angle into world space
    const wx = px * cosA - py * sinA + worldOffset[0];
    const wy = px * sinA + py * cosA + worldOffset[1];
    const wz = pz + globalBobZ + worldOffset[2];

    // Rotate normal into screen/world light space
    const wnx = nx * cosA - ny * sinA;
    const wny = nx * sinA + ny * cosA;
    const wnz = nz;
    const nlen = Math.hypot(wnx, wny, wnz) || 1;
    const dot = (wnx * LIGHT_X + wny * LIGHT_Y + wnz * LIGHT_Z) / nlen;

    // 3/4 orthographic RTS projection
    const sx = Math.round(cx + wx);
    const sy = Math.round(cy + wy * 0.68 - wz * 0.88);
    if (sx < 0 || sy < 0 || sx >= coreW || sy >= coreH) return;

    const depth = wy * 0.72 + wz * 0.68 + (isMuzzle ? 4.0 : 0);
    const idx = sy * coreW + sx;
    if (depth >= zbuf[idx]) {
      zbuf[idx] = depth;
      partBuf[idx] = currentPartIdx;
      matBuf[idx] = mat;
      dotBuf[idx] = dot;
      const isGlowMat = glow || mat === 'muzzle' || mat === 'cyan' || mat === 'amber' || mat === 'acid';
      glowBuf[idx] = isGlowMat ? 1 : 0;

      let tone = pickToneIndex(dot, isGlowMat, treadStripe);
      if (!isGlowMat && currentDetail !== 'none' && isDetailGroove(currentDetail, lx, ly, lz)) {
        tone = Math.min(3, tone + 1);
      }
      if (isDeath && pose.frame >= 1 && !isGlowMat) {
        tone = dot > 0.3 ? 2 : 3;
      }
      toneBuf[idx] = tone;
      raw.pixels[idx] = rampColorAt(mats[mat], tone);
      if (isMuzzle) {
        muzzleSumX += sx;
        muzzleSumY += sy;
        muzzleCount++;
      }
    }
  };

  // Helper to apply per-part animation offsets in local space
  const animOffset = (tag: AnimTag | undefined): [number, number, number] => {
    if (!tag || tag === 'none') return [0, 0, 0];
    const stride = isMove ? Math.sin(phaseRad) * 1.15 : 0;
    const liftA = isMove ? Math.max(0, Math.cos(phaseRad)) * 0.85 : 0;
    const liftB = isMove ? Math.max(0, -Math.cos(phaseRad)) * 0.85 : 0;
    const recoilX = isAtk ? (pose.frame === 1 ? -1.1 : pose.frame === 2 ? -0.5 : 0) : 0;
    const flapZ = isMove ? Math.sin(phaseRad) * 1.1 : isAtk ? Math.sin(phaseRad) * 0.7 : 0;
    // Snappy melee strike foot-plant offsets synced to F0 windup -> F1 snap -> F2 follow -> F3 recover
    const atkStepF = isAtk ? (pose.frame === 0 ? -0.8 : pose.frame === 1 ? 1.4 : pose.frame === 2 ? 0.8 : 0.2) : 0;

    switch (tag) {
      case 'legFL':
      case 'legBR':
        return [isAtk ? atkStepF : stride, 0, liftA];
      case 'legFR':
      case 'legBL':
        return [isAtk ? atkStepF * 0.5 : -stride, 0, liftB];
      case 'legML':
        return [-stride * 0.7, 0, liftB * 0.7];
      case 'legMR':
        return [stride * 0.7, 0, liftA * 0.7];
      case 'recoil':
        return [recoilX, 0, 0];
      case 'swingL':
        if (!isAtk) return [0, 0, 0];
        if (pose.frame === 0) return [-1.8, -1.1, 1.9]; // Windup: pull back, wide & high
        if (pose.frame === 1) return [3.0, 1.3, -1.3];  // Snap Strike: whip forward, down & inward!
        if (pose.frame === 2) return [1.6, 0.7, -1.0];  // Follow-through drag
        return [0.3, 0.1, -0.2];                        // Recover
      case 'swingR':
        if (!isAtk) return [0, 0, 0];
        if (pose.frame === 0) return [-1.8, 1.1, 1.9];
        if (pose.frame === 1) return [3.0, -1.3, -1.3];
        if (pose.frame === 2) return [1.6, -0.7, -1.0];
        return [0.3, -0.1, -0.2];
      case 'slam':
        if (!isAtk) return [0, 0, 0];
        if (pose.frame === 0) return [-1.8, 0, 2.8];    // Rear up high overhead!
        if (pose.frame === 1) return [3.0, 0, -2.4];    // Smash down & forward!
        if (pose.frame === 2) return [1.8, 0, -1.8];    // Impact hold
        return [0.4, 0, -0.4];
      case 'meleeBody':
        if (!isAtk) return [0, 0, 0];
        if (pose.frame === 0) return [-1.1, 0, 0.35];   // Coil back
        if (pose.frame === 1) return [1.8, 0, -0.35];   // Lunge forward into strike!
        if (pose.frame === 2) return [0.9, 0, -0.1];
        return [0.2, 0, 0];
      case 'wingL':
        return [0, 0, flapZ];
      case 'wingR':
        return [0, 0, flapZ];
      case 'tail':
        return [0, isMove ? Math.sin(phaseRad) * 0.8 : 0, isAtk && pose.frame === 1 ? 1.2 : 0];
      case 'bob':
        return [0, 0, Math.sin(phaseRad) * 0.5];
      default:
        return [0, 0, 0];
    }
  };

  const step = 0.42;

  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];
    currentPartIdx = pIdx;
    currentDetail = part.detail ?? 'none';
    const tag = part.anim ?? 'none';
    const isMuzzle = tag === 'muzzle';
    if (isMuzzle && (!isAtk || (pose.frame !== 1 && pose.frame !== 2))) continue;
    if (tag === 'attackOnly' && (!isAtk || pose.frame === 0)) continue;
    if (isDeath && isMuzzle) continue;

    const [ox, oy, oz] = animOffset(tag);
    const glow = Boolean(part.glow || isMuzzle);
    const isTread = tag === 'tread';

    if (part.kind === 'box') {
      const hx = part.sx / 2;
      const hy = part.sy / 2;
      const hz = part.sz / 2;
      for (let dx = -hx; dx <= hx; dx += step) {
        for (let dy = -hy; dy <= hy; dy += step) {
          for (let dz = -hz; dz <= hz; dz += step) {
            // Only sample shell voxels for speed + clean outward normals
            const ax = hx - Math.abs(dx);
            const ay = hy - Math.abs(dy);
            const az = hz - Math.abs(dz);
            if (ax > step && ay > step && az > step) continue;
            let nx = 0;
            let ny = 0;
            let nz = 0;
            if (az <= ax && az <= ay) nz = dz >= 0 ? 1 : -1;
            else if (ax <= ay) nx = dx >= 0 ? 1 : -1;
            else ny = dy >= 0 ? 1 : -1;
            const treadStripe = isTread && (Math.floor(dx + pose.frame * 0.8) & 1) === 0;
            plotVoxel(part.x + dx + ox, part.y + dy + oy, part.z + dz + oz, nx, ny, nz, part.mat, glow, isMuzzle, treadStripe);
          }
        }
      }
    } else if (part.kind === 'ellipsoid') {
      const { rx, ry, rz } = part;
      for (let dx = -rx; dx <= rx; dx += step) {
        for (let dy = -ry; dy <= ry; dy += step) {
          for (let dz = -rz; dz <= rz; dz += step) {
            const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
            if (d2 > 1.0 || d2 < 0.45) continue;
            plotVoxel(
              part.x + dx + ox,
              part.y + dy + oy,
              part.z + dz + oz,
              dx / (rx * rx),
              dy / (ry * ry),
              dz / (rz * rz),
              part.mat,
              glow,
              isMuzzle,
            );
          }
        }
      }
    } else if (part.kind === 'seg') {
      const [ax, ay, az] = part.a;
      const [bx, by, bz] = part.b;
      const ra = part.ra;
      const rb = part.rb ?? ra;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const nSteps = Math.max(4, Math.ceil(len / 0.38));
      for (let i = 0; i <= nSteps; i++) {
        const t = i / nSteps;
        const cxp = ax + (bx - ax) * t + ox;
        const cyp = ay + (by - ay) * t + oy;
        const czp = az + (bz - az) * t + oz;
        const r = ra + (rb - ra) * t;
        if (r <= 0.55) {
          plotVoxel(cxp, cyp, czp, 0, 0, 1, part.mat, glow, isMuzzle);
        } else {
          for (let dx = -r; dx <= r; dx += step) {
            for (let dy = -r; dy <= r; dy += step) {
              for (let dz = -r; dz <= r; dz += step) {
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 > r * r) continue;
                plotVoxel(cxp + dx, cyp + dy, czp + dz, dx, dy, dz + 0.25, part.mat, glow, isMuzzle);
              }
            }
          }
        }
      }
    } else if (part.kind === 'ring') {
      const [a0, a1] = part.arc ?? [0, 360];
      const steps = Math.max(18, Math.ceil((Math.abs(a1 - a0) / 360) * part.r * 10));
      const spin = tag === 'rotor' ? pose.frame * 45 : 0;
      for (let i = 0; i <= steps; i++) {
        const theta = ((a0 + ((a1 - a0) * i) / steps + spin) * Math.PI) / 180;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        const rx = part.vertical ? part.x : part.x + ct * part.r;
        const ry = part.vertical ? part.y + ct * part.r : part.y + st * part.r;
        const rz = part.vertical ? part.z + st * part.r : part.z;
        const tr = part.tube;
        for (let dx = -tr; dx <= tr; dx += step) {
          for (let dy = -tr; dy <= tr; dy += step) {
            for (let dz = -tr; dz <= tr; dz += step) {
              if (dx * dx + dy * dy + dz * dz > tr * tr) continue;
              plotVoxel(
                rx + dx + ox,
                ry + dy + oy,
                rz + dz + oz,
                part.vertical ? dx : ct + dx * 0.4,
                part.vertical ? ct + dy * 0.4 : st + dy * 0.4,
                part.vertical ? st + dz * 0.4 : dz + 0.5,
                part.mat,
                glow,
                isMuzzle,
              );
            }
          }
        }
      }
    } else if (part.kind === 'wing') {
      const [ax, ay, az] = part.a;
      const [bx, by, bz] = part.b;
      const [cxp, cyp, czp] = part.c;
      // Triangle face normal
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cxp - ax;
      const vy = cyp - ay;
      const vz = czp - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      if (nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const maxEdge = Math.max(
        Math.hypot(ux, uy, uz),
        Math.hypot(vx, vy, vz),
        Math.hypot(cxp - bx, cyp - by, czp - bz),
      );
      const n = Math.max(5, Math.ceil(maxEdge / 0.45));
      const thick = part.thickness ?? 0.5;
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const v = j / n;
          const w = 1 - u - v;
          const px = w * ax + u * bx + v * cxp + ox;
          const py = w * ay + u * by + v * cyp + oy;
          const pz = w * az + u * bz + v * czp + oz;
          plotVoxel(px, py, pz, nx, ny, nz + 0.35, part.mat, glow, isMuzzle);
          if (thick > 0.6) {
            plotVoxel(px, py, pz - 0.6, nx, ny, -0.5, part.mat, glow, isMuzzle);
          }
        }
      }
    }
  }

  // Pixel-art post-sculpt pass: interior depth-crevices + upper-left rim specular catch-lights
  if (!isDeath || pose.frame === 0) {
    for (let y = 0; y < coreH; y++) {
      for (let x = 0; x < coreW; x++) {
        const idx = y * coreW + x;
        const mat = matBuf[idx];
        if (!mat || glowBuf[idx]) continue;

        const z = zbuf[idx];
        const pId = partBuf[idx];
        let tone = toneBuf[idx];

        // 1. Interior AO crease: if an upper-left neighbor belongs to a closer overlapping part,
        // darken this pixel by 1 ramp step so turrets, shields, shoulders & wings separate cleanly!
        let occluded = false;
        const leftIdx = x > 0 ? idx - 1 : -1;
        const upIdx = y > 0 ? idx - coreW : -1;
        if (leftIdx >= 0 && partBuf[leftIdx] !== -1 && partBuf[leftIdx] !== pId && zbuf[leftIdx] - z > 1.25) {
          occluded = true;
        }
        if (upIdx >= 0 && partBuf[upIdx] !== -1 && partBuf[upIdx] !== pId && zbuf[upIdx] - z > 1.25) {
          occluded = true;
        }

        if (occluded) {
          tone = Math.min(3, tone + 1);
        } else {
          // 2. Upper-left silhouette specular rim catch-light (crisp hand-pixelled bevel feel!)
          const topOpen = upIdx < 0 || partBuf[upIdx] === -1;
          const leftOpen = leftIdx < 0 || partBuf[leftIdx] === -1;
          if ((topOpen || leftOpen) && dotBuf[idx] > 0.22 && mat !== 'darkSteel' && mat !== 'bronze' && mat !== 'flesh') {
            tone = Math.max(0, tone - 1);
          }
        }
        raw.pixels[idx] = rampColorAt(mats[mat], tone);
      }
    }
  }

  const muzzlePt: readonly [number, number] | null =
    muzzleCount > 0 ? [Math.round(muzzleSumX / muzzleCount), Math.round(muzzleSumY / muzzleCount)] : null;
  return { raw, muzzlePt };
}

export interface BakedUnitResult {
  readonly id: string;
  readonly cellW: number;
  readonly cellH: number;
  readonly twoLayer: boolean;
  /** Standard 8-row x 12-col sheet (idle[1], move[4], attack[4], death[3]) */
  readonly sheet8Way: PixelSurface;
  /** Optional 2-layer independent sheets (when twoLayer=true) */
  readonly hullSheet?: PixelSurface;    // 8 rows x 4 move phases
  readonly turretSheet?: PixelSurface;  // 8 rows x 4 attack/recoil frames
  readonly shadowSheet?: PixelSurface;  // 8 rows x 1 contact shadow
  readonly muzzleRel8: Readonly<Record<Dir8, readonly [number, number]>>;
  readonly pivotPx: readonly [number, number];
  /** Optional special sheets */
  readonly overlaySheet?: PixelSurface; // 2-frame spinning rotor overlay (V20)
  readonly bodySheet?: PixelSurface;    // 8x4 trailing body segment (K18)
  readonly tailSheet?: PixelSurface;    // 8x4 trailing tail segment (K18)
}

function buildShadowFromRaw(raw: PixelSurface, isAir: boolean): PixelSurface {
  const outW = raw.width + 2;
  const outH = raw.height + 2;
  const sh = createSurface(outW, outH, 0);
  let minX = raw.width;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      if ((raw.pixels[y * raw.width + x] >>> 24) > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return sh;
  const rx = Math.max(3, Math.round((maxX - minX + 1) * (isAir ? 0.34 : 0.42)));
  const ry = Math.max(2, Math.round(rx * 0.36));
  const cx = Math.round((minX + maxX) / 2) + 1;
  const cy = Math.min(outH - 2, maxY + 1);
  drawEllipse(sh, cx, cy, rx, ry, isAir ? SHADOW_SOFT : SHADOW_GROUND);
  return sh;
}

export function bakeRigUnit(spec: UnitRigSpec, team: TeamColorId = 'default'): BakedUnitResult {
  const baseY = spec.baseOffsetY ?? (spec.layer === 'air' ? Math.round(spec.coreH * 0.44) : Math.max(3, Math.round(spec.coreH * 0.2)));
  const cellW = spec.coreW + 2;
  const cellH = spec.coreH + 2;
  const cols = 12; // idle[1] + move[4] + attack[4] + death[3]
  const sheet8Way = createSurface(cellW * cols, cellH * 8, 0);
  const pivot = spec.turretPivot ?? [0, 0, 0];

  const muzzleRel8 = {} as Record<Dir8, readonly [number, number]>;
  const hullSheet = spec.twoLayer ? createSurface(cellW * 4, cellH * 8, 0) : undefined;
  const turretSheet = spec.twoLayer ? createSurface(cellW * 4, cellH * 8, 0) : undefined;
  const shadowSheet = spec.twoLayer ? createSurface(cellW, cellH * 8, 0) : undefined;

  const combinedParts: readonly RigPart[] =
    spec.twoLayer && spec.turretParts
      ? [
          ...spec.parts,
          ...spec.turretParts.map((tp) => shiftPart(tp, pivot)),
        ]
      : spec.parts;

  const poses: readonly FramePose[] = [
    { anim: 'idle', frame: 0 },
    { anim: 'move', frame: 0 },
    { anim: 'move', frame: 1 },
    { anim: 'move', frame: 2 },
    { anim: 'move', frame: 3 },
    { anim: 'attack', frame: 0 },
    { anim: 'attack', frame: 1 },
    { anim: 'attack', frame: 2 },
    { anim: 'attack', frame: 3 },
    { anim: 'death', frame: 0 },
    { anim: 'death', frame: 1 },
    { anim: 'death', frame: 2 },
  ];

  for (let dIdx = 0; dIdx < DIRS_8.length; dIdx++) {
    const dir = DIRS_8[dIdx];
    let dirMuzzle: readonly [number, number] = [0, 0];

    for (let c = 0; c < poses.length; c++) {
      const { raw, muzzlePt } = renderPartListToRaw(
        combinedParts,
        spec.coreW,
        spec.coreH,
        baseY,
        dir,
        poses[c],
        spec.faction,
        team,
      );
      const outlined = addPixelOutline(raw, INK_OUTLINE);
      blitScaled(sheet8Way, outlined, c * cellW, dIdx * cellH, 1);
      if (poses[c].anim === 'attack' && poses[c].frame === 1 && muzzlePt) {
        dirMuzzle = [muzzlePt[0] - Math.floor(spec.coreW / 2), muzzlePt[1] - (spec.coreH - baseY)];
      }
    }
    muzzleRel8[dir] = dirMuzzle;

    if (spec.twoLayer && spec.turretParts && hullSheet && turretSheet && shadowSheet) {
      // 4 move phases for Hull layer
      for (let f = 0; f < 4; f++) {
        const { raw: hRaw } = renderPartListToRaw(
          spec.parts,
          spec.coreW,
          spec.coreH,
          baseY,
          dir,
          { anim: 'move', frame: f },
          spec.faction,
          team,
        );
        blitScaled(hullSheet, addPixelOutline(hRaw, INK_OUTLINE), f * cellW, dIdx * cellH, 1);
        if (f === 0) {
          blitScaled(shadowSheet, buildShadowFromRaw(hRaw, spec.layer === 'air'), 0, dIdx * cellH, 1);
        }
      }
      // 4 attack/recoil frames for Independent Turret layer (positioned at turretPivot Z height!)
      const turretShifted = spec.turretParts.map((tp) => shiftPart(tp, [0, 0, pivot[2]]));
      for (let f = 0; f < 4; f++) {
        const { raw: tRaw, muzzlePt } = renderPartListToRaw(
          turretShifted,
          spec.coreW,
          spec.coreH,
          baseY,
          dir,
          { anim: 'attack', frame: f },
          spec.faction,
          team,
        );
        blitScaled(turretSheet, addPixelOutline(tRaw, INK_OUTLINE), f * cellW, dIdx * cellH, 1);
        if (f === 1 && muzzlePt) {
          muzzleRel8[dir] = [muzzlePt[0] - Math.floor(spec.coreW / 2), muzzlePt[1] - (spec.coreH - baseY)];
        }
      }
    }
  }

  // Optional 2-frame spinning rotor overlay (V20)
  let overlaySheet: PixelSurface | undefined;
  if (spec.overlayParts) {
    overlaySheet = createSurface(cellW * 2, cellH * 8, 0);
    for (let dIdx = 0; dIdx < DIRS_8.length; dIdx++) {
      for (let f = 0; f < 2; f++) {
        const { raw } = renderPartListToRaw(
          spec.overlayParts,
          spec.coreW,
          spec.coreH,
          baseY,
          DIRS_8[dIdx],
          { anim: 'move', frame: f },
          spec.faction,
          team,
        );
        blitScaled(overlaySheet, addPixelOutline(raw, INK_OUTLINE), f * cellW, dIdx * cellH, 1);
      }
    }
  }

  // Optional trailing body & tail sheets (K18 Bone-Centipede)
  let bodySheet: PixelSurface | undefined;
  let tailSheet: PixelSurface | undefined;
  if (spec.bodyParts && spec.tailParts) {
    bodySheet = createSurface(cellW * 4, cellH * 8, 0);
    tailSheet = createSurface(cellW * 4, cellH * 8, 0);
    for (let dIdx = 0; dIdx < DIRS_8.length; dIdx++) {
      for (let f = 0; f < 4; f++) {
        const { raw: bRaw } = renderPartListToRaw(spec.bodyParts, spec.coreW, spec.coreH, baseY, DIRS_8[dIdx], { anim: 'move', frame: f }, spec.faction, team);
        const { raw: tRaw } = renderPartListToRaw(spec.tailParts, spec.coreW, spec.coreH, baseY, DIRS_8[dIdx], { anim: 'move', frame: f }, spec.faction, team);
        blitScaled(bodySheet, addPixelOutline(bRaw, INK_OUTLINE), f * cellW, dIdx * cellH, 1);
        blitScaled(tailSheet, addPixelOutline(tRaw, INK_OUTLINE), f * cellW, dIdx * cellH, 1);
      }
    }
  }

  return {
    id: spec.id,
    cellW,
    cellH,
    twoLayer: Boolean(spec.twoLayer),
    sheet8Way,
    hullSheet,
    turretSheet,
    shadowSheet,
    muzzleRel8,
    pivotPx: [Math.floor(cellW / 2), Math.max(0, cellH - baseY - Math.round(pivot[2] * 0.88))],
    overlaySheet,
    bodySheet,
    tailSheet,
  };
}

/** Composes a two-layer unit at ANY (hullDir, turretDir) pair for proof & runtime previews. */
export function composeBakedTwoLayer(
  spec: UnitRigSpec,
  hullDir: Dir8,
  turretDir: Dir8,
  moveFrame = 0,
  atkFrame = 0,
  team: TeamColorId = 'default',
): PixelSurface {
  const baseY = spec.baseOffsetY ?? (spec.layer === 'air' ? Math.round(spec.coreH * 0.44) : Math.max(3, Math.round(spec.coreH * 0.2)));
  const pivot = spec.turretPivot ?? [0, 0, 0];
  const { raw: hRaw } = renderPartListToRaw(
    spec.parts,
    spec.coreW,
    spec.coreH,
    baseY,
    hullDir,
    { anim: 'move', frame: moveFrame },
    spec.faction,
    team,
  );
  const hullAng = DIR_ANGLE_RAD[hullDir];
  const worldPivot: readonly [number, number, number] = [
    pivot[0] * Math.cos(hullAng) - pivot[1] * Math.sin(hullAng),
    pivot[0] * Math.sin(hullAng) + pivot[1] * Math.cos(hullAng),
    pivot[2],
  ];
  const { raw: tRaw } = renderPartListToRaw(
    spec.turretParts ?? [],
    spec.coreW,
    spec.coreH,
    baseY,
    turretDir,
    { anim: 'attack', frame: atkFrame },
    spec.faction,
    team,
    worldPivot,
  );
  const combined = createSurface(spec.coreW, spec.coreH, 0);
  combined.pixels.set(hRaw.pixels);
  for (let i = 0; i < combined.pixels.length; i++) {
    if ((tRaw.pixels[i] >>> 24) > 0) combined.pixels[i] = tRaw.pixels[i];
  }
  return addPixelOutline(combined, INK_OUTLINE);
}

/** Exports the shared mineral-crystal carry overlay sprite for all 9 workers. */
export function buildWorkerMineralCarryOverlay(): PixelSurface {
  const raw = createSurface(5, 5, 0);
  const set = (x: number, y: number, k: keyof typeof MINERAL_PALETTE) => {
    raw.pixels[y * 5 + x] = MINERAL_PALETTE[k];
  };
  set(2, 0, 'w');
  set(2, 1, 'c');
  set(1, 2, 'c');
  set(2, 2, 'b');
  set(3, 2, 'c');
  set(1, 3, 'b');
  set(2, 3, 'b');
  set(3, 3, 'd');
  set(2, 4, 'd');
  return addPixelOutline(raw, INK_OUTLINE);
}

function shiftPart(p: RigPart, d: readonly [number, number, number]): RigPart {
  const [dx, dy, dz] = d;
  if (p.kind === 'box') return { ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz };
  if (p.kind === 'ellipsoid') return { ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz };
  if (p.kind === 'ring') return { ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz };
  if (p.kind === 'seg') {
    return {
      ...p,
      a: [p.a[0] + dx, p.a[1] + dy, p.a[2] + dz],
      b: [p.b[0] + dx, p.b[1] + dy, p.b[2] + dz],
    };
  }
  return {
    ...p,
    a: [p.a[0] + dx, p.a[1] + dy, p.a[2] + dz],
    b: [p.b[0] + dx, p.b[1] + dy, p.b[2] + dz],
    c: [p.c[0] + dx, p.c[1] + dy, p.c[2] + dz],
  };
}
