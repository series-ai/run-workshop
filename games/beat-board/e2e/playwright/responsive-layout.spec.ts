import { test } from './fixtures';
import { assertPhoneLayoutContract } from './test-utils';

test.describe('@responsive Template phone layout contract', () => {
  test('keeps the home screen usable on a 390x844 portrait viewport', async ({ gamePage }) => {
    await gamePage.page.setViewportSize({ width: 390, height: 844 });
    await gamePage.goto('/');
    await assertPhoneLayoutContract(gamePage, {
      screenRootSelector: '[data-testid="app-shell"]',
      primaryRegionSelector: '[data-testid="pad-grid-stage"]',
      phoneGridSelector: '[data-testid^="pad-block-grid-"]',
    });
  });
});
