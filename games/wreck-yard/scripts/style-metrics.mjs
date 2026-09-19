import fs from 'node:fs';
import { PNG } from 'pngjs';

/**
 * Computes lighting and color distribution metrics for a PNG image.
 * Evaluates median luma, dark fraction (<24), bright fraction (>200), ink fraction, and dominant palette.
 */
export function analyzeImageMetrics(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(fileBuffer);
  const totalPixels = png.width * png.height;

  const lumas = [];
  let darkCount24 = 0;
  let darkCount16 = 0;
  let brightCount = 0;
  let inkCount = 0;

  // Color histogram with 4-bit quantization per channel (4096 bins)
  const colorHistogram = new Map();

  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];

    // Rec. 601 luma
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumas.push(luma);

    if (luma < 24) darkCount24++;
    if (luma < 16) darkCount16++;
    if (luma > 200) brightCount++;

    // Ink threshold: within +/-10 of #14110f (R:20, G:17, B:15)
    if (Math.abs(r - 20) <= 10 && Math.abs(g - 17) <= 10 && Math.abs(b - 15) <= 10) {
      inkCount++;
    }

    // Quantize to 16 levels per channel
    const qr = Math.floor(r / 16) * 16;
    const qg = Math.floor(g / 16) * 16;
    const qb = Math.floor(b / 16) * 16;
    const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;
    colorHistogram.set(hex, (colorHistogram.get(hex) || 0) + 1);
  }

  lumas.sort((a, b) => a - b);
  const medianLuma = Math.round((lumas[Math.floor(totalPixels / 2)] || 0) * 10) / 10;

  // Extract top 12 colors
  const topColors = Array.from(colorHistogram.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([color, count]) => ({
      color,
      fraction: Math.round((count / totalPixels) * 1000) / 1000,
    }));

  return {
    width: png.width,
    height: png.height,
    totalPixels,
    medianLuma,
    darkFraction: Math.round((darkCount16 / totalPixels) * 1000) / 1000,
    darkFraction24: Math.round((darkCount24 / totalPixels) * 1000) / 1000,
    brightFraction: Math.round((brightCount / totalPixels) * 1000) / 1000,
    inkFraction: Math.round((inkCount / totalPixels) * 1000) / 1000,
    topPalette: topColors,
  };
}

if (process.argv[1]?.endsWith('style-metrics.mjs')) {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error('Usage: node scripts/style-metrics.mjs <path-to-png>');
    process.exit(1);
  }
  const result = analyzeImageMetrics(targetPath);
  console.log(
    `median luma ${result.medianLuma} ±3 and dark fraction ${result.darkFraction} ±0.02 (dark24: ${result.darkFraction24})`
  );
  console.log(JSON.stringify(result, null, 2));
}
