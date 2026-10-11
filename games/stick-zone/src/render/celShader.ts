/**
 * @file celShader.ts
 * Graphic-novel 2-band stepped cel-shading and screen-space back-face ink contours.
 */
import * as THREE from 'three';

export const UNIFIED_SHADER_CACHE_KEY = 'inkline-cel-contour-v2';
export const INK_CONTOUR_COLOR = '#151716';
export const OUTLINE_LINE_COLOR = '#494c46';
export const DEFAULT_CONTOUR_WIDTH = 1.35;

/**
 * Injects 2-band stepped diffuse lighting into a Three.js material.
 */
export function applyCelShading(material: THREE.Material): void {
  if ((material as any).__hasCelShading) return;
  (material as any).__hasCelShading = true;
  material.customProgramCacheKey = () => UNIFIED_SHADER_CACHE_KEY;
  const originalOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile(shader, renderer);
    }
    // Inject stepped 2-band diffuse lighting calculation
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      // Stepped 2-band cel shading factor
      {
        float celLuminance = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float celFactor = celLuminance > 0.1 ? 1.0 : 0.45;
        gl_FragColor = vec4(gl_FragColor.rgb * celFactor, gl_FragColor.a);
      }
      `
    );
  };
}

/**
 * Attaches or updates a screen-space back-face contour skinned mesh on a character.
 * Generalizes the unlit contour logic to explicitly apply to all figures (gunmetal #292e36,
 * threat red #ff2212, and squad colors).
 */
export function updatePaleInkContour(
  mesh: THREE.SkinnedMesh,
  baseWidth: number = DEFAULT_CONTOUR_WIDTH,
  contourColor: string = INK_CONTOUR_COLOR
): THREE.SkinnedMesh {
  let outline = mesh.children.find((child) => child.userData.inkContour) as THREE.SkinnedMesh | undefined;

  if (!outline) {
    const viewport = new THREE.Vector2(1, 1);
    const width = { value: baseWidth };
    const material = new THREE.MeshBasicMaterial({
      color: contourColor,
      side: THREE.BackSide,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.inkViewport = { value: viewport };
      shader.uniforms.inkWidth = width;
      shader.vertexShader = 'uniform vec2 inkViewport; uniform float inkWidth;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        // BackSide flips transformedNormal. Undo that flip for outward expansion.
        vec2 inkNormal = -transformedNormal.xy;
        float inkLength = length(inkNormal);
        if (inkLength > 0.0001) {
          gl_Position.xy += inkNormal / inkLength * (2.0 * inkWidth / inkViewport) * gl_Position.w;
        }
        `
      );
    };
    material.customProgramCacheKey = () => UNIFIED_SHADER_CACHE_KEY;

    outline = new THREE.SkinnedMesh(mesh.geometry, material);
    outline.name = 'avatar-ink-contour';
    outline.userData.inkContour = true;
    outline.frustumCulled = false;
    outline.bind(mesh.skeleton, mesh.bindMatrix);

    outline.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(viewport);
      width.value = baseWidth * 0.38 * renderer.getPixelRatio();
    };

    mesh.add(outline);
  }

  outline.geometry = mesh.geometry;
  if (outline.material instanceof THREE.MeshBasicMaterial) {
    outline.material.color.set(contourColor);
  }
  outline.visible = true;
  return outline;
}

export const updateInkContour = updatePaleInkContour;

/**
 * Attaches sharp edge outlines to static scene props and weapons using EdgesGeometry.
 */
export function addOutlines(
  root: THREE.Object3D,
  color: string = OUTLINE_LINE_COLOR,
  opacity: number = 0.65
): THREE.Group {
  // If outlines group already exists, return it
  const existing = root.children.find((c) => c.name === 'ink-outlines');
  if (existing instanceof THREE.Group) return existing;

  const linesGroup = new THREE.Group();
  linesGroup.name = 'ink-outlines';

  root.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      !child.userData.inkContour &&
      !(child instanceof THREE.SkinnedMesh) &&
      child.name !== 'bow-string'
    ) {
      const edges = new THREE.EdgesGeometry(child.geometry, 24);
      const lineMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      });
      const line = new THREE.LineSegments(edges, lineMaterial);
      line.userData.inkOutline = true;
      line.userData.ownedGeometry = true;
      linesGroup.add(line);
    }
  });

  root.add(linesGroup);
  return linesGroup;
}

/**
 * Deep-disposes an instance tree including geometries, materials, outlines, and skeletons.
 */
export function disposeInstance(root: THREE.Object3D): void {
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.dispose();
    }
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object instanceof THREE.SkinnedMesh && !object.userData.inkContour) {
      skeletons.add(object.skeleton);
    }
  });
  for (const skeleton of skeletons) {
    skeleton.dispose();
  }
  root.clear();
  root.removeFromParent();
}
