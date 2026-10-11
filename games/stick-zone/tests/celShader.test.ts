import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyCelShading,
  updatePaleInkContour,
  updateXraySilhouette,
  addOutlines,
  disposeInstance,
  UNIFIED_SHADER_CACHE_KEY,
  INK_CONTOUR_COLOR,
  OUTLINE_LINE_COLOR,
  DEFAULT_CONTOUR_WIDTH,
} from '../src/render/celShader.js';

describe('celShader', () => {
  describe('applyCelShading', () => {
    it('sets the unified shader program cache key', () => {
      const mat = new THREE.MeshStandardMaterial({ color: '#292e36' });
      applyCelShading(mat);
      expect(mat.customProgramCacheKey()).toBe(UNIFIED_SHADER_CACHE_KEY);
      expect(mat.customProgramCacheKey()).toBe('inkline-cel-contour-v2');
    });

    it('injects 2-band stepped diffuse shading logic in onBeforeCompile', () => {
      const mat = new THREE.MeshStandardMaterial({ color: '#292e36' });
      applyCelShading(mat);

      const shader = {
        vertexShader: '#include <project_vertex>',
        fragmentShader: '#include <dithering_fragment>',
        uniforms: {},
      };

      mat.onBeforeCompile(shader as any, {} as any);
      expect(shader.fragmentShader).toContain('celLuminance > 0.1 ? 1.0 : 0.45');
    });
  });

  describe('updatePaleInkContour', () => {
    function createMockSkinnedMesh(color = '#292e36'): THREE.SkinnedMesh {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const bone = new THREE.Bone();
      const skeleton = new THREE.Skeleton([bone]);
      const material = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(skeleton);
      return mesh;
    }

    it('attaches a screen-space back-face contour skinned mesh', () => {
      const mesh = createMockSkinnedMesh('#292e36');
      const outline = updatePaleInkContour(mesh, DEFAULT_CONTOUR_WIDTH);

      expect(outline).toBeDefined();
      expect(outline.name).toBe('avatar-ink-contour');
      expect(outline.userData.inkContour).toBe(true);
      expect(outline.skeleton).toBe(mesh.skeleton);
      expect(mesh.children).toContain(outline);

      const mat = outline.material as THREE.MeshBasicMaterial;
      expect(mat.side).toBe(THREE.BackSide);
      expect('#' + mat.color.getHexString()).toBe(INK_CONTOUR_COLOR.toLowerCase());
      expect(mat.customProgramCacheKey()).toBe('inkline-cel-contour-v2');
    });

    it('injects inkViewport and inkWidth uniforms and extrusion logic', () => {
      const mesh = createMockSkinnedMesh('#ff2212');
      const outline = updatePaleInkContour(mesh, 1.35);
      const mat = outline.material as THREE.MeshBasicMaterial;

      const shader = {
        vertexShader: '#include <project_vertex>',
        fragmentShader: '#include <color_fragment>',
        uniforms: {} as Record<string, { value: any }>,
      };

      mat.onBeforeCompile(shader as any, {} as any);
      expect(shader.uniforms.inkViewport).toBeDefined();
      expect(shader.uniforms.inkWidth).toBeDefined();
      expect(shader.uniforms.inkWidth.value).toBe(1.35);
      expect(shader.vertexShader).toContain('uniform vec2 inkViewport;');
      expect(shader.vertexShader).toContain('uniform float inkWidth;');
      expect(shader.vertexShader).toContain('gl_Position.xy += inkNormal / inkLength * (2.0 * inkWidth / inkViewport) * gl_Position.w;');
    });

    it('is idempotent on repeated calls and preserves outline instance', () => {
      const mesh = createMockSkinnedMesh('#292e36');
      const outline1 = updatePaleInkContour(mesh);
      const outline2 = updatePaleInkContour(mesh);

      expect(outline1).toBe(outline2);
      expect(mesh.children.filter((c) => c.userData.inkContour).length).toBe(1);
    });
  });

  describe('updateXraySilhouette', () => {
    function createMockSkinnedMesh(color = '#292e36'): THREE.SkinnedMesh {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const bone = new THREE.Bone();
      const skeleton = new THREE.Skeleton([bone]);
      const material = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(skeleton);
      return mesh;
    }

    it('attaches an X-Ray occluded silhouette skinned mesh with GreaterDepth', () => {
      const mesh = createMockSkinnedMesh();
      const xray = updateXraySilhouette(mesh, '#ef4444');

      expect(xray).toBeDefined();
      expect(xray.name).toBe('avatar-xray-silhouette');
      expect(xray.userData.xraySilhouette).toBe(true);
      expect(xray.skeleton).toBe(mesh.skeleton);
      expect(mesh.children).toContain(xray);

      const mat = xray.material as THREE.MeshBasicMaterial;
      expect(mat.depthFunc).toBe(THREE.GreaterDepth);
      expect(mat.depthWrite).toBe(false);
      expect(mat.transparent).toBe(true);
      expect('#' + mat.color.getHexString()).toBe('#ef4444');
    });

    it('is idempotent on repeated calls and updates silhouette color', () => {
      const mesh = createMockSkinnedMesh();
      const xray1 = updateXraySilhouette(mesh, '#38bdf8');
      const xray2 = updateXraySilhouette(mesh, '#ef4444');

      expect(xray1).toBe(xray2);
      expect(mesh.children.filter((c) => c.userData.xraySilhouette).length).toBe(1);
      const mat = xray2.material as THREE.MeshBasicMaterial;
      expect('#' + mat.color.getHexString()).toBe('#ef4444');
    });
  });

  describe('addOutlines', () => {
    it('attaches sharp edge outlines to static meshes', () => {
      const group = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
      group.add(box);

      const outlines = addOutlines(group, OUTLINE_LINE_COLOR, 0.65);
      expect(outlines.name).toBe('ink-outlines');
      expect(group.children).toContain(outlines);
      expect(outlines.children.length).toBe(1);

      const line = outlines.children[0] as THREE.LineSegments;
      expect(line.userData.inkOutline).toBe(true);
      const mat = line.material as THREE.LineBasicMaterial;
      expect('#' + mat.color.getHexString()).toBe(OUTLINE_LINE_COLOR.toLowerCase());
      expect(mat.opacity).toBe(0.65);
    });

    it('does not attach outlines to skinned meshes or existing contours', () => {
      const group = new THREE.Group();
      const bone = new THREE.Bone();
      const skeleton = new THREE.Skeleton([bone]);
      const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      skinned.bind(skeleton);
      group.add(skinned);

      const outlines = addOutlines(group);
      expect(outlines.children.length).toBe(0);
    });
  });

  describe('disposeInstance', () => {
    it('disposes geometries, materials, and skeletons cleanly', () => {
      const parent = new THREE.Group();
      const bone = new THREE.Bone();
      const skeleton = new THREE.Skeleton([bone]);
      const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
      mesh.bind(skeleton);
      parent.add(mesh);

      let geomDisposed = false;
      let matDisposed = false;
      let skelDisposed = false;

      mesh.geometry.addEventListener('dispose', () => { geomDisposed = true; });
      mesh.material.addEventListener('dispose', () => { matDisposed = true; });
      skeleton.dispose = () => { skelDisposed = true; };

      disposeInstance(parent);
      expect(geomDisposed).toBe(true);
      expect(matDisposed).toBe(true);
      expect(skelDisposed).toBe(true);
      expect(parent.children.length).toBe(0);
    });
  });
});
