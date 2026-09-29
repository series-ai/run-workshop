import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as fs, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

// CDN assets in cdn/ folder are automatically served in dev mode by the
// libraries plugin. Image-gen, appStorage, etc. only work in the deployed
// run.game webview (where the SDK uses RpcImageGenApi to talk to the host).
// Local dev intentionally has no sandbox plugin — same setup Depths uses.

// Dev-only: trigger a full browser reload when a Sprite Fusion map file changes
// under public/world/maps/. Files in public/ are served as-is and don't get
// HMR by default, so without this the runtime-cached map would stay stale
// until a manual refresh.
function watchMapFiles() {
  return {
    name: 'watch-map-files',
    apply: 'serve' as const,
    configureServer(server: { watcher: { add: (p: string) => void; on: (ev: string, cb: (file: string) => void) => void }; ws: { send: (m: unknown) => void } }) {
      server.watcher.add('public/world/maps/**');
      server.watcher.on('change', (file) => {
        const normalized = file.replace(/\\/g, '/');
        if (normalized.includes('/world/maps/')) {
          console.log(`[watch-map-files] ${normalized} changed — reloading`);
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

// Dev-only: for every public/world/maps/<id>.json (Sprite Fusion export)
// that has no matching src/world/data/maps/<id>.json (game config), create
// a stub with the map's center as the default spawn and empty placements.
// Runs at server start and whenever a new map JSON is added so you can just
// drop files into public/ and they show up in the editor.
function autoStubMaps() {
  const PUBLIC_DIR = 'public/world/maps';
  const SRC_DIR = 'src/world/data/maps';

  async function readSpriteFusionMap(absPath: string): Promise<{ mapWidth: number; mapHeight: number } | null> {
    try {
      const raw = await fs.readFile(absPath, 'utf8');
      const j = JSON.parse(raw);
      if (typeof j?.mapWidth === 'number' && typeof j?.mapHeight === 'number') {
        return { mapWidth: j.mapWidth, mapHeight: j.mapHeight };
      }
    } catch {
      /* not a SF map — ignore */
    }
    return null;
  }

  async function stubIfMissing(mapId: string, publicAbs: string): Promise<boolean> {
    const stubAbs = path.resolve(process.cwd(), SRC_DIR, `${mapId}.json`);
    try {
      await fs.access(stubAbs);
      return false; // already exists
    } catch {
      /* doesn't exist yet */
    }
    const sf = await readSpriteFusionMap(publicAbs);
    // Bail if this isn't actually a Sprite Fusion map JSON — sidecars like
    // <tilesheet>_water.json share the same directory but are not maps and
    // should never get a game-config stub.
    if (!sf) return false;
    const cx = Math.floor(sf.mapWidth / 2);
    const cy = Math.floor(sf.mapHeight / 2);
    const content = `{
  "id": ${JSON.stringify(mapId)},
  "spawns": {
    "default": { "tileX": ${cx}, "tileY": ${cy} }
  },
  "placements": []
}
`;
    await fs.mkdir(path.dirname(stubAbs), { recursive: true });
    await fs.writeFile(stubAbs, content, 'utf8');
    console.log(`[auto-stub-maps] created ${path.relative(process.cwd(), stubAbs)} (spawn @ ${cx},${cy})`);
    return true;
  }

  async function scanAll() {
    const publicAbs = path.resolve(process.cwd(), PUBLIC_DIR);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(publicAbs);
    } catch {
      return;
    }
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      const mapId = name.slice(0, -5);
      if (!/^[a-zA-Z0-9_-]+$/.test(mapId)) continue;
      await stubIfMissing(mapId, path.join(publicAbs, name));
    }
  }

  return {
    name: 'auto-stub-maps',
    apply: 'serve' as const,
    async configureServer(server: { watcher: { on: (ev: string, cb: (file: string) => void) => void } }) {
      await scanAll();
      server.watcher.on('add', async (file) => {
        const normalized = file.replace(/\\/g, '/');
        const m = /\/public\/world\/maps\/([a-zA-Z0-9_-]+)\.json$/.exec(normalized);
        if (!m) return;
        await stubIfMissing(m[1]!, file);
      });
    },
  };
}

// Dev-only endpoint for the map editor at /editor.html. POST JSON to
// /api/editor/save-map with { mapId, data } and it writes the formatted
// JSON back to src/world/data/maps/<mapId>.json. Simple custom formatter
// keeps each placement/spawn on one line so git diffs stay readable.
function editorSaveApi() {
  const formatMap = (data: {
    id: string;
    spawns: Record<string, { tileX: number; tileY: number }>;
    placements: Array<{ npcId: string; tileX: number; tileY: number }>;
    animals?: Array<{ type: string; sheet?: string; tileX: number; tileY: number; wanderTiles: number }>;
    objects?: Array<{ image: string; tileX: number; tileY: number; offsetX?: number; offsetY?: number; drawOrder?: string; blocksPassage?: boolean; colliderBox?: { x: number; y: number; w: number; h: number }; randomizeFrameStart?: boolean }>;
    battleBgFrame?: string;
    grassPatchBackgrounds?: Record<string, string>;
    grassPatchLevels?: Record<string, { min: number; max: number }>;
    levelOriginTile?: { tileX: number; tileY: number };
  }) => {
    const spawnLines = Object.entries(data.spawns).map(
      ([k, v]) => `    ${JSON.stringify(k)}: { "tileX": ${v.tileX}, "tileY": ${v.tileY} }`,
    );
    const placementLines = data.placements.map(
      (p) =>
        `    { "npcId": ${JSON.stringify(p.npcId)}, "tileX": ${p.tileX}, "tileY": ${p.tileY} }`,
    );
    const animalLines = (data.animals ?? []).map((a) => {
      const parts = [`"type": ${JSON.stringify(a.type)}`];
      // Omit sheet when it's the default so the JSON stays minimal for the
      // common case (most species ship a single SpriteSheet.json).
      if (a.sheet && a.sheet.length > 0 && a.sheet !== 'SpriteSheet') {
        parts.push(`"sheet": ${JSON.stringify(a.sheet)}`);
      }
      parts.push(`"tileX": ${a.tileX}`, `"tileY": ${a.tileY}`, `"wanderTiles": ${a.wanderTiles}`);
      return `    { ${parts.join(', ')} }`;
    });
    // Only emit the animals key on maps that actually have animals — keeps
    // the diff on existing maps trivial.
    const animalsBlock = data.animals && data.animals.length > 0
      ? `,\n  "animals": [\n${animalLines.join(',\n')}\n  ]`
      : '';
    const objectLines = (data.objects ?? []).map((o) => {
      const parts = [
        `"image": ${JSON.stringify(o.image)}`,
        `"tileX": ${o.tileX}`,
        `"tileY": ${o.tileY}`,
      ];
      // Omit offsets/drawOrder/blocksPassage when they're at their defaults
      // — keeps the JSON minimal for the common decorative case.
      if (o.offsetX) parts.push(`"offsetX": ${o.offsetX}`);
      if (o.offsetY) parts.push(`"offsetY": ${o.offsetY}`);
      if (o.drawOrder && o.drawOrder !== 'under') parts.push(`"drawOrder": ${JSON.stringify(o.drawOrder)}`);
      if (o.blocksPassage) parts.push(`"blocksPassage": true`);
      if (o.colliderBox) {
        const c = o.colliderBox;
        parts.push(`"colliderBox": { "x": ${c.x}, "y": ${c.y}, "w": ${c.w}, "h": ${c.h} }`);
      }
      // Default is true (randomize). Persist only the off case.
      if (o.randomizeFrameStart === false) parts.push(`"randomizeFrameStart": false`);
      return `    { ${parts.join(', ')} }`;
    });
    const objectsBlock = data.objects && data.objects.length > 0
      ? `,\n  "objects": [\n${objectLines.join(',\n')}\n  ]`
      : '';
    const battleBgBlock = data.battleBgFrame
      ? `,\n  "battleBgFrame": ${JSON.stringify(data.battleBgFrame)}`
      : '';
    const patchBgEntries = Object.entries(data.grassPatchBackgrounds ?? {});
    const patchBgBlock = patchBgEntries.length > 0
      ? `,\n  "grassPatchBackgrounds": {\n${patchBgEntries
          .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
          .join(',\n')}\n  }`
      : '';
    const patchLvlEntries = Object.entries(data.grassPatchLevels ?? {});
    const patchLvlBlock = patchLvlEntries.length > 0
      ? `,\n  "grassPatchLevels": {\n${patchLvlEntries
          .map(([k, v]) => `    ${JSON.stringify(k)}: { "min": ${v.min}, "max": ${v.max} }`)
          .join(',\n')}\n  }`
      : '';
    const levelOriginBlock = data.levelOriginTile
      ? `,\n  "levelOriginTile": { "tileX": ${data.levelOriginTile.tileX}, "tileY": ${data.levelOriginTile.tileY} }`
      : '';
    return `{
  "id": ${JSON.stringify(data.id)},
  "spawns": {
${spawnLines.join(',\n')}
  }${levelOriginBlock},
  "placements": [
${placementLines.join(',\n')}
  ]${animalsBlock}${objectsBlock}${battleBgBlock}${patchBgBlock}${patchLvlBlock}
}
`;
  };

  const formatPortals = (data: {
    portals: Array<{
      id: string;
      a: { mapId: string; rect: { tileX: number; tileY: number; w: number; h: number }; spawn: { tileX: number; tileY: number }; facing?: string };
      b: { mapId: string; rect: { tileX: number; tileY: number; w: number; h: number }; spawn: { tileX: number; tileY: number }; facing?: string };
      gate?: {
        fromMapId: string;
        requiredTrainerDefeats: string[];
        eventId?: string;
        adminOnly?: boolean;
        blockedMessage?: string;
        doorImage?: string;
      };
    }>;
  }) => {
    const halfStr = (h: { mapId: string; rect: { tileX: number; tileY: number; w: number; h: number }; spawn: { tileX: number; tileY: number }; facing?: string }) => {
      const facing = h.facing ?? 'down';
      return `{ "mapId": ${JSON.stringify(h.mapId)}, "rect": { "tileX": ${h.rect.tileX}, "tileY": ${h.rect.tileY}, "w": ${h.rect.w}, "h": ${h.rect.h} }, "spawn": { "tileX": ${h.spawn.tileX}, "tileY": ${h.spawn.tileY} }, "facing": ${JSON.stringify(facing)} }`;
    };
    const gateStr = (g: NonNullable<NonNullable<typeof data.portals[number]['gate']>>) => {
      const lines: string[] = [];
      lines.push(`        "fromMapId": ${JSON.stringify(g.fromMapId)}`);
      lines.push(`        "requiredTrainerDefeats": ${JSON.stringify(g.requiredTrainerDefeats)}`);
      // eventId/adminOnly aren't surfaced in the gate editor but are
      // load-bearing at runtime — persist them so a save round-trips them
      // instead of silently dropping them.
      if (g.eventId !== undefined) lines.push(`        "eventId": ${JSON.stringify(g.eventId)}`);
      if (g.adminOnly !== undefined) lines.push(`        "adminOnly": ${JSON.stringify(g.adminOnly)}`);
      if (g.blockedMessage !== undefined) lines.push(`        "blockedMessage": ${JSON.stringify(g.blockedMessage)}`);
      if (g.doorImage !== undefined) lines.push(`        "doorImage": ${JSON.stringify(g.doorImage)}`);
      return `{\n${lines.join(',\n')}\n      }`;
    };
    const portalLines = data.portals.map((p) => {
      const head = `    {
      "id": ${JSON.stringify(p.id)},
      "a": ${halfStr(p.a)},
      "b": ${halfStr(p.b)}`;
      if (p.gate) {
        return `${head},
      "gate": ${gateStr(p.gate)}
    }`;
      }
      return `${head}
    }`;
    });
    return `{
  "portals": [
${portalLines.join(',\n')}
  ]
}
`;
  };

  return {
    name: 'editor-save-api',
    apply: 'serve' as const,
    configureServer(server: { middlewares: { use: (route: string, handler: (req: any, res: any, next: any) => void) => void } }) {
      server.middlewares.use('/api/editor/save-map', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { mapId, data } = JSON.parse(body);
            if (typeof mapId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(mapId)) {
              res.statusCode = 400;
              res.end('invalid mapId');
              return;
            }
            if (!data || typeof data !== 'object') {
              res.statusCode = 400;
              res.end('invalid data');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/maps', `${mapId}.json`);
            const rel = path.relative(process.cwd(), file);
            if (rel.startsWith('..')) {
              res.statusCode = 400;
              res.end('path traversal');
              return;
            }
            await fs.writeFile(file, formatMap(data), 'utf8');
            console.log(`[editor-save] wrote ${rel}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Read the on-disk JSON for a single map. Editor's "Reload from disk"
      // uses this to bypass the in-memory MAP_CATALOG (which is built once
      // at module-load via import.meta.glob and silently drifts from disk
      // as the editor saves throughout a session, or as external tools edit
      // the JSON directly). Returns the parsed JSON on 200, or 404 if the
      // file doesn't exist.
      server.middlewares.use('/api/editor/load-map', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url ?? '', 'http://localhost');
          const mapId = url.searchParams.get('mapId') ?? '';
          if (!mapId || !/^[a-zA-Z0-9_-]+$/.test(mapId)) {
            res.statusCode = 400;
            res.end('invalid mapId');
            return;
          }
          const file = path.resolve(process.cwd(), 'src/world/data/maps', `${mapId}.json`);
          const rel = path.relative(process.cwd(), file);
          if (rel.startsWith('..')) {
            res.statusCode = 400;
            res.end('path traversal');
            return;
          }
          const raw = await fs.readFile(file, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
        } catch (err: any) {
          if (err?.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('map not found');
          } else {
            res.statusCode = 500;
            res.end(String(err));
          }
        }
      });

      server.middlewares.use('/api/editor/save-portals', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { data } = JSON.parse(body);
            if (!data || typeof data !== 'object' || !Array.isArray(data.portals)) {
              res.statusCode = 400;
              res.end('invalid data');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/portals.json');
            await fs.writeFile(file, formatPortals(data), 'utf8');
            const rel = path.relative(process.cwd(), file);
            console.log(`[editor-save] wrote ${rel} (${data.portals.length} portal${data.portals.length === 1 ? '' : 's'})`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Sign editor endpoints — mirror the portals API. One JSON file
      // (src/world/data/worldSigns.json) is the source of truth. Each
      // entry: { id, mapId, tileX, tileY, sprite, kind, label?, imagePath?, text? }.
      const formatSigns = (data: {
        signs: Array<{
          id: string;
          mapId: string;
          tileX: number;
          tileY: number;
          sprite: string;
          kind: string;
          label?: string;
          imagePath?: string;
          text?: string[];
        }>;
      }) => {
        const lines = data.signs.map((s) => {
          const parts = [
            `"id": ${JSON.stringify(s.id)}`,
            `"mapId": ${JSON.stringify(s.mapId)}`,
            `"tileX": ${s.tileX}`,
            `"tileY": ${s.tileY}`,
            `"sprite": ${JSON.stringify(s.sprite)}`,
            `"kind": ${JSON.stringify(s.kind)}`,
          ];
          if (s.label !== undefined && s.label.length > 0) {
            parts.push(`"label": ${JSON.stringify(s.label)}`);
          }
          if (s.imagePath !== undefined && s.imagePath.length > 0) {
            parts.push(`"imagePath": ${JSON.stringify(s.imagePath)}`);
          }
          if (Array.isArray(s.text) && s.text.length > 0) {
            // Text often runs long — break onto its own multi-line array so
            // diffs stay readable when designers tweak individual pages.
            const pages = s.text.map((p) => `      ${JSON.stringify(p)}`).join(',\n');
            return `    {
      "id": ${JSON.stringify(s.id)},
      "mapId": ${JSON.stringify(s.mapId)},
      "tileX": ${s.tileX},
      "tileY": ${s.tileY},
      "sprite": ${JSON.stringify(s.sprite)},
      "kind": ${JSON.stringify(s.kind)}${s.label ? `,
      "label": ${JSON.stringify(s.label)}` : ''}${s.imagePath ? `,
      "imagePath": ${JSON.stringify(s.imagePath)}` : ''},
      "text": [
${pages}
      ]
    }`;
          }
          return `    { ${parts.join(', ')} }`;
        });
        return `{
  "signs": [
${lines.join(',\n')}
  ]
}
`;
      };

      server.middlewares.use('/api/editor/save-signs', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { data } = JSON.parse(body);
            if (!data || typeof data !== 'object' || !Array.isArray(data.signs)) {
              res.statusCode = 400;
              res.end('invalid data');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/worldSigns.json');
            await fs.writeFile(file, formatSigns(data), 'utf8');
            const rel = path.relative(process.cwd(), file);
            console.log(`[editor-save] wrote ${rel} (${data.signs.length} sign${data.signs.length === 1 ? '' : 's'})`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      server.middlewares.use('/api/editor/list-signs', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const file = path.resolve(process.cwd(), 'src/world/data/worldSigns.json');
          const raw = await fs.readFile(file, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // v1.243 — Read-only endpoint that returns the current
      // portals.json from disk. The editor calls this BEFORE every
      // portal save and aborts if disk has more portals than the
      // editor's React state — prevents the "stale editor save wipes
      // teammate's new portals" disaster pattern.
      server.middlewares.use('/api/editor/list-portals', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const file = path.resolve(process.cwd(), 'src/world/data/portals.json');
          const raw = await fs.readFile(file, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // List the maps that actually exist on disk under public/world/maps/.
      // The editor uses this to populate its map dropdown and pick a default
      // instead of trusting the build-time MAP_CATALOG (assembled from
      // src/world/data/maps/*.json via import.meta.glob), which can drift
      // from what's really present — e.g. a fresh clone that doesn't ship
      // every map's tile JSON + PNG. Returns the base name (= map id, since
      // mapJsonPath/mapTilesheetPath build `world/maps/<id>.{json,png}`) of
      // every `*.json` and every `*.png`, so the client can resolve shared
      // tilesheets itself and only offer maps it can truly load.
      server.middlewares.use('/api/editor/list-maps', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const dir = path.resolve(process.cwd(), 'public/world/maps');
          let entries: Array<{ isFile(): boolean; name: string }> = [];
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              // No maps folder yet (empty project) — empty lists, not a 500.
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ maps: [], tilesheets: [] }));
              return;
            }
            throw err;
          }
          const maps: string[] = [];
          const tilesheets: string[] = [];
          for (const e of entries) {
            if (!e.isFile()) continue;
            if (/\.json$/i.test(e.name)) maps.push(e.name.replace(/\.json$/i, ''));
            else if (/\.png$/i.test(e.name)) tilesheets.push(e.name.replace(/\.png$/i, ''));
          }
          maps.sort((a, b) => a.localeCompare(b));
          tilesheets.sort((a, b) => a.localeCompare(b));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ maps, tilesheets }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // List PNG files under public/world/tilesets/doors/ — the editor
      // portal-gate panel populates its door dropdown from this so designers
      // pick from a curated set instead of typing the full path. Returns
      // entries with a /public-relative path the renderer can hand straight
      // to loadImage().
      server.middlewares.use('/api/editor/list-doors', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const dir = path.resolve(process.cwd(), 'public/world/tilesets/doors');
          let entries: Array<{ isFile(): boolean; name: string }> = [];
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              // Folder not created yet — return an empty list rather than 500.
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ doors: [] }));
              return;
            }
            throw err;
          }
          const out: { name: string; path: string }[] = [];
          for (const e of entries) {
            if (!e.isFile()) continue;
            if (!/\.png$/i.test(e.name)) continue;
            out.push({ name: e.name, path: `world/tilesets/doors/${e.name}` });
          }
          out.sort((a, b) => a.name.localeCompare(b.name));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ doors: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // Per-folder default collision boxes for object families. Each
      // Animated/<folder>/ may host a `_collider.json` sidecar of the
      // form { "colliderBox": { x, y, w, h } } in source pixels. Used as
      // the runtime/editor fallback BEFORE the auto alpha-bbox crop, so a
      // designer can dial in one canonical collider for "all flags" and
      // every placement inherits it without per-instance setup.
      server.middlewares.use('/api/editor/list-object-folder-defaults', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const root = path.resolve(process.cwd(), 'public/world/tilesets/Animated');
          const out: Array<{ folder: string; colliderBox: { x: number; y: number; w: number; h: number } }> = [];
          let dirs: Array<{ isDirectory(): boolean; name: string }> = [];
          try {
            dirs = await fs.readdir(root, { withFileTypes: true });
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ defaults: [] }));
              return;
            }
            throw err;
          }
          for (const d of dirs) {
            if (!d.isDirectory()) continue;
            const sidecar = path.join(root, d.name, '_collider.json');
            try {
              const raw = await fs.readFile(sidecar, 'utf8');
              const json = JSON.parse(raw);
              const cb = json?.colliderBox;
              if (cb && typeof cb.x === 'number' && typeof cb.y === 'number' && typeof cb.w === 'number' && typeof cb.h === 'number') {
                out.push({ folder: `Animated/${d.name}`, colliderBox: cb });
              }
            } catch {
              // No sidecar / malformed — skip silently. Folder simply has no default.
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ defaults: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // Write or clear a folder default. Body: { folder, colliderBox? }.
      // Omitting colliderBox (or passing null) deletes the sidecar.
      server.middlewares.use('/api/editor/save-object-folder-default', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { folder, colliderBox } = JSON.parse(body) as { folder: unknown; colliderBox: unknown };
            // Allowlist folder shape to keep the writer inside Animated/*.
            // Path-traversal guard plus a check that the directory exists
            // upfront — we don't want to silently create new folders.
            if (typeof folder !== 'string' || !/^Animated\/[a-zA-Z0-9_-]+$/.test(folder)) {
              res.statusCode = 400;
              res.end('invalid folder');
              return;
            }
            const dir = path.resolve(process.cwd(), 'public/world/tilesets', folder);
            const rel = path.relative(path.resolve(process.cwd(), 'public/world/tilesets'), dir);
            if (rel.startsWith('..')) {
              res.statusCode = 400;
              res.end('path traversal');
              return;
            }
            try { await fs.access(dir); } catch { res.statusCode = 404; res.end('folder not found'); return; }
            const file = path.join(dir, '_collider.json');
            if (colliderBox === null || colliderBox === undefined) {
              try { await fs.unlink(file); } catch { /* already gone — that's fine */ }
              console.log(`[editor-save] cleared folder default ${folder}/_collider.json`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, cleared: true }));
              return;
            }
            const cb = colliderBox as { x: number; y: number; w: number; h: number };
            if (typeof cb.x !== 'number' || typeof cb.y !== 'number' || typeof cb.w !== 'number' || typeof cb.h !== 'number') {
              res.statusCode = 400;
              res.end('invalid colliderBox');
              return;
            }
            const payload = `{
  "colliderBox": { "x": ${cb.x}, "y": ${cb.y}, "w": ${cb.w}, "h": ${cb.h} }
}
`;
            await fs.writeFile(file, payload, 'utf8');
            console.log(`[editor-save] wrote folder default ${folder}/_collider.json`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // List every PNG under public/world/tilesets/Animated/<folder>/.
      // For each folder we also peek at the JSON sidecar (any .json in the
      // folder) to learn the source-pixel frame dimensions of the sheet
      // — flags ship as 16×16 frames but flower.png is 10×8, plant.png is
      // 16×16, and future assets may vary. Returning per-image frame
      // sizes lets the editor + runtime slice each sheet correctly without
      // hardcoding 16. Frames are assumed horizontally arranged at y=0
      // (matches every sheet we ship today).
      server.middlewares.use('/api/editor/list-objects', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const root = path.resolve(process.cwd(), 'public/world/tilesets/Animated');
          let folders: Array<{ isDirectory(): boolean; name: string }> = [];
          try {
            folders = await fs.readdir(root, { withFileTypes: true });
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ objects: [] }));
              return;
            }
            throw err;
          }
          const out: { name: string; image: string; frameW: number; frameH: number }[] = [];
          for (const f of folders) {
            if (!f.isDirectory()) continue;
            const dir = path.join(root, f.name);
            const entries = await fs.readdir(dir, { withFileTypes: true });
            // Discover this folder's frame dimensions from the first .json
            // file's first frame. Falls back to 16×16 if no sidecar is
            // present.
            let frameW = 16, frameH = 16;
            for (const e of entries) {
              if (!e.isFile() || !/\.json$/i.test(e.name)) continue;
              try {
                const raw = await fs.readFile(path.join(dir, e.name), 'utf8');
                const json = JSON.parse(raw);
                const frames = json?.frames && typeof json.frames === 'object' ? Object.values(json.frames) : [];
                const first = frames[0] as { frame?: { w?: number; h?: number } } | undefined;
                if (first?.frame && typeof first.frame.w === 'number' && typeof first.frame.h === 'number') {
                  frameW = first.frame.w;
                  frameH = first.frame.h;
                  break;
                }
              } catch {
                // Malformed sidecar — fall through, keep the 16×16 default.
              }
            }
            for (const e of entries) {
              if (!e.isFile() || !/\.png$/i.test(e.name)) continue;
              out.push({
                name: e.name,
                image: `Animated/${f.name}/${e.name}`,
                frameW,
                frameH,
              });
            }
          }
          out.sort((a, b) => a.image.localeCompare(b.image));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ objects: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // List every character folder under public/world/npcs/Character/, with
      // a "limited" flag for sheets that have fewer than 20 frames (no full
      // walk cycle across all four facings — Child / OldWoman are the current
      // examples). The editor NPC panel uses this for its sprite picker.
      server.middlewares.use('/api/editor/list-characters', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const dir = path.resolve(process.cwd(), 'public/world/npcs/Character');
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const out: { name: string; limited: boolean }[] = [];
          for (const e of entries) {
            if (!e.isDirectory()) continue;
            const sheetPath = path.join(dir, e.name, 'SpriteSheet.json');
            let limited = false;
            try {
              const raw = await fs.readFile(sheetPath, 'utf8');
              const json = JSON.parse(raw) as { frames?: Record<string, unknown> };
              const frameCount = json.frames ? Object.keys(json.frames).length : 0;
              // Full character sheets have ~29 frames; stripped-down NPC-only
              // sheets have ~9. 20 splits them cleanly.
              limited = frameCount < 20;
            } catch {
              // Missing/unreadable SpriteSheet.json — assume limited so the
              // editor flags it, rather than pretending it's full-spec.
              limited = true;
            }
            out.push({ name: e.name, limited });
          }
          out.sort((a, b) => a.name.localeCompare(b.name));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ characters: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // Write the generated-quests JSON used by the Trainer Battle
      // Creator (Admin → Trainer Gen). Body: { quests: QuestDef[] }.
      // The static `STATIC_QUESTS` array stays in TS source; this file
      // gets imported and concatenated at module load — so the admin
      // can scaffold a 7-trainer questline locally, see it land in the
      // game immediately via HMR, and commit + deploy when ready.
      server.middlewares.use('/api/editor/save-generated-quests', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { quests } = JSON.parse(body);
            if (!Array.isArray(quests)) {
              res.statusCode = 400;
              res.end('quests must be an array');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/quests-generated.json');
            await fs.writeFile(file, JSON.stringify({ quests }, null, 2) + '\n', 'utf8');
            const rel = path.relative(process.cwd(), file);
            console.log(`[editor-save] wrote ${rel} (${quests.length} quest${quests.length === 1 ? '' : 's'})`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel, count: quests.length }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // List every NPC JSON under src/world/data/npcs/. Used by the editor
      // to hydrate its in-memory NPC list from authoritative disk state on
      // mount AND right after "+ NPC". Without this endpoint, NPCs created
      // at runtime were vanishing on save: vite's `import.meta.glob` does
      // NOT pick up newly-added files until the dev server restarts, so
      // when a save triggered a vite HMR remount of the editor, the new
      // NPC's character / dialogue / sprite state was lost (it lived only
      // in the React `npcOverrides` map, which resets on remount), and
      // `resolveNpc()` returned null → the placement rendered as
      // "unknown" → the NPC visually disappeared.
      server.middlewares.use('/api/editor/list-npcs', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const dir = path.resolve(process.cwd(), 'src/world/data/npcs');
          const files = await fs.readdir(dir);
          const out: Array<Record<string, unknown>> = [];
          for (const f of files) {
            if (!/\.json$/i.test(f)) continue;
            try {
              const raw = await fs.readFile(path.join(dir, f), 'utf8');
              const json = JSON.parse(raw);
              if (json && typeof json === 'object' && typeof json.id === 'string') {
                out.push(json);
              }
            } catch {
              // Skip malformed JSON — the editor will surface anything missing
              // when it tries to use it.
            }
          }
          out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ npcs: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // List every animal species under public/world/npcs/Animal/ along
      // with the sprite-sheet variants each one ships (e.g. Horse ships
      // SpriteSheetBlack + SpriteSheetBrown). Drives the editor's animal
      // picker. Variant names are the part after "SpriteSheet" in the JSON
      // filename (plus a tolerant match for the misspelled Lioness sheet,
      // which ships as "SpriteSheeLlioness.json").
      server.middlewares.use('/api/editor/list-animals', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const dir = path.resolve(process.cwd(), 'public/world/npcs/Animal');
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const out: { type: string; sheets: string[] }[] = [];
          for (const e of entries) {
            if (!e.isDirectory()) continue;
            const files = await fs.readdir(path.join(dir, e.name));
            // Match SpriteSheet*.json AND SpriteSheeL*.json (Lioness typo),
            // case-insensitively so future accidental casing doesn't hide
            // valid sheets.
            const sheets = files
              .filter((f) => /^(SpriteSheet|SpriteSheeL).*\.json$/i.test(f))
              .map((f) => f.replace(/\.json$/i, ''))
              .sort((a, b) => {
                // Default "SpriteSheet" first so it becomes the dropdown's
                // initial selection for species with multiple variants.
                if (a === 'SpriteSheet') return -1;
                if (b === 'SpriteSheet') return 1;
                return a.localeCompare(b);
              });
            if (sheets.length === 0) continue;
            out.push({ type: e.name, sheets });
          }
          out.sort((a, b) => a.type.localeCompare(b.type));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ animals: out }));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });

      // Create a new NPC at src/world/data/npcs/<id>.json. Fails 409 if the
      // file already exists — the editor guards that at the UI level too, but
      // this is the authoritative check against races.
      server.middlewares.use('/api/editor/create-npc', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { npcId, data } = JSON.parse(body);
            if (typeof npcId !== 'string' || !/^[a-z0-9-]+$/.test(npcId)) {
              res.statusCode = 400;
              res.end('invalid npcId — lowercase alphanumeric and hyphens only');
              return;
            }
            if (!data || typeof data !== 'object') {
              res.statusCode = 400;
              res.end('invalid data');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/npcs', `${npcId}.json`);
            const rel = path.relative(process.cwd(), file);
            if (rel.startsWith('..')) {
              res.statusCode = 400;
              res.end('path traversal');
              return;
            }
            try {
              await fs.access(file);
              res.statusCode = 409;
              res.end(`npc "${npcId}" already exists`);
              return;
            } catch { /* expected — file does not exist */ }
            const record = { id: npcId, ...data } as Record<string, unknown>;
            const order = [
              'id', 'name', 'character', 'kind',
              'dialogue', 'preBattleLine', 'postDefeatDialogue',
              'trainerParty', 'trainerReward',
            ];
            const ordered: Record<string, unknown> = {};
            for (const k of order) if (k in record) ordered[k] = record[k];
            for (const k of Object.keys(record)) if (!(k in ordered)) ordered[k] = record[k];
            await fs.writeFile(file, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
            console.log(`[editor-save] created ${rel}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Delete src/world/data/npcs/<id>.json. Does NOT clean placements on
      // other maps — the editor warns about that before sending. Missing file
      // returns 404 so the UI can surface a clear error.
      server.middlewares.use('/api/editor/delete-npc', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { npcId } = JSON.parse(body);
            if (typeof npcId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(npcId)) {
              res.statusCode = 400;
              res.end('invalid npcId');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/npcs', `${npcId}.json`);
            const rel = path.relative(process.cwd(), file);
            if (rel.startsWith('..')) {
              res.statusCode = 400;
              res.end('path traversal');
              return;
            }
            try {
              await fs.unlink(file);
            } catch {
              res.statusCode = 404;
              res.end(`npc "${npcId}" not found`);
              return;
            }
            console.log(`[editor-save] deleted ${rel}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Write a single NPC's JSON back to src/world/data/npcs/<id>.json. The
      // editor posts the FULL NPC object — we merge with any trainer/kind/
      // etc. fields already on disk so fields the editor doesn't expose
      // aren't silently dropped.
      server.middlewares.use('/api/editor/save-npc', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { npcId, data } = JSON.parse(body);
            if (typeof npcId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(npcId)) {
              res.statusCode = 400;
              res.end('invalid npcId');
              return;
            }
            if (!data || typeof data !== 'object') {
              res.statusCode = 400;
              res.end('invalid data');
              return;
            }
            const file = path.resolve(process.cwd(), 'src/world/data/npcs', `${npcId}.json`);
            const rel = path.relative(process.cwd(), file);
            if (rel.startsWith('..')) {
              res.statusCode = 400;
              res.end('path traversal');
              return;
            }

            // Merge with existing file so fields the editor doesn't expose
            // (e.g. `kind`) survive. Convention: the client passes an explicit
            // `null` to REMOVE a field it manages but has turned off (trainer
            // fields for a plain-talk NPC, etc).
            let existing: Record<string, unknown> = {};
            try {
              const raw = await fs.readFile(file, 'utf8');
              existing = JSON.parse(raw);
            } catch {
              // New NPC — existing stays empty.
            }
            const merged: Record<string, unknown> = { ...existing, ...data, id: npcId };
            for (const k of Object.keys(merged)) {
              if (merged[k] === null) delete merged[k];
            }

            // Stable field order for readable diffs.
            const order = [
              'id', 'name', 'character', 'kind', 'stationary', 'faceDirection', 'homeMapId',
              'dialogue', 'preBattleLine', 'postDefeatDialogue',
              'trainerParty', 'trainerReward',
              'blocksPassage', 'requiredTrainerDefeats', 'prereqBlockedMessage',
            ];
            const ordered: Record<string, unknown> = {};
            for (const k of order) if (k in merged) ordered[k] = merged[k];
            for (const k of Object.keys(merged)) if (!(k in ordered)) ordered[k] = merged[k];

            await fs.writeFile(file, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
            console.log(`[editor-save] wrote ${rel}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

// Scan public/world/tilesets/Animated/* for PNGs + read each folder's
// JSON sidecar to learn frame dimensions, then write a single manifest
// the runtime preloader fetches at startup. Mirrors the doors-manifest
// pattern. The runtime needs frame dimensions per image because not
// every sheet is 16×16 (flower.png is 10×8) and we need to slice the
// sheet correctly to extract one frame. Frames are assumed horizontally
// arranged at y=0 (matches every sheet we ship).
function objectsManifest() {
  const ROOT = 'public/world/tilesets/Animated';
  const OUT = path.join(ROOT, '_manifest.json');
  async function regenerate() {
    const rootAbs = path.resolve(process.cwd(), ROOT);
    let folders: Array<{ isDirectory(): boolean; name: string }>;
    try {
      folders = await fs.readdir(rootAbs, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === 'ENOENT') return; // Folder not created yet — nothing to manifest.
      console.warn('[objects-manifest] readdir failed:', err);
      return;
    }
    const out: { image: string; frameW: number; frameH: number }[] = [];
    for (const f of folders) {
      if (!f.isDirectory()) continue;
      const dir = path.join(rootAbs, f.name);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      // First .json wins. Sheets we ship use the LayoutManager format
      // {frames:{name:{frame:{x,y,w,h}}}}; we only need the first frame's
      // w/h, since every frame in a given sheet uses identical dims.
      let frameW = 16, frameH = 16;
      for (const e of entries) {
        if (!e.isFile() || !/\.json$/i.test(e.name) || e.name === '_collider.json') continue;
        try {
          const raw = await fs.readFile(path.join(dir, e.name), 'utf8');
          const json = JSON.parse(raw);
          const frames = json?.frames && typeof json.frames === 'object' ? Object.values(json.frames) : [];
          const first = frames[0] as { frame?: { w?: number; h?: number } } | undefined;
          if (first?.frame && typeof first.frame.w === 'number' && typeof first.frame.h === 'number') {
            frameW = first.frame.w;
            frameH = first.frame.h;
            break;
          }
        } catch { /* malformed — keep default */ }
      }
      for (const e of entries) {
        if (!e.isFile() || !/\.png$/i.test(e.name)) continue;
        out.push({ image: `Animated/${f.name}/${e.name}`, frameW, frameH });
      }
    }
    out.sort((a, b) => a.image.localeCompare(b.image));
    const body = JSON.stringify({ objects: out }, null, 2) + '\n';
    const outAbs = path.resolve(process.cwd(), OUT);
    try {
      const existing = await fs.readFile(outAbs, 'utf8');
      if (existing === body) return;
    } catch { /* file missing — write it */ }
    await fs.writeFile(outAbs, body, 'utf8');
    console.log(`[objects-manifest] wrote ${OUT} (${out.length} image${out.length === 1 ? '' : 's'})`);
  }
  return {
    name: 'objects-manifest',
    buildStart: regenerate,
    configureServer(server: { watcher: { add: (p: string) => void; on: (ev: string, cb: (file: string) => void) => void } }) {
      server.watcher.add(`${ROOT}/**`);
      const trigger = (file: string) => { if (file.includes('/tilesets/Animated/')) regenerate(); };
      server.watcher.on('add', trigger);
      server.watcher.on('unlink', trigger);
      server.watcher.on('change', (file) => {
        // JSON edits change frame dims; PNG edits don't, but we
        // regenerate on either for simplicity.
        if (file.includes('/tilesets/Animated/') && (/\.png$/i.test(file) || /\.json$/i.test(file))) regenerate();
      });
    },
  };
}

// Scan public/world/tilesets/doors/ for PNGs and write a manifest the
// runtime preloader fetches at startup. Runs at both `vite` (dev) and
// `vite build` (prod) start, so dropping a new door PNG into the folder
// and restarting the server is enough — no code change needed. The
// manifest is a static file under public/, so the prod bundle includes
// it automatically.
function doorsManifest() {
  const DIR = 'public/world/tilesets/doors';
  const OUT = path.join(DIR, '_manifest.json');
  async function regenerate() {
    const abs = path.resolve(process.cwd(), DIR);
    let entries: Array<{ isFile(): boolean; name: string }>;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === 'ENOENT') return; // No folder yet — nothing to manifest.
      console.warn('[doors-manifest] readdir failed:', err);
      return;
    }
    const files = entries
      .filter((e) => e.isFile() && /\.png$/i.test(e.name) && e.name !== '_manifest.json')
      .map((e) => e.name)
      .sort();
    const body = JSON.stringify({ doors: files }, null, 2) + '\n';
    const outAbs = path.resolve(process.cwd(), OUT);
    try {
      const existing = await fs.readFile(outAbs, 'utf8');
      if (existing === body) return; // No-op — avoids triggering the dev watcher.
    } catch { /* file missing — write it */ }
    await fs.writeFile(outAbs, body, 'utf8');
    console.log(`[doors-manifest] wrote ${OUT} (${files.length} door${files.length === 1 ? '' : 's'})`);
  }
  return {
    name: 'doors-manifest',
    buildStart: regenerate,
    configureServer(server: { watcher: { add: (p: string) => void; on: (ev: string, cb: (file: string) => void) => void } }) {
      server.watcher.add(`${DIR}/**`);
      server.watcher.on('add', (file) => { if (file.includes('/tilesets/doors/')) regenerate(); });
      server.watcher.on('unlink', (file) => { if (file.includes('/tilesets/doors/')) regenerate(); });
    },
  };
}

export default defineConfig({
  plugins: [
    react(), // Must come first - handles JSX transform
    watchMapFiles(),
    autoStubMaps(),
    editorSaveApi(),
    doorsManifest(),
    objectsManifest(),
  ],
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Play mode reuses the game's overworld engine, which imports the
      // run.game SDK. The standalone editor has no host, so alias the SDK
      // to a local stub (guest profile + no CDN). See src/stubs/.
      '@series-inc/rundot-game-sdk/api': path.resolve(process.cwd(), 'src/stubs/rundot-sdk-api.ts'),
    },
  },
  // Pinned ports so PicMon doesn't collide with Depths (which uses Vite's
  // defaults of 5173 / 4173). 5174/4174 are PicMon-only — bump them again if
  // you ever spin up a third local game.
  server: {
    // `host: true` binds 0.0.0.0 so phones / other devices on the same LAN
    // can hit the dev server at http://<dev-machine-ip>:5174 — Vite prints
    // the LAN URL alongside the localhost one when it starts up.
    host: true,
    allowedHosts: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    // Mirror the dev-server settings so `npm run preview` is reachable
    // from phones / tablets on the same LAN without needing `--host`
    // on the command line. Same allowedHosts: true relaxation as dev
    // because mobile browsers hit the LAN IP, not localhost.
    host: true,
    allowedHosts: true,
    port: 4180,
    strictPort: true,
  },
  // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
  // RUN.game SDK includes top-level await, so we must target an environment that supports it.
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022', // Support top-level await for embedded libraries
    // 2026-06-10 — Bundle was a single 1.9 MB monolith; players reported
    // universal slowness across all devices. Splitting node_modules into
    // a separate vendor chunk lets the browser cache it across deploys
    // (vendor code rarely changes) and parallelize fetches over HTTP/2.
    // React/ReactDOM are already externalized to a CDN by the RUN SDK
    // libraries plugin — see rundot-game-libraries.manifest.json — so
    // they never enter our bundle in the first place. The big app-code
    // savings come from React.lazy on heavy modals (see WorldTab.tsx).
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
