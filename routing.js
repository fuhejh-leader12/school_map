/* V2.0: policy waypoints, not physical distances. */
function findRoute(D,a,b,options={}) {
 if(typeof options==='boolean') options={allowYard:options};
 const N=new Map(D.nodes.map(n=>[n.id,n])),G=new Map(D.nodes.map(n=>[n.id,[]]));if(!N.has(a)||!N.has(b))return null;
 for(const e of D.edges){G.get(e.source).push([e.target,e]);if(e.bidirectional)G.get(e.target).push([e.source,e]);}
 const dest=N.get(b),f=dest.floor,zone=D.routing_policy.destination_zone[b],origin=D.routing_policy.visitor_origins.includes(a),mode=options.mode||'visitor';
 const vertical=new Set(['樓梯','電梯','第一段階梯','第二段階梯','斜坡']);
 function solve(s,t,filter){let dist=new Map([[s,0]]),prev=new Map(),done=new Set();while(true){let x=null,best=Infinity;for(const [k,v] of dist)if(!done.has(k)&&v<best){x=k;best=v;}if(x===null)return null;if(x===t){let res=[];while(x!==s){let [u,e]=prev.get(x);res.push([x,e]);x=u;}res.push([s,null]);return res.reverse();}done.add(x);for(const [y,e] of G.get(x)){if(done.has(y)||!filter(x,y,e))continue;if(y!==t&&y!==s&&['班級教室','場地','洗手間'].includes(N.get(y).type))continue;let w=D.routing_policy.weights[e.type]??1;if(e.type==='樓梯'&&/-SH$/.test(x))w=8;if(best+w<(dist.get(y)??Infinity)){dist.set(y,best+w);prev.set(y,[x,e]);}}}}
 function join(points,filter){let res=[[points[0],null]];for(let i=1;i<points.length;i++){if(points[i]===points[i-1])continue;let path=solve(points[i-1],points[i],(x,y,e)=>filter(x,y,e,points[i-1],points[i]));if(!path)return null;res.push(...path.slice(1));}return res;}
 function local(x,y,e,s,t){if(e.type==='中庭捷徑')return s==='F1-P川堂'&&t==='F1-JA';if(vertical.has(e.type))return G.get(s).some(([v,ed])=>v===t&&ed.type===e.type)&&x===s&&y===t;return N.get(x).floor===N.get(y).floor&&N.get(x).floor===N.get(s).floor;}
 const stairs=(letter,from,to)=>Array.from({length:to-from+1},(_,i)=>`F${from+i}-S${letter}`);
 if(a===b)return [[a,null]];
 // 現行固定空間資料的局部推薦覆寫；不改權重及合法替代連線。
 const recommended=D.routing_policy.visitor_waypoints?.[b];
 if(origin&&mode==='visitor'&&recommended)return join([a,...recommended,b],local);
 // 一樓電梯維持平面通道，不受彈性搜尋權重影響；保留所有原始連線。
 if(origin && b==='F1-L' && mode!=='flexible')return join([a,'F1-P川堂','F1-JD','F1-JC','F1-JJ','F1-JL',b],local);
 // 演藝廳預設由一樓平面通道直達電梯；stairs模式保留經圖書館及F樓梯的替代線。
 if(origin && b==='F5-R演藝廳' && ['visitor','elevator','stepfree'].includes(mode))return join([a,'F1-P川堂','F1-JD','F1-JC','F1-JJ','F1-L','F2-L','F3-L','F4-L','F5-L',b],local);
 if(origin&&zone&&mode!=='flexible'){
  const w=[a,'F1-P川堂'];
  if(mode==='stepfree'){
   if(f>1){if(!['F','G'].includes(zone))return null;w.push('F1-JD','F1-JC','F1-JJ',...Array.from({length:f},(_,i)=>`F${i+1}-L`));}
   else if(zone==='F'||zone==='G')w.push('F1-JD','F1-JC','F1-JJ');else if(zone==='A'||zone==='C')w.push('F1-JD','F1-JC');
  } else if(zone==='A'){w.push('F1-JA');if(f>1)w.push(...stairs('A',1,f));}
  else if(zone==='C'){w.push('F1-JD','F1-JC');if(f>1){w.push('F1-SC');for(let i=1;i<f;i++)w.push(`C-platform-${i}-${i+1}`,`F${i+1}-SC`);}}
  else if(['B','D','E'].includes(zone)){if(f>1)w.push(...stairs(zone,1,f));else if(zone==='B')w.push('F1-JB');}
  else if(['F','G'].includes(zone)){w.push('F1-JD','F1-JC');if(f===1)w.push('F1-JJ');else{w.push('F1-SC','C-platform-1-2','F2-JJ');if(f>2){if(zone==='F'&&mode==='elevator')w.push(...Array.from({length:f-1},(_,i)=>`F${i+2}-L`));else w.push(...stairs(zone,2,f));}}}
  w.push(b);return join(w,local);
 }
 const filter=(x,y,e)=>(options.allowYard===true||e.type!=='中庭捷徑')&&(mode!=='stepfree'||!['樓梯','第一段階梯','第二段階梯','樓梯入口','斜坡'].includes(e.type));
 const isAH=n=>D.routing_policy.AH_front_first.includes(n.name),isFront=n=>/福和樓|懿芳樓|蘭蕙樓|天橋/.test(n.building),isRear=n=>/懿智樓|綜合大樓|後棟|跨棟分流/.test(n.building)||/-J[HGFJL]$/.test(n.id);
 if(mode!=='stepfree'&&((isAH(dest)&&isFront(N.get(a)))||(isAH(N.get(a))&&isFront(dest)))){const direct=solve(a,b,(x,y,e)=>filter(x,y,e)&&!isRear(N.get(y)));if(direct)return direct;}
 return solve(a,b,filter);
}
if(typeof module!=='undefined')module.exports={findRoute};
