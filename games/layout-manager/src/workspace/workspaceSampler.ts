/**
 * Bridge that lets the generic ColorPicker eyedropper sample true workspace
 * pixels. CanvasMenu registers a sampler backed by its renderWorkspaceCanvas
 * (the same compositor used for export and the page-background eyedropper —
 * crops, flips, rotation, paint layers, and adjustments all handled), so the
 * eyedropper sees exactly what's on the page.
 */

export type WorkspaceSampler = (clientX: number, clientY: number) => Promise<string | null>;

let current: WorkspaceSampler | null = null;

export function registerWorkspaceSampler(fn: WorkspaceSampler): () => void {
  current = fn;
  return () => { if (current === fn) current = null; };
}

/** Sample the workspace at a client point; null when off-page or unregistered. */
export function sampleWorkspacePixel(clientX: number, clientY: number): Promise<string | null> {
  return current ? current(clientX, clientY) : Promise.resolve(null);
}
