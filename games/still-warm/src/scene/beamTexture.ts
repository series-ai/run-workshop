import { DataTexture, RGBAFormat, SRGBColorSpace } from "three";

export function createBeamTexture(): DataTexture {
  const width = 512;
  const height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const warped =
        y + Math.sin(x * 0.013) * 2 + Math.sin(x * 0.035 + y * 0.08);
      const grain = Math.sin(warped * 2.7 + Math.sin(x * 0.027)) * 9;
      const fibers = Math.sin(warped * 9.2 + x * 0.018) * 5;
      const pores =
        Math.sin(x * 21.7 + y * 15.3) * Math.sin(x * 3.1 - y * 7.9) * 5;
      const split = Math.pow(Math.max(0, Math.sin(warped * 0.47)), 24) * 34;
      const shade = grain + fibers + pores - split;
      const index = (y * width + x) * 4;
      pixels[index] = 120 + shade;
      pixels[index + 1] = 102 + shade;
      pixels[index + 2] = 76 + shade;
      pixels[index + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
