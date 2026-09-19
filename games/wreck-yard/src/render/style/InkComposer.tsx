import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { InkShader } from './inkShader';

export interface InkComposerProps {
  enableInk?: boolean;
}

export function InkComposer({ enableInk = false }: InkComposerProps) {
  const { gl, scene, size } = useThree();

  const dpr = gl.getPixelRatio();
  const width = Math.max(1, Math.floor(size.width * dpr));
  const height = Math.max(1, Math.floor(size.height * dpr));

  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const screenSceneRef = useRef<THREE.Scene | null>(null);
  const screenCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Initialize render target & full-screen quad
  useEffect(() => {
    try {
      const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
      depthTexture.format = THREE.DepthFormat;

      // WebGL2 multisampled render target with depth resolve
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthTexture,
        samples: 4,
      });
      renderTarget.texture.generateMipmaps = false;

      const screenScene = new THREE.Scene();
      const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // Fullscreen triangle: 3 vertices covering [-1, 1] NDC
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
      const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const mat = new THREE.ShaderMaterial({
        vertexShader: InkShader.vertexShader,
        fragmentShader: InkShader.fragmentShader,
        uniforms: THREE.UniformsUtils.clone(InkShader.uniforms),
        depthTest: false,
        depthWrite: false,
      });

      mat.uniforms.tDiffuse.value = renderTarget.texture;
      mat.uniforms.tDepth.value = depthTexture;

      const mesh = new THREE.Mesh(geom, mat);
      screenScene.add(mesh);

      rtRef.current = renderTarget;
      screenSceneRef.current = screenScene;
      screenCameraRef.current = screenCamera;
      materialRef.current = mat;

      return () => {
        renderTarget.dispose();
        depthTexture.dispose();
        geom.dispose();
        mat.dispose();
        rtRef.current = null;
        screenSceneRef.current = null;
        screenCameraRef.current = null;
        materialRef.current = null;
      };
    } catch (err) {
      throw new Error(`InkComposer: Failed to create WebGL render target or depth texture: ${String(err)}`);
    }
  }, [width, height]);

  // Update uniforms and render loop (priority 1 takes over R3F default render)
  useFrame(({ gl, camera }) => {
    const rt = rtRef.current;
    const screenScene = screenSceneRef.current;
    const screenCamera = screenCameraRef.current;
    const mat = materialRef.current;

    if (!rt || !screenScene || !screenCamera || !mat) return;

    // Update camera and resolution uniforms
    mat.uniforms.uResolution.value.set(width, height);
    mat.uniforms.uCameraNear.value = (camera as THREE.PerspectiveCamera).near || 0.1;
    mat.uniforms.uCameraFar.value = (camera as THREE.PerspectiveCamera).far || 100.0;
    mat.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    mat.uniforms.uEnableInk.value = enableInk ? 1.0 : 0.0;

    // Render 3D scene into offscreen render target
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, camera);

    // Blit to screen with ink lines and display sRGB conversion
    gl.setRenderTarget(null);
    gl.render(screenScene, screenCamera);
  }, 1);

  return null;
}
