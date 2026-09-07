export class LookInput {
  yaw = 0;
  pitch = -0.32;
  enabled = false;

  reset(): void {
    this.yaw = 0;
    this.pitch = -0.32;
  }
  move(dx: number, dy: number): void {
    if (!this.enabled || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.yaw = Math.max(-1.7, Math.min(1.7, this.yaw - dx * 0.003));
    this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch - dy * 0.003));
  }
}
