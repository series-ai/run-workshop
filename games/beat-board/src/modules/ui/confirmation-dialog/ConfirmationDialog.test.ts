import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirmDialogStore, resetConfirmDialogStore } from './ConfirmationDialog';

beforeEach(() => {
  resetConfirmDialogStore();
});

describe('ConfirmationDialog', () => {
  it('show() opens dialog and stores options', async () => {
    const options = { title: 'Delete?', message: 'Are you sure?' };
    const promise = useConfirmDialogStore.getState().show(options);
    expect(useConfirmDialogStore.getState().isOpen).toBe(true);
    expect(useConfirmDialogStore.getState().options).toEqual(options);
    // Cleanup
    useConfirmDialogStore.getState().cancel();
    await promise;
  });

  it('confirm() resolves with true', async () => {
    const options = { title: 'Buy?', message: 'Spend 100 coins?' };
    const promise = useConfirmDialogStore.getState().show(options);
    useConfirmDialogStore.getState().confirm();
    const result = await promise;
    expect(result).toBe(true);
  });

  it('cancel() resolves with false', async () => {
    const options = { title: 'Delete?', message: 'This cannot be undone.' };
    const promise = useConfirmDialogStore.getState().show(options);
    useConfirmDialogStore.getState().cancel();
    const result = await promise;
    expect(result).toBe(false);
  });

  it('dialog closes after confirm', async () => {
    const promise = useConfirmDialogStore.getState().show({ title: 'T', message: 'M' });
    useConfirmDialogStore.getState().confirm();
    await promise;
    expect(useConfirmDialogStore.getState().isOpen).toBe(false);
    expect(useConfirmDialogStore.getState().options).toBeNull();
  });

  it('dialog closes after cancel', async () => {
    const promise = useConfirmDialogStore.getState().show({ title: 'T', message: 'M' });
    useConfirmDialogStore.getState().cancel();
    await promise;
    expect(useConfirmDialogStore.getState().isOpen).toBe(false);
  });
});
