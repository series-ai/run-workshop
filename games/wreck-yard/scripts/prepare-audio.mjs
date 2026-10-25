import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ffmpeg = process.env.FFMPEG_BIN ?? '/opt/homebrew/bin/ffmpeg';
const sourceRoot = resolve(root, 'art/audio/raw');
const outputRoot = resolve(root, 'public/audio');
const clips = [
  { name: 'city-hum', environment: true, loop: true, seconds: 20, crossfade: 0.8, channels: 2, rate: 32000, bitrate: 80,
    filter: 'highpass=f=45,equalizer=f=94:t=h:w=30:g=-12,lowpass=f=1600', targetPeak: 0.18, targetRms: 0.035 },
  { name: 'distant-drill', environment: true, loop: false, channels: 1, rate: 24000, bitrate: 64,
    filter: 'highpass=f=180,lowpass=f=2200', targetPeak: 0.3, targetRms: 0.06, fadeInSeconds: 0.04, fadeOutSeconds: 0.08 },
  { name: 'distant-steam', environment: true, loop: false, channels: 1, rate: 24000, bitrate: 64,
    filter: 'highpass=f=700,lowpass=f=3200,lowpass=f=3200', targetPeak: 0.18, targetRms: 0.03, fadeInSeconds: 0.04, fadeOutSeconds: 0.08 },
  ...['torch', 'gravity-loop', 'jet-loop', 'buggy-loop'].map((name) => ({
    name, loop: true, seconds: ['torch', 'buggy-loop'].includes(name) ? 4 : 3,
    crossfade: 0.2, channels: 1, rate: 24000, bitrate: 64,
  })),
  { name: 'robot-step', loop: false, channels: 1, rate: 24000, bitrate: 64,
    filter: 'lowpass=f=1000,lowpass=f=1000', targetPeak: 0.22, targetRms: 0.025,
    fadeInSeconds: 0.015, fadeOutSeconds: 0.04, maxDurationSeconds: 0.18,
    maxDecodedDurationSeconds: 0.2, maxDecodedPeak: 0.25, detailedMeasurements: true },
  ...['tool-switch', 'metal-impact', 'wood-impact', 'concrete-impact',
    'water-splash', 'quench', 'gravity-pulse', 'explosion', 'mechanism', 'glass-break',
    'glass-impact', 'crate-break', 'lamp-fizz', 'lights-out', 'relamp'].map((name) => ({
    name, loop: false, channels: 1, rate: 24000, bitrate: 64,
  })),
  // The generated thud is mostly below 200 Hz. The filter lifts its 400 Hz and 1 kHz body, so small speakers play it.
  { name: 'rubber-impact', loop: false, channels: 1, rate: 24000, bitrate: 64,
    filter: 'highpass=f=70,highpass=f=70,equalizer=f=400:t=q:w=1:g=10,equalizer=f=1000:t=q:w=1.2:g=8' },
];

function run(args, input) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], {
    input, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
}

function floats(buffer) {
  const values = new Float32Array(buffer.length / 4);
  for (let index = 0; index < values.length; index++) values[index] = buffer.readFloatLE(index * 4);
  return values;
}

function pcm(values) {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function decode(path, clip) {
  return floats(run(['-i', path, '-f', 'f32le', '-ac', String(clip.channels), '-ar', String(clip.rate), 'pipe:1']));
}

function peak(values) {
  let maximum = 0;
  for (const value of values) maximum = Math.max(maximum, Math.abs(value));
  return maximum;
}

function rms(values) {
  let total = 0;
  for (const value of values) total += value * value;
  return Math.sqrt(total / values.length);
}

function trimShot(values, clip) {
  const frame = Math.round(clip.rate * 0.005);
  const levels = [];
  for (let index = 0; index < values.length; index += frame) levels.push(rms(values.subarray(index, index + frame)));
  const threshold = Math.max(0.0004, Math.max(...levels) * 0.01);
  const active = levels.flatMap((level, index) => level >= threshold ? [index] : []);
  if (active.length === 0) throw new Error(`${clip.name}: no sound above the trim threshold`);
  const start = Math.max(0, active[0] * frame - Math.round(clip.rate * 0.015));
  const end = Math.min(values.length, (active.at(-1) + 1) * frame + Math.round(clip.rate * 0.06),
    clip.maxDurationSeconds ? start + Math.round(clip.rate * clip.maxDurationSeconds) : Infinity);
  const trimmed = values.slice(start, end);
  const fadeInSeconds = clip.fadeInSeconds ?? 0.0005;
  const fadeOutSeconds = clip.fadeOutSeconds ?? 0.015;
  const fadeIn = Math.min(Math.round(clip.rate * fadeInSeconds), trimmed.length);
  const fadeOut = Math.min(Math.round(clip.rate * fadeOutSeconds), trimmed.length);
  for (let index = 0; index < fadeIn; index++) trimmed[index] *= index / fadeIn;
  for (let index = 0; index < fadeOut; index++) trimmed[trimmed.length - 1 - index] *= index / fadeOut;
  return { values: trimmed, trimStartSeconds: start / clip.rate, trimEndSeconds: (values.length - end) / clip.rate,
    ...(clip.environment || clip.detailedMeasurements ? { fadeInSeconds, fadeOutSeconds } : {}),
    ...(clip.maxDurationSeconds ? { maxDurationSeconds: clip.maxDurationSeconds } : {}) };
}

function prepareLoop(values, clip) {
  const sourceSeconds = values.length / clip.channels / clip.rate;
  const tempo = sourceSeconds / (clip.seconds + clip.crossfade);
  const stretched = floats(run([
    '-f', 'f32le', '-ar', String(clip.rate), '-ac', String(clip.channels), '-i', 'pipe:0',
    '-af', `atempo=${tempo}`, '-f', 'f32le', 'pipe:1',
  ], pcm(values)));
  const frames = stretched.length / clip.channels;
  const overlap = Math.round(clip.crossfade * clip.rate);
  if (frames < overlap * 3) throw new Error(`${clip.name}: loop source is too short`);
  const output = new Float32Array((frames - overlap) * clip.channels);
  output.set(stretched.subarray(overlap * clip.channels, (frames - overlap) * clip.channels));
  const blendStart = (frames - 2 * overlap) * clip.channels;
  for (let frame = 0; frame < overlap; frame++) {
    const phase = frame / (overlap - 1) * Math.PI / 2;
    for (let channel = 0; channel < clip.channels; channel++) {
      const tail = stretched[(frames - overlap + frame) * clip.channels + channel];
      const head = stretched[frame * clip.channels + channel];
      output[blendStart + frame * clip.channels + channel] = tail * Math.cos(phase) + head * Math.sin(phase);
    }
  }
  // Put the MP3 boundary at a quiet sample to reduce encoder edge changes.
  const outputFrames = output.length / clip.channels;
  let cutFrame = 1;
  let bestScore = Infinity;
  for (let frame = 1; frame < outputFrames; frame++) {
    let score = 0;
    for (let channel = 0; channel < clip.channels; channel++) {
      const before = output[(frame - 1) * clip.channels + channel];
      const after = output[frame * clip.channels + channel];
      score += before * before + after * after + 16 * (after - before) ** 2;
    }
    if (score < bestScore) { bestScore = score; cutFrame = frame; }
  }
  const rotated = new Float32Array(output.length);
  const cut = cutFrame * clip.channels;
  rotated.set(output.subarray(cut));
  rotated.set(output.subarray(0, cut), output.length - cut);
  return { values: rotated, tempo, crossfadeSeconds: clip.crossfade, rotationSeconds: cutFrame / clip.rate };
}

function measure(values, clip) {
  const frames = values.length / clip.channels;
  const edgeFrames = Math.min(Math.round(clip.rate * 0.025), Math.floor(frames / 2));
  const derivativeFrames = Math.min(Math.round(clip.rate * 0.1), Math.floor(frames / 2));
  const derivatives = [];
  let seamJump = 0;
  for (let channel = 0; channel < clip.channels; channel++) {
    seamJump = Math.max(seamJump, Math.abs(values[channel] - values[(frames - 1) * clip.channels + channel]));
    for (let frame = 1; frame < derivativeFrames; frame++) {
      derivatives.push(Math.abs(values[frame * clip.channels + channel] - values[(frame - 1) * clip.channels + channel]));
      const tail = frames - derivativeFrames + frame;
      derivatives.push(Math.abs(values[tail * clip.channels + channel] - values[(tail - 1) * clip.channels + channel]));
    }
  }
  derivatives.sort((a, b) => a - b);
  const derivativeP99 = derivatives[Math.floor(derivatives.length * 0.99)];
  const derivativeRms = rms(derivatives);
  const startRms = rms(values.subarray(0, edgeFrames * clip.channels));
  const endRms = rms(values.subarray((frames - edgeFrames) * clip.channels));
  return {
    durationSeconds: frames / clip.rate, peak: peak(values), rms: rms(values), rmsDbfs: 20 * Math.log10(rms(values)),
    seamMaxJump: seamJump, adjacentDerivativeRms: derivativeRms,
    adjacentDerivativeP99: derivativeP99, seamToDerivativeP99: seamJump / Math.max(derivativeP99, 1e-9),
    first25msRms: startRms, last25msRms: endRms,
    edgeRmsRatio: Math.max(startRms, endRms) / Math.max(Math.min(startRms, endRms), 1e-9),
  };
}

function measureSpectrum(values, clip) {
  const size = 4096;
  const powers = new Float64Array(size / 2 + 1);
  const frames = values.length / clip.channels;
  let windows = 0;
  for (let start = 0; start + size <= frames; start += size) {
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    for (let index = 0; index < size; index++) {
      let sample = 0;
      for (let channel = 0; channel < clip.channels; channel++) sample += values[(start + index) * clip.channels + channel] / clip.channels;
      real[index] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1)));
    }
    for (let index = 1, reverse = 0; index < size; index++) {
      let bit = size >> 1;
      while (reverse & bit) { reverse ^= bit; bit >>= 1; }
      reverse ^= bit;
      if (index < reverse) [real[index], real[reverse]] = [real[reverse], real[index]];
    }
    for (let length = 2; length <= size; length *= 2) {
      for (let startBin = 0; startBin < size; startBin += length) {
        for (let offset = 0; offset < length / 2; offset++) {
          const phase = -2 * Math.PI * offset / length;
          const odd = startBin + offset + length / 2;
          const even = startBin + offset;
          const partReal = real[odd] * Math.cos(phase) - imaginary[odd] * Math.sin(phase);
          const partImaginary = real[odd] * Math.sin(phase) + imaginary[odd] * Math.cos(phase);
          real[odd] = real[even] - partReal;
          imaginary[odd] = imaginary[even] - partImaginary;
          real[even] += partReal;
          imaginary[even] += partImaginary;
        }
      }
    }
    for (let index = 0; index < powers.length; index++) powers[index] += real[index] ** 2 + imaginary[index] ** 2;
    windows++;
  }
  const total = powers.reduce((sum, power) => sum + power, 0);
  let centroid = 0;
  let strongest = 0;
  for (let index = 0; index < powers.length; index++) {
    centroid += powers[index] * index * clip.rate / size;
    if (powers[index] > powers[strongest]) strongest = index;
  }
  const bands = [[0, 80], [80, 500], [500, 2500], [2500, clip.rate / 2]].map(([low, high]) => {
    let power = 0;
    for (let index = 0; index < powers.length; index++) {
      const frequency = index * clip.rate / size;
      if (frequency >= low && frequency < high) power += powers[index];
    }
    return { lowHz: low, highHz: high, powerFraction: power / total };
  });
  return { method: '4096 sample Hann windows, no overlap, stereo channels averaged', windows,
    centroidHz: centroid / total, strongestBinHz: strongest * clip.rate / size,
    strongestBinPowerFraction: powers[strongest] / total, bands };
}

function measureLoudness(path) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', path, '-af', 'loudnorm=I=-23:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'], { maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString());
  const text = result.stderr.toString();
  const summary = JSON.parse(text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1));
  const integratedLufs = Number(summary.input_i);
  return { integratedLufs: Number.isFinite(integratedLufs) ? integratedLufs : null,
    ...(!Number.isFinite(integratedLufs) ? { integratedLufsReason: 'FFmpeg did not return a finite integrated loudness value.' } : {}),
    truePeakDbtp: Number(summary.input_tp), loudnessRangeLu: Number(summary.input_lra) };
}

mkdirSync(outputRoot, { recursive: true });
const assets = clips.map((clip) => {
  const source = resolve(sourceRoot, `${clip.name}.mp3`);
  const receipt = JSON.parse(readFileSync(`${source}.json`, 'utf8'));
  if (typeof receipt.generationId !== 'string' || typeof receipt.prompt !== 'string') {
    throw new Error(`${clip.name}: invalid generation receipt`);
  }
  const sourcePcm = decode(source, clip);
  const raw = clip.filter ? floats(run(['-f', 'f32le', '-ar', String(clip.rate), '-ac', String(clip.channels), '-i', 'pipe:0', '-af', clip.filter, '-f', 'f32le', 'pipe:1'], pcm(sourcePcm))) : sourcePcm;
  const prepared = clip.loop ? prepareLoop(raw, clip) : trimShot(raw, clip);
  const targetPeak = clip.targetPeak ?? 0.65;
  const normalizationGain = Math.min(targetPeak / peak(prepared.values), clip.targetRms ? clip.targetRms / rms(prepared.values) : Infinity);
  prepared.values.forEach((value, index) => { prepared.values[index] = value * normalizationGain; });
  const output = resolve(outputRoot, `${clip.name}.mp3`);
  run(['-y', '-f', 'f32le', '-ar', String(clip.rate), '-ac', String(clip.channels), '-i', 'pipe:0',
    '-c:a', 'libmp3lame', '-b:a', `${clip.bitrate}k`, '-write_xing', '1', '-map_metadata', '-1', output], pcm(prepared.values));
  const decoded = decode(output, clip);
  const measurements = { ...measure(decoded, clip), ...(clip.environment || clip.detailedMeasurements ? { spectrum: measureSpectrum(decoded, clip), loudness: measureLoudness(output) } : {}) };
  if (measurements.peak >= 0.95) throw new Error(`${clip.name}: encoded peak exceeds the limit`);
  if (clip.maxDecodedPeak && measurements.peak > clip.maxDecodedPeak) throw new Error(`${clip.name}: encoded peak exceeds its clip limit`);
  if (clip.maxDecodedDurationSeconds && measurements.durationSeconds > clip.maxDecodedDurationSeconds) throw new Error(`${clip.name}: encoded duration exceeds its clip limit`);
  if (clip.loop && measurements.seamToDerivativeP99 > 2) throw new Error(`${clip.name}: encoded loop seam exceeds the limit`);
  const { values, ...processing } = prepared;
  return {
    name: clip.name, path: `/audio/${clip.name}.mp3`, loop: clip.loop, channels: clip.channels,
    sampleRate: clip.rate, bitrateKbps: clip.bitrate, bytes: statSync(output).size,
    outputSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    source: { path: `art/audio/raw/${clip.name}.mp3`, receiptPath: `art/audio/raw/${clip.name}.mp3.json`,
      sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), ...receipt },
    processing: { ...processing, normalizationGain, targetPeak, ...(clip.filter ? { filter: clip.filter, targetRms: clip.targetRms } : {}) }, measurements,
  };
});
const totalBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
if (totalBytes >= 1500000) throw new Error(`Audio size exceeds the limit: ${totalBytes}`);
const manifest = {
  version: 1, generator: 'scripts/prepare-audio.mjs', encoderVersion: run(['-version']).toString().split('\n')[0], codec: 'MPEG Layer III', totalBytes,
  retiredSources: [{ path: 'art/audio/raw/yard-ambient.mp3', receipt: JSON.parse(readFileSync(resolve(sourceRoot, 'yard-ambient.mp3.json'), 'utf8')),
    reason: 'The user asked for city and industrial sound after the musical bed did not fit.' },
  { path: 'art/audio/raw/retired/robot-step-clicky.mp3', receipt: JSON.parse(readFileSync(resolve(sourceRoot, 'retired/robot-step-clicky.mp3.json'), 'utf8')),
    reason: 'The user asked for a quieter walking sound with less click.' }],
  replacementGeneration: { successfulCalls: 3, successfulCreditsUsed: 74, failedCalls: 1,
    failedCall: { kind: 'sfx', durationSeconds: 24, error: 'AUDIO_GEN_UNKNOWN_ERROR', chargeResult: 'Not returned by CLI' } },
  walkingReplacementGeneration: { successfulCalls: 1, successfulCreditsUsed: 3, failedCalls: 0 },
  materialSoundGeneration: { successfulCalls: 4, successfulCreditsUsed: 22, failedCalls: 0,
    rejectedTakes: [
      { generationId: 'c682adf2-9d22-4e77-a312-3b5950c642f4', for: 'rubber-impact', reason: 'Peak 0.03, with several separate hits.' },
      { generationId: '00ce9429-3049-4a69-806f-266530767e70', for: 'glass-break', reason: 'A 90 ms soft start and scattered late hits.' },
    ] },
  feedbackSoundGeneration: { successfulCalls: 12, successfulCreditsUsed: 52, failedCalls: 4,
    failedCall: { error: 'IOException: ~/.rundot/config.json was in use by another call', chargeResult: 'No generation ID returned' },
    rejectedTakes: [
      { generationId: 'a85d0553-0d18-4c9e-8c90-99957e4228fe', for: 'glass-impact', reason: 'A low thud with almost no sound above 1 kHz. It did not read as glass.' },
      { generationId: 'e7f60d04-95c2-4c7a-bc34-8ddd9e781547', for: 'glass-impact', reason: 'A low thud with almost no sound above 1 kHz. It did not read as glass.' },
      { generationId: '545adbf2-7d15-41bf-bb03-1772bb5bdaf3', for: 'glass-impact', reason: 'A clean clink, but softer at the start than the kept take.' },
      { generationId: 'ff52413c-b2e5-4c74-8424-d74ed6e3cf83', for: 'crate-break', reason: 'A slower 40 ms start than the kept take.' },
      { generationId: '479d0dc9-8609-4f78-b99f-5679c14f4f0e', for: 'lamp-fizz', reason: 'One 0.15 s zap. The lamp flicker lasts 1.2 s.' },
      { generationId: 'c443f4ba-cd45-43ed-8f3c-1ca8337aa0c8', for: 'lights-out', reason: 'Almost all of it is below 200 Hz, with several separate hits.' },
      { generationId: 'f74af8d4-a088-4895-b9bb-c3fe73f0be82', for: 'relamp', reason: 'Quiet, and almost all of it is below 200 Hz.' },
    ] }, assets,
};
writeFileSync(resolve(root, 'art/audio/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const retiredOutput = resolve(outputRoot, 'yard-ambient.mp3');
if (existsSync(retiredOutput)) unlinkSync(retiredOutput);

console.log(JSON.stringify({ clips: assets.length, totalBytes }));
