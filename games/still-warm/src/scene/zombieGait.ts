import { Vector3 } from "three";

interface Foot {
  position: Vector3;
  start: Vector3;
  end: Vector3;
  yaw: number;
  startYaw: number;
  endYaw: number;
}
const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));

// A stance foot has a fixed world position. Only one foot can swing at a time.
export class ZombieGait {
  readonly feet: [Foot, Foot];
  activeFoot: 0 | 1 | null = null;
  private elapsed = 0;
  private duration = 1;
  private lastFoot: 0 | 1 = 1;

  constructor(left: Vector3, right: Vector3, yaw: number) {
    const foot = (position: Vector3): Foot => ({
      position: position.clone(),
      start: position.clone(),
      end: position.clone(),
      yaw,
      startYaw: yaw,
      endYaw: yaw,
    });
    this.feet = [foot(left), foot(right)];
  }

  update(
    ideal: readonly [Vector3, Vector3],
    yaw: number,
    velocity: Vector3,
    dt: number,
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    if (this.activeFoot === null) {
      const next: 0 | 1 = this.lastFoot === 0 ? 1 : 0;
      const distances = this.feet.map((foot, i) =>
        foot.position.distanceTo(ideal[i]),
      );
      const selected =
        distances[next] > 0.1
          ? next
          : distances[1 - next] > 0.17
            ? ((1 - next) as 0 | 1)
            : null;
      if (selected === null) return;
      const foot = this.feet[selected];
      this.activeFoot = selected;
      this.lastFoot = selected;
      this.elapsed = 0;
      this.duration = selected === 0 ? 0.72 : 0.9;
      foot.start.copy(foot.position);
      foot.end
        .copy(ideal[selected])
        .addScaledVector(velocity, this.duration * 0.8);
      foot.end.y = ideal[selected].y;
      foot.startYaw = foot.yaw;
      foot.endYaw = yaw;
    }
    const foot = this.feet[this.activeFoot];
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    const ease = t * t * (3 - 2 * t);
    foot.position.lerpVectors(foot.start, foot.end, ease);
    foot.position.y += Math.sin(Math.PI * t) * 0.035;
    foot.yaw =
      foot.startYaw + angleDifference(foot.endYaw, foot.startYaw) * ease;
    if (t === 1) this.activeFoot = null;
  }
}
