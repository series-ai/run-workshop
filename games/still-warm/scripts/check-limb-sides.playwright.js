async page => {
  await page.locator('select').first().selectOption('game');
  await page.getByRole('button',{name:'Stand and breathe'}).click();
  const play=page.getByRole('button',{name:'Play',exact:true});
  if(await play.count()) await play.click();
  await page.waitForTimeout(600);
  const read=()=>page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('@react-three_fiber.js'));
    const {_roots}=await import(url);
    const scene=[..._roots.values()][0].store.getState().scene;
    const root=scene.getObjectByName('generated-assistant-rig');
    const points=Object.fromEntries(['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'].map(name=>{
      const bone=root.getObjectByName(name);
      const point=bone.getWorldPosition(bone.position.clone());
      return [name,root.worldToLocal(point).toArray()];
    }));
    return points;
  });
  const idle=await read();
  const assertSides=points=>{
    for(const name of ['LeftForeArm','LeftHand','LeftLeg'])if(points[name][0]<0)throw Error(`${name} crossed to right: ${points[name][0]}`);
    for(const name of ['RightForeArm','RightHand','RightLeg'])if(points[name][0]>0)throw Error(`${name} crossed to left: ${points[name][0]}`);
  };
  assertSides(idle);
  await page.getByRole('button',{name:'Cross the room'}).click();
  const samples=[];
  for(let i=0;i<20;i++) {await page.waitForTimeout(200);const points=await read();assertSides(points);samples.push(points);}
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.screenshot({path:'/tmp/rig-fixed-walk.png'});
  return {idle,samples:samples.length,sideChecks:'passed'};
}
