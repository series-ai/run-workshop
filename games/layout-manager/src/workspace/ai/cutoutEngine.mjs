/* ------------------------------------------------------------------ */
/* cutoutEngine.mjs — wand/chroma cutout with soft-shadow preservation.*/
/*                                                                     */
/* Vendored from rundot_template .agents/skills/bg-removal-softshadows */
/* /cutout.mjs (RUN Repository Supplemental License v1.0, © Series     */
/* Entertainment, Inc.) with the Node-only PNG codec and CLI removed — */
/* the browser feeds canvas ImageData ({w, h, data}) straight in.      */
/*                                                                     */
/* Layer 1 (object): select the background — magic-wand flood or       */
/* luma-invariant chroma key — refine (contract → smooth → feather),   */
/* clear it.                                                           */
/* Layer 2 (shadow): cleared pixels that are a *neutral darkening*     */
/* of the background come back as translucent black, opacity =         */
/* darkness fraction — the exact un-compositing of a multiply shadow.  */
/* ------------------------------------------------------------------ */

/* -------------------- color math (from color.js) ------------------- */

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function hexToRgb(hex) {
    const m = (hex || "#000000").replace("#", "").match(/.{1,2}/g) || ["00", "00", "00"];
    return m.slice(0, 3).map((x) => parseInt(x, 16));
}

/* ---------------- tuning constants (from constants.js) -------------- */

const ALPHA_VISIBLE = 8;
const SHADOW_NEUTRAL_TOL = 12;
const SHADOW_NOISE_FLOOR = 0.03;
const CHROMA_DARK_FLOOR = 0.35;

/* -------------- selection engine (from wand.js) --------------------- */

const chanDiff = (d, i, r, g, b) => Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b));

export function floodSelect(d, w, h, sx, sy, tolerance, sel) {
    const start = sy * w + sx;
    const i0 = start * 4;
    const sr = d[i0],
        sg = d[i0 + 1],
        sb = d[i0 + 2];
    const tol = Math.max(0, tolerance);
    const soft = Math.max(1, tol);
    const seen = new Uint8Array(w * h);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
        const p = stack.pop();
        const diff = chanDiff(d, p * 4, sr, sg, sb);
        if (diff > tol) {
            const frac = 1 - (diff - tol) / soft;
            if (frac > 0) {
                const v = Math.round(255 * frac);
                if (v > sel[p]) sel[p] = v;
            }
            continue;
        }
        sel[p] = 255;
        const x = p % w,
            y = (p / w) | 0;
        if (x + 1 < w && !seen[p + 1]) {
            seen[p + 1] = 1;
            stack.push(p + 1);
        }
        if (x > 0 && !seen[p - 1]) {
            seen[p - 1] = 1;
            stack.push(p - 1);
        }
        if (y + 1 < h && !seen[p + w]) {
            seen[p + w] = 1;
            stack.push(p + w);
        }
        if (y > 0 && !seen[p - w]) {
            seen[p - w] = 1;
            stack.push(p - w);
        }
    }
}

export function erodeSel(sel, w, h, r) {
    const tmp = new Uint8ClampedArray(sel.length);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let v = 255;
            for (let dx = -r; dx <= r; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                v = Math.min(v, sel[y * w + nx]);
                if (!v) break;
            }
            tmp[y * w + x] = v;
        }
    for (let x = 0; x < w; x++)
        for (let y = 0; y < h; y++) {
            let v = 255;
            for (let dy = -r; dy <= r; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                v = Math.min(v, tmp[ny * w + x]);
                if (!v) break;
            }
            sel[y * w + x] = v;
        }
}

export function dilateSel(sel, w, h, r) {
    const tmp = new Uint8ClampedArray(sel.length);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let v = 0;
            for (let dx = -r; dx <= r; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                v = Math.max(v, sel[y * w + nx]);
                if (v === 255) break;
            }
            tmp[y * w + x] = v;
        }
    for (let x = 0; x < w; x++)
        for (let y = 0; y < h; y++) {
            let v = 0;
            for (let dy = -r; dy <= r; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                v = Math.max(v, tmp[ny * w + x]);
                if (v === 255) break;
            }
            sel[y * w + x] = v;
        }
}

export function blurSel(sel, w, h, r) {
    const n = Math.floor(r),
        f = r - n;
    const win = 2 * n + 1 + 2 * f;
    const tmp = new Float32Array(sel.length);
    for (let y = 0; y < h; y++) {
        const row = y * w;
        let sum = 0;
        for (let x = -n; x <= n; x++) sum += sel[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
            let v = sum;
            if (f > 0) v += f * (sel[row + Math.max(0, x - n - 1)] + sel[row + Math.min(w - 1, x + n + 1)]);
            tmp[row + x] = v / win;
            sum += sel[row + Math.min(w - 1, x + n + 1)] - sel[row + Math.max(0, x - n)];
        }
    }
    for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -n; y <= n; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
            let v = sum;
            if (f > 0) v += f * (tmp[Math.max(0, y - n - 1) * w + x] + tmp[Math.min(h - 1, y + n + 1) * w + x]);
            sel[y * w + x] = Math.round(v / win);
            sum += tmp[Math.min(h - 1, y + n + 1) * w + x] - tmp[Math.max(0, y - n) * w + x];
        }
    }
}

export function smoothSel(sel, w, h, r) {
    blurSel(sel, w, h, r);
    const k = 1 + 2 * Math.min(1, r);
    for (let p = 0; p < sel.length; p++) sel[p] = Math.max(0, Math.min(255, (sel[p] - 128) * k + 128));
}

export function contractSel(sel, w, h, r) {
    const op = r > 0 ? erodeSel : dilateSel;
    const a = Math.abs(r);
    const n = Math.floor(a),
        f = a - n;
    if (n > 0) op(sel, w, h, n);
    if (f > 1e-3) {
        const more = sel.slice();
        op(more, w, h, 1);
        for (let p = 0; p < sel.length; p++) sel[p] = Math.round(sel[p] * (1 - f) + more[p] * f);
    }
}

/* ---------------- shadow layer (from wand.js) ----------------------- */

export function shadowDarkness(d, i, bg) {
    const Lb = luminance(bg[0], bg[1], bg[2]);
    if (Lb < 8) return 0;
    const k = luminance(d[i], d[i + 1], d[i + 2]) / Lb;
    if (k >= 1) return 0;
    if (
        Math.abs(d[i] - k * bg[0]) > SHADOW_NEUTRAL_TOL ||
        Math.abs(d[i + 1] - k * bg[1]) > SHADOW_NEUTRAL_TOL ||
        Math.abs(d[i + 2] - k * bg[2]) > SHADOW_NEUTRAL_TOL
    )
        return 0;
    return Math.max(0, 1 - k - SHADOW_NOISE_FLOOR) / (1 - SHADOW_NOISE_FLOOR);
}

const transparentPct = (data, totalPx) => {
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > ALPHA_VISIBLE) opaque++;
    return Math.round((1 - opaque / totalPx) * 100);
};

/* ------------------ recipes (wand.js / chroma.js) ------------------- */

export function wandCutout(img, seeds, opts) {
    const { tolerance = 20, contract = 1, smooth = 2, feather = 1, shadow = true, shadowStrength = 100 } = opts;
    const { w, h, data: d } = img;
    const sel = new Uint8ClampedArray(w * h);
    const bgColors = [];
    for (const s of seeds) {
        const x = Math.min(w - 1, Math.max(0, Math.round(s.x)));
        const y = Math.min(h - 1, Math.max(0, Math.round(s.y)));
        const i = (y * w + x) * 4;
        bgColors.push([d[i], d[i + 1], d[i + 2]]);
        floodSelect(d, w, h, x, y, s.tolerance ?? tolerance, sel);
    }
    if (contract) contractSel(sel, w, h, contract);
    if (smooth > 0) smoothSel(sel, w, h, smooth);
    if (feather > 0) blurSel(sel, w, h, feather);

    const strength = shadowStrength / 100;
    for (let p = 0, i = 0; p < sel.length; p++, i += 4) {
        const aO = ((d[i + 3] / 255) * (255 - sel[p])) / 255; // layer 1: selection cleared
        let aS = 0;
        if (shadow && aO < 1 && bgColors.length) {
            // layer 2: anchored shadow
            let dark = 0;
            for (const bg of bgColors) {
                const v = shadowDarkness(d, i, bg);
                if (v > dark) dark = v;
            }
            aS = Math.min(1, dark * strength) * (d[i + 3] / 255) * (1 - aO);
        }
        const aF = aO + aS;
        if (aS > 0 && aF > 0) {
            // Shadow contributes as translucent BLACK (un-composited multiply).
            const f = aO / aF;
            d[i] = Math.round(d[i] * f);
            d[i + 1] = Math.round(d[i + 1] * f);
            d[i + 2] = Math.round(d[i + 2] * f);
        }
        d[i + 3] = Math.round(255 * aF);
    }
    return { w, h, data: d, transparentPct: transparentPct(d, w * h) };
}

function keyResidual(d, i, K, KK) {
    const r = d[i],
        g = d[i + 1],
        b = d[i + 2];
    let s = (r * K[0] + g * K[1] + b * K[2]) / KK;
    if (s < 0) s = 0;
    const res = Math.max(Math.abs(r - s * K[0]), Math.abs(g - s * K[1]), Math.abs(b - s * K[2]));
    return res / Math.max(CHROMA_DARK_FLOOR, Math.min(1, s));
}

function selectKey(d, w, h, K, tolerance, sel) {
    const KK = Math.max(1, K[0] * K[0] + K[1] * K[1] + K[2] * K[2]);
    const tol = Math.max(0, tolerance);
    const soft = Math.max(1, tol);
    for (let p = 0, i = 0; p < sel.length; p++, i += 4) {
        const res = keyResidual(d, i, K, KK);
        if (res <= tol) {
            sel[p] = 255;
            continue;
        }
        const frac = 1 - (res - tol) / soft;
        if (frac > 0) {
            const v = Math.round(255 * frac);
            if (v > sel[p]) sel[p] = v;
        }
    }
}

export function chromaCutout(img, seeds, opts) {
    const {
        tolerance = 20,
        contract = 1,
        smooth = 2,
        feather = 1,
        shadow = true,
        shadowStrength = 100,
        despill = 100,
        despillReach = 3,
        despillTone = 100,
    } = opts;
    const { w, h, data: d } = img;
    const sel = new Uint8ClampedArray(w * h);
    const keys = [];
    for (const s of seeds) {
        const x = Math.min(w - 1, Math.max(0, Math.round(s.x)));
        const y = Math.min(h - 1, Math.max(0, Math.round(s.y)));
        const i = (y * w + x) * 4;
        keys.push({ K: [d[i], d[i + 1], d[i + 2]], tol: s.tolerance ?? tolerance });
    }
    if (!keys.length && opts.key) keys.push({ K: hexToRgb(opts.key), tol: tolerance });
    for (const k of keys) selectKey(d, w, h, k.K, k.tol, sel);

    const selRaw = sel.slice();
    if (contract) contractSel(sel, w, h, contract);
    if (smooth > 0) smoothSel(sel, w, h, smooth);
    if (feather > 0) blurSel(sel, w, h, feather);

    // Shadow darkness is measured before despill repaints cleared pixels;
    // reference brightness = 95th percentile luma of fully-selected pixels.
    const strength = shadowStrength / 100;
    let dark = null;
    if (shadow && keys.length) {
        const hist = new Uint32Array(256);
        let selCount = 0;
        for (let p = 0, i = 0; p < w * h; p++, i += 4) {
            if (selRaw[p] >= 250) {
                hist[Math.min(255, Math.round(luminance(d[i], d[i + 1], d[i + 2])))]++;
                selCount++;
            }
        }
        let Lref = 0;
        if (selCount) {
            let acc = 0;
            for (let v = 0; v < 256; v++) {
                acc += hist[v];
                if (acc >= selCount * 0.95) {
                    Lref = v;
                    break;
                }
            }
        } else {
            for (const { K } of keys) Lref = Math.max(Lref, luminance(K[0], K[1], K[2]));
        }
        if (Lref >= 8) {
            dark = new Float32Array(w * h);
            for (let p = 0, i = 0; p < dark.length; p++, i += 4) {
                const conf = selRaw[p] / 255;
                if (!conf) continue;
                const L = luminance(d[i], d[i + 1], d[i + 2]);
                const v = Math.max(0, 1 - L / Lref - SHADOW_NOISE_FLOOR) / (1 - SHADOW_NOISE_FLOOR);
                dark[p] = v * conf;
            }
        }
    }

    // Key-dominance despill with chessboard (chamfer) distance to the cut.
    if (keys.length && despill > 0) {
        const K = [0, 1, 2].map((c) => keys.reduce((s, k) => s + k.K[c], 0) / keys.length);
        const Lk = luminance(K[0], K[1], K[2]);
        const cK = [K[0] - Lk, K[1] - Lk, K[2] - Lk];
        const [top, mid, low] = [0, 1, 2].sort((a, b) => K[b] - K[a]);
        const dual = K[top] - K[mid] < K[mid] - K[low];
        const domK = dual ? Math.min(cK[top], cK[mid]) - cK[low] : cK[top] - Math.max(cK[mid], cK[low]);
        if (domK > 20) {
            const FAR = 250;
            const dist = new Uint8Array(w * h);
            for (let p = 0; p < dist.length; p++) dist[p] = selRaw[p] >= 128 ? 0 : FAR;
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) {
                    const p = y * w + x;
                    if (!dist[p]) continue;
                    let m = dist[p];
                    if (x > 0) m = Math.min(m, dist[p - 1] + 1);
                    if (y > 0) {
                        m = Math.min(m, dist[p - w] + 1);
                        if (x > 0) m = Math.min(m, dist[p - w - 1] + 1);
                        if (x + 1 < w) m = Math.min(m, dist[p - w + 1] + 1);
                    }
                    dist[p] = m;
                }
            for (let y = h - 1; y >= 0; y--)
                for (let x = w - 1; x >= 0; x--) {
                    const p = y * w + x;
                    if (!dist[p]) continue;
                    let m = dist[p];
                    if (x + 1 < w) m = Math.min(m, dist[p + 1] + 1);
                    if (y + 1 < h) {
                        m = Math.min(m, dist[p + w] + 1);
                        if (x + 1 < w) m = Math.min(m, dist[p + w + 1] + 1);
                        if (x > 0) m = Math.min(m, dist[p + w - 1] + 1);
                    }
                    dist[p] = m;
                }
            const amt = despill / 100;
            const reach = Math.max(1, despillReach);
            const tone = (despillTone - 100) / 100;
            for (let p = 0, i = 0; p < sel.length; p++, i += 4) {
                const band = dist[p] <= 1 ? 1 : Math.max(0, 1 - (dist[p] - 1) / reach);
                const wt = Math.max(band, selRaw[p] / 255) * amt;
                if (wt <= 0) continue;
                const e = dual
                    ? Math.min(d[i + top], d[i + mid]) - d[i + low]
                    : d[i + top] - Math.max(d[i + mid], d[i + low]);
                if (e <= 0) continue;
                const m = (e / domK) * wt;
                d[i] -= m * cK[0];
                d[i + 1] -= m * cK[1];
                d[i + 2] -= m * cK[2];
                if (tone) {
                    const dL = tone * m * Lk;
                    d[i] += dL;
                    d[i + 1] += dL;
                    d[i + 2] += dL;
                }
            }
        }
    }

    for (let p = 0, i = 0; p < sel.length; p++, i += 4) {
        const aO = ((d[i + 3] / 255) * (255 - sel[p])) / 255;
        let aS = 0;
        if (dark && aO < 1) aS = Math.min(1, dark[p] * strength) * (d[i + 3] / 255) * (1 - aO);
        const aF = aO + aS;
        if (aS > 0 && aF > 0) {
            const f = aO / aF;
            d[i] = Math.round(d[i] * f);
            d[i + 1] = Math.round(d[i + 1] * f);
            d[i + 2] = Math.round(d[i + 2] * f);
        }
        d[i + 3] = Math.round(255 * aF);
    }
    return { w, h, data: d, transparentPct: transparentPct(d, w * h) };
}

/* ------------------------------ CLI --------------------------------- */
