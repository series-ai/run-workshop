async page => {
 await page.getByRole('button',{name:'Turn and return'}).click();
 const play=page.getByRole('button',{name:'Play',exact:true});if(await play.count())await play.click();
 let maxError=0,far=0;
 const end=Date.now()+57000;
 while(Date.now()<end){
  await page.waitForTimeout(200);
  const s=JSON.parse(await page.locator('#pose-data').textContent());
  if(s){maxError=Math.max(maxError,...s.feet.map(f=>f.error));far=Math.max(far,s.root[2]);}
 }
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const last=JSON.parse(await page.locator('#pose-data').textContent());
 if(last.phase!=='working')throw Error('Sequence did not finish its return action');
 if(far<1.8)throw Error('Did not cross room');
 if(Math.hypot(last.root[0]+.66,last.root[2]-.42)>.1)throw Error('Did not return home');
 if(maxError>.01)throw Error(`Foot target miss ${maxError}`);
 return {maxError,far,last};
}
