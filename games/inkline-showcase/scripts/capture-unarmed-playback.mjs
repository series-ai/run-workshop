import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'

const project=process.cwd()
const out=resolve(project,'docs/verification/kinetic/animation-review')
const url=process.env.INKLINE_URL ?? 'http://localhost:5199/capture.html'
const clips={
  'punch-left':{preset:'stick-standard',contactFrame:8,frames:[1,3,6,8,9,12,16]},
  'punch-right':{preset:'stick-standard',contactFrame:9,frames:[1,4,7,9,10,13,18]},
  'punch-heavy':{preset:'stick-heavy',contactFrame:12,frames:[1,5,9,12,13,17,24]},
  'kick-front':{preset:'stick-striker',contactFrame:9,frames:[1,4,7,9,10,14,20]},
  'kick-roundhouse':{preset:'stick-striker',contactFrame:12,frames:[1,5,8,12,13,17,24]},
  'elbow-strike':{preset:'stick-compact',contactFrame:9,frames:[1,4,7,9,10,14,18]}
}
const common={color:'#151716',accent:'#d45538',height:1,thickness:1,headScale:1,headwear:'none',equipment:null}
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,channel:'chromium'})
const page=await browser.newPage({viewport:{width:384,height:384},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())})
try {
  await page.goto(url,{waitUntil:'networkidle'})
  await page.waitForFunction(()=>Boolean(window.inklineCapture))
  const rows=[]
  for(const [id,spec] of Object.entries(clips)) {
    const avatar={preset:spec.preset,...common}
    const cells=[]
    for(const frame of spec.frames) {
      const time=frame/30
      const result=await page.evaluate(({avatar,id,time})=>window.inklineCapture.model(avatar.preset,id,time,true,undefined,avatar),{avatar,id,time})
      if(!result.png?.startsWith('data:image/png')) throw new Error(`${id} frame ${frame} has no image`)
      const file=`unarmed-playback-${id}-${String(frame).padStart(2,'0')}.png`
      await writeFile(resolve(out,file),Buffer.from(result.png.split(',')[1],'base64'))
      cells.push({frame,time,file,png:result.png,triangles:result.triangles,calls:result.calls})
    }
    rows.push({id,preset:spec.preset,contactFrame:spec.contactFrame,cells})
  }
  const html=`<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:14px/1.35 system-ui,sans-serif}main{padding:24px}h1{margin:0 0 8px;font-size:28px}p{margin:0 0 18px;color:#656863}.row{border-top:1px solid #c9ccc3;padding:14px 0}.head{display:flex;gap:16px;align-items:baseline}.head h2{margin:0;font-size:19px}.head p{margin:0;color:#656863}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:9px}figure{margin:0;padding:5px;background:#f7f5ee;border:1px solid #d0d0c6}img{display:block;width:100%;background:#eeece5}figcaption{padding-top:5px;font-size:10px;display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:.05em}small{color:#656863}.contact{border-color:#d45538}</style><main><h1>INKLINE unarmed actions · sampled authored poses</h1><p>Actual exported 120 Hz GLB captures. Samples use authored frame / 30 seconds. The orange border marks authored contact.</p>${rows.map(r=>`<section class=row><div class=head><h2>${r.id}</h2><p>contact frame ${r.contactFrame} · ${(r.contactFrame/30).toFixed(3)} s</p></div><div class=grid>${r.cells.map(c=>`<figure class=${c.frame===r.contactFrame?'contact':''}><img src=${c.png} alt="${r.id} frame ${c.frame}"><figcaption><b>f${c.frame}</b><small>${c.time.toFixed(3)} s</small></figcaption></figure>`).join('')}</div></section>`).join('')}</main>`
  const board=await browser.newPage({viewport:{width:1720,height:1200}})
  await board.setContent(html,{waitUntil:'load'})
  await board.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0))
  await board.screenshot({path:resolve(out,'unarmed-playback.png'),fullPage:true})
  await board.close()
  if(errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
  await writeFile(resolve(out,'unarmed-playback.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:url,view:'side',fps:30,assetFps:120,clips:rows.map(r=>({id:r.id,preset:r.preset,contactFrame:r.contactFrame,frames:r.cells.map(({frame,time,file,triangles,calls})=>({frame,time,file,triangles,calls}))})),pageErrors:errors},null,2)+'\n')
  console.log(JSON.stringify({clips:Object.keys(clips),frames:rows.reduce((n,r)=>n+r.cells.length,0),errors},null,2))
} finally {await browser.close()}
