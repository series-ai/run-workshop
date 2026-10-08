const {createRequire}=require('node:module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const [url,out]=process.argv.slice(2);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}); const logs=[];
 page.on('console',m=>{if(m.type()==='error'||m.text().includes('gl adapter'))logs.push(m.text());});page.on('pageerror',e=>logs.push(e.message));
 await page.clock.install({time:new Date('2026-10-07T00:00:00Z')});
 await page.goto(url); await page.clock.runFor(500); await page.waitForFunction(()=>window.__skyriver?.stats().firstFrameMs!==null);
 const result={url,logs,frames:[]};
 for(const sec of [4,8,16,24,32,40]){
  const tick=await page.evaluate(()=>window.__skyriver.stats().tick);
  await page.clock.runFor(Math.max(0,sec*1000-tick/30*1000));
  await page.evaluate(()=>window.__skyriver.suspend());
  await page.screenshot({path:`${out}/lap-${sec}s.png`});
  result.frames.push(await page.evaluate(()=>{const a=window.__skyriver;return {...a.stats(),camera:a.scene.camera.position.toArray(),render:a.scene.debug()};}));
  await page.evaluate(()=>window.__skyriver.resume());
 }
 fs.writeFileSync(`${out}/frames.json`,JSON.stringify(result,null,2));await browser.close();
})();
