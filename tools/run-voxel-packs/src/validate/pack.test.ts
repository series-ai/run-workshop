import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { unexpectedFiles } from './pack'

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
