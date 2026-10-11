/**
 * Plan acceptance A5–A7 over every staged RUN pack, driven by the catalogs:
 * - every avatar part composes on PN species 1 and deforms under 04_Walk;
 * - every skin plays PN clips and every pack clip with no guard error;
 * - every pack clip plays on a PN modular avatar and on the PN knight skin;
 * - every held item stays on HandR (≤0.02 units, ≤5°) through clips 08–13.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { collectErrors, openTab } from './helpers'

interface Catalog {
  pack: string
  models: { id: string; category: string }[]
  avatar: { parts: { ref: { pack: string; slot: string; index: number }; nodeName: string }[]; clips: string[] }
}

const CATALOG_DIR = join(import.meta.dirname, '../public/catalog')
const index = JSON.parse(readFileSync(join(CATALOG_DIR, 'index.json'), 'utf8')) as { packs: string[] }
const catalogs: Catalog[] = index.packs.filter((p) => p !== 'pirate').map((p) => JSON.parse(readFileSync(join(CATALOG_DIR, p, 'catalog.json'), 'utf8')))
const allPackClips = catalogs.flatMap((c) => c.avatar.clips)
const HELD_CLIPS = ['08_Action_One-Handed_Low', '09_Action_One-Handed_Mid', '10_Action_One-Handed_High', '11_Action_Two-Handed_Low', '12_Action_Two-Handed_Mid', '13_Action_Two-Handed_High']

const pn = (slot: string, index: number) => ({ pack: 'pirate', slot, index })
const BASE_PARTS = { face: pn('face', 1), hair: pn('hair', 1), tops: pn('tops', 1), bottoms: pn('bottoms', 1), shoes: pn('shoes', 1) }
const modular = (parts: Record<string, unknown>, clip: string, held: string | null = null) => ({
  base: { kind: 'modular', species: pn('species', 1), parts: { ...BASE_PARTS, ...parts } },
  held,
  skinColor: '#f2d5b4',
  hairColor: '#2c1b10',
  clip,
})
const skinSel = (skin: string, clip: string) => ({ base: { kind: 'skin', skin }, held: null, skinColor: '#f2d5b4', hairColor: '#2c1b10', clip })

async function select(page: Page, selection: unknown, clip: string): Promise<void> {
  await page.evaluate((s) => (window as unknown as { __rvxLab: { setSelection: (v: unknown) => void } }).__rvxLab.setSelection(s), selection)
  await page.waitForFunction(
    ([c, key]) => {
      const w = window as unknown as { __rvxAvatar?: { clip: string; key?: string } }
      return w.__rvxAvatar?.clip === c && w.__rvxAvatar?.key === key
    },
    [clip, JSON.stringify(selection)] as const,
    { timeout: 30_000 },
  )
  const errors = await page.locator('.viewer-error').allTextContents()
  expect(errors, JSON.stringify(selection)).toEqual([])
}

/** World-space box of one skinned mesh in its current pose (skinning applied). */
async function poseBox(page: Page, meshName: string): Promise<number[]> {
  return page.evaluate((name) => {
    const w = window as unknown as { __rvxAvatar: { root: any } }
    const mesh = w.__rvxAvatar.root.getObjectByName(name)
    if (!mesh) throw new Error(`no mesh ${name}`)
    mesh.skeleton.update()
    mesh.computeBoundingBox()
    const b = mesh.boundingBox
    return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
  }, meshName)
}

test.describe.configure({ mode: 'serial', timeout: 30 * 60_000 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await openTab(page, 'Avatar Lab')
  await page.waitForFunction(() => '__rvxLab' in window)
})

for (const catalog of catalogs) {
  test(`${catalog.pack}: every part deforms on the PN body`, async ({ page }) => {
    const errors = collectErrors(page)
    for (const part of catalog.avatar.parts) {
      const sel = modular({ [part.ref.slot]: part.ref }, '04_Walk')
      await select(page, sel, '04_Walk')
      const name = part.nodeName.replace(/\s/g, '_')
      const a = await poseBox(page, name)
      await page.waitForTimeout(260)
      const b = await poseBox(page, name)
      const moved = Math.max(...a.map((v, i) => Math.abs(v - b[i]!)))
      expect(moved, `${part.nodeName} does not move with its bones under 04_Walk`).toBeGreaterThan(1e-4)
    }
    expect(errors).toEqual([])
  })

  test(`${catalog.pack}: every skin plays PN and pack clips`, async ({ page }) => {
    const errors = collectErrors(page)
    const skins = catalog.models.filter((m) => m.category === 'characters-skins')
    for (const skin of skins) {
      for (const clip of ['00_TPose', '04_Walk', '09_Action_One-Handed_Mid', '31_Swimming', ...allPackClips]) {
        await select(page, skinSel(skin.id, clip), clip)
      }
    }
    expect(errors).toEqual([])
  })

  test(`${catalog.pack}: every pack clip plays on PN avatars`, async ({ page }) => {
    const errors = collectErrors(page)
    for (const clip of catalog.avatar.clips) {
      await select(page, modular({}, clip), clip)
      await select(page, skinSel('characters-skins-skin-knight', clip), clip)
    }
    expect(errors).toEqual([])
  })

  test(`${catalog.pack}: every held item stays on HandR through actions`, async ({ page }) => {
    const errors = collectErrors(page)
    const held = catalog.models.filter((m) => m.category === 'held-items')
    for (const item of held) {
      for (const clip of HELD_CLIPS) {
        await select(page, modular({}, clip, item.id), clip)
        for (let k = 0; k < 2; k += 1) {
          const [distance, angle] = await page.evaluate(() => {
            const avatar = (window as unknown as { __rvxAvatar: { root: any } }).__rvxAvatar
            const hand = avatar.root.getObjectByName('HandR')
            const it = avatar.root.getObjectByName('held-item')
            const V = hand.position.constructor
            const Q = hand.quaternion.constructor
            const h = hand.getWorldPosition(new V())
            const p = it.getWorldPosition(new V())
            return [h.distanceTo(p), hand.getWorldQuaternion(new Q()).angleTo(it.getWorldQuaternion(new Q()))]
          })
          expect(distance, `${item.id} ${clip}`).toBeLessThan(0.02)
          expect(angle, `${item.id} ${clip}`).toBeLessThan((5 * Math.PI) / 180)
          await page.waitForTimeout(150)
        }
      }
    }
    expect(errors).toEqual([])
  })
}
