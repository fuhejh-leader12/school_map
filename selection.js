const CAMPUS_PLACES=[
 {id:'F2-R教務處',label:'教務處',icon:'01_academic_office.png'},
 {id:'F1-R學務處及補校辦公室',label:'學務處',icon:'02_student_affairs.png'},
 {id:'F2-R總務處',label:'總務處',icon:'03_general_affairs.png'},
 {id:'F2-R輔導處',label:'輔導處',icon:'04_counseling.png'},
 {id:'F2-R校長室',label:'校長室',icon:'05_principal_office.png'},
 {id:'F2-R圖書館',label:'圖書館',icon:'06_library.png'},
 {id:'F5-R演藝廳',label:'演藝廳',icon:'07_auditorium.png'},
 {id:'F3-R科技中心',label:'科技中心',icon:'08_technology_center.png'},
 {id:'F1-R職探中心',label:'職探中心',icon:'09_career_exploration.png'}
];
function destinationList(D,type,grade,query='') {
 if(type==='place')return CAMPUS_PLACES.map(p=>({config:p,node:D.nodes.find(n=>n.id===p.id&&n.type==='場地')})).filter(({config,node})=>node&&!D.excluded_labels.includes(node.name)&&(config.label.includes(query.trim())||node.name.includes(query.trim()))).map(({node})=>node);
 return D.nodes.filter(n=>!D.excluded_labels.includes(n.name)&&n.type==='班級教室'&&/^[789]\d{2}$/.test(n.name)&&n.name[0]===String(grade)&&n.name.includes(query.trim())).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant',{numeric:true}));
}
function startSelectionFlow() {
 const $=id=>document.querySelector('#'+id),screens=[$('type-screen'),$('pick-screen'),$('result-screen')];
 let type='class',grade=7,selected=null;
 const show=i=>screens.forEach((screen,index)=>screen.hidden=index!==i);
 const title=n=>n.type==='班級教室'?`${n.name} 教室`:(CAMPUS_PLACES.find(p=>p.id===n.id)?.label||n.name);
 function clearSelection(){selected=null;end.value='';$('selected-destination').textContent='請選擇目的地';$('go').disabled=true;}
 function render() {
  const container=$('destination-grid');container.replaceChildren();
  $('pick-screen').dataset.type=type;$('pick-screen').dataset.grade=String(grade);
  $('pick-title').textContent=type==='class'?'選擇班級教室':'選擇校園場地';$('grades').hidden=type!=='class';
  for(const button of $('grades').children)button.setAttribute('aria-pressed',String(button.dataset.grade===String(grade)));
  const list=destinationList(DATA,type,grade,$('endSearch').value);
  const groups=type==='class'?[['',list]]:[['行政處室',list.filter(n=>CAMPUS_PLACES.findIndex(p=>p.id===n.id)<5)],['公共場地',list.filter(n=>CAMPUS_PLACES.findIndex(p=>p.id===n.id)>=5)]];
  for(const [name,items] of groups){if(!items.length)continue;if(name){const h=document.createElement('h3');h.textContent=name;container.append(h);}const grid=document.createElement('div');grid.className=type==='class'?'destination-grid':'destination-grid place-grid';for(const n of items){const b=document.createElement('button');b.className='destination-button';b.textContent=type==='place'?title(n):n.name;if(type==='place'){const config=CAMPUS_PLACES.find(p=>p.id===n.id),icon=document.createElement('img');icon.className='destination-image';icon.src=`assets/place-icons/${config.icon}`;icon.alt='';icon.width=512;icon.height=512;icon.draggable=false;b.append(icon);}b.dataset.destination=n.id;b.setAttribute('aria-pressed',String(selected?.id===n.id));b.onclick=()=>{selected=n;end.value=n.id;$('selected-destination').textContent=`目的地：${title(n)}`;$('go').disabled=false;render();};grid.append(b);}container.append(grid);}
  if(!list.length){const p=document.createElement('p');p.textContent='找不到符合的目的地，請確認名稱或切換年級。';container.append(p);}
 }
 function chooseType(value){type=value;grade=7;$('endSearch').value='';clearSelection();render();show(1);}
 function reset(){disposeMapInteractions();disposeMapInteractions=()=>{};route=[];steps.replaceChildren();maps.replaceChildren();const details=$('full-route');if(details)details.open=false;$('result-title').textContent='';$('endSearch').value='';clearSelection();show(0);}
 for(const [value,name] of [[7,'七年級'],[8,'八年級'],[9,'九年級']]){const b=document.createElement('button');b.textContent=name;b.dataset.grade=String(value);b.onclick=()=>{grade=value;$('endSearch').value='';clearSelection();render();};$('grades').append(b);}
 $('choose-class').onclick=()=>chooseType('class');$('choose-place').onclick=()=>chooseType('place');
 $('back-types').onclick=reset;$('choose-again').onclick=reset;
 $('endSearch').oninput=()=>{clearSelection();render();};
 $('go').onclick=()=>{if(!selected)return;end.value=selected.id;run();if(!route.length)return;$('result-title').textContent=`目的地：${title(selected)}`;show(2);};
 reset();
}
if(typeof module!=='undefined')module.exports={destinationList,CAMPUS_PLACES};
if(typeof document!=='undefined'&&document.querySelector('#type-screen'))startSelectionFlow();
