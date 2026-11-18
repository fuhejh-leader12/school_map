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
 return {scale:1,x:0,y:0,zoom(delta){this.scale=Math.max(1,Math.min(3,this.scale+delta));if(this.scale===1){this.x=0;this.y=0;}},reset(){this.scale=1;this.x=0;this.y=0;}};
}
function bindMapDrag(viewport,camera,update) {
 if(!viewport.addEventListener)return;
 let previous=null;
 viewport.addEventListener('pointerdown',e=>{if(camera.scale===1)return;previous={x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId);});
 viewport.addEventListener('pointermove',e=>{if(!previous)return;const bounds=viewport.getBoundingClientRect();camera.x=Math.max(-100,Math.min(100,camera.x+(e.clientX-previous.x)/bounds.width*100));camera.y=Math.max(-100,Math.min(100,camera.y+(e.clientY-previous.y)/bounds.height*100));previous={x:e.clientX,y:e.clientY};update();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(name,()=>{previous=null;});
}
if(typeof module!=='undefined')module.exports={floorStart,mapCamera};
