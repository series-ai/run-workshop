import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectErrors, openTab } from './helpers'

const chest = (JSON.parse(readFileSync(join(import.meta.dirname, '../public/catalog/fantasy/catalog.json'), 'utf8')) as { models: { id: string; bounds: { size: number[] } }[] }).models.find(
  (m) => m.id === 'fantasy-animated-props-treasure-chest',
)!
const staffName = (JSON.parse(readFileSync(join(import.meta.dirname, '../public/catalog/fantasy/catalog.json'), 'utf8')) as { models: { id: string; name: string }[] }).models.find(
  (m) => m.id === 'fantasy-held-items-mage-staff',
)!.name
const CHEST_VOXELS = `${chest.bounds.size.map((v) => Math.round(v)).join(' × ')} voxels`

for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  test(`every tab loads PN + fantasy at ${w}px`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/')
    await expect(page.locator('.landing-pack').first()).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `e2e/screenshots/home-${w}.png` })
    await openTab(page, 'Models')
    await expect(page.locator('.model-card').first()).toBeVisible({ timeout: 30_000 })
    const packs = page.getByRole('group', { name: 'Pack filter' })
    await expect(packs.getByRole('button', { name: 'Pirate Nation' })).toBeVisible()
    await packs.getByRole('button', { name: 'Fantasy' }).click()
    await page.locator('[data-model-id="fantasy-animated-props-treasure-chest"]').click()
    await expect(page.getByTestId('bounds-readout')).toContainText(CHEST_VOXELS)
    const viewer = page.getByRole('group', { name: /^3D view of/ })
    await viewer.focus()
    for (const key of ['ArrowLeft', 'ArrowUp', '+', '-', '0']) await viewer.press(key)
    await page.getByRole('button', { name: 'Orbit right' }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `e2e/screenshots/models-${w}.png` })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    await openTab(page, 'Scene')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `e2e/screenshots/scene-${w}.png` })

    await openTab(page, 'Avatar Lab')
    await expect(page.getByLabel('tops')).toBeVisible()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `e2e/screenshots/avatar-${w}.png` })
    await expect(page.locator('.viewer-error')).toHaveCount(0)

    await openTab(page, 'PFX')
    await page.locator('[data-effect-id="rvx-fantasy-arcane-bolt"]').click()
    await expect(page.getByTestId('pfx-readout')).toContainText(staffName)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `e2e/screenshots/pfx-${w}.png` })
    await expect(page.locator('.viewer-error')).toHaveCount(0)

    await openTab(page, 'Sprites')
    await expect(page.locator('.sprite-tile').first()).toBeVisible()
    await page.screenshot({ path: `e2e/screenshots/sprites-${w}.png` })
    expect(errors).toEqual([])
  })
}
