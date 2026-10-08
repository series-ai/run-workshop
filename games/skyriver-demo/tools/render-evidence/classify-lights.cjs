'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.argv[2]||'http://127.0.0.1:5200/?tier=high';
const out=path.resolve(process.argv[3]||'render-evidence/classification');
const targetInput=process.argv[5];
const targets=targetInput===undefined?[8.2,24,40]:targetInput.split(',').map(value=>{
 const time=Number(value);
 if(value.trim()===''||!Number.isFinite(time)||time<0)throw new Error('Target times must be finite nonnegative numbers. Use a comma-separated list.');
 return time;
});
const referencePath=process.argv[4]?path.resolve(process.argv[4]):null;
const reference=referencePath?JSON.parse(fs.readFileSync(referencePath,'utf8')):null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={cpu_with_hull:'#6de0a2',same_car_impostor:'#46cabb',cpu_without_hull:'#ff6969',cpu_far_low_allowed:'#f0c36b',gpu_stream:'#65d8ef',gpu_lane:'#968aff',gpu_ring:'#e285d7',unknown:'#ffffff',ambiguous:'#ffaa45',full_only_unknown:'#a5adba'};

async function capture(page,target,tier,referenceCamera){
 return page.evaluate(({target,tier,referenceCamera})=>{
  const app=window.__skyriver;app.suspend();
  const s=app.scene,c=s.camera,r=s.renderer,gl=r.getContext(),scene=s.scene,D=window.__skyriverDiag;
  const state=app.renderState(),sourceTick=state.current.tick,sourceAlpha=state.alpha;
  if(referenceCamera){c.position.fromArray(referenceCamera.position);c.quaternion.fromArray(referenceCamera.quaternion);c.fov=referenceCamera.fov;c.aspect=referenceCamera.aspect;c.updateProjectionMatrix();}
  // The scene uses 30 ticks per second. This sets only frozen presentation time.
  const renderFrame=target*30,renderTick=Math.floor(renderFrame),renderAlpha=renderFrame-renderTick;c.updateMatrixWorld(true);s.update(renderTick,state.current,renderAlpha);c.updateMatrixWorld(true);
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight,C=4,HI=170,LO=60,MAX_HIGH=8,MAX_LOW=64;
  const read=()=>{const a=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const png=a=>{const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const img=ctx.createImageData(W,H);for(let y=0;y<H;y++)img.data.set(a.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);ctx.putImageData(img,0,0);return canvas.toDataURL('image/png');};
  const full=read();
  const streak=scene.getObjectByName('skyriver.traffic.streaks'),imp=scene.getObjectByName('skyriver.traffic.impostors');
  const hulls=app.traffic.objects.filter(o=>o.isInstancedMesh);
  const V=c.position.constructor,pv=new V();
  const project=p=>{pv.set(...p).project(c);return pv.z>=-1&&pv.z<=1&&Math.abs(pv.x)<=1.05&&Math.abs(pv.y)<=1.05?[(pv.x+1)*W/2,(1-pv.y)*H/2]:null;};
  const distance=p=>Math.hypot(p[0]-c.position.x,p[1]-c.position.y,p[2]-c.position.z);
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const posKey=p=>p.map(v=>v.toFixed(3)).join(':');
  const hullMap=new Map();
  for(const h of hulls)for(let i=0;i<h.count;i++){
   const m=h.instanceMatrix.array,o=i*16,p=[m[o+12],m[o+13],m[o+14]];
   const scale=Math.max(Math.hypot(m[o],m[o+1],m[o+2]),Math.hypot(m[o+4],m[o+5],m[o+6]),Math.hypot(m[o+8],m[o+9],m[o+10]));
   const record={mesh:h.name,slot:i,position:p,scale,visible:h.visible,distanceM:distance(p),drawn:h.visible&&scale>0&&distance(p)<=1300};
   const key=posKey(p);if(!hullMap.has(key))hullMap.set(key,[]);hullMap.get(key).push(record);
  }
  const sources={gpu:[],cpu:[]},gpuProjected=[];const allCpu=[];
  const P=streak.geometry.getAttribute('aCarPos').array,Q=streak.geometry.getAttribute('aCarDir').array,F=streak.geometry.getAttribute('aCarFade').array;
  const L=streak.geometry.getAttribute('aCarLod');
  const S=streak.geometry.getAttribute('aCarShape');
  const U=streak.material.uniforms;
  const parseLampProfiles=source=>{
   const marker='TrafficLampShape trafficLampProfile(float type, bool front)',start=source.indexOf(marker);if(start<0)return null;
   const bodyStart=source.indexOf('{',start);if(bodyStart<0)throw new Error('Live lamp profile function has no body.');let depth=0,bodyEnd=-1;
   for(let i=bodyStart;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0){bodyEnd=i;break;}}
   if(bodyEnd<0)throw new Error('Live lamp profile function is not closed.');const body=source.slice(bodyStart+1,bodyEnd),number='([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)';
   const re=new RegExp(`if\\s*\\(\\s*type\\s*<\\s*${number}\\s*\\)\\s*\\{\\s*if\\s*\\(\\s*front\\s*\\)\\s*return\\s+TrafficLampShape\\(\\s*vec4\\(([^)]*)\\)\\s*,\\s*${number}\\s*\\)\\s*;\\s*return\\s+TrafficLampShape\\(\\s*vec4\\(([^)]*)\\)\\s*,\\s*${number}\\s*\\)\\s*;\\s*\\}`, 'g');
   const rows=[...body.matchAll(re)];if(rows.length!==7)throw new Error(`Expected seven live lamp profiles. Found ${rows.length}.`);
   const shape=(dimensions,y)=>{const values=dimensions.split(',').map(v=>Number(v.trim()));if(values.length!==4||values.some(v=>!Number.isFinite(v))||!Number.isFinite(y))throw new Error('Invalid value in live lamp profile.');return{sideCenterM:values[0],widthParamM:values[1],heightM:values[2],zM:values[3],yM:y};};
   return rows.map((m,index)=>({index,front:shape(m[2],Number(m[3])),rear:shape(m[4],Number(m[5]))}));
  };
  const lampProfiles=parseLampProfiles(streak.material.vertexShader);
  const legacyLampOffsets=!lampProfiles&&Number.isFinite(U.uHeadOffset?.value)&&Number.isFinite(U.uTailOffset?.value);
  if(!lampProfiles&&!legacyLampOffsets)throw new Error('Live streak shader has no lamp profile table and no legacy lamp-offset uniforms.');
  if(lampProfiles&&(!S||S.itemSize!==2))throw new Error('Lamp-profile shader requires aCarShape(type, bank).');
  const lampPosition=(base,direction,bank,profile,side,scale)=>{
   const right0=new V(direction.z,0,-direction.x).normalize(),up0=new V().crossVectors(direction,right0),cos=Math.cos(bank),sin=Math.sin(bank);
   const rightW=right0.clone().multiplyScalar(cos).addScaledVector(up0,sin),upW=up0.clone().multiplyScalar(cos).addScaledVector(right0,-sin);
   const point=new V(...base).addScaledVector(direction,profile.zM*scale).addScaledVector(upW,profile.yM*scale).addScaledVector(rightW,profile.sideCenterM*side*scale);
   return {point,rightW,upW};
  };
  for(let i=0;i<streak.geometry.instanceCount;i++){
   const p=Array.from(P.subarray(i*3,i*3+3)),rawDirection=Array.from(Q.subarray(i*4,i*4+3)),direction=new V(rawDirection[0],Math.max(-0.35,Math.min(0.35,rawDirection[1])),rawDirection[2]).normalize(),fade=F[i*4],scale=F[i*4+1],d=distance(p);
   const matches=hullMap.get(posKey(p))||[];
   const hull=matches.length===1?matches[0]:null;
   const lightLod=L?Array.from(L.array.slice(i*3,i*3+3)):null;
   const sameCarFar=!!lightLod&&Number.isInteger(lightLod[2])&&lightLod[2]>=0&&lightLod[0]>=0&&lightLod[1]>0&&lightLod[0]+lightLod[1]<=1.000001&&d<6500;
   const cls=hull?.drawn?'cpu_with_hull':sameCarFar?'same_car_impostor':tier==='low'&&d>1300?'cpu_far_low_allowed':matches.length>1?'unknown':'cpu_without_hull';
   const typeIndex=S?Math.round(S.array[i*S.itemSize]):-1,bank=S?S.array[i*S.itemSize+1]:0,profile=lampProfiles?.[typeIndex]||null;
   if(lampProfiles&&!profile)throw new Error(`No live lamp profile for type index ${typeIndex}.`);
   const record={id:i+1,group:`cpu:${i}`,kind:'cpu',class:cls,position:p,distanceM:d,fade,bodyScale:scale,lightLod,sameCarFar,hull,hullMatchCount:matches.length,typeIndex,bank,lampProfileSource:lampProfiles?'live vertexShader trafficLampProfile':'legacy lamp-offset fallback',lamps:[]};
   allCpu.push(record);
   if(!(fade>0)||!streak.visible)continue;
   for(let lamp=0;lamp<5;lamp++){
    const trail=lamp===4,head=lamp%2===0&&!trail,side=trail?0:lamp<2?-1:1;
    if(trail&&F[i*4+3]<=0.001)continue;
    let lp,profileName;
    if(profile){
     const resolved=lampPosition(p,direction,bank,head?profile.front:profile.rear,side,scale);lp=resolved.point.toArray();profileName=head?'front':'rear';
    }else{
     const right=new V(-direction.z+1e-5,1e-5,direction.x+1e-5).normalize();
     const offset=head?U.uHeadOffset.value:-U.uTailOffset.value;
     lp=new V(...p).addScaledVector(direction,offset*scale).addScaledVector(right,side*0.72*scale).toArray();profileName=head?'legacy-front':'legacy-rear';
    }
    const ld=distance(lp),toCam=lp.map((v,j)=>(c.position.toArray()[j]-v)/ld),facing=direction.toArray().reduce((sum,v,j)=>sum+v*toCam[j],0)*(head?1:-1);
    const intensity=trail?fade*F[i*4+3]*smooth(30,90,ld):fade*(head?smooth(0.1,0.7,facing):smooth(-0.85,0.3,facing))*smooth(140,300,ld);
    const screen=project(lp);if(screen&&intensity>0.001)record.lamps.push({lamp,side,position:lp,screen,intensity,profile:profileName});
   }
   if(record.lamps.length)sources.cpu.push(record);
  }
  const impCount=imp.geometry.instanceCount,attrs=impCount?D.deriveImpostorAttributes(424242,impCount):null;
  const attribute=attrs&&(attrs.streamArcPhaseSeed||attrs.pathArcPhaseSeed);
  if(attrs){
   const compareAttribute=(name,expected)=>{
    const actual=imp.geometry.getAttribute(name)?.array;
    if(!actual||actual.length<expected.length)throw new Error(`GPU attribute ${name} is missing or too short.`);
    for(let i=0;i<expected.length;i++)if(expected[i]!==actual[i])throw new Error(`GPU diagnostic ${name} differs at ${i}.`);
   };
   compareAttribute('aImp',attribute);
   if(attrs.flow&&attrs.route){
    compareAttribute('aFlow',attrs.flow);
    compareAttribute('aRoute',attrs.route);
    for(let i=0;i<attrs.row.length;i++)if(attrs.row[i]!==attrs.flow[i*4])throw new Error('GPU diagnostic sub-row differs from flow.');
   }else{
    // R20 and earlier use one sub-row attribute.
    compareAttribute('aImpRow',attrs.row);
   }
  }
  const iu=imp.material.uniforms,band=iu.uBand.value.toArray(),t=iu.uTime.value,q={x:0,y:0,z:0,dx:0,dy:0,dz:0};
  const appearance=imp.geometry.getAttribute('aAppearance');
  if(lampProfiles&&(!appearance||appearance.itemSize!==1))throw new Error('Profile shader requires scalar aAppearance.');
  const gpuPixelAngle=Number(iu.uPixelAngle?.value),gpuIntensity=Number(iu.uIntensity?.value),gpuThresholdVisible=0.001;
  for(let i=0;i<impCount&&imp.visible;i++){
   D.impostorPosition(attrs,i,t,q);const p=[q.x,q.y,q.z],screen=project(p),d=distance(p),k=attribute[i*4];
   const startAlpha=imp.geometry.getAttribute('aFromAlpha');
   const presence=startAlpha&&iu.uTargetCount
    ?startAlpha.array[i]*(1-iu.uFadeK.value)+(i<iu.uTargetCount.value?1:0)*iu.uFadeK.value
    :i>=iu.uFadeFrom.value?iu.uFadeK.value:1;
   const farBand=iu.uFarFalloff?.value.toArray(),farBrightness=farBand?1-smooth(farBand[0],farBand[1],d):1,seed=attribute[i*4+3];
   const handoverAlpha=smooth(band[0],band[1],d),seedBrightness=.55+.6*((seed*29.7)%1),active=seedBrightness*handoverAlpha*presence*farBrightness;
   const dir=new V(q.dx,q.dy,q.dz).normalize(),toCam=new V(c.position.x-p[0],c.position.y-p[1],c.position.z-p[2]).normalize(),facing=dir.dot(toCam),frontMix=smooth(-0.2,0.3,facing);
   const packed=appearance?Number(appearance.array[i]):null,typeIndex=packed===null?-1:Math.floor(packed),scale=packed===null?null:(packed-typeIndex)*8,profile=lampProfiles?.[typeIndex]||null;
   if(lampProfiles&&!profile)throw new Error(`No live GPU lamp profile for type index ${typeIndex}.`);
   const kernelCenters=[];
   if(profile){
    const shape={sideCenterM:profile.rear.sideCenterM+(profile.front.sideCenterM-profile.rear.sideCenterM)*frontMix,widthParamM:profile.rear.widthParamM+(profile.front.widthParamM-profile.rear.widthParamM)*frontMix,heightM:profile.rear.heightM+(profile.front.heightM-profile.rear.heightM)*frontMix,zM:profile.rear.zM+(profile.front.zM-profile.rear.zM)*frontMix,yM:profile.rear.yM+(profile.front.yM-profile.rear.yM)*frontMix};
    const right0=new V(dir.z,0,-dir.x).normalize(),up0=new V().crossVectors(dir,right0),group=new V(...p).addScaledVector(dir,shape.zM*scale).addScaledVector(up0,shape.yM*scale);
    const groupView=group.clone().applyMatrix4(c.matrixWorldInverse),rightView=right0.clone().transformDirection(c.matrixWorldInverse),depth=Math.max(-groupView.z,1),pixelM=depth*gpuPixelAngle;
    const rightProjection=new V(rightView.x+groupView.x*rightView.z/depth,rightView.y+groupView.y*rightView.z/depth,0),rightLength=rightProjection.length(),physicalHalfPx=shape.widthParamM*scale*rightLength/pixelM/2,coreHalfPx=Math.max(physicalHalfPx,0.65);
    for(const side of [-1,1]){const world=group.clone().addScaledVector(right0,side*shape.sideCenterM*scale).toArray();kernelCenters.push({side,world,screen:project(world),widthM:shape.widthParamM*scale,physicalCoreWidthPx:2*physicalHalfPx,filteredCoreWidthPx:2*coreHalfPx,aaPaddedSupportWidthPx:2*(coreHalfPx+0.5),minimumCoreWidthPx:1.3});}
   }
   const record={id:i+1,group:`gpu:${i}`,kind:'gpu',class:k<8?'gpu_stream':k<14?'gpu_lane':k<14+iu.uRingA.value.length?'gpu_ring':'unknown',path:k,position:p,screen,distanceM:d,presence,tierPresence:presence,handoverAlpha,farBrightness,seedBrightness,sourceIntensity:active,outputIntensity:active*gpuIntensity,gpuThresholdVisible:active>gpuThresholdVisible,appearancePacked:packed,typeIndex,scale,frontMix,facing,pixelAngle:gpuPixelAngle,kernelCenters};
   if(screen)gpuProjected.push(record);
   if(screen&&active>gpuThresholdVisible)sources.gpu.push(record);
  }
  const savedObjects=[],savedMaterials=new Map(),originalBg=scene.background;
  // Use the existing Color constructor from a material. Vector constructors are not Color.
  const clearColor=r.getClearColor(imp.material.uniforms.fogColor.value.clone());
  const clearAlpha=r.getClearAlpha();
  const saveMaterial=m=>{if(!savedMaterials.has(m))savedMaterials.set(m,m.colorWrite);};
  scene.traverse(o=>{if(!o.isMesh)return;savedObjects.push([o,o.visible]);if(o===streak||o===imp)return;const materials=Array.isArray(o.material)?o.material:[o.material];const opaque=materials.every(m=>!m.transparent&&m.depthWrite!==false);if(!opaque)o.visible=false;else for(const m of materials){saveMaterial(m);m.colorWrite=false;}});
  scene.background=null;r.setClearColor(0x000000,1);
  const clones=[];
  const originalStreak=streak.material,originalImp=imp.material;
  const makeIdMaterial=original=>{
   const clone=original.clone();clone.uniforms=original.uniforms;clone.blending=0;clone.transparent=false;clone.toneMapped=false;
   const mainPattern=/void\s+main\s*\(\s*\)\s*\{/;
   if(!mainPattern.test(original.vertexShader)||!mainPattern.test(original.fragmentShader))throw new Error('Source-ID pass cannot find the live shader main.');
   clone.vertexShader=original.vertexShader.replace(mainPattern,'varying float vProofId;\nvoid main() {\n vProofId = float(gl_InstanceID) + 1.0;');
   clone.fragmentShader=original.fragmentShader.replace(mainPattern,'varying float vProofId;\nvoid main() {').replace(/}\s*$/,`\n  if (vIntensity <= 0.001 || body <= 0.0) discard;\n  float n = floor(vProofId + 0.5);\n  gl_FragColor = vec4(mod(n,256.0), mod(floor(n/256.0),256.0), floor(n/65536.0), 255.0) / 255.0;\n}`);
   clones.push(clone);return clone;
  };
  let isolated,gpuIds,cpuIds;
  try{
   s.composer.render(0);isolated=read();
   // Separate source-ID passes keep city depth tests and the actual sprite capsule support.
   imp.material=makeIdMaterial(originalImp);streak.visible=false;r.setRenderTarget(null);r.render(scene,c);gpuIds=read();
   imp.visible=false;streak.visible=true;streak.material=makeIdMaterial(originalStreak);r.render(scene,c);cpuIds=read();
  }finally{
   streak.material=originalStreak;imp.material=originalImp;
   for(const [o,visible]of savedObjects)o.visible=visible;
   for(const [m,write]of savedMaterials)m.colorWrite=write;
   scene.background=originalBg;r.setClearColor(clearColor,clearAlpha);for(const m of clones)m.dispose();r.state.reset();
  }
  const cellsOf=buf=>{const cw=Math.floor(W/C),ch=Math.floor(H/C),a=new Uint8Array(cw*ch);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=((H-1-y)*W+x)*4,l=(.2126*buf[o]+.7152*buf[o+1]+.0722*buf[o+2])|0,k=Math.floor(y/C)*cw+Math.floor(x/C);if(l>a[k])a[k]=l;}return{a,cw,ch};};
  const detector=buf=>{
   const {a,cw,ch}=cellsOf(buf),seen=new Uint8Array(a.length),small=[],large=[];
   const allowed=(x,y)=>x>=Math.ceil(cw*.1)&&x<Math.floor(cw*.88)&&y>=Math.floor(ch*.1)&&y<Math.ceil(ch*.9);
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    const start=y*cw+x;if(seen[start]||a[start]<LO||!allowed(x,y))continue;
    const cells=[],queue=[start];seen[start]=1;let peak=start,high=0;
    for(let j=0;j<queue.length;j++){const k=queue[j],xx=k%cw,yy=Math.floor(k/cw);cells.push(k);if(a[k]>a[peak])peak=k;if(a[k]>=HI)high++;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=xx+dx,ny=yy+dy,nk=ny*cw+nx;if(allowed(nx,ny)&&!seen[nk]&&a[nk]>=LO){seen[nk]=1;queue.push(nk);}}
    }
    if(!high)continue;
    const px=peak%cw,py=Math.floor(peak/cw);let localHigh=0;for(let yy=py-2;yy<=py+2;yy++)for(let xx=px-2;xx<=px+2;xx++)if(xx>=0&&xx<cw&&yy>=0&&yy<ch&&a[yy*cw+xx]>=HI)localHigh++;
    const xs=cells.map(k=>k%cw),ys=cells.map(k=>Math.floor(k/cw));
    const blob={peak:[px*C+2,py*C+2],peakLuma:a[peak],highCells:high,localHighCells:localHigh,lowCells:cells.length,bbox:[Math.min(...xs)*C,Math.min(...ys)*C,(Math.max(...xs)+1)*C,(Math.max(...ys)+1)*C],cells};
    (localHigh<=MAX_HIGH&&high<=MAX_HIGH&&cells.length<=MAX_LOW?small:large).push(blob);
   }return{small,large};
  };
  const detected=detector(isolated),fullDetected=detector(full);
  const gpuMap=new Map(sources.gpu.map(s=>[s.id,s])),cpuMap=new Map(sources.cpu.map(s=>[s.id,s]));
  const idAt=(buf,x,y)=>{const o=((H-1-y)*W+x)*4;return buf[o]+256*buf[o+1]+65536*buf[o+2];};
  const groupsAt=blob=>{
   const support=new Map();
   for(const cell of blob.cells){const cx=cell%(W/C),cy=Math.floor(cell/(W/C));for(let dy=0;dy<C;dy++)for(let dx=0;dx<C;dx++){
    const x=cx*C+dx,y=cy*C+dy,o=((H-1-y)*W+x)*4,lum=.2126*isolated[o]+.7152*isolated[o+1]+.0722*isolated[o+2];if(lum<LO)continue;
    for(const [buf,map]of [[gpuIds,gpuMap],[cpuIds,cpuMap]]){const id=idAt(buf,x,y),source=map.get(id);if(source){const rec=support.get(source.group)||{source,pixels:0};rec.pixels++;support.set(source.group,rec);}}
   }}
   return [...support.values()].map(({source,pixels})=>{const points=source.kind==='cpu'?source.lamps.map(l=>l.screen):[source.screen];const nearestPx=Math.min(...points.map(p=>Math.hypot(p[0]-blob.peak[0],p[1]-blob.peak[1])));return{...source,supportPixels:pixels,nearestProjectedDistancePx:nearestPx};}).sort((a,b)=>a.nearestProjectedDistancePx-b.nearestProjectedDistancePx);
  };
  const blobs=detected.small.map((blob,index)=>{const candidates=groupsAt(blob);const nearest=candidates[0]||null;return{...blob,id:index,class:candidates.length>1?'ambiguous':nearest?.class||'unknown',ambiguous:candidates.length>1,clusterBlend:candidates.length>1,candidates,nearest,reason:candidates.length>1?'Multiple legitimate groups have raster support in this blob.':nearest?'Projected source has actual depth-tested raster support.':'No valid traffic source-ID support matched this blob.'};});
  const classifiedLarge=detected.large.map((blob,index)=>{const candidates=groupsAt(blob);return{...blob,id:`large-${index}`,class:candidates.length>1?'ambiguous':candidates[0]?.class||'unknown',candidates,reason:'Cluster exceeds the stated small-blob area. Source support remains in this audit.'};});
  const fullLarge=fullDetected.large.map((blob,index)=>({...blob,id:`full-large-${index}`,class:'full_only_unknown',reason:'Full-frame cluster exceeds the stated small-blob area. It is not part of the small-light count.'}));
  const fullOnly=fullDetected.small.filter(b=>!blobs.some(q=>Math.hypot(b.peak[0]-q.peak[0],b.peak[1]-q.peak[1])<=12)).map((b,i)=>({...b,id:`full-${i}`,class:'full_only_unknown',reason:'No isolated traffic blob matched within 12 px. This can be a nontraffic emitter, a hull lamp patch, or an unresolved blend.'}));
  const counts=Object.fromEntries(['cpu_with_hull','same_car_impostor','cpu_without_hull','cpu_far_low_allowed','gpu_stream','gpu_lane','gpu_ring','unknown','ambiguous'].map(k=>[k,0]));for(const b of blobs)counts[b.class]=(counts[b.class]||0)+1;
  const active=allCpu.filter(p=>p.fade>0),activeScreen=active.filter(p=>project(p.position));
  const orphan=active.filter(p=>!p.hull?.drawn&&!p.sameCarFar),visibleCpuIds=new Set();for(let o=0;o<cpuIds.length;o+=4){const id=cpuIds[o]+cpuIds[o+1]*256+cpuIds[o+2]*65536;if(id)visibleCpuIds.add(id);}
  const maxDistance=list=>list.length?Math.max(...list.map(p=>p.distanceM)):null;
  const shaders={gpuVertex:originalImp.vertexShader,gpuFragment:originalImp.fragmentShader,cpuVertex:originalStreak.vertexShader,cpuFragment:originalStreak.fragmentShader};
  for(const b of [...blobs,...fullOnly,...classifiedLarge,...fullLarge])delete b.cells;
  s.update(renderTick,state.current,renderAlpha);
  return{targetTimeS:target,actualTimeS:t,renderTick,renderAlpha,tickRate:30,sourceSimTick:sourceTick,sourceSimAlpha:sourceAlpha,referenceCameraUsed:!!referenceCamera,tier,camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect},width:W,height:H,stats:app.stats(),adapter:s.glDiagnostics(),handOverBandM:band,farFalloffBandM:iu.uFarFalloff?.value.toArray()||null,impostors:impCount,sourceCounts:{cpu:sources.cpu.length,gpu:sources.gpu.length,gpuProjected:gpuProjected.length},gpuProjectionAudit:{pixelAngle:gpuPixelAngle,intensity:gpuIntensity,shaderThreshold:gpuThresholdVisible,uFadeK:iu.uFadeK?.value??null,uTargetCount:iu.uTargetCount?.value??null,uFadeFrom:iu.uFadeFrom?.value??null,profileSource:lampProfiles?'live streak vertexShader trafficLampProfile':'legacy lamp-offset fallback',projected:gpuProjected},lampProfileAudit:{source:lampProfiles?'live streak vertexShader trafficLampProfile':'legacy lamp-offset fallback',profileCount:lampProfiles?.length??null,profiles:lampProfiles},cpuActiveFade:{count:active.length,maxDistanceM:maxDistance(active),onScreenCount:activeScreen.length,onScreenMaxDistanceM:maxDistance(activeScreen),withoutDrawnHull:active.filter(p=>!p.hull?.drawn).length,withoutHullOrSameCarImpostor:orphan.length,sameCarImpostorCount:active.filter(p=>p.sameCarFar).length,withoutDrawnHullMaxDistanceM:maxDistance(orphan),actualRasterSupportCount:visibleCpuIds.size,actualRasterSupportMaxDistanceM:maxDistance(active.filter(p=>visibleCpuIds.has(p.id)))},cpuActiveRecords:active.map(({id,distanceM,fade,lightLod,sameCarFar,hull,hullMatchCount,class:cls,typeIndex,bank,lamps})=>({id,distanceM,fade,lightLod,sameCarFar,hull,hullMatchCount,class:cls,typeIndex,bank,lamps})),detector:{HI,LO,cellPx:C,maxHighClusterCells:MAX_HIGH,maxLowClusterCells:MAX_LOW,maxLocalHighCells:MAX_HIGH,roi:[.1,.1,.88,.9]},blobs,counts,fullOnly,excludedLargeIsolated:classifiedLarge,excludedLargeFull:fullLarge,shaders,glError:gl.getError(),images:{full:png(full),isolated:png(isolated),gpuIds:png(gpuIds),cpuIds:png(cpuIds)}};
 },{target,tier,referenceCamera});
}

(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.rmSync(path.join(out,'failure.json'),{force:true});const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const logs=[];const frames=[];
 try{
  const run=async(tier,times)=>{for(const time of times){
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
   page.on('console',m=>{if(m.type()==='error'||m.text().includes('gl adapter')){logs.push(`${tier}: ${m.type()}: ${m.text()}`);console.log(m.text());}});page.on('pageerror',e=>logs.push(`${tier}: pageerror: ${e.message}`));
   // Pause before navigation. Every frame starts with the same clock and no load-time drift.
   await page.clock.install({time:new Date('2026-10-06T23:59:59Z')});await page.clock.pauseAt(new Date('2026-10-07T00:00:00Z'));
   const targetUrl=new URL(url);targetUrl.searchParams.set('tier',tier);if(tier==='low')targetUrl.searchParams.delete('impostors');await page.goto(targetUrl.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.__skyriver),null,{timeout:20000,polling:100});const matched=reference?.frames.find(f=>f.tier===tier&&f.targetTimeS===time);if(reference&&!matched)throw new Error('Reference frame is missing.');await page.clock.runFor(time*1000-(matched?100:0));
   if(matched){const wanted=matched.sourceSimTick+matched.sourceSimAlpha;let aligned=false;for(let i=0;i<4;i++){const actual=await page.evaluate(()=>{const state=window.__skyriver.renderState();return state.current.tick+state.alpha;});const delta=wanted-actual;if(Math.abs(delta)<1e-7){aligned=true;break;}if(delta<0)throw new Error('Reference simulation phase was exceeded.');await page.clock.runFor(delta*1000/30);}if(!aligned)throw new Error('Reference simulation phase did not match.');}
   await page.waitForFunction(()=>window.__skyriver&&window.__skyriver.stats().firstFrameMs!==null);
   const frame=await capture(page,time,tier,matched?.camera);if(matched){frame.referenceMatch={simulationTickDelta:frame.sourceSimTick-matched.sourceSimTick,simulationAlphaDelta:frame.sourceSimAlpha-matched.sourceSimAlpha,timeDeltaS:frame.actualTimeS-matched.actualTimeS,cameraPositionDeltaM:Math.hypot(...frame.camera.position.map((x,i)=>x-matched.camera.position[i])),cameraQuaternionDelta:Math.hypot(...frame.camera.quaternion.map((x,i)=>x-matched.camera.quaternion[i]))};}const name=`${tier}-${time}s`;frame.files={};for(const [kind,data]of Object.entries(frame.images)){const file=`${name}-${kind}.png`;fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'));frame.files[kind]=file;}delete frame.images;frame.shaderHashes={};for(const [kind,source]of Object.entries(frame.shaders)){frame.shaderHashes[kind]=crypto.createHash('sha256').update(source).digest('hex');if(!frames.length)fs.writeFileSync(path.join(out,`${kind}.glsl`),source);}delete frame.shaders;frames.push(frame);console.log(JSON.stringify({tier,time,actualTime:frame.actualTimeS,band:frame.handOverBandM,counts:frame.counts,cpu:frame.cpuActiveFade,unknownFullOnly:frame.fullOnly.length,glError:frame.glError}));await page.close();
  }};
  await run('high',targets);if(process.argv[6]!=='high-only')await run('low',[8.2]);
  const report={url,referencePath,clock:{installedUtc:'2026-10-06T23:59:59Z',pausedBeforeNavigationUtc:'2026-10-07T00:00:00Z',freshPagePerFrame:true},frames,logs,limits:['The detector uses the stated high and low code-luma thresholds. It is not a count of all traffic cars.','Separate GPU and CPU source-ID passes use the real vertex paths, depth tests, and capsule support. ID passes omit fog brightness and bloom. Candidate support is intersected with the real isolated image at LO.','The nearest source must have matching source-ID support. Unknown records stay unknown.','Two legitimate groups in one blob are ambiguous. Within one ID pass, complete overlap can hide an earlier ID. Such blends can remain unresolved.','CPU hull matching uses matrix centre, nonzero scale, object visibility, and a 1300 m limit. It proves drawn geometry, not visible hull color in every pixel.','The traffic layer masks hull lamp patches as depth occluders. Full-only unknown records can include these patches.','The GPU source class describes the sprite path. It does not prove a physical CPU/GPU counterpart for every impostor.','The same_car_impostor class requires actual near/far shares and a logical car ID from aCarLod. Its source resolves into the same hull closer in. It uses the existing CPU streak draw.',
'Low-tier CPU far lights are allowed distance representations and are reported separately.','The proof sets frozen render tick to target seconds ×30. It does not change the simulation. After capture uses the before camera when a reference JSON is given.','Full and isolated images keep the same camera, time, quality, bloom chain, and opaque occluders. Source-ID images are raw ID data.']};
  fs.writeFileSync(path.join(out,'classification.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'browser.log'),logs.join('\n')+'\n');
  const overlay=(frame,file,full=false)=>{const blobs=full?[...frame.blobs,...frame.fullOnly,...frame.excludedLargeFull]:[...frame.blobs,...frame.excludedLargeIsolated];return`<div class="image"><img src="${file}" alt="${full?'Full frame':'Traffic lights with opaque occluders'}"><svg viewBox="0 0 ${frame.width} ${frame.height}">${blobs.map(b=>`<g>${b.id.toString().includes('large')?`<rect x="${b.bbox[0]}" y="${b.bbox[1]}" width="${b.bbox[2]-b.bbox[0]}" height="${b.bbox[3]-b.bbox[1]}" stroke="#78899c" fill="none" stroke-dasharray="3 3"/>`:''}<circle cx="${b.peak[0]}" cy="${b.peak[1]}" r="8" stroke="${colors[b.class]||'#fff'}" fill="none"/><text x="${b.peak[0]+10}" y="${b.peak[1]-4}" fill="${colors[b.class]||'#fff'}">${b.id}</text><title>${esc(b.class+' '+b.reason)}</title></g>`).join('')}</svg></div>`;};
  const sections=frames.map(f=>{const rows=f.blobs.map(b=>`<tr><td>${b.id}</td><td style="color:${colors[b.class]}">${b.class}</td><td>${b.peak.join(', ')}</td><td>${b.peakLuma}</td><td>${b.lowCells}/${b.highCells}</td><td>${b.nearest?.distanceM.toFixed(1)||'—'}</td><td>${b.nearest?.nearestProjectedDistancePx.toFixed(2)||'—'}</td><td>${b.nearest?.hull?`${b.nearest.hull.mesh}:${b.nearest.hull.slot}, scale ${b.nearest.hull.scale.toExponential(2)}`:'—'}</td><td>${b.candidates.map(c=>`${c.group} (${c.class}, ${c.supportPixels}px)`).join('; ')||'unknown'}</td></tr>`).join('');return`<section><h2>${f.tier}, target ${f.targetTimeS} s</h2><p>Actual presentation time ${f.actualTimeS.toFixed(6)} s. Shared band ${f.handOverBandM.join('–')} m. Far brightness band ${f.farFalloffBandM?.join('–')||'none'} m. ${f.referenceMatch?'Reference deltas: '+esc(JSON.stringify(f.referenceMatch))+'.':''} Active CPU light fade: ${f.cpuActiveFade.count} cars; maximum distance ${f.cpuActiveFade.maxDistanceM?.toFixed(2)||'—'} m. Active CPU lights without drawn hull: ${f.cpuActiveFade.withoutDrawnHull}. GL error: ${f.glError}.</p><pre>${esc(JSON.stringify(f.counts,null,2))}</pre><h3>Full frame audit</h3>${overlay(f,f.files.full,true)}<h3>Isolated traffic audit</h3>${overlay(f,f.files.isolated)}<p>Full-only unknown blobs: ${f.fullOnly.length}. Large isolated clusters excluded: ${f.excludedLargeIsolated.length}. Numbers identify records in the data.</p><div class="scroll"><table><thead><tr><th>ID</th><th>Class</th><th>x,y px</th><th>Peak</th><th>LO/HI cells</th><th>Distance m</th><th>Nearest px</th><th>Matched hull</th><th>Legitimate candidates</th></tr></thead><tbody>${rows}</tbody></table></div><details><summary>Full-only unknown records</summary><pre>${esc(JSON.stringify(f.fullOnly,null,2))}</pre></details><details><summary>Large-cluster records</summary><pre>${esc(JSON.stringify({isolated:f.excludedLargeIsolated,full:f.excludedLargeFull},null,2))}</pre></details><p><a href="${f.files.gpuIds}">GPU source IDs</a> · <a href="${f.files.cpuIds}">CPU source IDs</a></p></section>`;}).join('');
  fs.writeFileSync(path.join(out,'proof.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frozen traffic light classification</title><style>body{margin:0;background:#08121e;color:#d9e7f7;font:14px/1.6 system-ui}main{max-width:1280px;margin:auto;padding:24px}p,li{color:#acc1d8}section{padding:18px;margin:18px 0;background:#112034;border-radius:12px}.image{position:relative}.image img{width:100%;display:block}.image svg{position:absolute;inset:0;width:100%;height:100%;font:12px monospace}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{text-align:left;padding:8px;border-bottom:1px solid #294058}.scroll,pre{overflow:auto}a{color:#7cdcea}@media(max-width:650px){main{padding:12px}section{padding:10px}}</style><main><h1>Frozen traffic light classification</h1><p>Adapter: ${esc(frames[0].adapter.renderer)}. Detector: HI 170, LO 60, 4×4 px cells. Maximum cluster: 8 HI cells and 64 LO cells. The audit keeps unknown and ambiguous records.</p><p>${Object.entries(colors).map(([key,color])=>`<span style="color:${color}">${key}</span>`).join(' · ')}</p>${sections}<h2>Limits</h2><ul>${report.limits.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p><a href="classification.json">Complete data</a></p></main></html>`);
  console.log(`Proof saved: ${path.join(out,'proof.html')}`);if(logs.some(l=>/error:|pageerror:/.test(l))||frames.some(f=>f.glError))process.exitCode=2;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack},null,2));process.exitCode=1;});
