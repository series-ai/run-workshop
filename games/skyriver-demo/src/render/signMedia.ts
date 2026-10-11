/**
 * @file signMedia.ts - R47 media layer definitions, ad atlas generation, and metadata.
 *
 * This file defines media categories, motion classes, ad metadata, and atlas drawing.
 * All prose uses ASD-STE100 Simplified Technical English.
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
  readonly verticalAds: readonly MediaAdMetadata[];
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

/**
 * Draws one horizontal advertisement frame into canvas.
 * Dimensions: 512 x 128.
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

  // Dark matrix display face backing with subtle grid.
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(x, y, w, h);

  // Border frame with slight accent corner tabs.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

  // Corner accents.
  ctx.fillStyle = 'rgba(120, 255, 160, 0.9)';
  ctx.fillRect(x + 2, y + 2, 8, 3);
  ctx.fillRect(x + 2, y + 2, 3, 8);
  ctx.fillRect(x + w - 10, y + 2, 8, 3);
  ctx.fillRect(x + w - 5, y + 2, 3, 8);
  ctx.fillRect(x + 2, y + h - 5, 8, 3);
  ctx.fillRect(x + 2, y + h - 10, 3, 8);
  ctx.fillRect(x + w - 10, y + h - 5, 8, 3);
  ctx.fillRect(x + w - 5, y + h - 10, 3, 8);

  // Left side: Invented Mark.
  drawInventedMark(ctx, ad.markVariant, x + 40, y + h * 0.5, 28);

  // Center-left: Wordmark and Tagline.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '800 24px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(ad.brandName, x + 82, y + 14);

  ctx.fillStyle = 'rgba(160, 240, 255, 0.85)';
  ctx.font = '700 13px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(ad.tagLine, x + 84, y + 42);

  // Dense fake lines.
  drawDenseFakeLines(ctx, ad.fakeLines, x + 84, y + 62, 180, 8.5);

  // Center-right: Product Silhouette.
  drawProductSilhouette(ctx, ad.silhouetteVariant, x + 340, y + h * 0.5, 75, 75, frame);

  // Right side: Price / Countdown badge.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x + 400, y + 18, 98, h - 36);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 400, y + 18, 98, h - 36);

  ctx.fillStyle = 'rgba(100, 255, 140, 0.95)';
  ctx.textAlign = 'center';
  ctx.font = '800 15px "Helvetica Neue", monospace';
  ctx.fillText(ad.priceOrCountdown, x + 449, y + 36);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '700 10px sans-serif';
  ctx.fillText(frame % 2 === 0 ? 'OFFER VALID' : 'LIMITED RUN', x + 449, y + 66);

  ctx.restore();
}

/**
 * Draws one vertical advertisement frame into canvas.
 * Dimensions: 128 x 512.
 */
function drawVerticalAdFrame(
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

  // Dark display backing.
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(x, y, w, h);

  // Border.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

  // Top: Invented Mark.
  drawInventedMark(ctx, ad.markVariant, x + w * 0.5, y + 42, 28);

  // Upper section: Brand Wordmark (stacked or rotated).
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(ad.brandName, x + w * 0.5, y + 95);

  ctx.fillStyle = 'rgba(160, 240, 255, 0.85)';
  ctx.font = '700 11px sans-serif';
  ctx.fillText(ad.tagLine, x + w * 0.5, y + 118);

  // Center: Category-specific product silhouette.
  drawProductSilhouette(ctx, ad.silhouetteVariant, x + w * 0.5, y + 215, 80, 110, frame);

  // Lower section: Dense fake lines.
  ctx.textAlign = 'left';
  drawDenseFakeLines(ctx, ad.fakeLines, x + 10, y + 300, w - 20, 8);

  // Bottom: Price / Countdown badge.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x + 12, y + 430, w - 24, 60);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 12, y + 430, w - 24, 60);

  ctx.fillStyle = 'rgba(100, 255, 140, 0.95)';
  ctx.textAlign = 'center';
  ctx.font = '800 14px "Helvetica Neue", monospace';
  ctx.fillText(ad.priceOrCountdown, x + w * 0.5, y + 452);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '700 9px sans-serif';
  ctx.fillText(frame % 2 === 0 ? 'OFFER' : 'BUY NOW', x + w * 0.5, y + 472);

  ctx.restore();
}

/**
 * Draws one hologram asset frame into canvas.
 * Dimensions: 256 x 256. Transparent background, high contrast silhouette and glyphs.
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

  // Outer radial ring with tick marks.
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const r = w * 0.42;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Fine angle tick marks.
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 24; i += 1) {
    const ang = (i * Math.PI * 2) / 24;
    const inner = (i % 6 === 0) ? r - 12 : r - 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.stroke();
  }

  // Inner product silhouette.
  drawProductSilhouette(ctx, ad.silhouetteVariant, cx, cy, w * 0.5, h * 0.5, frame);

  // Arc text or wordmark top and bottom.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 12px "Helvetica Neue", sans-serif';
  ctx.fillText(ad.brandName, cx, cy - r * 0.65);

  ctx.fillStyle = 'rgba(120, 255, 160, 0.9)';
  ctx.font = '700 11px monospace';
  ctx.fillText(ad.priceOrCountdown, cx, cy + r * 0.68);

  ctx.restore();
}

/**
 * Creates the boot-generated media advertising atlas.
 * Renders all procedural frames into a single 2048 by 2048 CanvasTexture.
 */
export function createSignMediaAtlas(): SignMediaAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = MEDIA_ATLAS_WIDTH;
  canvas.height = MEDIA_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('SKYRIVER_SIGN_MEDIA_ATLAS_NO_2D_CONTEXT');
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const horizontalAds: MediaAdMetadata[] = [];
  const verticalAds: MediaAdMetadata[] = [];
  const hologramAds: MediaAdMetadata[] = [];

  // Section 1: Horizontal Ads. Rows 0 to 9 (y: 0 to 1280).
  // Each ad has 4 horizontal frames of 512 x 128 across one row.
  const HORIZ_W = 512;
  const HORIZ_H = 128;
  const FRAMES_PER_AD = 4;

  for (let i = 0; i < AD_DEFINITIONS.length; i += 1) {
    const ad = AD_DEFINITIONS[i]!;
    const rowY = i * HORIZ_H;
    const frames: MediaFrameRect[] = [];
    for (let f = 0; f < FRAMES_PER_AD; f += 1) {
      const colX = f * HORIZ_W;
      drawHorizontalAdFrame(ctx, ad, colX, rowY, HORIZ_W, HORIZ_H, f);
      frames.push(rectFor(colX, rowY, HORIZ_W, HORIZ_H));
    }
    horizontalAds.push({
      id: ad.id + '-horiz',
      category: ad.category,
      brandName: ad.brandName,
      tagLine: ad.tagLine,
      priceOrCountdown: ad.priceOrCountdown,
      frameCount: FRAMES_PER_AD,
      frames,
      isVertical: false,
      isHologram: false,
    });
  }

  // Section 2: Vertical Ads. (y: 1280 to 1792, h: 512).
  // 16 columns of 128 x 512.
  const VERT_BASE_Y = 1280;
  const VERT_W = 128;
  const VERT_H = 512;
  const VERT_COLS = 16;

  for (let c = 0; c < VERT_COLS; c += 1) {
    const adIndex = c % AD_DEFINITIONS.length;
    const ad = AD_DEFINITIONS[adIndex]!;
    const frame = Math.floor(c / AD_DEFINITIONS.length);
    const colX = c * VERT_W;
    drawVerticalAdFrame(ctx, ad, colX, VERT_BASE_Y, VERT_W, VERT_H, frame);
    const frameRect = rectFor(colX, VERT_BASE_Y, VERT_W, VERT_H);
    verticalAds.push({
      id: `${ad.id}-vert-${c}`,
      category: ad.category,
      brandName: ad.brandName,
      tagLine: ad.tagLine,
      priceOrCountdown: ad.priceOrCountdown,
      frameCount: 1,
      frames: [frameRect],
      isVertical: true,
      isHologram: false,
    });
  }

  // Section 3: Hologram Assets. (y: 1792 to 2048, h: 256).
  // 8 square columns of 256 x 256.
  const HOLO_BASE_Y = 1792;
  const HOLO_SIZE = 256;
  const HOLO_COLS = 8;

  for (let c = 0; c < HOLO_COLS; c += 1) {
    const adIndex = c % AD_DEFINITIONS.length;
    const ad = AD_DEFINITIONS[adIndex]!;
    const colX = c * HOLO_SIZE;
    drawHologramFrame(ctx, ad, colX, HOLO_BASE_Y, HOLO_SIZE, HOLO_SIZE, c);
    const frameRect = rectFor(colX, HOLO_BASE_Y, HOLO_SIZE, HOLO_SIZE);
    hologramAds.push({
      id: `${ad.id}-holo-${c}`,
      category: ad.category,
      brandName: ad.brandName,
      tagLine: ad.tagLine,
      priceOrCountdown: ad.priceOrCountdown,
      frameCount: 1,
      frames: [frameRect],
      isVertical: false,
      isHologram: true,
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'skyriver.signMediaAtlas';
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const allAds = [...horizontalAds, ...verticalAds, ...hologramAds];

  return {
    texture,
    horizontalAds,
    verticalAds,
    hologramAds,
    allAds,
    width: MEDIA_ATLAS_WIDTH,
    height: MEDIA_ATLAS_HEIGHT,
    dispose(): void {
      texture.dispose();
    },
  };
}
