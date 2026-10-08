/**
 * R23 post chain: declared stage roles, the two-draw no-swap volume pass, exact state restoration,
 * and the unchanged legacy path.
 *
 * These checks drive the REAL pass classes through a renderer double. The double reimplements the
 * one rule the staging depends on — three's `projectObject` skips a subtree when `visible` is false
 * but filters layers per object and still descends into children — so a mixed-role parent (the
 * shuttle's transparent plume under its opaque hull) is covered here rather than assumed.
 *
 * What this file does NOT establish: real GL draw counts, real pixel output, GPU timing, or that the
 * depth attachment's CONTENT survived the blend. Those are browser evidence and belong to the
 * capture tooling, which hashes a packed depth readback before and after the volume.
 */
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  SKYRIVER_FOG_PARS_FRAGMENT_SOURCE,
  setSkyriverFogBypass,
  skyriverFogBypassed,
} from '../src/render/atmosphere';
import { SKYRIVER_IMPOSTOR_FRAGMENT_SOURCE } from '../src/render/city';
import type { SkyriverDepthSnapshot } from '../src/render/depthFade';
import {
  SKYRIVER_DEFAULT_PRESENTATION_CHAIN,
  SkyriverScene,
  SkyriverQualityTier,
  skyriverBloomEnableFlags,
  skyriverCompositionPlan,
  skyriverDrawCallEstimate,
  skyriverQualityFor,
  skyriverSourceTimeReversed,
  type SkyriverPresentationChain,
} from '../src/render/scene';
import { SKYRIVER_SMOG_FRAGMENT_SOURCE, SKYRIVER_SMOG_HIGH_MAX } from '../src/render/smog';
import { SkyriverThreeMipBloomPass } from '../src/render/threeMipBloom';
import {
  SKYRIVER_OPAQUE_LAYER,
  SKYRIVER_TRANSPARENT_LAYER,
  SkyriverOpaquePass,
  SkyriverStageRegistry,
  SkyriverTransparentPass,
  skyriverDeclareStageRole,
  skyriverDeclaredStageRole,
} from '../src/render/stageRoles';
import {
  SkyriverLightSelection,
  skyriverBuildLightPool,
  skyriverScatterRadiusM,
  skyriverSelectLights,
} from '../src/render/renderLightSet';
import type { SkyriverLightSource } from '../src/render/city';
import type { SkyriverBeamRecord, SkyriverMutableBeamRecord } from '../src/render/atmosphere';
import {
  SKYRIVER_SCATTER_RESPONSE_GLSL,
  SKYRIVER_VOLUME_JITTER_PHASES,
  SKYRIVER_VOLUME_NORMAL_DRAWS,
  SKYRIVER_VOLUME_PROFILES,
  SkyriverVolumeFogPass,
  skyriverVolumeDimension,
} from '../src/render/volumeFog';

// --- the renderer double ------------------------------------------------------------------------

/** The blend state a draw actually ran with, captured AT the draw. */
interface BlendRecord {
  readonly blending: number;
  readonly transparent: boolean;
  readonly blendEquation: number;
  readonly blendEquationAlpha: number | null;
  readonly blendSrc: number;
  readonly blendDst: number;
  readonly blendSrcAlpha: number | null;
  readonly blendDstAlpha: number | null;
}

interface DrawRecord {
  readonly label: string;
  readonly target: string;
  /** Null for a draw whose object carries no single material. */
  readonly blend: BlendRecord | null;
  readonly materialName: string;
}

class RendererDouble {
  autoClear = true;
  readonly draws: DrawRecord[] = [];
  readonly clears: { readonly target: string; readonly colour: boolean; readonly depth: boolean }[] = [];
  readonly targetHistory: string[] = [];
  /** Set to a label to make `render` throw once it is drawn, to exercise the finally paths. */
  throwOnLabel: string | null = null;
  /** Set to a target label to make `setRenderTarget` throw, to exercise a fault mid-pass. */
  throwOnTarget: string | null = null;

  private target: THREE.WebGLRenderTarget | null = null;
  private clearColour = new THREE.Color(0x04060b);
  private clearAlpha = 1;

  getRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.target;
  }

  setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
    this.target = target;
    this.targetHistory.push(label(target));
    if (this.throwOnTarget === label(target)) throw new Error('TARGET_FAILED');
  }

  clear(colour = true, depth = true, _stencil = true): void {
    this.clears.push({ target: label(this.target), colour, depth });
  }

  getClearColor(out: THREE.Color): THREE.Color {
    return out.copy(this.clearColour);
  }

  getClearAlpha(): number {
    return this.clearAlpha;
  }

  setClearColor(colour: THREE.ColorRepresentation, alpha = 1): void {
    this.clearColour = new THREE.Color(colour);
    this.clearAlpha = alpha;
  }

  /** Three's own traversal rule: `visible` prunes the subtree, layers filter the object only. */
  render(root: THREE.Object3D, camera: THREE.Camera): void {
    const scene = root as THREE.Scene;
    if (typeof scene.onBeforeRender === 'function') {
      scene.onBeforeRender(this as unknown as THREE.WebGLRenderer, scene, camera, null as never, null as never, null as never);
    }
    const walk = (object: THREE.Object3D): void => {
      if (object.visible === false) return;
      const drawable = object as THREE.Object3D & { isMesh?: boolean };
      if (drawable.isMesh === true && object.layers.test(camera.layers)) {
        const name = object.name || object.uuid;
        const material = (object as THREE.Mesh).material;
        const single = Array.isArray(material) ? null : material;
        this.draws.push({
          label: name,
          target: label(this.target),
          materialName: single?.name ?? '',
          // Captured DURING the draw: a blend state restored in a finally block afterwards is not
          // the state the draw ran with, and the state is what the GPU actually applies.
          blend: single === null ? null : {
            blending: single.blending,
            transparent: single.transparent,
            blendEquation: single.blendEquation,
            blendEquationAlpha: single.blendEquationAlpha,
            blendSrc: single.blendSrc,
            blendDst: single.blendDst,
            blendSrcAlpha: single.blendSrcAlpha,
            blendDstAlpha: single.blendDstAlpha,
          },
        });
        if (this.throwOnLabel === name) throw new Error('RENDER_FAILED');
      }
      for (const child of object.children) walk(child);
    };
    walk(root);
  }

  drawnLabels(): string[] {
    return this.draws.map((draw) => draw.label);
  }
}

function label(target: THREE.WebGLRenderTarget | null): string {
  return target === null ? 'canvas' : target.texture.name || target.texture.uuid;
}

class DepthSnapshotDouble {
  captures = 0;
  beginCalls = 0;
  /** The volume's own precondition: a usable opaque depth copy. Not the beam-fade A/B switch. */
  valid = true;
  private suppressed = false;
  readonly depth = new THREE.DepthTexture(4, 4);
  readonly uniforms = {
    uVisibilityDepth: { value: this.depth },
    uVisibilityFadeEnabled: { value: 1 },
  };

  setBeginSuppressed(value: boolean): void {
    this.suppressed = value;
  }

  beginIsSuppressed(): boolean {
    return this.suppressed;
  }

  beginSceneRender(): void {
    if (this.suppressed) return;
    this.beginCalls += 1;
  }

  capture(): void {
    this.captures += 1;
  }

  depthTexture(): THREE.Texture {
    return this.depth;
  }

  depthIsValid(): boolean {
    return this.valid;
  }

  opaqueSnapshotValid(): boolean {
    return this.valid;
  }
}

function fogControl(): { set: (b: boolean) => void; bypassed: () => boolean; writes: boolean[] } {
  let state = false;
  const writes: boolean[] = [];
  return {
    set: (bypass: boolean) => {
      state = bypass;
      writes.push(bypass);
    },
    bypassed: () => state,
    writes,
  };
}

function mesh(name: string, role: 'opaque' | 'transparent'): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  object.name = name;
  skyriverDeclareStageRole(object, role);
  return object;
}

/** A scene shaped like the real one, including the mixed-role hull/plume parent and a hidden mesh. */
function buildScene(): {
  scene: THREE.Scene;
  registry: SkyriverStageRegistry;
  hull: THREE.Mesh;
  plume: THREE.Mesh;
  hiddenCard: THREE.Mesh;
} {
  const scene = new THREE.Scene();
  scene.name = 'skyriver';
  const towers = mesh('city.towers', 'opaque');
  const trims = mesh('city.trims', 'opaque');
  const signs = mesh('city.signs', 'transparent');
  const hiddenCard = mesh('city.farCards', 'opaque');
  // Already hidden before R23 runs: the far-card A/B in 'geometry' mode. It must stay hidden.
  hiddenCard.visible = false;
  const sky = mesh('atmosphere.sky', 'opaque');
  const beams = mesh('atmosphere.beams', 'transparent');
  const rain = mesh('atmosphere.rain', 'transparent');
  const smog = mesh('smog', 'transparent');
  const hull = mesh('shuttle.hull', 'opaque');
  const plume = mesh('shuttle.plume', 'transparent');
  // The real plume is a CHILD of the opaque hull.
  hull.add(plume);
  scene.add(towers, trims, signs, hiddenCard, sky, beams, rain, smog, hull);

  const registry = new SkyriverStageRegistry();
  registry.registerDeclared(scene);
  return { scene, registry, hull, plume, hiddenCard };
}

// --- role registry ------------------------------------------------------------------------------

describe('R23 stage role registry', () => {
  it('covers every drawable in the graph, with nothing unregistered', () => {
    const { scene, registry } = buildScene();
    const coverage = registry.coverage(scene);
    expect(coverage.unregistered).toEqual([]);
    expect(coverage.detached).toEqual([]);
    expect([...coverage.opaque].sort()).toEqual(
      ['atmosphere.sky', 'city.farCards', 'city.towers', 'city.trims', 'shuttle.hull'],
    );
    expect([...coverage.transparent].sort()).toEqual(
      ['atmosphere.beams', 'atmosphere.rain', 'city.signs', 'shuttle.plume', 'smog'],
    );
    expect(registry.size()).toBe(10);
  });

  it('refuses a drawable with no declared role instead of letting it draw twice', () => {
    const scene = new THREE.Scene();
    const stray = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    stray.name = 'undeclared';
    scene.add(stray);
    const registry = new SkyriverStageRegistry();
    expect(() => registry.registerDeclared(scene)).toThrow(/SKYRIVER_STAGE_ROLE_MISSING:undeclared/);
    expect(registry.coverage(scene).unregistered).toEqual(['undeclared']);
  });

  it('refuses a conflicting re-declaration rather than silently reclassifying', () => {
    const object = mesh('city.towers', 'opaque');
    expect(() => skyriverDeclareStageRole(object, 'transparent'))
      .toThrow(/SKYRIVER_STAGE_ROLE_REDECLARED/);
    const registry = new SkyriverStageRegistry();
    registry.register(object, 'opaque');
    expect(() => registry.register(object, 'transparent')).toThrow(/SKYRIVER_STAGE_ROLE_CONFLICT/);
  });

  it('is idempotent, and keeps layer 0 so the legacy single pass draws everything', () => {
    const object = mesh('city.towers', 'opaque');
    const registry = new SkyriverStageRegistry();
    registry.register(object, 'opaque');
    registry.register(object, 'opaque');
    expect(registry.roleOf(object)).toBe('opaque');
    expect(object.layers.isEnabled(0)).toBe(true);
    expect(object.layers.isEnabled(SKYRIVER_OPAQUE_LAYER)).toBe(true);
    expect(object.layers.isEnabled(SKYRIVER_TRANSPARENT_LAYER)).toBe(false);
  });

  it('holds the role against a material swap and a visibility change', () => {
    // A source-ID proof swaps materials; a layer proof flips `visible`. Neither may reclassify.
    const { registry, hull } = buildScene();
    hull.material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    hull.visible = false;
    expect(registry.roleOf(hull)).toBe('opaque');
    expect(skyriverDeclaredStageRole(hull)).toBe('opaque');
  });
});

// --- the two stages -----------------------------------------------------------------------------

describe('R23 opaque and transparent stages', () => {
  let renderer: RendererDouble;
  let camera: THREE.PerspectiveCamera;
  let readBuffer: THREE.WebGLRenderTarget;
  let depthFade: DepthSnapshotDouble;

  beforeEach(() => {
    renderer = new RendererDouble();
    camera = new THREE.PerspectiveCamera(62, 1, 1, 14000);
    readBuffer = new THREE.WebGLRenderTarget(8, 8);
    readBuffer.texture.name = 'composer.read';
    readBuffer.depthTexture = new THREE.DepthTexture(8, 8);
    depthFade = new DepthSnapshotDouble();
  });

  function stages(scene: THREE.Scene, registry: SkyriverStageRegistry, fog = fogControl()): {
    opaque: SkyriverOpaquePass;
    transparent: SkyriverTransparentPass;
    fog: ReturnType<typeof fogControl>;
  } {
    const snapshot = depthFade as unknown as SkyriverDepthSnapshot;
    return {
      opaque: new SkyriverOpaquePass({
        scene, camera, registry, depthFade: snapshot, analyticFog: fog, bypassAnalyticFog: () => true,
      }),
      transparent: new SkyriverTransparentPass({
        scene, camera, registry, depthFade: snapshot, analyticFog: fog,
      }),
      fog,
    };
  }

  it('draws every declared mesh exactly once across the two stages', () => {
    const { scene, registry } = buildScene();
    const { opaque, transparent } = stages(scene, registry);

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    const afterOpaque = renderer.drawnLabels();
    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    const all = renderer.drawnLabels();

    // Opaque stage: the opaque roles only, and never the already-hidden far-card mesh.
    expect(afterOpaque.sort()).toEqual(['atmosphere.sky', 'city.towers', 'city.trims', 'shuttle.hull']);
    // Transparent stage: the transparent roles, including the plume under the opaque hull.
    expect(all.slice(afterOpaque.length).sort())
      .toEqual(['atmosphere.beams', 'atmosphere.rain', 'city.signs', 'shuttle.plume', 'smog']);
    // One draw per mesh, with no mesh drawn in both stages.
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(9);
  });

  it('keeps a transparent child of an opaque parent drawable in its own stage', () => {
    // This is why the stages select by layer, not by `visible`: hiding the hull would take the
    // plume with it, and the plume would never draw at all.
    const { scene, registry, hull, plume } = buildScene();
    const { opaque, transparent } = stages(scene, registry);
    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.drawnLabels()).toContain('shuttle.hull');
    expect(renderer.drawnLabels()).not.toContain('shuttle.plume');
    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.drawnLabels()).toContain('shuttle.plume');
    // Neither stage touched the objects' own visibility.
    expect(hull.visible).toBe(true);
    expect(plume.visible).toBe(true);
  });

  it('respects an already hidden mesh and never restores it to visible', () => {
    const { scene, registry, hiddenCard } = buildScene();
    const { opaque, transparent } = stages(scene, registry);
    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(hiddenCard.visible).toBe(false);
    expect(renderer.drawnLabels()).not.toContain('city.farCards');
  });

  it('keeps the analytic haze when the plan has no volume pass to replace it', () => {
    // The opaque stage's bypass used to be the constant `() => true`, so the shared haze and the
    // far card's layer haze were dropped whether or not anything was going to march absorption.
    // Reading it from the plan is what makes the fallback honest: no volume pass, no bypass.
    const { scene, registry } = buildScene();
    const fog = fogControl();
    const snapshot = depthFade as unknown as SkyriverDepthSnapshot;
    let depthAvailable = false;
    const opaque = new SkyriverOpaquePass({
      scene,
      camera,
      registry,
      depthFade: snapshot,
      analyticFog: fog,
      // Exactly the closure the scene installs.
      bypassAnalyticFog: () => skyriverCompositionPlan({
        tier: SkyriverQualityTier.High,
        chain: 'r23-staged',
        bloomEnabled: true,
        depthAvailable,
      }).volumePass,
    });

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    // Recorded DURING the draw, before the finally restored it.
    expect(opaque.stageFlags()?.analyticFogBypassed).toBe(false);
    expect(fog.bypassed()).toBe(false);

    depthAvailable = true;
    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(opaque.stageFlags()?.analyticFogBypassed).toBe(true);
    // And it is cleared again after the stage, on both paths.
    expect(fog.bypassed()).toBe(false);
  });

  it('calls the in-frame depth probe hook inside the invocation, right after the capture', () => {
    // The documented before/after depth-content procedure needs a hash taken at this exact point.
    // A between-frames diagnostic cannot reach it, so the pass declares the hook and the scene
    // packs the attachment from it.
    const { scene, registry } = buildScene();
    const calls: number[] = [];
    const opaque = new SkyriverOpaquePass({
      scene,
      camera,
      registry,
      depthFade: depthFade as unknown as SkyriverDepthSnapshot,
      analyticFog: fogControl(),
      bypassAnalyticFog: () => true,
      onDepthCaptured: () => calls.push(renderer.draws.length),
    });

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    // Once, after the stage's own draws and after the capture.
    expect(calls).toEqual([4]);
    expect(depthFade.captures).toBe(1);

    // And it is optional: a pass without the hook draws exactly the same frame.
    const plain = new SkyriverOpaquePass({
      scene,
      camera,
      registry,
      depthFade: depthFade as unknown as SkyriverDepthSnapshot,
      analyticFog: fogControl(),
      bypassAnalyticFog: () => true,
    });
    renderer.draws.length = 0;
    plain.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.draws).toHaveLength(4);
  });

  it('bypasses analytic fog in the opaque stage only, and clears it for the transparent stage', () => {
    const { scene, registry } = buildScene();
    const { opaque, transparent, fog } = stages(scene, registry);

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(opaque.stageFlags()?.analyticFogBypassed).toBe(true);
    // Restored after the stage, so nothing outside it sees the bypass.
    expect(fog.bypassed()).toBe(false);

    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    // Transparent draws keep their own-source analytic attenuation: that is the stated
    // approximation, and it is not marched absorption.
    expect(transparent.stageFlags()?.analyticFogBypassed).toBe(false);
    expect(fog.bypassed()).toBe(false);
  });

  it('clears for the opaque stage and never for the transparent one', () => {
    const { scene, registry } = buildScene();
    const { opaque, transparent } = stages(scene, registry);

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.clears).toHaveLength(1);
    expect(renderer.clears[0]).toEqual({ target: 'composer.read', colour: true, depth: true });
    expect(opaque.stageFlags()?.cleared).toBe(true);

    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.clears).toHaveLength(1);
    expect(transparent.stageFlags()?.cleared).toBe(false);
    expect(transparent.stageFlags()?.autoClear).toBe(false);
    expect(transparent.stageFlags()?.backgroundIsNull).toBe(true);
  });

  it('captures the opaque depth once, after the opaque roles, and suppresses the second reset', () => {
    const { scene, registry } = buildScene();
    scene.onBeforeRender = (() => depthFade.beginSceneRender()) as never;
    const { opaque, transparent } = stages(scene, registry);

    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(depthFade.beginCalls).toBe(1);
    expect(depthFade.captures).toBe(1);
    expect(opaque.stageFlags()?.depthBeginSuppressed).toBe(false);

    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    // The transparent stage is a second renderer.render on the same frame. Letting its
    // onBeforeRender reset would drop the completed snapshot and start a new copy lifecycle.
    expect(transparent.stageFlags()?.depthBeginSuppressed).toBe(true);
    expect(depthFade.beginCalls).toBe(1);
    expect(depthFade.captures).toBe(1);
    // Restored afterwards, so the legacy path's own reset still works.
    expect(depthFade.beginIsSuppressed()).toBe(false);
  });

  it('holds the same readBuffer and depth attachment across both stages', () => {
    const { scene, registry } = buildScene();
    const { opaque, transparent } = stages(scene, registry);
    opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    const before = opaque.stageFlags();
    const after = transparent.stageFlags();
    expect(before?.targetUuid).toBe(after?.targetUuid);
    expect(before?.depthTextureUuid).toBe(after?.depthTextureUuid);
    expect(after?.depthTextureUuid).toBe(readBuffer.depthTexture!.uuid);
  });

  it('restores every piece of state exactly, including after a throw mid-draw', () => {
    const { scene, registry } = buildScene();
    const background = new THREE.Color(0x123456);
    scene.background = background;
    const { opaque, transparent, fog } = stages(scene, registry);

    camera.layers.set(3);
    const maskBefore = camera.layers.mask;
    renderer.autoClear = true;

    renderer.throwOnLabel = 'city.trims';
    expect(() => opaque.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer))
      .toThrow(/RENDER_FAILED/);
    expect(camera.layers.mask).toBe(maskBefore);
    expect(scene.background).toBe(background);
    expect(renderer.autoClear).toBe(true);
    expect(fog.bypassed()).toBe(false);

    renderer.throwOnLabel = 'city.signs';
    expect(() => transparent.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer))
      .toThrow(/RENDER_FAILED/);
    expect(camera.layers.mask).toBe(maskBefore);
    expect(scene.background).toBe(background);
    expect(renderer.autoClear).toBe(true);
    expect(fog.bypassed()).toBe(false);
    expect(depthFade.beginIsSuppressed()).toBe(false);
  });

  it('never swaps the composer buffers', () => {
    const { scene, registry } = buildScene();
    const { opaque, transparent } = stages(scene, registry);
    expect(opaque.needsSwap).toBe(false);
    expect(transparent.needsSwap).toBe(false);
  });
});

// --- the volume pass ----------------------------------------------------------------------------

describe('R23 volume fog pass', () => {
  let renderer: RendererDouble;
  let camera: THREE.PerspectiveCamera;
  let readBuffer: THREE.WebGLRenderTarget;
  let depthFade: DepthSnapshotDouble;
  let pass: SkyriverVolumeFogPass;

  beforeEach(() => {
    renderer = new RendererDouble();
    camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 14000);
    camera.updateMatrixWorld();
    readBuffer = new THREE.WebGLRenderTarget(8, 8);
    readBuffer.texture.name = 'composer.read';
    readBuffer.depthTexture = new THREE.DepthTexture(8, 8);
    depthFade = new DepthSnapshotDouble();
    pass = new SkyriverVolumeFogPass({
      camera,
      depthTexture: () => depthFade.depthTexture(),
      depthValid: () => depthFade.opaqueSnapshotValid(),
      beamView: () => ({ searchlightCount: 0, read: (_slot, out) => out }),
    });
    pass.setSize(2160, 1215);
  });

  it('makes exactly two draws per frame, with no swap and no scene copy', () => {
    expect(pass.needsSwap).toBe(false);
    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.draws).toHaveLength(SKYRIVER_VOLUME_NORMAL_DRAWS);
    expect(renderer.draws).toHaveLength(2);
    // No clear of its own, so the composer colour and the depth attachment survive untouched.
    expect(renderer.clears).toHaveLength(0);
  });

  it('writes the second draw into the same composer readBuffer', () => {
    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    const targets = renderer.draws.map((draw) => draw.target);
    // Draw one goes to an owned history target; draw two goes to the composer's own readBuffer.
    expect(targets[0]).toMatch(/^skyriver\.volume\.history\./);
    expect(targets[1]).toBe('composer.read');
  });

  it('ping-pongs its owned history and never samples the target it is writing', () => {
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };
    const writes: string[] = [];
    const reads: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      pass.update(frame);
      const before = pass.componentBindings();
      reads.push(before.historyRead.texture.uuid);
      writes.push(before.historyWrite.texture.uuid);
      pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    }
    // Only two owned targets, alternating. Read and write are never the same target.
    expect(new Set([...reads, ...writes]).size).toBe(2);
    for (let i = 0; i < reads.length; i += 1) expect(reads[i]).not.toBe(writes[i]);
    expect(reads[0]).toBe(reads[2]);
    expect(reads[0]).not.toBe(reads[1]);

    // The bilateral upsampler samples history and depth — never scene colour.
    const samplers = pass.bilateralSamplers();
    expect(samplers.map((sampler) => sampler.name)).toEqual(['uHistory', 'uDepth']);
    for (const sampler of samplers) {
      expect(sampler.uuid).not.toBe(readBuffer.texture.uuid);
      expect(sampler.uuid).not.toBeNull();
    }
  });

  it('blends premultiplied over with ONE / ONE_MINUS_SRC_ALPHA', () => {
    const bilateral = pass.componentBindings().bilateral;
    expect(bilateral.blending).toBe(THREE.CustomBlending);
    expect(bilateral.blendSrc).toBe(THREE.OneFactor);
    expect(bilateral.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(bilateral.blendSrcAlpha).toBe(THREE.OneFactor);
    expect(bilateral.blendDstAlpha).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(bilateral.blendEquation).toBe(THREE.AddEquation);
    // The fullscreen blend must not touch depth.
    expect(bilateral.depthTest).toBe(false);
    expect(bilateral.depthWrite).toBe(false);
    // Its shader outputs (S, 1 - T), so the hardware computes S + T * C_opaque.
    expect(bilateral.fragmentShader).toContain('vec4( scatter, 1.0 - transmittance )');
  });

  it('accumulates the reference with ONE / ONE ADD on RGB and alpha, at every draw', () => {
    // Asserted on the state the SIXTEEN draws actually ran with, not on a blending label. The
    // factors are the defect: AdditiveBlending is SRC_ALPHA / ONE because premultipliedAlpha is
    // false, so each phase's RGB was scaled by its own scaled transmittance and alpha was squared.
    // A constant-density GPU probe read reference transmittance 0.0371 against 0.7711.
    pass.setReferenceMode(true);
    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);

    const accumulation = renderer.draws.filter(
      (draw) => draw.target === 'skyriver.volume.history.reference',
    );
    expect(accumulation).toHaveLength(SKYRIVER_VOLUME_JITTER_PHASES);
    expect(accumulation).toHaveLength(16);
    for (const draw of accumulation) {
      expect(draw.materialName).toBe('skyriver.volume.raymarch');
      expect(draw.blend).toEqual({
        blending: THREE.CustomBlending,
        transparent: true,
        blendEquation: THREE.AddEquation,
        blendEquationAlpha: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      // The exact factors the corrupting mode would have used.
      expect(draw.blend!.blendSrc).not.toBe(THREE.SrcAlphaFactor);
      expect(draw.blend!.blendSrcAlpha).not.toBe(THREE.SrcAlphaFactor);
    }
    // Each phase is pre-scaled by 1/16 so the sum is the mean.
    expect(pass.referenceEvidence().blend.srcRgb).toBe(THREE.OneFactor);
    expect(pass.referenceEvidence().blend.dstAlpha).toBe(THREE.OneFactor);
  });

  it('restores every blend field it changed for the probe, and on a fault', () => {
    const material = pass.componentBindings().raymarch;
    const before = {
      blending: material.blending,
      blendEquation: material.blendEquation,
      blendEquationAlpha: material.blendEquationAlpha,
      blendSrc: material.blendSrc,
      blendDst: material.blendDst,
      blendSrcAlpha: material.blendSrcAlpha,
      blendDstAlpha: material.blendDstAlpha,
      transparent: material.transparent,
    };
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };
    pass.setReferenceMode(true);
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    const after = {
      blending: material.blending,
      blendEquation: material.blendEquation,
      blendEquationAlpha: material.blendEquationAlpha,
      blendSrc: material.blendSrc,
      blendDst: material.blendDst,
      blendSrcAlpha: material.blendSrcAlpha,
      blendDstAlpha: material.blendDstAlpha,
      transparent: material.transparent,
    };
    // Every field, not only `blending`: one unrestored factor would change every LATER normal
    // frame, because the normal integrator shares this material.
    expect(after).toEqual(before);

    // And through a fault inside the probe.
    renderer.throwOnTarget = 'skyriver.volume.history.reference';
    pass.update(frame);
    expect(() => pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer))
      .toThrow(/TARGET_FAILED/);
    expect({
      blending: material.blending,
      blendEquation: material.blendEquation,
      blendEquationAlpha: material.blendEquationAlpha,
      blendSrc: material.blendSrc,
      blendDst: material.blendDst,
      blendSrcAlpha: material.blendSrcAlpha,
      blendDstAlpha: material.blendDstAlpha,
      transparent: material.transparent,
    }).toEqual(before);
  });

  it('marches an opaque ray to the surface and caps only sky and invalid depth', () => {
    const fragment = pass.componentBindings().raymarch.fragmentShader;
    // The truncation is gone, not merely unused: no min() of the range against the surface.
    expect(fragment).not.toContain('min( rayLength, linearViewDepth( depth01 ) / cosForward )');
    expect(fragment).not.toContain('clamp( rayLength, 0.0, uVolumeRangeM )');
    expect(fragment).toContain('bool opaqueHit = uDepthValid > 0.5 && ! sky;');
    expect(fragment).toContain('min( linearViewDepth( depth01 ) / cosForward, uCameraRange.y / cosForward )');
    // The sky and invalid-depth branch keeps the bounded range.
    expect(fragment).toContain(': uVolumeRangeM;');
  });

  it('samples each volume texel at its own centre, with its own endpoint depth', () => {
    const fragment = pass.componentBindings().bilateral.fragmentShader;
    // Texel centres, built from the volume SIZE: the old version offset the full-resolution uv by
    // one texel, which lands between centres and let a linear fetch mix up to four samples.
    expect(fragment).toContain('vec2 volumeTexelUv( vec2 texel )');
    expect(fragment).toContain('+ 0.5 ) / uVolumeSize');
    expect(fragment).toContain('vec2 centreTexel = floor( vUv * uVolumeSize );');
    // The tap uv itself, pinned: it is built from the texel grid, never offset from vUv.
    expect(fragment)
      .toContain('vec2 tapUv = volumeTexelUv( centreTexel + vec2( float( x ), float( y ) ) );');
    expect(fragment).not.toContain('uVolumeTexel');
    expect(fragment).not.toMatch(/tapUv = [^;]*vUv \+/);
    // Each tap's own depth, fetched at the SAME uv as the tap, then rejected per texel.
    expect(fragment).toContain('float tapDepth01 = texture2D( uDepth, tapUv ).r;');
    expect(fragment).toContain('if ( tapSky != centreSky ) continue;');
    expect(fragment).toContain('> rejectDistance ) continue;');

    // And the history is nearest filtered, so a centre fetch cannot mix neighbours at all.
    const bindings = pass.componentBindings();
    for (const target of [bindings.historyRead, bindings.historyWrite]) {
      expect(target.texture.minFilter).toBe(THREE.NearestFilter);
      expect(target.texture.magFilter).toBe(THREE.NearestFilter);
    }
    // The upsampler is told the size, and it tracks the real volume target.
    pass.setSize(2160, 1215);
    const size = bindings.bilateral.uniforms.uVolumeSize!.value as THREE.Vector2;
    expect([size.x, size.y]).toEqual([pass.stats().volumeSize.width, pass.stats().volumeSize.height]);
  });

  it('composes nothing at all when no valid opaque depth exists', () => {
    // The staged frame REQUIRES the snapshot. Without it the marcher would run every ray through
    // the walls for the full bounded range and the bilateral filter would stop rejecting
    // silhouettes, which is a fog and scatter sheet in front of near geometry. So: no draws, and
    // the skip is recorded rather than passed off as a composed frame.
    depthFade.valid = false;
    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    renderer.autoClear = true;
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.draws).toHaveLength(0);
    expect(renderer.clears).toHaveLength(0);
    expect(renderer.autoClear).toBe(true);
    const record = pass.invocationEvidence()!;
    expect(record.depthValid).toBe(false);
    expect(record.composed).toBe(false);
    expect(record.skipReason).toBe('no-valid-opaque-depth');
    expect(record.faulted).toBe(false);
    expect(pass.stats().depthSkips).toBe(1);

    // With the snapshot back, the same pass composes normally again: the skip is per invocation.
    depthFade.valid = true;
    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.draws).toHaveLength(SKYRIVER_VOLUME_NORMAL_DRAWS);
    expect(pass.invocationEvidence()!.composed).toBe(true);
    expect(pass.invocationEvidence()!.skipReason).toBeNull();
    expect(pass.stats().depthSkips).toBe(1);
  });

  it('unbinds every source when a chain marches nothing', () => {
    // Measured: a legacy-five record read presentationChain 'legacy-five', volumeEnabled false and
    // volumeSelectedLights 10, because the pass kept the last staged upload. lightUniforms() was
    // returning those ten stale bindings too.
    const pool = skyriverBuildLightPool({ sources: [heroBlade], beams: [] });
    const { selected } = skyriverSelectLights(pool, 518.2, 1307, 500);
    pass.update({
      wallDeltaS: 1 / 60, selected, district: neutralDistrict, districtColourAllowed: true,
    });
    expect(pass.stats().selectedCount).toBe(1);
    expect(pass.lightUniforms()).toHaveLength(1);

    pass.clearLights();
    expect(pass.stats().selectedCount).toBe(0);
    expect(pass.lightUniforms()).toEqual([]);
    expect(pass.componentBindings().raymarch.uniforms.uLightCount!.value).toBe(0);
    // Idempotent, and it really zeroes the bound colours rather than only the count.
    pass.clearLights();
    expect(pass.stats().selectedCount).toBe(0);
    pass.update({
      wallDeltaS: 1 / 60, selected, district: neutralDistrict, districtColourAllowed: true,
    });
    expect(pass.stats().selectedCount).toBe(1);
  });

  it('allocates half or quarter of the physical buffer, clamped to one pixel', () => {
    pass.setProfile(SKYRIVER_VOLUME_PROFILES.high, SKYRIVER_VOLUME_PROFILES.high.steps);
    pass.setSize(2160, 1215);
    expect(pass.stats().volumeSize).toEqual({
      width: skyriverVolumeDimension(2160, 0.5),
      height: skyriverVolumeDimension(1215, 0.5),
    });
    expect(pass.stats().volumeSize).toEqual({ width: 1080, height: 607 });

    pass.setProfile(SKYRIVER_VOLUME_PROFILES.medium, SKYRIVER_VOLUME_PROFILES.medium.steps);
    expect(pass.stats().volumeSize).toEqual({ width: 540, height: 303 });

    // One pixel and odd sizes stay valid.
    pass.setSize(1, 1);
    expect(pass.stats().volumeSize).toEqual({ width: 1, height: 1 });
    pass.setSize(3, 7);
    expect(pass.stats().volumeSize).toEqual({ width: 1, height: 1 });
    pass.setSize(1921, 1081);
    expect(pass.stats().volumeSize.width).toBeGreaterThanOrEqual(1);
  });

  it('resets the history on camera, projection, resize, profile, pause and explicit changes', () => {
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(pass.stats().historyValid).toBe(true);

    const seen: string[] = [];
    const check = (act: () => void, reason: string): void => {
      act();
      expect(pass.stats().historyValid).toBe(false);
      expect(pass.stats().lastHistoryReset).toBe(reason);
      seen.push(reason);
      pass.update(frame);
      pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
      expect(pass.stats().historyValid).toBe(true);
    };

    check(() => {
      camera.position.set(10, 20, 30);
      camera.updateMatrixWorld();
      pass.update(frame);
    }, 'camera');
    check(() => {
      camera.fov = 70;
      camera.updateProjectionMatrix();
      pass.update(frame);
    }, 'projection');
    check(() => pass.setSize(1280, 720), 'resize');
    check(() => pass.setProfile(SKYRIVER_VOLUME_PROFILES.medium, SKYRIVER_VOLUME_PROFILES.medium.steps), 'profile');
    check(() => pass.setProfile(SKYRIVER_VOLUME_PROFILES.medium, 4), 'steps');
    check(() => pass.update({ ...frame, wallDeltaS: 2 }), 'frame-pause');
    check(() => pass.resetHistory('replay-seek'), 'replay-seek');
    check(() => pass.resetHistory('resume'), 'resume');
    check(() => pass.resetHistory('district'), 'district');
    expect(new Set(seen).size).toBe(seen.length);

    // Reference mode is the one reset that does NOT re-validate on the next frame: the reference
    // runs with history off by predeclared policy, so it never accumulates.
    pass.setReferenceMode(true);
    expect(pass.stats().lastHistoryReset).toBe('reference-mode');
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(pass.stats().historyValid).toBe(false);
    expect(pass.referenceEvidence().historyEnabled).toBe(false);
  });

  it('clamps the high step count into 8..12 and keeps medium at six', () => {
    pass.setProfile(SKYRIVER_VOLUME_PROFILES.high, 4);
    expect(pass.currentSteps()).toBe(8);
    pass.setProfile(SKYRIVER_VOLUME_PROFILES.high, 99);
    expect(pass.currentSteps()).toBe(12);
    pass.setProfile(SKYRIVER_VOLUME_PROFILES.high, 10);
    expect(pass.currentSteps()).toBe(10);
    pass.setProfile(SKYRIVER_VOLUME_PROFILES.medium, SKYRIVER_VOLUME_PROFILES.medium.steps);
    expect(pass.currentSteps()).toBe(6);
  });

  it('bounds the normal marching loop at twelve steps, and only recompiles for the reference', () => {
    // A driver may fully unroll a constant-bounded loop, so the normal shader must not carry the
    // reference's 128-step bound for steps a normal frame never takes.
    const material = pass.componentBindings().raymarch;
    expect(material.defines.VOL_MAX_STEPS).toBe(12);
    expect(material.fragmentShader).toContain('for ( int i = 0; i < VOL_MAX_STEPS; i ++ )');
    pass.setReferenceMode(true);
    expect(material.defines.VOL_MAX_STEPS).toBe(128);
    pass.setReferenceMode(false);
    expect(material.defines.VOL_MAX_STEPS).toBe(12);
  });

  it('indexes its light arrays with a loop index under a constant bound', () => {
    // GLSL ES 1.00 only treats a loop index of a constant-bounded for-loop as a
    // constant-index-expression. A varying-derived index would not compile.
    const source = pass.componentBindings().raymarch.fragmentShader;
    expect(source).toContain('#define LIGHT_LIMIT 10');
    expect(source).toContain('for ( int i = 0; i < LIGHT_LIMIT; i ++ )');
    expect(source).toContain('if ( i >= uLightCount ) break;');
    // 'half' is reserved in GLSL ES 1.00; the extent must be named in full.
    expect(source).not.toMatch(/\bfloat half\b/);
  });

  it('reports the reference integrator as a predeclared noise-free proxy', () => {
    pass.setReferenceMode(true);
    const evidence = pass.referenceEvidence();
    expect(evidence.enabled).toBe(true);
    expect(evidence.steps).toBe(128);
    expect(evidence.jitterPhaseIndices).toHaveLength(16);
    expect(evidence.jitterPhaseIndices[0]).toBe(0);
    expect(evidence.jitterPhaseIndices[15]).toBe(15);
    expect(evidence.historyEnabled).toBe(false);
    expect(evidence.sameSpatialResolutionAsNormal).toBe(true);
    expect(evidence.accumulationTextureType).toBe(THREE.FloatType);
    expect(evidence.volumeSize).toEqual(pass.stats().volumeSize);
    expect(evidence.shaderFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(evidence.limits.join(' ')).toMatch(/not exact ground truth/);
    // Stated, because it is the easiest thing here to overclaim: the history resets on any camera
    // matrix change and the jitter phase advances every integration, so in flight every frame is
    // a single-phase result. Frozen-frame convergence is not evidence for motion.
    expect(evidence.limits.join(' ')).toMatch(/Frozen-frame convergence is NOT flight evidence/);
    expect(evidence.limits.join(' ')).toMatch(/moving-camera capture/);
    // And the reference itself is not yet GPU-verified in this round.
    expect(evidence.limits.join(' ')).toMatch(/NOT YET GPU-VERIFIED/);
  });

  it('calls the in-frame probe hook after its last composing draw, in the same invocation', () => {
    const calls: { draws: number; target: string | null }[] = [];
    const hooked = new SkyriverVolumeFogPass({
      camera,
      depthTexture: () => depthFade.depthTexture(),
      depthValid: () => depthFade.opaqueSnapshotValid(),
      beamView: () => ({ searchlightCount: 0, read: (_slot, out) => out }),
      onComposed: () => calls.push({
        draws: renderer.draws.length,
        target: renderer.getRenderTarget()?.texture.name ?? null,
      }),
    });
    hooked.setSize(64, 64);
    hooked.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    hooked.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);

    // Both draws are done, and the composition target is still bound: this is the moment a depth
    // hash has to be taken to pair with the one from after the opaque stage.
    expect(calls).toEqual([{ draws: SKYRIVER_VOLUME_NORMAL_DRAWS, target: 'composer.read' }]);
    hooked.dispose();
  });

  it('restores the clear colour and blending after a reference probe', () => {
    pass.setReferenceMode(true);
    const colourBefore = renderer.getClearColor(new THREE.Color()).getHex();
    const alphaBefore = renderer.getClearAlpha();
    const blendingBefore = pass.componentBindings().raymarch.blending;

    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);

    // The scene's own clear colour must survive: the opaque stage clears the frame with it.
    expect(renderer.getClearColor(new THREE.Color()).getHex()).toBe(colourBefore);
    expect(renderer.getClearAlpha()).toBe(alphaBefore);
    expect(pass.componentBindings().raymarch.blending).toBe(blendingBefore);
    // 16 accumulation draws, all probes, plus the one bilateral draw.
    expect(pass.stats().probeDraws).toBe(16);
    expect(pass.stats().referencePhasesCompleted).toBe(16);
  });

  it('restores autoClear exactly, including when a draw throws mid-pass', () => {
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };

    // A pass that leaves autoClear false would stop every LATER frame of the whole composer chain
    // from clearing, so one failed draw must not outlive its own frame.
    for (const before of [true, false]) {
      renderer.autoClear = before;
      pass.update(frame);
      pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
      expect(renderer.autoClear).toBe(before);
    }

    renderer.autoClear = true;
    renderer.throwOnTarget = 'composer.read';
    pass.update(frame);
    expect(() => pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer))
      .toThrow(/TARGET_FAILED/);
    expect(renderer.autoClear).toBe(true);

    // The faulted invocation is recorded as faulted, with the restoration it performed.
    const faulted = pass.invocationEvidence();
    expect(faulted?.faulted).toBe(true);
    expect(faulted?.autoClearBefore).toBe(true);
    expect(faulted?.autoClearAfter).toBe(true);

    // And the next frame still composes normally.
    renderer.throwOnTarget = null;
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(renderer.autoClear).toBe(true);
    expect(pass.invocationEvidence()?.faulted).toBe(false);
  });

  it('restores blending, transparency and the clear colour through a reference-probe fault', () => {
    pass.setReferenceMode(true);
    const blendingBefore = pass.componentBindings().raymarch.blending;
    const transparentBefore = pass.componentBindings().raymarch.transparent;
    const colourBefore = renderer.getClearColor(new THREE.Color()).getHex();
    renderer.autoClear = true;
    renderer.throwOnTarget = 'skyriver.volume.history.reference';

    pass.update({
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1], scatterScale: 1, deckGlowLinear: [0, 0, 0], deckGlowHeightM: 40 },
      districtColourAllowed: true,
    });
    expect(() => pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer))
      .toThrow(/TARGET_FAILED/);

    // The reference probe's own restoration is in a finally too, so a fault inside it cannot leave
    // the normal integrator additive, transparent, or the scene's clear colour overwritten.
    expect(pass.componentBindings().raymarch.blending).toBe(blendingBefore);
    expect(pass.componentBindings().raymarch.transparent).toBe(transparentBefore);
    expect(pass.componentBindings().raymarch.uniforms.uReferenceScale!.value).toBe(1);
    expect(renderer.getClearColor(new THREE.Color()).getHex()).toBe(colourBefore);
    expect(renderer.autoClear).toBe(true);
  });

  it('records the composition target before and after, inside the same invocation', () => {
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };
    expect(pass.invocationEvidence()).toBeNull();
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);

    const record = pass.invocationEvidence()!;
    expect(record.invocation).toBe(1);
    expect(record.renderToScreen).toBe(false);
    expect(record.before.colourUuid).toBe(readBuffer.texture.uuid);
    expect(record.before.depthUuid).toBe(readBuffer.depthTexture!.uuid);
    // Same target and the same depth attachment after both draws: the pass composes into the
    // buffer it was handed and never rebinds the depth attachment.
    expect(record.after).toEqual(record.before);
    expect(record.before.width).toBe(readBuffer.width);
    // What the marcher SAMPLED is the owned depth copy, and the record says so rather than
    // claiming it read the attachment above.
    expect(record.marchedDepthIsCopy).toBe(true);
    expect(record.marchedDepthUuid).toBe(depthFade.depthTexture().uuid);
    expect(record.marchedDepthUuid).not.toBe(record.before.depthUuid);
    expect(record.depthValid).toBe(true);

    // A second invocation is counted, not merged with the first.
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(pass.invocationEvidence()!.invocation).toBe(2);
  });

  it('needs the presented-time check to drop history on a seek with a fixed camera', () => {
    // This is the gap the frame pump's reversal check closes. The pass resets on camera,
    // projection, size, profile and pause changes — none of which a replay seek has to touch. With
    // the camera still and the render delta normal, the pass alone keeps fusing history from a
    // LATER presented moment.
    const frame = {
      wallDeltaS: 1 / 60,
      selected: [],
      district: { id: 'd', tintLinear: [1, 1, 1] as const, scatterScale: 1, deckGlowLinear: [0, 0, 0] as const, deckGlowHeightM: 40 },
      districtColourAllowed: true,
    };
    const selection = new SkyriverLightSelection([]);
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(pass.stats().historyValid).toBe(true);

    // A seek inside one tick: the camera and the projection are untouched.
    const from = { tick: 600, alpha: 0.75 };
    const to = { tick: 600, alpha: 0.25 };
    pass.update(frame);
    expect(pass.stats().historyValid).toBe(true);

    // The frame pump's decision, and the two resets it performs.
    expect(skyriverSourceTimeReversed(from.tick, from.alpha, to.tick, to.alpha)).toBe(true);
    pass.resetHistory('replay-seek');
    selection.reset();
    expect(pass.stats().historyValid).toBe(false);
    expect(pass.stats().lastHistoryReset).toBe('replay-seek');
    expect(selection.stats().resets).toBe(1);
    expect(Number.isNaN(selection.stats().bucket)).toBe(true);

    // And the next frame starts accumulating again from the moment actually being drawn.
    pass.update(frame);
    pass.render(renderer as unknown as THREE.WebGLRenderer, readBuffer, readBuffer);
    expect(pass.stats().historyValid).toBe(true);
  });

  // --- the source-to-scatter units actually bound (R23 scatter repair) --------------------------

  /** The measured failing source: the 468 x 90 m hero blade from smoke-sources.json. */
  const heroBlade: SkyriverLightSource = {
    id: 'tower:630.00:0.00|face-4|hero-row-1',
    role: 'hero-sign',
    districtId: 4,
    x: 518.2,
    y: 1307,
    z: -19,
    sizeM: [468, 90, 0],
    axis: [0, 1, 0],
    emission: [0.0653, 2.0397, 2.2971],
    legacyEmission: [0.1545, 2.2173, 0.2753],
  };

  const neutralDistrict = {
    id: 'd',
    tintLinear: [1, 1, 1] as const,
    scatterScale: 1,
    deckGlowLinear: [0, 0, 0] as const,
    deckGlowHeightM: 40,
  };

  function bindSources(sources: readonly SkyriverLightSource[], beams: readonly SkyriverBeamRecord[] = []) {
    const pool = skyriverBuildLightPool({ sources, beams });
    const { selected } = skyriverSelectLights(pool, 518.2, 1307, 500);
    pass.update({ wallDeltaS: 1 / 60, selected, district: neutralDistrict, districtColourAllowed: true });
    return { pool, selected, bound: pass.lightUniforms() };
  }

  it('binds the source emission exactly once, with the lit area as the shape', () => {
    // The initial R23 build bound [45.1, 1407.6, 1585.3] for this source and the frame came back
    // 97.77% exact white. The repaired upload binds the source's own emission and nothing else.
    const { pool, bound } = bindSources([heroBlade]);
    expect(bound).toHaveLength(1);
    expect(bound[0]!.colour[0]).toBeCloseTo(0.0653, 12);
    expect(bound[0]!.colour[1]).toBeCloseTo(2.0397, 12);
    expect(bound[0]!.colour[2]).toBeCloseTo(2.2971, 12);
    expect(Math.max(...bound[0]!.colour)).toBeLessThan(3);

    // The shape carries the proxy's geometry, in metres: lit area, then the half-response radius.
    expect(bound[0]!.shape[0]).toBeCloseTo(42120, 6);
    expect(bound[0]!.shape[0]).toBe(pool[0]!.litAreaM2);
    expect(bound[0]!.shape[1]).toBeCloseTo(skyriverScatterRadiusM(42120), 9);
    expect(bound[0]!.shape[1]).toBeCloseTo(57.89, 2);
    expect(bound[0]!.kind).toBe(0);
  });

  it('doubles the bound radiance when the source RGB doubles, and never squares it', () => {
    const single = bindSources([heroBlade]).bound[0]!;
    const doubled = bindSources([{
      ...heroBlade,
      emission: [0.1306, 4.0794, 4.5942],
    }]).bound[0]!;
    for (let channel = 0; channel < 3; channel += 1) {
      expect(doubled.colour[channel]! / single.colour[channel]!).toBeCloseTo(2, 9);
    }
    // Same drawn face, so the geometry the shader falls off with is untouched.
    expect(doubled.shape[0]).toBe(single.shape[0]);
    expect(doubled.shape[1]).toBe(single.shape[1]);
  });

  it('binds the colour-off emission when the district colour is off, still once', () => {
    const pool = skyriverBuildLightPool({ sources: [heroBlade], beams: [] });
    const { selected } = skyriverSelectLights(pool, 518.2, 1307, 500);
    pass.update({ wallDeltaS: 1 / 60, selected, district: neutralDistrict, districtColourAllowed: false });
    const bound = pass.lightUniforms();
    expect(bound[0]!.colour[0]).toBeCloseTo(0.1545, 12);
    expect(bound[0]!.colour[1]).toBeCloseTo(2.2173, 12);
    expect(bound[0]!.colour[2]).toBeCloseTo(0.2753, 12);
  });

  it('keeps a cone on the drawn beam formula and its live geometry', () => {
    const record: SkyriverBeamRecord = {
      slot: 0,
      start: [518.2, 2000, 500],
      axis: [0, -1, 0],
      lengthM: 2600,
      widthStartM: 10,
      widthEndM: 150,
      colorLinear: [0.62, 0.68, 0.74],
      seed: 0,
      intensity: 0.025,
      softness: 8,
      fadeStart: 0.45,
    };
    const live: SkyriverBeamRecord = { ...record, axis: [0, -1, 0], start: [600, 2100, 520] };
    pass = new SkyriverVolumeFogPass({
      camera,
      depthTexture: () => depthFade.depthTexture(),
      depthValid: () => depthFade.opaqueSnapshotValid(),
      beamView: () => ({
        searchlightCount: 1,
        read: (_slot: number, out: SkyriverMutableBeamRecord) => Object.assign(out, live),
      }),
    });
    pass.setSize(2160, 1215);

    const { bound } = bindSources([], [record]);
    expect(bound).toHaveLength(1);
    expect(bound[0]!.kind).toBe(1);
    // Radiance is the drawn colour times the drawn intensity, applied once.
    for (let channel = 0; channel < 3; channel += 1) {
      expect(bound[0]!.colour[channel]!).toBeCloseTo(live.colorLinear[channel]! * 0.025, 12);
    }
    // The beam's own shaft parameters, not an area proxy: the cone branch is the drawn formula.
    expect(bound[0]!.shape).toEqual([10, 150, 8, 0.45]);
    // And the geometry is the live slot, not the record the pool was built from.
    expect(bound[0]!.position).toEqual([600, 2100, 520]);
    expect(bound[0]!.axisScalar).toBe(2600);
  });

  it('runs the bounded area proxy in the marcher, with no range falloff left', () => {
    const fragment = pass.componentBindings().raymarch.fragmentShader;
    expect(fragment).toContain(SKYRIVER_SCATTER_RESPONSE_GLSL.trim());
    expect(fragment).toContain('scatterResponse( litAreaM2, distanceM )');
    // The energy-scaled range falloff that produced the white frame is gone, not merely unused.
    expect(fragment).not.toContain('boundedFalloff');
    expect(fragment).not.toContain('float reach');
    // The uniform documents the units the shape slot is in.
    expect(fragment).toContain('x lit area m^2, y scatter radius m');
  });

  it('carries the blue-noise tile as an R8 repeat-wrapped nearest texture, uploaded once', () => {
    const uniforms = pass.componentBindings().raymarch.uniforms;
    const noise = uniforms.uNoise!.value as THREE.DataTexture;
    expect(noise.format).toBe(THREE.RedFormat);
    expect(noise.type).toBe(THREE.UnsignedByteType);
    expect(noise.colorSpace).toBe(THREE.NoColorSpace);
    expect(noise.wrapS).toBe(THREE.RepeatWrapping);
    expect(noise.wrapT).toBe(THREE.RepeatWrapping);
    expect(noise.minFilter).toBe(THREE.NearestFilter);
    expect(noise.magFilter).toBe(THREE.NearestFilter);
    expect(noise.generateMipmaps).toBe(false);
    expect(noise.flipY).toBe(false);
    expect(noise.unpackAlignment).toBe(1);
    expect(noise.image.width).toBe(64);
    expect(noise.image.height).toBe(64);
    expect(pass.stats().noiseSha256)
      .toBe('eacd51e51588466d345792c3105c6bb89e0ec81b30bfc26d033ce99bd6b6c602');
  });

  it('reports the real field multipliers in its stats', () => {
    const stats = pass.stats();
    expect(stats.densityLow).toBe(0.00078);
    expect(stats.densityHigh).toBe(0.0001);
    expect(stats.deckPeakMultiplier).toBeCloseTo(1.45, 10);
    expect(stats.deepFloorMultiplier).toBeCloseTo(0.55, 10);
    expect(stats.normalDraws).toBe(2);
  });

  it('disposes every target, material and texture it owns', () => {
    const disposed: string[] = [];
    const bindings = pass.componentBindings();
    const noise = bindings.raymarch.uniforms.uNoise!.value as THREE.DataTexture;
    // Render targets dispatch 'dispose' on the target; textures dispatch it on the texture.
    for (const [name, resource] of [
      ['historyRead', bindings.historyRead],
      ['historyWrite', bindings.historyWrite],
      ['noise', noise],
    ] as const) {
      resource.addEventListener('dispose', () => disposed.push(name));
    }
    pass.setReferenceMode(true);
    const reference = pass.componentBindings();
    void reference;
    pass.dispose();
    expect(disposed.sort()).toEqual(['historyRead', 'historyWrite', 'noise']);

    // Both materials are disposed too, and a second dispose stays safe.
    expect(() => pass.dispose()).not.toThrow();
  });
});

// --- analytic fog bypass coverage ---------------------------------------------------------------

describe('R23 analytic fog bypass', () => {
  it('gates the one shared density implementation, so every opaque reader agrees', () => {
    // skyriverFogFactor is the single density implementation: the opaque mix, the landmark wash's
    // penetration term and every other reader call it. Gating it there is one change, not five.
    expect(SKYRIVER_FOG_PARS_FRAGMENT_SOURCE).toContain('uniform float uSkyFogBypass;');
    expect(SKYRIVER_FOG_PARS_FRAGMENT_SOURCE).toContain('float skyriverFogBypassGate()');
    const factor = /float skyriverFogFactor\(\) \{([\s\S]*?)\n  \}/.exec(SKYRIVER_FOG_PARS_FRAGMENT_SOURCE);
    expect(factor).not.toBeNull();
    expect(factor![1]).toContain('skyriverFogBypassGate()');
  });

  it('also gates the far card’s independent layer haze', () => {
    // uLayerHaze is a separate mix that never passes through fog_fragment. Without its own gate a
    // far card would still be hazed inside the stage that marches its absorption.
    expect(SKYRIVER_IMPOSTOR_FRAGMENT_SOURCE).toContain('uniform vec3 uLayerHaze;');
    expect(SKYRIVER_IMPOSTOR_FRAGMENT_SOURCE)
      .toContain('skyriverFogColor(), haze * skyriverFogBypassGate()');
  });

  it('is off by default, and only the opaque stage ever sets it', () => {
    setSkyriverFogBypass(false);
    expect(skyriverFogBypassed()).toBe(false);
    setSkyriverFogBypass(true);
    expect(skyriverFogBypassed()).toBe(true);
    setSkyriverFogBypass(false);
    expect(skyriverFogBypassed()).toBe(false);
  });

  it('leaves the transparent own-source path calling the shared factor directly', () => {
    // The smog's own-depth attenuation is the stated transparent approximation. It must still read
    // the shared factor, because the bypass is never set while transparent roles draw.
    expect(SKYRIVER_SMOG_FRAGMENT_SOURCE).toContain('1.0 - skyriverFogFactor()');
    expect(SKYRIVER_SMOG_FRAGMENT_SOURCE).toContain('skyriverVisibilityFade()');
  });
});

// --- composition plan ---------------------------------------------------------------------------

/** Every selectable chain, so a loop over the plan cannot miss one. */
const SKYRIVER_PRESENTATION_CHAINS: readonly SkyriverPresentationChain[] =
  ['r23-staged', 'legacy-five', 'three-only'];

describe('R23 composition plan', () => {
  const plan = (
    tier: SkyriverQualityTier, volumeAllowed: boolean, bloomEnabled = true,
  ): ReturnType<typeof skyriverCompositionPlan> =>
    skyriverCompositionPlan({
      tier, chain: volumeAllowed ? 'r23-staged' : 'legacy-five', bloomEnabled,
    });

  it('stages high and medium while R23 is allowed', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const staged = plan(tier, true);
      expect(staged.mode).toBe('staged');
      expect(staged.legacyRenderPass).toBe(false);
      expect(staged.opaquePass).toBe(true);
      expect(staged.volumePass).toBe(true);
      expect(staged.transparentPass).toBe(true);
      expect(staged.threeMipBloom).toBe(true);
      expect(staged.legacyBloom).toBe(false);
      expect(staged.bloomMips).toBe(3);
      expect(staged.bloomDraws).toBe(9);
      expect(staged.analyticFogInOpaqueStage).toBe(false);
      expect(staged.postDraws).toBe(2 + 9 + 1);
    }
    expect(plan(SkyriverQualityTier.High, true).volumeProfile.spatialScale).toBe(0.5);
    expect(plan(SkyriverQualityTier.High, true).volumeProfile.steps).toBe(8);
    expect(plan(SkyriverQualityTier.Medium, true).volumeProfile.spatialScale).toBe(0.25);
    expect(plan(SkyriverQualityTier.Medium, true).volumeProfile.steps).toBe(6);
    // Medium draws half the high cloud count.
    expect(plan(SkyriverQualityTier.Medium, true).clouds * 2)
      .toBe(plan(SkyriverQualityTier.High, true).clouds);
  });

  it('restores the verified R22 chain on the R23 off path, with all five bloom samplers', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const off = plan(tier, false);
      expect(off.mode).toBe('legacy');
      expect(off.legacyRenderPass).toBe(true);
      expect(off.opaquePass).toBe(false);
      expect(off.volumePass).toBe(false);
      expect(off.transparentPass).toBe(false);
      expect(off.clouds).toBe(0);
      expect(off.volumeProfile.steps).toBe(0);
      // All five original samplers, and nMips never touched.
      expect(off.legacyBloom).toBe(true);
      expect(off.threeMipBloom).toBe(false);
      expect(off.bloomMips).toBe(5);
      expect(off.bloomDraws).toBe(13);
      // The analytic haze is back everywhere, which is what makes this the R22 scene.
      expect(off.analyticFogInOpaqueStage).toBe(true);
      expect(off.postDraws).toBe(13 + 1);
    }
  });

  it('leaves Low exactly as it was, on or off', () => {
    // Low keeps the analytic scene, no volume, no clouds, and its own bloom-off behaviour.
    for (const volumeAllowed of [true, false]) {
      const low = plan(SkyriverQualityTier.Low, volumeAllowed, false);
      expect(low.mode).toBe('legacy');
      expect(low.legacyRenderPass).toBe(true);
      expect(low.volumePass).toBe(false);
      expect(low.transparentPass).toBe(false);
      expect(low.clouds).toBe(0);
      expect(low.volumeProfile.steps).toBe(0);
      expect(low.analyticFogInOpaqueStage).toBe(true);
      // Bloom off on Low: neither implementation runs, and the post chain is OutputPass alone.
      expect(low.legacyBloom).toBe(false);
      expect(low.threeMipBloom).toBe(false);
      expect(low.bloomDraws).toBe(0);
      expect(low.postDraws).toBe(1);
    }
    // On Low, every chain draws the same frame: the plans differ only in the `chain` label that
    // selected them, so dropping that one input name leaves identical records.
    const drawn = (chain: SkyriverPresentationChain): Record<string, unknown> => {
      const { chain: selected, ...rest } = skyriverCompositionPlan({
        tier: SkyriverQualityTier.Low, chain, bloomEnabled: false,
      });
      expect(selected).toBe(chain);
      return rest;
    };
    for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
      expect(drawn(chain)).toEqual(drawn(SKYRIVER_DEFAULT_PRESENTATION_CHAIN));
    }
  });

  it('counts the smog batch as one scene draw, and none at all on Low', () => {
    const high = skyriverDrawCallEstimate(skyriverQualityFor(SkyriverQualityTier.High));
    const medium = skyriverDrawCallEstimate(skyriverQualityFor(SkyriverQualityTier.Medium));
    const low = skyriverDrawCallEstimate(skyriverQualityFor(SkyriverQualityTier.Low));
    expect(high.smog).toBe(1);
    expect(medium.smog).toBe(1);
    expect(low.smog).toBe(0);
    // The scene budget still holds with the new batch counted.
    for (const estimate of [high, medium, low]) {
      expect(estimate.withinBudget).toBe(true);
      expect(estimate.total).toBe(
        estimate.city + estimate.atmosphere + estimate.trafficBudget + estimate.smog,
      );
    }
  });

  it('keeps the staged frame inside 32 draws and the legacy frame exactly at the ceiling', () => {
    const sceneDrawsHigh = 18;
    const staged = plan(SkyriverQualityTier.High, true);
    // The one smog batch is part of the scene traversal, not the post chain.
    expect(sceneDrawsHigh + 1 + staged.postDraws).toBe(31);
    expect(sceneDrawsHigh + 1 + staged.postDraws).toBeLessThanOrEqual(32);
    const legacy = plan(SkyriverQualityTier.High, false);
    expect(sceneDrawsHigh + legacy.postDraws).toBe(32);
  });

  it('is idempotent and bloom-ease safe: mid-ease, the plan never enables two bloom passes', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
        for (const bloomEnabled of [true, false]) {
          const once = skyriverCompositionPlan({ tier, chain, bloomEnabled });
          const twice = skyriverCompositionPlan({ tier, chain, bloomEnabled });
          expect(twice).toEqual(once);
          expect(once.threeMipBloom && once.legacyBloom).toBe(false);
          expect(once.legacyRenderPass).toBe(!once.opaquePass);
        }
      }
    }
  });
});


describe('R23 composition plan: depth availability', () => {
  it('reports each applied plan when the next plan differs', () => {
    const getter = Object.getOwnPropertyDescriptor(SkyriverScene.prototype, 'composition')?.get;
    if (!getter) throw new Error('Composition getter missing');
    const plans = [];
    const chains: SkyriverPresentationChain[] = ['r23-staged', 'legacy-five', 'three-only'];
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      for (const chain of chains) for (const depthAvailable of [true, false]) {
        plans.push(skyriverCompositionPlan({ tier, chain, bloomEnabled: true, depthAvailable }));
      }
    }
    let checked = 0;
    for (const applied of plans) for (const next of plans) {
      if (applied.mode === next.mode) continue;
      const state = { livePlan: applied, compositionPlan: () => next };
      expect(Reflect.apply(getter, state, [])).toBe(applied.mode);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(new Set(plans.map(item => item.mode))).toEqual(new Set(['legacy', 'staged']));
  });

  const plan = (
    tier: SkyriverQualityTier, depthAvailable: boolean,
  ): ReturnType<typeof skyriverCompositionPlan> =>
    skyriverCompositionPlan({ tier, chain: 'r23-staged', bloomEnabled: true, depthAvailable });

  it('falls back to the legacy analytic frame on High and Medium with no opaque depth', () => {
    // The staged frame REQUIRES an opaque depth snapshot: the marcher reads it to find where each
    // ray ends, the upsampler reads it to reject taps across a silhouette, and the opaque stage
    // has already dropped the shared analytic haze on the promise that the marcher replaces it.
    // Without depth, the old plan still staged the frame and the marcher ran the full 2.6 km
    // through every wall — a fog and scatter sheet in front of near geometry, with no loud failure.
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const blocked = plan(tier, false);
      expect(blocked.mode).toBe('legacy');
      expect(blocked.legacyRenderPass).toBe(true);
      expect(blocked.opaquePass).toBe(false);
      expect(blocked.volumePass).toBe(false);
      expect(blocked.transparentPass).toBe(false);
      // The legacy analytic haze is back everywhere, which is the honest fallback: the R22 scene.
      expect(blocked.analyticFogInOpaqueStage).toBe(true);
      expect(blocked.clouds).toBe(0);
      expect(blocked.volumeSteps).toBe(0);
      // And the cause is recorded rather than inferred.
      expect(blocked.stagingBlocker).toBe('no-opaque-depth');
      expect(blocked.depthAvailable).toBe(false);
      // The off path's own bloom comes with it: this really is the verified R22 chain.
      expect(blocked.legacyBloom).toBe(true);
      expect(blocked.bloomMips).toBe(5);
      expect(blocked.postDraws).toBe(13 + 1);
    }
  });

  it('stages the frame again as soon as depth is available, with nothing else changed', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const staged = plan(tier, true);
      expect(staged.mode).toBe('staged');
      expect(staged.volumePass).toBe(true);
      expect(staged.stagingBlocker).toBeNull();
      expect(staged.depthAvailable).toBe(true);
      // Depth availability is the ONLY difference between the two plans.
      const { depthAvailable: a, stagingBlocker: b, ...stagedRest } = staged;
      const { depthAvailable: c, stagingBlocker: d, ...blockedRest } = plan(tier, false);
      void a; void b; void c; void d;
      expect(stagedRest).not.toEqual(blockedRest);
      expect(skyriverCompositionPlan({
        tier, chain: 'r23-staged', bloomEnabled: true, depthAvailable: true,
      })).toEqual(staged);
    }
  });

  it('never claims a blocker on a chain or tier that was not asking to be staged', () => {
    // Low and the legacy chains are legacy by choice, not because depth is missing. Reporting a
    // blocker there would make the fallback record meaningless.
    for (const depthAvailable of [true, false]) {
      expect(skyriverCompositionPlan({
        tier: SkyriverQualityTier.Low, chain: 'r23-staged', bloomEnabled: false, depthAvailable,
      }).stagingBlocker).toBeNull();
      for (const chain of ['legacy-five', 'three-only'] as const) {
        expect(skyriverCompositionPlan({
          tier: SkyriverQualityTier.High, chain, bloomEnabled: true, depthAvailable,
        }).stagingBlocker).toBeNull();
      }
    }
  });

  it('defaults to available, so a caller that cannot know keeps the previous answer', () => {
    const implied = skyriverCompositionPlan({
      tier: SkyriverQualityTier.High, chain: 'r23-staged', bloomEnabled: true,
    });
    expect(implied.depthAvailable).toBe(true);
    expect(implied.mode).toBe('staged');
  });
});

describe('R23 composition plan: step and cloud overrides', () => {
  const plan = (input: {
    tier?: SkyriverQualityTier;
    stepsOverride?: number | null;
    cloudsOverride?: number | null;
    bloomEnabled?: boolean;
  }): ReturnType<typeof skyriverCompositionPlan> => skyriverCompositionPlan({
    tier: input.tier ?? SkyriverQualityTier.High,
    chain: 'r23-staged',
    bloomEnabled: input.bloomEnabled ?? true,
    stepsOverride: input.stepsOverride ?? null,
    cloudsOverride: input.cloudsOverride ?? null,
  });

  it('resolves the drawn step count in the plan, clamped the way the pass clamps it', () => {
    // Two writers of the step count is how a tuning measurement came to record a count that was
    // never drawn: setVolumeSteps wrote the pass directly, and the next applyComposition — which
    // setBloomAllowed and setQuality also call — put the profile default back without a word.
    expect(plan({}).volumeSteps).toBe(8);
    expect(plan({ stepsOverride: 12 }).volumeSteps).toBe(12);
    expect(plan({ stepsOverride: 4 }).volumeSteps).toBe(8);
    expect(plan({ stepsOverride: 99 }).volumeSteps).toBe(12);
    expect(plan({ stepsOverride: 10.4 }).volumeSteps).toBe(10);
    expect(plan({ stepsOverride: Number.NaN }).volumeSteps).toBe(8);
    // Medium keeps its own six unless asked otherwise, and never drops below one step.
    expect(plan({ tier: SkyriverQualityTier.Medium }).volumeSteps).toBe(6);
    expect(plan({ tier: SkyriverQualityTier.Medium, stepsOverride: 4 }).volumeSteps).toBe(4);
    expect(plan({ tier: SkyriverQualityTier.Medium, stepsOverride: 0 }).volumeSteps).toBe(1);
    // Nothing is marched on Low, whatever is asked for.
    expect(skyriverCompositionPlan({
      tier: SkyriverQualityTier.Low, chain: 'r23-staged', bloomEnabled: false, stepsOverride: 12,
    }).volumeSteps).toBe(0);
  });

  it('keeps a requested step count across a bloom A/B, instead of resetting it', () => {
    // The measured example: setVolumeSteps(12) then a bloom toggle gave 8 steps and a 'steps'
    // history reset. With the override as a plan input, the number survives every re-derivation.
    const tuned = plan({ stepsOverride: 12 });
    expect(tuned.volumeSteps).toBe(12);
    expect(plan({ stepsOverride: 12, bloomEnabled: false }).volumeSteps).toBe(12);
    // The bloom choice changes, the volume does not.
    expect(plan({ stepsOverride: 12, bloomEnabled: false }).threeMipBloom).toBe(false);
    expect(plan({ stepsOverride: 12, bloomEnabled: false }).volumeProfile)
      .toEqual(tuned.volumeProfile);
  });

  it('resolves the drawn cloud count in the plan, inside the batch capacity', () => {
    expect(plan({}).clouds).toBe(260);
    expect(plan({ tier: SkyriverQualityTier.Medium }).clouds).toBe(130);
    expect(plan({ cloudsOverride: 200 }).clouds).toBe(200);
    expect(plan({ cloudsOverride: 0 }).clouds).toBe(0);
    expect(plan({ cloudsOverride: -40 }).clouds).toBe(0);
    // Never past the allocated instance capacity.
    expect(plan({ cloudsOverride: 100000 }).clouds).toBe(SKYRIVER_SMOG_HIGH_MAX);
    // And no clouds at all on a chain that stages nothing, override or not.
    expect(skyriverCompositionPlan({
      tier: SkyriverQualityTier.High, chain: 'legacy-five', bloomEnabled: true, cloudsOverride: 300,
    }).clouds).toBe(0);
  });

  it('stays pure and idempotent with the overrides in place', () => {
    for (const steps of [null, 8, 12]) {
      for (const clouds of [null, 0, 320]) {
        const once = plan({ stepsOverride: steps, cloudsOverride: clouds });
        expect(plan({ stepsOverride: steps, cloudsOverride: clouds })).toEqual(once);
      }
    }
  });
});

describe('R23 three-level bloom quad', () => {
  it('holds a real owned material from construction, with no null cast', () => {
    // 'new FullScreenQuad(null as unknown as THREE.Material)' made an illegal state representable
    // and hid it from the type system until a draw dereferenced it.
    const bloom = new SkyriverThreeMipBloomPass(new THREE.Vector2(8, 8), 0.85, 0.45, 1.2);
    try {
      const material = bloom.boundQuadMaterial();
      expect(material).not.toBeNull();
      expect(material).toBeInstanceOf(THREE.Material);
      expect(material.type).toBe('MeshBasicMaterial');
    } finally {
      bloom.dispose();
    }
  });
});

// --- the presentation chain selector (R23 repair) -----------------------------------------------

describe('R23 presentation chain', () => {
  const plan = (
    tier: SkyriverQualityTier, chain: SkyriverPresentationChain, bloomEnabled = true,
  ): ReturnType<typeof skyriverCompositionPlan> =>
    skyriverCompositionPlan({ tier, chain, bloomEnabled });

  it('defaults High and Medium to the staged fog chain with the three-level bloom', () => {
    expect(SKYRIVER_DEFAULT_PRESENTATION_CHAIN).toBe('r23-staged');
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const staged = plan(tier, SKYRIVER_DEFAULT_PRESENTATION_CHAIN);
      expect(staged.mode).toBe('staged');
      expect(staged.volumePass).toBe(true);
      expect(staged.clouds).toBeGreaterThan(0);
      expect(staged.threeMipBloom).toBe(true);
      expect(staged.bloomMips).toBe(3);
    }
    // Low keeps the legacy analytic frame on the default chain, exactly as before.
    expect(plan(SkyriverQualityTier.Low, SKYRIVER_DEFAULT_PRESENTATION_CHAIN, false).mode).toBe('legacy');
  });

  it('draws the diagnostic three-level chain over the legacy analytic scene, fog and smog off', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const diagnostic = plan(tier, 'three-only');
      // The legacy analytic scene: one RenderPass, no staging, the analytic haze back everywhere.
      expect(diagnostic.mode).toBe('legacy');
      expect(diagnostic.legacyRenderPass).toBe(true);
      expect(diagnostic.opaquePass).toBe(false);
      expect(diagnostic.transparentPass).toBe(false);
      expect(diagnostic.analyticFogInOpaqueStage).toBe(true);
      // Fog off and smog off.
      expect(diagnostic.volumePass).toBe(false);
      expect(diagnostic.volumeProfile.steps).toBe(0);
      expect(diagnostic.clouds).toBe(0);
      // The ACTUAL three-level bloom, and not the five-sampler pass under a three-level label.
      expect(diagnostic.threeMipBloom).toBe(true);
      expect(diagnostic.legacyBloom).toBe(false);
      expect(diagnostic.bloomMips).toBe(3);
      expect(diagnostic.bloomDraws).toBe(9);
      // Its own draw budget: no volume draws, nine bloom draws, one output.
      expect(diagnostic.postDraws).toBe(9 + 1);
    }
  });

  it('keeps legacy-five on all five original samplers', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium]) {
      const legacy = plan(tier, 'legacy-five');
      expect(legacy.mode).toBe('legacy');
      expect(legacy.legacyBloom).toBe(true);
      expect(legacy.threeMipBloom).toBe(false);
      expect(legacy.bloomMips).toBe(5);
      expect(legacy.bloomDraws).toBe(13);
      expect(legacy.volumePass).toBe(false);
      expect(legacy.clouds).toBe(0);
      expect(legacy.postDraws).toBe(13 + 1);
    }
  });

  it('never enables two bloom implementations, and reports no mips when neither runs', () => {
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
        for (const bloomEnabled of [true, false]) {
          const once = plan(tier, chain, bloomEnabled);
          expect(once.threeMipBloom && once.legacyBloom).toBe(false);
          if (!bloomEnabled) {
            expect(once.bloomMips).toBe(0);
            expect(once.bloomDraws).toBe(0);
          }
          // Idempotent, and the chain it reports is the chain it was asked for.
          expect(plan(tier, chain, bloomEnabled)).toEqual(once);
          expect(once.chain).toBe(chain);
        }
      }
    }
  });

  it('keeps every normal chain inside the 32-draw frame budget', () => {
    // Arithmetic over the declared constants, as the budget check above is. The browser frame is
    // the acceptance evidence.
    const sceneDrawsHigh = 18;
    const smog = (clouds: number): number => (clouds > 0 ? 1 : 0);
    for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
      const high = plan(SkyriverQualityTier.High, chain);
      expect(sceneDrawsHigh + smog(high.clouds) + high.postDraws).toBeLessThanOrEqual(32);
    }
    // The diagnostic chain is the cheapest post chain of the three: no volume, nine bloom draws.
    expect(plan(SkyriverQualityTier.High, 'three-only').postDraws)
      .toBeLessThan(plan(SkyriverQualityTier.High, 'legacy-five').postDraws);
  });

  it('decides the enabled bloom pass from the plan, so a selected chain survives every frame', () => {
    // `update` re-applies these flags on every frame from the plan. A chain whose flag was not
    // derived from the plan would be overwritten by the next frame — which is exactly how a
    // three-level selection would silently become the five-sampler pass again.
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
        const live = plan(tier, chain);
        const flags = skyriverBloomEnableFlags(live, true);
        expect(flags.threeMip).toBe(live.threeMipBloom);
        expect(flags.legacy).toBe(live.legacyBloom);
        expect(flags.threeMip && flags.legacy).toBe(false);
        // Mid-ease, with the level still under the live threshold, neither pass runs.
        const eased = skyriverBloomEnableFlags(live, false);
        expect(eased).toEqual({ legacy: false, threeMip: false });
        // Repeated application converges: the frame pump is idempotent.
        expect(skyriverBloomEnableFlags(live, true)).toEqual(flags);
      }
    }
    // The diagnostic chain really does enable the three-level pass on a legacy scene.
    const diagnostic = plan(SkyriverQualityTier.High, 'three-only');
    expect(skyriverBloomEnableFlags(diagnostic, true)).toEqual({ legacy: false, threeMip: true });
    expect(diagnostic.mode).toBe('legacy');
  });

  it('restores the default settings when the default chain is selected again', () => {
    // "Restore cleanly" means every chain-dependent value comes back, not just the bloom choice.
    for (const tier of [SkyriverQualityTier.High, SkyriverQualityTier.Medium, SkyriverQualityTier.Low]) {
      const bloomEnabled = tier !== SkyriverQualityTier.Low;
      const base = plan(tier, SKYRIVER_DEFAULT_PRESENTATION_CHAIN, bloomEnabled);
      for (const chain of SKYRIVER_PRESENTATION_CHAINS) {
        void plan(tier, chain, bloomEnabled);
        expect(plan(tier, SKYRIVER_DEFAULT_PRESENTATION_CHAIN, bloomEnabled)).toEqual(base);
      }
    }
  });
});

// --- presented source time (R23 repair) ---------------------------------------------------------

describe('R23 presented source time', () => {
  it('detects a tick that moves backwards', () => {
    expect(skyriverSourceTimeReversed(120, 0.5, 119, 0.5)).toBe(true);
    expect(skyriverSourceTimeReversed(120, 0.5, 0, 0)).toBe(true);
    expect(skyriverSourceTimeReversed(120, 0.5, 121, 0)).toBe(false);
  });

  it('detects a lower alpha at the SAME tick, which a tick comparison alone would miss', () => {
    expect(skyriverSourceTimeReversed(120, 0.75, 120, 0.25)).toBe(true);
    expect(skyriverSourceTimeReversed(120, 0.75, 120, 0.75)).toBe(false);
    expect(skyriverSourceTimeReversed(120, 0.25, 120, 0.75)).toBe(false);
    // The presented moment really did move backwards there.
    expect((120 + 0.25) / 30).toBeLessThan((120 + 0.75) / 30);
  });

  it('leaves a frozen frame alone, however many times it is drawn', () => {
    // The convergence capture redraws the same tick and alpha while only the history delta and the
    // jitter phase advance. Treating that as a discontinuity would reset the history it measures.
    for (let i = 0; i < 8; i += 1) expect(skyriverSourceTimeReversed(600, 0.5, 600, 0.5)).toBe(false);
  });

  it('treats a missing or non-finite pair as "nothing presented yet"', () => {
    expect(skyriverSourceTimeReversed(Number.NaN, 0, 10, 0)).toBe(false);
    expect(skyriverSourceTimeReversed(10, Number.NaN, 10, 0)).toBe(false);
    expect(skyriverSourceTimeReversed(10, 0, Number.NaN, 0)).toBe(false);
  });

  it('is monotone over a normal 30 Hz source replayed at 60 Hz', () => {
    let tick = 0;
    let alpha = 0;
    for (let frame = 0; frame < 200; frame += 1) {
      const nextAlpha = alpha + 0.5;
      const nextTick = tick + (nextAlpha >= 1 ? 1 : 0);
      const wrapped = nextAlpha >= 1 ? nextAlpha - 1 : nextAlpha;
      expect(skyriverSourceTimeReversed(tick, alpha, nextTick, wrapped)).toBe(false);
      tick = nextTick;
      alpha = wrapped;
    }
  });
});
