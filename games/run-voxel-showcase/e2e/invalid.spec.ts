/**
 * A12: deliberately broken RUN files and catalog entries fail loudly with a
 * named guard error, and the rest of the gallery keeps rendering. Fixtures
 * come from `node --import tsx scripts/make-invalid-fixtures.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const FIXTURES = join(import.meta.dirname, 'fixtures/out')
const catalogFile = join(import.meta.dirname, '../public/catalog/fantasy/catalog.json')

type Entry = Record<string, unknown> & { id: string; name: string; relativePath: string; filename: string; clips: string[]; sockets: string[]; bounds: { min: number[]; max: number[]; size: number[] } }

function brokenCatalog(): { catalog: Record<string, unknown>; ids: string[] } {
  const catalog = JSON.parse(readFileSync(catalogFile, 'utf8')) as { models: Entry[]; avatar: { partsModelPath: string; clipsModelPath: string } }
  const barrel = catalog.models.find((m) => m.id === 'fantasy-props-barrel')!
  const variant = (id: string, patch: Partial<Entry>): Entry => ({ ...structuredClone(barrel), id, name: id, ...patch })
  const bad = [
    variant('fantasy-props-bad-sampler', { relativePath: 'fixtures/linear-barrel.glb', filename: 'linear-barrel.glb' }),
    variant('fantasy-props-bad-clip', { clips: ['open'] }),
    variant('fantasy-props-bad-socket', { sockets: ['socket-missing'] }),
    variant('fantasy-props-bad-bounds', { bounds: { min: [-6, 0, -6], max: [6, 26, 6], size: [12, 26, 12] } }),
  ]
  catalog.models.push(...bad)
  // The swapped parts file keeps a catalog entry, so only the rig guard can reject it.
  const parts = catalog.models.find((m) => m.id === 'fantasy-avatar-parts')!
  catalog.models.push({ ...structuredClone(parts), id: 'fantasy-avatar-swapped', relativePath: 'fixtures/swapped-avatar-parts.glb', filename: 'swapped-avatar-parts.glb' })
  catalog.avatar.partsModelPath = 'fixtures/swapped-avatar-parts.glb'
  catalog.avatar.clipsModelPath = 'fixtures/swapped-avatar-parts.glb'
  return { catalog, ids: bad.map((b) => b.id) }
}

async function serveFixtures(page: Page, catalog: unknown): Promise<void> {
  await page.route('**/catalog/fantasy/catalog.json', (route) => route.fulfill({ json: catalog }))
  await page.route('**/jam/run-voxel-fantasy/3D/*/fixtures/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    return route.fulfill({ body: readFileSync(join(FIXTURES, name)), contentType: 'model/gltf-binary' })
  })
}

test('each broken model shows its named contract error; the gallery survives', async ({ page }) => {
  const { catalog, ids } = brokenCatalog()
  await serveFixtures(page, catalog)
  await page.goto('/')
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('group', { name: 'Pack filter' }).getByRole('button', { name: 'Fantasy' }).click()
  const expected: Record<string, string> = {
    'fantasy-props-bad-sampler': 'material.sampler',
    'fantasy-props-bad-clip': 'clips.missing',
    'fantasy-props-bad-socket': 'sockets.missing',
    'fantasy-props-bad-bounds': 'bounds.mismatch',
  }
  // The broken variants sit past the first grid page; search brings them up.
  await page.getByPlaceholder('Search models').fill('props-bad')
  for (const id of ids) {
    await page.locator(`[data-model-id="${id}"]`).click()
    const alert = page.locator('.viewer-error[data-error-name="AssetContractError"]')
    await expect(alert).toContainText(expected[id]!, { timeout: 20_000 })
    await expect(page.locator('.model-card')).toHaveCount(ids.length)
  }
})

test('swapped avatar joints raise RigMismatchError in the Avatar Lab', async ({ page }) => {
  const { catalog } = brokenCatalog()
  await serveFixtures(page, catalog)
  await page.goto('/')
  await page.getByRole('button', { name: 'Avatar Lab', exact: true }).click()
  await page.getByLabel('tops').selectOption('fantasy:tops:1')
  await expect(page.locator('.viewer-error[data-error-name="RigMismatchError"]')).toContainText('joint order', { timeout: 20_000 })
  await expect(page.getByLabel('tops')).toBeVisible()
})

test('a schema-invalid catalog is refused by name', async ({ page }) => {
  await page.route('**/catalog/fantasy/catalog.json', (route) => route.fulfill({ json: { pack: 'fantasy', models: 'nope' } }))
  await page.goto('/')
  await expect(page.locator('.load-error')).toContainText('CatalogError: catalog "fantasy" is invalid')
})
