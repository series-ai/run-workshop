/**
 * @file main.ts — Skyriver entry (T1 scaffold stub).
 * T2-T5 replace this with the syncplay runner boot, render pipeline, and HUD.
 */

export function boot(): void {
  const root = document.getElementById('app');
  if (root) {
    root.textContent = 'Skyriver — scaffold live. Sim wiring lands in T2.';
  }
}

if (typeof document !== 'undefined') {
  boot();
}
