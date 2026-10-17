# Audio files

The game uses 24 local MP3 files. Their total size is 462720 bytes.
The city hum uses two channels at 32 kHz and 80 kbps.
The effects use one channel at 24 kHz and 64 kbps.
MP3 files can play in Safari. Browser playback needs a user input.

## Source records

The source files and generation receipts are in `art/audio/raw/`.
Each receipt has a generation ID and the full prompt.
`art/audio/manifest.json` copies each receipt. It also records the source hash,
output size, format, processing values, and decoded output measurements.
The city and industrial files use three successful SFX calls. They used 74 credits.
A 24-second hum call failed with AUDIO_GEN_UNKNOWN_ERROR.
The failed call returned no generation ID or charge result.
The old musical source and its receipt remain in the raw folder.
The old output file is removed. The new bed has a new city-hum path to avoid an old browser cache entry.
The walking replacement uses one successful SFX call. It used 3 credits.
The old walking source and receipt are in `art/audio/raw/retired/robot-step-clicky.mp3` and its JSON file.
Only the processed files and the check page are in `public/audio/`.

## Material sounds

The rubber impact and the glass break use four successful SFX calls. They used 22 credits.
Each prompt asked for two takes. The script keeps one take of each.
The other rubber take was almost silent and had several hits. The other glass take had a slow start and scattered late hits.
The rubber source is mostly below 200 Hz. Its filter lifts 400 Hz and 1 kHz, so small speakers can play it.

The glass knock, crate break, lamp fizz, lights-out, and relamp sounds use twelve successful SFX calls. They used 52 credits.
Four more calls failed before generation, because ten calls at the same time locked the CLI config file. They returned no generation ID.
The first two glass knock takes were low thuds, so a brighter prompt made two more. The manifest lists each rejected take and the reason.

## Processing

Run `node scripts/prepare-audio.mjs` from this project to rebuild all files.
The script needs FFmpeg with libmp3lame. Set `FFMPEG_BIN` to change its path.
The script decodes each source to floating point PCM.
For each short effect, it checks the RMS in 5 ms blocks.
It keeps 15 ms before the first active block and 60 ms after the last active block.
The threshold is 1% of the strongest block RMS, with a minimum of 0.0004.
Other action effects keep their 0.5 ms start fade and 15 ms end fade.
The short start fade keeps the attack.
The distant drill and steam use a 40 ms start fade and an 80 ms end fade.
Each update keeps the same hashes for the output files that it does not change.
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
| city-hum | -29.58 | -15.98 | 118.2 | 11.6% | be957ce4-dea5-46b1-9a42-bfbf2f75db88 |
| distant-drill | -22.22 | -11.49 | 2155.9 | 7.9% | a744aa07-be29-4a4f-a72c-b6bc979ba041 |
| distant-steam | -28.35 | -14.14 | 3261.3 | 1.4% | 9c67abb7-17d3-468c-8e92-5a3204cf3d52 |

## Walking contact

The new source prompt asks for one soft rubber contact on dusty concrete.
It excludes mechanical clicks and metal sound.
Generation ID: 3e6727b3-1a10-4b62-b465-55b95f5479d5.
Two 1000 Hz low-pass filters reduce high frequencies.
A 15 ms start fade gives a soft attack. A 40 ms end fade reduces the tail.
The script keeps at most 180 ms and removes the later source sound.
The PCM peak target is 0.22. The RMS limit is 0.025.
The decoded file is 0.180 seconds with peak 0.13517 and RMS 0.02375.
Its spectrum centroid is 162.7 Hz.
At playback rate 0.92, it lasts 0.196 seconds.
The script rejects a decoded duration above 0.2 seconds or a peak above 0.25.
The file is shorter than the 400 ms loudness block. FFmpeg does not return a finite integrated LUFS value.
Use RMS and peak for this short file. No listening check was done.

## Output checks

These are numerical checks of the shipping MP3 files.
No listening check was done. Use `/audio/index.html` for a listening check.
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
| city-hum | 19.978 | 200565 | 0.1589 | 0.0333 | 0.00092 | 0.00467 | 1.012 |
| distant-drill | 1.995 | 16749 | 0.2661 | 0.0571 | — | — | — |
| distant-steam | 2.000 | 16749 | 0.1835 | 0.0223 | — | — | — |
| torch | 3.986 | 32685 | 0.5734 | 0.1376 | 0.01072 | 0.47093 | 1.078 |
| gravity-loop | 2.990 | 24621 | 0.6144 | 0.2778 | 0.01459 | 0.17628 | 1.029 |
| jet-loop | 2.985 | 24621 | 0.6127 | 0.1414 | 0.00322 | 0.28165 | 1.145 |
| buggy-loop | 3.990 | 32685 | 0.6101 | 0.0716 | 0.00001 | 0.19630 | 1.119 |
| robot-step | 0.180 | 2157 | 0.1352 | 0.0237 | — | — | — |
| tool-switch | 0.470 | 4461 | 0.6327 | 0.0253 | — | — | — |
| metal-impact | 0.470 | 4461 | 0.6333 | 0.0455 | — | — | — |
| wood-impact | 0.900 | 7917 | 0.6182 | 0.0561 | — | — | — |
| concrete-impact | 0.600 | 5421 | 0.5931 | 0.0453 | — | — | — |
| water-splash | 1.135 | 9837 | 0.6293 | 0.0650 | — | — | — |
| quench | 1.080 | 9261 | 0.5417 | 0.0445 | — | — | — |
| gravity-pulse | 0.420 | 4077 | 0.6188 | 0.0990 | — | — | — |
| explosion | 1.190 | 10221 | 0.6163 | 0.1470 | — | — | — |
| mechanism | 1.130 | 9837 | 0.6293 | 0.0698 | — | — | — |
| glass-break | 0.810 | 7149 | 0.6064 | 0.0455 | — | — | — |
| glass-impact | 0.255 | 2733 | 0.6278 | 0.0755 | — | — | — |
| crate-break | 0.746 | 6765 | 0.6070 | 0.0373 | — | — | — |
| lamp-fizz | 0.795 | 7149 | 0.6184 | 0.1002 | — | — | — |
| lights-out | 0.900 | 7917 | 0.6160 | 0.0876 | — | — | — |
| relamp | 1.106 | 9645 | 0.6039 | 0.0662 | — | — | — |
| rubber-impact | 0.545 | 5037 | 0.6206 | 0.0601 | — | — | — |
