import { expect, test } from '@playwright/test'

// Smoke: every tab renders against the real pack on the dev server. The 3D
// canvases need WebGL; headless Chromium provides it via SwiftShader, but if
// a runner has no GL at all the app's error boundary is the correct outcome —
// both count as "rendered".

test('overview tab renders the pack manifest', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Pirate Nation Art & Audio Pack' })).toBeVisible()
  await expect(page.getByText('375')).toBeVisible()
  await expect(page.getByText('World Bosses & Sea Monsters')).toBeVisible()
})

test('models tab lists the catalog and opens the 3D viewer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models' }).click()

  const search = page.getByPlaceholder(/Search 375 models/)
  await expect(search).toBeVisible()

  // Filter to a known small model, open its detail view.
  await search.fill('kraken')
  const card = page.getByRole('button', { name: /Kraken/ }).first()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page.getByRole('heading', { name: /Kraken/ })).toBeVisible()
  // WebGL canvas, or the app's error boundary where GL is unavailable.
  await expect(page.locator('.model-viewer canvas, .viewer-error').first()).toBeVisible()
})

test('avatar lab renders the character creator', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Avatar Lab' }).click()

  await expect(page.getByRole('button', { name: 'Roll a pirate' })).toBeVisible()
  await expect(page.getByText(/Parts \(326 across 12 slots\)/)).toBeVisible()
  await expect(page.locator('.avatar-stage canvas, .viewer-error').first()).toBeVisible()
})

test('sprites tab renders the grid', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sprites' }).click()

  await expect(page.getByPlaceholder(/Search 513 sprites/)).toBeVisible()
  const images = page.locator('.sprite-tile img')
  await expect(images.first()).toBeVisible()
  expect(await images.count()).toBeGreaterThan(50)
})

test('audio tab lists tracks with lazy players', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Audio' }).click()

  const players = page.locator('audio[preload="none"]')
  await expect(players.first()).toBeAttached()
  expect(await players.count()).toBe(30)
})
