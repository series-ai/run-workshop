import { expect, test, type Page } from '@playwright/test'

interface DemoMetrics {
  scene: string
  fps: number
  frameMs: number
  cpuMs: number
  calls: number
  triangles: number
  width: number
  height: number
  frames: number
}

interface AudioState {
  enabled: boolean
  playing: boolean
  paused: boolean
  supported: boolean
}

interface DemoApi {
  ready: Promise<void>
  scenes: string[]
  selectScene(id: string): Promise<void>
  currentScene(): string
  presets(): string[]
  setPreset(index: number): void
  setDrift(on: boolean): void
  setPaused(paused: boolean): void
  audioState(): AudioState
  toggleAudio(): void
  renderFrameNow(t: number): { calls: number; triangles: number }
  getMetrics(): DemoMetrics | undefined
  glError(): number
}

function attachErrorWatchers(page: Page, errors: string[], label: string): void {
  page.on('pageerror', (err) => {
    errors.push(`[${label}] PAGEERROR: ${err.message}`)
  })
  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error' || /WebGL|GL_INVALID|THREE\.WebGL/i.test(text)) {
      errors.push(`[${label}] CONSOLE ${msg.type()}: ${text}`)
    }
  })
}

test('renders all 21 scenes cleanly with zero console/page/WebGL errors', async ({ page }) => {
  const errors: string[] = []
  attachErrorWatchers(page, errors, 'gallery')

  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__DEMO_API__), null, { timeout: 20_000 })
  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).ready)

  const sceneIds = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).scenes)
  expect(sceneIds).toHaveLength(21)

  for (const id of sceneIds) {
    await page.evaluate((sceneId) => (window.__DEMO_API__ as DemoApi).selectScene(sceneId), id)
    const current = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).currentScene())
    expect(current).toBe(id)

    const presets = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).presets())
    expect(presets.length).toBeGreaterThan(0)

    const rendered = await page.evaluate(() => {
      const api = window.__DEMO_API__ as DemoApi
      api.setPreset(0)
      api.setDrift(false)
      return api.renderFrameNow(1.5)
    })
    expect(rendered.calls).toBeGreaterThan(0)
    expect(rendered.triangles).toBeGreaterThan(0)

    const glErr = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).glError())
    expect(glErr, `gl.getError() for scene ${id}`).toBe(0)
  }

  expect(errors, `Unexpected browser errors: ${errors.join('\n')}`).toEqual([])
})

test('supports ?scene and ?single query params and pause/resume lifecycle', async ({ page }) => {
  const errors: string[] = []
  attachErrorWatchers(page, errors, 'single')

  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('/?scene=wave&single=1')
  await page.waitForFunction(() => Boolean(window.__DEMO_API__), null, { timeout: 20_000 })
  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).ready)

  const current = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).currentScene())
  expect(current).toBe('wave')
  await expect(page.locator('#tabs-shell')).toBeHidden()
  await expect(page.locator('#art-title')).not.toBeEmpty()

  await page.waitForTimeout(400)
  const beforePause = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).getMetrics()?.frames ?? 0)
  expect(beforePause).toBeGreaterThan(0)

  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).setPaused(true))
  await page.waitForTimeout(250)
  const whilePaused1 = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).getMetrics()?.frames ?? 0)
  await page.waitForTimeout(250)
  const whilePaused2 = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).getMetrics()?.frames ?? 0)
  expect(whilePaused2).toBe(whilePaused1)

  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).setPaused(false))
  await page.waitForTimeout(300)
  const afterResume = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).getMetrics()?.frames ?? 0)
  expect(afterResume).toBeGreaterThan(whilePaused2)

  expect(errors, `Unexpected browser errors: ${errors.join('\n')}`).toEqual([])
})

test('728x520 embed/responsive layout keeps top bar and telemetry on one row cleanly', async ({ page }) => {
  const errors: string[] = []
  attachErrorWatchers(page, errors, 'embed-728')

  await page.setViewportSize({ width: 728, height: 520 })
  await page.goto('/?scene=impossible-aqueduct')
  await page.waitForFunction(() => Boolean(window.__DEMO_API__), null, { timeout: 20_000 })
  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).ready)
  await page.waitForTimeout(500)

  const layout = await page.evaluate(() => {
    const box = (sel: string) => {
      const node = document.querySelector(sel)
      if (!node) throw new Error(`Missing ${sel}`)
      const b = node.getBoundingClientRect()
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
    }
    const rows = (sel: string) =>
      new Set([...document.querySelectorAll(sel)].map((n) => Math.round(n.getBoundingClientRect().top))).size
    const tallest = (sel: string) =>
      Math.max(...[...document.querySelectorAll(sel)].map((n) => n.getBoundingClientRect().height))

    return {
      tabs: box('#tabs-shell'),
      stats: box('.stats'),
      placard: box('.placard'),
      bar: box('.bar'),
      tabCount: document.querySelectorAll('#scene-tabs .tab').length,
      tabRows: rows('#scene-tabs .tab'),
      pillRows: rows('.bar .pill'),
      tabNameHeight: tallest('#scene-tabs .tab-name'),
      statLabelHeight: tallest('.stat > span'),
      width: document.documentElement.clientWidth,
    }
  })

  const apart = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) => a.right <= b.left - 6 || b.right <= a.left - 6 || a.bottom <= b.top - 6 || b.bottom <= a.top - 6

  const gap = Math.round(layout.stats.left - layout.tabs.right)
  expect(layout.tabCount).toBe(21)
  expect(layout.tabRows).toBe(1)
  expect(layout.tabNameHeight).toBeLessThanOrEqual(20)
  expect(layout.statLabelHeight).toBeLessThanOrEqual(12)
  expect(layout.pillRows).toBe(1)
  expect(gap).toBeGreaterThanOrEqual(8)
  expect(layout.stats.right).toBeLessThanOrEqual(layout.width - 8)
  expect(layout.tabs.left).toBeGreaterThanOrEqual(8)
  expect(layout.bar.right).toBeLessThanOrEqual(layout.width - 8)
  expect(layout.bar.left).toBeGreaterThanOrEqual(8)
  expect(apart(layout.placard, layout.bar)).toBe(true)
  expect(apart(layout.placard, layout.tabs)).toBe(true)
  expect(apart(layout.placard, layout.stats)).toBe(true)

  expect(errors, `Unexpected browser errors: ${errors.join('\n')}`).toEqual([])
})

test('loads CC0 Gymnopédie No. 1 MP3 cleanly and handles click, KeyM, gesture start, and pause/resume', async ({ page }) => {
  const errors: string[] = []
  attachErrorWatchers(page, errors, 'audio')

  const audioStatuses: number[] = []
  page.on('response', (res) => {
    if (res.url().includes('/audio/gymnopedie-1.mp3')) {
      audioStatuses.push(res.status())
    }
  })

  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('/?scene=starry')
  await page.waitForFunction(() => Boolean(window.__DEMO_API__), null, { timeout: 20_000 })
  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).ready)

  // Verify the bundled MP3 is served cleanly with HTTP 200 (or 206 range).
  const fetchStatus = await page.evaluate(async () => {
    const res = await fetch('./audio/gymnopedie-1.mp3')
    return res.status
  })
  expect(fetchStatus).toBe(200)
  expect(audioStatuses.length).toBeGreaterThan(0)
  expect(audioStatuses.every((s) => s === 200 || s === 206)).toBe(true)

  const audioBtn = page.locator('#btn-audio')
  await expect(audioBtn).toBeVisible()
  await expect(audioBtn).toHaveAttribute(
    'title',
    'Erik Satie · Gymnopédie No. 1 (CC0) — starts on interaction or click (M)',
  )
  await expect(audioBtn).toHaveClass(/\barmed\b/)
  await expect(audioBtn).not.toHaveClass(/\bactive\b/)
  await expect(audioBtn).toHaveAttribute('aria-pressed', 'true')

  const initial = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())
  expect(initial).toEqual({ enabled: true, playing: false, paused: false, supported: true })

  // Clicking #btn-audio starts playback directly from the armed state.
  await audioBtn.click()
  await expect(audioBtn).toHaveClass(/\bactive\b/)
  await expect(audioBtn).not.toHaveClass(/\barmed\b/)
  const afterClick = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())
  expect(afterClick).toEqual({ enabled: true, playing: true, paused: false, supported: true })

  // Let playback ramp up and confirm no audio element error occurred.
  await page.waitForTimeout(450)
  const afterRamp = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())
  expect(afterRamp).toEqual({ enabled: true, playing: true, paused: false, supported: true })

  // RUN pause/resume sync stops playing synchronously and resumes cleanly.
  const pausedState = await page.evaluate(() => {
    const api = window.__DEMO_API__ as DemoApi
    api.setPaused(true)
    return api.audioState()
  })
  expect(pausedState).toEqual({ enabled: true, playing: false, paused: true, supported: true })

  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).setPaused(false))
  const resumedState = await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())
  expect(resumedState).toEqual({ enabled: true, playing: true, paused: false, supported: true })

  // KeyM mutes and unmutes; modified KeyM (Meta/Control) and editable/select targets are ignored.
  await page.keyboard.press('Control+KeyM')
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState().enabled)).toBe(true)

  await page.locator('#scene-select').focus()
  await page.keyboard.press('KeyM')
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState().enabled)).toBe(true)
  await page.locator('#stage').click({ position: { x: 400, y: 300 } })

  await page.keyboard.press('KeyM')
  await expect(audioBtn).not.toHaveClass(/\bactive\b/)
  await expect(audioBtn).not.toHaveClass(/\barmed\b/)
  await expect(audioBtn).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())).toEqual({
    enabled: false,
    playing: false,
    paused: false,
    supported: true,
  })

  await page.keyboard.press('KeyM')
  await expect(audioBtn).toHaveClass(/\bactive\b/)
  await expect(audioBtn).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())).toEqual({
    enabled: true,
    playing: true,
    paused: false,
    supported: true,
  })

  // Fresh page load: first pointer interaction on the stage starts audio automatically.
  await page.goto('/?scene=wave&single=1')
  await page.waitForFunction(() => Boolean(window.__DEMO_API__), null, { timeout: 20_000 })
  await page.evaluate(() => (window.__DEMO_API__ as DemoApi).ready)
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())).toEqual({
    enabled: true,
    playing: false,
    paused: false,
    supported: true,
  })
  await page.locator('#stage').click({ position: { x: 400, y: 300 } })
  await expect(page.locator('#btn-audio')).toHaveClass(/\bactive\b/)
  expect(await page.evaluate(() => (window.__DEMO_API__ as DemoApi).audioState())).toEqual({
    enabled: true,
    playing: true,
    paused: false,
    supported: true,
  })

  expect(errors, `Unexpected browser errors: ${errors.join('\n')}`).toEqual([])
})
