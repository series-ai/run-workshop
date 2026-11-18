import './styles.css';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { DemoHost, type DemoMetrics, type PaintingScene, type SceneFactory } from './host';
import { createStarryNight } from './scenes/starryNight';
import { createGreatWave } from './scenes/greatWave';
import { createIsleOfTheDead } from './scenes/isleOfTheDead';
import { createWaterLilies } from './scenes/waterLilies';
import { createGrandeJatte } from './scenes/grandeJatte';
import { createSaintTropez } from './scenes/saintTropez';
import { createImpressionSunrise } from './scenes/impressionSunrise';
import { createWheatfieldWithCrows } from './scenes/wheatfieldWithCrows';
import { createCafeTerrace } from './scenes/cafeTerrace';
import { createSuddenShower } from './scenes/suddenShower';
import { createRedFuji } from './scenes/redFuji';
import { createDaylightNocturne } from './scenes/daylightNocturne';
import { createSoftTimeDesert } from './scenes/softTimeDesert';
import { createImpossibleAqueduct } from './scenes/impossibleAqueduct';
import { createThreeGravityRotunda } from './scenes/threeGravityRotunda';
import { createWandererFog } from './scenes/wandererFog';
import { createSeaOfIce } from './scenes/seaOfIce';
import { createTheScream } from './scenes/theScream';
import { createTreeOfLife } from './scenes/treeOfLife';
import { createBirchForest } from './scenes/birchForest';
import { createKineticGrid } from './scenes/kineticGrid';

interface SceneEntry {
  id: string;
  label: string;
  sub: string;
  factory: SceneFactory;
}

const SCENES: SceneEntry[] = [
  { id: 'starry', label: 'The Starry Night', sub: 'Van Gogh · 1889', factory: createStarryNight },
  { id: 'wave', label: 'The Great Wave', sub: 'Hokusai · c. 1831', factory: createGreatWave },
  { id: 'isle', label: 'Isle of the Dead', sub: 'Böcklin · 1883', factory: createIsleOfTheDead },
  { id: 'lilies', label: 'Water Lilies', sub: 'Monet · 1899', factory: createWaterLilies },
  { id: 'grande-jatte', label: 'La Grande Jatte', sub: 'Seurat · 1884', factory: createGrandeJatte },
  { id: 'saint-tropez', label: 'Saint-Tropez', sub: 'Signac · 1901', factory: createSaintTropez },
  { id: 'impression-sunrise', label: 'Impression, Sunrise', sub: 'Monet · 1872', factory: createImpressionSunrise },
  { id: 'wheatfield', label: 'Wheatfield with Crows', sub: 'Van Gogh · 1890', factory: createWheatfieldWithCrows },
  { id: 'cafe-terrace', label: 'Café Terrace at Night', sub: 'Van Gogh · 1888', factory: createCafeTerrace },
  { id: 'sudden-shower', label: 'Sudden Shower', sub: 'Hiroshige · 1857', factory: createSuddenShower },
  { id: 'red-fuji', label: 'Red Fuji', sub: 'Hokusai · c. 1830', factory: createRedFuji },
  { id: 'daylight-nocturne', label: 'Harbor of Two Hours', sub: 'Surrealist Study', factory: createDaylightNocturne },
  { id: 'soft-time-desert', label: 'Meridian of Salt & Brass', sub: 'Surrealist Study', factory: createSoftTimeDesert },
  { id: 'impossible-aqueduct', label: 'Perpetual Aqueduct', sub: 'Paradox Lithograph', factory: createImpossibleAqueduct },
  { id: 'three-gravity-rotunda', label: 'Three-Gravity Rotunda', sub: 'Paradox Lithograph', factory: createThreeGravityRotunda },
  { id: 'wanderer', label: 'Wanderer above Fog', sub: 'Friedrich · 1818', factory: createWandererFog },
  { id: 'sea-of-ice', label: 'The Sea of Ice', sub: 'Friedrich · 1824', factory: createSeaOfIce },
  { id: 'scream', label: 'The Scream', sub: 'Munch · 1893', factory: createTheScream },
  { id: 'tree-of-life', label: 'The Tree of Life', sub: 'Klimt · 1905–09', factory: createTreeOfLife },
  { id: 'birch-forest', label: 'Birch Forest', sub: 'Klimt · 1903', factory: createBirchForest },
  { id: 'kinetic-grid', label: 'Syncopated Grid No. 1', sub: 'Kinetic Relief Study', factory: createKineticGrid },
];

const MAX_CACHED_SCENES = 2;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

function formatTris(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function applySafeArea(
  appEl: HTMLElement,
  area?: { top?: number; right?: number; bottom?: number; left?: number } | null,
): void {
  appEl.style.setProperty('--safe-top', `${Math.max(0, area?.top ?? 0)}px`);
  appEl.style.setProperty('--safe-right', `${Math.max(0, area?.right ?? 0)}px`);
  appEl.style.setProperty('--safe-bottom', `${Math.max(0, area?.bottom ?? 0)}px`);
  appEl.style.setProperty('--safe-left', `${Math.max(0, area?.left ?? 0)}px`);
}

function init(): void {
  const app = el('app');
  try {
    applySafeArea(app, RundotGameAPI.system.getSafeArea());
  } catch {
    applySafeArea(app, null);
  }
  try {
    RundotGameAPI.lifecycles.onSafeAreaChanged((area) => applySafeArea(app, area));
  } catch {
    // Standalone mode without host safe-area updates.
  }

  const host = new DemoHost(el('stage'));
  try {
    RundotGameAPI.lifecycles.onPause(() => host.setPaused(true));
    RundotGameAPI.lifecycles.onResume(() => host.setPaused(false));
  } catch {
    // Standalone mode without host lifecycle events.
  }

  const built = new Map<string, PaintingScene>();
  const tabsShell = document.getElementById('tabs-shell');
  const tabs = el('scene-tabs');
  const picker = document.getElementById('scene-select') as HTMLSelectElement | null;
  const prevBtn = document.getElementById('btn-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('btn-next') as HTMLButtonElement | null;
  const presets = el('preset-pills');
  const driftBtn = el<HTMLButtonElement>('btn-drift');
  const veil = el('veil');
  let currentId = '';

  host.onMetrics = (m: DemoMetrics) => {
    el('stat-fps').textContent = m.fps.toFixed(0);
    el('stat-ms').textContent = m.frameMs.toFixed(1);
    el('stat-calls').textContent = String(m.calls);
    el('stat-tris').textContent = formatTris(m.triangles);
  };
  host.onDriftChange = (on) => {
    driftBtn.classList.toggle('active', on);
    driftBtn.textContent = on ? 'Auto-Drift · On' : 'Auto-Drift · Off';
  };
  driftBtn.addEventListener('click', () => host.setDrift(!host.driftOn));

  function markPreset(index: number): void {
    presets.querySelectorAll('.pill').forEach((b, i) => b.classList.toggle('active', i === index));
  }

  function evictOldestIfNeeded(keepId: string): void {
    while (built.size > MAX_CACHED_SCENES) {
      const oldestKey = built.keys().next().value;
      if (!oldestKey || oldestKey === keepId) break;
      const old = built.get(oldestKey);
      built.delete(oldestKey);
      old?.dispose();
    }
  }

  function show(entry: SceneEntry): void {
    let scene = built.get(entry.id);
    if (scene) {
      built.delete(entry.id);
      built.set(entry.id, scene);
    } else {
      scene = entry.factory();
      built.set(entry.id, scene);
    }
    currentId = entry.id;
    host.load(entry.id, scene);
    evictOldestIfNeeded(entry.id);
    host.setDrift(entry.id !== 'impossible-aqueduct');
    el('art-title').textContent = scene.meta.title;
    el('art-artist').textContent = scene.meta.artist;
    el('art-tech').textContent = scene.meta.technique;
    let activeTab: HTMLButtonElement | null = null;
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const match = b.dataset.scene === entry.id;
      b.classList.toggle('active', match);
      if (match) activeTab = b;
    });
    if (activeTab && typeof (activeTab as HTMLButtonElement).scrollIntoView === 'function') {
      (activeTab as HTMLButtonElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    if (picker) picker.value = entry.id;
    presets.replaceChildren();
    const active = scene;
    active.presets.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill';
      b.textContent = p.name;
      b.addEventListener('click', () => {
        host.goToPreset(p);
        markPreset(i);
      });
      presets.appendChild(b);
    });
    markPreset(0);
  }

  function entryFor(id: string): SceneEntry {
    const entry = SCENES.find((s) => s.id === id);
    if (!entry) throw new Error(`Unknown scene "${id}". Expected one of: ${SCENES.map((s) => s.id).join(', ')}`);
    return entry;
  }

  /** Shows the veil, lets it paint, then builds and shows the scene. */
  function selectScene(id: string): Promise<void> {
    const entry = entryFor(id);
    if (built.has(id)) {
      show(entry);
      return Promise.resolve();
    }
    veil.classList.add('on');
    el('veil-text').textContent = `Preparing ${entry.label}…`;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          show(entry);
          resolve();
        } catch (err) {
          reject(err);
          throw err;
        } finally {
          veil.classList.remove('on');
        }
      }, 30);
    });
  }

  function stepScene(delta: number): void {
    const idx = Math.max(0, SCENES.findIndex((s) => s.id === currentId));
    const next = SCENES[(idx + delta + SCENES.length) % SCENES.length];
    void selectScene(next.id);
  }

  const params = new URLSearchParams(window.location.search);
  const queryScene = params.get('scene')?.trim();
  const singleMode = Boolean(window.__SINGLE_SCENE_MODE__) || params.get('single') === '1';

  if (singleMode) {
    if (tabsShell) tabsShell.style.display = 'none';
    else tabs.style.display = 'none';
  } else {
    SCENES.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.scene = s.id;
      b.className = 'tab';
      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = s.label;
      const sub = document.createElement('span');
      sub.className = 'tab-sub';
      sub.textContent = s.sub;
      b.append(name, sub);
      b.addEventListener('click', () => void selectScene(s.id));
      tabs.appendChild(b);

      if (picker) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${i + 1}/21 · ${s.label} (${s.sub})`;
        picker.appendChild(opt);
      }
    });
    picker?.addEventListener('change', () => void selectScene(picker.value));
    prevBtn?.addEventListener('click', () => stepScene(-1));
    nextBtn?.addEventListener('click', () => stepScene(1));
  }

  const initialScene =
    (queryScene && SCENES.some((s) => s.id === queryScene) ? queryScene : null) ??
    window.__INITIAL_SCENE__ ??
    'starry';
  const ready = selectScene(initialScene);

  window.__DEMO_API__ = {
    ready,
    scenes: SCENES.map((s) => s.id),
    selectScene,
    currentScene: () => currentId,
    presets: () => built.get(currentId)?.presets.map((p) => p.name) ?? [],
    setPreset(index: number): void {
      const scene = built.get(currentId);
      if (!scene) throw new Error('No scene is loaded');
      const p = scene.presets[index];
      if (!p) throw new Error(`Preset ${index} does not exist; scene has ${scene.presets.length}`);
      host.snapToPreset(p);
      markPreset(index);
    },
    setDrift: (on: boolean) => host.setDrift(on),
    setPaused: (paused: boolean) => host.setPaused(paused),
    renderFrameNow: (t: number) => host.renderFrameNow(t),
    benchmark: (frames = 120) => host.benchmark(frames),
    getMetrics: () => window.__DEMO_METRICS__,
    glError: () => host.glError(),
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
