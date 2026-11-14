import { describe, expect, it } from 'vitest';
import { InkTrails } from '../src/render/InkTrails.js';

describe('InkTrails', () => {
  it('allocates 4 dedicated slots and starts with 0 active ribbons', () => {
    const trails = new InkTrails();
    expect(trails.activeCount).toBe(0);
    expect(trails.group.name).toBe('ink-motion-trails');
    expect(trails.group.children.length).toBe(1);
    trails.dispose();
  });

  it('records samples into slots and generates ribbon segments on update', () => {
    const trails = new InkTrails();
    const time = 10.0;

    // Slot 0 (Player locomotion)
    trails.sample(0, { x: 0, y: 0.1, z: 0 }, { x: 0.2, y: 0.1, z: 0 }, time);
    trails.sample(0, { x: 1, y: 0.1, z: 0 }, { x: 1.2, y: 0.1, z: 0 }, time + 0.03);

    trails.update(time + 0.04);
    expect(trails.activeCount).toBe(1);
    expect(trails.triangleCount).toBeGreaterThan(0);

    trails.dispose();
  });

  it('enforces per-shot ownership via setAction to prevent cross-shot bridge lines', () => {
    const trails = new InkTrails();
    const time = 20.0;

    trails.setAction(2, 'shot_1');
    trails.line(
      2,
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 1, z: 0 },
      { x: 0, y: 0.05, z: 0 },
      time
    );
    trails.update(time + 0.01);
    expect(trails.activeCount).toBe(1);

    // New shot on Slot 2 with different actionId MUST clear slot immediately
    trails.setAction(2, 'shot_2');
    trails.update(time + 0.02);
    // Since setAction cleared slot 2 and no new samples added, active count is 0
    expect(trails.activeCount).toBe(0);

    trails.dispose();
  });

  it('supports explicit lines for projectile wakes', () => {
    const trails = new InkTrails();
    const time = 5.0;

    trails.line(
      2,
      { x: 0, y: 1, z: 0 },
      { x: 25, y: 1, z: 0 },
      { x: 0, y: 0.05, z: 0 },
      time,
      '#eeece5',
      0.1
    );
    trails.update(time + 0.02);
    expect(trails.activeCount).toBe(1);

    trails.clear(2);
    trails.update(time + 0.03);
    expect(trails.activeCount).toBe(0);

    trails.dispose();
  });
});
