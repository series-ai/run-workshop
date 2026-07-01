import { getImage, loadImage } from '../engine/assets';
import { getSpritesheet, loadSpritesheet } from '../engine/Spritesheet';

/**
 * Transient FX particle. Spawned by the overworld in response to gameplay
 * events (walking through grass, hit flashes, weather, …) and purged once
 * `age >= maxAge`.
 *
 * Rendering walks `framePrefix` + "01".."NN" across the particle's lifetime,
 * so the same struct handles break-up animations (grass blades torn apart),
 * dissipation effects (smoke), or one-shot pops (sparks).
 */
export interface Particle {
  /** World-space position in pixels. Origin is the top-left of the map. */
  x: number;
  y: number;
  /** Velocity in pixels/frame. */
  vx: number;
  vy: number;
  /** Added to vy every frame. Positive = falling. */
  gravity: number;
  /** Frames since spawn. */
  age: number;
  /** Frames to live. At `age === maxAge` the particle is culled. */
  maxAge: number;
  /** PNG url that backs this particle's spritesheet. */
  png: string;
  /** JSON atlas url matching the PNG. */
  json: string;
  /**
   * Frame names in the atlas follow `${framePrefix}${NN}` — e.g. "grass01",
   * "grass02". frameCount is the atlas length so the engine can interpolate
   * the current frame from `age/maxAge`.
   */
  framePrefix: string;
  frameCount: number;
  /** Integer pixels per source pixel. Most world sprites use 3× to match the tile upscale. */
  scale: number;
}

/** Advance every particle; remove expired. Mutates the array in place. */
export function updateParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.age++;
    if (p.age >= p.maxAge) {
      // Swap-pop so culling is O(1). Order doesn't matter for FX.
      particles[i] = particles[particles.length - 1]!;
      particles.pop();
      continue;
    }
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
  }
}

/** Draw every particle. Caller is responsible for any global canvas transform. */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const img = getImage(p.png);
    const sheet = getSpritesheet(p.json);
    if (!img || !sheet) {
      // Kick off a lazy load the first time we see a particle type whose
      // sheet wasn't in the startup preload. Next frame it'll render.
      if (!img) loadImage(p.png).catch(() => {});
      if (!sheet) loadSpritesheet(p.json).catch(() => {});
      continue;
    }
    // Frame progresses linearly across the particle's lifetime. Clamped so
    // the last frame holds briefly before the particle is culled instead of
    // popping out on its very first frame.
    const t = Math.min(1, p.age / Math.max(1, p.maxAge - 1));
    const frameIdx = Math.min(p.frameCount - 1, Math.floor(t * p.frameCount));
    const frameName = `${p.framePrefix}${String(frameIdx + 1).padStart(2, '0')}`;
    const info = sheet.frames[frameName];
    if (!info) continue;
    const { x: sx, y: sy, w: sw, h: sh } = info.frame;
    const dw = sw * p.scale;
    const dh = sh * p.scale;
    // Anchor at the particle's (x, y) midpoint so spawn math can treat each
    // one as a point emitter.
    const dx = Math.round(p.x - dw / 2);
    const dy = Math.round(p.y - dh / 2);
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

// ── Presets ──
// Every preset corresponds to one atlas under public/world/effects/Particle/
// (e.g. Snow.png + Snow.json with frames `snow01`..`snow07`). The PNGs lazy-
// load on first use; missing PNGs cause the particle to silently skip its
// draw rather than crash, so adding a new preset is no-risk even before its
// art lands.

export interface ParticlePreset {
  png: string;
  json: string;
  framePrefix: string;
  frameCount: number;
}

export const GRASS_PARTICLE_PNG = 'world/effects/Particle/Grass.png';
export const GRASS_PARTICLE_JSON = 'world/effects/Particle/Grass.json';

/** All available particle presets, keyed by short name. Frame counts +
 *  prefixes match the atlas JSONs in public/world/effects/Particle/. */
export const PARTICLE_PRESETS = {
  grass:       { png: 'world/effects/Particle/Grass.png',       json: 'world/effects/Particle/Grass.json',       framePrefix: 'grass',  frameCount: 6 },
  fire:        { png: 'world/effects/Particle/Fire.png',        json: 'world/effects/Particle/Fire.json',        framePrefix: 'fire',   frameCount: 12 },
  snow:        { png: 'world/effects/Particle/Snow.png',        json: 'world/effects/Particle/Snow.json',        framePrefix: 'snow',   frameCount: 7 },
  rain:        { png: 'world/effects/Particle/Rain.png',        json: 'world/effects/Particle/Rain.json',        framePrefix: 'rain',   frameCount: 3 },
  rainOnFloor: { png: 'world/effects/Particle/RainOnFloor.png', json: 'world/effects/Particle/RainOnFloor.json', framePrefix: 'ripple', frameCount: 3 },
  spark:       { png: 'world/effects/Particle/Spark.png',       json: 'world/effects/Particle/Spark.json',       framePrefix: 'spark',  frameCount: 7 },
  leaf:        { png: 'world/effects/Particle/Leaf.png',        json: 'world/effects/Particle/Leaf.json',        framePrefix: 'leaf',   frameCount: 6 },
  leafPink:    { png: 'world/effects/Particle/LeafPink.png',    json: 'world/effects/Particle/LeafPink.json',    framePrefix: 'leaf',   frameCount: 6 },
  rock:        { png: 'world/effects/Particle/Rock.png',        json: 'world/effects/Particle/Rock.json',        framePrefix: 'rock',   frameCount: 5 },
  rockGray:    { png: 'world/effects/Particle/RockGray.png',    json: 'world/effects/Particle/RockGray.json',    framePrefix: 'rock',   frameCount: 5 },
  bamboo:      { png: 'world/effects/Particle/Bamboo.png',      json: 'world/effects/Particle/Bamboo.json',      framePrefix: 'Bamboo', frameCount: 6 },
  vase:        { png: 'world/effects/Particle/Vase.png',        json: 'world/effects/Particle/Vase.json',        framePrefix: 'vase',   frameCount: 6 },
  wood:        { png: 'world/effects/Particle/Wood.png',        json: 'world/effects/Particle/Wood.json',        framePrefix: 'wood',   frameCount: 6 },
} as const satisfies Record<string, ParticlePreset>;

export type ParticlePresetId = keyof typeof PARTICLE_PRESETS;

/**
 * Pick the best-fit particle preset for a given monster element. Used
 * by future battle hit-FX wiring (spawn the right material chip when
 * an attack lands) and by ambient emitters that want to react to
 * mon types nearby.
 *
 * Mapping is family-themed:
 *   thermal → fire (flame chips)
 *   aquatic → rain (water droplets) — except ice → snow
 *   mineral → rock / rockGray (debris) — crystal → spark (shimmer)
 *   organic → leaf — fungus → leafPink (spores)
 *   electric → spark
 *   arcane / atmospheric → spark (radiant) or wood (drift)
 */
export function elementToParticlePreset(element: string): ParticlePresetId {
  switch (element) {
    case 'fire': case 'lava': case 'furnace': case 'ember': case 'plasma':
      return 'fire';
    case 'ash': case 'dust': case 'sand':
      return 'wood';
    case 'water': case 'steam': case 'acid': case 'mist':
    case 'cloud': case 'storm':
      return 'rain';
    case 'ice': case 'frost':
      return 'snow';
    case 'stone': case 'steel': case 'obsidian': case 'bone':
      return 'rock';
    case 'chalk': case 'sand_': // (placeholder; sand maps above)
      return 'rockGray';
    case 'crystal': case 'mirror':
      return 'spark';
    case 'nature': case 'coral': case 'venom':
      return 'leaf';
    case 'fungus':
      return 'leafPink';
    case 'spark': case 'magnetic': case 'static': case 'neon': case 'thunder':
    case 'light': case 'spirit':
      return 'spark';
    case 'shadow': case 'void': case 'dark':
      return 'vase';
    case 'wind':
      return 'wood';
    default:
      return 'spark';
  }
}

/**
 * Spawn a single tuft of torn grass. Picks a random angle and small
 * outward speed so a continuous emit reads as a splash radiating around
 * the player's feet — no gravity, so particles drift straight out in
 * whatever direction they started before fading with the break-up anim.
 */
export function spawnGrassParticle(particles: Particle[], worldX: number, worldY: number): void {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.4 + Math.random() * 0.6; // 0.4–1.0 px/frame
  const preset = PARTICLE_PRESETS.grass;
  particles.push({
    x: worldX,
    y: worldY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    gravity: 0,
    age: 0,
    maxAge: 30,
    png: preset.png,
    json: preset.json,
    framePrefix: preset.framePrefix,
    frameCount: preset.frameCount,
    // Particles draw at the map tile scale (48px tile / 16px source = 3×)
    // so they visually match the grass they came from.
    scale: 3,
  });
}

/**
 * Generic preset-driven spawner for ambient or hit FX. Lets callers
 * ride one of the registered atlases without having to hand-roll a
 * particle struct each time. Defaults are tuned for "looks fine in
 * isolation"; override per-call for specific behaviour:
 *   - vx/vy: initial velocity
 *   - gravity: per-frame vy accumulation (positive = falling)
 *   - maxAge: lifetime in frames
 *   - scale: integer source-pixels-to-screen scale
 */
export function spawnPresetParticle(
  particles: Particle[],
  presetId: ParticlePresetId,
  worldX: number,
  worldY: number,
  opts: {
    vx?: number;
    vy?: number;
    gravity?: number;
    maxAge?: number;
    scale?: number;
  } = {},
): void {
  const preset = PARTICLE_PRESETS[presetId];
  particles.push({
    x: worldX,
    y: worldY,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    gravity: opts.gravity ?? 0,
    age: 0,
    maxAge: opts.maxAge ?? 30,
    png: preset.png,
    json: preset.json,
    framePrefix: preset.framePrefix,
    frameCount: preset.frameCount,
    scale: opts.scale ?? 3,
  });
}
