import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({headless:true,channel:'chromium'});
try {
 const page=await browser.newPage();const results=[];
 for (const width of [390,900,901,1024,1280,1400,1401,1440]) {
  await page.setViewportSize({width,height:900});await page.goto(process.env.INKLINE_UI_URL??'http://127.0.0.1:5296');
  await page.getByLabel('Loading scene',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('tab',{name:/Model Catalog|Assets/}).click();
  await page.getByLabel('Loading scene',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Reset stage',exact:true}).click();
  const result=await page.locator('.ink-header').evaluate(header=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   const h=rect(header), title=rect(header.querySelector('h1'));
   const controls=[...header.querySelectorAll('button')].filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>({name:e.getAttribute('aria-label')??e.textContent.trim(),...rect(e)}));
   return {header:h,title,controls,scrollLeft:header.scrollLeft,overflow:header.scrollWidth>header.clientWidth+1,pass:header.scrollWidth<=header.clientWidth+1&&header.scrollLeft===0&&title.left>=h.left&&title.right<=h.right+1&&controls.every(r=>r.left>=h.left&&r.right<=h.right+1&&r.top>=h.top&&r.bottom<=h.bottom+1)};
  });results.push({width,...result});
  await page.screenshot({path:`docs/verification/correction/header-${process.env.INKLINE_HEADER_LABEL??'final'}-${width}.png`});
 }
 console.log(JSON.stringify(results.map(({width,pass,scrollLeft,overflow})=>({width,pass,scrollLeft,overflow})),null,2));
 await writeFile(`docs/verification/correction/header-${process.env.INKLINE_HEADER_LABEL??'final'}.json`,JSON.stringify({checkedAt:new Date().toISOString(),sourceSHA256:{'src/styles.css':createHash('sha256').update(await readFile('src/styles.css')).digest('hex')},pass:results.every(r=>r.pass),results},null,2));
 if(results.some(r=>!r.pass)) process.exitCode=1;
}finally{await browser.close()}
