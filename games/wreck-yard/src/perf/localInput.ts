import { NEUTRAL_INPUT, type YardInput } from '../sim/input';
import { perfActive, perfInput, perfInputEvent } from './recorder';

const inputFields = Object.keys(NEUTRAL_INPUT) as (keyof YardInput)[];
const MAX_SAMPLES = 256;
interface InputSample { readonly sequence: number; readonly slot: number; readonly frame: number; readonly input: YardInput }
const samples = new Map<string, InputSample>();
let eventSequence = 0;
const pending = new Map<number, number>();
let newestAppliedSequence = 0;

// This side table is local. It is never part of input bytes or checkpoints.
export function resetPerfInput(): void {
  samples.clear();
  eventSequence = 0;
  pending.clear();
  newestAppliedSequence = 0;
}
export function recordInputEvent(): void { eventSequence = perfInputEvent(-1); }

export function recordSampledInput(input: YardInput, frame: number, slot = 0): void {
  if (!perfActive() || eventSequence === 0) return;
  const key = `${slot}:${frame}`;
  if (!samples.has(key) && samples.size >= MAX_SAMPLES) samples.delete(samples.keys().next().value!);
  samples.set(key, { input, slot, frame, sequence: eventSequence });
  perfInput('sample', eventSequence, frame);
}
export function recordAppliedInputs(inputs: readonly YardInput[], frame: number): void {
  if (!perfActive()) return;
  for (let slot = 0; slot < inputs.length; slot += 1) {
    const sample = samples.get(`${slot}:${frame}`);
    const input = inputs[slot]!;
    if (!sample || !inputFields.every((field) => sample.input[field] === input[field])) continue;
    perfInput('apply', sample.sequence, frame);
    if (sample.sequence > newestAppliedSequence) {
      newestAppliedSequence = sample.sequence;
      if (pending.size >= MAX_SAMPLES) pending.delete(pending.keys().next().value!);
      pending.set(sample.sequence, frame);
    }
  }
}
export function recordInputSubmission(frame: number): void {
  // A successor tick contains the applied tick on both sides of interpolation.
  if (!perfActive()) return;
  for (const [sequence, appliedFrame] of pending) {
    if (frame <= appliedFrame) continue;
    perfInput('renderSubmission', sequence, frame);
    pending.delete(sequence);
  }
}
