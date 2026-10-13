import * as THREE from 'three'

/**
 * Pots drawn in code. A pot is a turned profile (outer wall from the foot up over the rim and down the inside to the
 * soil) plus optional extras: feet, handles, hoops, a saucer. Every surface belongs to a region (base, body, band, rim,
 * inner, soil) that takes a colour from the pot's colourway; the body can carry a two-colour pattern layer (speckles,
 * stripes, weave...), the same idea as the leaves. Sizes match the kit pots (radius ~0.5, height ~0.7).
 *
 * The built pot reports where things go: soil height, rim radius and the wall radius at any height (limbs attach there).
 */

export type Region = 'base' | 'body' | 'band' | 'rim' | 'inner'
export type Finish = 'clay' | 'glaze' | 'matte' | 'metal' | 'wood' | 'wicker' | 'stone' | 'plastic'
export type PotPattern =
  | 'speckle' | 'terrazzo' | 'stripes' | 'pinstripe' | 'dots' | 'drip' | 'weave' | 'planks' | 'zigzag' | 'checker'
  | 'crackle' | 'waves' | 'hearts' | 'label' | 'moss' | 'diamonds' | 'scales' | 'confetti'

/** One profile point; the segment from this point to the next gets `tag`. */
export interface ProfilePoint {
  r: number
  y: number
  tag?: Region
  /** Hard edge at this point (default: hard where the region changes). */
  sharp?: boolean
}

export interface Colourway {
  name: string
  body: string
  /** Pattern / band / feet / handle colour. */
  accent: string
  rim?: string
  base?: string
  inner?: string
}

export interface PotDef {
  id: string
  name: string
  /** Outer wall, foot to the top of the rim (inclusive). */
  outline: ProfilePoint[]
  /** Wall thickness at the rim. */
  wall?: number
  /** Soil depth below the rim top. */
  soilDepth?: number
  segments?: number
  /** Radial facets instead of a round pot (hex, square...): flat shaded. */
  faceted?: boolean
  /** Vertical flutes/ribs on the body: count and depth (fraction of radius). */
  flutes?: [number, number]
  finish: Finish
  pattern?: PotPattern
  /** Pattern repeats around the pot. */
  repeat?: number
  feet?: { n: number; kind: 'ball' | 'block' | 'peg' | 'claw'; size: number }
  handles?: { kind: 'loop' | 'ear' | 'bail' | 'mug'; at: number; size: number }
  /** Heights (fractions of the body) of metal hoops / rope bands. */
  hoops?: number[]
  saucer?: boolean
  colourways: Colourway[]
}

export interface BuiltPot {
  group: THREE.Group
  height: number
  rimRadius: number
  /** Top of the soil (local y). */
  soilY: number
  /** Inside radius at the soil (plants may come up within this). */
  soilRadius: number
  bottomRadius: number
  /** Outer wall radius at local height y. */
  radiusAt: (y: number) => number
}

// ---------------------------------------------------------------------------------------------------------------
// Profile helpers

const P = (r: number, y: number, tag: Region = 'body', sharp?: boolean): ProfilePoint => ({ r, y, tag, sharp })

/** Smooth curve through radii `rs` at evenly spaced heights y0..y1 (catmull-rom-ish via sine easing). */
function curve(y0: number, y1: number, rs: number[], n = 10, tag: Region = 'body'): ProfilePoint[] {
  const out: ProfilePoint[] = []
  const spline = new THREE.SplineCurve(rs.map((r, i) => new THREE.Vector2(r, y0 + ((y1 - y0) * i) / (rs.length - 1))))
  for (let i = 0; i <= n; i++) {
    const p = spline.getPoint(i / n)
    out.push({ r: p.x, y: p.y, tag })
  }
  return out
}

/** A flat foot: small bevel at the base. */
/** Flat base with a soft rounded heel (no sharp bottom edge). */
const foot = (r: number, h = 0.04): ProfilePoint[] => [P(0, 0, 'base'), P(r - h, 0, 'base'), P(r - h * 0.3, h * 0.3, 'base'), P(r, h, 'body', true)]

/** Kit-style rolled collar rim: steps out, up, and over. */
const collar = (r: number, y: number, out = 0.04, h = 0.13): ProfilePoint[] => [
  P(r, y, 'rim', true),
  P(r + out, y + 0.01, 'rim', true),
  P(r + out, y + h - 0.015, 'rim'),
  P(r + out - 0.012, y + h, 'rim', true),
]

const roundLip = (r: number, y: number): ProfilePoint[] => [P(r, y - 0.02, 'rim', true), P(r + 0.008, y - 0.006, 'rim'), P(r, y, 'rim')]

// ---------------------------------------------------------------------------------------------------------------
// Catalogue (see POTS.md for the full list and ideas not built yet)

const TERRACOTTA: Colourway[] = [
  { name: 'Terracotta', body: '#c96f45', accent: '#a9552f' },
  { name: 'Whitewash', body: '#e9e1d4', accent: '#c9b9a3' },
  { name: 'Aged moss', body: '#b7764f', accent: '#7f9a5c', rim: '#8ea36a' },
  { name: 'Dipped rim', body: '#c96f45', accent: '#f2ead8', rim: '#f2ead8' },
  { name: 'Charcoal', body: '#4a4744', accent: '#2f2d2b' },
]

export const POTS: PotDef[] = [
  {
    id: 'classic', name: 'Classic Pot', finish: 'clay',
    outline: [...foot(0.36), P(0.36, 0.03), P(0.44, 0.55, 'body', true), ...collar(0.44, 0.55)],
    colourways: TERRACOTTA,
  },
  {
    id: 'azalea', name: 'Azalea Pot (short)', finish: 'clay',
    outline: [...foot(0.4), P(0.4, 0.03), P(0.47, 0.36, 'body', true), ...collar(0.47, 0.36, 0.035, 0.11)],
    colourways: TERRACOTTA,
  },
  {
    id: 'stepped', name: 'Stepped Sage', finish: 'glaze',
    outline: [
      ...foot(0.42), P(0.42, 0.03), P(0.44, 0.2, 'band', true), P(0.46, 0.21, 'body', true), P(0.47, 0.4, 'band', true),
      P(0.49, 0.41, 'body', true), P(0.5, 0.62, 'body'), ...roundLip(0.5, 0.64),
    ],
    colourways: [
      { name: 'Sage', body: '#a9bf9f', accent: '#93ab89' },
      { name: 'Butter', body: '#efd98f', accent: '#dcc274' },
      { name: 'Sky', body: '#a8c7d8', accent: '#8fb2c6' },
      { name: 'Ink', body: '#2f3f52', accent: '#24313f' },
    ],
  },
  {
    id: 'cylinder', name: 'Glossy Cylinder', finish: 'glaze',
    outline: [...foot(0.44), P(0.44, 0.03), ...curve(0.03, 0.62, [0.44, 0.47, 0.48, 0.475]), ...roundLip(0.47, 0.64)],
    colourways: [
      { name: 'Peach', body: '#f19a7a', accent: '#e3876a' },
      { name: 'Cream', body: '#f4ecdc', accent: '#e2d6bf' },
      { name: 'Cobalt', body: '#2f5fb3', accent: '#244c91' },
      { name: 'Mint', body: '#a6dcc3', accent: '#8bc7ab' },
      { name: 'Lilac', body: '#c7b4e2', accent: '#ad98ce' },
      { name: 'Indigo', body: '#3b3f8f', accent: '#2c2f73' },
    ],
  },
  {
    id: 'speckle', name: 'Speckled Stone', finish: 'stone', pattern: 'speckle',
    outline: [...foot(0.42), P(0.42, 0.03), ...curve(0.03, 0.6, [0.42, 0.48, 0.5, 0.49]), ...roundLip(0.49, 0.63)],
    colourways: [
      { name: 'Oat', body: '#ece4d4', accent: '#4a443c' },
      { name: 'Charcoal', body: '#3d3b3a', accent: '#e8e2d6' },
      { name: 'Blush', body: '#f0cfc4', accent: '#7b4d43' },
    ],
  },
  {
    id: 'terrazzo', name: 'Terrazzo Planter', finish: 'stone', pattern: 'terrazzo',
    outline: [...foot(0.46), P(0.46, 0.03), P(0.46, 0.6, 'body', true), P(0.46, 0.62, 'rim', true), P(0.45, 0.63, 'rim')],
    colourways: [
      { name: 'Classic', body: '#efe9df', accent: '#d9735a' },
      { name: 'Green chip', body: '#e9e6dc', accent: '#4f8a68' },
      { name: 'Dark', body: '#4b4a49', accent: '#e9c46a' },
    ],
  },
  {
    id: 'bowl', name: 'Low Bowl', finish: 'stone',
    outline: [...foot(0.36), P(0.36, 0.03), ...curve(0.03, 0.28, [0.36, 0.5, 0.56, 0.57], 8), P(0.55, 0.32, 'rim', true), P(0.53, 0.33, 'rim')],
    soilDepth: 0.07,
    colourways: [
      { name: 'Taupe', body: '#9b8a7b', accent: '#7d6d60' },
      { name: 'Slate', body: '#6f7a80', accent: '#5a646a' },
      { name: 'Sand', body: '#d8c3a0', accent: '#bba582' },
    ],
  },
  {
    id: 'belly', name: 'Pot Belly', finish: 'glaze',
    outline: [...foot(0.3), P(0.3, 0.03), ...curve(0.03, 0.58, [0.3, 0.48, 0.52, 0.44, 0.38], 12), P(0.4, 0.62, 'rim', true), P(0.42, 0.66, 'rim'), P(0.4, 0.68, 'rim', true)],
    colourways: [
      { name: 'Celadon', body: '#a9c9b4', accent: '#8bb39a' },
      { name: 'Honey', body: '#e0a948', accent: '#c88f30' },
      { name: 'Oxblood', body: '#7b2e2b', accent: '#5f2220' },
    ],
  },
  {
    id: 'egg', name: 'Egg Pot', finish: 'matte',
    outline: [...foot(0.22, 0.02), P(0.22, 0.02), ...curve(0.02, 0.7, [0.22, 0.42, 0.48, 0.46, 0.38], 12), P(0.36, 0.72, 'rim')],
    colourways: [
      { name: 'Eggshell', body: '#f3ede1', accent: '#d8cdb8' },
      { name: 'Speckled egg', body: '#e6ddc8', accent: '#7c6f5a' },
      { name: 'Robin', body: '#9fd1cf', accent: '#5a8c8a' },
    ],
  },
  {
    id: 'tulip', name: 'Tulip Flare', finish: 'glaze',
    outline: [...foot(0.24), P(0.24, 0.03), ...curve(0.03, 0.66, [0.24, 0.3, 0.38, 0.5, 0.6], 10), P(0.62, 0.68, 'rim', true), P(0.6, 0.69, 'rim')],
    colourways: [
      { name: 'Coral', body: '#f08a6c', accent: '#d76f52' },
      { name: 'Teal', body: '#2f8a8a', accent: '#236e6e' },
      { name: 'Mustard', body: '#d9a62e', accent: '#bb8b1d' },
    ],
  },
  {
    id: 'fluted', name: 'Fluted Pot', finish: 'glaze', flutes: [14, 0.05], segments: 56,
    outline: [...foot(0.4), P(0.4, 0.03), P(0.47, 0.58, 'body', true), P(0.49, 0.6, 'rim', true), P(0.49, 0.64, 'rim'), P(0.47, 0.65, 'rim', true)],
    colourways: [
      { name: 'Milk', body: '#f2eee6', accent: '#dcd5c8' },
      { name: 'Pistachio', body: '#c4d8a4', accent: '#a9c287' },
      { name: 'Rose', body: '#e9a8a8', accent: '#d38f8f' },
    ],
  },
  {
    id: 'ribbed', name: 'Ribbed Planter', finish: 'matte',
    outline: [
      ...foot(0.44), P(0.44, 0.03), P(0.47, 0.1, 'band'), P(0.44, 0.17), P(0.47, 0.24, 'band'), P(0.44, 0.31), P(0.47, 0.38, 'band'),
      P(0.44, 0.45), P(0.47, 0.52, 'band'), P(0.45, 0.59), P(0.47, 0.62, 'rim', true), P(0.46, 0.63, 'rim'),
    ],
    colourways: [
      { name: 'Clay', body: '#c58763', accent: '#b07452' },
      { name: 'Black', body: '#2f2f2f', accent: '#3b3b3b' },
      { name: 'Seafoam', body: '#9ec9bd', accent: '#86b5a8' },
    ],
  },
  {
    id: 'hex', name: 'Hex Geo', finish: 'glaze', faceted: true, segments: 6,
    outline: [...foot(0.4), P(0.4, 0.03), P(0.5, 0.58, 'body', true), P(0.5, 0.6, 'rim', true), P(0.48, 0.61, 'rim')],
    colourways: [
      { name: 'Concrete', body: '#a8a59f', accent: '#8f8c86' },
      { name: 'White', body: '#f1efea', accent: '#d9d6cf' },
      { name: 'Copper', body: '#b8734a', accent: '#9a5c38' },
    ],
  },
  {
    id: 'gem', name: 'Faceted Gem', finish: 'glaze', faceted: true, segments: 8,
    outline: [...foot(0.24), P(0.24, 0.03), P(0.46, 0.22, 'body', true), P(0.52, 0.42, 'body', true), P(0.46, 0.62, 'body', true), P(0.46, 0.64, 'rim', true), P(0.44, 0.65, 'rim')],
    colourways: [
      { name: 'Amethyst', body: '#9a7bc7', accent: '#7d5fb0' },
      { name: 'Emerald', body: '#3d9a6e', accent: '#2c7c56' },
      { name: 'Ruby', body: '#c8435a', accent: '#a83247' },
      { name: 'Gold', body: '#e3b440', accent: '#c4952a' },
    ],
  },
  {
    id: 'box', name: 'Square Box', finish: 'matte', faceted: true, segments: 4,
    outline: [...foot(0.4), P(0.4, 0.03), P(0.44, 0.58, 'body', true), P(0.46, 0.6, 'rim', true), P(0.46, 0.63, 'rim'), P(0.44, 0.64, 'rim', true)],
    colourways: [
      { name: 'Cement', body: '#b2aea6', accent: '#97938b' },
      { name: 'Black', body: '#2d2c2b', accent: '#444' },
      { name: 'Painted blue', body: '#5b86b8', accent: '#f2ead8' },
    ],
  },
  {
    id: 'nursery', name: 'Nursery Pot', finish: 'plastic',
    outline: [...foot(0.31), P(0.31, 0.03), P(0.41, 0.56, 'body', true), P(0.44, 0.57, 'rim', true), P(0.45, 0.6, 'rim'), P(0.45, 0.64, 'rim'), P(0.43, 0.65, 'rim', true)],
    colourways: [
      { name: 'Black', body: '#2a2a2a', accent: '#3a3a3a' },
      { name: 'Terracotta', body: '#c96f45', accent: '#b25c36' },
      { name: 'Green', body: '#4f8a68', accent: '#3f7357' },
    ],
  },
  {
    id: 'crate', name: 'Wooden Crate', finish: 'wood', faceted: true, segments: 4, pattern: 'planks', repeat: 4,
    outline: [P(0, 0, 'base'), P(0.45, 0, 'base', true), P(0.45, 0.55, 'body', true), P(0.45, 0.56, 'rim', true), P(0.45, 0.6, 'rim')],
    colourways: [
      { name: 'Pine', body: '#d6ac74', accent: '#b88a54' },
      { name: 'Weathered', body: '#a9a093', accent: '#857c70' },
      { name: 'Painted', body: '#c96a5a', accent: '#a9503f' },
    ],
  },
  {
    id: 'barrel', name: 'Half Barrel', finish: 'wood', pattern: 'planks', repeat: 14, hoops: [0.18, 0.82],
    outline: [...foot(0.44), P(0.44, 0.03), ...curve(0.03, 0.58, [0.44, 0.5, 0.52, 0.5], 8), P(0.5, 0.6, 'rim', true), P(0.48, 0.61, 'rim')],
    colourways: [
      { name: 'Oak', body: '#a8743f', accent: '#3d3a38' },
      { name: 'Whiskey', body: '#7d4b2a', accent: '#2c2b2a' },
      { name: 'Silver birch', body: '#cfc5b3', accent: '#5a5652' },
    ],
  },
  {
    id: 'basket', name: 'Woven Basket', finish: 'wicker', pattern: 'weave', repeat: 10,
    outline: [...foot(0.38), P(0.38, 0.03), ...curve(0.03, 0.5, [0.38, 0.45, 0.48], 6), P(0.5, 0.52, 'rim', true), P(0.51, 0.56, 'rim'), P(0.49, 0.58, 'rim', true)],
    colourways: [
      { name: 'Rattan', body: '#d6a865', accent: '#b5864a' },
      { name: 'Seagrass', body: '#b5ad7c', accent: '#8f875c' },
      { name: 'Two-tone', body: '#e9dcc0', accent: '#2f2f2f' },
    ],
  },
  {
    id: 'bucket', name: 'Tin Bucket', finish: 'metal', handles: { kind: 'bail', at: 0.95, size: 0.5 }, hoops: [0.12, 0.88],
    outline: [...foot(0.38), P(0.38, 0.03), P(0.47, 0.6, 'body', true), P(0.49, 0.61, 'rim', true), P(0.49, 0.63, 'rim'), P(0.47, 0.64, 'rim', true)],
    colourways: [
      { name: 'Galvanised', body: '#b9bfc2', accent: '#8e969a' },
      { name: 'Red enamel', body: '#c8443a', accent: '#f1ece2' },
      { name: 'Rust', body: '#9a5a34', accent: '#6e3c22' },
    ],
  },
  {
    id: 'tincan', name: 'Tin Can', finish: 'metal', pattern: 'label',
    outline: [
      ...foot(0.36, 0.02), P(0.36, 0.02, 'band'), P(0.37, 0.05, 'band', true), P(0.37, 0.06), P(0.37, 0.5, 'band', true),
      P(0.37, 0.51, 'band'), P(0.37, 0.55, 'rim', true), P(0.375, 0.56, 'rim'),
    ],
    colourways: [
      { name: 'Tomato', body: '#d9473a', accent: '#f4e7c8', rim: '#c3c8ca', base: '#c3c8ca' },
      { name: 'Beans', body: '#3f6fb0', accent: '#f2c84b', rim: '#c3c8ca', base: '#c3c8ca' },
      { name: 'Peaches', body: '#f2a65a', accent: '#5b8c3a', rim: '#c3c8ca', base: '#c3c8ca' },
    ],
  },
  {
    id: 'teacup', name: 'Teacup', finish: 'glaze', handles: { kind: 'mug', at: 0.55, size: 0.22 }, pattern: 'dots', repeat: 8,
    outline: [...foot(0.24, 0.04), P(0.24, 0.04), ...curve(0.04, 0.46, [0.26, 0.4, 0.5, 0.56], 8), P(0.57, 0.48, 'rim', true), P(0.555, 0.49, 'rim')],
    soilDepth: 0.08,
    colourways: [
      { name: 'Rosebud', body: '#f6efe8', accent: '#e58aa0', rim: '#d8b45a' },
      { name: 'Blue willow', body: '#f3f4f7', accent: '#4a6fb3', rim: '#4a6fb3' },
      { name: 'Mint', body: '#c9ead9', accent: '#ffffff' },
    ],
  },
  {
    id: 'mug', name: 'Coffee Mug', finish: 'glaze', handles: { kind: 'mug', at: 0.5, size: 0.26 }, pattern: 'stripes', repeat: 1,
    outline: [...foot(0.4, 0.02), P(0.4, 0.02), P(0.42, 0.6, 'body', true), P(0.42, 0.62, 'rim', true), P(0.41, 0.63, 'rim')],
    colourways: [
      { name: 'Diner', body: '#f3efe6', accent: '#d64f3c' },
      { name: 'Navy stripe', body: '#f3efe6', accent: '#2c3f66' },
      { name: 'Camp enamel', body: '#2f6e4f', accent: '#f3efe6', rim: '#1f2a33' },
    ],
  },
  {
    id: 'amphora', name: 'Amphora', finish: 'clay', handles: { kind: 'ear', at: 0.8, size: 0.16 }, pattern: 'zigzag', repeat: 6,
    outline: [...foot(0.2), P(0.2, 0.03), ...curve(0.03, 0.66, [0.2, 0.42, 0.48, 0.36, 0.3], 12), P(0.36, 0.7, 'rim', true), P(0.36, 0.73, 'rim'), P(0.34, 0.74, 'rim', true)],
    colourways: [
      { name: 'Greek', body: '#d9824e', accent: '#2a2420' },
      { name: 'Black figure', body: '#2a2420', accent: '#d9824e' },
      { name: 'Sea', body: '#e8e2d2', accent: '#2c6c8c' },
    ],
  },
  {
    id: 'cauldron', name: 'Cauldron', finish: 'metal', handles: { kind: 'ear', at: 0.85, size: 0.12 },
    outline: [P(0, 0, 'base'), P(0.12, 0, 'base'), ...curve(0.02, 0.52, [0.2, 0.44, 0.52, 0.48, 0.44], 10), P(0.47, 0.54, 'rim', true), P(0.47, 0.58, 'rim'), P(0.45, 0.59, 'rim', true)],
    colourways: [
      { name: 'Iron', body: '#353535', accent: '#262626' },
      { name: 'Copper', body: '#b86b3e', accent: '#8e4f2c' },
      { name: 'Witchy', body: '#2d2a3e', accent: '#7ac96a' },
    ],
  },
  {
    id: 'striped', name: 'Beach Stripe', finish: 'glaze', pattern: 'stripes', repeat: 1,
    outline: [...foot(0.4), P(0.4, 0.03), ...curve(0.03, 0.6, [0.4, 0.46, 0.48]), ...roundLip(0.48, 0.62)],
    colourways: [
      { name: 'Sailor', body: '#f4f0e6', accent: '#2c4f86' },
      { name: 'Candy', body: '#f6eee6', accent: '#e36a7c' },
      { name: 'Lime', body: '#f6f3df', accent: '#7fb348' },
    ],
  },
  {
    id: 'polka', name: 'Polka Pot', finish: 'glaze', pattern: 'dots', repeat: 6,
    outline: [...foot(0.36), P(0.36, 0.03), P(0.44, 0.56, 'body', true), ...collar(0.44, 0.56, 0.035, 0.1)],
    colourways: [
      { name: 'Cherry', body: '#d8443d', accent: '#f6efe2' },
      { name: 'Sunny', body: '#f3c845', accent: '#ffffff' },
      { name: 'Night', body: '#253556', accent: '#f6e7a6' },
    ],
  },
  {
    id: 'drip', name: 'Drip Glaze', finish: 'glaze', pattern: 'drip', repeat: 7,
    outline: [...foot(0.4), P(0.4, 0.03), ...curve(0.03, 0.6, [0.4, 0.47, 0.5, 0.49]), ...roundLip(0.49, 0.63)],
    colourways: [
      { name: 'Ocean', body: '#c9b49a', accent: '#2f6f8f', rim: '#2f6f8f' },
      { name: 'Honey', body: '#5a4a3e', accent: '#e0a43e', rim: '#e0a43e' },
      { name: 'Matcha', body: '#e9e2d3', accent: '#7f9e4f', rim: '#7f9e4f' },
    ],
  },
  {
    id: 'checker', name: 'Checkerboard', finish: 'glaze', pattern: 'checker', repeat: 8,
    outline: [...foot(0.42), P(0.42, 0.03), P(0.46, 0.6, 'body', true), ...roundLip(0.46, 0.63)],
    colourways: [
      { name: 'Retro', body: '#f3eadb', accent: '#2f2f2f' },
      { name: 'Peachy', body: '#f6dcc8', accent: '#e3876a' },
      { name: 'Lilac', body: '#ece4f6', accent: '#9f86c9' },
    ],
  },
  {
    id: 'wavy', name: 'Wavy Squiggle', finish: 'glaze', pattern: 'waves', repeat: 5,
    outline: [...foot(0.38), P(0.38, 0.03), ...curve(0.03, 0.6, [0.38, 0.47, 0.48, 0.46]), ...roundLip(0.46, 0.62)],
    colourways: [
      { name: 'Lagoon', body: '#bfe3e0', accent: '#2f8a8a' },
      { name: 'Sunset', body: '#fbe0c2', accent: '#e36a3a' },
      { name: 'Grape', body: '#e6dcf3', accent: '#6a4fa3' },
    ],
  },
  {
    id: 'hearts', name: 'Sweetheart', finish: 'glaze', pattern: 'hearts', repeat: 6,
    outline: [...foot(0.3), P(0.3, 0.03), ...curve(0.03, 0.56, [0.3, 0.46, 0.5, 0.46]), ...roundLip(0.46, 0.58)],
    colourways: [
      { name: 'Valentine', body: '#f8dce2', accent: '#d8445a' },
      { name: 'Cream', body: '#f6efe2', accent: '#e58aa0' },
    ],
  },
  {
    id: 'crackle', name: 'Crackle Glaze', finish: 'glaze', pattern: 'crackle', repeat: 3,
    outline: [...foot(0.3), P(0.3, 0.03), ...curve(0.03, 0.62, [0.3, 0.46, 0.5, 0.44, 0.4], 10), P(0.42, 0.64, 'rim', true), P(0.41, 0.66, 'rim')],
    colourways: [
      { name: 'Celadon', body: '#bcd6c2', accent: '#6f8f7a' },
      { name: 'Ivory', body: '#efe8d8', accent: '#8c7f68' },
    ],
  },
  {
    id: 'mossy', name: 'Mossy Ruin', finish: 'stone', pattern: 'moss', repeat: 3,
    outline: [...foot(0.42), P(0.42, 0.03), P(0.47, 0.58, 'body', true), ...collar(0.47, 0.58, 0.03, 0.09)],
    colourways: [
      { name: 'Forest', body: '#9a9488', accent: '#6f9a4a', rim: '#8aa860' },
      { name: 'Ancient', body: '#bfa98a', accent: '#5f8a3a' },
    ],
  },
  {
    id: 'scales', name: 'Dragon Scales', finish: 'glaze', pattern: 'scales', repeat: 9,
    outline: [...foot(0.34), P(0.34, 0.03), ...curve(0.03, 0.6, [0.34, 0.46, 0.5, 0.47]), ...roundLip(0.47, 0.62)],
    colourways: [
      { name: 'Jade dragon', body: '#3f8a66', accent: '#7fc49a' },
      { name: 'Fire dragon', body: '#b8402e', accent: '#f0a03c' },
      { name: 'Mermaid', body: '#3a6fa3', accent: '#8fe0d0' },
    ],
  },
  {
    id: 'confetti', name: 'Party Confetti', finish: 'plastic', pattern: 'confetti', repeat: 3,
    outline: [...foot(0.4), P(0.4, 0.03), P(0.45, 0.58, 'body', true), P(0.47, 0.6, 'rim', true), P(0.47, 0.63, 'rim'), P(0.45, 0.64, 'rim', true)],
    colourways: [
      { name: 'Birthday', body: '#fff6e6', accent: '#e8486a' },
      { name: 'Neon', body: '#262335', accent: '#4fe0c0' },
    ],
  },
  {
    id: 'diamond', name: 'Harlequin', finish: 'glaze', pattern: 'diamonds', repeat: 6,
    outline: [...foot(0.36), P(0.36, 0.03), P(0.45, 0.6, 'body', true), ...roundLip(0.45, 0.62)],
    colourways: [
      { name: 'Jester', body: '#f1e6d3', accent: '#b8302e' },
      { name: 'Teal', body: '#e6efe9', accent: '#2f7f7a' },
    ],
  },
  {
    id: 'pinstripe', name: 'Pinstripe Tall', finish: 'matte', pattern: 'pinstripe', repeat: 24,
    outline: [...foot(0.36), P(0.36, 0.03), P(0.4, 0.84, 'body', true), P(0.42, 0.86, 'rim', true), P(0.42, 0.89, 'rim'), P(0.4, 0.9, 'rim', true)],
    colourways: [
      { name: 'Graphite', body: '#3a3c40', accent: '#c9cdd2' },
      { name: 'Paper', body: '#f2efe8', accent: '#2f2f2f' },
    ],
  },
]

// ---------------------------------------------------------------------------------------------------------------
// Pattern textures (two colours: body + accent), painted in surface space: x = around the pot, y = up the body.

type PotPainter = (ctx: CanvasRenderingContext2D, W: number, H: number, repeat: number) => void

function rand(seed: number) {
  let x = seed
  return () => ((x = (x * 16807) % 2147483647) / 2147483647)
}

const PAINTERS: Record<PotPattern, PotPainter> = {
  speckle: (ctx, W, H) => {
    const r = rand(7)
    for (let i = 0; i < 260; i++) {
      ctx.beginPath()
      ctx.arc(r() * W, r() * H, 1 + r() * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  terrazzo: (ctx, W, H) => {
    const r = rand(11)
    for (let i = 0; i < 70; i++) {
      const x = r() * W
      const y = r() * H
      const s = 3 + r() * 8
      ctx.beginPath()
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r()
        ctx.lineTo(x + Math.cos(a) * s * (0.6 + r() * 0.5), y + Math.sin(a) * s * (0.6 + r() * 0.5))
      }
      ctx.fill()
    }
  },
  stripes: (ctx, W, H) => {
    for (let k = 0; k < 5; k++) ctx.fillRect(0, H * (0.1 + k * 0.18), W, H * 0.08)
  },
  pinstripe: (ctx, W, H, n) => {
    for (let k = 0; k < n; k++) ctx.fillRect((k / n) * W, 0, Math.max(1.5, W / n / 8), H)
  },
  dots: (ctx, W, H, n) => {
    const rows = 4
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < n; k++) {
        ctx.beginPath()
        ctx.arc(((k + (j % 2) * 0.5) / n) * W, H * (0.16 + j * 0.23), Math.min(W / n, H / rows) * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
  },
  drip: (ctx, W, H, n) => {
    // glaze poured from the rim, running down in rounded drips
    const r = rand(5)
    ctx.fillRect(0, 0, W, H * 0.22)
    for (let k = 0; k < n * 2; k++) {
      const x = (k / (n * 2)) * W + r() * (W / n / 3)
      const len = H * (0.22 + r() * 0.35)
      const w = W / n / 5 + r() * 6
      ctx.fillRect(x - w / 2, 0, w, len)
      ctx.beginPath()
      ctx.arc(x, len, w / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  weave: (ctx, W, H, n) => {
    // basket weave: alternating horizontal/vertical strands, gaps in the accent colour
    const rows = 9
    const cw = W / n
    const rh = H / rows
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < n; k++) {
        const x = k * cw
        const y = j * rh
        ctx.fillRect(x, y + rh - 2, cw, 2)
        if ((j + k) % 2) ctx.fillRect(x + cw / 2 - 1, y, 2, rh)
        else ctx.fillRect(x, y + rh / 2 - 1, cw * 0.5, 1.5)
      }
  },
  planks: (ctx, W, H, n) => {
    for (let k = 0; k < n; k++) ctx.fillRect((k / n) * W, 0, 2.5, H)
    const r = rand(3)
    for (let i = 0; i < n * 2; i++) {
      ctx.beginPath()
      ctx.ellipse(r() * W, r() * H, 3, 1.6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  zigzag: (ctx, W, H, n) => {
    for (const y0 of [0.25, 0.7]) {
      ctx.beginPath()
      for (let k = 0; k <= n * 2; k++) ctx.lineTo((k / (n * 2)) * W, H * (y0 + (k % 2 ? 0.06 : -0.06)))
      for (let k = n * 2; k >= 0; k--) ctx.lineTo((k / (n * 2)) * W, H * (y0 + 0.07 + (k % 2 ? 0.06 : -0.06)))
      ctx.fill()
    }
    ctx.fillRect(0, H * 0.48, W, H * 0.03)
  },
  checker: (ctx, W, H, n) => {
    const rows = 5
    for (let j = 0; j < rows; j++) for (let k = 0; k < n; k++) if ((j + k) % 2) ctx.fillRect((k / n) * W, (j / rows) * H, W / n + 0.5, H / rows + 0.5)
  },
  crackle: (ctx, W, H) => {
    const r = rand(13)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = ctx.fillStyle
    for (let i = 0; i < 60; i++) {
      let x = r() * W
      let y = r() * H
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 26
        y += (r() - 0.5) * 26
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  },
  waves: (ctx, W, H, n) => {
    ctx.lineWidth = H * 0.035
    ctx.strokeStyle = ctx.fillStyle
    for (const y0 of [0.22, 0.48, 0.74]) {
      ctx.beginPath()
      for (let x = 0; x <= W; x += 2) ctx.lineTo(x, H * y0 + Math.sin((x / W) * Math.PI * 2 * n) * H * 0.05)
      ctx.stroke()
    }
  },
  hearts: (ctx, W, H, n) => {
    // two staggered rows, kept clear of the rim and the base so no heart gets cut off
    const s = Math.min(W / n, H / 2) * 0.3
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < n; k++) {
        const x = ((k + (j % 2) * 0.5) / n) * W
        const y = H * (0.3 + j * 0.4)
        ctx.beginPath()
        ctx.moveTo(x, y + s)
        ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s * 1.1, x, y - s * 0.35)
        ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y, x, y + s)
        ctx.fill()
      }
  },
  label: (ctx, W, H) => {
    // a paper label band with a big round badge
    ctx.fillRect(0, H * 0.18, W, H * 0.64)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(W * 0.25, H * 0.5, H * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  },
  moss: (ctx, W, H) => {
    // moss creeping up from the base and down from the rim in lumpy patches
    const r = rand(17)
    for (let i = 0; i < 90; i++) {
      const top = r() < 0.4
      const x = r() * W
      const y = top ? r() * H * 0.25 : H - r() * H * 0.45
      ctx.beginPath()
      ctx.arc(x, y, 4 + r() * 10, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  diamonds: (ctx, W, H, n) => {
    const rows = 3
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < n; k++) {
        if ((j + k) % 2) continue
        const cx = ((k + 0.5) / n) * W
        const cy = ((j + 0.5) / rows) * H
        ctx.beginPath()
        ctx.moveTo(cx, cy - H / rows / 2)
        ctx.lineTo(cx + W / n / 2, cy)
        ctx.lineTo(cx, cy + H / rows / 2)
        ctx.lineTo(cx - W / n / 2, cy)
        ctx.fill()
      }
  },
  scales: (ctx, W, H, n) => {
    ctx.lineWidth = 2.2
    ctx.strokeStyle = ctx.fillStyle
    const rows = 7
    for (let j = 0; j < rows; j++)
      for (let k = 0; k <= n; k++) {
        ctx.beginPath()
        ctx.arc(((k + (j % 2) * 0.5) / n) * W, (j / rows) * H, W / n / 2, 0.15 * Math.PI, 0.85 * Math.PI)
        ctx.stroke()
      }
  },
  confetti: (ctx, W, H) => {
    const r = rand(23)
    for (let i = 0; i < 80; i++) {
      ctx.save()
      ctx.translate(r() * W, r() * H)
      ctx.rotate(r() * Math.PI)
      ctx.fillRect(-4, -1.5, 8, 3)
      ctx.restore()
    }
  },
}

const texCache = new Map<string, THREE.Texture>()
function bodyTexture(def: PotDef, cw: Colourway): THREE.Texture {
  const key = `${def.id}|${cw.name}`
  const hit = texCache.get(key)
  if (hit) return hit
  const W = 256
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = cw.body
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = cw.accent
  // paint three times, shifted a full width left and right: anything crossing the seam continues on the other side,
  // so every pattern wraps around the pot without a visible join (painters are seeded, so the copies are identical)
  for (const dx of [-W, 0, W]) {
    ctx.save()
    ctx.translate(dx, 0)
    ctx.fillStyle = cw.accent
    ctx.strokeStyle = cw.accent
    PAINTERS[def.pattern!](ctx, W, H, def.repeat ?? 6)
    ctx.restore()
  }
  // anything a painter cut out (the tin can badge) shows the pot colour, not black
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = cw.body
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}

// ---------------------------------------------------------------------------------------------------------------
// Materials

const FINISH: Record<Finish, { roughness: number; metalness: number }> = {
  clay: { roughness: 0.95, metalness: 0 },
  matte: { roughness: 0.8, metalness: 0 },
  stone: { roughness: 0.9, metalness: 0 },
  glaze: { roughness: 0.55, metalness: 0 },
  plastic: { roughness: 0.6, metalness: 0 },
  metal: { roughness: 0.5, metalness: 0.2 },
  wood: { roughness: 0.85, metalness: 0 },
  wicker: { roughness: 0.9, metalness: 0 },
}

const matCache = new Map<string, THREE.Material>()
function solid(colour: string, finish: Finish, flat = false, vertexColors = false, doubleSided = false): THREE.Material {
  const key = `${colour}|${finish}|${flat}|${vertexColors}|${doubleSided}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: colour, ...FINISH[finish], flatShading: flat, vertexColors, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide })
    matCache.set(key, m)
  }
  return m
}

/** Darker shade of a colour (inside walls, shadows of bands). */
function shade(colour: string, k: number) {
  return '#' + new THREE.Color(colour).multiplyScalar(k).getHexString()
}

const SOIL = new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 1 })

// ---------------------------------------------------------------------------------------------------------------
// Builder

export function buildPot(def: PotDef, colourway = 0): BuiltPot {
  const cw = def.colourways[colourway % def.colourways.length]
  const segs = def.segments ?? 14
  const wall = def.wall ?? 0.075 // chunky walls: the rim top reads as a fat rolled lip
  const soilDepth = def.soilDepth ?? 0.09
  const pts = def.outline
  const top = pts[pts.length - 1]
  // rolled lip: a half-round over the wall thickness on top of the outline
  const lipR = wall / 2
  const lip: ProfilePoint[] = []
  for (let k = 1; k <= 6; k++) {
    const a = (k / 6) * Math.PI
    lip.push({ r: top.r - lipR + lipR * Math.cos(a), y: top.y + lipR * Math.sin(a) * 0.9, tag: k === 6 ? 'inner' : top.tag ?? 'rim', sharp: k === 6 })
  }
  const height = top.y + lipR * 0.9
  const rimRadius = Math.max(...pts.filter((p) => p.y > height - 0.15).map((p) => p.r))
  // inner wall: down from the rim top to the soil
  const innerR = top.r - wall
  const soilY = height - soilDepth
  const profile: ProfilePoint[] = [...pts.slice(0, -1), { ...top, sharp: top.sharp }, ...lip, P(innerR - 0.01, soilY - 0.02, 'inner')]

  const colourOf = (tag: Region): string =>
    tag === 'rim' ? cw.rim ?? cw.body : tag === 'band' ? cw.accent : tag === 'base' ? cw.base ?? shade(cw.body, 0.8) : tag === 'inner' ? cw.inner ?? shade(cw.rim ?? cw.body, 0.62) : cw.body

  const group = new THREE.Group()
  // one mesh per region run (so the body can carry the pattern texture)
  const flutes = def.flutes
  const runs: { tag: Region; from: number; to: number }[] = []
  for (let i = 0; i < profile.length - 1; i++) {
    const tag = profile[i].tag ?? 'body'
    const last = runs[runs.length - 1]
    if (last && last.tag === tag && !profile[i].sharp) last.to = i + 1
    else runs.push({ tag, from: i, to: i + 1 })
  }
  // body arclength for pattern v
  const bodyIdx = profile.map((p, i) => i).filter((i) => (profile[i].tag ?? 'body') === 'body' && i < profile.length - 1)
  const yLo = bodyIdx.length ? Math.min(...bodyIdx.map((i) => profile[i].y)) : 0
  const yHi = bodyIdx.length ? Math.max(...bodyIdx.map((i) => profile[i + 1].y)) : 1

  for (const run of runs) {
    const ring = profile.slice(run.from, run.to + 1)
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    for (let j = 0; j < ring.length; j++) {
      for (let i = 0; i <= segs; i++) {
        const phi = (i / segs) * Math.PI * 2 + (def.faceted && segs === 4 ? Math.PI / 4 : 0)
        let r = ring[j].r
        if (flutes && run.tag === 'body') r *= 1 - flutes[1] * Math.pow(Math.abs(Math.sin((phi * flutes[0]) / 2)), 0.6)
        // faceted pots: radius is to the corners, scale so flats sit where a round pot's wall would
        if (def.faceted) r /= Math.cos(Math.PI / segs)
        pos.push(Math.sin(phi) * r, ring[j].y, Math.cos(phi) * r)
        uv.push(i / segs, (ring[j].y - yLo) / Math.max(1e-6, yHi - yLo))
      }
    }
    for (let j = 0; j < ring.length - 1; j++)
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i
        const b = a + 1
        const c = a + segs + 1
        const d = c + 1
        idx.push(a, b, c, b, d, c) // outward-facing
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.setIndex(idx)
    // baked kit-style gradient: a little darker toward the foot, lighter toward the rim
    const col = new Float32Array((pos.length / 3) * 3)
    for (let v = 0; v < pos.length / 3; v++) {
      const t = THREE.MathUtils.clamp(pos[v * 3 + 1] / height, 0, 1)
      const k = run.tag === 'inner' ? 1 : 0.8 + 0.28 * Math.pow(t, 0.8)
      col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.computeVertexNormals()
    // close the seam: average normals of the duplicated first/last column
    const n = geo.getAttribute('normal')
    for (let j = 0; j < ring.length; j++) {
      const a = j * (segs + 1)
      const b = a + segs
      const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
      n.setXYZ(a, v.x, v.y, v.z)
      n.setXYZ(b, v.x, v.y, v.z)
    }
    const flat = !!def.faceted
    let mat: THREE.Material
    if (run.tag === 'body' && def.pattern) {
      mat = new THREE.MeshStandardMaterial({ map: bodyTexture(def, cw), ...FINISH[def.finish], flatShading: flat, vertexColors: true })
    } else mat = solid(colourOf(run.tag), def.finish, flat, true, run.tag === 'inner')
    const mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)
  }

  // soil: a low dome
  const soilR = innerR - 0.012
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(soilR * (def.faceted ? 1 / Math.cos(Math.PI / segs) : 1), soilR, 0.02, def.faceted ? segs : 14, 1), SOIL)
  if (def.faceted && segs === 4) soil.rotation.y = Math.PI / 4
  soil.position.y = soilY - 0.01
  group.add(soil)

  const radiusAt = (y: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
        const t = Math.abs(b.y - a.y) < 1e-6 ? 1 : (y - a.y) / (b.y - a.y)
        return THREE.MathUtils.lerp(a.r, b.r, t)
      }
    }
    return y < pts[0].y ? pts[0].r : top.r
  }
  const bottomRadius = Math.max(...pts.filter((p) => p.y <= Math.min(...pts.map((q) => q.y)) + 0.05).map((p) => p.r))

  addExtras(group, def, cw, { height, radiusAt, rimRadius })
  return { group, height, rimRadius, soilY, soilRadius: soilR, bottomRadius, radiusAt }
}

function addExtras(group: THREE.Group, def: PotDef, cw: Colourway, info: { height: number; radiusAt: (y: number) => number; rimRadius: number }) {
  const accent = solid(cw.accent, def.finish === 'clay' || def.finish === 'stone' ? 'glaze' : def.finish)
  const bodyMat = solid(cw.body, def.finish)
  if (def.saucer) {
    const r0 = info.radiusAt(0.03) + 0.1
    const saucer = new THREE.Mesh(
      new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(r0 - 0.03, 0), new THREE.Vector2(r0, 0.05), new THREE.Vector2(r0 - 0.015, 0.06), new THREE.Vector2(r0 - 0.04, 0.02), new THREE.Vector2(0, 0.02)], 16),
      def.id === 'teacup' ? solid(cw.body, def.finish) : solid(cw.rim ?? cw.body, def.finish),
    )
    saucer.position.y = -0.01
    group.add(saucer)
  }
  for (const h of def.hoops ?? []) {
    const y = h * info.height
    const r = info.radiusAt(y) + 0.008
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 5, 20), solid(cw.accent, 'metal'))
    hoop.rotation.x = Math.PI / 2
    hoop.position.y = y
    hoop.scale.z = 1.6
    group.add(hoop)
  }
  if (def.feet) {
    const { n, kind, size } = def.feet
    const r = Math.max(0.16, info.radiusAt(size * 0.5 + 0.06) * 0.72)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.PI / n
      let foot: THREE.Mesh
      if (kind === 'ball') foot = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), accent)
      else if (kind === 'block') foot = new THREE.Mesh(new THREE.BoxGeometry(size * 1.4, size, size * 1.4), accent)
      else if (kind === 'claw') {
        foot = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), accent)
        foot.scale.set(1, 1.2, 1.4)
      } else {
        // splayed peg leg (tripod / cauldron)
        const geo = new THREE.CylinderGeometry(0.025, 0.035, size + 0.08, 6)
        foot = new THREE.Mesh(geo, accent)
        foot.rotation.set(0, 0, 0)
        const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        foot.position.copy(out.clone().multiplyScalar(r + 0.03)).setY((size + 0.08) / 2 - 0.01)
        foot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-out.x * 0.35, 1, -out.z * 0.35).normalize())
        group.add(foot)
        continue
      }
      foot.position.set(Math.sin(a) * r, size * 0.8, Math.cos(a) * r)
      group.add(foot)
    }
  }
  if (def.handles) {
    const { kind, at, size } = def.handles
    const y = at * info.height
    const r = info.radiusAt(y)
    if (kind === 'bail') {
      // wire handle arching over the top, pivoting on two lugs
      const arc = new THREE.Mesh(new THREE.TorusGeometry(info.rimRadius + 0.02, 0.012, 4, 20, Math.PI), solid(cw.accent, 'metal'))
      arc.position.y = y
      arc.rotation.x = -0.25 // resting tilted back a little
      group.add(arc)
    } else {
      const sides = kind === 'mug' ? [1] : [1, -1]
      for (const s of sides) {
        const torus = new THREE.Mesh(new THREE.TorusGeometry(size * 0.5, kind === 'mug' ? 0.035 : 0.028, 6, 12, kind === 'mug' ? Math.PI * 1.25 : Math.PI), kind === 'mug' ? bodyMat : bodyMat)
        torus.position.set(s * (r + (kind === 'mug' ? size * 0.25 : 0.0)), y - (kind === 'mug' ? 0.02 : 0), 0)
        torus.rotation.z = s > 0 ? -Math.PI / 2 - (kind === 'mug' ? Math.PI * 0.125 : 0) : Math.PI / 2
        group.add(torus)
      }
    }
  }
}

export const potById = (id: string) => POTS.find((p) => p.id === id) ?? POTS[0]
