import type { SignSpecies } from './signDesign';

function polygon(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], fill = true): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.closePath();
  if (fill) ctx.fill(); else ctx.stroke();
}

function icon(ctx: CanvasRenderingContext2D, variant: number, tube: boolean): void {
  ctx.lineWidth = tube ? 4 : 6;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (tube) {
    switch (variant % 4) {
      case 0:
        ctx.beginPath(); ctx.moveTo(20, 50); ctx.bezierCurveTo(43, 16, 76, 29, 79, 50);
        ctx.bezierCurveTo(60, 79, 33, 73, 20, 50); ctx.moveTo(20, 50); ctx.lineTo(8, 32);
        ctx.lineTo(8, 69); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(64, 45, 2, 0, Math.PI * 2); ctx.stroke(); break;
      case 1: polygon(ctx, [[58, 10], [28, 53], [49, 53], [37, 91], [77, 40], [55, 40]], false); break;
      case 2:
        ctx.beginPath(); ctx.moveTo(20, 35); ctx.lineTo(67, 35); ctx.lineTo(67, 70);
        ctx.quadraticCurveTo(44, 89, 20, 70); ctx.closePath(); ctx.moveTo(68, 43);
        ctx.bezierCurveTo(94, 35, 93, 72, 68, 63); ctx.moveTo(14, 84); ctx.lineTo(75, 84);
        ctx.moveTo(37, 27); ctx.bezierCurveTo(25, 13, 46, 18, 38, 7); ctx.stroke(); break;
      case 3:
        ctx.beginPath(); ctx.arc(50, 50, 35, -.3, Math.PI * 1.75); ctx.moveTo(13, 58);
        ctx.lineTo(87, 42); ctx.stroke(); break;
    }
    return;
  }
  switch (variant % 4) {
    case 0:
      polygon(ctx, [[13, 44], [29, 31], [40, 51], [56, 55], [78, 63], [89, 68], [89, 80], [13, 80]]);
      ctx.fillStyle = 'rgb(130,240,130)'; ctx.fillRect(13, 76, 76, 6);
      ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(39, 54); ctx.lineTo(48, 45);
      ctx.moveTo(47, 59); ctx.lineTo(56, 51); ctx.stroke(); break;
    case 1:
      ctx.beginPath(); ctx.ellipse(50, 50, 37, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(15, 54); ctx.quadraticCurveTo(24, 85, 50, 85);
      ctx.quadraticCurveTo(78, 85, 86, 54); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgb(130,240,130)'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(32 + k * 18, 39); ctx.bezierCurveTo(18 + k * 18, 26, 45 + k * 18, 20, 31 + k * 18, 9); } ctx.stroke(); break;
    case 2:
      polygon(ctx, [[40, 11], [60, 11], [60, 30], [72, 40], [72, 88], [28, 88], [28, 40], [40, 30]]);
      ctx.fillStyle = 'rgb(130,240,130)'; ctx.fillRect(29, 53, 42, 23);
      ctx.fillStyle = '#141414'; polygon(ctx, [[50, 55], [41, 67], [50, 75], [59, 67]]); break;
    case 3:
      polygon(ctx, [[19, 12], [32, 21], [29, 34], [41, 40], [70, 69], [80, 75], [76, 86], [65, 89], [56, 79], [29, 51], [19, 44], [8, 34], [9, 21], [18, 34], [28, 31]]);
      ctx.fillStyle = 'rgb(130,240,130)'; ctx.beginPath(); ctx.arc(70, 80, 5, 0, Math.PI * 2); ctx.fill(); break;
  }
}

function emblem(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.lineWidth = 6;
  if (variant % 3 === 0) { ctx.beginPath(); ctx.arc(50, 50, 40, 0, Math.PI * 2); ctx.stroke(); }
  else if (variant % 3 === 1) polygon(ctx, [[50, 6], [88, 28], [88, 72], [50, 94], [12, 72], [12, 28]], false);
  else polygon(ctx, [[7, 34], [50, 34], [50, 15], [93, 50], [50, 85], [50, 65], [7, 65]], false);
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (variant % 4 === 0) { ctx.arc(50, 50, 21, 0, Math.PI * 2); ctx.moveTo(40, 50); ctx.arc(50, 50, 10, Math.PI, Math.PI * 3); }
  else if (variant % 4 === 1) { for (let y = 33; y <= 61; y += 14) { ctx.moveTo(31, y); ctx.lineTo(50, y + 12); ctx.lineTo(69, y); } }
  else if (variant % 4 === 2) { for (let t = 0; t < 6.6; t += .12) { const r = 3 + t * 3.5; const x = 50 + Math.cos(t) * r, y = 50 + Math.sin(t) * r; if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
  else { ctx.moveTo(32, 29); ctx.lineTo(67, 71); ctx.moveTo(67, 29); ctx.lineTo(32, 71); }
  ctx.stroke();
}

function figure(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.fillStyle = 'rgb(205,255,205)';
  if (variant % 3 === 0) {
    ctx.beginPath(); ctx.ellipse(50, 31, 18, 22, -.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, 89); ctx.quadraticCurveTo(16, 61, 39, 60);
    ctx.lineTo(42, 48); ctx.lineTo(60, 49); ctx.lineTo(64, 61);
    ctx.quadraticCurveTo(90, 64, 88, 89); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; polygon(ctx, [[42, 62], [53, 72], [62, 62], [56, 89], [50, 89]]);
  } else {
    ctx.beginPath(); ctx.arc(54, 17, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgb(205,255,205)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    const dancer = variant % 3 === 2;
    ctx.beginPath(); ctx.moveTo(52, 33); ctx.lineTo(43, 59); ctx.lineTo(25, 89);
    ctx.moveTo(44, 57); ctx.lineTo(68, 69); ctx.lineTo(83, 87);
    ctx.moveTo(51, 35); ctx.lineTo(30, dancer ? 13 : 39); ctx.lineTo(14, dancer ? 7 : 60);
    ctx.moveTo(50, 35); ctx.lineTo(72, dancer ? 26 : 44); ctx.lineTo(87, dancer ? 9 : 33); ctx.stroke();
  }
}

export function drawSignArt(ctx: CanvasRenderingContext2D, species: Exclude<SignSpecies, 'glyph'>,
  x: number, y: number, width: number, height: number, variant: number): void {
  // Species cells are six slots apart. Use the slot group for distinct art.
  if (species === 'figure') variant = Math.floor(variant / 6) + (height > width ? 1 : 0);
  else if (species === 'emblem') variant = Math.floor(variant / 6) * 2 + (height > width ? 1 : 0);
  ctx.save(); ctx.translate(x, y);
  if (species === 'ticker') {
    ctx.scale(width / 100, height / 100); ctx.fillStyle = '#b8b8b8';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) {
      const seed = (col * 17 + row * 31 + variant * 13) % 11;
      if (seed < 2) continue;
      ctx.fillRect(4 + col * 6, 18 + row * 25, 1.5 + seed * .32, 5);
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    for (let col = 0; col < 2; col++) { ctx.beginPath(); ctx.moveTo(80 + col * 9, 28); ctx.lineTo(89 + col * 9, 50); ctx.lineTo(80 + col * 9, 72); ctx.stroke(); }
  } else if (height > width && (species === 'emblem' || species === 'figure')) {
    ctx.scale(width / 100, height / 100);
    ctx.fillStyle = '#dedede'; ctx.strokeStyle = '#f5f5f5';
    if (species === 'emblem') emblem(ctx, variant); else figure(ctx, variant);
  } else {
    const vertical = height > width;
    const count = species === 'figure' ? 1
      : Math.max(1, Math.min(4, Math.floor((vertical ? height / width : width / height) / 1.7)));
    const side = Math.min(vertical ? width * .9 : width / count * .88, vertical ? height / count * .88 : height * .9);
    for (let i = 0; i < count; i++) {
      ctx.save(); ctx.translate(vertical ? width * .5 - side * .5 : width * (i + .5) / count - side * .5,
        vertical ? height * (i + .5) / count - side * .5 : height * .5 - side * .5);
      ctx.scale(side / 100, side / 100); ctx.fillStyle = '#dedede'; ctx.strokeStyle = '#f5f5f5';
      if (species === 'pictogram') icon(ctx, variant + i, false);
      else if (species === 'tube') icon(ctx, variant + i, true);
      else if (species === 'emblem') emblem(ctx, variant + i);
      else figure(ctx, variant + i);
      ctx.restore();
    }
  }
  ctx.restore();
}
