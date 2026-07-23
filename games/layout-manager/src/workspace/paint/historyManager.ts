import type { Layer } from './types';

export interface HistorySnapshot {
  layerData: Map<string, ImageData>;
}

const MAX_HISTORY = 30;

export class HistoryManager {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];

  /** Take a snapshot of all layers' current state. */
  snapshot(layers: Layer[]): void {
    const snap = captureSnapshot(layers);
    this.undoStack.push(snap);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Undo: restore the most recent snapshot. Returns true if undo was performed. */
  undo(layers: Layer[]): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(captureSnapshot(layers));
    const snap = this.undoStack.pop()!;
    restoreSnapshot(layers, snap);
    return true;
  }

  /** Redo: restore from redo stack. Returns true if redo was performed. */
  redo(layers: Layer[]): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(captureSnapshot(layers));
    const snap = this.redoStack.pop()!;
    restoreSnapshot(layers, snap);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

function captureSnapshot(layers: Layer[]): HistorySnapshot {
  const layerData = new Map<string, ImageData>();
  for (const layer of layers) {
    const ctx = layer.canvas.getContext('2d')!;
    layerData.set(
      layer.id,
      ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
    );
  }
  return { layerData };
}

function restoreSnapshot(layers: Layer[], snap: HistorySnapshot): void {
  for (const layer of layers) {
    const data = snap.layerData.get(layer.id);
    if (data) {
      const ctx = layer.canvas.getContext('2d')!;
      ctx.putImageData(data, 0, 0);
    }
  }
}
