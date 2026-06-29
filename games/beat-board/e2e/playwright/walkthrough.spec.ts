import { test } from './fixtures';
import { baselineWalkthroughContract } from './walkthrough-contract';

test.describe('@walkthrough @remote-safe Baseline walkthrough', () => {
  test(`${baselineWalkthroughContract.id}: ${baselineWalkthroughContract.description}`, async ({
    gamePage,
  }) => {
    await baselineWalkthroughContract.run(gamePage);
  });
});
