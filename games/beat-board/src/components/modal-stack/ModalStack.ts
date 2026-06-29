import { create } from 'zustand';
import { Modal, ModalPriority, ModalStore } from './types';
import { modalConfig } from './config';
import { ensureModalStackHostMounted } from './portal';

function sortByPriority(modals: Modal[]): Modal[] {
  return [...modals].sort(
    (a, b) => (b.priority ?? ModalPriority.NORMAL) - (a.priority ?? ModalPriority.NORMAL)
  );
}

export const useModalStore = create<ModalStore>((set, get) => ({
  stack: [],
  queue: [],
  suppressed: false,

  push(modal: Modal) {
    // Guarantee a host portal exists before the first render cycle. Makes the
    // module self-mounting so consumers don't need to import ModalStackRoot
    // in App.tsx for the modal to become visible.
    ensureModalStackHostMounted();
    const { stack, suppressed, queue } = get();
    // Deduplicate: don't push/queue if already visible or queued
    if (stack.some((m) => m.id === modal.id)) return;
    if (queue.some((m) => m.id === modal.id)) return;

    if (suppressed) {
      set({ queue: sortByPriority([...queue, modal]) });
      return;
    }

    if (stack.length >= modalConfig.maxDepth) return;
    set({ stack: [...stack, modal] });
  },

  pop() {
    const { stack, queue } = get();
    if (stack.length === 0) return;

    const newStack = stack.slice(0, -1);
    const next = queue[0];

    // If there are queued modals and room in the stack, promote the top one
    if (next !== undefined && newStack.length < modalConfig.maxDepth) {
      const rest = queue.slice(1);
      set({ stack: [...newStack, next], queue: rest });
    } else {
      set({ stack: newStack });
    }
  },

  popAll() {
    set({ stack: [] });
  },

  replace(modal: Modal) {
    const { stack } = get();
    if (stack.length === 0) {
      set({ stack: [modal] });
    } else {
      set({ stack: [...stack.slice(0, -1), modal] });
    }
  },

  isOpen(id: string) {
    return get().stack.some((m) => m.id === id);
  },

  suppress() {
    set({ suppressed: true });
  },

  unsuppress() {
    const { queue, stack } = get();
    if (queue.length === 0) {
      set({ suppressed: false });
      return;
    }

    if (stack.length >= modalConfig.maxDepth) {
      set({ suppressed: false });
      return;
    }

    // Lift suppression and show only the highest-priority queued modal.
    // Remaining queued modals promote one by one as each visible modal closes.
    const [next, ...remaining] = queue;
    if (next === undefined) {
      set({ suppressed: false });
      return;
    }

    set({
      suppressed: false,
      stack: [...stack, next],
      queue: remaining,
    });
  },

  isQueued(id: string) {
    return get().queue.some((m) => m.id === id);
  },

  dequeue(id: string) {
    set((state) => ({ queue: state.queue.filter((m) => m.id !== id) }));
  },
}));

export function resetModalStore() {
  useModalStore.setState({ stack: [], queue: [], suppressed: false });
}
