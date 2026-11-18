/* 共用示意排版：固定空間ID決定區域，不依班級名稱，Excel換班後仍適用。 */
function classroomRowLayout(source,floor){
 floor=Number(floor);if(![2,3,4].includes(floor))return null;
 const ids=floor===2?['F2-R校長室','F2-R總務處','SP0026','SP0027','F2-R輔導處','@其他空間']:Array.from({length:9},(_,i)=>'SP'+String((floor===3?49:76)+i).padStart(4,'0'));
 const read=(tag,k)=>Number(tag.match(new RegExp(`\\s${k}="([^"]+)"`))?.[1]);
 const rooms=ids.map(id=>{const tag=id[0]==='@'?[...source.matchAll(/(<rect\b[^>]*>)\s*<text\b[^>]*>([^<]*)<\/text>/g)].find(m=>m[2]===id.slice(1)&&read(m[1],'y')===705)?.[1]:source.match(new RegExp(`<rect\\b[^>]*id="${id}"[^>]*>`))?.[0];if(!tag)throw Error(floor+'F排版缺少固定空間 '+id);return {id,x:read(tag,'x'),w:read(tag,'width')};});
 const left=rooms[0].x,right=rooms.at(-1).x+rooms.at(-1).w,gap=4,stairWidth=28,width=(right-left-stairWidth-gap*rooms.length)/rooms.length;
 const stairIndex=floor===2?2:3,oldStair=(rooms[stairIndex-1].x+rooms[stairIndex-1].w+rooms[stairIndex].x)/2;
 const knots=[[left,left]],boxes=[];let cursor=left;
 for(let i=0;i<rooms.length;i++){
  if(i===stairIndex){knots.push([oldStair-stairWidth/2,cursor],[oldStair,cursor+stairWidth/2],[oldStair+stairWidth/2,cursor+stairWidth]);cursor+=stairWidth+gap;}
  const r=rooms[i];knots.push([r.x,cursor],[r.x+r.w,cursor+width]);boxes.push({...r,newX:cursor,newWidth:width});cursor+=width+gap;
 }
 knots.sort((a,b)=>a[0]-b[0]);
 function projectX(x){if(x<=left||x>=right)return x;for(let i=1;i<knots.length;i++){const [a,c]=knots[i-1],[b,d]=knots[i];if(x<=b&&b>a)return c+(x-a)/(b-a)*(d-c);}return x;}
 return {boxes,width,gap,projectX};
}
function classroomColumnLayout(floor){
 if(![2,3,4].includes(Number(floor)))return null;
 // 利用已移除SVG標題後的最上方留白，後棟與中段一起上移60。
 // 保留連通走道教室的尺寸，前棟不動；懿芳樓由185延長至245。
 function projectY(y){if(y<=20||y>=672)return y;if(y<88)return 20+(y-20)*8/68;if(y<=487)return y-60;return 427+(y-487)*245/185;}
 return {projectY};
}
function layoutMapSvg(source,floor){
 const layout=classroomRowLayout(source,floor),column=classroomColumnLayout(floor);if(!layout)return source;
 const read=(tag,k)=>Number(tag.match(new RegExp(`\\s${k}="([^"]+)"`))?.[1]);
 const set=(tag,k,v)=>tag.replace(new RegExp(`(\\s${k}=")[^"]*(")`),(_,a,b)=>a+Number(v.toFixed(4))+b);
 return source.replace(/<(?:rect|text|g|path)\b[^>]*>/g,tag=>{
  // 後棟的兩條走廊底線是絕對座標路徑，須與色塊同步；設施圖示的局部路徑不動。
  const corridor=tag.match(/d="M([\d.]+) ([\d.]+) H([\d.]+) V([\d.]+)"/);
  if(corridor)return tag.replace(corridor[0],`d="M${corridor[1]} ${column.projectY(Number(corridor[2]))} H${corridor[3]} V${column.projectY(Number(corridor[4]))}"`);
  const translate=tag.match(/transform="translate\(([\d.]+) ([\d.]+)\)"/);
  if(translate){const y=Number(translate[2]),x=Number(translate[1]);return tag.replace(translate[0],`transform="translate(${y>=672?layout.projectX(x):x} ${column.projectY(y)})"`);}
  const x=read(tag,'x'),y=read(tag,'y');if(!Number.isFinite(x)||!Number.isFinite(y))return tag;
  let result=set(tag,'y',column.projectY(y));const h=read(tag,'height');if(Number.isFinite(h))result=set(result,'height',column.projectY(y+h)-column.projectY(y));
  if(y>=672){result=set(result,'x',layout.projectX(x));const w=read(tag,'width');if(Number.isFinite(w))result=set(result,'width',layout.projectX(x+w)-layout.projectX(x));}return result;
 });
}
function mapDisplayData(D,floor,source){
 const layout=classroomRowLayout(source,floor);if(!layout)return D;
 const column=classroomColumnLayout(floor);
 return {...D,nodes:D.nodes.map(n=>n.floor===Number(floor)?{...n,x:n.y>=672?layout.projectX(n.x):n.x,y:column.projectY(n.y)}:n)};
}
function mapDisplayEdges(a,b,edge,svg){
 if(edge.via?.length){const column=classroomColumnLayout(a.floor),via=edge.via.map(p=>({...a,x:p.x,y:column?column.projectY(p.y):p.y}));if(a.id!==edge.source)via.reverse();const points=[a,...via,b];return points.slice(1).map((p,i)=>[points[i],p]);}
 // 天橋本體保持原位；重新分配教室後，在既有水平走廊轉向，避免畫入中庭。
 if([2,3,4].includes(a.floor)&&a.floor===b.floor&&edge.type==='天橋'&&a.x!==b.x){const front=a.y>b.y?a:b,back=a.y>b.y?b:a,corner={...front,x:back.x};return [[a,corner],[corner,b]];}
 return [[a,b]];
}
/* 全樓層共用呈現樣式：只調示意排版，不改年度資料及路徑。 */
function styleMapSvg(source,floor) {
 floor=Number(floor);if(![1,2,3,4,5].includes(floor))return source;
 source=layoutMapSvg(source,floor);
 const palette={'#fafbf8':'#fffefb','#f0d9d5':'#fae7e4','#f1dfbd':'#fff2d6','#dae8cf':'#e1f3e9','#d8e8e6':'#dcf1ec','#d9e5f2':'#e5f0fa','#e6dcef':'#eee7fa','#eaf0e1':'#f4f8f2','#fffdf7':'#fffef9','#a9b4ad':'#c1d3d4','#acb8ab':'#cfdcd8','#cfd6ca':'#dce7df','#d3d8ce':'#ccdcda'};
 let svg=source.replace(/#[0-9a-f]{6}/gi,color=>palette[color.toLowerCase()]||color);
 svg=svg.replace(/font-family="[^"]*"/,`font-family="Noto Sans TC, Source Han Sans TC, PingFang TC, Microsoft JhengHei, Heiti TC, sans-serif"`);
 const attr=(tag,key,value)=>new RegExp(`\\s${key}="[^"]*"`).test(tag)?tag.replace(new RegExp(`${key}="[^"]*"`),`${key}="${value}"`):tag.replace(/>$/,` ${key}="${value}">`);
 const number=(tag,key)=>Number(tag.match(new RegExp(`\\s${key}="([^"]+)"`))?.[1]);
 const rooms=[...svg.matchAll(/<rect\b[^>]*>/g)].map(m=>m[0]).filter(t=>/fill="#(?:ffffff|e9e9e4)"/.test(t)).map(t=>({x:number(t,'x'),y:number(t,'y'),w:number(t,'width'),h:number(t,'height')}));
 svg=svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,tag=>{
  const text=tag.replace(/<[^>]+>/g,'');
  if(/校園基礎配置|V2\.0|內部資料建置用|非實際比例/.test(text))return '';
  let opening=tag.match(/^<text\b[^>]*>/)[0];
  let size=16,weight=400,color='#526674',kind='secondary';
  if(['福和樓','懿芳樓','蘭蕙樓','天橋','懿智樓','綜合大樓'].includes(text)){
   size=text==='懿芳樓'?18:22;weight=400;color='#304e5c';kind='building';
   if(text==='懿芳樓'&&[2,3,4].includes(floor)){size=18;opening=attr(opening,'y',classroomColumnLayout(floor).projectY(500));}
   if(text==='福和樓'){size=20;if(floor===1)opening=attr(opening,'y','771');}
   if(text==='天橋'){size=18;opening=attr(attr(opening,'x','706'),'y','620');}
  }else if(/^\d{3}$/.test(text)){size=20;weight=500;color='#2f4651';kind='classroom';}
  else if(floor===1&&['學務處及補校','辦公室'].includes(text)){size=16;weight=400;color='#2f4651';kind='place';opening=attr(opening,'y',text==='學務處及補校'?'420':'440');}
  else if(['美學基地','學務處會議室','健康中心','川堂','職探中心','學習中心','圖書館','教務處','資訊中心','科技中心','校長室','總務處','輔導處','演藝廳','辦公室','辦公區'].includes(text)){size=18;weight=400;color='#2f4651';kind='place';}
  else if(text==='中庭'){size=26;weight=400;color='#426354';kind='place';}
  else if(floor===1&&text==='平面通道'){opening=attr(attr(opening,'x','661'),'y','352');}
  // 依既有房間寬度調整字級，避免上層窄教室套用20px後相互擠壓。
  if(floor!==1){const x=number(opening,'x'),y=number(opening,'y'),room=rooms.filter(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h).sort((a,b)=>a.w*a.h-b.w*b.h)[0];if(room)size=Math.min(size,room.h<30?18:size,Math.floor((room.w-2)/(text.length*(kind==='classroom'?.56:1))*10)/10);}
  opening=attr(attr(attr(opening,'font-size',size),'font-weight',weight),'fill',color);
  opening=attr(opening,'data-map-kind',kind);
  return opening+tag.slice(tag.indexOf('>')+1);
 });
 svg=svg.replace(/<rect\b[^>]*>/g,tag=>{if(/stroke="#(?:c1d3d4|cfdcd8|dce7df)"/.test(tag)){let open=attr(tag.replace(/\/>$/,'>'),'stroke-width','.8');if(/fill="#(?:fae7e4|fff2d6|e1f3e9|dcf1ec|e5f0fa|eee7fa|f4f8f2)"/.test(open))open=attr(open,'rx','7');else if(/id="(?:SP|F[1-5]-)/.test(open))open=attr(open,'rx','6');return open.replace(/>$/,'/>');}return tag;});
 const fontCss=typeof FUHE_MAP_FONT_CSS!=='undefined'?FUHE_MAP_FONT_CSS:(typeof module!=='undefined'?require('./assets/fonts/map-font.js').FUHE_MAP_FONT_CSS:'');
 if(!fontCss)throw Error('地圖字體資料未載入，請保留assets/fonts/map-font.js');
 svg=svg.replace(/(<svg\b[^>]*>)/,`$1<style>${fontCss}</style>`);
 svg=svg.replace('<svg ',`<svg data-map-theme="huninn-${floor}f" `);
 return svg;
}
function startMarkerMarkup(n,svg){
 if(/data-map-theme="huninn-[1-5]f"/.test(svg)&&n.type==='場地'){
  const escaped=n.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),tag=svg.match(new RegExp(`<rect\\b[^>]*id="${escaped}"[^>]*>`))?.[0];
  if(tag){const get=k=>Number(tag.match(new RegExp(`\\s${k}="([^"]+)"`))[1]);const x=get('x')-3,y=get('y')-3,w=get('width')+6,h=get('height')+6;return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="none" stroke="white" stroke-width="7"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="none" stroke="#177444" stroke-width="3.5"/>`;}
 }
 return `<circle cx="${n.x}" cy="${n.y}" r="20" fill="none" stroke="white" stroke-width="9"/><circle cx="${n.x}" cy="${n.y}" r="20" fill="none" stroke="#177444" stroke-width="5"/><circle cx="${n.x}" cy="${n.y}" r="6" fill="#177444"/>`;
}
function mapLineCoordinates(a,b,edge,svg){
 const result={x1:a.x,y1:a.y,x2:b.x,y2:b.y};
 if(edge.type!=='門口'||!/data-map-theme="huninn-[1-5]f"/.test(svg))return result;
 for(const [room,other,prefix] of [[a,b,'1'],[b,a,'2']]){
  if(!['班級教室','場地'].includes(room.type))continue;
  const id=room.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),tag=svg.match(new RegExp(`<rect\\b[^>]*id="${id}"[^>]*>`))?.[0];if(!tag)continue;
  const val=k=>Number(tag.match(new RegExp(`\\s${k}="([^"]+)"`))[1]),x=val('x'),y=val('y'),w=val('width'),h=val('height'),dx=other.x-room.x,dy=other.y-room.y;
  const distances=[];if(dx>0)distances.push((x+w-room.x)/dx);if(dx<0)distances.push((x-room.x)/dx);if(dy>0)distances.push((y+h-room.y)/dy);if(dy<0)distances.push((y-room.y)/dy);
  const t=Math.min(1,...distances.filter(v=>v>=0));result['x'+prefix]=room.x+dx*t;result['y'+prefix]=room.y+dy*t;
 }
 return result;
}
if(typeof module!=='undefined')module.exports={styleMapSvg,startMarkerMarkup,mapLineCoordinates,classroomRowLayout,classroomColumnLayout,layoutMapSvg,mapDisplayData,mapDisplayEdges};
