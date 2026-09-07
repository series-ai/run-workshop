async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4320/scene.html');
 await page.getByRole('button',{name:'Light lantern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('footer').textContent.includes('lantern is lit'),null,{timeout:20000});
 await page.getByRole('button',{name:'Look at son',exact:true}).click();
 await page.screenshot({path:'/tmp/room-ready.png'});
 await page.getByRole('button',{name:'Lift beam',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('footer').textContent.includes('covered'),null,{timeout:22000});
 await page.getByRole('button',{name:'Look at chest',exact:true}).click();
 await page.screenshot({path:'/tmp/room-after-lift.png'});
 return {footer:await page.locator('footer').innerText(),errors};
}
