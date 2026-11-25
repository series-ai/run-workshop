// Post-export check for built GLBs: finalize them with the shared pipeline
// step, then check budgets and that every connector and coupler socket sits
// exactly where kit.json says.
//
//   node --import tsx lint/glb.mjs [build dir, default out/glb]
//
// Finalize (tools/run-voxel-packs/src/build/finalize.ts) is idempotent: nearest
// sampling, KHR_mesh_quantization, insets for fighting parts, and the scale class.
// Needs `npm ci` in tools/run-voxel-packs once. Exit code 1 on any failure.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rvx = path.resolve(here, '..', '..', 'run-voxel-packs', 'src');
const { finalizeGlb } = await import(pathToFileURL(path.join(rvx, 'build', 'finalize.ts')).href);
const { inspectGlb, readGlb } = await import(pathToFileURL(path.join(rvx, 'validate', 'inspect.ts')).href);

const dir = path.resolve(process.argv[2] ?? path.join(here, '..', 'out', 'glb'));
const kit = JSON.parse(readFileSync(path.join(dir, 'kit.json'), 'utf8'));
const BUDGET = { track: 1200, civil: 6000, stock: 5000, structures: 6000, props: 2000, loads: 2000, tokens: 800 };
const MAX_BYTES = 1.5 * 1024 * 1024;
const fails = [];
const fail = (m) => { fails.push(m); console.log('FAIL', m); };

function world(node) {
  const m = node.getWorldMatrix();
  return { p: [m[12], m[13], m[14]], back: [m[8], m[9], m[10]] }; // +Z axis of the node
}
const headingOf = (tx, tz) => ((Math.atan2(-tx, -tz) * 180) / Math.PI + 360) % 360;
const near = (a, b, tol = 1e-3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tol;

const rows = [];
for (const [section, items] of Object.entries(kit)) {
  if (!BUDGET[section]) continue;
  for (const [id, e] of Object.entries(items)) {
    const file = path.join(dir, e.file);
    await finalizeGlb(file, { quantize: true, insetUnit: 1, scale: e.scaleClass });
    const bytes = new Uint8Array(readFileSync(file));
    const s = await inspectGlb(bytes, { zfight: true });
    const tris = s.surface?.triangles ?? 0;
    const atlas = s.materials[0]?.baseColorSize ?? [0, 0];
    const size = statSync(file).size;
    if (tris > BUDGET[section]) fail(`${id}: ${tris} triangles (budget ${BUDGET[section]})`);
    if (Math.max(...atlas) > 2048) fail(`${id}: atlas ${atlas.join('x')} is over 2048`);
    if (size > MAX_BYTES) fail(`${id}: ${size} bytes is over 1.5 MB`);
    if ((s.zfight?.area ?? 0) > 1) fail(`${id}: ${s.zfight.area.toFixed(2)} voxel² of z-fighting (${s.zfight.worst})`);
    for (const g of s.socketGaps) if (g.gap > 10) fail(`${id}: ${g.name} is ${g.gap.toFixed(1)} voxels from any surface`);
    // sockets against the catalogue
    const doc = await readGlb(bytes);
    const nodes = Object.fromEntries(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    if (section === 'track' || (section === 'civil' && e.routes)) {
      for (const [k, c] of Object.entries(e.connectors)) {
        const n = nodes[`socket-track-${k}`];
        if (!n) { fail(`${id}: no socket-track-${k}`); continue; }
        const w = world(n);
        if (!near(w.p, c.p)) fail(`${id}: socket-track-${k} at ${w.p.map((v) => v.toFixed(4))}, kit.json says ${c.p}`);
        const yaw = headingOf(-w.back[0], -w.back[2]);
        if (Math.abs(((yaw - c.yaw + 540) % 360) - 180) > 1e-2) fail(`${id}: socket-track-${k} faces ${yaw.toFixed(3)}, kit.json says ${c.yaw}`);
      }
    }
    if (section === 'stock') {
      for (const end of ['f', 'r']) {
        const n = nodes[`socket-coupler-${end}`];
        const want = [0, kit.contract.couplerY, e.couplers[end]];
        if (!n || !near(world(n).p, want)) fail(`${id}: socket-coupler-${end} is not at ${want}`);
      }
      for (const w of Object.keys(e.wheels)) if (!nodes[w]) fail(`${id}: wheel node ${w} missing`);
    }
    rows.push(`${id.padEnd(30)} ${String(tris).padStart(5)} tris  atlas ${atlas.join('x').padEnd(9)} ${(size / 1024).toFixed(0).padStart(5)} KB  ${e.scaleClass}`);
  }
}
console.log(rows.join('\n'));
console.log(`${rows.length} GLBs, ${fails.length} failure(s)`);
process.exit(fails.length ? 1 : 0);
