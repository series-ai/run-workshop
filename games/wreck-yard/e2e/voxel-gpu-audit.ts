import * as THREE from 'three';
import { buildMacroOccupancyVolume } from 'voxel-kit';

type Dims = { x: number; y: number; z: number };

/** Compare accelerated traversal with full traversal through the same shader. */
export function auditVoxelTraversal(gl: THREE.WebGLRenderer, liveScene: THREE.Scene) {
  let source: THREE.RawShaderMaterial | undefined;
  liveScene.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.RawShaderMaterial && object.material.uniforms.uVoxels) {
      source ??= object.material;
    }
  });
  if (!source) throw new Error('Start a match before the voxel audit.');

  const previousTarget = gl.getRenderTarget();
  const previousColor = gl.getClearColor(new THREE.Color());
  const previousAlpha = gl.getClearAlpha();
  const target = new THREE.WebGLRenderTarget(96, 96);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = source.clone();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
  const accelerated = new Uint8Array(96 * 96 * 4);
  const reference = new Uint8Array(accelerated.length);
  const results: { name: string; differingPixels: number; maxChannelError: number; coveredPixels: number }[] = [];

  const volumeTexture = (data: Uint8Array<ArrayBuffer>, dims: Dims) => {
    const texture = new THREE.Data3DTexture(data, dims.x, dims.y, dims.z);
    texture.format = THREE.RedFormat;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  };
  const cases = [
    { name: 'partial macro cells', dims: { x: 6, y: 5, z: 7 }, eye: [2, 0.3, 0.4], filled: (x: number, y: number, z: number) => x === 3 && y >= 1 && z >= 1 && z <= 5 },
    { name: 'normals after empty macro cells', dims: { x: 12, y: 12, z: 12 }, eye: [2, 1.5, 2.2], filled: (x: number, y: number, z: number) => (x < 5 && y < 7 && z < 5) || (x === 8 && y < 3 && z < 7) },
    { name: 'camera inside a sparse cabin', dims: { x: 26, y: 18, z: 38 }, eye: [0, 0.15, 0.1], filled: (x: number, y: number, z: number) => y < 2 || y >= 16 || (z < 3 && x >= 10 && x <= 15 && y >= 5 && y <= 13) || ((x < 3 || x > 22) && (z < 5 || z > 32)) },
  ];

  try {
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(target);
    material.uniforms.uHasWorldOcc.value = 0;
    for (const fixture of cases) {
      const { dims } = fixture;
      const voxels = new Uint8Array(dims.x * dims.y * dims.z);
      for (let z = 0; z < dims.z; z++) for (let y = 0; y < dims.y; y++) for (let x = 0; x < dims.x; x++) {
        if (fixture.filled(x, y, z)) voxels[x + y * dims.x + z * dims.x * dims.y] = 3;
      }
      const macro = buildMacroOccupancyVolume(voxels, dims, 4);
      const voxTex = volumeTexture(voxels, dims);
      const macroTex = volumeTexture(new Uint8Array(macro.data), macro.dims);
      const fullTex = volumeTexture(new Uint8Array(macro.data.length).fill(255), macro.dims);
      try {
        material.uniforms.uVoxels.value = voxTex;
        material.uniforms.uDims.value.set(dims.x, dims.y, dims.z);
        material.uniforms.uMacroCellSize.value = 4;
        camera.position.set(fixture.eye[0], fixture.eye[1], fixture.eye[2]);
        camera.lookAt(0, 0, -0.3);
        material.uniforms.uMacroOcc.value = macroTex;
        gl.clear();
        gl.render(scene, camera);
        gl.readRenderTargetPixels(target, 0, 0, 96, 96, accelerated);
        material.uniforms.uMacroOcc.value = fullTex;
        gl.clear();
        gl.render(scene, camera);
        gl.readRenderTargetPixels(target, 0, 0, 96, 96, reference);
        let differingPixels = 0;
        let maxChannelError = 0;
        let coveredPixels = 0;
        for (let i = 0; i < reference.length; i += 4) {
          if (reference[i + 3]) coveredPixels++;
          let error = 0;
          for (let channel = 0; channel < 4; channel++) error = Math.max(error, Math.abs(accelerated[i + channel] - reference[i + channel]));
          if (error > 2) differingPixels++;
          maxChannelError = Math.max(maxChannelError, error);
        }
        results.push({ name: fixture.name, differingPixels, maxChannelError, coveredPixels });
      } finally {
        voxTex.dispose();
        macroTex.dispose();
        fullTex.dispose();
      }
    }
    return results;
  } finally {
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(previousColor, previousAlpha);
    geometry.dispose();
    material.dispose();
    target.dispose();
  }
}
