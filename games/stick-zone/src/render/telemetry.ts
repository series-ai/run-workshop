/**
 * @file telemetry.ts
 * Real-time in-engine performance telemetry and frame budget analyzer.
 * Measures FPS, 1% low FPS, frame delta time, frame time spikes (>24ms, >33ms, >50ms),
 * WebGL draw calls, rendered triangles, active particles, and active projectiles.
 */
import type * as THREE from 'three';

export interface PerformanceSnapshot {
  fps: number;
  fpsOnePercentLow: number;
  frameTimeMs: number;
  frameTimeAvgMs: number;
  frameTimeMaxMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  activeParticles: number;
  activeProjectiles: number;
  spikes24ms: number;
  spikes33ms: number;
  spikes50ms: number;
  appRenderCount: number;
  sampleCount: number;
}

export class PerformanceCollector {
  private static instance: PerformanceCollector | null = null;
  private frameTimes: number[] = new Array(120).fill(16.6);
  private frameIndex: number = 0;
  private lastTime: number = typeof performance !== 'undefined' ? performance.now() : 0;
  private spikeCount24: number = 0;
  private spikeCount33: number = 0;
  private spikeCount50: number = 0;
  private currentSnapshot: PerformanceSnapshot = {
    fps: 60,
    fpsOnePercentLow: 60,
    frameTimeMs: 16.6,
    frameTimeAvgMs: 16.6,
    frameTimeMaxMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    activeParticles: 0,
    activeProjectiles: 0,
    spikes24ms: 0,
    spikes33ms: 0,
    spikes50ms: 0,
    appRenderCount: 0,
    sampleCount: 0,
  };
  private overlayVisible: boolean = false;
  private listeners: Set<(snap: PerformanceSnapshot) => void> = new Set();

  public static get(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }

  public recordFrame(gl?: THREE.WebGLRenderer, frameDeltaMs?: number, activeParticles = 0, activeProjectiles = 0): void {
    if (typeof performance === 'undefined') return;
    const now = performance.now();
    const measured = now - this.lastTime;
    this.lastTime = now;
    const delta = (frameDeltaMs !== undefined && frameDeltaMs > 0 && frameDeltaMs < 200) ? frameDeltaMs : measured;

    if (delta <= 0 || delta > 1000) return;

    this.frameTimes[this.frameIndex] = delta;
    this.frameIndex = (this.frameIndex + 1) % this.frameTimes.length;

    if (delta > 50) this.spikeCount50++;
    else if (delta > 33.3) this.spikeCount33++;
    else if (delta > 24) this.spikeCount24++;

    // Compute rolling window statistics
    let sum = 0;
    let max = 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      sum += sorted[i];
      if (sorted[i] > max) max = sorted[i];
    }
    const avg = sum / sorted.length;
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const fps = delta > 0 ? Math.round(1000 / delta) : 60;
    const fpsOnePercentLow = p99 > 0 ? Math.round(1000 / p99) : 60;

    const appRenderCount = typeof window !== 'undefined'
      ? (window as any).__STICK_ZONE_APP_RENDER_COUNT__ || 0
      : 0;

    this.currentSnapshot = {
      fps,
      fpsOnePercentLow,
      frameTimeMs: Math.round(delta * 10) / 10,
      frameTimeAvgMs: Math.round(avg * 10) / 10,
      frameTimeMaxMs: Math.round(max * 10) / 10,
      drawCalls: gl ? gl.info.render.calls : 0,
      triangles: gl ? gl.info.render.triangles : 0,
      geometries: gl ? gl.info.memory.geometries : 0,
      textures: gl ? gl.info.memory.textures : 0,
      activeParticles,
      activeProjectiles,
      spikes24ms: this.spikeCount24,
      spikes33ms: this.spikeCount33,
      spikes50ms: this.spikeCount50,
      appRenderCount,
      sampleCount: this.currentSnapshot.sampleCount + 1,
    };

    if (this.currentSnapshot.sampleCount % 4 === 0) {
      for (const listener of this.listeners) {
        listener(this.currentSnapshot);
      }
    }
  }

  public getSnapshot(): PerformanceSnapshot {
    return this.currentSnapshot;
  }

  public isOverlayVisible(): boolean {
    return this.overlayVisible;
  }

  public toggleOverlay(): boolean {
    this.overlayVisible = !this.overlayVisible;
    return this.overlayVisible;
  }

  public setOverlayVisible(visible: boolean): void {
    this.overlayVisible = visible;
  }

  public subscribe(listener: (snap: PerformanceSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const telemetry = PerformanceCollector.get();

// Expose telemetry on window for automated Playwright inspection
if (typeof window !== 'undefined') {
  (window as any).__STICK_ZONE_PERF__ = {
    getSnapshot: () => telemetry.getSnapshot(),
    toggleOverlay: () => telemetry.toggleOverlay(),
    setOverlayVisible: (v: boolean) => telemetry.setOverlayVisible(v),
  };
}
