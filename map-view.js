function floorStart(D,path,floor) {
 const N=new Map(D.nodes.map(n=>[n.id,n]));
 for(let i=0;i<path.length;i++) {
  const n=N.get(path[i][0]);if(n.floor!==floor)continue;
  if(n.type==='分流節點' && path[i][1]?.type!=='斜坡' && path[i+1]?.[1]?.type!=='斜坡')continue;
  const description=n.type==='分流節點'?'旋轉樓梯第一段出口':n.type==='樓梯'?'樓梯出口':n.type==='電梯'?'電梯出口':'川堂';
  return {node:n,description};
 }
 return null;
}
function mapCamera() {
 return {scale:1,x:0,y:0,width:1000,height:800,
  setBounds(width,height){if(width>0&&height>0){this.width=width;this.height=height;this.clamp();}},
  clamp(){this.scale=Math.max(1,Math.min(3,this.scale));const fit=Math.min(this.width/1000,this.height/800),maxX=Math.max(0,(1000*fit*this.scale-this.width)/2)/this.width*100,maxY=Math.max(0,(800*fit*this.scale-this.height)/2)/this.height*100;this.x=Math.max(-maxX,Math.min(maxX,this.x));this.y=Math.max(-maxY,Math.min(maxY,this.y));if(this.scale===1){this.x=0;this.y=0;}},
  zoom(delta){this.scale+=delta;this.clamp();},reset(){this.scale=1;this.x=0;this.y=0;}};
}
function mapGestureStart(camera,points,bounds){const [a,b]=points,mid=b?{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}:a;return {scale:camera.scale,x:camera.x,y:camera.y,midX:(mid.clientX??mid.x)-bounds.left,midY:(mid.clientY??mid.y)-bounds.top,distance:b?Math.max(1,Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY)):null};}
function applyMapGesture(camera,start,points,bounds){
 camera.setBounds(bounds.width,bounds.height);const current=mapGestureStart(camera,points,bounds),scale=start.distance&&current.distance?Math.max(1,Math.min(3,start.scale*current.distance/start.distance)):start.scale;
 const anchorX=(start.midX-bounds.width/2-start.x*bounds.width/100)/start.scale,anchorY=(start.midY-bounds.height/2-start.y*bounds.height/100)/start.scale;
 camera.scale=scale;camera.x=(current.midX-bounds.width/2-anchorX*scale)/bounds.width*100;camera.y=(current.midY-bounds.height/2-anchorY*scale)/bounds.height*100;camera.clamp();
}
function bindMapGestures(viewport,camera,update,{isLarge=()=>false}={}){
 if(!viewport.addEventListener)return {cancel(){},dispose(){}};
 const listeners=[],ids=new Set();let touch=null,mode='idle',mouse=null,suppressUntil=0;
 const listen=(name,fn,options)=>{viewport.addEventListener(name,fn,options);listeners.push([name,fn,options]);};
 const points=e=>Array.from(e.touches||[]).filter(t=>ids.has(t.identifier));
 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 const cancel=()=>{touch=null;mode='idle';mouse=null;ids.clear();};
 listen('touchstart',e=>{
  for(const t of Array.from(e.changedTouches||[]))ids.add(t.identifier);const p=points(e);
  if(p.length>=2){prevent(e);touch=mapGestureStart(camera,p.slice(0,2),viewport.getBoundingClientRect());mode='pinch';suppressUntil=Date.now()+450;}
  else if(p.length===1){suppressUntil=0;if(isLarge()){touch=mapGestureStart(camera,p,viewport.getBoundingClientRect());mode='pending-drag';}}
 },{passive:false,capture:true});
 listen('touchmove',e=>{
  const p=points(e);if(p.length>=2){prevent(e);if(mode!=='pinch'||!touch){touch=mapGestureStart(camera,p.slice(0,2),viewport.getBoundingClientRect());mode='pinch';}applyMapGesture(camera,touch,p.slice(0,2),viewport.getBoundingClientRect());suppressUntil=Date.now()+450;update();}
  else if(p.length===1&&isLarge()&&touch&&['pending-drag','drag'].includes(mode)){
   const now=mapGestureStart(camera,p,viewport.getBoundingClientRect());if(mode==='drag'||Math.hypot(now.midX-touch.midX,now.midY-touch.midY)>7){mode='drag';prevent(e);applyMapGesture(camera,touch,p,viewport.getBoundingClientRect());suppressUntil=Date.now()+450;update();}
  }
  // 一般模式的單指不preventDefault，交由瀏覽器正常捲頁。
 },{passive:false,capture:true});
 const end=e=>{for(const t of Array.from(e.changedTouches||[]))ids.delete(t.identifier);if(['pinch','drag'].includes(mode))suppressUntil=Date.now()+450;const rest=points(e);if(e.type==='touchcancel'||rest.length===0)cancel();else if(isLarge()&&rest.length===1){touch=mapGestureStart(camera,rest,viewport.getBoundingClientRect());mode='pending-drag';}else {touch=null;mode='blocked';}};
 listen('touchend',end,{passive:true,capture:true});listen('touchcancel',end,{passive:true,capture:true});
 // Safari的原生縮放事件只在地圖範圍取消；地圖外保持瀏覽器正常行為。
 listen('gesturestart',prevent,{passive:false});listen('gesturechange',prevent,{passive:false});
 listen('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}},true);
 listen('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||camera.scale===1)return;mouse={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};viewport.setPointerCapture?.(e.pointerId);});
 listen('pointermove',e=>{if(!mouse||e.pointerId!==mouse.id)return;const b=viewport.getBoundingClientRect(),dx=e.clientX-mouse.x,dy=e.clientY-mouse.y;camera.setBounds(b.width,b.height);camera.x+=dx/b.width*100;camera.y+=dy/b.height*100;camera.clamp();if(Math.hypot(dx,dy)>2)mouse.moved=true;mouse.x=e.clientX;mouse.y=e.clientY;update();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(name,e=>{if(mouse?.id===e.pointerId)mouse=null;});
 return {cancel,dispose(){cancel();for(const [name,fn,options] of listeners)viewport.removeEventListener(name,fn,options);}};
}
function bindMapDrag(...args){return bindMapGestures(...args);}
if(typeof module!=='undefined')module.exports={floorStart,mapCamera,mapGestureStart,applyMapGesture,bindMapGestures,bindMapDrag};
