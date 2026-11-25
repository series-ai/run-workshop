// Trainspotter on RUN: the kit's viewer, loading models and sounds from the published pack,
// plus the trailer to watch.
import '../../../tools/run-trainspotter/viewer/viewer.css';
import './app.css';
import { startViewer } from '../../../tools/run-trainspotter/viewer/viewer.js';
import catalogue from './kit.json';
import { PINS, KIT_LEAF, AUDIO_LEAF } from './pins.js';

let sdk = null;
function rundot() {
  sdk ??= import('@series-inc/rundot-game-sdk/api').then(async ({ default: api }) => {
    await api.initializeAsync();
    return api;
  });
  return sdk;
}

/** A pack leaf's base URL (ending in /): pinned through RUN's asset library, or served locally. */
async function packBase(leaf) {
  if (__TS_ASSET_MODE__ !== 'pinned') return `jam/${leaf}/`;
  const api = await rundot();
  const url = await api.assetLibrary.getPackBaseUrl(leaf, PINS[leaf]);
  if (!url) throw new Error(`no asset library URL for ${leaf}`);
  return url.replace(/\/*$/, '/');
}

const loader = document.getElementById('loading');
try {
  const [kitBase, soundsBase] = await Promise.all([packBase(KIT_LEAF), packBase(AUDIO_LEAF)]);
  const viewer = await startViewer({ kitBase, catalogue, soundsBase });
  // the trailer ships only with builds that have it (it carries its song, so it is not in git)
  fetch('./trailer.mp4', { method: 'HEAD' })
    .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('video/') && trailer(viewer)) // not a server's fallback page
    .catch(() => {});
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 600);
} catch (err) {
  console.error(err);
  loader.querySelector('p').textContent = 'The railway could not be loaded. Check your connection and try again.';
}

/** A "Watch the trailer" button and a full-screen player; the railway's sound pauses meanwhile. */
function trailer(viewer) {
  const button = document.createElement('button');
  button.id = 'trailer-button';
  button.className = 'ui-hideable'; // the viewer's eye hides it with the rest of the controls
  button.innerHTML = '<span>▶</span> Watch the trailer';
  const sheet = document.createElement('div');
  sheet.id = 'trailer';
  sheet.innerHTML = '<video src="./trailer.mp4" poster="./trailer-poster.jpg" playsinline controls preload="none"></video><button aria-label="Close">✕</button>';
  document.body.append(button, sheet);
  const video = sheet.querySelector('video');
  let wasOn = false;
  const close = () => {
    video.pause();
    sheet.classList.remove('open');
    if (wasOn) viewer.audio.start();
  };
  button.onclick = () => {
    wasOn = viewer.audio.enabled;
    if (wasOn) viewer.audio.stop();
    sheet.classList.add('open');
    video.currentTime = 0;
    video.play();
  };
  sheet.querySelector('button').onclick = close;
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  video.onended = close;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) close(); });
}
