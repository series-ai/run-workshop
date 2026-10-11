async page => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://localhost:5197/review/index.html');
  await page.waitForFunction(()=>document.querySelector('#line-motion')?.readyState>=1);
  const video=page.locator('#line-motion');
  await video.evaluate(v=>v.play()); await page.waitForTimeout(1200);
  const playback=await video.evaluate(v=>({time:v.currentTime,paused:v.paused,error:v.error?.message??null,width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
  if(playback.paused||playback.error||playback.time<.5||playback.width!==800||playback.duration<45)throw new Error('New motion playback failed.');
  await video.evaluate(v=>{v.pause();v.currentTime=12}); await page.waitForTimeout(400);
  await page.screenshot({path:'docs/verification/correction/line-review-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw new Error('Phone review page overflow.');
  await page.screenshot({path:'docs/verification/correction/line-review-phone.png',fullPage:true});
  await page.goto('http://localhost:5197/review/motion-library.html');
  await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=1));
  const clips=await page.locator('li').count();if(clips!==85)throw new Error('Expected85clips.');
  const videos=[];
  for(const v of await page.locator('video').all()){
    await v.evaluate(v=>v.play());await page.waitForTimeout(500);
    const result=await v.evaluate(v=>({time:v.currentTime,paused:v.paused,error:v.error?.message??null,duration:v.duration}));
    if(result.paused||result.error||result.time<.1)throw new Error('Motion library playback failed.');
    await v.evaluate(v=>v.pause());videos.push(result);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await page.evaluate(result=>window.__lineReview=result,{pass:true,clips,videos,playback,phoneOverflow:overflow,errors});
}
