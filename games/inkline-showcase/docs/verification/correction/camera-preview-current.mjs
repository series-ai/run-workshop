import { chromium } from '@playwright/test'
import { readFile,writeFile } from 'node:fs/promises'
import { cameraSourceHashes } from '../../../scripts/verify-camera-motion.ts'
const url=process.env.INKLINE_AUDIT_URL??'http://localhost:5197/audit.html'
const sourceSHA256=await cameraSourceHashes(),browser=await chromium.launch({headless:true,channel:'chromium'}),reports=[],heads=[],errors=[]
try{
 const page=await browser.newPage()
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(url);await page.waitForFunction(()=>window.inklineAudit?.state().stats?.loading===false)
 for(const file of ['camera-refit-repro.js','camera-refit-extra-repro.js','camera-refit-assets-repro.js']){
  const source=(await readFile(`docs/verification/correction/${file}`,'utf8')).replaceAll('games/inkline-showcase/docs/','docs/').replaceAll('camera-refit-','camera-refit-current-')
  const run=new Function(`return (${source})`)()
  reports.push({file,...await run(page)})
 }
 await page.setViewportSize({width:640,height:720})
 for(const preset of ['stick-standard','stick-heavy'])for(const color of ['#151716','#faf9f5'])for(const headwear of ['none','cap'])for(const headScale of [.8,1.2]){
  if(preset==='stick-heavy'&&headwear==='none')continue
  await page.evaluate(({preset,color,headwear,headScale})=>{const a=window.inklineAudit;a.set({mode:'avatars',camera:'perspective',playing:false,animationId:'idle',reset:a.state().settings.reset+1,avatar:{...a.state().settings.avatar,preset,height:1,thickness:1,headScale,headwear,equipment:null,color}})},{preset,color,headwear,headScale})
  await page.waitForFunction(()=>!window.inklineAudit.state().stats?.loading);await page.waitForTimeout(180)
  const state=await page.evaluate(()=>window.inklineAudit.artState()),head=state.actors[0].joints.Head
  const name=`camera-head-pivot-${preset}-${color==='#151716'?'black':'pale'}-${headwear}-${headScale}`
  const full=`docs/verification/correction/${name}.png`,close=`docs/verification/correction/${name}-close.png`
  await page.screenshot({path:full});await page.screenshot({path:close,clip:{x:Math.max(0,Math.min(400,head.x-120)),y:Math.max(0,Math.min(480,head.y-145)),width:240,height:240}})
  heads.push({preset,color,headwear,headScale,full,close,joints:state.actors[0].joints})
 }
}catch(error){errors.push(String(error))}finally{await browser.close()}
const checks=reports.flatMap(r=>r.results??[]).filter(r=>typeof r.pass==='boolean'),pass=checks.length===45&&checks.every(r=>r.pass)&&heads.length===12&&!errors.length
await writeFile('docs/verification/correction/camera-preview-current.json',JSON.stringify({checkedAt:new Date().toISOString(),sourceSHA256,url,pass,checks:checks.length,reports,heads,errors},null,2)+'\n')
console.log(JSON.stringify({pass,checks:checks.length,heads:heads.length,failures:checks.filter(r=>!r.pass),errors},null,2));if(!pass)process.exitCode=1
