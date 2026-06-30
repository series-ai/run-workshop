import { create } from 'zustand';
import type { BottomSheetContent, BottomSheetStore, SnapPoint } from './types';
import { ensureBottomSheetHostMounted } from './portal';

export const useBottomSheetStore = create<BottomSheetStore>((set) => ({
  isOpen: false,
  snapPoint: 'closed',
  content: null,

  open(content: BottomSheetContent, initialSnap: SnapPoint = 'half') {
    // Guarantee a host portal exists before the first render cycle. This
    // makes the module self-mounting — no consumer needs to import
    // `BottomSheetRoot` in App.tsx for the sheet to become visible.
    ensureBottomSheetHostMounted();
    set({ isOpen: true, content, snapPoint: initialSnap });
  },

  close() {
    set({ isOpen: false, snapPoint: 'closed', content: null });
  },

  setSnap(point: SnapPoint) {
    if (point === 'closed') {
      set({ isOpen: false, snapPoint: 'closed' });
    } else {
      set({ snapPoint: point });
    }
  },
}));

export function resetBottomSheetStore() {
  useBottomSheetStore.setState({ isOpen: false, snapPoint: 'closed', content: null });
}
