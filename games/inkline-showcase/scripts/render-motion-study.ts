import { chromium } from '@playwright/test';
import type { PackManifest } from '../src/types';
import fs from 'node:fs/promises';
const root=process.cwd();
const manifest=JSON.parse(await fs.readFile(root+'/public/assets/manifest.json','utf8')) as PackManifest;
const browser=await chromium.launch({headless:true,channel:'chromium'});
try {const page=await browser.newPage();await page.goto(process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html');await page.waitForFunction(()=>!!window.inklineCapture);let html='<body style="background:#eeece5;margin:0;font:16px monospace">';
for(const id of ['punch-right','punch-heavy','kick-roundhouse','sword-slash','run','jump-start']) {let a=manifest.animations.find(x=>x.id===id)!;html+='<div style="display:flex"><h3 style="width:180px">'+id+'</h3>';for(const time of [a.contactTime? a.contactTime*.4 : a.duration*.15,a.contactTime??a.duration*.4,a.duration*.78]) {const r=await page.evaluate(async({id,time})=>window.inklineCapture.model('stick-standard',id,time,true),{id,time}); html+='<div><img width="280" src="'+r.png+'"><p>'+time.toFixed(2)+'s</p></div>';}html+='</div>';}
html+='</body>';await fs.writeFile(root+'/docs/verification/art-pass/pose-board.html',html);await page.setViewportSize({width:1060,height:2100});await page.setContent(html);await page.screenshot({path:root+'/docs/verification/art-pass/pose-board.png',fullPage:true});} finally {await browser.close()}
