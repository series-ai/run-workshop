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
    'water-splash', 'quench', 'gravity-pulse', 'explosion', 'mechanism'].map((name) => ({
    name, loop: false, channels: 1, rate: 24000, bitrate: 64,
  })),
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
  verification: 'FFmpeg decoded output checks. No listening check was done.',
  retiredSources: [{ path: 'art/audio/raw/yard-ambient.mp3', receipt: JSON.parse(readFileSync(resolve(sourceRoot, 'yard-ambient.mp3.json'), 'utf8')),
    reason: 'The user asked for city and industrial sound after the musical bed did not fit.' },
  { path: 'art/audio/raw/retired/robot-step-clicky.mp3', receipt: JSON.parse(readFileSync(resolve(sourceRoot, 'retired/robot-step-clicky.mp3.json'), 'utf8')),
    reason: 'The user asked for a quieter walking sound with less click.' }],
  replacementGeneration: { successfulCalls: 3, successfulCreditsUsed: 74, failedCalls: 1,
    failedCall: { kind: 'sfx', durationSeconds: 24, error: 'AUDIO_GEN_UNKNOWN_ERROR', chargeResult: 'Not returned by CLI' } },
  walkingReplacementGeneration: { successfulCalls: 1, successfulCreditsUsed: 3, failedCalls: 0 }, assets,
};
writeFileSync(resolve(root, 'art/audio/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const retiredOutput = resolve(outputRoot, 'yard-ambient.mp3');
if (existsSync(retiredOutput)) unlinkSync(retiredOutput);

const rows = assets.map((asset) => `<article><div><strong>${asset.name}</strong><small>${asset.measurements.durationSeconds.toFixed(2)} s · ${asset.loop ? 'loop' : 'one shot'}</small></div><button data-name="${asset.name}">Play</button><label><input type="checkbox" data-loop="${asset.name}" ${asset.loop ? 'checked' : ''}>Loop</label></article>`).join('\n');
writeFileSync(resolve(outputRoot, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wreck Yard audio check</title><style>
*{box-sizing:border-box}body{margin:0;background:#172020;color:#e8eee6;font:16px system-ui,sans-serif;padding:24px}main{max-width:720px;margin:auto}h1{font-size:26px;margin:0 0 12px}p{color:#b3c4bb;line-height:1.5}header{position:sticky;top:0;background:#172020;padding:12px 0 20px;border-bottom:1px solid #45554d}article{display:flex;align-items:center;gap:16px;padding:15px 0;border-bottom:1px solid #34433d}article div{flex:1}strong,small{display:block}small{color:#b3c4bb;margin-top:4px}button{color:#172020;background:#d8ee83;border:0;border-radius:6px;padding:10px 18px;font:inherit;cursor:pointer}button:active{transform:scale(.97)}label{white-space:nowrap}input{accent-color:#d8ee83}#status{min-height:24px}button:focus-visible,input:focus-visible{outline:3px solid white;outline-offset:4px}@media(max-width:420px){body{padding:16px}article{gap:10px}button{padding:10px 12px}label{font-size:14px}}
</style><main><header><h1>Wreck Yard audio check</h1><p>Play one file at a time. The start volume is 10%. Use the loop control to check each end.</p><label>Volume <input id="volume" type="range" min="0" max="0.35" step="0.01" value="0.10"></label> <button id="stop">Stop</button><p id="status" role="status">Ready.</p></header>${rows}</main>
<script>
const clips = ${JSON.stringify(assets.map(({ name, path }) => ({ name, path })))};
const audio = new Audio();
const status = document.querySelector('#status');
const volume = document.querySelector('#volume');
audio.volume = Number(volume.value);
volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
document.querySelector('#stop').addEventListener('click', () => { audio.pause(); audio.currentTime = 0; status.textContent = 'Stopped.'; });
for (const button of document.querySelectorAll('[data-name]')) button.addEventListener('click', async () => {
  const clip = clips.find(item => item.name === button.dataset.name);
  audio.pause(); audio.src = clip.path;
  audio.loop = document.querySelector('[data-loop="' + clip.name + '"]').checked;
  audio.volume = Number(volume.value);
  try { await audio.play(); status.textContent = 'Playing: ' + clip.name + (audio.loop ? ' (loop).' : '.'); }
  catch (error) { status.textContent = 'Playback failed: ' + error.message; }
});
for (const control of document.querySelectorAll('[data-loop]')) control.addEventListener('change', () => {
  if (audio.src.endsWith('/' + control.dataset.loop + '.mp3')) audio.loop = control.checked;
});
audio.addEventListener('ended', () => { status.textContent = 'Done.'; });
</script></html>\n`);

const metricRows = assets.map((asset) => {
  const m = asset.measurements;
  return `| ${asset.name} | ${m.durationSeconds.toFixed(3)} | ${asset.bytes} | ${m.peak.toFixed(4)} | ${m.rms.toFixed(4)} | ${asset.loop ? m.seamMaxJump.toFixed(5) : '—'} | ${asset.loop ? m.adjacentDerivativeP99.toFixed(5) : '—'} | ${asset.loop ? m.edgeRmsRatio.toFixed(3) : '—'} |`;
}).join('\n');
const environmentRows = assets.filter(asset => asset.source.path.includes('city-hum') || asset.source.path.includes('distant-')).map(asset => {
  const m = asset.measurements;
  return `| ${asset.name} | ${m.loudness.integratedLufs.toFixed(2)} | ${m.loudness.truePeakDbtp.toFixed(2)} | ${m.spectrum.centroidHz.toFixed(1)} | ${(100 * m.spectrum.strongestBinPowerFraction).toFixed(1)}% | ${asset.source.generationId} |`;
}).join('\n');
const walkingAsset = assets.find(asset => asset.name === 'robot-step');
writeFileSync(resolve(root, 'docs/audio-assets.md'), `# Audio files

The game uses ${assets.length} local MP3 files. Their total size is ${totalBytes} bytes.
The city hum uses two channels at 32 kHz and 80 kbps.
The effects use one channel at 24 kHz and 64 kbps.
MP3 files can play in Safari. Browser playback needs a user input.

## Source records

The source files and generation receipts are in \`art/audio/raw/\`.
Each receipt has a generation ID and the full prompt.
\`art/audio/manifest.json\` copies each receipt. It also records the source hash,
output size, format, processing values, and decoded output measurements.
The city and industrial files use three successful SFX calls. They used 74 credits.
A 24-second hum call failed with AUDIO_GEN_UNKNOWN_ERROR.
The failed call returned no generation ID or charge result.
The old musical source and its receipt remain in the raw folder.
The old output file is removed. The new bed has a new city-hum path to avoid an old browser cache entry.
The walking replacement uses one successful SFX call. It used 3 credits.
The old walking source and receipt are in \`art/audio/raw/retired/robot-step-clicky.mp3\` and its JSON file.
Only the processed files and the check page are in \`public/audio/\`.

## Processing

Run \`node scripts/prepare-audio.mjs\` from this project to rebuild all files.
The script needs FFmpeg with libmp3lame. Set \`FFMPEG_BIN\` to change its path.
The script decodes each source to floating point PCM.
For each short effect, it checks the RMS in 5 ms blocks.
It keeps 15 ms before the first active block and 60 ms after the last active block.
The threshold is 1% of the strongest block RMS, with a minimum of 0.0004.
Other action effects keep their 0.5 ms start fade and 15 ms end fade.
The short start fade keeps the attack.
The distant drill and steam use a 40 ms start fade and an 80 ms end fade.
The walking update keeps the same hashes for the other 16 output files.
Each output hash is in the manifest as outputSha256.

For each loop, FFmpeg changes the time length without changing the pitch.
An equal-power crossfade joins the last part to the first part.
The crossfade is 800 ms for ambient and 200 ms for effects.
The output starts at a low sample level. This reduces MP3 encoder edge changes.
It keeps sound across the loop end.
FFmpeg time processing can change the target length by a small amount.
Other action effects use a PCM peak target of 0.65.
City hum uses a PCM peak target of 0.18 and an RMS limit of 0.035.
Drill uses a peak target of 0.30 and an RMS limit of 0.06.
Steam uses a peak target of 0.18 and an RMS limit of 0.03.
MP3 encoding can change these values by a small amount.
It then decodes the final MP3 files and checks them.

## City and industrial sound

The bed uses an SFX prompt for quiet city air and distant machinery.
The prompt excludes music, voices, horns, and sirens.
The city hum has a 45 Hz high-pass filter and a 1600 Hz low-pass filter.
A 12 dB cut at 94 Hz reduces the strong motor tone in the source.
The drill has a 180 Hz high-pass filter and a 2200 Hz low-pass filter.
The steam has a 700 Hz high-pass filter and two 3200 Hz low-pass filters.
These filters reduce the close high-frequency sound in the generated sources.

Suggested bank gains are 0.6 for city hum, 0.3 for drill, and 0.22 for steam.
All three should use the Ambience volume setting.
Play the short files at separate times. Use long, variable delays between them.
The short files are not loops. Their runtime timing is separate from asset preparation.

The loudness values come from FFmpeg loudnorm input measurements.
The spectrum check uses 4096-sample Hann windows without overlap.
It averages stereo channels before the FFT and measures mean spectral power.
The centroid is the power-weighted mean frequency.
The strongest bin share describes a narrow frequency peak. It cannot prove that a file has no tune.
No listening check was done. The prompt and these measurements do not prove subjective sound quality.

| File | LUFS | True peak dBTP | Centroid Hz | Strongest bin share | Generation ID |
| --- | ---: | ---: | ---: | ---: | --- |
${environmentRows}

## Walking contact

The new source prompt asks for one soft rubber contact on dusty concrete.
It excludes mechanical clicks and metal sound.
Generation ID: ${walkingAsset.source.generationId}.
Two 1000 Hz low-pass filters reduce high frequencies.
A 15 ms start fade gives a soft attack. A 40 ms end fade reduces the tail.
The script keeps at most 180 ms and removes the later source sound.
The PCM peak target is 0.22. The RMS limit is 0.025.
The decoded file is ${walkingAsset.measurements.durationSeconds.toFixed(3)} seconds with peak ${walkingAsset.measurements.peak.toFixed(5)} and RMS ${walkingAsset.measurements.rms.toFixed(5)}.
Its spectrum centroid is ${walkingAsset.measurements.spectrum.centroidHz.toFixed(1)} Hz.
At playback rate 0.92, it lasts ${(walkingAsset.measurements.durationSeconds / 0.92).toFixed(3)} seconds.
The script rejects a decoded duration above 0.2 seconds or a peak above 0.25.
The file is shorter than the 400 ms loudness block. FFmpeg does not return a finite integrated LUFS value.
Use RMS and peak for this short file. No listening check was done.

## Output checks

These are numerical checks of the shipping MP3 files.
No listening check was done. Use \`/audio/index.html\` for a listening check.
The check page starts at 10% volume. It plays one clip at a time.
The loop control starts on for the five loop files.

The seam jump is the largest last-to-first sample change across all channels.
The adjacent value is the 99th percentile sample change in the first and last 100 ms.
The script rejects a loop if its seam jump exceeds twice that value.
The edge RMS ratio compares the first and last 25 ms.
A ratio near 1 means similar levels at the loop end.
The script rejects decoded peaks at or above 0.95 and total audio size at or above 1.5 MB.
These checks detect large end clicks, clipping, and size errors.
They do not prove that a loop has no audible change in tone or rhythm.

| File | Seconds | Bytes | Peak | RMS | Seam jump | Adjacent P99 | Edge RMS ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${metricRows}
`);
console.log(JSON.stringify({ totalBytes, clips: assets.map(({ name, bytes, measurements }) => ({ name, bytes, ...measurements })) }, null, 2));
