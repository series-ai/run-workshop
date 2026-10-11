async page => {
  const output = '/Users/pany/.paseo/worktrees/05tg6iwp/fearless-spider/games/inkline-showcase/public/review';
  const beforeUrl = 'http://127.0.0.1:5298/audit.html';
  const afterUrl = 'http://127.0.0.1:5297/audit.html';
  await page.setViewportSize({width:1600,height:1000});
  await page.setContent(`<!doctype html><html><head><link rel="icon" href="data:,"><style>
    *{box-sizing:border-box}html,body{margin:0;height:100%;background:#eeece5;color:#151716;font-family:Arial,sans-serif}
    header{height:100px;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #cbcfc4}
    h1{font-size:30px;letter-spacing:-1px;margin:0}header p{font:12px monospace;letter-spacing:1px}
    main{height:830px;display:grid;grid-template-columns:1fr 1fr}section{position:relative}section+section{border-left:1px solid #b8bcb1}
    h2{position:absolute;left:30px;top:22px;z-index:1;margin:0;font-size:17px;letter-spacing:-.2px;background:#eeece5dd;padding:8px 12px}
    h2 span{font:11px monospace;display:block;margin-top:6px;color:#555851;letter-spacing:1px}
    section+section h2{border-left:3px solid #d45538}iframe{width:100%;height:100%;border:0}
    footer{height:70px;border-top:1px solid #cbcfc4;padding:22px 32px;display:flex;justify-content:space-between;font:13px monospace}
  </style></head><body><header><h1>INKLINE / Motion study</h1><p>ACTUAL RUNTIME · NORMAL SPEED</p></header><main>
    <section><h2>Release 1.2<span>SAVED BASELINE</span></h2><iframe title="Previous pass" src="${beforeUrl}"></iframe></section>
    <section><h2>Quality correction 1.3<span>BODY + MOTION + CAMERA</span></h2><iframe title="Quality correction" src="${afterUrl}"></iframe></section>
    </main><footer><span id="caption">Contact, travel, and recovery</span><span>Original 3D assets · Desktop capture</span></footer></body></html>`);
  const before = page.frames().find(frame=>frame.url()===beforeUrl);
  const after = page.frames().find(frame=>frame.url()===afterUrl);
  if (!before || !after) throw new Error('Both comparison builds must be available.');
  const frames=[before,after];
  for (const frame of frames) await frame.waitForFunction(()=>window.inklineAudit?.state().stats?.loading===false);
  const stage = async patch => {
    await Promise.all(frames.map(frame=>frame.evaluate(patch=>{const api=window.inklineAudit;api.set({...patch,playing:false,reset:api.state().settings.reset+1})},patch)));
    for (const frame of frames) await frame.waitForFunction(()=>!window.inklineAudit.state().stats.loading);
    await Promise.all(frames.map(frame=>frame.evaluate(()=>window.inklineAudit.set({playing:true}))));
  };
  await stage({mode:'overview',camera:'side',speed:1});
  await page.screencast.start({path:`${output}/inkline-kinetic-comparison.webm`,size:{width:1600,height:1000}});
  try {
    await page.waitForTimeout(8000);
    await page.screenshot({path:`${output}/kinetic-comparison.png`});
    await page.locator('#caption').evaluate(el=>el.textContent='Movement through one shared environment');
    await stage({mode:'overview',camera:'perspective',speed:1});
    await page.waitForTimeout(6500);
    await page.locator('#caption').evaluate(el=>el.textContent='Weapon motion follows the mounted tool');
    await stage({mode:'animations',camera:'side',animationId:'sword-overhead',speed:1,avatar:{preset:'stick-fighter',color:'#151716',accent:'#d45538',height:1,thickness:1,headScale:1,headwear:'none',equipment:'sword'}});
    await page.waitForTimeout(7500);
    await page.locator('#caption').evaluate(el=>el.textContent='Pale figures keep a continuous dark contour');
    await stage({mode:'animations',camera:'perspective',animationId:'punch-heavy',speed:1,avatar:{preset:'stick-standard',color:'#faf9f5',accent:'#d45538',height:1,thickness:1,headScale:1,headwear:'none',equipment:null}});
    await page.waitForTimeout(7000);
    await page.locator('#caption').evaluate(el=>el.textContent='The moving camera keeps its requested direction');
    await stage({mode:'parkour',camera:'third-person',speed:1,motion:'reduced',avatar:{preset:'stick-standard',color:'#151716',accent:'#d45538',height:1,thickness:1,headScale:1,headwear:'none',equipment:null}});
    const input = async (action,pressed) => Promise.all(frames.map(frame=>frame.evaluate(detail=>window.dispatchEvent(new CustomEvent('inkline-input',{detail})),{action,pressed})));
    await input('forward',true); await page.waitForTimeout(7000); await input('forward',false);
    await page.waitForTimeout(4000);
  } finally { await page.screencast.stop(); }
  const results=await Promise.all(frames.map(frame=>frame.evaluate(()=>({state:window.inklineAudit.state(),art:window.inklineAudit.artState()}))));
  if(results.some(result=>result.state.stats.error)) throw new Error('A comparison build reported a runtime error.');
  return {duration:'about 48 seconds',before:beforeUrl,after:afterUrl,errors:results.map(result=>result.state.stats.error)};
}
