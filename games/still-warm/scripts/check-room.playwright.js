async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4320/scene.html');
 await page.getByRole('button',{name:'Lift cabinet',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('footer').textContent.includes('covered'),null,{timeout:25000});
 await page.screenshot({path:'/tmp/room-after-lift.png'});
 await page.getByRole('button',{name:'Roll me over',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('footer').textContent.includes('Rolled him'),null,{timeout:25000});
 await page.getByRole('button',{name:'Light lantern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('footer').textContent.includes('lantern is lit'),null,{timeout:25000});
 await page.getByRole('button',{name:'Look at my boy',exact:true}).click();
 await page.screenshot({path:'/tmp/room-ready.png'});
 return {footer:await page.locator('footer').innerText(),errors};
}
