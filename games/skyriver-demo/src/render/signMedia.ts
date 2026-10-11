/**
 * @file signMedia.ts - R47 media layer definitions, ad atlas generation, and metadata.
 *
 * This file defines media categories, motion classes, ad metadata, and atlas drawing.
 */

import * as THREE from 'three';

export const MEDIA_ATLAS_WIDTH = 2048;
export const MEDIA_ATLAS_HEIGHT = 2048;

/** The ten required advertising categories. */
export const MEDIA_CATEGORIES = [
  'food',
  'mood',
  'body_mods',
  'memory',
  'water',
  'insurance',
  'sleep',
  'air',
  'vat_protein',
  'loyalty',
] as const;

export type MediaCategory = typeof MEDIA_CATEGORIES[number];

/** Six motion classes plus static class. */
export const MEDIA_MOTION_CLASSES = [
  'static',
  'chase_border',
  'tube_accents',
  'wrapping_ticker',
  'frame_flip',
  'intensity_breathe',
  'quantized_sprites',
] as const;

export type MediaMotionClass = typeof MEDIA_MOTION_CLASSES[number];

export interface MediaFrameRect {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface MediaAdDefinition {
  readonly id: string;
  readonly category: MediaCategory;
  readonly brandName: string;
  readonly tagLine: string;
  readonly priceOrCountdown: string;
  readonly fakeLines: readonly string[];
  readonly markVariant: number;
  readonly silhouetteVariant: number;
}

export interface MediaAdMetadata {
  readonly id: string;
  readonly category: MediaCategory;
  readonly brandName: string;
  readonly tagLine: string;
  readonly priceOrCountdown: string;
  readonly frameCount: number;
  readonly frames: readonly MediaFrameRect[];
  readonly isVertical: boolean;
  readonly isHologram: boolean;
}

export interface SignMediaAtlas {
  readonly texture: THREE.Texture;
  readonly horizontalAds: readonly MediaAdMetadata[];
  readonly hologramAds: readonly MediaAdMetadata[];
  readonly allAds: readonly MediaAdMetadata[];
  readonly width: number;
  readonly height: number;
  dispose(): void;
}

/** Definitions for the ten categories of advertisements. */
export const AD_DEFINITIONS: readonly MediaAdDefinition[] = Object.freeze([
  {
    id: 'ad-food',
    category: 'food',
    brandName: 'SYNTH-RAMEN',
    tagLine: 'HOT BROTH 24H',
    priceOrCountdown: '450 CR',
    fakeLines: ['CAL 420 // SODIUM 12mg // AMINO-9', 'PURE VAT BROTH // NO SYNTH ODOR'],
    markVariant: 0,
    silhouetteVariant: 0,
  },
  {
    id: 'ad-mood',
    category: 'mood',
    brandName: 'NEURO-CALM',
    tagLine: 'SEROTONIN BURST',
    priceOrCountdown: '99.5 CR',
    fakeLines: ['DELTA RECEPTOR ACTIVE // ZERO CRASH', 'CLINICAL GRADE // RECEPTOR SYNC'],
    markVariant: 1,
    silhouetteVariant: 1,
  },
  {
    id: 'ad-body-mods',
    category: 'body_mods',
    brandName: 'KROM-OPTIX',
    tagLine: 'MARK IV CYBER-EYE',
    priceOrCountdown: '2,400 CR',
    fakeLines: ['OPTICAL ZOOM 120X // NIGHT GAIN', 'FULL NEURAL LINK // TITANIUM CASE'],
    markVariant: 2,
    silhouetteVariant: 2,
  },
  {
    id: 'ad-memory',
    category: 'memory',
    brandName: 'MNEMO-VAULT',
    tagLine: 'CRYSTAL BACKUP',
    priceOrCountdown: '00:14:59',
    fakeLines: ['1024 TB SECURE RECALL // ENCRYPTED', 'PREVENT SYNAPSE DECAY // BACKUP NOW'],
    markVariant: 3,
    silhouetteVariant: 3,
  },
  {
    id: 'ad-water',
    category: 'water',
    brandName: 'AQUA-VAPOR',
    tagLine: '99.9% PURE H2O',
    priceOrCountdown: '120 CR',
    fakeLines: ['TRIPLE CONDENSED // HEAVY METALS 0%', 'DEEP SKY RESERVOIR // CHILLED TANK'],
    markVariant: 4,
    silhouetteVariant: 4,
  },
  {
    id: 'ad-insurance',
    category: 'insurance',
    brandName: 'TRAUMA-AEGIS',
    tagLine: '60s MED-EVAC',
    priceOrCountdown: '340 CR/MO',
    fakeLines: ['AIR AMBULANCE DISPATCH // IMMEDIATE', 'FULL BODY RECONSTRUCTION INCLUDED'],
    markVariant: 5,
    silhouetteVariant: 5,
  },
  {
    id: 'ad-sleep',
    category: 'sleep',
    brandName: 'SOMNO-STASIS',
    tagLine: '8H SLEEP IN 8M',
    priceOrCountdown: '180 CR',
    fakeLines: ['DELTA WAVE INDUCTION // RAPID REPAIR', 'CYBER-STASIS CELL // SOUND ISOLATED'],
    markVariant: 6,
    silhouetteVariant: 6,
  },
  {
    id: 'ad-air',
    category: 'air',
    brandName: 'O2-SCRUBBED',
    tagLine: 'PURE SKY OXYGEN',
    priceOrCountdown: '85 CR',
    fakeLines: ['FILTER PARTICULATE PM0.1 // 100% O2', 'POCKET CANISTER // 48H COMPACT AIR'],
    markVariant: 7,
    silhouetteVariant: 7,
  },
  {
    id: 'ad-vat-protein',
    category: 'vat_protein',
    brandName: 'MYO-SYNTH',
    tagLine: 'GRADE-A PROTEIN',
    priceOrCountdown: '210 CR',
    fakeLines: ['50G PURE PEPTIDE // NO RESIDUE', 'CELLULAR CULTIVATION LOT 884'],
    markVariant: 8,
    silhouetteVariant: 8,
  },
  {
    id: 'ad-loyalty',
    category: 'loyalty',
    brandName: 'CITIZEN-PLUS',
    tagLine: 'TIER 7 STATUS',
    priceOrCountdown: '999,990 PT',
    fakeLines: ['FAST-TRACK SKYWAY // CORPO LOUNGE', 'UNRESTRICTED DISTRICT CROSSING'],
    markVariant: 9,
    silhouetteVariant: 9,
  },
]);

/**
 * Selects motion class and initial phase from a numerical seed.
 * Produces approximately forty percent static signs.
 * Distributes remaining sixty percent evenly across six animated classes.
 */
export function deriveMediaMotion(seed: number): { motionClass: number; phase: number } {
  const norm = ((seed % 1) + 1) % 1;
  const hash = Math.floor(norm * 10000);
  const phase = (hash % 1000) / 1000;
  // Forty percent static (hash % 10 < 4).
  if (hash % 10 < 4) {
    return { motionClass: 0, phase };
  }
  // Sixty percent divided among classes 1 through 6.
  const animatedClass = 1 + (Math.floor(hash / 10) % 6);
  return { motionClass: animatedClass, phase };
}

function rectFor(x: number, y: number, w: number, h: number): MediaFrameRect {
  return {
    u0: x / MEDIA_ATLAS_WIDTH,
    v0: 1 - (y + h) / MEDIA_ATLAS_HEIGHT,
    u1: (x + w) / MEDIA_ATLAS_WIDTH,
    v1: 1 - y / MEDIA_ATLAS_HEIGHT,
  };
}

/** Draws an invented logo mark into context. */
function drawInventedMark(ctx: CanvasRenderingContext2D, variant: number, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

  switch (variant % 10) {
    case 0: // Food: bowl outline with steam arcs
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.6, 0, Math.PI);
      ctx.lineTo(r * 0.6, r * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.1);
      ctx.quadraticCurveTo(-r * 0.1, -r * 0.5, -r * 0.2, -r * 0.8);
      ctx.moveTo(0, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.5, r * 0.1, -r * 0.8);
      ctx.moveTo(r * 0.3, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.5, r * 0.4, -r * 0.8);
      ctx.stroke();
      break;

    case 1: // Mood: concentric brain pulse rings
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 2: // Body mod: cybernetic aperture / crosshair
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 0.3, 0);
      ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 0.9, 0);
      ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 0.3);
      ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r * 0.9);
      ctx.stroke();
      ctx.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4);
      break;

    case 3: // Memory: crystalline rhombus diamond
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.75, 0);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 0.75, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.4);
      ctx.lineTo(r * 0.35, 0);
      ctx.lineTo(0, r * 0.4);
      ctx.lineTo(-r * 0.35, 0);
      ctx.closePath();
      ctx.fill();
      break;

    case 4: // Water: triple droplet formation
      for (let k = 0; k < 3; k += 1) {
        const ang = (k * Math.PI * 2) / 3 - Math.PI / 2;
        const dx = Math.cos(ang) * r * 0.4;
        const dy = Math.sin(ang) * r * 0.4;
        ctx.beginPath();
        ctx.arc(dx, dy, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 5: // Insurance: medical cross inside hex shield
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * r * 0.8;
        const y = Math.sin(a) * r * 0.8;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(-r * 0.12, -r * 0.45, r * 0.24, r * 0.9);
      ctx.fillRect(-r * 0.45, -r * 0.12, r * 0.9, r * 0.24);
      break;

    case 6: // Sleep: crescent moon and stasis wave
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, -Math.PI * 0.4, Math.PI * 0.7);
      ctx.quadraticCurveTo(-r * 0.1, 0, 0, -r * 0.7);
      ctx.fill();
      break;

    case 7: // Air: turbine cyclone lines
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.arc(r * 0.35, 0, r * 0.35, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }
      break;

    case 8: // Vat protein: interlocking hexagon DNA lattice
      ctx.beginPath();
      ctx.rect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0);
      ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6);
      ctx.stroke();
      ctx.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
      break;

    case 9: // Loyalty: star badge with ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const ra = r * 0.6;
        const rb = r * 0.28;
        const ax = Math.cos(a) * ra;
        const ay = Math.sin(a) * ra;
        const bx = Math.cos(a + Math.PI / 5) * rb;
        const by = Math.sin(a + Math.PI / 5) * rb;
        if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** Draws a category-specific product silhouette into context. */
function drawProductSilhouette(
  ctx: CanvasRenderingContext2D,
  variant: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  frame: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const cycle = (frame % 4) * 0.25;
  const pulse = Math.sin(cycle * Math.PI * 2) * 0.08;
  ctx.scale(1 + pulse, 1 + pulse);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = 'rgba(180, 255, 180, 0.9)';
  ctx.lineWidth = 2.5;

  const hw = w * 0.45;
  const hh = h * 0.45;

  switch (variant % 10) {
    case 0: // Food: ramen bowl silhouette with noodles
      ctx.beginPath();
      ctx.arc(0, hh * 0.1, hw, 0, Math.PI);
      ctx.lineTo(hw, hh * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, hh * 0.1, hw, hh * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-hw * 0.25, hh * 0.9, hw * 0.5, hh * 0.18);
      break;

    case 1: // Mood: capsule medicine pill angled
      ctx.save();
      ctx.rotate(-0.35 + cycle * 0.15);
      ctx.beginPath();
      ctx.roundRect(-hw * 0.35, -hh * 0.75, hw * 0.7, hh * 1.5, hw * 0.35);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-hw * 0.35, 0); ctx.lineTo(hw * 0.35, 0);
      ctx.stroke();
      ctx.restore();
      break;

    case 2: // Body mod: bionic hand / robotic arm
      ctx.beginPath();
      ctx.rect(-hw * 0.4, hh * 0.1, hw * 0.8, hh * 0.8);
      ctx.fill();
      for (let f = 0; f < 4; f += 1) {
        const fx = -hw * 0.35 + f * hw * 0.24;
        const fy = -hh * (0.4 + (f === 1 ? 0.35 : f === 2 ? 0.3 : 0.2));
        ctx.fillRect(fx, fy, hw * 0.16, hh * 0.6);
      }
      ctx.strokeRect(-hw * 0.4, hh * 0.1, hw * 0.8, hh * 0.8);
      break;

    case 3: // Memory: crystalline storage drive cartridge
      ctx.beginPath();
      ctx.moveTo(-hw * 0.6, -hh * 0.7);
      ctx.lineTo(hw * 0.2, -hh * 0.7);
      ctx.lineTo(hw * 0.6, -hh * 0.3);
      ctx.lineTo(hw * 0.6, hh * 0.8);
      ctx.lineTo(-hw * 0.6, hh * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#101010';
      ctx.fillRect(-hw * 0.4, -hh * 0.3, hw * 0.8, hh * 0.5);
      break;

    case 4: // Water: contoured water bottle flask
      ctx.beginPath();
      ctx.rect(-hw * 0.2, -hh * 0.85, hw * 0.4, hh * 0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-hw * 0.2, -hh * 0.65);
      ctx.lineTo(-hw * 0.55, -hh * 0.3);
      ctx.lineTo(-hw * 0.5, hh * 0.75);
      ctx.lineTo(hw * 0.5, hh * 0.75);
      ctx.lineTo(hw * 0.55, -hh * 0.3);
      ctx.lineTo(hw * 0.2, -hh * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case 5: // Insurance: medical shield vehicle badge
      ctx.beginPath();
      ctx.moveTo(0, -hh * 0.85);
      ctx.lineTo(hw * 0.75, -hh * 0.45);
      ctx.lineTo(hw * 0.65, hh * 0.35);
      ctx.lineTo(0, hh * 0.85);
      ctx.lineTo(-hw * 0.65, hh * 0.35);
      ctx.lineTo(-hw * 0.75, -hh * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#101010';
      ctx.fillRect(-hw * 0.15, -hh * 0.4, hw * 0.3, hh * 0.8);
      ctx.fillRect(-hw * 0.4, -hh * 0.15, hw * 0.8, hh * 0.3);
      break;

    case 6: // Sleep: horizontal stasis hibernation capsule
      ctx.beginPath();
      ctx.roundRect(-hw * 0.85, -hh * 0.45, hw * 1.7, hh * 0.9, hh * 0.45);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#101010';
      ctx.beginPath();
      ctx.ellipse(0, 0, hw * 0.5, hh * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 7: // Air: oxygen twin-tank canister
      ctx.beginPath();
      ctx.roundRect(-hw * 0.6, -hh * 0.7, hw * 0.5, hh * 1.4, hw * 0.25);
      ctx.roundRect(hw * 0.1, -hh * 0.7, hw * 0.5, hh * 1.4, hw * 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-hw * 0.4, -hh * 0.85, hw * 0.8, hh * 0.18);
      break;

    case 8: // Vat protein: marbled synthetic protein steak slab
      ctx.beginPath();
      ctx.moveTo(-hw * 0.7, -hh * 0.4);
      ctx.quadraticCurveTo(0, -hh * 0.75, hw * 0.7, -hh * 0.35);
      ctx.quadraticCurveTo(hw * 0.8, hh * 0.5, hw * 0.3, hh * 0.7);
      ctx.quadraticCurveTo(-hw * 0.6, hh * 0.75, -hw * 0.7, -hh * 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#101010';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.3, -hh * 0.2); ctx.lineTo(hw * 0.2, hh * 0.3);
      ctx.moveTo(-hw * 0.1, -hh * 0.4); ctx.lineTo(hw * 0.4, hh * 0.1);
      ctx.stroke();
      break;

    case 9: // Loyalty: smart credit card chip
      ctx.beginPath();
      ctx.roundRect(-hw * 0.8, -hh * 0.6, hw * 1.6, hh * 1.2, hh * 0.15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#101010';
      ctx.fillRect(-hw * 0.5, -hh * 0.25, hw * 0.4, hh * 0.5);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(-hw * 0.5, -hh * 0.25, hw * 0.4, hh * 0.5);
      break;
  }

  ctx.restore();
}

/** Draws dense fake line and barcode micro-copy. */
function drawDenseFakeLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  x: number,
  y: number,
  w: number,
  fontSize = 9,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(210, 240, 210, 0.75)';
  ctx.font = `600 ${fontSize}px monospace`;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * (fontSize + 3));
  });
  // Barcode pattern at bottom
  const barcodeY = y + lines.length * (fontSize + 3) + 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  for (let k = 0; k < Math.min(w, 140); k += 4) {
    const bit = (k * 13 + indexSeed(lines[0] ?? '')) % 7;
    if (bit > 2) {
      ctx.fillRect(x + k, barcodeY, bit > 4 ? 2.5 : 1.2, 7);
    }
  }
  ctx.restore();
}

function indexSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface CategoryPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly bg: string;
}

const CATEGORY_PALETTES: Readonly<Record<MediaCategory, CategoryPalette>> = Object.freeze({
  food: { primary: '#ff9922', secondary: '#ffdd66', accent: '#ff4422', bg: '#140c06' },
  mood: { primary: '#cc44ff', secondary: '#ee88ff', accent: '#33ffff', bg: '#100614' },
  body_mods: { primary: '#ff2255', secondary: '#ff6688', accent: '#44ffcc', bg: '#14060a' },
  memory: { primary: '#22ccff', secondary: '#88eeff', accent: '#ff44aa', bg: '#060e14' },
  water: { primary: '#22eecc', secondary: '#88ffee', accent: '#3388ff', bg: '#041210' },
  insurance: { primary: '#33ff88', secondary: '#99ffbb', accent: '#ffff44', bg: '#06140a' },
  sleep: { primary: '#8866ff', secondary: '#bb99ff', accent: '#44eedd', bg: '#0a0614' },
  air: { primary: '#33eebb', secondary: '#aaffdd', accent: '#33aaff', bg: '#061210' },
  vat_protein: { primary: '#ff4488', secondary: '#ff99bb', accent: '#66ff44', bg: '#14060e' },
  loyalty: { primary: '#ffcc22', secondary: '#ffee77', accent: '#ff4444', bg: '#141004' },
});

/**
 * Draws one horizontal advertisement frame into canvas.
 * Dimensions: 512 x 128.
 * Four cuts have distinct layouts:
 * Cut 0: Brand Hero.
 * Cut 1: Promo Flash / Sale Banner.
 * Cut 2: Technical Telemetry / Equaliser.
 * Cut 3: Retail Dispenser CTA / QR Matrix.
 */
function drawHorizontalAdFrame(
  ctx: CanvasRenderingContext2D,
  ad: MediaAdDefinition,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const pal = CATEGORY_PALETTES[ad.category] ?? {
    primary: '#33ffff',
    secondary: '#ffffff',
    accent: '#ffcc00',
    bg: '#060a0f',
  };

  const cut = frame % 4;

  if (cut === 0) {
    // Cut 0: Brand Hero
    ctx.fillStyle = pal.bg;
    ctx.fillRect(x, y, w, h);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = x + 16; gx < x + w; gx += 32) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    // Corner tabs
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x + 2, y + 2, 10, 3); ctx.fillRect(x + 2, y + 2, 3, 10);
    ctx.fillRect(x + w - 12, y + 2, 10, 3); ctx.fillRect(x + w - 5, y + 2, 3, 10);
    ctx.fillRect(x + 2, y + h - 5, 10, 3); ctx.fillRect(x + 2, y + h - 12, 3, 10);
    ctx.fillRect(x + w - 12, y + h - 5, 10, 3); ctx.fillRect(x + w - 5, y + h - 12, 3, 10);

    // Left: Invented Mark
    drawInventedMark(ctx, ad.markVariant, x + 44, y + h * 0.5, 28);

    // Center-left: Wordmark, Category tag, Tagline
    ctx.fillStyle = pal.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '900 24px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(ad.brandName, x + 86, y + 14);

    ctx.fillStyle = pal.secondary;
    ctx.font = '700 13px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(ad.tagLine, x + 88, y + 43);

    // Dense fake lines
    drawDenseFakeLines(ctx, ad.fakeLines, x + 88, y + 64, 210, 8.5);

    // Center-right: Product silhouette
    drawProductSilhouette(ctx, ad.silhouetteVariant, x + 345, y + h * 0.5, 78, 78, frame);

    // Right: Price badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x + 406, y + 18, 94, h - 36);
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 406, y + 18, 94, h - 36);

    ctx.fillStyle = pal.accent;
    ctx.textAlign = 'center';
    ctx.font = '800 15px "Helvetica Neue", monospace';
    ctx.fillText(ad.priceOrCountdown, x + 453, y + 36);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '700 10px sans-serif';
    ctx.fillText('AUTHORIZED', x + 453, y + 66);
  } else if (cut === 1) {
    // Cut 1: Promo Flash / Sale Banner
    ctx.fillStyle = '#080810';
    ctx.fillRect(x, y, w, h);

    // Top flash banner
    ctx.fillStyle = pal.primary;
    ctx.fillRect(x + 4, y + 4, w - 8, 24);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 12px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`★ LIMITED PROMO // 50% REBATE // ${ad.brandName} ★`, x + w * 0.5, y + 16);

    // Outer border
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Left: Countdown box
    ctx.fillStyle = 'rgba(255, 40, 60, 0.2)';
    ctx.fillRect(x + 16, y + 36, 175, 76);
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 16, y + 36, 175, 76);

    ctx.fillStyle = '#ff4455';
    ctx.font = '800 11px sans-serif';
    ctx.fillText('EXPIRES AT CYCLE END', x + 103, y + 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 19px monospace';
    ctx.fillText('00:14:59', x + 103, y + 72);

    ctx.fillStyle = pal.secondary;
    ctx.font = '700 9px monospace';
    ctx.fillText('SECURE ALLOCATION NOW', x + 103, y + 96);

    // Center: Large Brand & Tagline
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px "Helvetica Neue", sans-serif';
    ctx.fillText(ad.brandName, x + 204, y + 38);

    ctx.fillStyle = pal.secondary;
    ctx.font = '700 11px sans-serif';
    ctx.fillText(ad.tagLine, x + 204, y + 62);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '600 8.5px monospace';
    ctx.fillText(ad.fakeLines[0] ?? '', x + 204, y + 84);

    // Right: Large angled product with discount stamp
    drawProductSilhouette(ctx, ad.silhouetteVariant, x + 440, y + 72, 70, 70, frame);

    ctx.save();
    ctx.translate(x + 440, y + 72);
    ctx.rotate(-0.25);
    ctx.fillStyle = 'rgba(255, 220, 0, 0.92)';
    ctx.fillRect(-45, -12, 90, 24);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 12px sans-serif';
    ctx.fillText(ad.priceOrCountdown, 0, 0);
    ctx.restore();
  } else if (cut === 2) {
    // Cut 2: Technical Telemetry / Equaliser
    ctx.fillStyle = '#04080c';
    ctx.fillRect(x, y, w, h);

    // Technical grid
    ctx.strokeStyle = 'rgba(60, 160, 220, 0.18)';
    ctx.lineWidth = 1;
    for (let gx = x; gx < x + w; gx += 20) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    }
    for (let gy = y; gy < y + h; gy += 16) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    }

    // Border with corner crosshairs
    ctx.strokeStyle = 'rgba(60, 200, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Left: Procedural 6-band equaliser telemetry bars
    const barX = x + 16;
    const barY = y + 24;
    const barW = 18;
    const barSpacing = 24;
    const heights = [0.85, 0.55, 0.95, 0.40, 0.75, 0.60];

    for (let b = 0; b < 6; b += 1) {
      const bh = heights[b]! * 70;
      const bx = barX + b * barSpacing;
      const by = barY + 70 - bh;

      // Segmented bar
      const segCount = 8;
      for (let s = 0; s < segCount; s += 1) {
        const sy = barY + 70 - (s + 1) * 9;
        const lit = (s / segCount) < heights[b]!;
        ctx.fillStyle = lit ? (s > 5 ? '#ff3344' : s > 3 ? '#ffcc00' : '#33ff88') : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(bx, sy, barW, 7);
      }
    }

    ctx.fillStyle = 'rgba(160, 240, 255, 0.8)';
    ctx.font = '700 8.5px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DIAG // TELEMETRY CH 1-6 // SYNC 99.8%', barX, y + 112);

    // Center: Product silhouette in technical reticle
    drawProductSilhouette(ctx, ad.silhouetteVariant, x + 235, y + 64, 65, 65, frame);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 200, y + 30, 70, 70);

    // Right: Spec lines and price
    ctx.fillStyle = pal.primary;
    ctx.font = '900 16px "Helvetica Neue", sans-serif';
    ctx.fillText(ad.brandName, x + 288, y + 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px monospace';
    ctx.fillText(`STATUS: NOMINAL // ${ad.tagLine}`, x + 288, y + 42);

    drawDenseFakeLines(ctx, ad.fakeLines, x + 288, y + 60, 210, 8);

    ctx.fillStyle = pal.accent;
    ctx.font = '800 13px monospace';
    ctx.fillText(`UNIT VALUE: ${ad.priceOrCountdown}`, x + 288, y + 112);
  } else {
    // Cut 3: Retail Dispenser CTA / QR Matrix
    ctx.fillStyle = '#060a12';
    ctx.fillRect(x, y, w, h);

    // Outer border
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Left: 2D Data-matrix QR block (74x74)
    const qrX = x + 16;
    const qrY = y + 18;
    const qrSize = 74;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = '#000000';
    // Corner finder patterns
    ctx.fillRect(qrX + 4, qrY + 4, 20, 20);
    ctx.fillRect(qrX + 8, qrY + 8, 12, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX + 8, qrY + 8, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillRect(qrX + 11, qrY + 11, 6, 6);

    ctx.fillRect(qrX + qrSize - 24, qrY + 4, 20, 20);
    ctx.fillRect(qrX + 4, qrY + qrSize - 24, 20, 20);

    // Bit grid
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if ((r * 7 + c * 13 + ad.markVariant * 5) % 3 === 0) {
          ctx.fillRect(qrX + 28 + c * 5, qrY + 8 + r * 7, 4, 5);
        }
      }
    }

    ctx.fillStyle = pal.secondary;
    ctx.textAlign = 'center';
    ctx.font = '800 8.5px monospace';
    ctx.fillText('SCAN TO ORDER', qrX + qrSize * 0.5, y + 108);

    // Center: Brand, Review Stars, Verification
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px "Helvetica Neue", sans-serif';
    ctx.fillText(ad.brandName, x + 105, y + 20);

    // 5 Gold Stars
    ctx.fillStyle = '#ffcc00';
    ctx.font = '800 13px sans-serif';
    ctx.fillText('★★★★★  4.9 (14K REVIEWS)', x + 105, y + 44);

    ctx.fillStyle = pal.secondary;
    ctx.font = '700 11px sans-serif';
    ctx.fillText(`VERIFIED DISPENSER // ${ad.tagLine}`, x + 105, y + 64);

    drawDenseFakeLines(ctx, [ad.fakeLines[0] ?? ''], x + 105, y + 84, 180, 8);

    // Right: Large Interactive Button
    const btnX = x + 348;
    const btnY = y + 36;
    const btnW = 148;
    const btnH = 56;

    ctx.fillStyle = pal.primary;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = '900 13px "Helvetica Neue", sans-serif';
    ctx.fillText('TOUCH TO DISPENSE', btnX + btnW * 0.5, btnY + 22);

    ctx.font = '800 15px monospace';
    ctx.fillText(ad.priceOrCountdown, btnX + btnW * 0.5, btnY + 42);

    // Product preview icon
    drawProductSilhouette(ctx, ad.silhouetteVariant, x + 320, y + 64, 45, 45, frame);
  }

  ctx.restore();
}

/**
 * Draws one vertical advertisement frame into canvas.
 * Dimensions: 128 x 512.
 */
function drawHologramFrame(
  ctx: CanvasRenderingContext2D,
  ad: MediaAdDefinition,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Transparent dark backing: Hologram background is transparent in shader.
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Top Section: Fixed upright mark and wordmark
  drawInventedMark(ctx, ad.markVariant, cx, y + 26, 15);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 14px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(ad.brandName, cx, y + 50);

  // Center Circle (r = 60): Tech ring and product silhouette
  const r = 58;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Angle tick marks
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 24; i += 1) {
    const ang = (i * Math.PI * 2) / 24;
    const inner = (i % 6 === 0) ? r - 10 : r - 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.stroke();
  }

  // Inner product silhouette (inside center circle)
  drawProductSilhouette(ctx, ad.silhouetteVariant, cx, cy, 68, 68, frame);

  // Bottom Section: Fixed upright price and short dense line
  ctx.fillStyle = 'rgba(100, 255, 180, 0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 13px monospace';
  ctx.fillText(ad.priceOrCountdown, cx, y + h - 36);

  ctx.fillStyle = 'rgba(200, 230, 255, 0.75)';
  ctx.font = '600 8.5px monospace';
  ctx.fillText(ad.fakeLines[0] ?? 'VERIFIED ASSET // GEN-4', cx, y + h - 18);

  ctx.restore();
}

export interface SignMediaLayout {
  readonly horizontalAds: readonly MediaAdMetadata[];
  readonly hologramAds: readonly MediaAdMetadata[];
  readonly allAds: readonly MediaAdMetadata[];
  readonly width: number;
  readonly height: number;
}

/** Derive the frame addresses without a browser texture. */
export function deriveSignMediaLayout(): SignMediaLayout {
  const horizontalAds = AD_DEFINITIONS.map((ad, i): MediaAdMetadata => ({
    id: ad.id + '-horiz', category: ad.category, brandName: ad.brandName,
    tagLine: ad.tagLine, priceOrCountdown: ad.priceOrCountdown,
    frameCount: 4,
    frames: Array.from({ length: 4 }, (_, f) => rectFor(f * 512, i * 128, 512, 128)),
    isVertical: false, isHologram: false,
  }));
  const hologramAds = Array.from({ length: 8 }, (_, i): MediaAdMetadata => {
    const ad = AD_DEFINITIONS[i % AD_DEFINITIONS.length]!;
    return {
      id: `${ad.id}-holo-${i}`, category: ad.category, brandName: ad.brandName,
      tagLine: ad.tagLine, priceOrCountdown: ad.priceOrCountdown,
      frameCount: 1, frames: [rectFor(i * 256, 1792, 256, 256)],
      isVertical: false, isHologram: true,
    };
  });
  return { horizontalAds, hologramAds, allAds: [...horizontalAds, ...hologramAds], width: MEDIA_ATLAS_WIDTH, height: MEDIA_ATLAS_HEIGHT };
}

// Cache the immutable canvas. Each material owns its texture and its disposal.
let bootCanvas: HTMLCanvasElement | null = null;
function signMediaCanvas(): HTMLCanvasElement {
  if (bootCanvas !== null) return bootCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = MEDIA_ATLAS_WIDTH;
  canvas.height = MEDIA_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('SKYRIVER_SIGN_MEDIA_ATLAS_NO_2D_CONTEXT');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < AD_DEFINITIONS.length; i += 1) {
    for (let f = 0; f < 4; f += 1) {
      drawHorizontalAdFrame(ctx, AD_DEFINITIONS[i]!, f * 512, i * 128, 512, 128, f);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    drawHologramFrame(ctx, AD_DEFINITIONS[i % AD_DEFINITIONS.length]!, i * 256, 1792, 256, 256, i);
  }
  bootCanvas = canvas;
  return canvas;
}

/** Prepare the canvas while the city cache request is in progress. */
export function prepareSignMediaAtlas(): void {
  signMediaCanvas();
}

/** Create one material-owned texture from the cached procedural frames. */
export function createSignMediaAtlas(): SignMediaAtlas {
  const texture = new THREE.CanvasTexture(signMediaCanvas());
  texture.name = 'skyriver.signMediaAtlas';
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { ...deriveSignMediaLayout(), texture, dispose(): void { texture.dispose(); } };
}
