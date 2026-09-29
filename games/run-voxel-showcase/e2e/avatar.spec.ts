import { expect, test, type Page } from '@playwright/test'
import { collectErrors, openTab } from './helpers'

type Ref = { pack: string; slot: string; index: number }
const pn = (slot: string, index: number): Ref => ({ pack: 'pirate', slot, index })

async function select(page: Page, selection: unknown, clip: string): Promise<void> {
  await page.evaluate((s) => (window as unknown as { __rvxLab: { setSelection: (v: unknown) => void } }).__rvxLab.setSelection(s), selection)
  await page.waitForFunction((c) => (window as unknown as { __rvxAvatar?: { clip: string } }).__rvxAvatar?.clip === c, clip, { timeout: 30_000 })
  await page.waitForTimeout(400)
  await expect(page.locator('.viewer-error')).toHaveCount(0)
}

const modular = (parts: Record<string, Ref>, clip: string, held: string | null = null) => ({
  base: { kind: 'modular', species: pn('species', 1), parts: { face: pn('face', 1), hair: pn('hair', 1), bottoms: pn('bottoms', 1), shoes: pn('shoes', 1), ...parts } },
  held,
  skinColor: '#f2d5b4',
  hairColor: '#2c1b10',
  clip,
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await openTab(page, 'Avatar Lab')
  await page.waitForFunction(() => '__rvxLab' in window)
})

test('PN species + fantasy parts play PN and fantasy clips', async ({ page }) => {
  const errors = collectErrors(page)
  const parts = { tops: { pack: 'fantasy', slot: 'tops', index: 1 }, headwear: { pack: 'fantasy', slot: 'headwear', index: 1 } }
  for (const clip of ['04_Walk', '32_Cast_Spell']) {
    await select(page, modular(parts, clip), clip)
    const names = await page.evaluate(() => {
      const names: string[] = []
      ;(window as unknown as { __rvxAvatar: { root: { traverse: (f: (o: { name: string; isSkinnedMesh?: boolean }) => void) => void } } }).__rvxAvatar.root.traverse((o) => {
        if (o.isSkinnedMesh) names.push(o.name)
      })
      return names
    })
    expect(names).toEqual(expect.arrayContaining(['tops_fantasy-1', 'headwear_fantasy-1', 'species_1']))
  }
  expect(errors).toEqual([])
})

test('the elf ranger skin plays a PN clip', async ({ page }) => {
  const errors = collectErrors(page)
  await select(page, { base: { kind: 'skin', skin: 'fantasy-characters-skins-elf-ranger' }, held: null, skinColor: '#f2d5b4', hairColor: '#2c1b10', clip: '05_Run' }, '05_Run')
  expect(errors).toEqual([])
})

test('the longsword rides HandR through a one-handed action', async ({ page }) => {
  await select(page, modular({}, '09_Action_One-Handed_Mid', 'fantasy-held-items-longsword'), '09_Action_One-Handed_Mid')
  const samples: number[][] = []
  for (let i = 0; i < 5; i += 1) {
    samples.push(
      await page.evaluate(() => {
        const avatar = (window as unknown as { __rvxAvatar: { root: any } }).__rvxAvatar
        const hand = avatar.root.getObjectByName('HandR')
        const item = avatar.root.getObjectByName('held-item')
        const h = hand.getWorldPosition(new hand.position.constructor())
        const p = item.getWorldPosition(new item.position.constructor())
        const qh = hand.getWorldQuaternion(new hand.quaternion.constructor())
        const qi = item.getWorldQuaternion(new item.quaternion.constructor())
        return [h.distanceTo(p), qh.angleTo(qi), h.y]
      }),
    )
    await page.waitForTimeout(180)
  }
  for (const [distance, angle] of samples) {
    expect(distance).toBeLessThan(0.02)
    expect(angle).toBeLessThan((5 * Math.PI) / 180)
  }
  // the hand actually moves during the action
  expect(Math.max(...samples.map((s) => s[2]!)) - Math.min(...samples.map((s) => s[2]!))).toBeGreaterThan(0.001)
})
