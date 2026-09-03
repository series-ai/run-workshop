import { expect, test, type Page } from '@playwright/test'

const MODEL_PACK = '/packs/proofofplay-pirate-nation/3D/pirate@2ae870ead5c1/'
const ICON_PACK = '/packs/proofofplay-pirate-nation/icons@ec3e46dfcd27/'
const UI_PACK = '/packs/proofofplay-pirate-nation/ui@97835c36f9f1/'
const AUDIO_PACK = '/packs/proofofplay-pirate-nation/audio@064b51d95ed5/'
const AVATAR_MODEL = 'characters-skins/characters-skins-avatar-animation-all-023.glb'

function requestUrls(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

// Smoke: every tab renders against the real pack on the dev server. The 3D
// canvases need WebGL; headless Chromium provides it via SwiftShader, but if
// a runner has no GL at all the app's error boundary is the correct outcome —
// both count as "rendered".

test('Home introduces the pack and routes to each surface', async ({ page }) => {
  const urls = requestUrls(page)
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your next world.' })).toBeVisible()
  await expect(page.getByTestId('home-progress')).toHaveText(/0 \/ 5 reviewed/)
  await expect(page.getByTestId('home-route-models')).toBeVisible()
  await expect(page.getByTestId('home-route-scene')).toBeVisible()
  await expect(page.getByTestId('home-route-avatar')).toBeVisible()
  await expect(page.getByTestId('home-route-sprites')).toBeVisible()
  await expect(page.getByTestId('home-route-audio')).toBeVisible()
  await expect(page.getByText(/Thank you to Proof of Play/).first()).toBeVisible()
  await expect(page.getByText(/allowlisted extract/i)).toHaveCount(0)
  await expect
    .poll(() =>
      urls.some(
        (url) => url.includes(UI_PACK) && url.endsWith('branding-menu-background.png'),
      ),
    )
    .toBe(true)

  await page.getByTestId('home-route-models').click()
  await expect(page.getByPlaceholder(/Search 355 models/)).toBeVisible()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByTestId('home-progress')).toHaveText(/1 \/ 5 reviewed/)
  await expect(page.getByTestId('home-route-models')).toHaveText(/Reviewed/)
})

test('Home route buttons open every showcase surface', async ({ page }) => {
  await page.goto('/')

  for (const route of [
    ['models', 'Models'],
    ['scene', 'Scene'],
    ['avatar', 'Avatar Lab'],
    ['sprites', 'Sprites'],
    ['audio', 'Audio'],
  ] as const) {
    await page.getByTestId(`home-route-${route[0]}`).click()
    await expect(page.getByRole('button', { name: route[1], exact: true })).toHaveClass(/active/)
    await page.getByRole('button', { name: 'Home', exact: true }).click()
  }
})

test('Home keeps routes usable when manifest and background requests fail', async ({ page }) => {
  await page.route('**/catalog/pirate-nation/manifest.json', (route) => route.abort())
  await page.route('**/branding-menu-background.png', (route) => route.abort())
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Build your next world.' })).toBeVisible()
  await expect(page.getByTestId('home-route-models')).toBeVisible()
  await expect(page.getByTestId('home-route-audio')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(/Manifest details unavailable/)
  await expect(page.getByTestId('home-progress')).toHaveText(/0 \/ 5 reviewed/)
})

test('models tab lists the catalog and opens the 3D viewer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models', exact: true }).click()

  const search = page.getByPlaceholder(/Search 355 models/)
  await expect(search).toBeVisible()

  // Filter to a known small model, open its detail view.
  await search.fill('kraken')
  const card = page.getByRole('button', { name: /Kraken/ }).first()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page.getByRole('heading', { name: /Kraken/ })).toBeVisible()
  // WebGL canvas, or the app's error boundary where GL is unavailable.
  await expect(page.locator('.model-viewer canvas, .viewer-error').first()).toBeVisible()
  // Kraken (world-bosses) ships no collision GLB — no toggle.
  await expect(page.getByRole('button', { name: 'Collision', exact: true })).toHaveCount(0)
})

test('models with collision geometry offer a viewer toggle', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models', exact: true }).click()

  await page.getByPlaceholder(/Search 355 models/).fill('shipwright lv1')
  // Card accessible name = model name + metadata text; anchor at the start.
  await page.getByRole('button', { name: /^Building 4x7 Shipwright Lv1/ }).click()

  // Viewer controls only exist when WebGL is available; where it is not, the
  // error boundary replaces the viewer (same policy as the smoke test above).
  if (await page.locator('.viewer-error').isVisible()) {
    test.skip(true, 'WebGL unavailable — viewer replaced by error boundary')
  }

  const toggle = page.getByRole('button', { name: 'Collision', exact: true })
  await expect(toggle).toBeVisible()
  // Toggling must actually fetch the collision GLB, not just flip a class.
  const collisionRequest = page.waitForRequest(
    (request) =>
      request.url().includes(MODEL_PACK) &&
      request.url().endsWith('ships/ships-building-4x7-shipwright-lv1-collision.glb'),
  )
  await toggle.click()
  await collisionRequest
  await expect(toggle).toHaveClass(/active/)
  await toggle.click()
  await expect(toggle).not.toHaveClass(/active/)
})

test('avatar lab renders the character creator and preserves multi-primitive parts', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Avatar Lab', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Roll a pirate' })).toBeVisible()
  await expect(page.getByText(/Parts \(326 across 12 slots\)/)).toBeVisible()
  await expect(page.locator('.avatar-stage canvas, .viewer-error').first()).toBeVisible()

  // Select multi-primitive species 14
  const speciesRow = page
    .locator('.slot-row')
    .filter({ has: page.locator('.slot-row-label', { hasText: /^species$/ }) })
  await speciesRow.locator('select').selectOption('14')
  await expect(speciesRow.locator('select')).toHaveValue('14')

  // Pick skin color swatch
  const cyanSwatch = page.locator('.swatches:has-text("Skin color") button.swatch[title="#7fffd4"]')
  await cyanSwatch.click()
  await expect(cyanSwatch).toHaveClass(/selected/)
})

test('sprites tab renders the grid', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sprites', exact: true }).click()

  await expect(page.getByPlaceholder(/Search 513 sprites/)).toBeVisible()
  const images = page.locator('.sprite-tile img')
  await expect(images.first()).toBeVisible()
  expect(await images.count()).toBeGreaterThan(50)
})

test('audio tab lists tracks with lazy players', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Audio', exact: true }).click()

  const players = page.locator('audio[preload="none"]')
  await expect(players.first()).toBeAttached()
  expect(await players.count()).toBe(30)
})

test('model cards show pre-rendered thumbnails', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  const firstThumb = page.locator('.model-card img').first()
  await expect(firstThumb).toBeVisible()
  await expect(firstThumb).toHaveJSProperty('naturalWidth', 320)
})

test('models tab keeps a stage mounted and navigates by keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Models', exact: true }).click()

  // The stage is up before any card is clicked.
  await expect(page.locator('.model-viewer canvas, .viewer-error').first()).toBeVisible()

  const selectedName = () => page.locator('.model-card.selected .model-card-name').innerText()
  const first = await selectedName()

  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => await selectedName()).not.toBe(first)

  const afterArrow = await selectedName()
  await page.getByRole('button', { name: 'Random' }).click()
  await expect.poll(async () => await selectedName()).not.toBe(afterArrow)
})

test('scene tab composes several models on one stage', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Scene', exact: true }).click()

  await expect(page.getByText(/models, normalised to 4 units/)).toBeVisible()
  // WebGL canvas, or the app's error boundary where GL is unavailable.
  await expect(page.locator('.scene-stage canvas, .viewer-error').first()).toBeVisible()

  // Reshuffle must change the cast without breaking the stage.
  await page.getByRole('button', { name: 'Reshuffle' }).click()
  await expect(page.locator('.scene-stage canvas, .viewer-error').first()).toBeVisible()
})

test('binary assets use pinned asset-library packs', async ({ page }) => {
  const urls = requestUrls(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await expect.poll(() => urls.some((url) => url.includes(MODEL_PACK) && url.endsWith('.jpg'))).toBe(true)

  const visualRequest = page.waitForRequest(
    (request) => request.url().includes(`${MODEL_PACK}ships/ships-building-4x7-shipwright-lv1.glb`),
  )
  await page.getByPlaceholder(/Search 355 models/).fill('shipwright lv1')
  await page.getByRole('button', { name: /^Building 4x7 Shipwright Lv1/ }).click()
  await visualRequest

  const toggle = page.getByRole('button', { name: 'Collision', exact: true })
  await expect(toggle).toBeVisible()
  const collisionRequest = page.waitForRequest(
    (request) => request.url().includes(MODEL_PACK) && request.url().endsWith('-collision.glb'),
  )
  await toggle.click()
  await collisionRequest
  await expect(toggle).toHaveClass(/active/)

  await page.getByRole('button', { name: 'Sprites', exact: true }).click()
  await expect.poll(() => urls.some((url) => url.includes(ICON_PACK) || url.includes(UI_PACK))).toBe(true)

  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  const audio = page.locator('audio[preload="none"]').first()
  await expect(audio).toBeAttached()
  await audio.evaluate((element) => (element as HTMLAudioElement).load())
  await expect.poll(() => urls.some((url) => url.includes(AUDIO_PACK))).toBe(true)

  const avatarRequest = page.waitForRequest(
    (request) => request.url().includes(`${MODEL_PACK}${AVATAR_MODEL}`),
  )
  await page.getByRole('button', { name: 'Avatar Lab', exact: true }).click()
  await avatarRequest

  await page.getByRole('button', { name: 'Scene', exact: true }).click()
  await expect(page.locator('.scene-stage canvas, .viewer-error').first()).toBeVisible()
  await expect.poll(() => urls.some((url) => url.includes(MODEL_PACK))).toBe(true)

  expect(urls.filter((url) => url.includes('/cdn-assets/pirate-nation/'))).toEqual([])
})
