import type { YardRender } from './presentation';

const SLOT_COLORS = ['#d4efff', '#ffb264', '#b8ffb0', '#f0a0ff'];

export function bodyOutlineColor(bodyId: string, hoverColor: string | null, render: YardRender | null): string | null {
  if (render?.torching.includes(bodyId)) return '#ffb264';
  const slot = render?.grabbed.indexOf(bodyId) ?? -1;
  return slot >= 0 ? SLOT_COLORS[slot % SLOT_COLORS.length]! : hoverColor;
}
