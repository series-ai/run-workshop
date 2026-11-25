// Make public/trailer.mp4 (720 px wide, web-sized) and its poster from the tool's rendered
// trailer (tools/run-trainspotter: node trailer/capture.mjs). The trailer carries its song, so
// the file stays out of git (.gitignore); a deploy from a machine that has it ships it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const from = process.argv[2] ?? resolve(root, '../../tools/run-trainspotter/out/trailer/trainspotter-trailer.mp4');
if (!existsSync(from)) throw new Error(`no trailer at ${from}: render it first (tools/run-trainspotter, node trailer/capture.mjs)`);
const out = resolve(root, 'public/trailer.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '29.2', '-i', out, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4',
  resolve(root, 'public/trailer-poster.jpg')], { stdio: 'inherit' });
console.log('public/trailer.mp4 and trailer-poster.jpg <-', from);
