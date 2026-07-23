import { useState, useRef, useCallback, useEffect } from 'react';

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

export function ColorPicker({ color, onChange, onClose, recentColors: recentColorsProp, onAddRecentColor }: ColorPickerProps) {
  const [rgb] = useState(() => hexToRgb(color));
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(rgb[0], rgb[1], rgb[2]));
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
    </div>
  );
}
