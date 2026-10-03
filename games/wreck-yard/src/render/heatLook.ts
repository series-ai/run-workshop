import { HEAT, TICK_RATE } from '../sim/constants';
import type { BodyHeat, YardBody } from '../sim/state';

/** Heat age of a body with no heat: far past burnt, so a scorch voxel draws burnt. */
export const COLD_AGE = 1e6;

/** What the voxel shader needs from a body's heat each frame. */
export interface BodyHeatLook {
  age: number;
  at: [number, number, number];
}

const HEAT_INDEX = new WeakMap<readonly YardBody[], ReadonlyMap<string, BodyHeat>>();

/**
 * The live heat of a body. Read it from the latest render bodies: the scene's
 * body list only changes with geometry, and a held torch refreshes heat alone.
 */
export function heatOfBody(bodies: readonly YardBody[], id: string): BodyHeat | null {
  let index = HEAT_INDEX.get(bodies);
  if (!index) {
    index = new Map(bodies.flatMap((body) => (body.heat ? [[body.id, body.heat] as const] : [])));
    HEAT_INDEX.set(bodies, index);
  }
  return index.get(id) ?? null;
}

/** Bodies with heat in the latest render bodies (the same index). */
export function heatedBodies(bodies: readonly YardBody[]): readonly YardBody[] {
  return bodies.filter((body) => heatOfBody(bodies, body.id) !== null);
}

/** Seconds since the body's last torch or blast heat. */
export function heatAge(frame: number, heat: BodyHeat | null): number {
  return heat ? Math.max(0, (frame - heat.frame) / TICK_RATE) : COLD_AGE;
}

/** Glow strength: 1 when fresh, 0 from HEAT.glowSeconds on. The shader and the heat lights share it. */
export function heatGlow(age: number): number {
  const left = 1 - Math.min(1, age / HEAT.glowSeconds);
  return left * left;
}

/**
 * Scorch voxel look in the voxel shader (linear color). It matches heatGlow
 * and HEAT: a red glow that fades by glowSeconds, brown by brownSeconds, and
 * uBurntColor by burntSeconds, when the sim makes the voxel burnt. The center
 * of the heat glows hardest; each voxel cell away from it cools
 * HEAT_EDGE_SECONDS sooner, so the edge goes dark first.
 */
export const HEAT_GLSL = /* glsl */ `
  const float HEAT_GLOW_SECONDS = ${HEAT.glowSeconds.toFixed(3)};
  const float HEAT_BROWN_SECONDS = ${HEAT.brownSeconds.toFixed(3)};
  const float HEAT_BURNT_SECONDS = ${HEAT.burntSeconds.toFixed(3)};
  const float HEAT_EDGE_SECONDS = 0.12;

  // Heat age of a voxel this many cells from the heat center.
  float heatAgeAt(float age, float cells) {
    return age + cells * HEAT_EDGE_SECONDS;
  }

  float heatGlow(float age) {
    float left = 1.0 - min(1.0, age / HEAT_GLOW_SECONDS);
    return left * left;
  }

  vec3 heatAlbedo(float age, vec3 burnt) {
    vec3 hot = vec3(0.32, 0.05, 0.02);
    vec3 brown = vec3(0.12, 0.055, 0.028);
    vec3 albedo = mix(hot, brown, smoothstep(0.0, HEAT_BROWN_SECONDS, age));
    return mix(albedo, burnt, smoothstep(HEAT_BROWN_SECONDS, HEAT_BURNT_SECONDS, age));
  }

  vec3 heatEmission(float age, float cells) {
    float glow = heatGlow(age);
    vec3 dull = vec3(0.6, 0.04, 0.01);
    vec3 white = vec3(1.0, 0.5, 0.16);
    float core = 1.0 - 0.55 * smoothstep(1.0, 7.0, cells);
    return mix(dull, white, glow * glow) * glow * core * 7.0;
  }
`;
