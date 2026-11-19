import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACK_DEFS, type VoxCharLeafKind, type VoxCharPackKey } from '../contracts/packs'
import { TOOL_ROOT } from './paths'

export const SOURCE = 'https://github.com/series-ai/run-workshop/tree/main/tools/run-voxel-characters'
const VERIFIED_BY = 'run-workshop maintainers'
const TODAY = new Date().toISOString().slice(0, 10)
export const RUN_LICENSE = 'LicenseRef-RUN-Repository-Supplemental-1.0'
const REPO_LICENSE = join(TOOL_ROOT, '../../LICENSE.md')

const CC0_TEXT = `SPDX-License-Identifier: CC0-1.0
Source: ${SOURCE}
Verified-by: ${VERIFIED_BY}, ${TODAY}

Creative Commons Zero v1.0 Universal (CC0 1.0 Public Domain Dedication)
https://creativecommons.org/publicdomain/zero/1.0/

Contains:
- Canonical 53-joint Quaternius UAL1 armature & 43 CC0 motion clips
  (Quaternius Universal Animation Library Standard, CC0-1.0)
- Teardown-style procedural voxel base bodies, heads, and hair
  authored for RUN Voxel Characters (dedicated to CC0-1.0).
`

const UAL_RIG_NOTICE = `Third-Party Materials: character skinning uses the Quaternius Universal
Animation Library Standard 53-joint armature convention (CC0 1.0 Universal,
https://quaternius.com/packs/universalanimationlibrary.html).
`

export function licenseTextFor(pack: VoxCharPackKey, kind: VoxCharLeafKind): string {
  const def = PACK_DEFS[pack]
  if (def.license === 'CC0-1.0') return CC0_TEXT
  const license = readFileSync(REPO_LICENSE, 'utf8')
  const spdx = `SPDX-License-Identifier: ${RUN_LICENSE}`
  if (!license.includes(spdx)) {
    throw new Error(`${REPO_LICENSE} is missing ${spdx}`)
  }
  const title = kind === 'characters' ? 'character parts & held items' : 'world props'
  return `${spdx}
Source: ${SOURCE}
Verified-by: ${VERIFIED_BY}, ${TODAY}

RUN Voxel Characters — ${def.label} ${title}
Copyright (c) 2026 Series Entertainment, Inc.
Made for the RUN platform. Licensed under the RUN Repository Supplemental
License v1.0 below: use it in RUN projects; it converts to MIT on January 1,
2028.
${kind === 'characters' ? `\n${UAL_RIG_NOTICE}` : ''}
${license.trim()}
`
}
