// Per-zone ambient particle emitters. Runs every frame from
// updateOverworld; emits one preset-particle per call when the dice
// roll says so. Keeps each map's vibe distinct without manual placement
// of FX tiles — snow flurries blow across snow_town, leaves drift in
// Forest1, sparks crackle in cave1, etc.
//
// All particle PNGs live under public/world/effects/Particle/. They
// lazy-load on first reference, so missing art (e.g. before the user
// drops the PNG into the folder) just means the particle doesn't
// render — no crash, no console noise.
//
// Tuning: chance is per-frame at 60fps, so e.g. 0.04 ≈ 2.4 emits/sec.

import { TILE_SIZE } from '../engine/types';
import type { OverworldState } from './Overworld';
import { spawnPresetParticle, type ParticlePresetId } from './particles';
import { getMapEnvironment } from '../../data/environments';

interface AmbientFxConfig {
  /** Particle preset to spawn. */
  preset: ParticlePresetId;
  /** Per-frame chance of spawning one (0-1). */
  chancePerFrame: number;
  /** Initial vy in px/frame. Positive = falling. */
  vy: number;
  /** Initial vx in px/frame. Positive = right. Randomized within ±jitter. */
  vx: number;
  vxJitter?: number;
  /** Per-frame downward velocity acceleration (px/frame²). */
  gravity?: number;
  /** Frames to live. Tune so the particle traverses ~1 viewport. */
  maxAge: number;
  /** Pixel scale (3 = full tile size). Smaller for distant ambient. */
  scale: number;
  /** Spawn zone — where in the viewport to emit:
   *   'top' = above the visible area, drifts down (snow, leaves, rain)
   *   'anywhere' = random tile in viewport (fire flicker, sparks)
   *   'edges' = randomly off any edge, drifts inward (atmospheric drift) */
  spawnZone: 'top' | 'anywhere' | 'edges';
}

/**
 * Per-environment ambient FX. Maps env id → list of layered emitters.
 * Each env can stack multiple presets — e.g. snow_town blends a heavy
 * snowfall layer with occasional gusts and a rare twinkle so the scene
 * reads as actually wintry instead of "scattered flake every 2s".
 *
 * Tuning notes:
 *   chancePerFrame ≈ emits per real second (60fps baseline). 1.0 = one
 *   per frame on average. Total particles on screen ≈ chancePerFrame ×
 *   maxAge / 60 — keep that under ~60 to avoid CPU work.
 */
const ZONE_AMBIENT: Record<string, AmbientFxConfig[]> = {
  // Snow_town — heavy, layered snowfall. Top-down camera means weather has
  // to fill the WHOLE viewport at all times, not stream in from the top
  // (otherwise walking right reveals an "empty" area that then gets seeded
  // — looks awful). 'anywhere' spawning + vy>0 = snow flakes appear at all
  // depths and drift down naturally. Three layers create depth: big slow
  // flakes, fast direct flakes, plus a rare side gust for variation.
  snow: [
    {
      preset: 'snow', chancePerFrame: 1.4,
      vy: 0.5, vx: -0.1, vxJitter: 0.18,
      maxAge: 260, scale: 4, spawnZone: 'anywhere',
    },
    {
      preset: 'snow', chancePerFrame: 1.0,
      vy: 0.85, vx: -0.25, vxJitter: 0.3,
      maxAge: 180, scale: 3, spawnZone: 'anywhere',
    },
    // Occasional horizontal gust from the side — keeps the wind feel.
    {
      preset: 'snow', chancePerFrame: 0.4,
      vy: 0.3, vx: 1.4, vxJitter: 0.5,
      maxAge: 120, scale: 2, spawnZone: 'edges',
    },
  ],
  // Forest — drifting leaves, layered green + pink for variety. Bumped
  // significantly: was barely visible, now reads as "we're in a forest".
  forest: [
    {
      preset: 'leaf', chancePerFrame: 0.45,
      vy: 0.35, vx: -0.2, vxJitter: 0.25,
      maxAge: 320, scale: 3, spawnZone: 'top',
    },
    {
      preset: 'leafPink', chancePerFrame: 0.25,
      vy: 0.3, vx: 0.15, vxJitter: 0.3,
      maxAge: 320, scale: 3, spawnZone: 'top',
    },
    // Occasional cross-screen breeze pushing leaves sideways.
    {
      preset: 'leaf', chancePerFrame: 0.2,
      vy: 0.1, vx: 0.9, vxJitter: 0.4,
      maxAge: 160, scale: 2, spawnZone: 'edges',
    },
  ],
  // Cave — sparks crackling around (electrical / crystal glow), plus
  // rare falling rock chips from the ceiling for atmosphere.
  cave: [
    {
      preset: 'spark', chancePerFrame: 0.45,
      vy: -0.1, vx: 0, vxJitter: 0.4,
      gravity: 0.06, maxAge: 40, scale: 2, spawnZone: 'anywhere',
    },
    {
      preset: 'rockGray', chancePerFrame: 0.08,
      vy: 0.3, vx: 0, vxJitter: 0.15,
      gravity: 0.04, maxAge: 90, scale: 2, spawnZone: 'top',
    },
  ],
  desert: [
    // Sand grit blowing across in the wind.
    {
      preset: 'grass', chancePerFrame: 0.4,
      vy: 0.05, vx: 1.5, vxJitter: 0.4,
      maxAge: 160, scale: 2, spawnZone: 'edges',
    },
    {
      preset: 'spark', chancePerFrame: 0.1,
      vy: 0, vx: 0.4, vxJitter: 0.2,
      maxAge: 30, scale: 2, spawnZone: 'anywhere',
    },
  ],
  // Ruins — dust motes catching shafts of light + occasional sparkle.
  ruins: [
    {
      preset: 'spark', chancePerFrame: 0.18,
      vy: -0.05, vx: 0, vxJitter: 0.2,
      maxAge: 80, scale: 2, spawnZone: 'anywhere',
    },
    {
      preset: 'leaf', chancePerFrame: 0.05,
      vy: 0.25, vx: 0.1, vxJitter: 0.2,
      maxAge: 220, scale: 2, spawnZone: 'top',
    },
  ],
  volcano: [
    // Heavy embers rising from below + flame flickers + occasional ash.
    {
      preset: 'fire', chancePerFrame: 0.9,
      vy: -0.7, vx: 0, vxJitter: 0.3,
      gravity: -0.008, maxAge: 220, scale: 3, spawnZone: 'edges',
    },
    {
      preset: 'spark', chancePerFrame: 0.5,
      vy: -0.8, vx: 0, vxJitter: 0.5,
      maxAge: 80, scale: 2, spawnZone: 'anywhere',
    },
    {
      preset: 'fire', chancePerFrame: 0.3,
      vy: -0.4, vx: 0, vxJitter: 0.6,
      gravity: -0.003, maxAge: 180, scale: 2, spawnZone: 'anywhere',
    },
  ],
  frost_cave: [
    // Snow drift indoors + ice crystal sparkles.
    {
      preset: 'snow', chancePerFrame: 0.7,
      vy: 0.4, vx: 0, vxJitter: 0.2,
      maxAge: 240, scale: 2, spawnZone: 'top',
    },
    {
      preset: 'spark', chancePerFrame: 0.25,
      vy: -0.05, vx: 0, vxJitter: 0.25,
      maxAge: 60, scale: 2, spawnZone: 'anywhere',
    },
  ],
};

/**
 * Per-frame ambient emitter. Reads current map's env, finds matching
 * configs, and spawns particles per their per-frame chance. Cheap when
 * an env has no ambient configured (early-out via the table lookup).
 *
 * Caller must pass the camera's world-space rect so spawn positions
 * land on-screen — the particle system runs in world coordinates and
 * particles outside the viewport waste rendering.
 */
export function emitAmbientFx(
  state: OverworldState,
  cameraX: number,
  cameraY: number,
  viewportW: number,
  viewportH: number,
  frameMul: number,
): void {
  const envId = getMapEnvironment(state.currentMapId);
  if (!envId) return;
  const configs = ZONE_AMBIENT[envId];
  if (!configs) return;
  for (const cfg of configs) {
    // Per-frame chance scales with frameMul so 30fps mobile and 60fps
    // PC emit at the same rate per real second. Values >1 emit multiple
    // particles per frame (heavy weather like snow_town runs at ~1.4
    // → 1 guaranteed emit + 40% chance of a second on each frame).
    const expected = cfg.chancePerFrame * frameMul;
    let emits = Math.floor(expected);
    if (Math.random() < (expected - emits)) emits += 1;
    const vxJitter = cfg.vxJitter ?? 0;
    // For 'top'-spawned falling particles (snow, leaves, rain), a hardcoded
    // maxAge dies early on tall viewports — particles never reach the bottom
    // of the screen, so the weather looks like it only "happens" near the top.
    // Stretch lifetime to actually cross the viewport. Pure-cosmetic emitters
    // ('anywhere' flickers) stay on their authored value.
    const lifetimeForViewport =
      cfg.spawnZone === 'top' && cfg.vy > 0
        ? Math.ceil((viewportH + TILE_SIZE * 2) / cfg.vy)
        : 0;
    const effectiveMaxAge = Math.max(cfg.maxAge, lifetimeForViewport);
    for (let i = 0; i < emits; i++) {
      const { x, y } = pickSpawnPosition(cfg.spawnZone, cameraX, cameraY, viewportW, viewportH);
      spawnPresetParticle(state.particles, cfg.preset, x, y, {
        vx: cfg.vx + (Math.random() - 0.5) * 2 * vxJitter,
        vy: cfg.vy,
        gravity: cfg.gravity ?? 0,
        maxAge: effectiveMaxAge,
        scale: cfg.scale,
      });
    }
  }
}

function pickSpawnPosition(
  zone: AmbientFxConfig['spawnZone'],
  cameraX: number,
  cameraY: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  switch (zone) {
    case 'top':
      // A row just above the viewport so falling particles drift in.
      return {
        x: cameraX + Math.random() * viewportW,
        y: cameraY - TILE_SIZE,
      };
    case 'anywhere':
      // Anywhere in the visible viewport.
      return {
        x: cameraX + Math.random() * viewportW,
        y: cameraY + Math.random() * viewportH,
      };
    case 'edges': {
      // Pick a random edge (top/bottom/left/right), random spot along it.
      const edge = Math.floor(Math.random() * 4);
      const margin = TILE_SIZE / 2;
      if (edge === 0) return { x: cameraX + Math.random() * viewportW, y: cameraY - margin };
      if (edge === 1) return { x: cameraX + Math.random() * viewportW, y: cameraY + viewportH + margin };
      if (edge === 2) return { x: cameraX - margin, y: cameraY + Math.random() * viewportH };
      return { x: cameraX + viewportW + margin, y: cameraY + Math.random() * viewportH };
    }
  }
}
