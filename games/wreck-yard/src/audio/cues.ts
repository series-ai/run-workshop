import { FLOODLIGHT_LENSES, LAMP_SHOW_TICKS } from '../sim/floodlights';
import { CRATE_BREAK_SHOW_TICKS } from '../sim/crateBreak';
import { IMPACT_SHOW_TICKS } from '../sim/impacts';
import type { YardMaterial } from '../sim/materials';
import type { Impact } from '../sim/state';
import type { Vec3 } from '../sim/math';
import type { YardRender } from '../render/presentation';
import { isTorchFiring } from '../render/toolFeedback';
import { TICK_RATE } from '../sim/constants';
import { BUTTONS, CONVEYOR } from '../sim/contraptions';
import type { SoundId } from './bank';

export interface SoundMotion { readonly position: Vec3; readonly velocity: Vec3; readonly submerged: boolean }
export interface ShotCue { readonly id: string; readonly sound: SoundId; readonly at: Vec3; readonly gain: number; readonly rate: number }
export interface LoopCue { readonly id: string; readonly sound: SoundId; readonly at: Vec3; readonly gain: number; readonly rate: number }
export interface CueFrame { readonly shots: readonly ShotCue[]; readonly loops: readonly LoopCue[] }
/** The sound of a hit on each material. The body's material (sim/materials.ts) selects it, so paint does not change it. */
export const IMPACT_SOUND: Readonly<Record<YardMaterial, SoundId>> = {
  steel: 'metal', concrete: 'concrete', wood: 'wood', rubber: 'rubber', glass: 'glass',
};

/** The material that you hear most in a hit, first. Concrete is under almost every hit, so it comes last. */
const SOUND_PRIORITY: readonly YardMaterial[] = ['glass', 'steel', 'wood', 'rubber', 'concrete'];
/** Gain of the second material of a pair, against the first. */
export const SECOND_SOUND_GAIN = 0.45;

/**
 * The sounds of a hit between two materials: the one you hear most, and the
 * other one more quietly. Concrete adds no second sound, and two equal
 * materials make one sound.
 */
export function impactSounds(materials: readonly [YardMaterial, YardMaterial]): { readonly first: SoundId; readonly second: SoundId | null } {
  const [a, b] = SOUND_PRIORITY.indexOf(materials[0]) <= SOUND_PRIORITY.indexOf(materials[1]) ? materials : [materials[1], materials[0]];
  return { first: IMPACT_SOUND[a], second: a === b || b === 'concrete' ? null : IMPACT_SOUND[b] };
}

/** Cue reach (m) for a lamp: farther than the farthest corner of the yard from a lens (about 67 m). */
const YARD_REACH = 80;
/** Sounds of yard events. They play before hits when there are more shots than voices. */
const EVENT_SOUNDS: ReadonlySet<SoundId> = new Set<SoundId>(['explosion', 'glassBreak', 'lampFizz', 'lightsOut', 'relamp', 'crateBreak']);
/** One name per hit: the same hit after a rollback keeps its name, so it plays once. */
const impactKey = (impact: Impact) => `impact:${impact.bodyId}@${impact.frame}:${impact.materials.join('-')}`;
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
    for (const smash of render.contraptions.lampSmashes) this.seen.set(`lamp:${smash.lampId}@${smash.frame}`, render.frame);
    for (const lamp of render.contraptions.lamps) this.seen.set(`fizz:${lamp.lampId}@${lamp.flickerFrame}`, render.frame);
    for (const impact of render.impacts) this.seen.set(impactKey(impact), render.frame);
    for (const entry of render.contraptions.crateBreaks) this.seen.set(`crate:${entry.crateId}@${entry.frame}`, render.frame);
    if (render.contraptions.lightsOutUntil !== null) this.seen.set(`lightsOut@${render.contraptions.lightsOutUntil}`, render.frame);
    this.seen.set(`relamp@${render.contraptions.relitFrame}`, render.frame);
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
    const emit = (id: string, sound: SoundId, at: Vec3, gain = 1, rate = 1, cooldown = 0, reach = 32) => {
      if (distance(listener, at) > reach || this.seen.has(id)) return;
      // A cue that its cooldown blocks counts as heard, so it cannot play late when the cooldown ends.
      this.seen.set(id, render.frame);
      if ((this.cooldown.get(id.split('@')[0]!) ?? -1) > render.frame) return;
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
      const oldBody = beforeBodies.get(body.id);
      if (oldBody && oldBody.voxels !== body.voxels && render.stats.fractures > previous.stats.fractures) emit(`break:${body.id}@${render.frame}`, IMPACT_SOUND[body.material], motion.position, 0.55, 1.35, 12);
    }
    if (render.stats.fractures > previous.stats.fractures && !shots.some(s => s.id.startsWith('break:'))) {
      const fragment = render.bodies.find(b => !beforeBodies.has(b.id));
      const at = fragment && render.poses.get(fragment.id)?.position;
      // A torch or blast break uses the material sound. A FRAGILE crate break has its own cue below.
      const crateBroke = render.contraptions.crateBreaks.some(entry => entry.frame >= previous.frame);
      if (fragment && at && !crateBroke) emit(`break:${fragment.id}@${render.frame}`, IMPACT_SOUND[fragment.material], at, 0.65, 1.3, 12);
    }
    for (const entry of render.contraptions.crateBreaks) {
      if (entry.frame >= this.highFrame - CRATE_BREAK_SHOW_TICKS && render.frame - entry.frame < 6) {
        emit(`crate:${entry.crateId}@${entry.frame}`, 'crateBreak', entry.at, 1, 0.95 + (entry.crateId.length % 3) * 0.05);
      }
    }
    // Hits from the sim's contacts. The pair of materials picks the sounds. A held body makes no hit sound.
    for (const impact of render.impacts) {
      if (impact.frame < this.highFrame - IMPACT_SHOW_TICKS || held.has(impact.bodyId) || render.soundMotions?.get(impact.bodyId)?.submerged) continue;
      const sounds = impactSounds(impact.materials);
      const gain = Math.min(1.3, impact.speed * 0.1);
      const rate = 0.86 + (impact.bodyId.length % 5) * 0.05;
      const id = impactKey(impact);
      emit(id, sounds.first, impact.at, gain, rate, 8);
      // The second sound has its own cooldown key (the part before '@'), so the first sound's cooldown does not block it.
      if (sounds.second && shots.some(shot => shot.id === id)) emit(id.replace(/^impact:/, 'impact-second:'), sounds.second, impact.at, gain * SECOND_SOUND_GAIN, rate);
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
    // A lamp's id and frame name each smash and each flicker. The whole yard can hear them.
    for (const smash of render.contraptions.lampSmashes) {
      // A rollback can show a smash some frames late. The seen key stops a second play.
      if (smash.frame >= this.highFrame - LAMP_SHOW_TICKS && render.frame - smash.frame < LAMP_SHOW_TICKS) emit(`lamp:${smash.lampId}@${smash.frame}`, 'glassBreak', smash.at, 1, 1, 0, YARD_REACH);
    }
    for (const lamp of render.contraptions.lamps) {
      const lens = FLOODLIGHT_LENSES.find(entry => entry.lampId === lamp.lampId);
      // A relit lamp also flickers, but with no damage: the relamp sound covers it, so it does not fizz.
      if (lens && lamp.brokenAt === null && lamp.damage > 0 && lamp.flickerFrame >= this.highFrame - 6 && render.frame - lamp.flickerFrame < 6) {
        emit(`fizz:${lamp.lampId}@${lamp.flickerFrame}`, 'lampFizz', lens.at, 1, 1, 0, YARD_REACH);
      }
    }
    const lightsOutUntil = render.contraptions.lightsOutUntil;
    if (lightsOutUntil !== null && previous.contraptions.lightsOutUntil === null) emit(`lightsOut@${lightsOutUntil}`, 'lightsOut', listener);
    if (render.contraptions.relitFrame > previous.contraptions.relitFrame) emit(`relamp@${render.contraptions.relitFrame}`, 'relamp', listener);
    this.highFrame = render.frame;
    this.previous = render;
    for (const [key, frame] of this.seen) if (render.frame - frame > 300) this.seen.delete(key);
    for (const [key, frame] of this.cooldown) if (render.frame > frame + 300) this.cooldown.delete(key);
    // Yard events come first, so a pile of near hits cannot hide a far explosion or lamp.
    shots.sort((a, b) => Number(!EVENT_SOUNDS.has(a.sound)) - Number(!EVENT_SOUNDS.has(b.sound)) || distance(a.at, listener) - distance(b.at, listener));
    return { shots: shots.slice(0, 10), loops: loops.slice(0, 8) };
  }
}
