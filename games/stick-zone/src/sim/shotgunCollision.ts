/**
 * Shared Shotgun Ballistics & Collision Contract
 * Used identically by SectorDepotSimulation (local client) and MultiplayerCoordinator (relay/receiver validation)
 */

export const SHOTGUN_SPREAD_ANGLES = [-0.2618, -0.1571, -0.0524, 0.0524, 0.1571, 0.2618] as const; // 6 pellets across ±15.0° (30.0° full dispersion cone)
export const SHOTGUN_MAX_RANGE = 14.0; // 14.0m lethal buckshot limit
export const SHOTGUN_TARGET_RADIUS = 1.05; // Standard operative/machine collision cylinder radius

export function getShotgunPelletDamage(dist: number): number {
  if (dist <= 4.0) return 10; // Point-blank: 10 per pellet (max 60 across 6 pellets)
  if (dist <= 9.0) return 7;  // Mid-range: 7 per pellet (max 42 across 6 pellets)
  if (dist <= 14.0) return 4; // Long-range: 4 per pellet (max 24 across 6 pellets)
  return 0; // Out of range
}

export function getMaxShotgunDamageForDistance(dist: number): number {
  if (dist <= 4.0) return 60;
  if (dist <= 9.0) return 42;
  if (dist <= 14.0) return 24;
  return 0;
}

export interface ShotgunHitResult {
  hit: boolean;
  pelletsHit: number;
  damage: number;
  maxAllowedDamage: number;
  dist: number;
}

/**
 * Deterministic shotgun ray-cylinder collision calculation
 * @param attackerX Strike origin X
 * @param attackerZ Strike origin Z
 * @param attackerFacing Operative aim heading angle (radians)
 * @param targetX Target cylinder center X
 * @param targetZ Target cylinder center Z
 * @param targetRadius Target collision cylinder radius (default 1.05m)
 */
export function calculateShotgunHit(
  attackerX: number,
  attackerZ: number,
  attackerFacing: number,
  targetX: number,
  targetZ: number,
  targetRadius: number = SHOTGUN_TARGET_RADIUS
): ShotgunHitResult {
  const dx = targetX - attackerX;
  const dz = targetZ - attackerZ;
  const dist = Math.hypot(dx, dz);

  if (dist <= 0.001 || dist > SHOTGUN_MAX_RANGE) {
    return { hit: false, pelletsHit: 0, damage: 0, maxAllowedDamage: 0, dist };
  }

  let pelletsHit = 0;
  for (const angleOffset of SHOTGUN_SPREAD_ANGLES) {
    const pelletAngle = attackerFacing + angleOffset;
    const pDirX = Math.sin(pelletAngle);
    const pDirZ = Math.cos(pelletAngle);
    const dot = (dx * pDirX + dz * pDirZ) / dist;
    const perpDist = Math.abs(dx * pDirZ - dz * pDirX);

    // Pellet intersects target cylinder if forward projection is positive and perpendicular distance <= cylinder radius
    if (dot > 0 && perpDist <= targetRadius) {
      pelletsHit++;
    }
  }

  if (pelletsHit === 0) {
    return { hit: false, pelletsHit: 0, damage: 0, maxAllowedDamage: 0, dist };
  }

  const pelletDmg = getShotgunPelletDamage(dist);
  const damage = pelletsHit * pelletDmg;
  const maxAllowedDamage = getMaxShotgunDamageForDistance(dist);

  return {
    hit: true,
    pelletsHit,
    damage,
    maxAllowedDamage,
    dist,
  };
}
