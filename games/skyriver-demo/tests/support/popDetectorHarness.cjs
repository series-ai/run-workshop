'use strict';
// Execute the actual tool arithmetic. No browser or rendering runs.
const THREE = require('three');
function execute(source,dual,cssWidth,cssHeight,dpr){
 const start=source.indexOf('    const counts ='),end=source.indexOf('    const origUpdate =',start);if(start<0||end<0)throw Error('BOUNDS');
 const code=source.slice(start,end),width=Math.floor(cssWidth*dpr),height=Math.floor(cssHeight*dpr);
 const cam=new THREE.PerspectiveCamera(62,cssWidth/cssHeight,1,10000);cam.updateMatrixWorld(true);
 let current=new Uint8Array(width*height*4);const points=[];
 for(const x of [cssWidth*.35,cssWidth*.5,cssWidth*.65])points.push(new THREE.Vector3((x/cssWidth*2-1)*1000/cam.projectionMatrix.elements[0],0,-1000));
 const gl={drawingBufferWidth:width,drawingBufferHeight:height,RGBA:1,UNSIGNED_BYTE:1,readPixels:(x,y,w,h,f,t,target)=>target.set(current)};
 const imp={geometry:{instanceCount:2},material:{uniforms:{uTime:{value:0}}}};
 const geometry=new THREE.InstancedBufferGeometry();geometry.instanceCount=1;geometry.setAttribute('aCarPos',new THREE.InstancedBufferAttribute(new Float32Array([points[2].x,0,-1000]),3));geometry.setAttribute('aCarLod',new THREE.InstancedBufferAttribute(new Float32Array([1,1,1]),3));
 const streak={geometry};const s={renderer:{getContext:()=>gl,getSize:v=>v.set(cssWidth,cssHeight)},scene:{getObjectByName:()=>imp}};
 const attrs={count:2,pathArcPhaseSeed:new Float32Array([0,0,0,0,9,0,0,0,15,0,0,0])};
 const D={deriveImpostorAttributes:()=>attrs,impostorPosition:(a,i,t,out)=>Object.assign(out,points[i])};
 const fn=new Function('cam','s','a','window','streak','n','inv','only',code+'\nreturn {analyze,counts,lightEvents'+(dual?',cssCounts,cssLightEvents':'')+'};');
 const result=fn(cam,s,{scene:s},{__POP_LAYER:'traffic',__skyriverDiag:D},streak,0,[],null);
 const patterns=[[0,0,0],[220,100,0],[0,100,220],[220,0,220],[220,0,0],[0,0,0]];
 for(let frame=0;frame<patterns.length;frame++){
  current=new Uint8Array(width*height*4);
  for(let dot=0;dot<3;dot++){
   const value=patterns[frame][dot];if(!value)continue;
   const x=(dot===0?.35:dot===1?.5:.65)*cssWidth,y=cssHeight/2;
   const ix=Math.floor(x*width/cssWidth),iy=Math.floor((cssHeight-y)*height/cssHeight);
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const at=((iy+dy)*width+ix+dx)*4;current[at]=value;current[at+1]=value;current[at+2]=value;current[at+3]=255;
   }
  }
  cam.position.x=frame*.05;cam.updateMatrixWorld(true);imp.material.uniforms.uTime.value=frame/30;result.analyze(frame);
 }
 const events=dual?result.cssLightEvents:result.lightEvents;
 return {counts:dual?result.cssCounts:result.counts,events:events.map(e=>({tick:e.tick,type:e.type,pxCss:dual?[e.audit.cell[0]*4,e.audit.cell[1]*4]:e.px,v:e.v,cls:e.cls,idx:e.idx??null,occluded:e.occluded??null}))};
}
module.exports = { execute };
