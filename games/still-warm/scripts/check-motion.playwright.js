async page => {
  await page.getByRole('button',{name:'Cross the room'}).click();
  const play=page.getByRole('button',{name:'Play',exact:true});
  if(await play.count()) await play.click();
  const samples=[];
  for(let i=0;i<65;i++) {
    await page.waitForTimeout(100);
    const sample=JSON.parse(await page.locator('#pose-data').textContent());
    if(sample) samples.push(sample);
  }
  const maxError=Math.max(...samples.flatMap(s=>s.feet.map(f=>f.error)));
  const heights=new Set(samples.map(s=>s.root[1]));
  let maxStanceDrift=0;
  for(let i=1;i<samples.length;i++) for(let j=0;j<2;j++) {
    const a=samples[i-1].feet[j],b=samples[i].feet[j];
    if(a.planted&&b.planted) maxStanceDrift=Math.max(maxStanceDrift,Math.hypot(...a.position.map((x,k)=>x-b.position[k])));
  }
  if(maxError>.01) throw Error(`Foot target error ${maxError}`);
  if(maxStanceDrift>.01) throw Error(`Stance foot drift ${maxStanceDrift}`);
  if(heights.size!==1) throw Error('Vertical root bounce');
  if(!samples.some(s=>s.phase==='walking')||!samples.some(s=>s.phase==='turning')) throw Error('Missing walk or turn');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForTimeout(150);
  const before=await page.locator('#pose-data').textContent();
  await page.waitForTimeout(300);
  if(before!==await page.locator('#pose-data').textContent()) throw Error('Pause changed pose');
  await page.screenshot({path:'/tmp/proof-walk-final.png'});
  return {maxError,maxStanceDrift,rootHeight:[...heights],pause:'passed',phases:[...new Set(samples.map(s=>s.phase))]};
}
