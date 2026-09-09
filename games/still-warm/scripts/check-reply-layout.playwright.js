async page => {
  await page.goto('http://127.0.0.1:4320/play.html');
  await page.getByRole('button',{name:'Begin',exact:true}).waitFor();
  await page.evaluate(async () => {
    const resources=performance.getEntriesByType('resource');
    const React=(await import(resources.find(r=>/\/react\.js\?/.test(r.name)).name)).default;
    const ReactDOM=(await import(resources.find(r=>/react-dom_client\.js\?/.test(r.name)).name)).default;
    const {PlayerReply}=await import('/src/ui/PlayerReply.tsx');
    const {useKeyboardInset}=await import('/src/ui/useKeyboardInset.ts');
    document.getElementById('root').style.display='none';
    const host=document.createElement('div');
    document.body.append(host);
    function Review() {
      const [value,setValue]=React.useState('');
      const [listening,setListening]=React.useState(false);
      const [busy,setBusy]=React.useState(false);
      const ref=React.useRef(null);
      const inset=useKeyboardInset();
      return React.createElement('main',{className:'game-shell',style:{'--keyboard-inset':`${inset}px`}},
        React.createElement('div',{className:'inner-voice'},"He's afraid of hurting me. He needs to hear my voice."),
        React.createElement(PlayerReply,{inputRef:ref,value,onChange:setValue,onSubmit:event=>{event.preventDefault();setValue('');setBusy(true);},onFocus:()=>{},onBlur:()=>{},voiceSupported:true,listening,busy,onStopWork:()=>setBusy(false),onSpeak:()=>setListening(true),onStopSpeaking:()=>setListening(false),onCancelSpeaking:()=>setListening(false)}));
    }
    ReactDOM.createRoot(host).render(React.createElement(Review));
  });
  const input=page.getByRole('textbox',{name:'Your instruction',exact:true});
  await input.waitFor();
  const measure=()=>page.evaluate(()=>Object.fromEntries(['.inner-voice','.command-form','.controls'].map(selector=>{
    const r=document.querySelector(selector).getBoundingClientRect();
    return [selector,[r.x,r.y,r.width,r.height]];
  })));
  const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${label}: ${JSON.stringify({a,b})}`);};
  const initial=await measure();
  await input.fill('Lift the cabinet.');
  same(initial,await measure(),'focus moved controls');
  await input.press('Enter');
  same(initial,await measure(),'send moved controls');
  const speak=page.getByRole('button',{name:'Hold to speak',exact:true});
  await speak.focus();
  same(initial,await measure(),'blur moved controls');
  await page.keyboard.down('Space');
  same(initial,await measure(),'listening moved controls');
  await page.keyboard.up('Space');
  await page.setViewportSize({width:390,height:844});
  const phone=await measure();
  await input.focus();
  same(phone,await measure(),'mobile focus moved controls');
  await page.evaluate(()=>{
    Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>500});
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(()=>document.querySelector('.game-shell').style.getPropertyValue('--keyboard-inset')==='344px');
  const keyboard=await measure();
  if(keyboard['.command-form'][1]+keyboard['.command-form'][3]>500 || keyboard['.inner-voice'][1]<0)throw new Error('Keyboard covered controls.');
  await speak.focus();
  same(keyboard,await measure(),'blur moved controls while keyboard remained open');
  await page.screenshot({path:'/tmp/still-warm-stable-keyboard.png'});
  await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.querySelector('.game-shell').style.getPropertyValue('--keyboard-inset')==='0px');
  same(phone,await measure(),'keyboard close did not restore layout');
  await page.screenshot({path:'/tmp/still-warm-stable-reply.png'});
  return {focusStable:true,blurStable:true,sendStable:true,voiceStable:true,simulatedKeyboardClear:true,keyboardCloseRestoresLayout:true};
}
