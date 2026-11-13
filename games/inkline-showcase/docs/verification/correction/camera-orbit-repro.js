async page => {
 const input=(action,pressed)=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('inkline-input',{detail})),{action,pressed});
 const dir=c=>{const a=c.position.map((x,i)=>x-c.target[i]);const l=Math.hypot(...a);return a.map(x=>x/l);};
 const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dir(a).reduce((s,v,i)=>s+v*dir(b)[i],0))))*180/Math.PI;
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>window.inklineAudit.set({mode:'animations',camera:'perspective',animationId:'kick-roundhouse',motion:'reduced'}));
 await page.waitForFunction(()=>!window.inklineAudit.state().stats.loading);
 await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(1050,490,{steps:10});await page.mouse.up();await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>window.inklineAudit.artState().camera);
 await page.setViewportSize({width:1440,height:901});await page.waitForTimeout(300);
 const after=await page.evaluate(()=>window.inklineAudit.artState().camera);
 await page.evaluate(()=>{const a=window.inklineAudit;a.set({mode:'combat',camera:'perspective',playing:true,reset:a.state().settings.reset+1});});
 await page.waitForFunction(()=>!window.inklineAudit.state().stats.loading);
 await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(820,470,{steps:8});await page.mouse.up();await page.waitForTimeout(1000);
 const gameBefore=await page.evaluate(()=>window.inklineAudit.artState().camera);
 await input('forward',true);await page.waitForTimeout(1400);await input('forward',false);
 await input('right',true);await page.waitForTimeout(680);await input('right',false);await page.waitForTimeout(1500);
 const gameAfter=await page.evaluate(()=>window.inklineAudit.artState().camera);
 return {preview:{before,after,distance:Math.hypot(...after.position.map((v,i)=>v-before.position[i])),angle:angle(before,after)},game:{before:gameBefore,after:gameAfter,angle:angle(gameBefore,gameAfter)},stats:await page.evaluate(()=>window.inklineAudit.state().stats)};
}
