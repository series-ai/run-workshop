import { expect } from '@playwright/test';
import type { GamePage } from './fixtures';

export interface WalkthroughContract {
  id: string;
  description: string;
  run(gamePage: GamePage): Promise<void>;
}

export const baselineWalkthroughContract: WalkthroughContract = {
  id: 'startup-primary-action',
  description: 'Reach the ready shell and perform the first visible primary action.',
  async run(gamePage) {
    await gamePage.goto('/');

    await expect(gamePage.page.getByTestId('app-shell')).toBeVisible();
    await expect(gamePage.page.getByText('Counter with Storage')).toBeVisible();

    const counterValue = gamePage.page.getByTestId('counter-value');
    const initialValue = (await counterValue.textContent())?.trim() ?? '';

    await gamePage.page.getByTestId('counter-increment').click();
    await expect(counterValue).not.toHaveText(initialValue);
  },
};
