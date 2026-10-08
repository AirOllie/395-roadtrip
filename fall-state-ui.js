'use strict';
(()=>{
 let current=window.FALL_STATE;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=v=>v?new Intl.DateTimeFormat('zh-CN',{timeZone:'America/Los_Angeles',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'未同步';
 const get=id=>current?.entries?.[id];
 function badge(id,detail=false){
  const e=get(id);if(!e)return '';
  const l=current.legend[e.stage]||current.legend.unknown;
  const label=e.listed?l.label:'原图未收录';
  const info=(e.regional?e.sourceName+' 区域参考；':'')+'原图未注明现场观测日期；上次成功同步 '+when(current.lastSuccessAt);
  return `<span class="fall-badge fall-${e.stage}" title="${escape(info)}"><img src="${l.icon}" alt="🍁" width="22" height="24">${label}${e.listed&&l.range?' '+l.range:''}${e.regional?' · 区域':''}</span>${detail?`<p class="fall-badge-meta">${escape(e.sourceName||'此地点没有单独状态')} · 同步 ${when(current.lastSuccessAt)}<br>现场观测日期：原图未注明 · <a href="${current.source}" target="_blank" rel="noopener">Fall Map 来源 ↗</a></p>`:''}`;
 }
 function icon(id){const e=get(id);return e?`<img class="trip-fall-leaf" src="${current.legend[e.stage].icon}" alt="🍁 ${escape(e.listed?current.legend[e.stage].label:'原图未收录')}" width="20" height="22">`:''}
 window.FallColors={get current(){return current},badge,icon,when};
 function updateSummary(){
  const el=document.querySelector('#fall-sync-status');if(!el||!current)return;
  const stale=Date.now()-Date.parse(current.lastSuccessAt)>18*3600000;
  el.textContent=(current.ok&&!stale?'已同步 ':'同步待恢复 · 保留上次状态 ')+when(current.lastSuccessAt)+'（太平洋时间） · 后台每 6 小时检查';
  el.classList.toggle('sync-warning',!current.ok||stale);
  const legend=document.querySelector('#overlay-fall-legend');if(legend)legend.innerHTML=['starting','patchy','near','peak','past','unknown'].map(s=>{const v=current.legend[s];return `<span><img src="${v.icon}" alt="🍁" width="18" height="20">${v.label}${v.range?' '+v.range:''}</span>`}).join('');
 }
 async function refresh(){
  if(document.hidden)return;
  try{
   const response=await fetch('秋色状态.json?sync='+Math.floor(Date.now()/300000),{cache:'no-store',credentials:'omit'});
   if(!response.ok)throw new Error('State unavailable');
   const latest=await response.json();if(latest.version!==1||!latest.legend||!latest.entries||!Array.isArray(latest.points))throw new Error('Invalid state');
   if(current?.checkedAt===latest.checkedAt&&current?.ok===latest.ok){updateSummary();return}
   current=latest;updateSummary();document.dispatchEvent(new CustomEvent('fall-state-updated'));
  }catch{const el=document.querySelector('#fall-sync-status');if(el){el.textContent='本次状态读取失败 · 保留上次成功同步 '+when(current?.lastSuccessAt);el.classList.add('sync-warning')}}
 }
 updateSummary();refresh();setInterval(refresh,300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 document.addEventListener('refresh-fall-state',refresh);
})();
