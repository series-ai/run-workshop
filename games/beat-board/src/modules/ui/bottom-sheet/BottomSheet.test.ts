import { describe, it, expect, beforeEach } from 'vitest';
import { useBottomSheetStore, resetBottomSheetStore } from './BottomSheet';

beforeEach(() => {
  resetBottomSheetStore();
});

describe('BottomSheet', () => {
  it('open sets isOpen and content', () => {
    useBottomSheetStore.getState().open('shop', 'half');
    expect(useBottomSheetStore.getState().isOpen).toBe(true);
    expect(useBottomSheetStore.getState().content).toBe('shop');
    expect(useBottomSheetStore.getState().snapPoint).toBe('half');
  });

  it('open with default snap point is half', () => {
    useBottomSheetStore.getState().open('rewards');
    expect(useBottomSheetStore.getState().snapPoint).toBe('half');
  });

  it('open with full snap point', () => {
    useBottomSheetStore.getState().open('leaderboard', 'full');
    expect(useBottomSheetStore.getState().snapPoint).toBe('full');
  });

  it('close resets state', () => {
    useBottomSheetStore.getState().open('shop');
    useBottomSheetStore.getState().close();
    expect(useBottomSheetStore.getState().isOpen).toBe(false);
    expect(useBottomSheetStore.getState().content).toBeNull();
    expect(useBottomSheetStore.getState().snapPoint).toBe('closed');
  });

  it('setSnap changes snapPoint', () => {
    useBottomSheetStore.getState().open('shop', 'half');
    useBottomSheetStore.getState().setSnap('full');
    expect(useBottomSheetStore.getState().snapPoint).toBe('full');
  });

  it('setSnap to closed closes sheet', () => {
    useBottomSheetStore.getState().open('shop');
    useBottomSheetStore.getState().setSnap('closed');
    expect(useBottomSheetStore.getState().isOpen).toBe(false);
  });
});
