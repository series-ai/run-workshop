/** Stable building window palettes. All colours are linear and have unit luminance. */
import { SKYRIVER_DISTRICT_PLAN } from './districts';
import { quantize, linearLuminance } from './structureMaterial';

type Rgb = readonly [number, number, number];
interface PaletteSource {
  readonly primary: Rgb;
  readonly accents: readonly [Rgb, Rgb];
}

const CYAN: Rgb = [0.22, 0.95, 1];
const ICE: Rgb = [0.5, 0.68, 1];
const TEAL: Rgb = [0.28, 1, 0.76];
const MAGENTA: Rgb = [1, 0.24, 0.72];
const VIOLET: Rgb = [0.65, 0.34, 1];
const AMBER: Rgb = [1, 0.6, 0.24];

/** Four building choices per district family. The last choice is a sparse contrast. */
const PALETTE_SOURCES: readonly PaletteSource[] = [
  { primary: [0.32, 0.84, 1], accents: [AMBER, VIOLET] },
  { primary: [0.46, 0.66, 1], accents: [CYAN, MAGENTA] },
  { primary: TEAL, accents: [ICE, AMBER] },
  { primary: [0.95, 0.72, 0.47], accents: [CYAN, MAGENTA] },
  { primary: MAGENTA, accents: [ICE, AMBER] },
  { primary: VIOLET, accents: [MAGENTA, TEAL] },
  { primary: [1, 0.45, 0.55], accents: [ICE, CYAN] },
  { primary: ICE, accents: [MAGENTA, AMBER] },
  { primary: AMBER, accents: [TEAL, MAGENTA] },
  { primary: [1, 0.42, 0.1], accents: [ICE, TEAL] },
  { primary: [1, 0.78, 0.54], accents: [AMBER, CYAN] },
  { primary: TEAL, accents: [AMBER, VIOLET] },
];
const frozenRgb = (rgb: Rgb): Rgb => Object.freeze([rgb[0], rgb[1], rgb[2]] as const);
export const WINDOW_PALETTE_SOURCES: readonly PaletteSource[] = Object.freeze(PALETTE_SOURCES.map((source) =>
  Object.freeze({ primary: frozenRgb(source.primary),
    accents: Object.freeze([frozenRgb(source.accents[0]), frozenRgb(source.accents[1])] as const) })));

export const WINDOW_PALETTE_VARIANT_SHARES = Object.freeze([0.5, 0.2, 0.2, 0.1] as const);
export const WINDOW_PALETTE_ONE_ACCENT_WEIGHTS = Object.freeze([0.86, 0.14, 0] as const);
export const WINDOW_PALETTE_TWO_ACCENT_WEIGHTS = Object.freeze([0.82, 0.12, 0.06] as const);
export const WINDOW_PALETTE_SATURATION = Object.freeze({ primary: 0.45, primaryStep: 0.02, primaryVariants: 7, accent: 0.62 });
const PICK_ENDS = WINDOW_PALETTE_VARIANT_SHARES.map((_, i) =>
  Math.round(WINDOW_PALETTE_VARIANT_SHARES.slice(0, i + 1).reduce((sum, share) => sum + share, 0) * 100));
const DISTRICT_FAMILY = SKYRIVER_DISTRICT_PLAN.map((district) =>
  district.primary === 'cyan' ? 0 : district.primary === 'magenta' ? 1 : 2);

export interface WindowPaletteIdentity {
  readonly ownerQ: number;
  readonly variant: number;
  readonly accentCount: 1 | 2;
}

/** Arithmetic stays below 2^24, including intermediate products. */
export function windowPaletteCodeFromQ(ownerQ: number, districtId: number): number {
  if (!Number.isInteger(ownerQ) || ownerQ < 0 || ownerQ > 65535
    || !Number.isInteger(districtId) || districtId < 0 || districtId >= DISTRICT_FAMILY.length) {
    throw new Error('SKYRIVER_WINDOW_PALETTE_IDENTITY_INVALID');
  }
  const pick = ((ownerQ * 73 + districtId * 139 + 19) % 65521) % 100;
  const choice = PICK_ENDS.findIndex((end) => pick < end);
  const second = ((ownerQ * 151 + districtId * 197 + 73) % 65521) % 2;
  return ownerQ * 32 + DISTRICT_FAMILY[districtId]! * 4 + choice + second * 12;
}

export function windowPaletteCode(ownerSeed32: number, districtId: number): number {
  if (!Number.isFinite(ownerSeed32)) throw new Error('SKYRIVER_WINDOW_PALETTE_SEED_INVALID');
  return windowPaletteCodeFromQ(quantize(ownerSeed32), districtId);
}

/** A packed Float32 stores the owner and complete palette choice exactly. */
export function decodeWindowPalette(code: number): WindowPaletteIdentity {
  const packed = Math.fround(code);
  const ownerQ = Math.floor(packed / 32), style = packed % 32;
  if (packed !== code || !Number.isInteger(packed) || ownerQ < 0 || ownerQ > 65535 || style < 0 || style > 23) {
    throw new Error('SKYRIVER_WINDOW_PALETTE_CODE_INVALID');
  }
  return { ownerQ, variant: style % 12, accentCount: style >= 12 ? 2 : 1 };
}

/** The hash includes the canonical owner, not only the selected colour family. */
export function windowPaletteHash(code: number): number {
  decodeWindowPalette(code);
  return code;
}

function unit(rgb: Rgb, saturation: number): Rgb {
  const y = linearLuminance(rgb);
  return [1 + (rgb[0] / y - 1) * saturation, 1 + (rgb[1] / y - 1) * saturation,
    1 + (rgb[2] / y - 1) * saturation];
}

function units(identity: WindowPaletteIdentity): readonly [Rgb, Rgb, Rgb] {
  const source = WINDOW_PALETTE_SOURCES[identity.variant]!;
  return [unit(source.primary, WINDOW_PALETTE_SATURATION.primary
    + WINDOW_PALETTE_SATURATION.primaryStep * (identity.ownerQ % WINDOW_PALETTE_SATURATION.primaryVariants)),
    unit(source.accents[0], WINDOW_PALETTE_SATURATION.accent), unit(source.accents[1], WINDOW_PALETTE_SATURATION.accent)];
}

/** One room key chooses a source inside its fixed building palette. */
export function windowPaletteUnit(code: number, cellHash: number): Rgb {
  const identity = decodeWindowPalette(code);
  if (!Number.isFinite(cellHash)) throw new Error('SKYRIVER_WINDOW_PALETTE_CELL_INVALID');
  const weights = identity.accentCount === 2 ? WINDOW_PALETTE_TWO_ACCENT_WEIGHTS : WINDOW_PALETTE_ONE_ACCENT_WEIGHTS;
  const key = cellHash - Math.floor(cellHash);
  return units(identity)[key < weights[0] ? 0 : key < weights[0] + weights[1] ? 1 : 2];
}

/** The far mean uses the same identity and the actual source selection weights. */
export function windowPaletteMean(code: number): Rgb {
  const identity = decodeWindowPalette(code), rgb = units(identity);
  const weights = identity.accentCount === 2 ? WINDOW_PALETTE_TWO_ACCENT_WEIGHTS : WINDOW_PALETTE_ONE_ACCENT_WEIGHTS;
  const channel = (i: number): number => rgb[0][i]! * weights[0] + rgb[1][i]! * weights[1] + rgb[2][i]! * weights[2];
  return [channel(0), channel(1), channel(2)];
}

/** Recolour one complete emission. Occupancy and source luminance stay unchanged. */
export function recolourWindow(rgb: Rgb, unitHue: Rgb, enabled = 1): Rgb {
  const y = linearLuminance(rgb), k = Math.min(1, Math.max(0, enabled));
  return [rgb[0] + (y * unitHue[0] - rgb[0]) * k,
    rgb[1] + (y * unitHue[1] - rgb[1]) * k, rgb[2] + (y * unitHue[2] - rgb[2]) * k];
}

const literal = (value: number): string => Number.isInteger(value) ? value + '.0' : String(value);
const vec3 = (rgb: Rgb): string => `vec3(${rgb.map(literal).join(', ')})`;

/** Generated from the same palette rows and district plan as the CPU functions. */
export const WINDOW_PALETTE_GLSL = /* glsl */ `
float windowPaletteCodeFromQ(float q, float district) {
  float pick = mod(mod(q * 73.0 + district * 139.0 + 19.0, 65521.0), 100.0);
  float choice = 3.0;
${PICK_ENDS.slice(0, -1).map((end, i) => `  ${i === 0 ? 'if' : 'else if'} (pick < ${literal(end)}) choice = ${literal(i)};`).join('\n')}
  float family = 0.0;
${DISTRICT_FAMILY.map((family, i) => `  if (district > ${literal(i - 0.5)} && district < ${literal(i + 0.5)}) family = ${literal(family)};`).join('\n')}
  float second = mod(mod(q * 151.0 + district * 197.0 + 73.0, 65521.0), 2.0);
  return q * 32.0 + family * 4.0 + choice + second * 12.0;
}
vec3 windowPaletteSource(float variant, float slot) {
${WINDOW_PALETTE_SOURCES.map((source, i) => `  if (variant < ${literal(i + 0.5)}) {
    if (slot < 0.5) return ${vec3(source.primary)};
    if (slot < 1.5) return ${vec3(source.accents[0])};
    return ${vec3(source.accents[1])};
  }`).join('\n')}
  return vec3(1.0);
}
vec3 windowPaletteSlot(float code, float slot) {
  float style = mod(code, 32.0);
  vec3 source = windowPaletteSource(mod(style, 12.0), slot);
  float saturation = slot < 0.5 ? ${literal(WINDOW_PALETTE_SATURATION.primary)}
    + ${literal(WINDOW_PALETTE_SATURATION.primaryStep)} * mod(floor(code / 32.0), ${literal(WINDOW_PALETTE_SATURATION.primaryVariants)})
    : ${literal(WINDOW_PALETTE_SATURATION.accent)};
  return mix(vec3(1.0), source / dot(source, vec3(0.2126, 0.7152, 0.0722)), saturation);
}
vec3 windowPaletteWeights(float code) {
  return mod(code, 32.0) < 12.0 ? ${vec3(WINDOW_PALETTE_ONE_ACCENT_WEIGHTS)} : ${vec3(WINDOW_PALETTE_TWO_ACCENT_WEIGHTS)};
}
vec3 windowPaletteUnit(float code, float cellHash) {
  vec3 weights = windowPaletteWeights(code);
  float key = fract(cellHash);
  float slot = key < weights.x ? 0.0 : (key < weights.x + weights.y ? 1.0 : 2.0);
  return windowPaletteSlot(code, slot);
}
vec3 windowPaletteMean(float code) {
  vec3 weights = windowPaletteWeights(code);
  return windowPaletteSlot(code, 0.0) * weights.x
    + windowPaletteSlot(code, 1.0) * weights.y + windowPaletteSlot(code, 2.0) * weights.z;
}
vec3 recolourWindow(vec3 source, vec3 unitHue, float enabled) {
  return mix(source, dot(source, vec3(0.2126, 0.7152, 0.0722)) * unitHue, enabled);
}
`;
