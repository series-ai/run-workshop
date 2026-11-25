// Generate the sound effects in sounds.json through asset-bot's MCP server (ElevenLabs via fal.ai).
//
//   node sounds/generate.mjs <asset-bot project .asset-bot folder> [--only id,id] [--takes 2]
//
// Talks to `asset-bot mcp` directly with the MCP SDK client, so it works whether or not the
// asset-bot connection is up in an editor. Writes out/sounds/raw/<id>_NN.wav and
// out/sounds/provenance.json (prompt, provider, run id and source path of every take).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const project = args[0];
if (!project) throw new Error('usage: node sounds/generate.mjs <asset-bot project .asset-bot folder> [--only a,b] [--takes 2]');
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const only = opt('--only', null)?.split(',');
const takes = Number(opt('--takes', 2));
const spec = JSON.parse(readFileSync(path.join(here, 'sounds.json'), 'utf8'));
const outDir = path.resolve(here, '..', 'out', 'sounds');
const rawDir = path.join(outDir, 'raw');
mkdirSync(rawDir, { recursive: true });
const provPath = path.join(outDir, 'provenance.json');
const prov = existsSync(provPath) ? JSON.parse(readFileSync(provPath, 'utf8')) : {};

const transport = new StdioClientTransport({ command: 'asset-bot', args: ['mcp'], cwd: path.dirname(project), stderr: 'pipe' });
const client = new Client({ name: 'trainspotter-sounds', version: '1.0.0' });
await client.connect(transport);

const jobs = spec.sounds.filter((s) => !s.cut && !s.mix && (!only || only.includes(s.id))); // cut: and mix: sounds come from process.py
const queue = [...jobs];
let failed = 0;
async function work() {
  while (queue.length) {
    const s = queue.shift();
    const prompt = s.prompt + spec.suffix;
    const res = await client.callTool({ name: 'generate_audio', arguments: { type: 'sfx', prompt, category: 'sfx', durationSec: s.dur, count: takes, outputFormat: 'wav', projectPath: project } },
      undefined, { timeout: 900000 });
    const text = res.content.map((c) => c.text).join('\n');
    if (res.isError) { failed++; console.log('FAIL', s.id, text.slice(0, 200)); continue; }
    const r = JSON.parse(text);
    prov[s.id] = r.savedPaths.map((src, k) => {
      const file = `${s.id}_${String(k + 1).padStart(2, '0')}.wav`;
      copyFileSync(src, path.join(rawDir, file));
      return { file, prompt, durationSec: s.dur, provider: r.provider, model: r.model, api: 'ElevenLabs sound effects', runId: r.runId, source: src };
    });
    console.log('ok', s.id, r.savedPaths.length);
    writeFileSync(provPath, JSON.stringify(prov, null, 1));
  }
}
await Promise.all(Array.from({ length: 4 }, work));
await client.close();
console.log(`${jobs.length - failed}/${jobs.length} sounds generated`);
