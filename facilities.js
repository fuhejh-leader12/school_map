// 僅更換訪客圖形；位置及ID仍依V2.0資料。
function facilityMarkup(n, active=false) {
 const kind=n.type, color=active?'#b64816':'#62696e',bg=active?'#fff0cb':'#ffffff';
 const paths=kind==='樓梯'?'<path d="M-10 10h7V3h7v-7h7v-7"/>':kind==='電梯'?'<path d="M-10-9v18M10-9v18M-6-6l3-4 3 4M-3-10v9M0 6l3 4 3-4M3 10V1"/>':'<circle cx="-5" cy="-8" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="-8" r="2" fill="currentColor" stroke="none"/><path d="M-5-3v8m-4-7h8m-7 7v6m6-6v6M6-3l-4 9h8zM4 6v5m4-5v5"/>';
 return `<g transform="translate(${n.x} ${n.y})" role="img" aria-label="${active?'本次路線使用的':''}${kind}"><title>${active?'本次路線使用的':''}${kind}</title><rect x="-14" y="-14" width="28" height="28" rx="5" fill="${bg}" stroke="${color}" stroke-width="${active?4:1.5}"/><g fill="none" stroke="currentColor" color="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></g>`;
}
function activeFacilityIds(D,path) {
 const nodes=new Map(D.nodes.map(n=>[n.id,n])),used=new Set();
 for(let i=1;i<path.length;i++)if(['樓梯','第一段階梯','第二段階梯','電梯'].includes(path[i][1]?.type))for(const id of [path[i-1][0],path[i][0]])if(['樓梯','電梯'].includes(nodes.get(id).type))used.add(id);
 return used;
}
if(typeof module!=='undefined')module.exports={facilityMarkup,activeFacilityIds};

function facilityMovements(D,path) {
 const N=new Map(D.nodes.map(n=>[n.id,n])),result=new Map(),vertical=new Set(['樓梯','第一段階梯','第二段階梯','電梯']);
 const direction=i=>{const a=N.get(path[i-1][0]),b=N.get(path[i][0]),e=path[i][1];return ['第一段階梯','第二段階梯'].includes(e.type)?(e.source===a.id?1:-1):Math.sign(b.floor-a.floor);};
 const family=i=>path[i][1].type==='電梯'?'電梯':(/-S([A-H])$/.exec(path[i-1][0])?.[1]||'C');
 const chinese=['零','一','二','三','四','五'];
 for(let i=1;i<path.length;i++) {
  if(!vertical.has(path[i][1]?.type))continue;
  const dir=direction(i),kind=family(i);let j=i;
  while(j+1<path.length&&vertical.has(path[j+1][1]?.type)&&family(j+1)===kind&&direction(j+1)===dir)j++;
  let target=N.get(path[j][0]).floor;
  // 分流平台的樓層欄位不是高度；若下一段是斜坡，取實際抵達的樓層。
  if(N.get(path[j][0]).type==='分流節點'&&path[j+1]?.[1]?.type==='斜坡')target=N.get(path[j+1][0]).floor;
  const label=kind==='電梯'?`${dir>0?'↑':'↓'} 搭乘電梯至${chinese[target]||target}樓`:`${dir>0?'↑ 上':'↓ 下'}至${chinese[target]||target}樓`;
  for(let k=i-1;k<=j;k++){const n=N.get(path[k][0]);if(['樓梯','電梯'].includes(n.type)){
   // 抵達樓層只標示出口，避免在目標樓層仍顯示「上至○樓」造成誤會。
   const text=k===j&&k!==i-1?(kind==='電梯'?'電梯出口':'樓梯出口'):label;
   if(!result.has(n.id))result.set(n.id,[]);if(!result.get(n.id).includes(text))result.get(n.id).push(text);}}
  i=j;
 }
 return result;
}
function routeArrows(D,path,floor,displaySegments=(a,b)=>[[a,b]]) {
 const N=new Map(D.nodes.map(n=>[n.id,n])),segments=[];
 for(let i=1;i<path.length;i++) {
  const start=N.get(path[i-1][0]),end=N.get(path[i][0]),e=path[i][1];
  const a=start,b=end;
  if(a.floor!==floor||b.floor!==floor||((a.type==='分流節點'||b.type==='分流節點')&&e.type!=='斜坡')||['門口','樓梯入口','電梯入口','樓梯','電梯','第一段階梯','第二段階梯'].includes(e.type))continue;
  for(const [a,b] of displaySegments(start,end,e)){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1)continue;
  const last=segments.at(-1);
  if(last&&Math.hypot(last.b.x-a.x,last.b.y-a.y)<1 && (last.dx*dx+last.dy*dy)/(Math.hypot(last.dx,last.dy)*len)>.999){last.b=b;last.dx=b.x-last.a.x;last.dy=b.y-last.a.y;}
  else segments.push({a,b,dx,dy});
  }
 }
 const arrows=[];
 for(const s of segments){const len=Math.hypot(s.dx,s.dy);if(len<55)continue;const count=Math.max(1,Math.floor(len/150));for(let k=1;k<=count;k++){const t=k/(count+1);arrows.push({x:s.a.x+s.dx*t,y:s.a.y+s.dy*t,angle:Math.atan2(s.dy,s.dx)*180/Math.PI});}}
 return arrows;
}
function transferTarget(stage,id){
 const move=stage?.movement;
 return move&&stage.nextFloor!==null&&stage.nextFloor!==stage.floor&&move.from.id===id&&move.to.floor===stage.nextFloor?stage.nextFloor:null;
}
function movementLabelMarkup(n,texts,D,occupied=[],options={}) {
 // 在設施附近找空位，避開教室文字中心及已放置的標籤；不改變設施位置。
 const obstacles=[...D.nodes.filter(x=>x.floor===n.floor&&['班級教室','場地'].includes(x.type)).map(x=>({x:x.x-40,y:x.y-15,w:80,h:30})),
  // 樓梯、洗手間、電梯圖示也要避開，標籤不要蓋住它們。
  ...D.nodes.filter(x=>x.floor===n.floor&&x.id!==n.id&&['樓梯','洗手間','電梯'].includes(x.type)).map(x=>({x:x.x-16,y:x.y-16,w:32,h:32}))];
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 let markup='';
 const interactive=Number.isInteger(options.targetFloor);
 const segs=options.avoid||[],points=options.avoidPoints||[];
 const segHits=r=>segs.filter(([x1,y1,x2,y2])=>{const k=Math.max(2,Math.ceil(Math.hypot(x2-x1,y2-y1)/4));for(let i=0;i<=k;i++){const x=x1+(x2-x1)*i/k,y=y1+(y2-y1)*i/k;if(x>r.x-6&&x<r.x+r.w+6&&y>r.y-6&&y<r.y+r.h+6)return true;}return false;}).length;
 const pointHits=r=>points.filter(([x,y])=>x>r.x-24&&x<r.x+r.w+24&&y>r.y-24&&y<r.y+r.h+24).length;
 // 分數越低越好：壓到路線或目的地／起點最嚴重，其次是其他標籤，再其次是教室文字；同分時離設施越近越好。
 const score=r=>segHits(r)*100+pointHits(r)*100+occupied.filter(o=>overlap(r,o)).length*20+obstacles.filter(o=>overlap(r,o)).reduce((t,o)=>t+(o.w===32?15:3),0);
 for(const text of texts){const textWidth=text.includes('出口')?92:text.includes('電梯')?202:112,w=textWidth+(interactive?30:0),h=28,candidates=[[20,-42],[-w-20,-42],[20,18],[-w-20,18],[-w/2,-65],[-w/2,35],[24,-14],[-w-24,-14],[20,-78],[-w-20,-78],[20,52],[-w-20,52],[-w/2,-100],[-w/2,70]].map(([dx,dy],order)=>({x:Math.max(4,Math.min(996-w,n.x+dx)),y:Math.max(4,Math.min(768,n.y+dy)),w,h,order}));
  candidates.sort((a,b)=>score(a)-score(b)||a.order-b.order);
  const p=candidates[0];occupied.push(p);
  const attributes=interactive?`class="map-transfer" role="button" tabindex="0" data-transfer-floor="${options.targetFloor}" data-label-x="${p.x}" data-label-y="${p.y}" data-label-width="${w}" data-label-height="${h}" aria-label="${text}，查看 ${options.targetFloor}F 路線"`:`role="img" aria-label="${text}"`;
  const hit=interactive?`<rect class="map-transfer-hit" x="${p.x}" y="${p.y}" width="${w}" height="${h}" fill="transparent" pointer-events="all"/><rect class="map-transfer-focus" x="${p.x-3}" y="${p.y-3}" width="${w+6}" height="${h+6}" rx="7" fill="none"/>`:'';
  const tapIcon=interactive?`<g class="map-tap-icon" aria-hidden="true" focusable="false" pointer-events="none" transform="translate(${p.x+textWidth+3} ${p.y+2}) scale(.95)" fill="none" stroke="#b64816" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12V5a2 2 0 0 1 4 0v6m0-2a2 2 0 0 1 4 0v3m0-2a2 2 0 0 1 4 0v5c0 4-2.5 7-6 7h-2c-2 0-3.5-1-4.5-2.5L4 14a2 2 0 0 1 3-2l2 2v-2"/><path d="M5 4 3 2M10 0v-1M16 3l2-2"/></g>`:'';
  markup+=`<path d="M${n.x} ${n.y}L${p.x+p.w/2} ${p.y+p.h/2}" stroke="#b64816" stroke-width="1.5"/><g ${attributes}>${hit}<rect class="map-transfer-bg" x="${p.x}" y="${p.y}" width="${w}" height="${h}" rx="5" fill="#fff7df" stroke="#b64816" stroke-width="2"/><text x="${p.x+textWidth/2}" y="${p.y+20}" text-anchor="middle" font-size="18" font-weight="bold" fill="#87360f">${text}</text>${tapIcon}</g>`;
 }
 return markup;
}
if(typeof module!=='undefined')Object.assign(module.exports,{facilityMovements,routeArrows,movementLabelMarkup,transferTarget});
