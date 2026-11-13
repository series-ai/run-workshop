import { chromium } from '@playwright/test'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { CHARACTER_ROLES, roleAvatar } from '../src/runtime/roles'
import type { PackManifest } from '../src/types'

const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as PackManifest
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const studyPreviewByRole: Record<string, string> = {
  'stick-fighter': 'sword-overhead',
}
const htmlStart = (title: string, subtitle: string, columns: 4 | 6) => `<html><head><style>*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:13px/1.5 system-ui}header{padding:28px 35px 20px;border-bottom:1px solid #c8ccc0}header small{color:#d45538;letter-spacing:3px}h1{font-size:36px;letter-spacing:-1px;margin:6px 0}header p{margin:0;color:#656863}main{padding:20px;display:grid;grid-template-columns:repeat(${columns},1fr);gap:12px}figure{margin:0;text-align:center;border-bottom:1px solid #d3d3c9;padding-bottom:16px}img{width:100%;display:block}figcaption strong{font-size:16px}figcaption small{display:block;color:#656863;font-size:11px}footer{padding:12px 35px;font:10px monospace;color:#656863}</style></head><body><header><small>INKLINE / ACTUAL ASSET CAPTURES</small><h1>${title}</h1><p>${subtitle}</p></header><main>`
await mkdir('docs/verification/art-pass', { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html')
  await page.waitForFunction(() => Boolean(window.inklineCapture))
  for (const mode of ['roles', 'bodies'] as const) {
    let html = htmlStart(mode === 'roles' ? 'Designed by role.' : 'The shape carries the role.', mode === 'roles' ? 'Six body families. Twelve original roles. Each role shows its equipment in a representative pose.' : 'Twelve base meshes. One camera scale. No headwear or held equipment.', mode === 'roles' ? 4 : 6)
    for (const role of [...CHARACTER_ROLES.filter((_, index) => index % 2 === 0), ...CHARACTER_ROLES.filter((_, index) => index % 2 === 1)]) {
      const preview = studyPreviewByRole[role.id] ?? role.preview
      const clip = manifest.animations.find(clip => clip.id === preview)!
      const time = mode === 'roles' ? clip.contactTime ?? clip.duration * .35 : .3
      const capture = await page.evaluate(({ role, mode, preview, time, avatar }) => window.inklineCapture.model(role.id, mode === 'roles' ? preview : 'idle', time, false, 2.3, mode === 'roles' ? avatar : undefined), { role, mode, preview, time, avatar: roleAvatar(role) })
      html += `<figure><img src="${capture.png}" alt="${role.label}"><figcaption><strong>${role.label}</strong><small>${role.family} / ${mode === 'roles' ? role.equipment ?? 'Unarmed' : 'Base body'}</small></figcaption></figure>`
    }
    html += `</main><footer>REAL GLB MODELS / SHARED 18-BONE RIG / ${manifest.animations.length} CLIPS PER CHARACTER / NO GENERATED CONCEPT IMAGERY</footer></body></html>`
    const name = mode === 'roles' ? 'character-family' : 'body-family'
    await writeFile(`docs/verification/art-pass/${name}.html`, html)
    const sheet = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await sheet.setContent(html); await sheet.screenshot({ path: `public/review/${name}.png`, fullPage: true }); await sheet.close(); await copyFile(`public/review/${name}.png`, `docs/reference/${name}.png`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
} finally { await browser.close() }
