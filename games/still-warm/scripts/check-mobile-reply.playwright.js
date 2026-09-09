async page => {
  const context = await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone = await context.newPage();
  try {
    await phone.clock.install();
    await phone.goto('http://127.0.0.1:4320/play.html');
    await phone.getByRole('button',{name:'Begin',exact:true}).click();
    if (!(await phone.locator('.coarse-pointer').filter({hasText:'Tap to continue'}).isVisible())) throw new Error('Touch hint missing.');
    const next = phone.getByRole('button',{name:'Reveal text or continue',exact:true});
    let clicks=0;
    while(await next.isVisible()) {
      await next.click();
      if(++clicks>12) throw new Error('Opening failed to finish.');
    }
    const thought=phone.locator('.inner-voice .sr-only');
    const last='Oh! My boy is here, in the dark. He must be so scared.';
    if(await thought.innerText()!==last) throw new Error('Final line was replaced.');
    await phone.clock.runFor(2500);
    await phone.clock.fastForward(20000);
    if(await thought.innerText()!==last) throw new Error('Final line was removed while waiting.');
    const layout=await phone.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,focused:document.activeElement?.tagName,text:document.body.innerText}));
    if(layout.overflow || layout.focused==='INPUT' || /Say something/i.test(layout.text)) throw new Error('Reply layout or focus failed.');
    await phone.screenshot({path:'/tmp/still-warm-mobile-reply.png'});
    return {tapHint:true,retainedLastLine:true,keyboardNotOpenedOnStart:true,noHorizontalOverflow:true,screenshot:'/tmp/still-warm-mobile-reply.png'};
  } finally { await context.close(); }
}
