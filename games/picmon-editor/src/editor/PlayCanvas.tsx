import { useEffect, useRef, useState } from 'react';
import { input } from '../world/engine/Input';
import { preloadAssets, mapJsonPath } from '../world/engine/assets';
import { TILE_SIZE } from '../world/engine/types';
import { getMap } from '../world/data/spriteFusionMap';
import { getWorldSignsForMap } from '../world/data/worldSigns';
import {
  createOverworldState,
  updateOverworld,
  renderOverworld,
  resolveCamera,
} from '../world/systems/Overworld';
import { emitAmbientFx } from '../world/systems/ambientFx';

// Pixel zoom for the demo. The game's renderOverworld draws tiles 1:1 (16px);
// in the real app the canvas sits in a phone-width column. On a desktop editor
// overlay we scale up so tiles aren't tiny. Adjustable live via the HUD −/+.
const DEFAULT_ZOOM = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface DialogueView { name: string; text: string; portrait?: string }
interface SignView { pages: string[]; idx: number }

/**
 * Full-screen Play-mode overlay. Reuses Picmon's actual overworld engine —
 * input → updateOverworld → resolveCamera → renderOverworld — so controls,
 * camera, movement, collision, portal travel, NPC dialogue, and signs match
 * the real game. Battles / wild encounters are intentionally inert (not
 * extracted). Reflects the saved map data, not unsaved editor edits.
 */
export function PlayCanvas({ mapId, onStop }: { mapId: string; onStop: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [hudMapId, setHudMapId] = useState(mapId);
  const [dialogue, setDialogue] = useState<DialogueView | null>(null);
  const [sign, setSign] = useState<SignView | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Read by the rAF loop without restarting it when the user changes zoom.
  const zoomRef = useRef(DEFAULT_ZOOM);
  zoomRef.current = zoom;

  useEffect(() => {
    let cancelled = false;
    let animId = 0;
    let lastTimeMs = 0;
    let frame = 0;
    let assetsReady = false;
    let hudMapShown = mapId;
    let dialogueKey = '';
    let signKey = '';

    const state = createOverworldState(mapId);
    input.clear();

    preloadAssets().finally(() => {
      if (!cancelled) { assetsReady = true; setReady(true); }
    });

    const drawLoading = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading map…', w / 2, h / 2);
      ctx.textAlign = 'start';
    };

    const loop = (nowMs: number) => {
      animId = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cssW = Math.max(1, canvas.clientWidth);
      const cssH = Math.max(1, canvas.clientHeight);
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
      }

      const dtMs = lastTimeMs > 0 ? nowMs - lastTimeMs : 16.67;
      lastTimeMs = nowMs;
      const frameMul = Math.min(3, Math.max(0.25, dtMs / 16.67));
      frame++;
      input.update();
      ctx.imageSmoothingEnabled = false;

      if (!assetsReady) {
        drawLoading(ctx, canvas.width, canvas.height);
        return;
      }

      const result = updateOverworld(state, frameMul);

      const Z = zoomRef.current;
      const logicalW = canvas.width / Z;
      const logicalH = canvas.height / Z;
      const map = getMap(mapJsonPath(state.currentMapId));
      const worldPxW = map ? map.data.mapWidth * TILE_SIZE : logicalW;
      const worldPxH = map ? map.data.mapHeight * TILE_SIZE : logicalH;
      const { camX, camY } = resolveCamera(state, logicalW, logicalH, worldPxW, worldPxH);
      emitAmbientFx(state, camX, camY, logicalW, logicalH, frameMul);

      ctx.setTransform(Z, 0, 0, Z, 0, 0);
      renderOverworld(ctx, state, logicalW, logicalH, frame);

      // Sync HUD / overlays from the engine's per-frame result. setState only
      // on change so we don't re-render React every frame.
      if (state.currentMapId !== hudMapShown) {
        hudMapShown = state.currentMapId;
        setHudMapId(state.currentMapId);
      }

      const npc = result.interactingNpc;
      const nextDialogueKey = npc ? `${npc.id}#${result.dialogueIndex}` : '';
      if (nextDialogueKey !== dialogueKey) {
        dialogueKey = nextDialogueKey;
        setDialogue(npc
          ? { name: npc.name, text: npc.dialogue[result.dialogueIndex] ?? '…', portrait: npc.faceset }
          : null);
      }

      const rsId = result.readingSign; // engine returns the sign id, or null
      const nextSignKey = rsId ? `${rsId}#${result.signPageIdx}` : '';
      if (nextSignKey !== signKey) {
        signKey = nextSignKey;
        if (rsId) {
          const def = getWorldSignsForMap(state.currentMapId).find((s) => s.id === rsId);
          const pages = def?.text && def.text.length ? def.text : (def?.label ? [def.label] : []);
          setSign({ pages, idx: result.signPageIdx });
        } else {
          setSign(null);
        }
      }
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      input.clear();
    };
  }, [mapId]);

  const boxText = sign ? (sign.pages[sign.idx] ?? '…') : dialogue?.text ?? '';
  const showBox = !!sign || !!dialogue;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000' }}>
      {/* Top HUD */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0))',
          color: '#eee', fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
        }}
      >
        <button
          onClick={onStop}
          style={{
            pointerEvents: 'auto', padding: '6px 14px', fontSize: 13, fontWeight: 600,
            background: '#7a2a2a', color: '#fff', border: '1px solid #a55',
            borderRadius: 6, cursor: 'pointer',
          }}
          title="Stop the demo and return to the editor"
        >■ Stop</button>
        <span style={{ fontSize: 13, opacity: 0.9 }}>Playing: {hudMapId}</span>
        {/* Zoom controls */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.5).toFixed(1)))}
            style={zoomBtn} title="Zoom out"
          >−</button>
          <span style={{ fontSize: 12, opacity: 0.8, width: 34, textAlign: 'center' }}>{zoom}×</span>
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.5).toFixed(1)))}
            style={zoomBtn} title="Zoom in"
          >+</button>
        </div>
        <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 'auto' }}>
          Arrow keys / WASD to move · Space/Enter to talk &amp; read signs · doorways travel
        </span>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
      />

      {/* Dialogue / sign box — same engine state, drawn as a DOM overlay */}
      {showBox && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            width: 'min(680px, 92vw)', zIndex: 3, pointerEvents: 'none',
            display: 'flex', alignItems: 'flex-end', gap: 10,
          }}
        >
          {dialogue?.portrait && (
            <img
              src={'/' + dialogue.portrait}
              alt=""
              style={{
                width: 72, height: 72, imageRendering: 'pixelated', flexShrink: 0,
                border: '3px solid #2a2a2a', borderRadius: 8, background: '#1a1a1a',
              }}
            />
          )}
          <div
            style={{
              flex: 1, background: 'rgba(20,20,26,0.96)', color: '#f2f2f2',
              border: '3px solid #4a4a5a', borderRadius: 10, padding: '12px 16px',
              fontFamily: 'system-ui, sans-serif', fontSize: 16, lineHeight: 1.45,
              boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            }}
          >
            {dialogue && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9cf', marginBottom: 4 }}>
                {dialogue.name}
              </div>
            )}
            <div>{boxText}</div>
            {sign && sign.pages.length > 1 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, textAlign: 'right' }}>
                {sign.idx + 1}/{sign.pages.length} · Space to continue
              </div>
            )}
          </div>
        </div>
      )}

      {!ready && null}
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  width: 26, height: 26, fontSize: 16, lineHeight: '1', fontWeight: 700,
  background: '#2a2a2a', color: '#ddd', border: '1px solid #555',
  borderRadius: 5, cursor: 'pointer',
};
