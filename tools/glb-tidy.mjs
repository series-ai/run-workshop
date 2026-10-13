// Shared last steps for the asset-library packagers (run-cat-pack, run-dog-pack,
// run-dice-animals, run-dog-pack/chunky-toy). No dependencies: the first two take a
// gltf-transform Document, the last the written GLB.
//
//   restTracks(doc)       drop animation channels that hold their node's rest pose for the
//                         whole clip: three.js plays a missing channel as the rest pose, and
//                         each channel costs ~200 bytes of JSON on top of its keys
//   shortRotations(doc)   rotation keys as normalised 16-bit integers (core glTF): half the
//                         size of floats, far below any visible difference
//   tidyJSON(glb)         drop JSON values equal to the glTF defaults (byteOffset 0,
//                         normalized false, LINEAR interpolation); the GLB's JSON is never
//                         compressed, and with dozens of clips it is most of the file
//
//   restTracks(doc); shortRotations(doc); ...; fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));

const EPS = 1e-4;

function restOf(node, path) {
  if (path === 'translation') return node.getTranslation();
  if (path === 'rotation') return node.getRotation();
  if (path === 'scale') return node.getScale();
  return null;
}

function holdsRest(channel) {
  const node = channel.getTargetNode(), path = channel.getTargetPath(), out = channel.getSampler()?.getOutput();
  const rest = node && restOf(node, path);
  if (!rest || !out) return false;
  const a = out.getArray(), n = out.getElementSize(), s = out.getNormalized() ? 1 / 32767 : 1;
  for (const sign of path === 'rotation' ? [1, -1] : [1]) {   // q and -q are the same rotation
    let same = true;
    for (let i = 0; i < out.getCount() && same; i++)
      for (let k = 0; k < n; k++) if (Math.abs(a[i * n + k] * s - sign * rest[k]) > EPS) { same = false; break; }
    if (same) return true;
  }
  return false;
}

export function restTracks(doc) {
  let dropped = 0;
  for (const anim of doc.getRoot().listAnimations()) {
    const channels = anim.listChannels();
    const end = c => c.getSampler()?.getInput()?.getMax([])[0] ?? 0;
    const length = Math.max(0, ...channels.map(end));
    const drop = channels.filter(holdsRest);
    // keep the clip's length (three.js takes it from its longest track) and at least one track
    const kept = channels.filter(c => !drop.includes(c));
    if (!kept.some(c => end(c) >= length - EPS)) {
      const longest = drop.find(c => end(c) >= length - EPS);
      if (longest) drop.splice(drop.indexOf(longest), 1);
    }
    for (const c of drop) {
      const sampler = c.getSampler();
      c.dispose();
      if (sampler && !anim.listChannels().some(o => o.getSampler() === sampler)) {
        const accs = [sampler.getInput(), sampler.getOutput()];
        sampler.dispose();
        for (const acc of accs) if (acc && acc.listParents().every(p => p.propertyType === 'Root')) acc.dispose();
      }
      dropped++;
    }
  }
  return dropped;
}

export function shortRotations(doc) {
  const done = new Set();
  for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
    const acc = ch.getSampler()?.getOutput();
    if (ch.getTargetPath() !== 'rotation' || !acc || done.has(acc) || acc.getNormalized()) continue;
    done.add(acc);
    const f = acc.getArray(), q = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    acc.setArray(q).setNormalized(true);
  }
}

export function tidyJSON(glb) {
  const b = Buffer.from(glb);
  const jsonLen = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  for (const a of j.accessors || []) {
    if (a.byteOffset === 0) delete a.byteOffset;
    if (a.normalized === false) delete a.normalized;
  }
  for (const v of j.bufferViews || []) {
    if (v.byteOffset === 0) delete v.byteOffset;
    const m = v.extensions?.EXT_meshopt_compression;
    if (m?.byteOffset === 0) delete m.byteOffset;
    if (m?.filter === 'NONE') delete m.filter;
  }
  for (const an of j.animations || []) for (const s of an.samplers) if (s.interpolation === 'LINEAR') delete s.interpolation;
  let json = Buffer.from(JSON.stringify(j), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - json.length % 4, 0x20)]);
  const rest = b.subarray(20 + jsonLen);   // the BIN chunk, untouched
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);       // 'glTF'
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + json.length + rest.length, 8);
  head.writeUInt32LE(json.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);      // 'JSON'
  return Buffer.concat([head, json, rest]);
}
