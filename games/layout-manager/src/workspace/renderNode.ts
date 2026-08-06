import type { ImageNode, ScaleFilter } from './types';
import { adjustmentsFilter } from './types';
import { cssFontFamily, loadFontForCanvas } from './googleFonts';

/** Shared per-node compositor — draws one workspace element (text, crop,
 * mask, paint layers, flips, rotation, adjustments) into a workspace-space
 * canvas context. Used by page export / page eyedropper (CanvasMenu) and the
 * ColorPicker eyedropper's workspace sampler, so they all see identical
 * pixels. Assumes ctx coordinates are workspace units. */
export async function drawNodeToCtx(
  ctx: CanvasRenderingContext2D,
  img: ImageNode,
  scaleFilter: ScaleFilter,
): Promise<void> {
  let srcX = 0;
  let srcY = 0;
  let srcW = img.naturalWidth;
  let srcH = img.naturalHeight;

  if (img.cropRect) {
    srcX = img.cropRect.x;
    srcY = img.cropRect.y;
    srcW = img.cropRect.w;
    srcH = img.cropRect.h;
  }

  ctx.save();
  ctx.globalAlpha = img.opacity;
  // Match on-screen CSS adjustments (brightness/contrast/saturation/hue)
  ctx.filter = adjustmentsFilter(img) ?? 'none';
  const cx = img.x + img.width / 2;
  const cy = img.y + img.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((img.rotation * Math.PI) / 180);
  if (img.flipH || img.flipV) {
    ctx.scale(img.flipH ? -1 : 1, img.flipV ? -1 : 1);
  }

  // Re-apply after save/transforms — some browsers reset this through save/restore cycles
  if (scaleFilter === 'nearest') {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  // Text nodes: draw as canvas text instead of loading an image
  if (img.nodeType === 'text') {
    const text = img.text || 'Text';
    const fontSize = img.fontSize ?? 24;
    const fontFamily = img.fontFamily ?? 'sans-serif';
    const bold = img.fontBold ? 'bold ' : '';
    const italic = img.fontItalic ? 'italic ' : '';
    // Make sure web fonts are actually loaded before drawing to canvas
    await loadFontForCanvas(fontFamily, fontSize, img.fontBold, img.fontItalic);
    ctx.font = `${italic}${bold}${fontSize}px ${cssFontFamily(fontFamily)}`;
    ctx.fillStyle = img.textColor ?? '#000000';
    ctx.textBaseline = 'top';

    const align = img.textAlign ?? 'left';
    let textX = -img.width / 2;
    if (align === 'center') textX = 0;
    else if (align === 'right') textX = img.width / 2;
    ctx.textAlign = align;

    const lines = text.split('\n');
    const lineHeight = fontSize * 1.2;
    // Match CSS rendering: 2px padding + center glyph within line-height
    const lineGap = (lineHeight - fontSize) / 2;
    let textY = -img.height / 2 + 2 + lineGap;
    for (const line of lines) {
      ctx.fillText(line, textX, textY);
      if (img.fontUnderline) {
        const metrics = ctx.measureText(line);
        let ulX = textX;
        if (align === 'center') ulX = textX - metrics.width / 2;
        else if (align === 'right') ulX = textX - metrics.width;
        ctx.fillRect(ulX, textY + fontSize, metrics.width, Math.max(1, fontSize / 16));
      }
      textY += lineHeight;
    }
    ctx.restore();
    return;
  }

  // Per-element flat bg color: drawn first so it fills any transparent regions of the layers above
  if (img.bgColor) {
    ctx.fillStyle = img.bgColor;
    ctx.fillRect(-img.width / 2, -img.height / 2, img.width, img.height);
  }

  if (img.paintCompositeUrl) {
    // Full composite already includes background, layers with blend modes, and mask
    const compositeImg = await loadImage(img.paintCompositeUrl);
    ctx.drawImage(
      compositeImg,
      srcX, srcY, srcW, srcH,
      -img.width / 2, -img.height / 2, img.width, img.height,
    );
  } else {
    const htmlImg = await loadImage(img.src);
    let drawSource: CanvasImageSource = htmlImg;

    if (img.maskDataUrl) {
      const maskImg = await loadImage(img.maskDataUrl);
      const tmp = document.createElement('canvas');
      tmp.width = img.naturalWidth;
      tmp.height = img.naturalHeight;
      const tctx = tmp.getContext('2d')!;
      if (scaleFilter === 'nearest') {
        tctx.imageSmoothingEnabled = false;
      } else {
        tctx.imageSmoothingEnabled = true;
        tctx.imageSmoothingQuality = 'high';
      }
      tctx.drawImage(htmlImg, 0, 0);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(maskImg, 0, 0);
      drawSource = tmp;
    }

    ctx.drawImage(
      drawSource,
      srcX, srcY, srcW, srcH,
      -img.width / 2, -img.height / 2, img.width, img.height,
    );

    // Draw paint underlay (below-mask layers — apply mask via destination-in)
    if (img.paintUnderlayUrl) {
      const underlayImg = await loadImage(img.paintUnderlayUrl);
      if (img.maskDataUrl) {
        const maskImg = await loadImage(img.maskDataUrl);
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth;
        tmp.height = img.naturalHeight;
        const tctx = tmp.getContext('2d')!;
        tctx.drawImage(underlayImg, 0, 0);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(maskImg, 0, 0);
        ctx.drawImage(
          tmp,
          srcX, srcY, srcW, srcH,
          -img.width / 2, -img.height / 2, img.width, img.height,
        );
      } else {
        ctx.drawImage(
          underlayImg,
          srcX, srcY, srcW, srcH,
          -img.width / 2, -img.height / 2, img.width, img.height,
        );
      }
    }

    // Draw paint overlay on top of masked image (use same crop region as source)
    if (img.paintOverlayUrl) {
      const overlayImg = await loadImage(img.paintOverlayUrl);
      ctx.drawImage(
        overlayImg,
        srcX, srcY, srcW, srcH,
        -img.width / 2, -img.height / 2, img.width, img.height,
      );
    }
  }

  ctx.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
