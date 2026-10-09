import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEAF_KINDS } from '../../contracts/packs'
import { jamAssetsDir } from '../paths'
import { RUN_LICENSE, runText } from './licenses'

describe('staged licence files', () => {
  it('pass the jam-ready-assets licence policy', async () => {
    const policy = (await import(pathToFileURL(join(jamAssetsDir(), 'scripts/license-policy.mjs')).href)) as {
      inspectLicenseText: (text: string) => { error?: string; license?: string }
    }
    for (const leaf of LEAF_KINDS) {
      const result = policy.inspectLicenseText(runText('Fantasy', leaf))
      expect(result.error, leaf).toBeUndefined()
      expect(result.license, leaf).toBe(RUN_LICENSE)
    }
  })

  it('keep the Proof of Play MIT notice for the rig data in the characters leaf only', () => {
    expect(runText('Fantasy', 'characters')).toContain('Copyright (c) 2026 Proof of Play, Inc.')
    expect(runText('Fantasy', 'world')).not.toContain('Proof of Play')
  })
})
