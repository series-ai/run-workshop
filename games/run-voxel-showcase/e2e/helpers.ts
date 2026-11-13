import type { Page } from '@playwright/test'

export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    // Missing thumbnails are an expected 404 until `npm run thumbnails` runs.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`)
  })
  return errors
}

export async function openTab(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}
