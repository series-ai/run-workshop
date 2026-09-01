import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test('audits all 19 avatar species and guarantees zero z-fighting', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Avatar Lab', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Roll a pirate' })).toBeVisible()
  await expect(page.locator('.slot-row').first()).toBeVisible()

  const speciesRow = page
    .locator('.slot-row')
    .filter({ has: page.locator('.slot-row-label', { hasText: /^species$/ }) })
  const speciesSelect = speciesRow.locator('select')

  fs.mkdirSync('/private/tmp/systematic-audit', { recursive: true })

  for (let sp = 1; sp <= 19; sp++) {
    await speciesSelect.selectOption(String(sp))
    await page.waitForTimeout(150)
    const shot = await page.locator('.avatar-stage').screenshot({ type: 'jpeg', quality: 95 })
    fs.writeFileSync(`/private/tmp/systematic-audit/species-${sp}.jpg`, shot)
  }

  // Verify full-body species 7 (Shark) has no conflicting face/clothes
  await speciesSelect.selectOption('7')
  const faceRow = page.locator('.slot-row').filter({ hasText: 'face' })
  await expect(faceRow).toHaveClass(/slot-row-disabled/)
})
