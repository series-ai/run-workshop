/**
 * Licence files for staged RUN voxel pack leaves: every leaf is under the RUN
 * License (run-workshop's LICENSE.md, the RUN Repository Supplemental License
 * v1.0). The characters leaf also carries the Pirate Nation avatar armature, a
 * Third-Party Material (LICENSE.md Section 8) under MIT, so its file adds that
 * notice. Checked against jam-ready-assets' scripts/license-policy.mjs in
 * licenses.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LeafKind } from '../../contracts/packs'
import { TOOL_ROOT } from '../paths'

export const SOURCE = 'https://github.com/series-ai/run-workshop/tree/main/tools/run-voxel-packs'
const VERIFIED_BY = 'run-workshop maintainers' // jam-ready-assets rule: never a person's name
const TODAY = new Date().toISOString().slice(0, 10)

const LEAF_TITLES: Record<LeafKind, string> = {
  world: '3D models',
  characters: 'avatar rig files (parts, skins, clips)',
  icons: 'icons',
  ui: 'UI tiles',
}

export const RUN_LICENSE = 'LicenseRef-RUN-Repository-Supplemental-1.0'
const REPO_LICENSE = join(TOOL_ROOT, '../../LICENSE.md')

/**
 * The armature in avatar-space files (joint names and bind pose) comes from
 * Pirate Nation under MIT; LICENSE.md Section 8 keeps it under that licence.
 */
const RIG_NOTICE = `Third-Party Materials: these files carry the Pirate Nation avatar armature
(joint names and bind pose, from https://github.com/proofofplay/piratenation-game)
so that they bind to Pirate Nation avatars. They carry no Pirate Nation meshes
or clips. The armature data stays under its own licence:

  MIT License

  Copyright (c) 2026 Proof of Play, Inc.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
`

/**
 * The whole RUN License, word for word, headed with provenance and the pack's
 * copyright; the characters leaf adds the armature notice before it.
 */
export function runText(packLabel: string, leaf: LeafKind): string {
  const license = readFileSync(REPO_LICENSE, 'utf8')
  const spdx = `SPDX-License-Identifier: ${RUN_LICENSE}`
  if (!license.includes(spdx)) throw new Error(`${REPO_LICENSE} is not the RUN Repository Supplemental License v1.0 (${spdx} is missing)`)
  return `${spdx}
Source: ${SOURCE}
Verified-by: ${VERIFIED_BY}, ${TODAY}

RUN Voxel Packs — ${packLabel} ${LEAF_TITLES[leaf]}
Copyright (c) 2026 Series Entertainment, Inc.
Made for the RUN platform. Licensed under the RUN Repository Supplemental
License v1.0 below: use it in RUN projects; it converts to MIT on January 1,
2028.
${leaf === 'characters' ? `\n${RIG_NOTICE}` : ''}
${license.trim()}
`
}
