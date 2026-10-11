import {
  createThreePortalStencilHooks3D,
  portalExitClipPlane3D,
  renderPortalViews3D,
  type PortalPlane4,
  type PortalRenderEndName,
  type PortalStencilHooks3D,
  type PortalStencilRenderOptions3D,
} from '@series-inc/rundot-syncplay/physics/3d';
import * as THREE from 'three';
import { RETURNS_PAIR } from '../sim/returns';

export const PORTAL_SURFACE_LAYER = 31;
export const PORTAL_VIEW_CLIP_UNIFORMS = 'portalViewClipUniforms';

export interface PortalViewClipUniforms {
  readonly enabled: THREE.IUniform<number>;
  readonly plane: THREE.IUniform<THREE.Vector4>;
}

export interface ReturnsPortalSurfaces {
  get(pairId: number, end: PortalRenderEndName): THREE.Mesh;
  dispose(): void;
}

function makeSurface(endName: PortalRenderEndName): THREE.Mesh {
  const end = endName === 'A' ? RETURNS_PAIR.portalA : RETURNS_PAIR.portalB;
  const geometry = new THREE.PlaneGeometry(end.opening.width, end.opening.height);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
  const surface = new THREE.Mesh(geometry, material);
  surface.name = `returns-portal-surface-${endName.toLowerCase()}`;
  surface.layers.set(PORTAL_SURFACE_LAYER);
  surface.frustumCulled = false;
  surface.position.set(end.position.x, end.position.y, end.position.z);
  surface.quaternion.set(end.rotation.x, end.rotation.y, end.rotation.z, end.rotation.w);
  surface.updateMatrix();
  surface.updateMatrixWorld(true);
  return surface;
}

export function createReturnsPortalSurfaces(): ReturnsPortalSurfaces {
  const surfaces = new Map<PortalRenderEndName, THREE.Mesh>([
    ['A', makeSurface('A')],
    ['B', makeSurface('B')],
  ]);
  return {
    get(pairId, end) {
      if (pairId !== RETURNS_PAIR.id) throw new Error(`WRECK_YARD_UNKNOWN_PORTAL_PAIR:${pairId}`);
      const surface = surfaces.get(end);
      if (!surface) throw new Error(`WRECK_YARD_UNKNOWN_PORTAL_END:${end}`);
      return surface;
    },
    dispose() {
      for (const surface of surfaces.values()) {
        surface.geometry.dispose();
        const material = surface.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
      surfaces.clear();
    },
  };
}

export function markPortalViewClipMaterial(
  material: THREE.Material,
  uniforms: PortalViewClipUniforms,
): void {
  material.userData[PORTAL_VIEW_CLIP_UNIFORMS] = uniforms;
}

export function setPortalViewClipOnScene(scene: THREE.Scene, plane: PortalPlane4 | null): void {
  scene.traverse((object) => {
    const materialValue = (object as THREE.Mesh).material;
    if (!materialValue) return;
    const materials = Array.isArray(materialValue) ? materialValue : [materialValue];
    for (const material of materials) {
      const uniforms = material.userData[PORTAL_VIEW_CLIP_UNIFORMS] as PortalViewClipUniforms | undefined;
      if (!uniforms) continue;
      const enabled = plane ? 1 : 0;
      const vector = uniforms.plane.value as THREE.Vector4;
      let changed = uniforms.enabled.value !== enabled;
      uniforms.enabled.value = enabled;
      if (plane) {
        changed ||= vector.x !== plane[0] || vector.y !== plane[1] || vector.z !== plane[2] || vector.w !== plane[3];
        vector.set(plane[0], plane[1], plane[2], plane[3]);
      }
      if (changed && material instanceof THREE.ShaderMaterial) material.uniformsNeedUpdate = true;
    }
  });
}

function setPortalViewObjects(scene: THREE.Scene, inPortalView: boolean): () => void {
  const changed: { object: THREE.Object3D; visible: boolean }[] = [];
  if (!inPortalView) return () => {};
  scene.traverse((object) => {
    if (object.userData.portalViewHidden === true || object.userData.portalLocalAvatar === true) {
      changed.push({ object, visible: object.visible });
      object.visible = object.userData.portalLocalAvatar === true;
    }
  });
  return () => {
    for (const entry of changed) entry.object.visible = entry.visible;
  };
}

function asThreePlane(plane: PortalPlane4): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(plane[0], plane[1], plane[2]), plane[3]);
}

export function createReturnsPortalHooks({
  renderer,
  scene,
  camera,
  eyeCamera,
  surfaces,
}: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** A separate camera. The SDK overwrites its matrices for each view. */
  camera: THREE.PerspectiveCamera;
  eyeCamera: THREE.Camera;
  surfaces: ReturnsPortalSurfaces;
}): PortalStencilHooks3D {
  const base = createThreePortalStencilHooks3D({
    renderer,
    scene,
    camera,
    portalSurface: (pairId, end) => surfaces.get(pairId, end),
  });
  const portalLayerMask = 1 << PORTAL_SURFACE_LAYER;
  const portalFrustum = new THREE.Frustum();
  const crop = new THREE.Matrix4();
  const projection = new THREE.Matrix4();
  const inverseView = new THREE.Matrix4();

  function cullPortalMeshes(draw: Parameters<PortalStencilHooks3D['drawScene']>[0]): () => void {
    const rect = draw.view?.screenRect;
    if (!rect) return () => {};
    const width = rect.maxX - rect.minX;
    const height = rect.maxY - rect.minY;
    if (width <= 0 || height <= 0) return () => {};
    crop.set(
      2 / width, 0, 0, -(rect.maxX + rect.minX) / width,
      0, 2 / height, 0, -(rect.maxY + rect.minY) / height,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    projection.fromArray(draw.projection);
    inverseView.fromArray(draw.cameraWorldMatrix).invert();
    portalFrustum.setFromProjectionMatrix(crop.multiply(projection).multiply(inverseView));
    scene.updateMatrixWorld(true);
    const hidden: THREE.Mesh[] = [];
    scene.traverseVisible((object) => {
      // These bounds are current for rigid leaf meshes. Keep deforming and instanced meshes.
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh
        || object instanceof THREE.SkinnedMesh || object.children.length !== 0) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Water and effects can move vertices outside their geometry bounds.
      if (materials.some((material) => material instanceof THREE.ShaderMaterial
        && !(material instanceof THREE.RawShaderMaterial))) return;
      if (!portalFrustum.intersectsObject(object)) {
        hidden.push(object);
        object.visible = false;
      }
    });
    return () => { for (const mesh of hidden) mesh.visible = true; };
  }

  return {
    clear() {
      base.clear();
    },
    drawPortalSurface(draw) {
      const oldLayers = camera.layers.mask;
      camera.layers.mask = portalLayerMask;
      try {
        base.drawPortalSurface(draw);
      } finally {
        camera.layers.mask = oldLayers;
      }
    },
    drawScene(draw) {
      const oldLayers = camera.layers.mask;
      const oldClippingPlanes = renderer.clippingPlanes;
      const oldLocalClippingEnabled = renderer.localClippingEnabled;
      const viewPlane = draw.view?.clipPlane ?? null;
      const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
      let restoreVisibility = () => {};
      let restoreCulling = () => {};
      try {
        restoreVisibility = setPortalViewObjects(scene, draw.view !== undefined);
        if (draw.view) {
          renderer.shadowMap.autoUpdate = false;
          renderer.shadowMap.needsUpdate = false;
          restoreCulling = cullPortalMeshes(draw);
        }
        camera.layers.mask = eyeCamera.layers.mask;
        renderer.localClippingEnabled = true;
        renderer.clippingPlanes = viewPlane ? [asThreePlane(viewPlane)] : [];
        setPortalViewClipOnScene(scene, viewPlane);
        base.drawScene(draw);
      } finally {
        setPortalViewClipOnScene(scene, null);
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
        restoreCulling();
        restoreVisibility();
        renderer.clippingPlanes = oldClippingPlanes;
        renderer.localClippingEnabled = oldLocalClippingEnabled;
        camera.layers.mask = oldLayers;
      }
    },
  };
}

export function renderReturnsPortalViews({
  renderer,
  scene,
  eyeCamera,
  hooks,
}: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  eyeCamera: THREE.Camera;
  hooks: PortalStencilHooks3D;
}) {
  eyeCamera.updateWorldMatrix(true, false);
  const options: PortalStencilRenderOptions3D = {
    cameraWorldMatrix: eyeCamera.matrixWorld.elements,
    projection: eyeCamera.projectionMatrix.elements,
    pairs: [RETURNS_PAIR],
    maxDepth: 2,
    maxViews: 4,
    screenClip: true,
    hooks,
  };

  const previousAutoClear = renderer.autoClear;
  const previousTarget = renderer.getRenderTarget();
  const previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  const previousViewport = renderer.getViewport(new THREE.Vector4());
  const previousClippingPlanes = renderer.clippingPlanes;
  const previousLocalClippingEnabled = renderer.localClippingEnabled;
  try {
    return renderPortalViews3D(options);
  } finally {
    setPortalViewClipOnScene(scene, null);
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.clippingPlanes = previousClippingPlanes;
    renderer.localClippingEnabled = previousLocalClippingEnabled;
    renderer.autoClear = previousAutoClear;
  }
}

export function portalEndClipPlane(end: PortalRenderEndName): PortalPlane4 {
  // The SDK returns the linked exit plane. Ask from the opposite end to get
  // the plane at this end, with its normal facing the aperture front.
  return portalExitClipPlane3D(RETURNS_PAIR, end === 'A' ? 'B' : 'A');
}
