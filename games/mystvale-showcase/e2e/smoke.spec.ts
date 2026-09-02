import { test, expect } from '@playwright/test'

test.describe('Mystvale Showcase App', () => {
  test('loads dashboard and navigates across all 6 tabs', async ({ page }) => {
    await page.goto('/')

    // 1. Dashboard Tab
    await expect(page.locator('h1')).toContainText('Mystvale Asset Showcase')
    await expect(page.getByText('MIT Open Source Game Pack')).toBeVisible()
    await expect(page.getByText('Total Files')).toBeVisible()

    // 2. Avatar Lab Tab
    await page.locator('[data-tab="avatar"]').click()
    await expect(page.locator('h2:has-text("Avatar Lab")')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Randomize' }).click()

    // 3. Crops & Farm Tab
    await page.locator('[data-tab="crops"]').click()
    await expect(page.locator('h2:has-text("Crop & Farm Simulator")')).toBeVisible()
    await expect(page.getByText('Wheat Growth Progression')).toBeVisible()
    await expect(page.getByText('Interactive 3x3 Farm Plot')).toBeVisible()
    await page.getByRole('button', { name: 'Advance Day (Grow)' }).click()

    // 4. UI & Icons Tab
    await page.locator('[data-tab="ui"]').click()
    await expect(page.locator('h2:has-text("UI & Icon Explorer")')).toBeVisible()
    await expect(page.getByText('WOOD FRAME')).toBeVisible()
    await expect(page.getByText('Categorized 32x32 Icon Registry')).toBeVisible()

    // 5. World Stage Tab
    await page.locator('[data-tab="world"]').click()
    await expect(page.locator('h2:has-text("World & Autotile Stage")')).toBeVisible()
    await expect(page.getByText('4-Bit Autotile Terrain Painter')).toBeVisible()
    await expect(page.getByText('World Objects & Collisions')).toBeVisible()

    // 6. Audio Room Tab
    await page.locator('[data-tab="audio"]').click()
    await expect(page.locator('h2:has-text("Cozy Audio Room")')).toBeVisible()
    await expect(page.getByText('Background Music')).toBeVisible()
    await expect(page.getByText('Interactive Sound Effects Board')).toBeVisible()
  })
})
