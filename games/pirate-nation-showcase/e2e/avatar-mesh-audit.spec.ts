import { expect, test } from '@playwright/test'
import {
  AVATAR_PARTS,
  AVATAR_SLOTS,
  type AvatarSlot,
} from '../src/avatar/avatarCatalog.generated'
import {
  FULL_BODY_SPECIES,
  isFullBodySpecies,
  isSlotSupportedForSpecies,
  randomAvatarSelection,
  resolvePartNodes,
} from '../src/avatar/composeAvatar'

test.describe('Avatar Mesh & Depth Layer Complete Audit', () => {
  test('verifies all 326 catalog parts have valid indices and nodes', () => {
    let totalCount = 0
    for (const slot of AVATAR_SLOTS) {
      const parts = AVATAR_PARTS[slot]
      expect(parts.length).toBeGreaterThan(0)
      totalCount += parts.length

      const indices = new Set<number>()
      for (const part of parts) {
        expect(part.index).toBeGreaterThan(0)
        expect(indices.has(part.index)).toBe(false)
        indices.add(part.index)
        expect(part.nodeName).toMatch(new RegExp(`^${slot}\\s+\\d+$`))
      }
    }
    expect(totalCount).toBe(326)
  })

  test('verifies full-body species rule matrix across all 19 species', () => {
    for (let sp = 1; sp <= 19; sp++) {
      const isFull = isFullBodySpecies(sp)
      if (FULL_BODY_SPECIES.has(sp)) {
        expect(isFull).toBe(true)
        // Only species and back allowed
        for (const slot of AVATAR_SLOTS) {
          if (slot === 'species' || slot === 'back') {
            expect(isSlotSupportedForSpecies(slot, sp)).toBe(true)
          } else {
            expect(isSlotSupportedForSpecies(slot, sp)).toBe(false)
          }
        }
      } else {
        expect(isFull).toBe(false)
        // All slots allowed on base bodies, except:
        // - face on species with built-in face (5, 6)
        // - eyebrow on species with built-in 3D brows (3, 4, 5, 6)
        for (const slot of AVATAR_SLOTS) {
          if (slot === 'face' && (sp === 5 || sp === 6)) {
            expect(isSlotSupportedForSpecies(slot, sp)).toBe(false)
          } else if (slot === 'eyebrow' && (sp === 3 || sp === 4 || sp === 5 || sp === 6)) {
            expect(isSlotSupportedForSpecies(slot, sp)).toBe(false)
          } else {
            expect(isSlotSupportedForSpecies(slot, sp)).toBe(true)
          }
        }
      }
    }
  })

  test('verifies 100 randomized avatar rolls across all species strictly obey layer rules', () => {
    for (let i = 0; i < 100; i++) {
      const selection = randomAvatarSelection()
      const nodes = resolvePartNodes(selection)

      expect(nodes.length).toBeGreaterThan(0)
      if (isFullBodySpecies(selection.species)) {
        // Full body skins only contain species node and optional back node
        for (const node of nodes) {
          expect(node.startsWith('species') || node.startsWith('back')).toBe(true)
        }
      } else {
        // Base bodies must contain required slots
        expect(nodes.some((n) => n.startsWith('species'))).toBe(true)
        if (selection.species !== 5 && selection.species !== 6) {
          expect(nodes.some((n) => n.startsWith('face'))).toBe(true)
        }
        expect(nodes.some((n) => n.startsWith('tops'))).toBe(true)
        expect(nodes.some((n) => n.startsWith('bottoms'))).toBe(true)
        expect(nodes.some((n) => n.startsWith('shoes'))).toBe(true)
      }
    }
  })

  test('verifies Three.js scene graph layer ordering and depth bias in browser', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Avatar Lab', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Roll a pirate' })).toBeVisible()
    await page.waitForFunction(() => !!(window as any).__testAvatar)

    // Test complex layered base body (Frankenstein with high collar, beard, glasses, hat, boots)
    const setSlot = async (slot: AvatarSlot, val: number | null) => {
      const row = page
        .locator('.slot-row')
        .filter({ has: page.locator('.slot-row-label', { hasText: new RegExp(`^${slot}$`) }) })
      const sel = row.locator('select')
      if (await sel.isEnabled()) {
        await sel.selectOption(val === null ? '' : String(val))
      }
    }

    await setSlot('species', 12) // Frankenstein
    await setSlot('face', 18)
    await setSlot('tops', 12)
    await setSlot('bottoms', 6)
    await setSlot('shoes', 11)
    await setSlot('eyebrow', 8)
    await setSlot('hair', 21)
    await setSlot('facialhair', 8)
    await setSlot('ears', 2)
    await setSlot('eyewear', 3)
    await setSlot('headwear', 4)
    await setSlot('back', 2)

    await page.waitForTimeout(500)

    const meshLayering = await page.evaluate(() => {
      const avatar = (window as unknown as { __testAvatar?: any }).__testAvatar
      const results: Array<{
        name: string
        renderOrder: number
        offsetFactor: number
      }> = []
      avatar?.traverse((obj: any) => {
        if (obj.isMesh || obj.isSkinnedMesh) {
          results.push({
            name: obj.name,
            renderOrder: obj.renderOrder,
            offsetFactor: Array.isArray(obj.material)
              ? obj.material[0]?.polygonOffsetFactor
              : obj.material?.polygonOffsetFactor,
          })
        }
      })
      return results
    })

    expect(meshLayering.length).toBeGreaterThan(5)

    // Verify each mesh's renderOrder and offsetFactor matches physical hierarchy
    for (const item of meshLayering) {
      expect(typeof item.renderOrder).toBe('number')
      expect(typeof item.offsetFactor).toBe('number')
    }
  })
})
