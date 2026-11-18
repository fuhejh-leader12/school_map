/* 展示邏輯不以示意座標推測左右轉。 */
function navigationView(D, path) {
 const N=new Map(D.nodes.map(n=>[n.id,n]));
 if(!path?.length)return {floors:[],instructions:[]};
 const first=N.get(path[0][0]),dest=N.get(path.at(-1)[0]);
 const vertical=new Set(['樓梯','第一段階梯','第二段階梯','電梯']);
 const floors=new Set([first.floor,dest.floor]);
 for(let i=1;i<path.length;i++) {
  const a=N.get(path[i-1][0]),b=N.get(path[i][0]),e=path[i][1];
  if(!vertical.has(e.type) && !['樓梯入口','電梯入口','門口'].includes(e.type)) {
   if(a.type!=='分流節點')floors.add(a.floor);
   if(b.type!=='分流節點')floors.add(b.floor);
  }
  // 同層換樓梯即使沒有走廊邊也須保留。
  if(e.type==='樓梯入口' && i+1<path.length && path[i+1][1]?.type==='樓梯入口')floors.add(b.floor);
 }
 const destination=`${dest.floor}樓${dest.name}`;
 if(path.length===1)return {floors:[dest.floor],instructions:[`您已在${destination}。`]};
 const instructions=[];
 const zone=D.routing_policy.destination_zone[dest.id];
 const planner=typeof findRoute==='function'?findRoute:(typeof module!=='undefined'?require('../../Fuhe_Campus_V2_0/routing.js').findRoute:null);
 const visitor=D.routing_policy.visitor_origins.includes(first.id) && planner && JSON.stringify(path)===JSON.stringify(planner(D,first.id,dest.id,{mode:'visitor'}));
 const ids=path.map(p=>p[0]);
 const arrives=`抵達${destination}。`;
 const stairLandmark={A:'901與701教室轉角的樓梯',B:'704與705教室轉角的樓梯',C:'學務處與健康中心之間的旋轉樓梯',D:'天橋交界的樓梯',E:'801與802教室之間的樓梯',F:'圖書館右側的樓梯',G:'往懿智樓方向的樓梯',H:'懿智樓最左端的樓梯'};
 Object.assign(stairLandmark,D.landmarks||{});
 const has=(id)=>ids.includes(id);
 if(visitor && (zone || dest.id==='F1-L')) {
  instructions.push('從一樓大門穿堂出發。');
  if(zone==='A') {
   instructions.push('穿越一樓中庭，前往蘭蕙樓。');
   if(dest.floor>1)instructions.push(`走到${stairLandmark.A}，沿樓梯上至${dest.floor}樓。`);
  } else if(['C','F','G'].includes(zone)||dest.id==='F1-L') {
   instructions.push('沿福和樓右側走廊，經天橋前往學務處與健康中心之間。');
   if(dest.floor===1)instructions.push(...(zone==='F'||zone==='G'||dest.id==='F1-L'?['走旋轉樓梯左側的一樓平面通道，前往綜合大樓。']:[]));
   else if(zone==='C')instructions.push(`沿旋轉樓梯上至${dest.floor}樓；每層續走第二段階梯，不走往後棟的斜坡。`);
   else if(dest.id==='F3-R科技中心'&&has('C-platform-2-3')&&!has('F2-SF')){
    instructions.push('沿旋轉樓梯上至三樓後棟出口。');
    instructions.push('經小斜坡，沿後棟通道前往科技中心。');
   }
   else if(has('F1-L') && path.some(([,e])=>e?.type==='電梯')) {
    instructions.push('走旋轉樓梯左側的一樓平面通道，前往綜合大樓電梯。');
    instructions.push(`搭乘電梯至${['零','一','二','三','四','五'][dest.floor]||dest.floor}樓。`);
   } else {
    instructions.push('走旋轉樓梯第一段階梯，在出口直走小斜坡，沿二樓平面通道到圖書館前方。');
    if(zone==='G')instructions.push('左轉往懿智樓方向。');
    if(dest.floor>2) {
     if(path.some(([,e])=>e?.type==='電梯'))instructions.push(`前往電梯，搭乘至${dest.floor}樓。`);
     else instructions.push(`${zone==='F'?'右轉前往圖書館右側的樓梯':'走到往懿智樓方向的樓梯'}，上至${dest.floor}樓。`);
    }
   }
  } else if(['B','D','E'].includes(zone)) {
   instructions.push(`沿福和樓走廊前往${stairLandmark[zone]}。`);
   if(dest.floor>1)instructions.push(`沿樓梯上至${dest.floor}樓。`);
  }
  if(dest.id==='F1-L')instructions.push('抵達一樓電梯。');
  else {instructions.push('沿走廊前往目的地。');instructions.push(arrives);}
 } else {
  // 其他起點只使用路徑中確實存在的動作，不套入口方向模板。
  instructions.push(`從${first.floor}樓${['班級教室','場地'].includes(first.type)?first.name:'目前位置'}出發。`);
  for(let i=1;i<path.length;i++) {
   const a=N.get(path[i-1][0]),e=path[i][1];
   if(vertical.has(e.type)) {
    const familyOf=(n,edge)=>edge.type==='電梯'?'電梯':(/-S([A-H])$/.exec(n.id)?.[1] || 'C');
    const direction=(index)=>{const before=N.get(path[index-1][0]),after=N.get(path[index][0]),edge=path[index][1];return ['第一段階梯','第二段階梯'].includes(edge.type)?(edge.source===before.id?1:-1):Math.sign(after.floor-before.floor);};
    let j=i; const family=familyOf(a,e),dir=direction(i);
    while(j+1<path.length && vertical.has(path[j+1][1].type) && familyOf(N.get(path[j][0]),path[j+1][1])===family && direction(j+1)===dir)j++;
    const b=N.get(path[j][0]);
    instructions.push(b.type==='分流節點'?'沿旋轉樓梯第一段階梯前往分流處。':`${family==='電梯'?'搭乘電梯':`沿${stairLandmark[family]||'樓梯'}`}${b.floor>=a.floor?'上':'下'}至${b.floor}樓。`);i=j;
   } else if(e.type==='天橋')instructions.push('經天橋前往另一側。');
   else if(e.type==='平面通道')instructions.push('經一樓平面通道前往另一側。');
   else if(e.type==='斜坡')instructions.push('經小斜坡前往另一側。');
   else if(e.type==='中庭捷徑')instructions.push('穿越一樓中庭。');
  }
  instructions.push('沿走廊前往目的地。',arrives);
 }
 return {floors:[...floors].sort((a,b)=>a-b),instructions};
}
if(typeof module!=='undefined')module.exports={navigationView};

/* 依實際邊與節點建立樓層段落；不拆解或猜測完整說明文字。 */
function routeStages(D,path){
 if(!path?.length)return [];
 const N=new Map(D.nodes.map(n=>[n.id,n])),points=path.map(([id])=>N.get(id)),last=points.at(-1);
 const vertical=new Set(['樓梯','第一段階梯','第二段階梯','電梯']),level=n=>['零','一','二','三','四','五'][n]||String(n);
 const family=i=>path[i][1].type==='電梯'?'電梯':['第一段階梯','第二段階梯'].includes(path[i][1].type)?'C':(/-S([A-H])$/.exec(points[i-1].id)?.[1]||/-S([A-H])$/.exec(points[i].id)?.[1]);
 const direction=i=>['第一段階梯','第二段階梯'].includes(path[i][1].type)?(path[i][1].source===points[i-1].id?1:-1):Math.sign(points[i].floor-points[i-1].floor);
 const moves=[];
 for(let i=1;i<path.length;i++){
  if(!vertical.has(path[i][1]?.type))continue;
  let j=i;const kind=family(i),dir=direction(i);
  while(j+1<path.length&&vertical.has(path[j+1][1]?.type)&&family(j+1)===kind&&direction(j+1)===dir)j++;
  moves.push({fromIndex:i-1,toIndex:j,from:points[i-1],to:points[j],family:kind,direction:dir,types:path.slice(i,j+1).map(([,e])=>e.type)});i=j;
 }
 const visible=new Set(navigationView(D,path).floors),floors=[];
 const eligible=i=>points[i].type!=='分流節點'||path[i][1]?.type==='斜坡'||path[i+1]?.[1]?.type==='斜坡';
 for(let i=0;i<points.length;i++)if(visible.has(points[i].floor)&&eligible(i)&&!floors.includes(points[i].floor))floors.push(points[i].floor);
 const dest=last.type==='班級教室'?`${last.name} 教室`:last.name;
 const stairs={A:'蘭蕙樓與懿芳樓轉角的樓梯',B:'福和樓與懿芳樓轉角的樓梯',C:'旋轉樓梯',D:'天橋交界的樓梯',E:D.landmarks?.E||'福和樓中段的樓梯',F:'圖書館右側的樓梯',G:'往懿智樓方向的樓梯',H:'懿智樓最左端的樓梯'};
 return floors.map((floor,index)=>{
  const entryIndex=points.findIndex((n,i)=>n.floor===floor&&eligible(i)),entry=points[entryIndex];
  const incoming=moves.find(m=>m.toIndex===entryIndex),outgoing=moves.find(m=>m.from.floor===floor&&m.fromIndex>=entryIndex);
  const horizontal=[];for(let i=1;i<path.length;i++)if(points[i-1].floor===floor&&points[i].floor===floor&&!vertical.has(path[i][1].type))horizontal.push({from:points[i-1],to:points[i],edge:path[i][1]});
  const has=type=>horizontal.some(p=>p.edge.type===type),atLibrary=horizontal.some(p=>[p.from.id,p.to.id].includes(D.routing_policy.library_landmark));
  const target=outgoing?(outgoing.family==='電梯'?'綜合大樓電梯':stairs[outgoing.family]||'樓梯'):dest;
  let hint;
  if(path.length===1)hint=`您選擇的目的地就是${dest}。`;
  else if(entry.type==='分流節點'&&has('斜坡')){
   if(atLibrary){hint=`從旋轉樓梯第一段出口，經小斜坡與${level(floor)}樓平面通道到圖書館前方。`;hint+=outgoing?.family==='G'&&incoming?.direction>0?'再左轉，前往懿智樓方向的樓梯。':outgoing?`再前往${target}。`:`沿走廊前進，抵達${dest}。`;}
   else hint=`從旋轉樓梯第一段出口，經小斜坡與後棟通道前往${target}。`;
  }else if(has('平面通道'))hint=`沿福和樓右側走廊，經天橋，再走旋轉樓梯左側的一樓平面通道，前往${target}。`;
  else if(has('中庭捷徑'))hint=`穿越一樓中庭，前往${target}。`;
  else if(has('天橋'))hint=`沿福和樓右側走廊，經天橋前往${target}。`;
  else if(incoming)hint=`從${incoming.family==='電梯'?'電梯':incoming.family==='C'?'旋轉樓梯':'樓梯'}出口沿走廊前進，${outgoing?`前往${target}`:`抵達${dest}`}。`;
  else hint=`從川堂出發，沿福和樓走廊前往${target}。`;
  let nextText;
  if(outgoing){
   const to=`${level(outgoing.to.floor)}樓`,verb=outgoing.direction>0?'上':'下';
   if(outgoing.family==='電梯')nextText=`搭乘電梯${verb}至${to}。`;
   else if(outgoing.family==='C'&&outgoing.to.type==='分流節點')nextText=outgoing.types.length===1?`走旋轉樓梯第一段，前往${to}後棟出口。`:`沿旋轉樓梯${verb}至${to}後棟出口，中途續走旋轉階梯。`;
   else if(outgoing.family==='C')nextText=`沿旋轉樓梯${verb}至${to}${outgoing.direction>0&&outgoing.types.includes('第二段階梯')?'，每層續走第二段階梯':''}。`;
   else nextText=`沿樓梯${verb}至${to}。`;
  }else nextText=`請依現場${last.type==='班級教室'?'門牌':'標示'}確認${dest}${last.type==='班級教室'?'':'入口'}。`;
  const title=floors.length===1?'前往目的地':index===0?'川堂出發':index===floors.length-1?'抵達目的地':entry.type==='分流節點'&&has('斜坡')?'轉往後棟':outgoing?.family==='電梯'?'轉乘電梯':'轉換樓梯';
  return {floor,title,hint,nextText,entryIndex,entryId:entry.id,horizontal,movement:outgoing||null,nextFloor:floors[index+1]??null};
 });
}
if(typeof module!=='undefined')Object.assign(module.exports,{routeStages});
