const nodes = new Map(DATA.nodes.map(n => [n.id, n]));
const choices = DATA.nodes.filter(n => ['班級教室', '場地'].includes(n.type) && !(n.type==='班級教室'&&!/^[789](0[1-9]|[12]\d|30)$/.test(n.name))).sort((a,b) => a.floor-b.floor || a.name.localeCompare(b.name,'zh-Hant',{numeric:true}));
const startId = 'F1-R川堂';
const originLabel=document.querySelector('#origin-label');
if(originLabel){const origin=nodes.get(startId);originLabel.textContent=origin?`起點：${origin.floor}樓${origin.name}`:'起點資訊尚未提供';}
const end = document.querySelector('#end'), yard = document.querySelector('#yard'), steps = document.querySelector('#steps'), maps = document.querySelector('#maps');
let route = [];
let touchHintShown=false;
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
  const camera=mapCamera(),stages=[],viewports=[],panels=[],buttons=[],interactionSvgs=[],gestures=[];
  let largeMode=false,dialog=null,largeSlot=null,savedBody=null,savedScroll=null;
  const focusBoxes=[],focusPointSets=[],minimaps=[],focusCtas=[];let current=0,viewMode='whole',introTimers=[],pendingEnter=false;
  const focusMaxScale=i=>i===0?2:2.6;const reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wantsFocus=()=>camera.width<700;
  function syncBounds(){const b=viewports[current]?.getBoundingClientRect?.();if(b&&b.width>0&&b.height>0){camera.setBounds(b.width,b.height);return true;}return false;}
  function cancelIntro(){introTimers.forEach(clearTimeout);introTimers=[];stages.forEach(st=>st.classList?.remove('map-animating'));}
  function applyView(){syncBounds();if(viewMode==='fill'){fillPage();updateCamera();return;}if(viewMode==='focus'&&focusBoxes[current])focusMapCamera(camera,focusBoxes[current],{maxScale:focusMaxScale(current)});else if(viewMode==='whole')camera.reset();updateCamera();}
  function fillPage(){
    // 整頁大地圖（手機直向）：放大到地圖填滿畫面高度，並以本段路線為中心。
    const W=camera.width,H=camera.height,fit=Math.min(W/1000,H/800),ox=(W-1000*fit)/2,b=focusBoxes[current]||{x0:0,x1:1000};
    const scale=Math.max(1,Math.min(3,H/(800*fit))),cx=(b.x0+b.x1)/2,px=ox+cx*fit;
    camera.scale=scale;camera.x=-(px-W/2)*scale/W*100;camera.y=0;camera.clamp();
  }
  function setMode(mode){cancelIntro();viewMode=mode;applyView();}
  function enterStage(){
    // 手機：1F停在整層，由家長按「放大看路線」決定是否拉近；2F以後直接對準路線。電腦：一律整層。
    if(!syncBounds()){pendingEnter=true;updateCamera();return;}pendingEnter=false;viewMode=wantsFocus()&&current!==0?'focus':'whole';applyView();
  }
  function animateTo(mode){cancelIntro();if(!reduceMotion)stages.forEach(st=>st.classList?.add('map-animating'));viewMode=mode;applyView();introTimers.push(setTimeout(()=>{stages.forEach(st=>st.classList?.remove('map-animating'));introTimers=[];},900));}
  const toolbar=document.createElement('div'),tabs=document.createElement('div'),status=document.createElement('span');toolbar.className='map-toolbar';tabs.className='floor-tabs';
  function updateTransferHitAreas(){for(const layer of interactionSvgs){if(!layer.getBoundingClientRect)continue;const bounds=layer.getBoundingClientRect(),scale=Math.min(bounds.width/1000,bounds.height/800);if(scale<=0)continue;for(const control of layer.querySelectorAll('.map-transfer')){const x=Number(control.getAttribute('data-label-x')),y=Number(control.getAttribute('data-label-y')),w=Math.min(1000,Math.max(Number(control.getAttribute('data-label-width')),46/scale)),h=Math.min(800,Math.max(Number(control.getAttribute('data-label-height')),46/scale)),hit=control.querySelector('.map-transfer-hit');for(const [key,value] of Object.entries({x:Math.max(0,Math.min(1000-w,x+(Number(control.getAttribute('data-label-width'))-w)/2)),y:Math.max(0,Math.min(800-h,y+(Number(control.getAttribute('data-label-height'))-h)/2)),width:w,height:h}))hit.setAttribute(key,value);}}}
  function placeMinimap(el,pts,size){
    // 小縮圖放在不會擋住路線、起點與目的地的角落。
    const W=camera.width,H=camera.height,fit=Math.min(W/1000,H/800),ox=(W-1000*fit)/2,oy=(H-800*fit)/2,s=camera.scale,tx=camera.x/100*W,ty=camera.y/100*H;
    const w=size?.[0]??Math.max(96,Math.min(190,W*.3)),h=size?.[1]??w*.8,m=8,screen=pts.map(([x,y])=>[W/2+(ox+x*fit-W/2)*s+tx,H/2+(oy+y*fit-H/2)*s+ty]);
    const all={rb:['right','bottom',W-m-w,H-m-h],lb:['left','bottom',m,H-m-h],rt:['right','top',W-m-w,m],lt:['left','top',m,m]},corners=(size?['lt','rt','lb','rb']:['rb','lb','rt','lt']).map(k=>all[k]);
    let best=corners[0],score=Infinity;for(const c of corners){const n=screen.filter(([x,y])=>x>c[2]-24&&x<c[2]+w+24&&y>c[3]-24&&y<c[3]+h+24).length;if(n<score){score=n;best=c;}}
    el.style.left=el.style.right=el.style.top=el.style.bottom='';el.style[best[0]]=m+'px';el.style[best[1]]=m+'px';
  }
  function updateCamera(){const active=viewports[panels.findIndex(p=>!p.hidden)],bounds=active?.getBoundingClientRect?.();if(bounds&&bounds.width>0)camera.setBounds(bounds.width,bounds.height);for(const stage of stages)stage.style.transform=`translate(${camera.x}%,${camera.y}%) scale(${camera.scale})`;for(const vp of viewports){vp.style.touchAction=largeMode?'none':'pan-y';vp.style.cursor=camera.scale>1?'grab':'default';}status.textContent=`${Math.round(camera.scale*100)}%`;const zoomed=camera.scale>1.02,frame=visibleMapRect(camera);minimaps.forEach((mm,i)=>{mm.root.hidden=!zoomed;if(!zoomed)return;for(const [k,v] of Object.entries(frame))mm.frame.setAttribute(k,v);if(i===current)placeMinimap(mm.root,focusPointSets[i]);});const showCta=!zoomed&&wantsFocus();focusCtas.forEach((b,i)=>{b.hidden=!showCta;if(showCta&&i===current)placeMinimap(b,focusPointSets[i],[b.offsetWidth||150,b.offsetHeight||44]);});for(const b of modeButtons){b.setAttribute('aria-pressed',String(b.dataset.mode===viewMode));}updateTransferHitAreas();}
  const modeButtons=[];
  for(const [text,action,mode] of [['放大',()=>{cancelIntro();viewMode='free';syncBounds();camera.zoom(.5);}],['縮小',()=>{cancelIntro();viewMode='free';syncBounds();camera.zoom(-.5);}],['看整層',()=>setMode('whole'),'whole'],['對準路線',()=>animateTo('focus'),'focus']]){const b=document.createElement('button');b.textContent=text;if(mode){b.dataset.mode=mode;b.className='map-mode-button';modeButtons.push(b);}b.onclick=()=>{action();updateCamera();};toolbar.append(b);}toolbar.append(status);
  const expand=document.createElement('button'),gestureNote=document.createElement('p');expand.className='open-large-map';expand.textContent='放大查看地圖';expand.setAttribute('aria-haspopup','dialog');expand.onclick=openLargeMap;toolbar.append(expand);gestureNote.className='map-gesture-note';gestureNote.textContent='單指捲頁，雙指縮放或移動地圖。';
  const viewing=document.createElement('p'),progress=document.createElement('p'),context=document.createElement('div');viewing.className='viewing-floor';viewing.tabIndex=-1;viewing.setAttribute('aria-live','polite');progress.className='stage-progress';progress.hidden=segments.length===1;context.className='map-context';context.append(viewing,progress);
  tabs.hidden=segments.length===1;tabs.setAttribute('aria-label','查看路線階段');
  function showStage(index,scroll=false){gestures.forEach(g=>g.cancel());cancelIntro();current=index;panels.forEach((p,i)=>p.hidden=i!==index);buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===index));b.setAttribute('aria-current',i===index?'step':'false');});viewing.textContent=`目前查看：${segments[index].floor}F 地圖`;progress.textContent=`第 ${index+1} 段／共 ${segments.length} 段`;enterStage();if(scroll){viewing.focus?.({preventScroll:true});if(!largeMode)(tabs.hidden?viewing:tabs).scrollIntoView?.({block:'start',behavior:'auto'});}}
  maps.append(toolbar,gestureNote,tabs,context);
  for (const floor of floorNumbers) {
    const segment=segments.find(s=>s.floor===floor),segmentIndex=segments.indexOf(segment);
    const section=document.createElement('section'), heading=document.createElement('h3'), wrapper=document.createElement('div'), img=document.createElement('img'), svg=document.createElementNS(ns,'svg');
    const themedMap=styleMapSvg(MAPS[floor],floor);
    const displayData=mapDisplayData(DATA,floor,MAPS[floor]),displayNodes=new Map(displayData.nodes.map(n=>[n.id,n])),displayOn=on.map(n=>displayNodes.get(n.id));
    heading.textContent=`${floor}樓`; wrapper.className='map'; img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(themedMap)}`; img.alt=`${floor}樓校園示意圖，樓梯、電梯與洗手間以通用圖示標示`;
    section.className='floor-panel';panels.push(section);
    const tab=document.createElement('button'),floorText=document.createElement('span'),stageText=document.createElement('span');floorText.className='stage-floor';floorText.textContent=`${floor}F`;stageText.className='stage-label';stageText.textContent=segment.title;tab.append(floorText,stageText);tab.setAttribute('data-floor',floor);tab.setAttribute('aria-label',`${floor}F｜${segment.title}`);tab.onclick=()=>showStage(segmentIndex,true);buttons.push(tab);tabs.append(tab);section.hidden=panels.length!==1;
    const hint=document.createElement('p');hint.className='floor-hint';hint.textContent=segment.hint;section.append(heading,hint);
    svg.setAttribute('viewBox','0 0 1000 800'); svg.setAttribute('aria-label',`${floor}樓候選路線示意`);const focusPoints=displayOn.filter(n=>n.floor===floor).map(n=>[n.x,n.y]);
    for (let i=1;i<on.length;i++) {
      const a=displayOn[i-1],b=displayOn[i],edge=route[i][1]; if (a.floor!==floor || b.floor!==floor || ((a.type==='分流節點' || b.type==='分流節點') && edge.type!=='斜坡')) continue;
      for(const [from,to] of mapDisplayEdges(a,b,edge,themedMap)){focusPoints.push([from.x,from.y],[to.x,to.y]);
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
      focusPoints.push([n.x,n.y]);const g=document.createElementNS(ns,'g');g.innerHTML=facilityMarkup(n,true);svg.append(g);
    }
    const occupied=[];
    for(const [id,texts] of movements){const n=displayNodes.get(id);if(n.floor!==floor)continue;const targetFloor=usedFacilities.has(id)?transferTarget(segment,id):null,g=document.createElementNS(ns,'g');g.innerHTML=movementLabelMarkup(n,texts,displayData,occupied,{targetFloor});
      for(const control of g.querySelectorAll?.('[data-transfer-floor]')||[]){const index=segments.findIndex(s=>s.floor===Number(control.getAttribute('data-transfer-floor')));const activate=e=>{e.preventDefault();e.stopPropagation();if(index>=0)showStage(index,true);};control.addEventListener('click',activate);control.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')activate(e);});control.addEventListener('pointerdown',e=>e.stopPropagation());}
      svg.append(g);}
    const start=floorStart(DATA,route,floor);
    if(start){const n=displayNodes.get(start.node.id),g=document.createElementNS(ns,'g');g.innerHTML=startMarkerMarkup(n,themedMap);svg.append(g);focusPoints.push([n.x,n.y]);}
    for(const o of occupied)focusPoints.push([o.x,o.y],[o.x+o.w,o.y+o.h]);
    focusPointSets.push(focusPoints);focusBoxes.push(segmentIndex===0?routeFocusBox(focusPoints,{includeBottom:true,minWidth:520,minHeight:400}):routeFocusBox(focusPoints));
    const stage=document.createElement('div');stage.className='map-stage';if(!stage.style)stage.style={};if(!wrapper.style)wrapper.style={};img.draggable=false;stage.append(img,svg);stages.push(stage);viewports.push(wrapper);interactionSvgs.push(svg);wrapper.append(stage);
    const mini=document.createElement('button'),miniImg=document.createElement('img'),miniSvg=svg.cloneNode(true),miniFrame=document.createElementNS(ns,'rect'),miniCaption=document.createElement('span');mini.type='button';mini.className='map-minimap';mini.hidden=true;mini.setAttribute('aria-label',`${floor}樓整層小地圖，點一下看整層`);miniImg.src=img.src;miniImg.alt='';miniImg.draggable=false;miniSvg.removeAttribute('aria-label');miniSvg.setAttribute('aria-hidden','true');miniFrame.setAttribute('class','map-minimap-frame');miniSvg.append(miniFrame);miniCaption.textContent='看整層';mini.append(miniImg,miniSvg,miniCaption);mini.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMode('whole');});mini.addEventListener('pointerdown',e=>e.stopPropagation());mini.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});wrapper.append(mini);minimaps.push({root:mini,frame:miniFrame});
    const cta=document.createElement('button');cta.type='button';cta.className='map-focus-cta';cta.hidden=true;cta.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>放大看路線';cta.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();animateTo('focus');});cta.addEventListener('pointerdown',e=>e.stopPropagation());cta.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});wrapper.append(cta);focusCtas.push(cta);
    gestures.push(bindMapGestures(wrapper,camera,()=>{cancelIntro();viewMode='free';updateCamera();},{isLarge:()=>largeMode}));section.append(wrapper);
    const bigMap=document.createElement('button');bigMap.type='button';bigMap.className='open-large-map-inline';bigMap.setAttribute('aria-haspopup','dialog');bigMap.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>放大查看地圖（整頁）';bigMap.onclick=()=>openLargeMap();section.append(bigMap);
    const stagePara=document.createElement('p');stagePara.className='stage-text';stagePara.textContent=[segment.hint,segment.nextText].filter(Boolean).join('');section.append(stagePara);
    const nextStep=document.createElement('p');nextStep.className='next-step';nextStep.textContent=segment.nextText;section.append(nextStep);
    const nextIndex=floorNumbers.indexOf(floor)+1;
    if(nextIndex<floorNumbers.length){const next=document.createElement('button');next.className='next-floor';next.textContent=`下一段：查看 ${floorNumbers[nextIndex]}F 路線 →`;next.onclick=()=>showStage(nextIndex,true);section.append(next);}
    maps.append(section);
  }
  showStage(0);
  if(!touchHintShown&&typeof matchMedia==='function'&&matchMedia('(max-width:700px)').matches&&viewports[0]?.append){touchHintShown=true;const hint=document.createElement('div');hint.className='map-touch-hint';hint.setAttribute('aria-hidden','true');hint.textContent='雙指可放大、縮小地圖';viewports[0].append(hint);setTimeout(()=>hint.classList.add('is-fading'),3200);setTimeout(()=>hint.remove(),3800);}
  function openLargeMap(){
    if(largeMode)return;largeMode=true;gestures.forEach(g=>g.cancel());cancelIntro();savedScroll={x:window.scrollX,y:window.scrollY};savedBody={position:document.body.style.position,top:document.body.style.top,width:document.body.style.width,overflow:document.body.style.overflow};Object.assign(document.body.style,{position:'fixed',top:`-${savedScroll.y}px`,width:'100%',overflow:'hidden'});
    largeSlot=document.createComment('地圖原位置');maps.parentNode.insertBefore(largeSlot,maps);dialog=document.createElement('dialog');dialog.className='large-map-dialog';dialog.setAttribute('aria-label','校園導覽大地圖');dialog.setAttribute('aria-modal','true');
    const shell=document.createElement('div'),header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');shell.className='large-map-shell';header.className='large-map-header';title.textContent='大地圖檢視';close.className='close-large-map';close.textContent='關閉大地圖';close.setAttribute('autofocus','');close.onclick=()=>closeLargeMap();header.append(title,close);shell.append(header,maps);dialog.append(shell);document.body.append(dialog);gestureNote.textContent='單指拖曳，雙指縮放或移動地圖。';
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeLargeMap();});dialog.addEventListener('close',()=>closeLargeMap());dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeLargeMap();}else if(e.key==='Tab'){const focusable=[...dialog.querySelectorAll('button,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('role','dialog');dialog.setAttribute('open','');}viewMode=wantsFocus()?(current===0?'whole':'focus'):(viewMode==='whole'?'whole':'focus');applyView();close.focus({preventScroll:true});
  }
  function closeLargeMap(restoreFocus=true){
    if(!largeMode)return;largeMode=false;gestures.forEach(g=>g.cancel());largeSlot.replaceWith(maps);largeSlot=null;const previous=dialog;dialog=null;if(typeof previous.close==='function'&&previous.open)previous.close();previous.remove();Object.assign(document.body.style,savedBody);gestureNote.textContent='單指捲頁，雙指縮放或移動地圖。';viewMode=wantsFocus()&&current!==0?'focus':'whole';window.scrollTo(savedScroll.x,savedScroll.y);applyView();window.scrollTo(savedScroll.x,savedScroll.y);if(restoreFocus)expand.focus({preventScroll:true});
  }
  const onResize=()=>{if(pendingEnter)enterStage();else if((viewMode==='focus'||viewMode==='fill')&&!introTimers.length)applyView();else updateCamera();};
  let observer=null,frame=null;if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(onResize);viewports.forEach(v=>observer.observe(v));}if(typeof requestAnimationFrame!=='undefined')frame=requestAnimationFrame(onResize);disposeMapInteractions=()=>{cancelIntro();closeLargeMap(false);observer?.disconnect();gestures.forEach(g=>g.dispose());if(frame!==null&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(frame);};
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
