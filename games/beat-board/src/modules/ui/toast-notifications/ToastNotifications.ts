import { create } from 'zustand';
import { Toast, ToastStore } from './types';
import { toastConfig } from './config';

let nextId = 1;
function generateId(): string {
  return `toast-${nextId++}`;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show(toastInput: Omit<Toast, 'id'>): string {
    const id = generateId();
    const toast: Toast = { ...toastInput, id };

    set((state) => {
      let toasts = [...state.toasts];
      // If at limit, remove oldest
      if (toasts.length >= toastConfig.maxToasts) {
        toasts = toasts.slice(toasts.length - toastConfig.maxToasts + 1);
      }
      return { toasts: [...toasts, toast] };
    });

    if (toast.durationMs !== null && toast.durationMs !== undefined && toast.durationMs > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, toast.durationMs);
    }

    return id;
  },

  dismiss(id: string) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  dismissAll() {
    set({ toasts: [] });
  },
}));

export function resetToastStore() {
  nextId = 1;
  useToastStore.setState({ toasts: [] });
}
