async page => {
  const mountReview = async target => {
    await target.goto('http://127.0.0.1:4320/play.html');
    await target.getByRole('button',{name:'Begin',exact:true}).waitFor();
    const audioOff=await target.locator('.sound-choice').getAttribute('aria-pressed')==='false';
    await target.evaluate(async () => {
      const resources=performance.getEntriesByType('resource');
      const React=(await import(resources.find(r=>/\/react\.js\?/.test(r.name)).name)).default;
      const ReactDOM=(await import(resources.find(r=>/react-dom_client\.js\?/.test(r.name)).name)).default;
      const {PlayerReply}=await import('/src/ui/PlayerReply.tsx');
      document.getElementById('root').style.display='none';
      const host=document.createElement('div');
      document.body.append(host);
      function Review() {
        const [value,setValue]=React.useState('');
        const [listening,setListening]=React.useState(false);
        const [busy,setBusy]=React.useState(false);
        const ref=React.useRef(null);
        return React.createElement(PlayerReply,{inputRef:ref,value,onChange:setValue,onSubmit:event=>{event.preventDefault();setValue('');setBusy(true);},onFocus:()=>{},onBlur:()=>{},voiceSupported:true,listening,busy,onStopWork:()=>setBusy(false),onSpeak:()=>setListening(true),onStopSpeaking:()=>setListening(false),onCancelSpeaking:()=>setListening(false)});
      }
      ReactDOM.createRoot(host).render(React.createElement(Review));
    });
    return audioOff;
  };
  const inputFocused=target => target.evaluate(()=>document.activeElement===document.querySelector('.command-form input'));
  const waitFrame=target => target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

  const audioOff=await mountReview(page);
  const input=page.getByRole('textbox',{name:'Your instruction',exact:true});
  await input.waitFor();
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.command-form input'));
  const desktopMedia=await page.evaluate(()=>matchMedia('(hover: hover) and (pointer: fine)').matches);
  const mountFocused=await inputFocused(page);

  await input.fill('Lift the cabinet.');
  await page.getByRole('button',{name:'Send instruction',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.command-form input'));
  const submitFocused=await inputFocused(page);

  const stop=page.getByRole('button',{name:'Stop',exact:true});
  await stop.focus();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await waitFrame(page);
  const busyNotStolen=await page.evaluate(()=>document.activeElement===document.querySelector('.stop-control'));
  await stop.click();
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.command-form input'));
  const readyFocused=await inputFocused(page);

  const speak=page.getByRole('button',{name:'Hold to speak',exact:true});
  await speak.focus();
  await page.keyboard.down('Space');
  await page.locator('.speak-button.listening').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await waitFrame(page);
  const listeningNotStolen=await page.evaluate(()=>document.activeElement?.classList.contains('speak-button'));
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.command-form input'));

  await speak.focus();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.command-form input'));
  const windowFocusRestored=await inputFocused(page);

  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await context.newPage();
  try {
    const mobileAudioOff=await mountReview(phone);
    const mobileInput=phone.getByRole('textbox',{name:'Your instruction',exact:true});
    await mobileInput.waitFor();
    await waitFrame(phone);
    const mobileMedia=await phone.evaluate(()=>matchMedia('(hover: hover) and (pointer: fine)').matches);
    const mobileNoAutofocus=!(await inputFocused(phone));
    const mobileActive=await phone.evaluate(()=>({tag:document.activeElement?.tagName,aria:document.activeElement?.getAttribute('aria-label')}));
    if(!desktopMedia || !mountFocused || !submitFocused || !busyNotStolen || !readyFocused || !listeningNotStolen || !windowFocusRestored || mobileMedia || !mobileNoAutofocus || !audioOff || !mobileAudioOff) {
      throw new Error(JSON.stringify({desktopMedia,mountFocused,submitFocused,busyNotStolen,readyFocused,listeningNotStolen,windowFocusRestored,mobileMedia,mobileNoAutofocus,mobileActive,audioOff,mobileAudioOff}));
    }
    return {desktopMedia,mountFocused,submitFocused,busyNotStolen,readyFocused,listeningNotStolen,windowFocusRestored,mobileMedia,mobileNoAutofocus,mobileActive,audioOff,mobileAudioOff};
  } finally { await context.close(); }
}
