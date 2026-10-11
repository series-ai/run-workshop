import type { Vec3 } from '../sim/math';
import type { YardBody } from '../sim/state';
import type { YardRender } from '../render/presentation';
import { isTorchFiring } from '../render/toolFeedback';
import { GRAVITY, TICK_RATE } from '../sim/constants';
import { BUTTONS, CONVEYOR } from '../sim/contraptions';
import type { SoundId } from './bank';

export type SoundMaterial = 'metal' | 'wood' | 'concrete';
export interface SoundMotion { readonly position: Vec3; readonly velocity: Vec3; readonly submerged: boolean }
export interface ShotCue { readonly id: string; readonly sound: SoundId; readonly at: Vec3; readonly gain: number; readonly rate: number }
export interface LoopCue { readonly id: string; readonly sound: SoundId; readonly at: Vec3; readonly gain: number; readonly rate: number }
export interface CueFrame { readonly shots: readonly ShotCue[]; readonly loops: readonly LoopCue[] }
const materials = new WeakMap<Uint8Array, SoundMaterial>();

/** The main voxel material selects the impact sound. Trim colors do not change it. */
export function soundMaterial(body: YardBody): SoundMaterial {
  const cached = materials.get(body.voxels);
  if (cached) return cached;
  if (body.id === 'vehicle-chassis') return 'metal';
  if (body.label.includes('Concrete') || body.label === 'Jersey Barrier') return 'concrete';
  if (/Pallet|Plank|Float Crate/.test(body.label)) return 'wood';
  const counts = new Uint32Array(3);
  for (const material of body.voxels) {
    if (material === 0) continue;
    // Codes above 15 are paint, not base materials.
    const base = material > 15 ? 3 : material;
    counts[base === 2 ? 1 : base === 1 || base === 5 ? 2 : 0]! += 1;
  }
  const result = counts[1]! > counts[0]! && counts[1]! > counts[2]! ? 'wood' : counts[2]! > counts[0]! ? 'concrete' : 'metal';
  materials.set(body.voxels, result);
  return result;
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CONVEYOR_SOUND: Vec3 = [CONVEYOR.x, CONVEYOR.topY, CONVEYOR.zEnd];

/** Presentation only. Forward frames produce cues; rollback never plays old cues again. */
export class YardCueTracker {
  private session = -1;
  private previous: YardRender | null = null;
  private highFrame = -1;
  private readonly seen = new Map<string, number>();
  private readonly cooldown = new Map<string, number>();
  private readonly walked = new Map<number, number>();

  seed(render: YardRender, session: number): void {
    if (this.session !== session) {
      this.session = session;
      this.highFrame = -1;
      this.seen.clear();
      this.cooldown.clear();
    }
    this.previous = render;
    this.highFrame = Math.max(this.highFrame, render.frame);
    this.walked.clear();
    for (const player of render.players) {
      if (player.feedback) this.seen.set(`player:${player.slot}:${player.feedback.result}@${player.feedback.frame}`, render.frame);
    }
    const occurrences = new Map<string, number>();
    for (const explosion of render.contraptions.explosions) {
      const signature = `${explosion.frame}:${explosion.at.join(',')}`;
      const ordinal = occurrences.get(signature) ?? 0;
      occurrences.set(signature, ordinal + 1);
      this.seen.set(`explosion:${signature}:${ordinal}`, render.frame);
    }
  }

  update(render: YardRender, session: number): CueFrame {
    const shots: ShotCue[] = [];
    const loops: LoopCue[] = [];
    const local = render.players.find(p => p.slot === render.localSlot);
    if (!local) return { shots, loops };
    const listener = local.position;
    for (const player of render.players) {
      if (distance(listener, player.position) > 22) continue;
      const prefix = `player:${player.slot}`;
      if (player.jetpackActive && !player.ridingVehicle) loops.push({ id: prefix + ':jet', sound: 'jet', at: player.position, gain: 1, rate: 1 });
      if (player.grabbing) loops.push({ id: prefix + ':hold', sound: 'gravity', at: player.position, gain: 1, rate: 1 });
      if (player.activeTool === 'torch' && isTorchFiring(player.feedback, render.frame) && player.feedback?.result !== 'quench') {
        loops.push({ id: prefix + ':torch', sound: 'torch', at: player.position, gain: player.feedback?.result === 'cut' ? 1 : 0.7, rate: player.feedback?.result === 'cut' ? 1.08 : 1 });
      }
    }
    const driver = render.players.find(p => p.ridingVehicle);
    const buggy = render.soundMotions?.get('vehicle-chassis');
    if (driver && buggy && distance(listener, buggy.position) < 28) {
      const speed = Math.hypot(...buggy.velocity) * TICK_RATE;
      loops.push({ id: 'buggy', sound: 'buggy', at: buggy.position, gain: 0.55 + Math.min(speed / 12, 0.7), rate: 0.8 + Math.min(speed / 14, 0.7) });
    }
    if (distance(listener, CONVEYOR_SOUND) < 14) loops.push({ id: 'conveyor', sound: 'buggy', at: CONVEYOR_SOUND, gain: 0.23, rate: 0.55 });
    loops.sort((a, b) => distance(a.at, listener) - distance(b.at, listener));
    const previous = this.previous;
    if (this.session !== session || !previous || render.frame - previous.frame > 8) {
      this.seed(render, session);
      return { shots, loops: loops.slice(0, 8) };
    }
    if (render.frame <= this.highFrame) {
      if (render.frame < this.highFrame) this.previous = render;
      return { shots, loops: loops.slice(0, 8) };
    }
    const step = render.frame - previous.frame;
    const emit = (id: string, sound: SoundId, at: Vec3, gain = 1, rate = 1, cooldown = 0) => {
      if (distance(listener, at) > 32 || this.seen.has(id) || (this.cooldown.get(id.split('@')[0]!) ?? -1) > render.frame) return;
      this.seen.set(id, render.frame);
      if (cooldown) this.cooldown.set(id.split('@')[0]!, render.frame + cooldown);
      shots.push({ id, sound, at, gain, rate });
    };
    const held = new Set([...previous.players, ...render.players].flatMap(p => p.grabbing ? [p.grabbing] : []));
    for (const player of render.players) {
      const before = previous.players.find(p => p.slot === player.slot);
      if (!before) continue;
      const prefix = `player:${player.slot}`;
      const feedback = player.feedback;
      if (feedback && feedback.frame >= this.highFrame && render.frame - feedback.frame <= 5) {
        const id = `${prefix}:${feedback.result}@${feedback.frame}`;
        switch (feedback.result) {
          case 'grab': emit(id, 'pulse', feedback.point, 0.65, 1.25); break;
          case 'punt': emit(id, 'pulse', player.position, 1, 0.85); break;
          case 'throw': emit(id, 'pulse', player.position, 0.5, 1.35); break;
          case 'press': emit(id, 'mechanism', feedback.point); break;
          case 'quench': emit(id, 'quench', feedback.point, 1, 1, 15); break;
          case 'blocked': case 'miss':
            if (player.activeTool === 'gravity') emit(id, 'switch', player.position, 0.35, 0.7, 9);
            break;
          case 'cut': case 'scorch': break;
        }
      }
      if (player.activeTool !== before.activeTool) emit(`${prefix}:switch@${render.frame}`, 'switch', player.position);
      if (player.ridingVehicle !== before.ridingVehicle) emit(`${prefix}:mount@${render.frame}`, 'mechanism', player.position, 0.5, 1.2);
      if (before.grabbing && !player.grabbing && feedback?.result !== 'throw' && feedback?.result !== 'punt') emit(`${prefix}:release@${render.frame}`, 'switch', player.position, 0.6, 0.8);
      if (player.grounded && !before.grounded && before.velocity && before.velocity[1] < -0.045 && !player.ridingVehicle) {
        emit(`${prefix}:land@${render.frame}`, 'concrete', player.position, Math.min(0.7, -before.velocity[1] * 3), 1.2);
      }
      const tickPosition = player.soundPosition ?? player.position;
      const tickBefore = before.soundPosition ?? before.position;
      const moved = distance(tickPosition, tickBefore);
      if (player.grounded && !player.jetpackActive && !player.ridingVehicle && moved < 1 && distance(listener, player.position) < 12) {
        const walked = (this.walked.get(player.slot) ?? 0) + Math.hypot(tickPosition[0] - tickBefore[0], tickPosition[2] - tickBefore[2]);
        this.walked.set(player.slot, walked % 1.1);
        if (walked >= 1.1) emit(`${prefix}:step@${render.frame}`, 'step', player.position, 0.7, 0.92 + (render.frame % 3) * 0.06, 7);
      }
    }
    const beforeBodies = new Map(previous.bodies.map(b => [b.id, b]));
    for (const body of render.bodies) {
      const motion = render.soundMotions?.get(body.id);
      const before = previous.soundMotions?.get(body.id);
      if (!motion || !before || body.motion === 'fixed') continue;
      if (motion.submerged && !before.submerged && Math.hypot(...before.velocity) > 0.02) emit(`water:${body.id}@${render.frame}`, 'splash', motion.position, Math.min(1.2, 0.5 + Math.hypot(...before.velocity) * 3), 1, 75);
      if (held.has(body.id) || motion.submerged || before.submerged) continue;
      const dv = [motion.velocity[0] - before.velocity[0], motion.velocity[1] - before.velocity[1] + GRAVITY / (TICK_RATE * TICK_RATE) * step, motion.velocity[2] - before.velocity[2]];
      const impulse = Math.hypot(...dv);
      if (impulse > 0.065 && Math.hypot(...before.velocity) > 0.025 && distance(motion.position, before.position) < 3) {
        emit(`impact:${body.id}@${render.frame}`, soundMaterial(body), motion.position, Math.min(1.3, impulse * 3), 0.86 + (body.id.length % 5) * 0.05, 8);
      }
      const oldBody = beforeBodies.get(body.id);
      if (oldBody && oldBody.voxels !== body.voxels && render.stats.fractures > previous.stats.fractures) emit(`break:${body.id}@${render.frame}`, soundMaterial(body), motion.position, 0.55, 1.35, 12);
    }
    if (render.stats.fractures > previous.stats.fractures && !shots.some(s => s.id.startsWith('break:'))) {
      const fragment = render.bodies.find(b => !beforeBodies.has(b.id));
      const at = fragment && render.poses.get(fragment.id)?.position;
      if (fragment && at) emit(`break:${fragment.id}@${render.frame}`, soundMaterial(fragment), at, 0.65, 1.3, 12);
    }
    if (render.stats.dunks > previous.stats.dunks) emit(`dunk@${render.frame}`, 'metal', local.position, 0.7, 1.4);
    for (const [key, button] of [['lastDropFrame', BUTTONS[0]!], ['lastLaunchFrame', BUTTONS[1]!]] as const) {
      if (render.contraptions[key] > previous.contraptions[key]) emit(`${key}@${render.contraptions[key]}`, 'mechanism', button.base, 1.2, key === 'lastLaunchFrame' ? 0.8 : 1);
    }
    const occurrences = new Map<string, number>();
    for (const explosion of render.contraptions.explosions) {
      const signature = `${explosion.frame}:${explosion.at.join(',')}`;
      const ordinal = occurrences.get(signature) ?? 0;
      occurrences.set(signature, ordinal + 1);
      if (explosion.frame >= this.highFrame && render.frame - explosion.frame < 6) emit(`explosion:${signature}:${ordinal}`, 'explosion', explosion.at, 1);
    }
    this.highFrame = render.frame;
    this.previous = render;
    for (const [key, frame] of this.seen) if (render.frame - frame > 300) this.seen.delete(key);
    for (const [key, frame] of this.cooldown) if (render.frame > frame + 300) this.cooldown.delete(key);
    shots.sort((a, b) => distance(a.at, listener) - distance(b.at, listener));
    return { shots: shots.slice(0, 10), loops: loops.slice(0, 8) };
  }
}
