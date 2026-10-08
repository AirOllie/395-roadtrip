'use strict';
(()=>{
 const data=window.TRIP_MAP,host=document.querySelector('#trip-map');
 if(!data||!window.L){host.textContent='行程地图未能载入；仍可查看下面的逐站行程和秋色原图。';return}
 const palette=['#7057a3','#b07016','#28678d'],names=['周五','周六','周日'];
 let includeOptional=true,showRoute=true,showFall=true,selectedVisit=null;
 let ordinal=0;
 const visits=data.visits.map((v,i)=>({...v,visitId:String(i),order:v.optional?null:++ordinal}));
 const chronological=[...visits].sort((a,b)=>a.day-b.day||rank(a)-rank(b));
 function rank(v){return v.optional?(v.point==='june-overlook'?6.5:v.point==='mono-center'?4.25:4.5):v.seq}
 function stopName(v){const p=data.points[v.point];if(v.point==='sj')return v.day===0?'San Jose · 出发':'San Jose · 到家';if(v.point==='sonora')return v.day===0?'Sonora · 住宿':'Sonora · 早餐后出发';if(v.point==='mammoth')return v.day===1?'Mammoth · 住宿 / 晚餐':'Mammoth · 早餐后出发';if(v.point==='lee')return 'Lee Vining · 午餐';if(v.point==='carson')return 'Carson · 加油休息';if(v.point==='placerville')return 'Placerville · 晚餐';return p.name}
 const visitLabel=v=>`10/${9+v.day} ${names[v.day]} · ${v.optional?'备选':'第 '+v.order+' 站'} · ${stopName(v)}`;
 const map=L.map(host,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([37.95,-119.2],8);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
 const roadLayer=L.layerGroup().addTo(map),pinLayer=L.markerClusterGroup({animate:false,maxClusterRadius:14,disableClusteringAtZoom:14,showCoverageOnHover:false,spiderfyDistanceMultiplier:1.4,iconCreateFunction:c=>{
  const children=c.getAllChildMarkers().sort((a,b)=>(a.options.visit.order??99)-(b.options.visit.order??99)),v=children[0].options.visit;
  // The number is a real itinerary stop, never the number of map features.
  return L.divIcon({className:'trip-marker trip-nearby',html:`<span style="--trip-color:${palette[v.day]}"><b>${v.optional?'＋':v.order}</b></span><i aria-hidden="true">⋯</i>`,iconSize:[28,32],iconAnchor:[14,30]});
 }}).addTo(map);
 const fallLayer=L.markerClusterGroup({animate:false,maxClusterRadius:18,disableClusteringAtZoom:13,showCoverageOnHover:false,spiderfyDistanceMultiplier:1.2,iconCreateFunction:c=>{
  const children=c.getAllChildMarkers(),stages=new Set(children.map(m=>m.options.fallStage)),state=window.FallColors.current;
  const icon=state.legend[stages.size===1?children[0].options.fallStage:'unknown'].icon;
  return L.divIcon({className:'fall-cluster',html:`<img src="${icon}" alt="秋色点 · 点开放大">`,iconSize:[24,24],iconAnchor:[12,12]});
 }}).addTo(map);
 let currentPins={};
 const pointEntry=p=>data.visits.filter(v=>v.point===p.id).flatMap(v=>v.entries).find(id=>window.FallColors?.current?.entries[id]);
 function drawFall(){fallLayer.clearLayers();if(!showFall||!window.FallColors?.current)return;const state=window.FallColors.current;
 // A route pin already carries this exact source's leaf; avoid drawing it twice.
 const routeSources=showRoute?Object.keys(currentPins).map(id=>{const p=data.points[id],e=state.entries[pointEntry(p)];return e?.listed&&!e.regional?{name:e.sourceName,lat:p.lat,lon:p.lon}:null}).filter(Boolean):[];
 for(const p of state.points){if(routeSources.some(r=>r.name===p.name&&map.distance([r.lat,r.lon],[p.lat,p.lon])<1000))continue;const l=state.legend[p.stage];const icon=L.divIcon({className:'source-fall-marker',html:`<img src="${l.icon}" alt="🍁 ${esc(l.label)}">`,iconSize:[20,22],iconAnchor:[10,11]});const marker=L.marker([p.lat,p.lon],{icon,fallStage:p.stage,title:p.name+' · Fall Map '+l.label,zIndexOffset:-200}).bindPopup(`<div class="trip-popup"><h3>${esc(p.name)}</h3><p><img src="${l.icon}" alt="🍁" width="24" height="26" style="display:inline;vertical-align:middle"> ${esc(l.label)} ${esc(l.range)}</p><p>Fall Map 当前发布状态<br>同步 ${FallColors.when(state.lastSuccessAt)}（太平洋时间）<br>现场观测日期：原图未注明</p><a href="${state.source}" target="_blank" rel="noopener">查看来源 ↗</a></div>`,{maxWidth:220}).addTo(fallLayer);marker.getElement()?.setAttribute('aria-label',p.name+' · 秋色 '+l.label)}}
 const visible=()=>chronological.filter(v=>includeOptional||!v.optional);
 function selectRail(v,reveal=true){selectedVisit=v.visitId;document.querySelectorAll('[data-trip-visit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tripVisit===selectedVisit)));for(const [id,m] of Object.entries(currentVisits)){m.getElement()?.classList.toggle('selected',id===selectedVisit);m.setZIndexOffset(id===selectedVisit?500:m.options.visit.optional?100:200)}if(reveal)document.querySelector(`#trip-stop-rail [data-trip-visit="${selectedVisit}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}
 function rail(){const railHost=document.querySelector('#trip-stop-rail'),left=railHost.scrollLeft;railHost.innerHTML=visible().map(v=>`<button data-trip-visit="${v.visitId}" aria-pressed="${v.visitId===selectedVisit}" style="--trip-color:${palette[v.day]}" aria-label="${esc(visitLabel(v))}"><small>10/${9+v.day} ${names[v.day]} · ${esc(v.time)}</small><strong><span>${v.optional?'＋':v.order}</span>${esc(stopName(v))}</strong></button>`).join('');railHost.scrollLeft=left}
 function focusVisit(v){if(!v)return;selectRail(v);if(!showRoute){showRoute=true;document.querySelector('#show-trip-route').checked=true;draw(false)}const marker=currentVisits[v.visitId];if(marker){map.setView(marker.getLatLng(),13);pinLayer.zoomToShowLayer(marker,()=>marker.openPopup())}}
 let currentVisits={};
 const locationLink=p=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.navQuery);
 function popup(p,visits){return `<div class="trip-popup"><h3>${esc(p.name)}</h3>${pointEntry(p)?FallColors.badge(pointEntry(p),true):''}${visits.map(v=>`<section style="--trip-color:${palette[v.day]}"><div class="visit-time">10/${9+v.day} ${names[v.day]} ${v.optional?'备选':'全程第 '+v.order+' 站'} · ${esc(v.time)}</div><p>${esc(v.note)}</p>${v.entries.length?`<div class="map-option-links">${v.entries.map(id=>`<button data-entry="${id}">${esc(G.entries[id].name)} · 照片</button>`).join('')}</div>`:''}<a href="${locationLink(p)}" target="_blank" rel="noopener">位置导航 ↗</a><button data-trip-day="${v.day}" data-trip-event="${v.event}">看当天行程</button></section>`).join('')}<p>城镇点为示意；选定餐厅、酒店后请用其照片详情里的导航。</p></div>`}
 function fit(all=false){const vs=visible().filter(v=>all||!['sj','sonora','pass','carson','tahoe','placerville'].includes(v.point));if(vs.length)map.fitBounds(L.latLngBounds(vs.map(v=>[data.points[v.point].lat,data.points[v.point].lon])),{padding:[30,35],maxZoom:12})}
 function draw(recenter=true){
  roadLayer.clearLayers();pinLayer.clearLayers();currentPins={};currentVisits={};
  for(const line of data.lines)if(showRoute)L.geoJSON(line.geometry,{style:{color:palette[line.day],weight:3,opacity:.8}}).addTo(roadLayer);
  for(const v of (showRoute?visible():[])){
   const p=data.points[v.point],optional=v.optional;
   const icon=L.divIcon({className:'trip-marker'+(optional?' optional':'')+(v.visitId===selectedVisit?' selected':''),html:`<span style="--trip-color:${palette[v.day]}"><b>${optional?'＋':v.order}</b></span>${showFall&&pointEntry(p)?FallColors.icon(pointEntry(p)):''}`,iconSize:[28,32],iconAnchor:[14,30],popupAnchor:[0,-27]});
   const label=visitLabel(v);
   const marker=L.marker([p.lat,p.lon],{icon,visit:v,title:label,zIndexOffset:v.visitId===selectedVisit?500:optional?100:200}).bindPopup(popup(p,[v]),{maxWidth:220,autoPanPaddingTopLeft:[30,25],autoPanPaddingBottomRight:[15,25]}).addTo(pinLayer);
   marker.on('add',()=>{marker.getElement()?.setAttribute('aria-label',label);marker.getElement()?.classList.toggle('selected',v.visitId===selectedVisit)});marker.getElement()?.setAttribute('aria-label',label);
   marker.on('click',()=>selectRail(v));currentPins[p.id]=marker;currentVisits[v.visitId]=marker;
  }
  rail();
  document.querySelector('#trip-stop-buttons').innerHTML=[0,1,2].map(d=>{const vs=visible().filter(v=>v.day===d);return vs.length?`<h3 style="color:${palette[d]}">${names[d]} · 10/${9+d}</h3>${vs.map(v=>`<button data-trip-visit="${v.visitId}" aria-pressed="${v.visitId===selectedVisit}"><span>${v.optional?'＋':v.order} · ${esc(stopName(v))}${v.optional?' · 备选':''}</span><small>${esc(v.time)}</small></button>`).join('')}`:''}).join('');
  if(recenter)fit();drawFall();
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-map-view],[data-trip-visit],[data-trip-event]');if(!b)return;
  if(b.dataset.mapView){const trip=b.dataset.mapView==='trip';document.querySelector('#trip-map-panel').hidden=!trip;document.querySelector('#fall-map-panel').hidden=trip;document.querySelectorAll('[data-map-view]').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.hidden=(x.dataset.mapView==='trip')===trip});document.querySelector('#refresh-fall-map').textContent=trip?'看全程':'刷新 ↻';if(trip){map.invalidateSize();fit()}}
  else if(b.dataset.tripVisit!==undefined){focusVisit(visits.find(v=>v.visitId===b.dataset.tripVisit))}
  else if(b.dataset.tripEvent!==undefined){day=Number(b.dataset.tripDay);render();document.querySelector('#event-'+b.dataset.tripEvent)?.scrollIntoView({behavior:'smooth',block:'start'})}
 });
 document.querySelector('#show-trip-optional').addEventListener('change',ev=>{includeOptional=ev.target.checked;if(!includeOptional&&visits.find(v=>v.visitId===selectedVisit)?.optional)selectedVisit=null;draw(false)});
 document.addEventListener('trip-map-fit',()=>{selectedVisit=null;draw(false);fit(true)});
 document.querySelector('#show-trip-route').addEventListener('change',e=>{showRoute=e.target.checked;draw(false)});
 document.querySelector('#show-fall-overlay').addEventListener('change',e=>{showFall=e.target.checked;draw(false)});
 document.addEventListener('fall-state-updated',()=>draw(false));
 // MarkerCluster manages viewport visibility; keep markers stable during pan/zoom.
 document.querySelector('#refresh-fall-map').textContent='看全程';
 draw();
})();
