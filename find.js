/* 找班地圖：老師一次選好幾班，每層地圖圈出位置，可打勾。與訪客導覽共用 runtime/current.js 的地圖與教室資料。 */
(function(){
 const VALID=/^[789](0[1-9]|[12]\d|30)$/;
 const classes=DATA.nodes.filter(n=>n.type==='班級教室'&&VALID.test(n.name)).sort((a,b)=>Number(a.name)-Number(b.name));
 const byName=new Map(classes.map(n=>[n.name,n]));
 const KEY='fuhe-find-v1';
 const today=(()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;})();
 let state={date:today,selected:[],visited:[],grade:'7'};
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&saved.date===today)state={...state,...saved};else if(saved?.grade)state.grade=saved.grade;}catch(e){}
 state.selected=state.selected.filter(n=>byName.has(n));state.visited=state.visited.filter(n=>state.selected.includes(n));
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}};

 const $=s=>document.querySelector(s);
 const grid=$('#class-grid'),chips=$('#chips'),maps=$('#maps'),message=$('#input-message');
 const ns='http://www.w3.org/2000/svg';
 const mapCache=new Map();let disposers=[];

 function sortSelected(){state.selected.sort((a,b)=>Number(a)-Number(b));}
 function toggleSelect(name){if(state.selected.includes(name)){state.selected=state.selected.filter(n=>n!==name);state.visited=state.visited.filter(n=>n!==name);}else{state.selected.push(name);sortSelected();}save();if(mode==='map'&&!state.selected.length)mode='pick';render();}
 function toggleVisited(name){state.visited=state.visited.includes(name)?state.visited.filter(n=>n!==name):[...state.visited,name];save();renderChips();updateBadges();}

 // ── 選班 ──
 function renderGrid(){
  const gradeNames={7:'七年級',8:'八年級',9:'九年級'};document.querySelectorAll('.grade-switch button').forEach(b=>{const on=b.dataset.grade===state.grade,n=state.selected.filter(x=>x[0]===b.dataset.grade).length;b.setAttribute('aria-selected',String(on));b.classList.toggle('is-active',on);b.innerHTML=`${gradeNames[b.dataset.grade]}${n?`<span class="grade-count">${n}</span>`:''}`;});
  grid.replaceChildren(...classes.filter(n=>n.name[0]===state.grade).map(n=>{const b=document.createElement('button');b.type='button';b.textContent=n.name;b.setAttribute('aria-pressed',String(state.selected.includes(n.name)));b.onclick=()=>toggleSelect(n.name);return b;}));
 }
 document.querySelectorAll('.grade-switch button').forEach(b=>b.onclick=()=>{state.grade=b.dataset.grade;save();renderGrid();});
 $('#class-form').addEventListener('submit',e=>{
  e.preventDefault();const input=$('#class-input'),nums=(input.value.match(/\d{3}/g)||[]);const added=[],missing=[];
  for(const n of nums){if(!byName.has(n))missing.push(n);else if(!state.selected.includes(n)){state.selected.push(n);added.push(n);}}
  sortSelected();save();input.value='';input.blur();
  message.textContent=missing.length?`找不到：${missing.join('、')}（只有701–730、801–830、901–930）`:(nums.length?'':'請輸入三位數班號，例如 728');
  if(added.length)state.grade=added.at(-1)[0];render();
 });
 const clearAll=()=>{state.selected=[];state.visited=[];save();setMode('pick');};
 $('#clear-all').onclick=clearAll;$('#pick-clear').onclick=clearAll;

 // ── 已選清單 ──
 function renderChips(){
  const total=state.selected.length,done=state.visited.length;
  
  $('#progress').textContent=total?`已完成 ${done}／${total}`:'';
  chips.replaceChildren(...state.selected.map(name=>{
   const n=byName.get(name),wrap=document.createElement('span'),main=document.createElement('button'),remove=document.createElement('button'),visited=state.visited.includes(name);
   wrap.className='chip'+(visited?' is-visited':'');
   main.type='button';main.className='chip-main';main.innerHTML=`<span class="chip-check" aria-hidden="true">${visited?'✓':''}</span><span class="chip-name">${name}</span><span class="chip-floor">${n.floor}F</span>`;main.setAttribute('aria-pressed',String(visited));main.setAttribute('aria-label',`${name}，${n.floor}樓，${visited?'已完成':'未完成'}`);main.onclick=()=>toggleVisited(name);
   remove.type='button';remove.className='chip-remove';remove.textContent='×';remove.setAttribute('aria-label',`移除${name}`);remove.onclick=()=>toggleSelect(name);
   wrap.append(main,remove);return wrap;}));
 }

 // ── 地圖 ──
 function floorAssets(floor){
  if(!mapCache.has(floor)){const svg=styleMapSvg(MAPS[floor],floor);mapCache.set(floor,{src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,display:new Map(mapDisplayData(DATA,floor,MAPS[floor]).nodes.map(n=>[n.id,n]))});}
  return mapCache.get(floor);
 }
 function placeBadges(items){
  // 班號標籤：先放教室正上方，撞到其他標籤就改放下方或左右錯開。
  const placed=[],W=78,H=42,overlap=(a,b)=>a.x<b.x+b.w+4&&b.x<a.x+a.w+4&&a.y<b.y+b.h+4&&b.y<a.y+a.h+4;
  return items.map(({name,x,y})=>{
   // 懿芳樓那一欄教室很窄、上下緊鄰其他班，標籤改放右側的中庭空地。
   const side=x<160?[[86,0],[176,0],[266,0]]:[];
   const options=[...side,[0,-58],[0,58],[-62,-58],[62,-58],[-62,58],[62,58],[0,-104],[0,104]];
   let best=null;for(const [dx,dy] of options){const r={x:Math.max(2,Math.min(998-W,x+dx-W/2)),y:Math.max(2,Math.min(798-H,y+dy-H/2)),w:W,h:H};if(!placed.some(p=>overlap(p,r))){best=r;break;}}
   best??={x:Math.max(2,Math.min(998-W,x-W/2)),y:Math.max(2,Math.min(798-H,y-58-H/2)),w:W,h:H};placed.push(best);return {name,x,y,r:best};
  });
 }
 function renderMaps(){
  disposers.forEach(d=>d());disposers=[];maps.replaceChildren();
  const floors=[...new Set(state.selected.map(n=>byName.get(n).floor))].sort((a,b)=>a-b);
  for(const floor of floors){
   const names=state.selected.filter(n=>byName.get(n).floor===floor),{src,display}=floorAssets(floor);
   const section=document.createElement('section'),head=document.createElement('div'),title=document.createElement('h2'),list=document.createElement('p');
   section.className='floor-card';head.className='floor-head';title.textContent=`${floor}F`;list.className='floor-list';list.textContent=names.join('、');head.append(title,list);
   const wrapper=document.createElement('div'),stage=document.createElement('div'),img=document.createElement('img'),svg=document.createElementNS(ns,'svg'),reset=document.createElement('button');
   wrapper.className='map';stage.className='map-stage';img.src=src;img.alt=`${floor}樓地圖，已標出${names.join('、')}`;img.draggable=false;svg.setAttribute('viewBox','0 0 1000 800');svg.setAttribute('aria-hidden','true');
   const items=names.map(name=>{const n=display.get(byName.get(name).id);return {name,x:n.x,y:n.y};});
   // 相鄰班級很近時把圈縮小，避免圈圈互相重疊。
   const ringR=it=>Math.max(14,Math.min(27,...items.filter(o=>o!==it).map(o=>Math.hypot(o.x-it.x,o.y-it.y)/2-2)));
   for(const {name,x,y,r} of placeBadges(items)){const rr=ringR(items.find(i=>i.name===name));
    const g=document.createElementNS(ns,'g');g.setAttribute('class','find-mark');g.dataset.name=name;
    g.innerHTML=`<circle class="find-ring" cx="${x}" cy="${y}" r="${rr}"/><line class="find-leader" x1="${x}" y1="${y}" x2="${r.x+r.w/2}" y2="${r.y+r.h/2}"/><rect class="find-badge" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="21"/><text class="find-badge-text" x="${r.x+r.w/2}" y="${r.y+r.h/2+10}" text-anchor="middle">${name}</text><rect class="find-hit" x="${Math.min(r.x,x-30)-6}" y="${Math.min(r.y,y-30)-6}" width="${Math.max(r.x+r.w,x+30)-Math.min(r.x,x-30)+12}" height="${Math.max(r.y+r.h,y+30)-Math.min(r.y,y-30)+12}" fill="transparent"/>`;
    g.addEventListener('click',e=>{e.stopPropagation();toggleVisited(name);});
    svg.append(g);
   }
   stage.append(img,svg);reset.type='button';reset.className='map-reset';reset.textContent='看整層';reset.hidden=true;wrapper.append(stage,reset);
   const camera=mapCamera(),update=()=>{const b=wrapper.getBoundingClientRect();if(b.width)camera.setBounds(b.width,b.height);stage.style.transform=`translate(${camera.x}%,${camera.y}%) scale(${camera.scale})`;reset.hidden=camera.scale<=1.02;};
   reset.onclick=e=>{e.stopPropagation();camera.reset();update();};
   const gesture=bindMapGestures(wrapper,camera,update);disposers.push(()=>gesture.dispose());
   section.append(head,wrapper);maps.append(section);update();
  }
  updateBadges();
 }
 function updateBadges(){maps.querySelectorAll('.find-mark').forEach(g=>{const done=state.visited.includes(g.dataset.name);g.classList.toggle('is-visited',done);const t=g.querySelector('.find-badge-text');t.innerHTML=done?`<tspan font-size="19">✓</tspan>${g.dataset.name}`:g.dataset.name;t.style.fontSize=done?'25px':'';});}

 // ── 兩個畫面：選班（可連續多選）→ 看地圖 ──
 let mode=state.selected.length?'map':'pick';
 function setMode(m){mode=m;render();window.scrollTo(0,0);}
 function renderPickBar(){
  const n=state.selected.length;$('#pick-bar').hidden=!n;document.body.classList.toggle('has-pick-bar',n>0&&mode==='pick');
  $('#pick-count').textContent=`已選 ${n} 班`;$('#pick-list').textContent=state.selected.join('、');
 }
 function render(){
  $('#pick-view').hidden=mode!=='pick';$('#map-view').hidden=mode!=='map';
  renderGrid();renderPickBar();
  if(mode==='map'){renderChips();renderMaps();}else{disposers.forEach(d=>d());disposers=[];maps.replaceChildren();}
 }
 $('#show-maps').onclick=()=>{if(state.selected.length)setMode('map');};
 $('#edit-classes').onclick=()=>setMode('pick');
 render();
})();
