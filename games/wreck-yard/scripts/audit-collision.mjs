// Audit: every solid-looking mesh inside the arena must be backed by collision.
// Samples each mesh vertex pushed 5 cm inward along its normal, tests it against
// the shell colliders and the live physics bodies, and clusters what is left.
// Usage: node scripts/audit-collision.mjs [--json out.json]
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4400 --strictPort
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let report;
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  await page.keyboard.press('KeyO'); // orbit: hides the first-person tool
  await page.waitForTimeout(500);
  report = await page.evaluate(async () => {
    const { FLOOR_Y, ARENA_EXTENT, VOXEL_SIZE } = await import('/src/sim/constants.ts');
    const { SHELL_BOXES } = await import('/src/sim/shell.ts');
    const { scene } = window.__DEBUG_THREE__;
    const THREE_Vector3 = scene.position.constructor;
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();

    // Colliders as oriented boxes: center, half size, inverse rotation (quaternion).
    const quatFromEuler = ([x, y, z]) => {
      const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
      const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
      // XYZ order, as three.js Euler default.
      return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
    };
    const rotate = (v, q) => {
      const [x, y, z] = v; const [qx, qy, qz, qw] = q;
      const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
      return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
    };
    const colliders = SHELL_BOXES.map((box) => ({
      id: `shell:${box.id}`,
      center: box.center,
      half: box.size.map((s) => s / 2),
      inverse: (() => { const q = quatFromEuler(box.rotation ?? [0, 0, 0]); return [-q[0], -q[1], -q[2], q[3]]; })(),
    }));
    for (const body of render.bodies) {
      const pose = render.poses.get(body.id);
      if (!pose) continue;
      const [qx, qy, qz, qw] = pose.rotation;
      colliders.push({
        id: body.id,
        center: pose.position,
        half: [body.dims.x * VOXEL_SIZE / 2, body.dims.y * VOXEL_SIZE / 2, body.dims.z * VOXEL_SIZE / 2],
        inverse: [-qx, -qy, -qz, qw],
      });
    }
    const TOLERANCE = 0.1;
    const covered = (p) => colliders.some((c) => {
      const local = rotate([p[0] - c.center[0], p[1] - c.center[1], p[2] - c.center[2]], c.inverse);
      return Math.abs(local[0]) <= c.half[0] + TOLERANCE && Math.abs(local[1]) <= c.half[1] + TOLERANCE && Math.abs(local[2]) <= c.half[2] + TOLERANCE;
    });

    const chassis = render.poses.get('vehicle-chassis')?.position;
    const players = render.players.map((p) => p.position);
    const near = (p, q, r) => q && Math.hypot(p[0] - q[0], p[2] - q[2]) < r && Math.abs(p[1] - q[1]) < 3;
    const inner = ARENA_EXTENT - 0.3;
    const visibleChain = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };

    const uncovered = [];
    let sampled = 0;
    const v = new THREE_Vector3();
    const n = new THREE_Vector3();
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh || !visibleChain(object)) return; // instanced meshes are particles
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!material || material.type === 'RawShaderMaterial') return; // voxel bodies are physics bodies
      if (material.transparent || material.blending === 2) return; // glass, water, glow cards
      if (object.renderOrder <= -400) return; // sky dome and skyline backdrop
      const position = object.geometry.getAttribute('position');
      const normal = object.geometry.getAttribute('normal');
      if (!position || !normal) return;
      const normalMatrix = object.normalMatrix.getNormalMatrix(object.matrixWorld);
      const color = material.color ? `#${material.color.getHexString()}` : 'n/a';
      const step = Math.max(1, Math.floor(position.count / 4000));
      for (let i = 0; i < position.count; i += step) {
        v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
        const p = [v.x - n.x * 0.05, v.y - n.y * 0.05, v.z - n.z * 0.05];
        if (Math.abs(p[0]) > inner || Math.abs(p[2]) > inner) continue;
        if (p[1] < FLOOR_Y + 0.35 || p[1] > FLOOR_Y + 30) continue;
        if (near(p, chassis, 2.6) || players.some((q) => near(p, q, 0.9))) continue;
        sampled += 1;
        if (!covered(p)) uncovered.push({ p, color, geometry: object.geometry.type });
      }
    });

    // Cluster uncovered points on a 1 m grid (6-connected).
    const cells = new Map();
    for (const point of uncovered) {
      const key = point.p.map((c) => Math.floor(c)).join(',');
      (cells.get(key) ?? cells.set(key, []).get(key)).push(point);
    }
    const seen = new Set();
    const clusters = [];
    for (const key of cells.keys()) {
      if (seen.has(key)) continue;
      const queue = [key];
      seen.add(key);
      const points = [];
      while (queue.length) {
        const current = queue.pop();
        points.push(...cells.get(current));
        const [x, y, z] = current.split(',').map(Number);
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const next = `${x + dx},${y + dy},${z + dz}`;
          if (cells.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
        }
      }
      const min = [0, 1, 2].map((a) => Math.min(...points.map((q) => q.p[a])));
      const max = [0, 1, 2].map((a) => Math.max(...points.map((q) => q.p[a])));
      const colors = [...new Set(points.map((q) => q.color))].slice(0, 4);
      const geometries = [...new Set(points.map((q) => q.geometry))].slice(0, 4);
      clusters.push({ points: points.length, min: min.map((c) => +c.toFixed(2)), max: max.map((c) => +c.toFixed(2)), colors, geometries });
    }
    clusters.sort((a, b) => b.points - a.points);
    return { sampled, uncovered: uncovered.length, clusters };
  });
} finally {
  await browser.close();
}
if (jsonOut) await fs.writeFile(jsonOut, JSON.stringify(report, null, 2));
console.log(`sampled ${report.sampled} points, uncovered ${report.uncovered}, clusters ${report.clusters.length}`);
for (const c of report.clusters.filter((cluster) => cluster.points >= 3)) {
  console.log(`${String(c.points).padStart(5)}  x ${c.min[0]}..${c.max[0]}  y ${c.min[1]}..${c.max[1]}  z ${c.min[2]}..${c.max[2]}  ${c.geometries.join('/')}  ${c.colors.join(' ')}`);
}
process.exitCode = report.clusters.some((cluster) => cluster.points >= 3) ? 1 : 0;
