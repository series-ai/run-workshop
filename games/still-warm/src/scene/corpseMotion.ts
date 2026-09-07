import { Vector3 } from "three";

export const CORPSE_HOME = [-0.66, -0.9, 0.42] as const;
export const CORPSE_SPEED = 0.28;
const FLOOR = CORPSE_HOME[1];

// Routes pass around the patient's feet. The last work position is retained.
export class CorpseMotion {
  readonly position = new Vector3(...CORPSE_HOME);
  readonly velocity = new Vector3();
  private route: Vector3[] = [];
  private destination = new Vector3(...CORPSE_HOME);
  private speed = 0;
  distanceTravelled = 0;

  get travelling(): boolean {
    return this.route.length > 0;
  }
  direction(out: Vector3): Vector3 {
    const waypoint = this.route[0];
    return waypoint
      ? out.subVectors(waypoint, this.position).normalize()
      : out.set(0, 0, 0);
  }
  stop(): void {
    this.route = [];
    this.destination.copy(this.position);
    this.speed = 0;
    this.velocity.set(0, 0, 0);
  }
  approach(target: Vector3): void {
    const next =
      target.z > 1.5
        ? new Vector3(target.x, FLOOR, target.z - 0.5)
        : target.x > 0.4
          ? new Vector3(0.78, FLOOR, 0.8)
          : new Vector3(...CORPSE_HOME);
    if (this.destination.distanceToSquared(next) < 0.001) return;
    this.destination.copy(next);
    this.route = [];
    if (this.position.x * next.x < 0) {
      this.route.push(new Vector3(this.position.x, FLOOR, 1.65));
      this.route.push(new Vector3(next.x, FLOOR, 1.65));
    }
    this.route.push(next);
  }
  step(dt: number, alignment = 1): boolean {
    this.velocity.set(0, 0, 0);
    const waypoint = this.route[0];
    if (!waypoint || dt <= 0 || !Number.isFinite(dt)) return false;
    dt = Math.min(dt, 0.1);
    const distance = this.position.distanceTo(waypoint);
    const goal =
      Math.min(CORPSE_SPEED, Math.sqrt(2 * 0.45 * distance)) *
      Math.max(0, Math.min(1, alignment));
    this.speed += Math.max(-0.6 * dt, Math.min(0.4 * dt, goal - this.speed));
    const step = Math.min(distance, this.speed * dt);
    if (distance > 0) {
      this.velocity
        .subVectors(waypoint, this.position)
        .multiplyScalar(step / distance / dt);
      this.position.addScaledVector(this.velocity, dt);
    }
    this.position.y = FLOOR;
    this.distanceTravelled += step;
    if (distance <= step + 0.001) {
      this.position.copy(waypoint);
      this.route.shift();
      this.speed = 0;
    }
    return step > 0.00001;
  }
}
