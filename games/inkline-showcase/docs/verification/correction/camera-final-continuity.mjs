import { chromium } from '@playwright/test'
import { readFile,writeFile } from 'node:fs/promises'
import { cameraSourceHashes } from '../../../scripts/verify-camera-motion.ts'
const url=process.env.INKLINE_AUDIT_URL??'http://localhost:5197/audit.html',sourceSHA256=await cameraSourceHashes(),browser=await chromium.launch({headless:true,channel:'chromium'}),runs=[],errors=[]
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto(url)
 const source=await readFile('docs/verification/correction/camera-continuity-repro.js','utf8')
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const motion of ['full','reduced']){
  await page.emulateMedia({reducedMotion:motion==='reduced'?'reduce':'no-preference'})
  const code=source.replace(/const viewport = .*;/,`const viewport = ${JSON.stringify(viewport)};`).replace("const motion = 'reduced';",`const motion = '${motion}';`)
  const run=new Function(`return (${code})`)(),report=await run(page)
  for(const result of report.results)runs.push({...result,pass:result.frames>=30&&Number.isFinite(result.maxSpeed)&&result.maxSpeed<=22&&result.maxAngle<.02&&result.outsideFrames===0})
  errors.push(...report.errors)
  if(report.stats?.error)errors.push(report.stats.error)
 }
}catch(error){errors.push(String(error))}finally{await browser.close()}
const pass=runs.length===16&&runs.every(r=>r.pass)&&!errors.length
await writeFile('docs/verification/correction/camera-final-continuity.json',JSON.stringify({checkedAt:new Date().toISOString(),url,sourceSHA256,pass,runs,errors},null,2)+'\n')
console.log(JSON.stringify({pass,routes:runs.length,frames:runs.reduce((n,r)=>n+r.frames,0),maxStep:Math.max(...runs.map(r=>r.maxDistance)),maxSpeed:Math.max(...runs.map(r=>r.maxSpeed)),maxAngle:Math.max(...runs.map(r=>r.maxAngle)),failures:runs.filter(r=>!r.pass).map(({viewport,camera,motion,maxSpeed,maxAngle,outsideFrames})=>({viewport,camera,motion,maxSpeed,maxAngle,outsideFrames})),errors},null,2));if(!pass)process.exitCode=1
