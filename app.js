const nodes = new Map(DATA.nodes.map(n => [n.id, n]));
const choices = DATA.nodes.filter(n => ['班級教室', '場地'].includes(n.type) && !['932', '732'].includes(n.name)).sort((a,b) => a.floor-b.floor || a.name.localeCompare(b.name,'zh-Hant',{numeric:true}));
const startId = 'F1-R川堂';
const originLabel=document.querySelector('#origin-label');
if(originLabel){const origin=nodes.get(startId);originLabel.textContent=origin?`起點：${origin.floor}樓${origin.name}`:'起點資訊尚未提供';}
const end = document.querySelector('#end'), yard = document.querySelector('#yard'), steps = document.querySelector('#steps'), maps = document.querySelector('#maps');
let route = [];
let disposeMapInteractions=()=>{};
function label(n) { return `${n.floor}樓｜${n.building.replace('A–H 連通走道','蘭蕙樓與懿智樓間走道')}｜${n.name}`; }
function fill(query, preferred) {
  const old = preferred || end.value;
  end.replaceChildren();
  choices.filter(n => label(n).includes(query.trim())).forEach(n => { const o = document.createElement('option'); o.value=n.id; o.textContent=label(n); end.append(o); });
  if ([...end.options].some(o => o.value === old)) end.value=old;
}
fill('', 'F2-R圖書館');
document.querySelector('#endSearch').oninput = e => fill(e.target.value);
function place(n) {
  if (n.type === '樓梯') return `${n.building}附近的樓梯（${n.note || '位置請參照地圖'}）`;
  if (n.type === '分流節點') return '樓梯分流平台';
  if (n.type === '路徑節點' && /^F\d-J/.test(n.id)) return `${n.building}走道轉角`;
  return n.name.replace(/[A-H]樓梯/g, '附近樓梯').replace(/門外$/, '附近');
}
function renderMaps() {
  disposeMapInteractions();disposeMapInteractions=()=>{};
  maps.replaceChildren();
  const on = route.map(([id]) => nodes.get(id));
  const segments=routeStages(DATA,route),floorNumbers=segments.map(s=>s.floor);
  const usedFacilities=activeFacilityIds(DATA,route);
  const movements=facilityMovements(DATA,route);
  const ns='http://www.w3.org/2000/svg';
  const camera=mapCamera(),stages=[],viewports=[],panels=[],buttons=[],interactionSvgs=[];
  const toolbar=document.createElement('div'),tabs=document.createElement('div'),status=document.createElement('span');toolbar.className='map-toolbar';tabs.className='floor-tabs';
  function updateTransferHitAreas(){for(const layer of interactionSvgs){if(!layer.getBoundingClientRect)continue;const bounds=layer.getBoundingClientRect(),scale=bounds.width/1000;if(scale<=0)continue;for(const control of layer.querySelectorAll('.map-transfer')){const x=Number(control.getAttribute('data-label-x')),y=Number(control.getAttribute('data-label-y')),w=Math.min(1000,Math.max(Number(control.getAttribute('data-label-width')),46/scale)),h=Math.min(800,Math.max(Number(control.getAttribute('data-label-height')),46/scale)),hit=control.querySelector('.map-transfer-hit');for(const [key,value] of Object.entries({x:Math.max(0,Math.min(1000-w,x+(Number(control.getAttribute('data-label-width'))-w)/2)),y:Math.max(0,Math.min(800-h,y+(Number(control.getAttribute('data-label-height'))-h)/2)),width:w,height:h}))hit.setAttribute(key,value);}}}
  function updateCamera(){for(const stage of stages)stage.style.transform=`translate(${camera.x}%,${camera.y}%) scale(${camera.scale})`;for(const vp of viewports){vp.style.touchAction=camera.scale>1?'none':'pan-y';vp.style.cursor=camera.scale>1?'grab':'default';}status.textContent=`${Math.round(camera.scale*100)}%`;updateTransferHitAreas();}
  for(const [text,action] of [['放大',()=>camera.zoom(.5)],['縮小',()=>camera.zoom(-.5)],['重設地圖',()=>camera.reset()]]){const b=document.createElement('button');b.textContent=text;b.onclick=()=>{action();updateCamera();};toolbar.append(b);}toolbar.append(status);
  const viewing=document.createElement('p'),progress=document.createElement('p'),context=document.createElement('div');viewing.className='viewing-floor';viewing.tabIndex=-1;viewing.setAttribute('aria-live','polite');progress.className='stage-progress';progress.hidden=segments.length===1;context.className='map-context';context.append(viewing,progress);
  tabs.hidden=segments.length===1;tabs.setAttribute('aria-label','查看路線階段');
  function showStage(index,scroll=false){panels.forEach((p,i)=>p.hidden=i!==index);buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===index));b.setAttribute('aria-current',i===index?'step':'false');});viewing.textContent=`目前查看：${segments[index].floor}F 地圖`;progress.textContent=`第 ${index+1} 段／共 ${segments.length} 段`;if(scroll){viewing.focus?.({preventScroll:true});(tabs.hidden?viewing:tabs).scrollIntoView?.({block:'start',behavior:'auto'});}}
  maps.append(toolbar,tabs,context);
  for (const floor of floorNumbers) {
    const segment=segments.find(s=>s.floor===floor),segmentIndex=segments.indexOf(segment);
    const section=document.createElement('section'), heading=document.createElement('h3'), wrapper=document.createElement('div'), img=document.createElement('img'), svg=document.createElementNS(ns,'svg');
    const themedMap=styleMapSvg(MAPS[floor],floor);
    const displayData=mapDisplayData(DATA,floor,MAPS[floor]),displayNodes=new Map(displayData.nodes.map(n=>[n.id,n])),displayOn=on.map(n=>displayNodes.get(n.id));
    heading.textContent=`${floor}樓`; wrapper.className='map'; img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(themedMap)}`; img.alt=`${floor}樓校園示意圖，樓梯、電梯與洗手間以通用圖示標示`;
    section.className='floor-panel';panels.push(section);
    const tab=document.createElement('button'),floorText=document.createElement('span'),stageText=document.createElement('span');floorText.className='stage-floor';floorText.textContent=`${floor}F`;stageText.className='stage-label';stageText.textContent=segment.title;tab.append(floorText,stageText);tab.setAttribute('data-floor',floor);tab.setAttribute('aria-label',`${floor}F｜${segment.title}`);tab.onclick=()=>showStage(segmentIndex,true);buttons.push(tab);tabs.append(tab);section.hidden=panels.length!==1;
    const hint=document.createElement('p');hint.className='floor-hint';hint.textContent=segment.hint;section.append(heading,hint);
    svg.setAttribute('viewBox','0 0 1000 800'); svg.setAttribute('aria-label',`${floor}樓候選路線示意`);
    for (let i=1;i<on.length;i++) {
      const a=displayOn[i-1],b=displayOn[i],edge=route[i][1]; if (a.floor!==floor || b.floor!==floor || ((a.type==='分流節點' || b.type==='分流節點') && edge.type!=='斜坡')) continue;
      for(const [from,to] of mapDisplayEdges(a,b,edge,themedMap)){
      const line=document.createElementNS(ns,'line');
      for (const [k,v] of Object.entries({...mapLineCoordinates(from,to,edge,themedMap),stroke:'#0879ba','stroke-width':7,'stroke-linecap':'round',opacity:.9})) line.setAttribute(k,v);
      svg.append(line);
      if(edge.type==='斜坡') {
        line.setAttribute('stroke-dasharray','10 6');
        const platform=a.type==='分流節點'?a:b;
        const g=document.createElementNS(ns,'g');g.innerHTML=`<circle cx="${platform.x}" cy="${platform.y}" r="12" fill="#fff0cb" stroke="#b64816" stroke-width="3"/><text x="${platform.x-10}" y="${platform.y-25}" text-anchor="end" font-size="18" fill="#87360f" stroke="white" stroke-width="4" paint-order="stroke">樓梯第一段出口</text>`;svg.append(g);
      }
      }
    }
    for(const arrow of routeArrows(displayData,route,floor,mapDisplayEdges)) {
      const g=document.createElementNS(ns,'g');g.innerHTML=`<path transform="translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})" d="M-9-8L3 0L-9 8" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})" d="M-9-8L3 0L-9 8" fill="none" stroke="#075a8d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;svg.append(g);
    }
    const points=displayOn.filter(n => n.floor===floor && n.type!=='分流節點');
    points.forEach(n => { if(n.id!==route.at(-1)[0])return;const c=document.createElementNS(ns,'circle');for(const [k,v] of Object.entries({cx:n.x,cy:n.y,r:20,fill:'none',stroke:'#c9473b','stroke-width':3}))c.setAttribute(k,v);svg.append(c); });
    for(const id of usedFacilities) {
      const n=displayNodes.get(id); if(n.floor!==floor)continue;
      const g=document.createElementNS(ns,'g');g.innerHTML=facilityMarkup(n,true);svg.append(g);
    }
    const occupied=[];
    for(const [id,texts] of movements){const n=displayNodes.get(id);if(n.floor!==floor)continue;const targetFloor=usedFacilities.has(id)?transferTarget(segment,id):null,g=document.createElementNS(ns,'g');g.innerHTML=movementLabelMarkup(n,texts,displayData,occupied,{targetFloor});
      for(const control of g.querySelectorAll?.('[data-transfer-floor]')||[]){const index=segments.findIndex(s=>s.floor===Number(control.getAttribute('data-transfer-floor')));const activate=e=>{e.preventDefault();e.stopPropagation();if(index>=0)showStage(index,true);};control.addEventListener('click',activate);control.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')activate(e);});control.addEventListener('pointerdown',e=>e.stopPropagation());}
      svg.append(g);}
    const start=floorStart(DATA,route,floor);
    if(start){const n=displayNodes.get(start.node.id),g=document.createElementNS(ns,'g');g.innerHTML=startMarkerMarkup(n,themedMap);svg.append(g);}
    const stage=document.createElement('div');stage.className='map-stage';if(!stage.style)stage.style={};if(!wrapper.style)wrapper.style={};img.draggable=false;stage.append(img,svg);stages.push(stage);viewports.push(wrapper);interactionSvgs.push(svg);wrapper.append(stage);bindMapDrag(wrapper,camera,updateCamera);section.append(wrapper);
    const nextStep=document.createElement('p');nextStep.className='next-step';nextStep.textContent=segment.nextText;section.append(nextStep);
    const nextIndex=floorNumbers.indexOf(floor)+1;
    if(nextIndex<floorNumbers.length){const next=document.createElement('button');next.className='next-floor';next.textContent=`下一段：查看 ${floorNumbers[nextIndex]}F 路線 →`;next.onclick=()=>showStage(nextIndex,true);section.append(next);}
    maps.append(section);
  }
  showStage(0);updateCamera();
  let observer=null,frame=null;if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(updateTransferHitAreas);viewports.forEach(v=>observer.observe(v));}if(typeof requestAnimationFrame!=='undefined')frame=requestAnimationFrame(updateTransferHitAreas);disposeMapInteractions=()=>{observer?.disconnect();if(frame!==null&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(frame);};
}
function run() {
  steps.replaceChildren(); maps.replaceChildren();
  if (!end.value) { steps.textContent='請選擇有效的目的地。'; return; }
  const dest=nodes.get(end.value);
  route=findRoute(DATA,startId,end.value,{mode:'visitor',allowYard:yard.checked}) || [];
  if (!route.length) { steps.textContent='目前資料找不到候選路線，請更換地點。'; return; }
  const details=document.querySelector('#full-route');if(details)details.open=false;
  const ol=document.createElement('ol');
  for(const text of navigationView(DATA,route).instructions) { const li=document.createElement('li'); li.textContent=text; ol.append(li); }
  steps.append(ol); renderMaps();
}
document.querySelector('#go').onclick=run;
