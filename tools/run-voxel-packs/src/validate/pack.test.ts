import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sizeOutliers, unexpectedFiles } from './pack'

describe('pack file inventory', () => {
  it('flags files that would ship unchecked', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rvx-inv-'))
    const touch = (rel: string) => {
      mkdirSync(join(dir, rel, '..'), { recursive: true })
      writeFileSync(join(dir, rel), '')
    }
    for (const ok of ['3D/fantasy/License.txt', '3D/fantasy/preview.webp', '3D/fantasy/props/fantasy-props-a.glb', '3D/fantasy/props/Previews/fantasy-props-a.jpg', 'icons/icon-a.png', 'ui/ui-a.png', '3D/characters/avatar/fantasy-avatar-parts.glb']) touch(ok)
    for (const bad of ['3D/fantasy/pn-avatar.glb', '3D/fantasy/props/Previews/orphan.jpg', '3D/fantasy/nope/x.glb', 'icons/sub/x.png', 'ui/readme.md', 'extra/x.glb']) touch(bad)
    expect(unexpectedFiles(dir, 'fantasy').sort()).toEqual(
      ['3D/fantasy/nope/x.glb', '3D/fantasy/pn-avatar.glb', '3D/fantasy/props/Previews/orphan.jpg', 'extra/x.glb', 'icons/sub/x.png', 'ui/readme.md'].sort(),
    )
  })
})

describe('size outliers', () => {
  const glb = (id: string, size: number, scaleClass: string | null = 'prop', category = 'props') => ({ id, size, scaleClass, category: category as never })
  it('flags an asset far outside its scale class, and passes the normal spread', () => {
    const base = [glb('a', 20), glb('b', 24), glb('c', 30), glb('d', 18)]
    expect(sizeOutliers(base)).toEqual([])
    expect(sizeOutliers([...base, glb('huge', 90)]).map((i) => i.message)).toEqual([expect.stringMatching(/^huge: 90 voxels, the prop median/)])
    expect(sizeOutliers([...base, glb('tiny', 5)]).map((i) => i.rule)).toEqual(['scale.outlier'])
  })
  it('groups avatar-space items by category and ignores small groups and parts files', () => {
    expect(sizeOutliers([glb('s1', 50, null, 'held-items'), glb('s2', 40, null, 'held-items'), glb('s3', 300, null, 'held-items')]).map((i) => i.message)).toEqual([expect.stringMatching(/^s3: .*held-items median/)])
    expect(sizeOutliers([glb('x', 10), glb('y', 100)])).toEqual([])
    expect(sizeOutliers([glb('p', 1, null, 'avatar'), glb('q', 1, null, 'avatar'), glb('r', 999, null, 'avatar')])).toEqual([])
  })
})
