import { expect, test } from '@playwright/test';

const messageBox = (page: import('@playwright/test').Page) =>
    page.getByRole('textbox', { name: 'Message Mira' });

test('keeps conversation starter text inside each button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('At the fire')).toBeVisible();

    const bounds = await page.getByLabel('Conversation starters')
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => {
            const buttonBounds = button.getBoundingClientRect();
            const textRange = document.createRange();
            textRange.selectNodeContents(button);
            const textBounds = textRange.getBoundingClientRect();

            return {
                buttonLeft: buttonBounds.left,
                buttonRight: buttonBounds.right,
                textLeft: textBounds.left,
                textRight: textBounds.right,
            };
        }));

    for (const bound of bounds) {
        expect(bound.textLeft).toBeGreaterThanOrEqual(bound.buttonLeft);
        expect(bound.textRight).toBeLessThanOrEqual(bound.buttonRight);
    }
});

test('keeps the conversation menu above message content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('At the fire')).toBeVisible();

    for (let index = 1; index <= 5; index += 1) {
        await messageBox(page).fill(`Tell me about signal ${index}.`);
        await messageBox(page).press('Enter');
        await expect(page.getByText(/It listens for the old weather beacons/))
            .toHaveCount(index);
        await expect(page.getByText('At the fire')).toBeVisible();
    }

    await page.getByRole('button', { name: 'Conversation options' }).click();
    const menuOwnsOverlap = await page.locator('.conversation-menu').evaluate((menu) => {
        const bounds = menu.getBoundingClientRect();
        const target = document.elementFromPoint(bounds.left + 20, bounds.top + 80);
        return target !== null && menu.contains(target);
    });

    expect(menuOwnsOverlap).toBe(true);
});

test('runs text, tool, question, reload, rejection, and approval flows', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('At the fire')).toBeVisible();

    await page.getByRole('button', { name: 'What is that tower listening for?' }).click();
    await expect(page.getByText(/It listens for the old weather beacons/)).toBeVisible();
    await expect(page.getByText('At the fire')).toBeVisible();

    await messageBox(page).fill('Look around. What has changed tonight?');
    await messageBox(page).press('Enter');
    await expect(page.getByText(/The rain has reached the fire line/)).toBeVisible();
    await expect(page.getByText('Checking the camp')).toBeVisible();
    await expect(page.getByText('At the fire')).toBeVisible();

    await messageBox(page).fill('Help me choose which path to take.');
    await messageBox(page).press('Enter');
    await expect(page.getByText('Which route should we use through the marsh?', { exact: true }))
        .toBeVisible();
    await expect(page.getByText('No reply')).toHaveCount(0);
    await expect(messageBox(page)).toBeDisabled();

    await page.reload();
    await expect(page.getByRole('region', { name: 'Mira needs your input' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Answer Mira' }).fill('The lit boardwalk');
    await page.getByRole('button', { name: 'Continue conversation' }).dblclick();
    await expect(page.getByText(/we will use the lit boardwalk/i)).toBeVisible();
    await expect(page.getByText(/we will use the lit boardwalk/i)).toHaveCount(1);
    await expect(page.getByText('At the fire')).toBeVisible();

    await messageBox(page).fill('I want to take the signal job.');
    await messageBox(page).press('Enter');
    await expect(page.getByText('CONFIRM ACTION')).toBeVisible();
    await expect(messageBox(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.getByRole('button', { name: 'Continue conversation' }).click();
    await expect(page.getByText(/leave the signal route unmarked/i)).toBeVisible();
    await expect(page.getByText('At the fire')).toBeVisible();

    await messageBox(page).fill('I want to take the signal job.');
    await messageBox(page).press('Enter');
    await page.getByRole('button', { name: 'Allow' }).click();
    await page.getByRole('button', { name: 'Continue conversation' }).click();
    await expect(page.getByText(/marked the tower route on your map/i)).toBeVisible();
    await expect(page.getByText('Adding the quest')).toBeVisible();
});

test('blocks a stale writer and lets it load the latest session', async ({ context, page }) => {
    await page.goto('/');
    await expect(page.getByText('At the fire')).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto('/');
    await expect(secondTab.getByText('At the fire')).toBeVisible();

    await messageBox(page).fill('Can you still hear me?');
    await messageBox(page).press('Enter');
    await expect(page.getByText('This chat moved in another tab.')).toBeVisible();
    await expect(page.getByText('No reply')).toHaveCount(0);
    await expect(messageBox(page)).toHaveAttribute('placeholder', 'Load the latest conversation first');

    await page.getByRole('button', { name: 'Load latest' }).click();
    await expect(page.getByText('At the fire')).toBeVisible();
    await expect(page.getByText('This chat moved in another tab.')).toHaveCount(0);
});
