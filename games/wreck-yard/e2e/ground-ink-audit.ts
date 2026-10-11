import * as THREE from 'three';
import { InkShader } from '../src/render/style/inkShader';

/** Checks ink on a flat floor and a box with the real GPU shader. */
export function auditGroundInk(gl: THREE.WebGLRenderer, width = 640, height = 400, samples = 0) {
  const previous = gl.getRenderTarget();
  const depth = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  const sceneTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType, depthTexture: depth, minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter, samples,
  });
  const output = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('white');
  const material = new THREE.MeshBasicMaterial({ color: 'white' });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  box.position.set(0, 1, -5);
  scene.add(box);
  const composite = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(InkShader.uniforms),
    vertexShader: InkShader.vertexShader,
    fragmentShader: InkShader.fragmentShader,
    depthTest: false, depthWrite: false,
  });
  const u = composite.uniforms;
  u.tDiffuse!.value = sceneTarget.texture;
  u.tDepth!.value = depth;
  u.uResolution!.value.set(width, height);
  for (const key of ['uAOStrength', 'uGrime', 'uCavityStrength', 'uEnableBloom', 'uVignette']) u[key]!.value = 0;
  for (const key of ['uSaturation', 'uContrast', 'uInkOpacity']) u[key]!.value = 1;
  u.uShadowTint!.value.set(1, 1, 1);
  u.uHighlightTint!.value.set(1, 1, 1);
  u.uEmissiveLumaCutoff!.value = 2;
  u.uInkColor!.value.set(0, 0, 0);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
  const post = new THREE.Scene();
  post.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  const cases = [];
  try {
    for (const pose of [
      { x: 0, y: 1.96, z: 8, pitch: -0.05 },
      { x: 3, y: 1.96, z: 2, pitch: -0.12 },
      { x: -4, y: 4, z: 12, pitch: -0.18 },
    ]) {
      camera.position.set(pose.x, pose.y, pose.z);
      camera.rotation.set(pose.pitch, 0, 0);
      camera.updateMatrixWorld();
      box.position.x = pose.x;
      u.uCameraNear!.value = camera.near;
      u.uCameraFar!.value = camera.far;
      u.uInverseProjection!.value.copy(camera.projectionMatrixInverse);
      u.uCameraWorld!.value.copy(camera.matrixWorld);
      for (const withBox of [false, true]) {
        box.visible = withBox;
        gl.setRenderTarget(sceneTarget);
        gl.render(scene, camera);
        const pixels = [];
        for (const ink of [0, 1]) {
          u.uEnableInk!.value = ink;
          gl.setRenderTarget(output);
          gl.render(post, postCamera);
          const data = new Uint8Array(width * height * 4);
          gl.readRenderTargetPixels(output, 0, 0, width, height, data);
          pixels.push(data);
        }
        let darkened = 0;
        let longestRow = 0;
        let outsideBox = 0;
        const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
          new THREE.Vector3(x, y, z).applyMatrix4(box.matrixWorld).project(camera))));
        const margin = Math.ceil(u.uInkWidth!.value * height / 1080) + 2;
        const bounds = {
          left: Math.min(...corners.map(p => (p.x + 1) * width / 2)) - margin,
          right: Math.max(...corners.map(p => (p.x + 1) * width / 2)) + margin,
          bottom: Math.min(...corners.map(p => (p.y + 1) * height / 2)) - margin,
          top: Math.max(...corners.map(p => (p.y + 1) * height / 2)) + margin,
        };
        for (let y = 2; y < height - 2; y++) {
          let row = 0;
          for (let x = 2; x < width - 2; x++) {
            const offset = (y * width + x) * 4;
            if (pixels[0]![offset]! - pixels[1]![offset]! > 8) {
              row++; darkened++;
              if (x < bounds.left || x > bounds.right || y < bounds.bottom || y > bounds.top) outsideBox++;
            }
          }
          longestRow = Math.max(longestRow, row);
        }
        cases.push({ pose, withBox, darkened, outsideBox, longestRow });
      }
    }
  } finally {
    gl.setRenderTarget(previous);
    sceneTarget.dispose(); depth.dispose(); output.dispose();
    floor.geometry.dispose(); box.geometry.dispose(); material.dispose();
    quad.geometry.dispose(); composite.dispose();
  }
  return { width, height, samples, cases };
}
