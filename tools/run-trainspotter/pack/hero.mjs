// Render the hero art: the app icon and the loading-screen picture. The viewer runs a steam
// express at golden hour, with the camera riding low beside its front so the plume streams back,
// in the viewer's full look; the title goes on in the covers' font.
//
//   node pack/hero.mjs [out dir]        (default out/hero; needs a build in out/glb)
//
// Writes hero-<variant>.png (the picture alone) and icon-<variant>.png (with the title), 1024 square.
// HERO=name:time:side:seconds[:eyeY:lookY:back],... picks the variants (side -1 is the engine's left).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { start } from '../viewer/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, '..', 'out', 'hero'));
mkdirSync(out, { recursive: true });
const port = 8990 + Math.floor(Math.random() * 40);
const server = await start(port);
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
const angle = { win32: 'd3d11', darwin: 'metal' }[process.platform] ?? 'swiftshader';
const browser = await chromium.launch({ channel, args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
// variants: [name, time of day, side (-1 left of the engine, 1 right), run seconds]
const VARIANTS = (process.env.HERO ?? 'gold-l:0.47:-1:5.2,gold-r:0.47:1:5.2,morning-l:0.1:-1:5.2,morning-r:0.1:1:5.2')
  .split(',').map((v) => v.split(':')).map(([name, t, side, run, eyeY = 24, lookY = 42, back = 330]) =>
    ({ name, t: Number(t), side: Number(side), run: Number(run), eyeY: Number(eyeY), lookY: Number(lookY), back: Number(back) }));
const errors = [];
for (const V of VARIANTS) {
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/run-trainspotter/viewer/?layout=${encodeURIComponent('Country junction')}&train=${encodeURIComponent('Steam express')}&time=${V.t}`);
await page.waitForFunction(() => window.viewer?.world?.grass && window.viewer.train, null, { timeout: 180000 });

await page.evaluate(({ side, eyeY, lookY, back }) => {
  const v = window.viewer;
  document.getElementById('ui').style.display = 'none';
  v.audio.stop();
  v.fx.intensity = 1.8; // a big plume
  v.pretty.setTilt(1.5);
  v.pretty.setTiltBand(0.16);
  v.train.go(110);
  const loco = v.train.cars[0].group;
  // the camera rides with the engine: low, ahead and to its left, looking back along it
  const V3 = v.camera.position.constructor;
  const eye = new V3(-105 * -side, eyeY, -back), look = new V3(8 * -side, lookY, -10);
  const trees = [];
  v.world.group.traverse((o) => { if (o.name === 'Scene' && /^(tree|bush)-/.test(o.children[0]?.name ?? '')) trees.push(o); });
  v.controls.enabled = false;
  v.controls.update = () => {
    loco.updateMatrixWorld(true);
    v.camera.position.copy(loco.localToWorld(eye.clone()));
    v.camera.lookAt(loco.localToWorld(look.clone()));
    v.camera.fov = 30;
    v.camera.updateProjectionMatrix();
    v.controls.target.copy(loco.localToWorld(look.clone()));
    // nothing between the camera and the engine
    const c = v.camera.position, f = loco.getWorldPosition(new V3());
    for (const t of trees) {
      const p = t.getWorldPosition(new V3()), d = f.clone().sub(c), k = Math.max(0, Math.min(1, p.clone().sub(c).dot(d) / d.lengthSq()));
      t.visible = c.clone().addScaledVector(d, k).distanceTo(p) > 70 || k >= 1;
    }
  };
  v.pretty.focusOn(loco.localToWorld(new V3(0, 40, -60)), loco);
}, V);
// run until the engine is on a straight with a good plume behind it
await page.waitForTimeout(V.run * 1000);
await page.screenshot({ path: path.join(out, `hero-${V.name}.png`) });
await page.evaluate(() => {
  const css = `@font-face { font-family: Bungee; src: url(/run-monster-trucks/pack/fonts/Bungee-Regular.ttf); }
    #hero-title { position: fixed; left: 0; right: 0; bottom: 70px; text-align: center; pointer-events: none; }
    #hero-title .t { font: 128px/1 Bungee, sans-serif; color: #ffd23f; -webkit-text-stroke: 16px #1d2a3a; paint-order: stroke fill;
      text-shadow: 0 10px 0 #1d2a3a, 0 18px 40px #0008; letter-spacing: 0.01em; }
    #hero-title .s { display: inline-block; margin-top: 18px; font: 40px Bungee, sans-serif; letter-spacing: 0.16em; color: #fff;
      background: #1d2a3a; padding: 12px 28px 8px; border-radius: 14px; }
    #hero-vignette { position: fixed; inset: 0; pointer-events: none; background: linear-gradient(transparent 52%, #1d2a3a66 100%); }`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  document.body.insertAdjacentHTML('beforeend', '<div id="hero-vignette"></div><div id="hero-title"><div class="t">TRAIN<br>SPOTTER</div></div>');
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, `icon-${V.name}.png`) });
await page.close();
}
console.log('wrote', out, 'ERRORS', errors.length ? errors.slice(0, 3) : '[]');
await browser.close();
server.close();
