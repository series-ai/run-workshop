import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sampleWorkspacePixel } from '../workspaceSampler';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
  recentColors?: string[];
  onAddRecentColor?: (hex: string) => void;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

const DEFAULT_COLORS = [
  '#ffffff', '#000000', '#888888',
  '#ff0000', '#ff8000', '#ffff00',
  '#00cc00', '#0000ff', '#8b00ff',
  '#ff69b4', '#804000', '#00cccc',
];

/** Add a color to the recent colors list in localStorage. */
export function addRecentColor(hex: string): void {
  try {
    const stored = localStorage.getItem('paint_recent_colors');
    const prev: string[] = stored ? JSON.parse(stored) : DEFAULT_COLORS;
    const filtered = prev.filter(c => c !== hex);
    const updated = [hex, ...filtered].slice(0, 12);
    localStorage.setItem('paint_recent_colors', JSON.stringify(updated));
  } catch {}
}

const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
const rgbToHexStr = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;

/** Sample the color under a client point from whatever is rendered there —
 * <img> pixels, <canvas> pixels, or an element's solid background color.
 * In-app fallback for browsers without the native EyeDropper API (Brave). */
/** True when the topmost *visible* element at a point belongs to the
 * workspace page rather than a floating panel above it. Transparent
 * full-screen wrappers (picker/modal backdrops) are see-through. */
function pointIsOnWorkspace(x: number, y: number, skip: (el: Element) => boolean): boolean {
  for (const el of document.elementsFromPoint(x, y)) {
    if (skip(el)) continue;
    if (el.closest('.workspace-viewport')) return true;
    const cs = getComputedStyle(el);
    const m = cs.backgroundColor.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
    const opaque = m ? (m[1] === undefined || parseFloat(m[1]!) > 0.1) : false;
    if (opaque || (el instanceof HTMLImageElement) || (el instanceof HTMLCanvasElement)) return false;
  }
  return false;
}

/** Sample the color under a client point. Over the workspace page this uses
 * the export compositor (crops, flips, rotation, paint layers all correct);
 * over panels it falls back to DOM sampling of imgs/canvases/backgrounds. */
export async function sampleScreenColor(x: number, y: number, skip: (el: Element) => boolean): Promise<string | null> {
  if (pointIsOnWorkspace(x, y, skip)) {
    const hex = await sampleWorkspacePixel(x, y);
    if (hex) return hex;
  }
  return sampleColorAt(x, y, skip);
}

export function sampleColorAt(x: number, y: number, skip: (el: Element) => boolean): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (skip(el)) continue;
    if (el instanceof HTMLImageElement && el.naturalWidth > 0) {
      const r = el.getBoundingClientRect();
      // Respect object-fit — thumbnails use `contain`, which letterboxes the
      // image inside its box; naive box-ratio mapping samples the padding.
      const fit = getComputedStyle(el).objectFit || 'fill';
      const nw = el.naturalWidth;
      const nh = el.naturalHeight;
      let sx = r.width / nw;
      let sy = r.height / nh;
      if (fit === 'contain' || fit === 'scale-down') { const s = Math.min(sx, sy); sx = s; sy = s; }
      else if (fit === 'cover') { const s = Math.max(sx, sy); sx = s; sy = s; }
      else if (fit === 'none') { sx = 1; sy = 1; }
      const ox = (r.width - nw * sx) / 2;   // object-position defaults to center
      const oy = (r.height - nh * sy) / 2;
      const px = (x - r.left - ox) / sx;
      const py = (y - r.top - oy) / sy;
      if (px >= 0 && py >= 0 && px < nw && py < nh) {
        try {
          const c = document.createElement('canvas');
          c.width = 1; c.height = 1;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(el, Math.floor(px), Math.floor(py), 1, 1, 0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          if (d[3]! > 0) return rgbToHexStr(d[0]!, d[1]!, d[2]!);
        } catch { /* tainted (cross-origin) image — fall through */ }
      }
      continue;
    }
    if (el instanceof HTMLCanvasElement) {
      const r = el.getBoundingClientRect();
      const px = Math.floor(((x - r.left) / r.width) * el.width);
      const py = Math.floor(((y - r.top) / r.height) * el.height);
      try {
        const d = el.getContext('2d')?.getImageData(px, py, 1, 1).data;
        if (d && d[3]! > 0) return rgbToHexStr(d[0]!, d[1]!, d[2]!);
      } catch { /* webgl/tainted — fall through */ }
      continue;
    }
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m && (m[4] === undefined || parseFloat(m[4]!) > 0.5)) {
      return rgbToHexStr(Number(m[1]), Number(m[2]), Number(m[3]));
    }
  }
  return null;
}

export function ColorPicker({ color, onChange, onClose, recentColors: recentColorsProp, onAddRecentColor }: ColorPickerProps) {
  const [rgb] = useState(() => hexToRgb(color));
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(rgb[0], rgb[1], rgb[2]));
  const [sampling, setSampling] = useState(false);
  const [samplePreview, setSamplePreview] = useState<{ x: number; y: number; hex: string | null } | null>(null);

  // Escape cancels in-app eyedropper sampling
  useEffect(() => {
    if (!sampling) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setSampling(false); setSamplePreview(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [sampling]);
  const [recentColorsLocal, setRecentColorsLocal] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('paint_recent_colors');
      return stored ? JSON.parse(stored) : DEFAULT_COLORS;
    } catch { return DEFAULT_COLORS; }
  });
  const recentColors = recentColorsProp ?? recentColorsLocal;

  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelDragging = useRef(false);
  const svDragging = useRef(false);

  const WHEEL_SIZE = 200;
  const WHEEL_INNER_RADIUS = 65;
  const WHEEL_OUTER_RADIUS = 96;
  const SV_SIZE = 116;

  const drawWheel = useCallback(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);

    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2, startAngle, endAngle);
      ctx.lineWidth = WHEEL_OUTER_RADIUS - WHEEL_INNER_RADIUS;
      const [r, g, b] = hsvToRgb(angle, 1, 1);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.stroke();
    }

    const hRad = hsv[0] * Math.PI / 180;
    const indicatorR = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2;
    const ix = cx + Math.cos(hRad) * indicatorR;
    const iy = cy + Math.sin(hRad) * indicatorR;
    ctx.beginPath();
    ctx.arc(ix, iy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsv]);

  const drawSV = useCallback(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const [hr, hg, hb] = hsvToRgb(hsv[0], 1, 1);
    ctx.fillStyle = `rgb(${hr},${hg},${hb})`;
    ctx.fillRect(0, 0, SV_SIZE, SV_SIZE);

    const whiteGrad = ctx.createLinearGradient(0, 0, SV_SIZE, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, SV_SIZE, SV_SIZE);

    const blackGrad = ctx.createLinearGradient(0, 0, 0, SV_SIZE);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, SV_SIZE, SV_SIZE);

    const sx = hsv[1] * SV_SIZE;
    const sy = (1 - hsv[2]) * SV_SIZE;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsv]);

  // Sync internal HSV when the color prop changes externally (e.g. eyedropper)
  useEffect(() => {
    const [r, g, b] = hexToRgb(color);
    const newHsv = rgbToHsv(r, g, b);
    setHsv((prev) => {
      if (hsvToHex(prev[0], prev[1], prev[2]).toLowerCase() === color.toLowerCase()) return prev;
      return newHsv;
    });
  }, [color]);

  useEffect(() => { drawWheel(); }, [drawWheel]);
  useEffect(() => { drawSV(); }, [drawSV]);

  const updateColor = useCallback((newHsv: [number, number, number]) => {
    setHsv(newHsv);
    onChange(hsvToHex(newHsv[0], newHsv[1], newHsv[2]));
  }, [onChange]);

  const addToRecent = useCallback((hex: string) => {
    if (onAddRecentColor) {
      onAddRecentColor(hex);
      return;
    }
    setRecentColorsLocal(prev => {
      const filtered = prev.filter(c => c !== hex);
      const updated = [hex, ...filtered].slice(0, 12);
      try { localStorage.setItem('paint_recent_colors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const handleWheelPointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    const dist = Math.sqrt(x * x + y * y) * (WHEEL_SIZE / rect.width);
    if (dist < WHEEL_INNER_RADIUS - 10 || dist > WHEEL_OUTER_RADIUS + 10) return;
    wheelDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    updateColor([angle, hsv[1], hsv[2]]);
  }, [hsv, updateColor]);

  const handleWheelPointerMove = useCallback((e: React.PointerEvent) => {
    if (!wheelDragging.current) return;
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    updateColor([angle, hsv[1], hsv[2]]);
  }, [hsv, updateColor]);

  const handleWheelPointerUp = useCallback(() => {
    if (wheelDragging.current) {
      wheelDragging.current = false;
      addToRecent(hsvToHex(hsv[0], hsv[1], hsv[2]));
    }
  }, [hsv, addToRecent]);

  const handleSVPointerDown = useCallback((e: React.PointerEvent) => {
    svDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    updateColor([hsv[0], s, v]);
  }, [hsv, updateColor]);

  const handleSVPointerMove = useCallback((e: React.PointerEvent) => {
    if (!svDragging.current) return;
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    updateColor([hsv[0], s, v]);
  }, [hsv, updateColor]);

  const handleSVPointerUp = useCallback(() => {
    if (svDragging.current) {
      svDragging.current = false;
      addToRecent(hsvToHex(hsv[0], hsv[1], hsv[2]));
    }
  }, [hsv, addToRecent]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const [r, g, b] = hexToRgb(val);
      setHsv(rgbToHsv(r, g, b));
      onChange(val.toLowerCase());
    }
  }, [onChange]);

  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  const [cr, cg, cb] = hsvToRgb(hsv[0], hsv[1], hsv[2]);

  return (
    <div className="paint-color-picker" onPointerDown={(e) => e.stopPropagation()}>
      <div className="paint-color-picker-header">
        <span>Color</span>
        <button className="paint-color-picker-done" onClick={() => { addToRecent(currentHex); onClose(); }}>Done</button>
      </div>

      <div className="color-wheel-area">
        <div className="color-wheel-container" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
          <canvas
            ref={wheelCanvasRef}
            width={WHEEL_SIZE}
            height={WHEEL_SIZE}
            className="color-wheel-canvas"
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerUp}
          />
          <div
            className="color-sv-container"
            style={{
              width: SV_SIZE, height: SV_SIZE,
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <canvas
              ref={svCanvasRef}
              width={SV_SIZE}
              height={SV_SIZE}
              className="color-sv-canvas"
              onPointerDown={handleSVPointerDown}
              onPointerMove={handleSVPointerMove}
              onPointerUp={handleSVPointerUp}
              onPointerCancel={handleSVPointerUp}
            />
          </div>
        </div>
      </div>

      <div className="color-info-row">
        <div className="color-info-preview" style={{ backgroundColor: currentHex }} />
        <button
          className={`color-picker-eyedropper${sampling ? ' color-picker-eyedropper-active' : ''}`}
          title="Pick a color from the app (images, canvases, UI)"
          onClick={async () => {
            const applyHex = (hex: string) => {
              const [r, g, b] = hexToRgb(hex);
              setHsv(rgbToHsv(r, g, b));
              onChange(hex.toLowerCase());
              addToRecent(hex.toLowerCase());
            };
            if ('EyeDropper' in window) {
              // Native screen-wide picker (Chrome; Brave disables it)
              try {
                const picker = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
                const result = await picker.open();
                applyHex(result.sRGBHex);
              } catch { /* user cancelled */ }
            } else {
              setSampling(true);
            }
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 22l1-1h3l9-9" />
            <path d="M3 21v-3l9-9" />
            <path d="M15 6l3-3a2.12 2.12 0 0 1 3 3l-3 3" />
            <path d="M12 3l9 9" />
          </svg>
        </button>
        <div className="color-info-values">
          <div className="color-hex-input-row">
            <span className="color-label">HEX</span>
            <input
              className="color-hex-input"
              value={currentHex.toUpperCase()}
              onChange={handleHexInput}
              onKeyDown={(e) => e.stopPropagation()}
              maxLength={7}
              spellCheck={false}
            />
          </div>
          <div className="color-rgb-row">
            <span className="color-label">R</span><span className="color-value">{cr}</span>
            <span className="color-label">G</span><span className="color-value">{cg}</span>
            <span className="color-label">B</span><span className="color-value">{cb}</span>
          </div>
        </div>
      </div>

      {recentColors.length > 0 && (
        <div className="color-recent-section">
          <span className="color-recent-label">Quick Colors</span>
          <div className="color-recent-row">
            {recentColors.map((c, i) => (
              <button
                key={`${c}-${i}`}
                className={`color-recent-swatch${c === currentHex ? ' color-recent-swatch-active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  const [r, g, b] = hexToRgb(c);
                  setHsv(rgbToHsv(r, g, b));
                  onChange(c);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {sampling && createPortal(
        <div
          className="eyedropper-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 200000, cursor: 'crosshair' }}
          onPointerMove={async (e) => {
            const { clientX, clientY } = e;
            const hex = await sampleScreenColor(clientX, clientY, (el) => !!el.closest('.eyedropper-overlay'));
            setSamplePreview({ x: clientX, y: clientY, hex });
          }}
          onPointerDown={async (e) => {
            e.stopPropagation();
            if (e.button !== 0) { setSampling(false); setSamplePreview(null); return; }
            const hex = await sampleScreenColor(e.clientX, e.clientY, (el) => !!el.closest('.eyedropper-overlay'));
            if (hex) {
              const [r, g, b] = hexToRgb(hex);
              setHsv(rgbToHsv(r, g, b));
              onChange(hex);
              addToRecent(hex);
            }
            setSampling(false);
            setSamplePreview(null);
          }}
          onContextMenu={(e) => { e.preventDefault(); setSampling(false); setSamplePreview(null); }}
        >
          {samplePreview && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(samplePreview.x + 16, window.innerWidth - 90),
                top: Math.min(samplePreview.y + 16, window.innerHeight - 40),
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(20, 20, 20, 0.9)',
                color: '#fff',
                fontSize: 11,
                pointerEvents: 'none',
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 3, border: '1px solid rgba(255,255,255,0.4)', background: samplePreview.hex ?? 'transparent' }} />
              {samplePreview.hex ? samplePreview.hex.toUpperCase() : '—'}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
