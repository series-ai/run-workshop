import { create } from 'zustand';
import { ConfirmDialogStore, ConfirmDialogOptions } from './types';
import { ensureConfirmDialogHostMounted } from './portal';

export const useConfirmDialogStore = create<ConfirmDialogStore>((set, get) => ({
  isOpen: false,
  options: null,
  resolve: null,

  show(options: ConfirmDialogOptions): Promise<boolean> {
    ensureConfirmDialogHostMounted();
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, options, resolve });
    });
  },

  confirm() {
    const { resolve } = get();
    set({ isOpen: false, options: null, resolve: null });
    resolve?.(true);
  },

  cancel() {
    const { resolve } = get();
    set({ isOpen: false, options: null, resolve: null });
    resolve?.(false);
  },
}));

export function resetConfirmDialogStore() {
  useConfirmDialogStore.setState({ isOpen: false, options: null, resolve: null });
}
