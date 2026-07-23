import { useRef, useCallback, useMemo } from 'react';

interface DragState {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

/** Hook for making a modal draggable by its header. */
export function useDraggableModal() {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = panelRef.current?.offsetWidth ?? 440;
    const x = Math.max(-pw + 40, Math.min(vw - 40, dragRef.current.ox + dx));
    const y = Math.max(0, Math.min(vh - 40, dragRef.current.oy + dy));
    const el = panelRef.current;
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.transform = 'none';
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return { panelRef, onPointerDown, onPointerMove, onPointerUp };
}

/** Compute toolbar-aligned position for an AI modal. */
export function useAlignedPosition(rulersVisible: boolean, aiChatOpen: boolean, chatDefaultPos: boolean): { top: number; left: number } {
  return useMemo(() => {
    const baseLeft = rulersVisible ? 28 : 8;
    const top = rulersVisible ? 80 : 60;
    const chatWidth = 720;
    const gap = 8;
    const left = aiChatOpen && chatDefaultPos ? baseLeft + chatWidth + gap : baseLeft;
    return { top, left };
  }, [rulersVisible, aiChatOpen, chatDefaultPos]);
}
