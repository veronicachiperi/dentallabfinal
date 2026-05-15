const STORAGE_KEY='dental-lab-overrides-v4-clean';
function loadOverrides(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return{}}}
function saveOverrides(o){localStorage.setItem(STORAGE_KEY,JSON.stringify(o))}
const overrides=loadOverrides();
function applyOverrides(){
  if(overrides.stages)Object.entries(overrides.stages).forEach(([id,s])=>{const c=getCase(id);if(c)c.stage=s});
  if(overrides.edits)Object.entries(overrides.edits).forEach(([id,e])=>{const c=getCase(id);if(c)Object.assign(c,e)});
  if(overrides.read)overrides.read.forEach(id=>{const n=NOTIFICATIONS.find(x=>x.id===id);if(n)n.unread=false});
}
applyOverrides();

const ATTACHMENTS_KEY='dental-lab-attachments-v2-clean';
function loadAttachments(){try{return JSON.parse(localStorage.getItem(ATTACHMENTS_KEY)||'{}')}catch{return{}}}
function saveAttachments(o){localStorage.setItem(ATTACHMENTS_KEY,JSON.stringify(o))}
const attachments=loadAttachments();
const CUSTOM_TYPES_KEY='dental-lab-custom-types-v1';
let customWorkTypes=loadCustomWorkTypes();
function loadCustomWorkTypes(){try{return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY)||'[]')}catch{return[]}}
function saveCustomWorkTypes(){localStorage.setItem(CUSTOM_TYPES_KEY,JSON.stringify(customWorkTypes))}
function allWorkTypes(){return [...new Set([...COMMON_TYPES,...customWorkTypes].map(t=>String(t||'').trim()).filter(Boolean))]}
function rememberWorkType(type){const t=String(type||'').trim();if(!t||allWorkTypes().includes(t))return;if(!COMMON_TYPES.includes(t)&&!customWorkTypes.includes(t)){customWorkTypes.push(t);saveCustomWorkTypes()}}
function escHTML(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function escAttr(v){return escHTML(v).replace(/"/g,'&quot;')}
function formatBytes(bytes){
  if(!bytes)return'0 KB';
  const units=['B','KB','MB','GB'];
  let n=bytes,i=0;
  while(n>=1024&&i<units.length-1){n/=1024;i++}
  return `${Math.round(n*10)/10} ${units[i]}`;
}
function fileExt(name){const p=String(name||'').split('.').pop();return p&&p!==name?p.toUpperCase().slice(0,4):'FILE'}
function filesForCase(caseId){return attachments[caseId]||[]}
function persistCaseFiles(caseId,files){
  const saved=filesForCase(caseId).slice();
  Array.from(files||[]).forEach(f=>saved.push({name:f.name,size:f.size,type:f.type||'',added:fmtShortDate(new Date())}));
  attachments[caseId]=saved;
  saveAttachments(attachments);
}
async function storeCaseFiles(caseId,files){
  const arr=Array.from(files||[]);
  if(!arr.length)return 0;
  const c=getCase(caseId),cl=c?getClinic(c.clinic):null;
  const fd=new FormData();
  fd.append('caseId',caseId);
  fd.append('clinicId',c?.clinic||'unknown');
  fd.append('clinicName',cl?.name||'Unknown clinic');
  fd.append('patientName',c?.name||`case-${caseId}`);
  arr.forEach(f=>fd.append('files',f,f.name));
  try{
    const res=await fetch('/api/upload',{method:'POST',body:fd});
    if(!res.ok)throw new Error('upload failed');
    const json=await res.json();
    const saved=filesForCase(caseId).slice();
    (json.files||[]).forEach(f=>saved.push({name:f.name,size:f.size,type:f.type||'',path:f.path,folder:f.folder||json.folder,clinicFolder:f.clinicFolder||json.clinicFolder,folderUrl:f.folderUrl||json.folderUrl,added:fmtShortDate(new Date())}));
    attachments[caseId]=saved;
    saveAttachments(attachments);
  }catch{
    persistCaseFiles(caseId,arr);
  }
  return arr.length;
}
function chooseFilesForCase(caseId,onDone){
  const input=document.createElement('input');
  input.type='file';input.multiple=true;input.hidden=true;
  input.addEventListener('change',async()=>{const count=await storeCaseFiles(caseId,input.files);input.remove();if(onDone)onDone(count)});
  document.body.appendChild(input);
  input.click();
}

const activeFilter={tab:'all',clinic:'all'};
function applyFilter(cases){
  const today=todayLabDate();
  const weekEnd=new Date(today);weekEnd.setDate(today.getDate()+7);
  const user=getCurrentUser();
  // Clinic users see only their own clinic's cases
  let src=cases;
  if(user?.role==='clinic'&&user?.clinic){src=cases.filter(c=>c.clinic===user.clinic)}
  return src.filter(c=>{
    const isTrimis=c.stage==='trimis';
    if(activeFilter.tab==='trimise')return isTrimis;
    if(isTrimis)return false;
    if(activeFilter.clinic!=='all'&&c.clinic!==activeFilter.clinic)return false;
    if(activeFilter.tab==='mine'){if(!user||c.assignee!==user.id)return false}
    if(activeFilter.tab==='late'&&!c.late)return false;
    if(activeFilter.tab==='today'){const f=parseShortDate(c.finala);if(!f||f.toDateString()!==today.toDateString())return false}
    if(activeFilter.tab==='week'){const f=parseShortDate(c.finala);if(!f||f<today||f>weekEnd)return false}
    if(activeFilter.tab==='notstarted'&&!c.notStarted)return false;
    if(activeFilter.tab==='proba'&&c.stage!=='proba')return false;
    if(activeFilter.tab==='ready'&&c.stage!=='terminat')return false;
    if(activeFilter.tab==='unassigned'&&!c.notStarted&&c.assignee)return false;
    return true;
  });
}

// Delete case (admin + owning clinic)
async function deleteCase(id){
  const c=getCase(id);if(!c)return;
  if(!confirm(`Ștergi cazul "${c.name}"? Această acțiune nu poate fi anulată.`))return;
  if(typeof sbDeleteCase==='function'&&SUPABASE_CONFIGURED){
    try{await sbDeleteCase(c.id,c.name)}catch(e){alert('Eroare la ștergere: '+e.message);return}
  }
  const i=CASES.findIndex(x=>x.id===id);
  if(i>=0)CASES.splice(i,1);
  overrides.edits=overrides.edits||{};delete overrides.edits[id];
  overrides.stages=overrides.stages||{};delete overrides.stages[id];
  saveOverrides(overrides);
  reRenderAll();
  if(location.pathname.includes('case.html'))location.href='index.html';
}

// Move case to a different stage
async function moveCaseToStage(id,stageId){
  const c=getCase(id);if(!c)return;
  c.stage=stageId;c.notStarted=false;
  overrides.stages=overrides.stages||{};overrides.stages[c.id]=stageId;
  overrides.edits=overrides.edits||{};overrides.edits[c.id]={...overrides.edits[c.id],stage:stageId,notStarted:false};
  saveOverrides(overrides);
  if(typeof sbUpdateField==='function'&&SUPABASE_CONFIGURED){
    await sbUpdateField(c,'stage',stageId);
    await sbUpdateField(c,'notStarted',false);
  }
  reRenderAll();
}

function reRenderAll(){
  updateMainSummary();
  if(typeof renderTable==='function')renderTable();
  renderPipeline();renderClinic();
}
function _syncCase(c){
  if(typeof sbSaveCase==='function'&&SUPABASE_CONFIGURED)sbSaveCase(c).catch(e=>console.warn('[sb sync]',e.message));
}

// === ROLE-BASED SIDEBAR ===
function applySidebarRoles(){
  const user=getCurrentUser()||{role:'admin',name:'Admin',initials:'AD',id:'admin'};
  const roleKey=user.role==='technician'?'tech':user.role;
  // Topbar avatar
  const av=document.getElementById('userAvatar');
  if(av){av.textContent=user.initials;av.title=user.name;}
  // Sidebar profile block
  const spAv=document.getElementById('spAvatar');
  const spName=document.getElementById('spName');
  const spRole=document.getElementById('spRole');
  const roleLabel={admin:'Administrator',technician:'Tehnician',tech:'Tehnician',clinic:'Clinică'}[user.role]||user.role;
  if(spAv)spAv.textContent=user.initials;
  if(spName)spName.textContent=user.name;
  if(spRole)spRole.textContent=roleLabel;
  // Status
  const savedStatus=localStorage.getItem('dental-lab-status')||'online';
  const spDot=document.getElementById('spStatusDot');
  const spSel=document.getElementById('spStatusSelect');
  if(spDot)spDot.className='sp-dot '+savedStatus;
  if(spSel){
    spSel.value=savedStatus;
    spSel.onchange=()=>{
      localStorage.setItem('dental-lab-status',spSel.value);
      if(spDot)spDot.className='sp-dot '+spSel.value;
    };
  }
  // Hide nav items not allowed for this role
  document.querySelectorAll('[data-roles]').forEach(el=>{
    const roles=el.dataset.roles.split(',');
    el.style.display=roles.includes(roleKey)?'':'none';
  });
  document.querySelectorAll('[data-admin-only]').forEach(el=>{
    el.style.display=user.role==='admin'?'':'none';
  });
  // Build sidebar if it's a dynamic sidebar (activity page etc.)
  const sb=document.getElementById('sidebar');
  if(sb&&sb.children.length===0)sb.innerHTML=buildSidebarHTML(user.role,user);
}

function buildSidebarHTML(role,user){
  const u=user||getCurrentUser()||{name:'',initials:'?'};
  const item=(href,label)=>{
    const cur=location.pathname.includes(href);
    return`<a class="nav-item${cur?' active':''}" href="${href}"><span class="nav-icon"></span>${label}</a>`;
  };
  const savedStatus=localStorage.getItem('dental-lab-status')||'online';
  const roleLabel={admin:'Administrator',technician:'Tehnician',tech:'Tehnician',clinic:'Clinică'}[role]||role;
  return`<div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div>
<div class="nav-section">Workflow</div>
${role!=='clinic'?item('tehnician.html','Acasă'):''}
${role!=='clinic'?item('index.html','Lucrări'):''}
${role!=='clinic'?item('calendar.html','Calendar'):''}
${role!=='clinic'?item('arhiva.html','Arhivă'):''}
${role==='admin'?item('stats.html','Statistici'):''}
<div class="nav-section">Date</div>
${item('clinici.html','Clinici')}
${role==='admin'?item('echipa.html','Echipa'):''}
${role!=='clinic'?item('workdrive.html','WorkDrive'):''}
${role!=='clinic'?item('termeni.html','Termeni'):''}
${role==='admin'?item('activity.html','Activitate'):''}
<div class="sidebar-profile" id="sidebarProfile">
  <div class="sp-user">
    <div class="sp-avatar" id="spAvatar">${escHTML(u.initials||'?')}</div>
    <div class="sp-info">
      <div class="sp-name" id="spName">${escHTML(u.name||'')}</div>
      <div class="sp-role" id="spRole">${roleLabel}</div>
    </div>
  </div>
  <div class="sp-status-row">
    <span class="sp-dot ${savedStatus}" id="spStatusDot"></span>
    <select class="sp-status-sel" id="spStatusSelect">
      <option value="online"${savedStatus==='online'?' selected':''}>Online</option>
      <option value="iesit"${savedStatus==='iesit'?' selected':''}>Ieșit</option>
      <option value="offline"${savedStatus==='offline'?' selected':''}>Offline</option>
    </select>
  </div>
  <button class="sp-logout-btn" onclick="sbSignOut&&sbSignOut();return false">Deconectare</button>
</div>`;
}

function updateMainSummary(){
  const active=CASES.filter(c=>c.stage!=='trimis').length;
  const late=CASES.filter(c=>c.stage!=='trimis'&&c.late).length;
  const count=document.getElementById('navCountLucrari');
  if(count)count.textContent=active;
  const banner=document.getElementById('lateBanner');
  if(banner){
    const label=banner.querySelector('b');
    if(label)label.textContent=`${late} ${late===1?'lucrare':'lucrări'} în întârziere`;
    banner.style.display=late?'flex':'none';
  }
  const dot=document.querySelector('#bellBtn .bell-dot');
  if(dot)dot.style.display=NOTIFICATIONS.some(n=>n.unread)?'block':'none';
  renderActionDashboard();
}

function caseDueInfo(c){
  const today=todayLabDate();
  const due=parseShortDate(c.finala);
  if(!due)return{label:c.finala||'—',days:999};
  const days=Math.ceil((due-today)/86400000);
  if(c.late||days<0)return{label:'restant',days};
  if(days===0)return{label:'azi',days};
  if(days===1)return{label:'mâine',days};
  return{label:c.finala,days};
}

function publicStageName(c){
  if(c?.notStarted)return 'Neînceput';
  if(c?.stage==='trimis')return 'Trimisă';
  if(c?.stage==='terminat')return 'Gata';
  return getStage(c?.stage)?.name || '—';
}

function publicStageColor(c){
  if(c?.notStarted)return '#9CA3AF';
  return getStage(c?.stage)?.color || '#6B7280';
}

function labTermsTableHTML(compact=false){
  return `<div class="lab-terms ${compact?'compact':''}">
    <div class="lab-terms-title">Termenii laboratorului</div>
    <div class="lab-terms-grid">
      <div class="lab-terms-head">Categorie</div><div class="lab-terms-head">Serviciu</div><div class="lab-terms-head">Timp executare (Luni-Vineri)</div>
      ${LAB_TERMS.map(t=>`<div class="lab-term-cat">${escHTML(t.category)}</div><div>${escHTML(t.service)}</div><div>${escHTML(t.time)}</div>`).join('')}
    </div>
    <div class="lab-terms-note good">Pentru probe printate lucrări All on X: minim 24 ore de la primirea scanurilor.</div>
    <div class="lab-terms-note warn">* În lipsa informațiilor sau a răspunsurilor primite în timp util, termenele pot fi ajustate.</div>
  </div>`;
}

function termsPageUrl(clinicId){
  return `termeni.html${clinicId?`?clinic=${encodeURIComponent(clinicId)}&view=clinic`:''}`;
}

function deadlineHintHTML(status){
  if(!status.term)return '<div class="deadline-hint neutral">Nu am găsit un termen automat pentru acest tip. Se poate salva, dar verifică manual termenul.</div>';
  if(status.businessDays===null)return `<div class="deadline-hint neutral">${escHTML(status.term.service)} · minim ${status.min} zile lucrătoare.</div>`;
  if(status.urgent)return `<div class="deadline-hint bad">Urgent: sunt ${status.businessDays} zile lucrătoare, minimul este ${status.min} pentru ${escHTML(status.term.service)}.</div>`;
  return `<div class="deadline-hint good">${escHTML(status.term.service)} · ${status.businessDays} zile lucrătoare disponibile.</div>`;
}
function longDateRO(date){
  const s=date.toLocaleDateString('ro-RO',{day:'numeric',month:'long',year:'numeric'});
  return s.charAt(0).toUpperCase()+s.slice(1);
}

function renderAttachedFiles(c){
  const files=filesForCase(c.id);
  if(!files.length)return '<div class="file-empty">Niciun fișier atașat încă.</div>';
  return files.map(f=>`<div class="file-item">
    <div class="file-icon-mini">${fileExt(f.name)}</div>
    <span class="file-name">${f.name}</span>
    ${f.folderUrl?`<a class="file-size" href="${escAttr(f.folderUrl)}" target="_blank" rel="noreferrer">WorkDrive</a>`:`<span class="file-size" title="${escAttr(f.folder||f.path||'')}">${formatBytes(f.size)}</span>`}
  </div>`).join('');
}

function setDashboardFilter(tab){
  activeFilter.tab=tab;
  document.querySelectorAll('.subbar .tab').forEach(t=>t.classList.remove('on'));
  const tabIndex={all:0,mine:1,late:2,week:3,notstarted:4,trimise:5}[tab];
  if(tabIndex!==undefined)document.querySelectorAll('.subbar .tab')[tabIndex]?.classList.add('on');
  renderPipeline();
  if(typeof renderTable==='function')renderTable();
}

function renderActionDashboard(){
  const root=document.getElementById('actionDashboard');
  if(!root)return;
  const today=todayLabDate();
  const activeAll=CASES.filter(c=>c.stage!=='trimis');
  const active=activeAll.filter(c=>activeFilter.clinic==='all'||c.clinic===activeFilter.clinic);
  const dueToday=active.filter(c=>{const d=parseShortDate(c.finala);return d&&d.toDateString()===today.toDateString()});
  const late=active.filter(c=>c.late);
  const proba=active.filter(c=>c.stage==='proba');
  const ready=active.filter(c=>c.stage==='terminat');
  const unassigned=active.filter(c=>c.notStarted||!c.assignee);
  const stats=[
    {tab:'late',label:'Restante',value:late.length,tone:'late',hint:'necesită decizie'},
    {tab:'today',label:'Azi',value:dueToday.length,tone:'warn',hint:'date finale azi'},
    {tab:'proba',label:'La probă',value:proba.length,tone:'info',hint:'așteaptă clinică'},
    {tab:'ready',label:'Gata de ridicat',value:ready.length,tone:'good',hint:'de trimis'},
    {tab:'unassigned',label:'Neasignate',value:unassigned.length,tone:'muted',hint:'pornește lucrarea'}
  ];
  const worklist=active.slice().sort((a,b)=>{
    const ad=caseDueInfo(a),bd=caseDueInfo(b);
    if(Boolean(b.late)!==Boolean(a.late))return a.late?-1:1;
    const au=labDeadlineStatus(a).urgent,bu=labDeadlineStatus(b).urgent;
    if(bu!==au)return au?-1:1;
    if(a.notStarted!==b.notStarted)return a.notStarted?-1:1;
    return ad.days-bd.days;
  }).slice(0,8);
  root.innerHTML=`<div class="dash-head">
    <div><div class="dash-eyebrow">Azi · ${longDateRO(today)}</div><h1 class="dash-title">Dashboard lucrări</h1></div>
    <button class="btn" type="button" data-dash-filter="all">Vezi toate</button>
  </div>
  <div class="dash-kpis">${stats.map(s=>`<button class="dash-kpi ${s.tone} ${activeFilter.tab===s.tab?'on':''}" type="button" data-dash-filter="${s.tab}">
    <span class="dash-kpi-label">${s.label}</span><span class="dash-kpi-value">${s.value}</span><span class="dash-kpi-hint">${s.hint}</span>
  </button>`).join('')}</div>
  <div class="dash-grid">
    <section class="dash-panel">
      <div class="dash-panel-head"><span>De rezolvat prima dată</span><small>${worklist.length} priorități</small></div>
      <div class="dash-worklist">${worklist.length?worklist.map(c=>{const cl=getClinic(c.clinic);const due=caseDueInfo(c);const deadlineUrgent=labDeadlineStatus(c).urgent;return `<a class="dash-work-row ${c.late||deadlineUrgent?'late':c.notStarted?'muted':''}" href="case.html?id=${c.id}">
        <div class="dash-work-main"><b>${c.name}</b><span>${cl.name} · ${c.type}</span></div>
        <div class="dash-work-meta"><span class="dash-chip" style="--chip:${publicStageColor(c)}">${publicStageName(c)}</span><strong>${due.label}</strong></div>
      </a>`}).join(''):'<div class="dash-empty">Nicio lucrare încă. Adaugă primul caz real din butonul Caz nou.</div>'}</div>
    </section>
  </div>`;
  root.querySelectorAll('[data-dash-filter]').forEach(b=>b.addEventListener('click',()=>setDashboardFilter(b.dataset.dashFilter)));
}

function closeNotificationDrawer(){
  document.querySelector('.notif-scrim')?.remove();
  document.querySelector('.notif-drawer')?.remove();
}

function openNotificationDrawer(){
  closeNotificationDrawer();
  const scrim=document.createElement('div');
  scrim.className='notif-scrim';
  const drawer=document.createElement('aside');
  drawer.className='notif-drawer';
  const unread=NOTIFICATIONS.filter(n=>n.unread).length;
  drawer.innerHTML=`<div class="notif-head"><div><div class="notif-eyebrow">${unread} necitite</div><h2>Notificări</h2></div><button class="notif-close" type="button">×</button></div>
    <div class="notif-list">${NOTIFICATIONS.map(n=>{const c=getCase(n.caseId);const cl=c?getClinic(c.clinic):null;return `<button class="notif-item ${n.unread?'unread':''}" type="button" data-notif-id="${n.id}" data-case-id="${n.caseId}">
      <span class="notif-dot"></span><span class="notif-body"><b>${n.kind}</b><span>${n.text}</span><small>${n.time}${cl?' · '+cl.name:''}</small></span>
    </button>`}).join('')}</div>
    <div class="notif-foot"><button class="btn" type="button" id="markNotificationsRead">Marchează citite</button></div>`;
  document.body.appendChild(scrim);
  document.body.appendChild(drawer);
  scrim.addEventListener('click',closeNotificationDrawer);
  drawer.querySelector('.notif-close')?.addEventListener('click',closeNotificationDrawer);
  drawer.querySelectorAll('.notif-item').forEach(item=>item.addEventListener('click',()=>{
    const id=Number(item.dataset.notifId);
    const n=NOTIFICATIONS.find(x=>x.id===id);
    if(n)n.unread=false;
    overrides.read=[...new Set([...(overrides.read||[]),id])];
    saveOverrides(overrides);
    location.href=`case.html?id=${item.dataset.caseId}`;
  }));
  drawer.querySelector('#markNotificationsRead')?.addEventListener('click',()=>{
    NOTIFICATIONS.forEach(n=>n.unread=false);
    overrides.read=NOTIFICATIONS.map(n=>n.id);
    saveOverrides(overrides);
    updateMainSummary();
    openNotificationDrawer();
  });
}

function attachNotifications(){
  document.getElementById('bellBtn')?.addEventListener('click',openNotificationDrawer);
}

// === PIPELINE KANBAN ===
function renderPipeline(){
  const root=document.getElementById('pipeline');
  if(!root)return;
  const cols=['notstarted',...PIPELINE_STAGES];
  root.innerHTML='';
  cols.forEach(stageId=>{
    const isNotStartedCol=stageId==='notstarted';
    const stage=isNotStartedCol?{name:'Neînceput',color:'#9CA3AF'}:getStage(stageId);
    const stageCases=isNotStartedCol
      ? CASES.filter(c=>c.notStarted&&c.stage!=='trimis')
      : casesInStage(stageId).filter(c=>!c.notStarted);
    const cases=applyFilter(stageCases);
    const col=document.createElement('div');
    col.className='kb-col';col.dataset.stage=stageId;
    col.innerHTML=`<div class="kb-col-head" data-stage="${stageId}"><span class="kb-stage-dot" style="background:${stage.color}"></span><span class="kb-col-name">${stageId==='terminat'?'Finalizat':stage.name}</span><span class="kb-col-count">${cases.length}</span><button class="kb-col-toggle" type="button" title="Restrânge/extinde">▾</button><button class="kb-col-menu" type="button" data-stage="${stageId}" title="Acțiuni">⋯</button></div>`;
    cases.forEach(c=>col.appendChild(renderKanbanCard(c)));
    if(!isNotStartedCol)attachDropZone(col,stageId);
    root.appendChild(col);
  });

  // After rendering all columns — attach toggle and menu handlers ONCE
  document.querySelectorAll('.kb-col-toggle').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    b.closest('.kb-col').classList.toggle('collapsed');
  }));
  document.querySelectorAll('.kb-col-menu').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    document.querySelectorAll('.kb-col-popover').forEach(p=>p.remove());
    const m=document.createElement('div');m.className='kb-col-popover';
    m.innerHTML=`<button class="kb-pop-item" data-act="add">+ Caz nou la această etapă</button><button class="kb-pop-item" data-act="collapse">Restrânge coloana</button>`;
    b.parentElement.appendChild(m);
    m.querySelectorAll('.kb-pop-item').forEach(it=>it.addEventListener('click',ev=>{
      ev.stopPropagation();const a=it.dataset.act;
      if(a==='add')openNewCaseModal();
      if(a==='collapse')b.closest('.kb-col').classList.toggle('collapsed');
      m.remove();
    }));
    setTimeout(()=>{const cl=ev=>{if(!m.contains(ev.target)&&ev.target!==b){m.remove();document.removeEventListener('click',cl)}};document.addEventListener('click',cl)},0);
  }));
  updateMainSummary();
}

function renderKanbanCard(c){
  const card=document.createElement('div');
  const deadlineUrgent=labDeadlineStatus(c).urgent;
  card.className='kb-card'+(c.late?' late':deadlineUrgent?' urgent':c.warn?' warn':c.stage==='terminat'?' ready':'');
  card.draggable=true;card.dataset.caseId=c.id;card.tabIndex=0;card.setAttribute('role','link');
  const clinic=getClinic(c.clinic);const tech=getEmployee(c.assignee);
  const ss=c.notStarted?'neincepute':(c.stageStatuses?.[c.stage]||'in_lucru');
  const badge=ss==='finalizat'?`<span class="substate-badge final">✓</span>`:ss==='la_proba'?`<span class="substate-badge proba">P</span>`:`<span class="substate-badge lucru">●</span>`;
  const ft=c.late?'restant':c.stage==='terminat'?'gata':c.finala;
  const fc=(c.late||deadlineUrgent)?'late':c.stage==='terminat'?'ready':'';
  const note=(c.notes||'').trim();
  const notePreview=note?note.split('\n')[0]:'Adaugă notiță';
  card.innerHTML=`<div class="kb-card-top"><div class="kb-card-clinic">${clinic.name}</div><button class="kb-card-menu" type="button" title="Acțiuni">⋯</button></div><div class="kb-card-name">${c.name}</div><div class="kb-card-row"><span class="kb-tag">${c.type}</span><span class="kb-final ${fc}">${ft}</span></div><span class="kb-note-chip tbl-notes ${note?'has-note':''}" title="${escAttr(note||'Adaugă notiță')}">${note?escHTML(notePreview):'+ Notițe'}</span><div class="kb-card-foot">${c.notStarted?`<span class="kb-unassigned">— neînceput</span>`:tech?`<span class="kb-av ${tech.id}" style="position:relative">${tech.initials}${badge}</span><span class="kb-tehnician-name">${tech.name}</span>`:`<span class="kb-unassigned">— neasignat</span>`}</div>`;
  card.addEventListener('dragstart',e=>{card.style.opacity='0.4';e.dataTransfer.setData('text/plain',String(c.id))});
  card.addEventListener('dragend',()=>card.style.opacity='1');
  card.addEventListener('click',e=>{if(e.target.closest('button,.kb-card-popover,.tbl-notes,.kb-tag'))return;location.href=`case.html?id=${c.id}`});
  card.addEventListener('keydown',e=>{if(e.key==='Enter')location.href=`case.html?id=${c.id}`});
  card.querySelector('.kb-card-menu')?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    document.querySelectorAll('.kb-card-popover,.kb-col-popover').forEach(p=>p.remove());
    const user=getCurrentUser()||{role:'admin'};
    const isAdminOrTech=user.role==='admin'||user.role==='technician'||user.role==='tech';
    const stageOpts=PIPELINE_STAGES.map(s=>{const st=getStage(s);return`<button class="kb-pop-item" type="button" data-act="move" data-stage="${s}">&nbsp;&nbsp;&nbsp;${st?.name||s}</button>`}).join('');
    const m=document.createElement('div');m.className='kb-card-popover';
    m.innerHTML=
      `<button class="kb-pop-item" type="button" data-act="view-pdf">Fișă PDF — Vizualizează</button>`+
      `<button class="kb-pop-item" type="button" data-act="dl-pdf">Fișă PDF — Descarcă</button>`+
      `<div class="kb-pop-sep"></div>`+
      `<button class="kb-pop-item" type="button" data-act="open">Deschide cazul</button>`+
      (isAdminOrTech?`<div class="kb-pop-sep"></div><div class="kb-pop-label">Mută la etapă</div>${stageOpts}`+
      `<div class="kb-pop-sep"></div><button class="kb-pop-item" type="button" data-act="reset">Clear → Neînceput</button>`:'')+
      (user.role==='admin'||user.role==='clinic'?`<button class="kb-pop-item danger" type="button" data-act="delete">Șterge cazul</button>`:'');
    card.appendChild(m);
    m.querySelectorAll('.kb-pop-item').forEach(it=>it.addEventListener('click',ev=>{
      ev.stopPropagation();
      const act=it.dataset.act;
      if(act==='view-pdf'){previewFisaPDF(c)}
      if(act==='dl-pdf'){generateFisaPDF(c)}
      if(act==='reset'&&confirm(`Resetezi progresul pentru ${c.name}?`))resetCaseToNotStarted(c);
      if(act==='open')location.href=`case.html?id=${c.id}`;
      if(act==='move'){moveCaseToStage(c.id,it.dataset.stage)}
      if(act==='delete'){deleteCase(c.id)}
      m.remove();
    }));
    setTimeout(()=>{const cl=ev=>{if(!m.contains(ev.target)&&ev.target!==e.target){m.remove();document.removeEventListener('click',cl)}};document.addEventListener('click',cl)},0);
  });
  return card;
}

function resetCaseToNotStarted(c){
  if(!c)return;
  c.stage='design';
  c.notStarted=true;
  c.assignee=null;
  c.assignees={};
  c.stageStatuses={};
  c.deadlineUrgent=labDeadlineStatus(c).urgent;
  c.priority=computePriority(c);
  overrides.stages=overrides.stages||{};
  overrides.stages[c.id]='design';
  overrides.edits=overrides.edits||{};
  overrides.edits[c.id]={...overrides.edits[c.id],stage:c.stage,notStarted:c.notStarted,assignee:c.assignee,assignees:c.assignees,stageStatuses:c.stageStatuses,deadlineUrgent:c.deadlineUrgent,priority:c.priority};
  saveOverrides(overrides);
  _syncCase(c);
  renderPipeline();
  updateMainSummary();
  if(typeof renderTable==='function')renderTable();
  renderClinic();
}

function attachDropZone(col,stageId){
  col.addEventListener('dragover',e=>e.preventDefault());
  col.addEventListener('drop',e=>{
    e.preventDefault();
    const id=Number(e.dataTransfer.getData('text/plain'));
    const c=getCase(id);
    if(c&&(c.stage!==stageId||c.notStarted)){
      c.stage=stageId;
      c.notStarted=false;
      overrides.stages=overrides.stages||{};overrides.stages[c.id]=stageId;
      overrides.edits=overrides.edits||{};overrides.edits[c.id]={...overrides.edits[c.id],stage:c.stage,notStarted:c.notStarted};
      saveOverrides(overrides);
      _syncCase(c);
      renderPipeline();
      updateMainSummary();
      if(typeof renderTable==='function')renderTable();
    }
  });
}

// === CLINIC PORTAL ===
function renderClinic(){
  const root=document.getElementById('clinicShell');
  if(!root)return;
  const _cu=getCurrentUser();
  const clinicId=(_cu&&_cu.role==='clinic'&&_cu.clinic)?_cu.clinic:(new URLSearchParams(location.search).get('id')||'crisdent');
  const clinic=getClinic(clinicId);
  if(!clinic){root.innerHTML='<p>Clinică inexistentă</p>';return}
  const cases=casesForClinic(clinicId);
  const active=cases.filter(c=>c.stage!=='trimis');
  const proba=cases.filter(c=>c.stage==='proba');
  const ready=cases.filter(c=>c.stage==='terminat');
  const late=cases.filter(c=>c.late);

  const CLINIC_STAGES=['design','cam','prelucrare','ceramica','proba','terminat'];

  function progressPct(stageId){
    if(stageId==='trimis')return 100;
    const idx=CLINIC_STAGES.indexOf(stageId);
    if(idx===-1)return 0;
    return Math.round(((idx+1)/CLINIC_STAGES.length)*100);
  }

  function ra(c){
    if(c.stage==='proba')return{cls:'primary',label:'Aprobă probă',action:'approve'};
    if(c.stage==='terminat')return{cls:'primary',label:'Confirmă ridicare',action:'pickup'};
    return{cls:'note',label:'Adaugă notă',action:'note'};
  }

  // Clinics see only their own portal — admins/techs see tabs to navigate between all
  const currentUser=getCurrentUser();
  const isClinicUser=currentUser&&currentUser.role==='clinic';
  const isAdminOrTech=!isClinicUser&&(!currentUser||currentUser.role==='admin'||currentUser.role==='tech'||currentUser.role==='technician');
  const clinicTabs=isAdminOrTech
    ? CLINICS.map(cl=>`<button class="pc-clinic-tab ${cl.id===clinicId?'on':''}" data-clinic-id="${cl.id}">${cl.name}</button>`).join('')
    : '';

  root.innerHTML=`<div class="pc-shell">
    <div class="pc-topbar">
      <div class="pc-logo">${clinic.name.slice(0,2)}</div>
      <div>
        <div class="pc-clinic-name">${clinic.name}</div>
        <div class="pc-clinic-sub">Portalul clinicii · ${active.length} lucrări active</div>
      </div>
      <div class="spacer"></div>
      <a href="${termsPageUrl(clinicId)}" class="btn">Termenii laboratorului</a>
      ${currentUser&&(currentUser.role==='admin'||currentUser.role==='technician'||currentUser.role==='tech')?'<a href="index.html" class="btn">Vezi panoul echipei</a>':''}
      <button class="btn primary" id="newCaseBtnClinic">+ Caz nou</button>
      <button class="btn" id="clinicLogoutBtn" style="color:#A32D2D;border-color:#A32D2D">Deconectare</button>
    </div>
    <div class="pc-quick-row">
      <a class="pc-quick-card" href="${termsPageUrl(clinicId)}"><b>Termenii laboratorului</b><span>Consultați timpii de execuție înainte de a seta data finală.</span></a>
    </div>
    <div class="pc-clinic-tabs-row">${clinicTabs}</div>
    <div class="pc-stats">
      <div class="pc-stat"><div class="pc-stat-num">${active.length}</div><div class="pc-stat-lbl">Active</div></div>
      <div class="pc-stat"><div class="pc-stat-num proba">${proba.length}</div><div class="pc-stat-lbl">La probă</div></div>
      <div class="pc-stat"><div class="pc-stat-num ready">${ready.length}</div><div class="pc-stat-lbl">Gata de ridicat</div></div>
      <div class="pc-stat"><div class="pc-stat-num ${late.length?'late':''}">${late.length}</div><div class="pc-stat-lbl">În întârziere</div></div>
    </div>
    <div class="pc-table">
      <div class="pc-row-grid head">
        <div>Caz</div><div>Pacient</div><div>Tip lucrare</div><div>Etapă</div><div>Finală</div><div></div>
      </div>
      ${cases.map(c=>{
        const a=ra(c);
        const pct=c.notStarted?0:progressPct(c.stage);
        const stageName=publicStageName(c);
        return `<div class="pc-row-grid" data-case-id="${c.id}">
          <div class="tbl-num">#${c.id}</div>
          <div class="tbl-name">${c.name}</div>
          <div><span class="tag">${c.type}</span></div>
          <div class="pc-progress-cell">
            <div class="pc-progress-bar"><div class="pc-progress-fill" style="width:${pct}%"></div></div>
            <span class="pc-progress-label">${stageName}</span>
          </div>
          <div class="tbl-due-bold ${c.late||labDeadlineStatus(c).urgent?'late':''}">${c.late?'restant':c.finala}</div>
          <div><button class="pc-action ${a.cls}" data-action="${a.action}" data-case-id="${c.id}">${a.label}</button></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  document.getElementById('newCaseBtnClinic')?.addEventListener('click',()=>openNewCaseModal(clinicId));
  document.querySelectorAll('.pc-row-grid[data-case-id]').forEach(r=>{
    r.addEventListener('click',e=>{
      if(e.target.tagName==='BUTTON')return;
      location.href=`case.html?id=${r.dataset.caseId}`;
    });
  });
  document.querySelectorAll('.pc-action[data-action]').forEach(b=>{
    b.addEventListener('click',e=>{
      e.stopPropagation();
      handleClinicAction(b.dataset.action,Number(b.dataset.caseId));
    });
  });
  document.querySelectorAll('.pc-clinic-tab[data-clinic-id]').forEach(t=>{
    t.addEventListener('click',()=>{location.href=`clinic.html?id=${t.dataset.clinicId}`});
  });
  document.getElementById('clinicLogoutBtn')?.addEventListener('click',()=>sbSignOut&&sbSignOut());
}

function handleClinicAction(action,caseId){
  const c=getCase(caseId);if(!c)return;
  if(action==='approve'){
    c.stage='terminat';
    overrides.stages=overrides.stages||{};overrides.stages[c.id]='terminat';saveOverrides(overrides);_syncCase(c);
    alert('Probă aprobată — lucrarea a trecut la finalizare');renderClinic();
  } else if(action==='pickup'){
    c.stage='trimis';c.sentDate=fmtShortDate(todayLabDate());
    overrides.stages=overrides.stages||{};overrides.stages[c.id]='trimis';saveOverrides(overrides);_syncCase(c);
    alert('Ridicare confirmată — lucrarea a fost arhivată');renderClinic();
  } else if(action==='note'){
    function _parseNotes(raw){if(!raw)return[];try{const p=JSON.parse(raw);return Array.isArray(p)?p:[{text:raw,author:'—',initials:'—',ts:0}]}catch{return raw.trim()?[{text:raw,author:'—',initials:'—',ts:0}]:[]}}
    openModal(`<div class="modal-head"><div class="modal-title">Notă · ${escHTML(c.name)}</div><button class="modal-close" type="button">×</button></div>
      <div class="modal-body">
        <div class="note-list" id="clinicNoteList" style="margin-bottom:14px;max-height:200px;overflow-y:auto">${_parseNotes(c.notes).slice().reverse().map(n=>`<div class="note-item"><div class="note-author">${escHTML(n.initials||'?')}</div><div style="flex:1"><div class="note-meta"><b>${escHTML(n.author||'—')}</b>${n.ts?' · '+new Date(n.ts).toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',''):''}</div><div class="note-text">${escHTML(n.text)}</div></div></div>`).join('')||'<div style="color:var(--text-dim);font-size:12px">Nicio notă.</div>'}
        </div>
        <div class="field"><label>Notă nouă</label><textarea id="clinicNoteInput" rows="3" placeholder="Scrie o notă..."></textarea></div>
      </div>
      <div class="modal-foot"><button class="btn modal-close" type="button">Anulează</button><button class="btn primary" id="clinicNoteSave" type="button">Trimite</button></div>`);
    document.getElementById('clinicNoteSave')?.addEventListener('click',()=>{
      const txt=document.getElementById('clinicNoteInput')?.value.trim();if(!txt)return;
      const user=getCurrentUser()||{name:'Clinică',initials:'CL'};
      const notes=_parseNotes(c.notes);
      notes.push({text:txt,author:user.name,initials:user.initials,ts:Date.now()});
      c.notes=JSON.stringify(notes);
      overrides.edits=overrides.edits||{};overrides.edits[c.id]={...overrides.edits[c.id],notes:c.notes};
      saveOverrides(overrides);_syncCase(c);closeModal();
    });
  }
}

// === CASE DETAIL ===
function renderCaseDetail(){
  const root=document.getElementById('caseShell');if(!root)return;
  const id=new URLSearchParams(location.search).get('id');const c=getCase(id);
  if(!c){root.innerHTML='<p>Caz inexistent. <a href="index.html">Înapoi</a></p>';return}
  const clinic=getClinic(c.clinic);const stage=getStage(c.stage)||STAGES[0];
  const stages=getEtapeLabStages(c.type);
  const upper=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tcell=n=>{const t=(c.teeth||[]).find(x=>x.n===n);return `<div class="t-display ${t?t.type:''}">${n}</div>`};
  const trow=arr=>arr.slice(0,8).map(tcell).join('')+'<div class="tc-divider-form"></div>'+arr.slice(8).map(tcell).join('');
  const byType={};(c.teeth||[]).forEach(t=>{(byType[t.type]=byType[t.type]||[]).push(t.n)});
  const labels={crown:'Coroană',implant:'Pe implant',emax:'Emax',veneer:'Fațetă'};
  const deadlineUrgent=labDeadlineStatus(c).urgent;
  const stageLabel=publicStageName(c);
  root.innerHTML=`<div class="case-shell"><div class="cd-topbar"><a href="index.html" class="cd-back">← Pipeline</a><div class="spacer"></div><div class="case-actions"><button class="btn primary" id="caseActionsBtn" type="button">Acțiuni ▾</button><div class="case-actions-menu" id="caseActionsMenu"><button type="button" data-case-action="edit">Editare rapidă</button><button type="button" data-case-action="advance">Marchează etapă completă</button><button type="button" data-case-action="move">Mută la etapă...</button><button type="button" data-case-action="view-pdf">Fișă PDF — Vizualizează</button><button type="button" data-case-action="pdf">Fișă PDF — Descarcă</button><button type="button" data-case-action="attach">Atașează fișiere</button><button type="button" data-case-action="delete" class="danger">Șterge cazul</button></div></div><input id="caseFileInput" type="file" multiple hidden></div><div class="cd-head"><div class="cd-clinic-line">${clinic.name} · Caz #${c.id}</div><h1 class="cd-title">${c.name}</h1><div class="cd-doctor">Medic: ${c.doctor||clinic.doctor}</div></div><div class="cd-grid"><div class="cd-main"><div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Detalii caz</span></div><div class="cd-section-body"><div class="cd-kv-grid"><div><div class="cd-kv-label">Tip</div><div class="cd-kv-val"><span class="tag">${c.type}</span></div></div><div><div class="cd-kv-label">Culoare</div><div class="cd-kv-val">${c.color||'—'}</div></div><div><div class="cd-kv-label">Etapă</div><div class="cd-kv-val">${stageLabel}</div></div><div><div class="cd-kv-label">Intrată</div><div class="cd-kv-val">${c.intrata}</div></div><div><div class="cd-kv-label">Probă</div><div class="cd-kv-val bold-date">${c.probaDate||'—'}</div></div><div><div class="cd-kv-label">Finală</div><div class="cd-kv-val bold-date ${c.late||deadlineUrgent?'late':''}">${c.finala}</div></div><div><div class="cd-kv-label">Implant</div><div class="cd-kv-val">${c.implantType||'—'}</div></div><div><div class="cd-kv-label">Amprentă</div><div class="cd-kv-val">${c.amprentaType||'—'}</div></div><div><div class="cd-kv-label">Prioritate</div><div class="cd-kv-val">${c.priority}</div></div></div></div></div>${(c.teeth&&c.teeth.length)?`<div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Schema dentară (FDI)</span><span class="cd-section-action">${c.teeth.length} dinți</span></div><div class="cd-section-body"><div class="tc-display-wrap"><div class="tc-display-row">${trow(upper)}</div><div class="tc-display-row">${trow(lower)}</div></div><div class="tc-summary" style="margin-top:10px">${Object.entries(byType).map(([t,n])=>`<div class="tc-summary-line"><span class="tc-sum-mini ${t}"></span><span>${labels[t]}:</span><b>${n.join(', ')}</b></div>`).join('')}</div></div></div>`:''}<div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Fișă de laborator</span></div><div class="fisa-attached"><div class="fisa-icon-pdf">PDF</div><div style="flex:1"><div class="fisa-fname">fisa-${c.id}.pdf</div><div class="fisa-fmeta">A4 · model color</div></div><button class="btn primary" id="dlFisaBtn">Descarcă</button></div></div><div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Note & activitate</span></div><div class="cd-section-body"><textarea class="note-form-input" id="noteInput" placeholder="Adaugă o notă..."></textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn primary" id="addNoteBtn">Trimite</button></div><div class="note-list" id="noteList"></div></div></div></div><aside class="cd-aside"><div class="aside-section"><h3 class="aside-title">Etape lab</h3><div class="tl-list">${stages.map(sId=>{const s=getStage(sId);const st=c.stageStatuses?.[sId]||'neincepute';const cls=st==='finalizat'?'done':(st==='in_lucru'||st==='la_proba')?'now':'';const t=getEmployee(c.assignees?.[sId]);const m=st==='finalizat'?'finalizat':st==='in_lucru'?'în lucru':st==='la_proba'?'la probă':'în așteptare';return `<div class="tl-item ${cls}"><span class="tl-marker ${cls}"></span><div><div class="tl-name">${s.name}</div><div class="tl-meta">${t?`<span class="tl-tech ${t.id}">${t.initials}</span>`:''}${m}</div></div></div>`}).join('')}</div></div><div class="aside-section"><h3 class="aside-title">Fișiere atașate</h3><div class="file-list" id="caseFileList">${renderAttachedFiles(c)}</div><button class="btn" id="attachCaseFileBtn" style="margin-top:10px;width:100%">+ Atașează fișier</button><div class="file-storage-note">Fișierele merg direct în folderul clinicii pe Zoho WorkDrive.</div></div></aside></div></div>`;
  document.getElementById('dlFisaBtn')?.addEventListener('click',()=>generateFisaPDF(c));
  const advance=()=>{
    const next=nextStage(c.stage,c.type);if(next===c.stage){alert('Etapă finală deja');return}
    c.stage=next;overrides.stages=overrides.stages||{};overrides.stages[c.id]=next;saveOverrides(overrides);_syncCase(c);renderCaseDetail();
  };
  const input=document.getElementById('caseFileInput');
  const attach=()=>input?.click();
  input?.addEventListener('change',async()=>{await storeCaseFiles(c.id,input.files);renderCaseDetail()});
  document.getElementById('attachCaseFileBtn')?.addEventListener('click',attach);
  document.getElementById('caseActionsBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('caseActionsMenu')?.classList.toggle('open')});
  document.querySelectorAll('[data-case-action]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();document.getElementById('caseActionsMenu')?.classList.remove('open');
    if(b.dataset.caseAction==='edit')openQuickEdit(c.id);
    if(b.dataset.caseAction==='advance')advance();
    if(b.dataset.caseAction==='view-pdf')previewFisaPDF(c);
    if(b.dataset.caseAction==='pdf')generateFisaPDF(c);
    if(b.dataset.caseAction==='attach')attach();
    if(b.dataset.caseAction==='move'){
      const stageOpts=PIPELINE_STAGES.map(s=>{const st=getStage(s);return`<option value="${s}"${c.stage===s?' selected':''}>${st?.name||s}</option>`}).join('');
      openModal(`<div class="modal-head"><div class="modal-title">Mută cazul · ${c.name}</div><button class="modal-close" type="button">×</button></div><div class="modal-body"><div class="field"><label>Etapă nouă</label><select id="moveStageSelect">${stageOpts}</select></div></div><div class="modal-foot"><button class="btn modal-close">Anulează</button><button class="btn primary" id="moveSaveBtn">Mută</button></div>`);
      document.getElementById('moveSaveBtn')?.addEventListener('click',()=>{moveCaseToStage(c.id,document.getElementById('moveStageSelect').value);closeModal();renderCaseDetail()});
    }
    if(b.dataset.caseAction==='delete')deleteCase(c.id);
  }));
  if(window.caseActionsCloseHandler)document.removeEventListener('click',window.caseActionsCloseHandler);
  window.caseActionsCloseHandler=e=>{if(!e.target.closest('.case-actions'))document.getElementById('caseActionsMenu')?.classList.remove('open')};
  document.addEventListener('click',window.caseActionsCloseHandler);
  // Render existing notes from c.notes (stored as JSON array)
  function parseNotes(raw){
    if(!raw)return[];
    try{const p=JSON.parse(raw);return Array.isArray(p)?p:[{text:raw,author:'—',initials:'—',ts:0}]}
    catch{return raw.trim()?[{text:raw,author:'—',initials:'—',ts:0}]:[]}
  }
  function renderNoteList(){
    const list=document.getElementById('noteList');if(!list)return;
    const notes=parseNotes(c.notes);
    if(!notes.length){list.innerHTML='<div style="color:var(--text-dim);font-size:12px;padding:8px 0">Nicio notă adăugată.</div>';return}
    list.innerHTML=notes.slice().reverse().map(n=>`<div class="note-item"><div class="note-author">${escHTML(n.initials||'?')}</div><div style="flex:1"><div class="note-meta"><b>${escHTML(n.author||'—')}</b>${n.ts?' · '+new Date(n.ts).toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',''):''}</div><div class="note-text">${escHTML(n.text)}</div></div></div>`).join('');
  }
  renderNoteList();
  document.getElementById('addNoteBtn')?.addEventListener('click',()=>{
    const ta=document.getElementById('noteInput');const txt=ta.value.trim();if(!txt)return;
    const user=getCurrentUser()||{name:'Utilizator',initials:'?'};
    const notes=parseNotes(c.notes);
    notes.push({text:txt,author:user.name,initials:user.initials,ts:Date.now()});
    c.notes=JSON.stringify(notes);
    overrides.edits=overrides.edits||{};overrides.edits[c.id]={...overrides.edits[c.id],notes:c.notes};
    saveOverrides(overrides);_syncCase(c);
    ta.value='';renderNoteList();
  });
}

// === CALENDAR ===
const MONTH_NAMES_RO=['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const calToday=todayLabDate();
let calMonth=calToday.getMonth(),calYear=calToday.getFullYear(),calClinicFilter='all';
function renderCalendar(){
  const root=document.getElementById('calShell');if(!root)return;
  const today=todayLabDate();
  const firstDay=new Date(calYear,calMonth,1);
  const startWk=(firstDay.getDay()+6)%7;
  const days=new Date(calYear,calMonth+1,0).getDate();
  const cells=Math.ceil((startWk+days)/7)*7;
  const filt=c=>calClinicFilter==='all'||c.clinic===calClinicFilter;
  const byDate={};
  CASES.filter(filt).forEach(c=>{const d=parseShortDate(c.finala);if(d){const k=d.toDateString();(byDate[k]=byDate[k]||[]).push(c)}});
  const cnt={all:CASES.filter(filt).length};
  CLINICS.forEach(cl=>cnt[cl.id]=casesForClinic(cl.id).length);

  let h=`<div class="cal-shell"><div class="cal-topbar"><button class="cal-nav-btn" id="calPrev">‹</button><div class="cal-month-title">${MONTH_NAMES_RO[calMonth]} ${calYear}</div><button class="cal-nav-btn" id="calNext">›</button><button class="cal-today-btn" id="calToday">Astăzi</button><div class="spacer"></div><a href="index.html" class="btn">Lucrări</a></div><div class="cal-clinic-tabs"><button class="cal-clinic-tab ${calClinicFilter==='all'?'on':''}" data-clinic="all">Toate <span class="cal-clinic-count">${cnt.all}</span></button>${CLINICS.map(cl=>`<button class="cal-clinic-tab ${calClinicFilter===cl.id?'on':''}" data-clinic="${cl.id}">${cl.name} <span class="cal-clinic-count">${cnt[cl.id]}</span></button>`).join('')}</div><div class="cal-weekdays">${['Luni','Marți','Mie','Joi','Vin','Sâmb','Dum'].map(d=>`<div class="cal-weekday">${d}</div>`).join('')}</div><div class="cal-grid">`;

  for(let i=0;i<cells;i++){
    const dn=i-startWk+1;
    const d=new Date(calYear,calMonth,dn);
    const out=dn<1||dn>days;
    const td=d.toDateString()===today.toDateString();
    const we=i%7>=5;
    let cls='';if(out)cls+=' outside';if(td)cls+=' today';if(we)cls+=' weekend';
    const dc=byDate[d.toDateString()]||[];
    h+=`<div class="cal-day${cls}"><div class="cal-day-num">${d.getDate()}${td?' <span class="cal-today-pill">azi</span>':''}</div><div class="cal-day-cases">${dc.slice(0,3).map(c=>{const s=getCalendarStatus(c);return `<a href="case.html?id=${c.id}" class="cal-case-pill ${s}" title="${c.name}">${c.name.split(' ')[0]} · ${getClinic(c.clinic).name.slice(0,4)}</a>`}).join('')}${dc.length>3?`<div class="cal-day-more" data-day="${d.toDateString()}" style="cursor:pointer;color:var(--info);font-weight:500">+${dc.length-3} alte — vezi toate</div>`:''}</div></div>`;
  }

  h+=`</div><div class="cal-legend-row"><div class="cal-legend-item"><span class="cal-legend-swatch neincepute"></span>Neincepute</div><div class="cal-legend-item"><span class="cal-legend-swatch proces"></span>În proces</div><div class="cal-legend-item"><span class="cal-legend-swatch terminat"></span>Terminat</div></div></div>`;
  root.innerHTML=h;

  document.getElementById('calPrev')?.addEventListener('click',()=>{if(calMonth===0){calMonth=11;calYear--}else calMonth--;renderCalendar()});
  document.getElementById('calNext')?.addEventListener('click',()=>{if(calMonth===11){calMonth=0;calYear++}else calMonth++;renderCalendar()});
  document.getElementById('calToday')?.addEventListener('click',()=>{const d=todayLabDate();calMonth=d.getMonth();calYear=d.getFullYear();renderCalendar()});
  document.querySelectorAll('.cal-clinic-tab').forEach(t=>t.addEventListener('click',()=>{calClinicFilter=t.dataset.clinic;renderCalendar()}));

  document.querySelectorAll('.cal-day-more[data-day]').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      const day=el.dataset.day;
      const cs=byDate[day]||[];
      const date=new Date(day);
      const html=`<div class="modal-head"><div class="modal-title">${date.getDate()} ${MONTH_NAMES_RO[date.getMonth()]} ${date.getFullYear()} — ${cs.length} lucrări</div><button class="modal-close" type="button">×</button></div><div class="modal-body" style="max-height:60vh;overflow-y:auto">${cs.map(c=>{const s=getCalendarStatus(c);const cl=getClinic(c.clinic);return `<a href="case.html?id=${c.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;border:0.5px solid var(--border);margin-bottom:6px;text-decoration:none;color:var(--text)" class="cal-case-pill ${s}"><div style="flex:1"><div style="font-weight:500;font-size:13px">${c.name}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${cl.name} · ${c.type}</div></div><div style="font-size:11px;color:var(--text-secondary)">${c.late?'restant':c.finala}</div></a>`}).join('')}</div>`;
      openModal(html);
    });
  });
}

// === TECHNICIAN PORTAL ===
function renderTechnicianPortal(){
  const root=document.getElementById('techShell');if(!root)return;
  let user=getCurrentUser();
  if(!user||!(user.role==='tech'||user.role==='technician')){user={id:'mt',name:'Maria T.',initials:'MT',role:'tech'};setCurrentUser(user)}
  const myStage=techStage(user.id);
  const stage=getStage(myStage);
  const stageName=stage.name;
  const myActive=CASES.filter(c=>c.assignees?.[myStage]===user.id&&['in_lucru','la_proba'].includes(c.stageStatuses?.[myStage]));
  const claimable=CASES.filter(c=>{
    const ms=getEtapeLabStages(c.type);
    if(!ms.includes(myStage))return false;
    const status=c.stageStatuses?.[myStage]||'neincepute';
    if(status!=='neincepute')return false;
    const my=ms.indexOf(myStage);
    if(my>0){const prev=ms[my-1];if(c.stageStatuses?.[prev]!=='finalizat')return false}
    return true;
  });
  const completed=CASES.filter(c=>c.stageStatuses?.[myStage]==='finalizat'&&c.assignees?.[myStage]===user.id);
  const lateCount=myActive.filter(c=>c.late).length;
  const stageColors={design:'#85B7EB',cam:'#444441',prelucrare:'#854F0B',ceramica:'#EF9F27'};
  root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item active" href="tehnician.html"><span class="nav-icon round"></span>Acasă</a><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><div class="nav-section">Setări</div><a class="nav-item" href="login.html"><span class="nav-icon round"></span>Schimbă rol</a></aside><main class="main"><div class="tp-shell"><div class="tp-topbar"><div class="tp-tech-av" style="background:${stageColors[myStage]||'#1D9E75'}">${user.initials}</div><div><div class="tp-tech-name">${user.name}</div><div class="tp-tech-role">Tehnician ${stageName.toLowerCase()}</div></div><div class="spacer"></div><a href="login.html" class="btn">Schimbă rol</a></div><div class="tp-greet"><h1 class="tp-greet-title">Bună, ${user.name.split(' ')[0]}</h1><div class="tp-greet-sub">${myActive.length} lucrări în curs · ${claimable.length} de revendicat</div></div><div class="tp-stats"><div class="tp-stat"><div class="tp-stat-num warn">${myActive.length}</div><div class="tp-stat-lbl">În lucru</div></div><div class="tp-stat"><div class="tp-stat-num">${claimable.length}</div><div class="tp-stat-lbl">De revendicat</div></div><div class="tp-stat"><div class="tp-stat-num good">${completed.length}</div><div class="tp-stat-lbl">Finalizate</div></div><div class="tp-stat"><div class="tp-stat-num late">${lateCount}</div><div class="tp-stat-lbl">În întârziere</div></div></div><div class="tp-section"><div class="tp-section-head"><span class="tp-section-title">În lucru la tine</span><span class="tp-section-count">${myActive.length} lucrări</span></div>${myActive.length?myActive.map(c=>{const cl=getClinic(c.clinic);const st=c.stageStatuses?.[myStage];const deadlineUrgent=labDeadlineStatus(c).urgent;return `<div class="tp-task-card ${c.late||deadlineUrgent?'late':c.warn?'warn':''}" data-case-id="${c.id}"><div class="tp-task-stage-icon" style="background:${stageColors[myStage]}">${stageName[0]}</div><div class="tp-task-meta"><div class="tp-task-name">${c.name} · ${cl.name}</div><div class="tp-task-info"><b>${c.type}</b>${c.color?' · culoare '+c.color:''}</div></div><div class="tp-task-due"><div class="tp-task-due-bold ${c.late||deadlineUrgent?'late':''}">${c.late?'restant':c.finala}</div><div>finală</div></div><span class="tp-task-status ${st==='la_proba'?'la-proba':'in-lucru'}">${st==='la_proba'?'La probă':'În lucru'}</span><div class="tp-task-actions">${st==='in_lucru'?`<button class="tp-task-btn" data-action="proba" data-case-id="${c.id}" data-stage="${myStage}">La probă</button>`:''}<button class="tp-task-btn primary" data-action="finalize" data-case-id="${c.id}" data-stage="${myStage}">Finalizează</button></div></div>`}).join(''):'<div style="color:var(--text-dim);padding:14px;text-align:center;font-style:italic">Nicio lucrare activă</div>'}</div><div class="tp-section"><div class="tp-section-head"><span class="tp-section-title">Așteaptă să fie revendicate</span><span class="tp-section-count">${claimable.length} lucrări</span></div>${claimable.length?claimable.map(c=>{const cl=getClinic(c.clinic);const deadlineUrgent=labDeadlineStatus(c).urgent;return `<div class="tp-task-card tp-claimable ${c.late||deadlineUrgent?'late':''}" data-case-id="${c.id}"><div class="tp-task-stage-icon" style="background:${stageColors[myStage]}">${stageName[0]}</div><div class="tp-task-meta"><div class="tp-task-name">${c.name} · ${cl.name}</div><div class="tp-task-info"><b>${c.type}</b>${c.color?' · culoare '+c.color:''}</div></div><div class="tp-task-due"><div class="tp-task-due-bold ${c.late||deadlineUrgent?'late':''}">${c.late?'restant':c.finala}</div><div>finală</div></div><div class="tp-task-actions"><button class="tp-task-btn primary" data-action="claim" data-case-id="${c.id}" data-stage="${myStage}">Pun în proces</button></div></div>`}).join(''):'<div style="color:var(--text-dim);padding:14px;text-align:center;font-style:italic">Nicio lucrare de revendicat</div>'}</div></div></main></div>`;
  document.querySelectorAll('.tp-task-card[data-case-id]').forEach(card=>{
    card.addEventListener('click',e=>{if(e.target.tagName==='BUTTON')return;location.href=`case.html?id=${card.dataset.caseId}`});
  });
  document.querySelectorAll('.tp-task-btn[data-action]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const id=Number(btn.dataset.caseId),sid=btn.dataset.stage,act=btn.dataset.action;
      const c=getCase(id);if(!c)return;
      c.stageStatuses=c.stageStatuses||{};c.assignees=c.assignees||{};
      if(act==='claim'){c.stageStatuses[sid]='in_lucru';c.assignees[sid]=user.id;c.notStarted=false;if(!c.assignee)c.assignee=user.id}
      else if(act==='proba'){c.stageStatuses[sid]='la_proba'}
      else if(act==='finalize')completeLabStage(c,sid)
      overrides.edits=overrides.edits||{};overrides.edits[c.id]=overrides.edits[c.id]||{};
      Object.assign(overrides.edits[c.id],{stageStatuses:c.stageStatuses,assignees:c.assignees,stage:c.stage,notStarted:c.notStarted,assignee:c.assignee});
      saveOverrides(overrides);_syncCase(c);renderTechnicianPortal();
    });
  });
}

// === ARCHIVE ===
let archiveFilter={year:'2026',month:'all',clinic:'all',tech:'all',type:'all',q:''};
function renderArchive(){
  const root=document.getElementById('archiveShell');if(!root)return;
  let trimise=CASES.filter(c=>c.stage==='trimis');
  if(archiveFilter.clinic!=='all')trimise=trimise.filter(c=>c.clinic===archiveFilter.clinic);
  if(archiveFilter.tech!=='all')trimise=trimise.filter(c=>c.finalTech===archiveFilter.tech||c.assignee===archiveFilter.tech);
  if(archiveFilter.type!=='all')trimise=trimise.filter(c=>c.type===archiveFilter.type);
  if(archiveFilter.q){const q=archiveFilter.q.toLowerCase();trimise=trimise.filter(c=>c.name.toLowerCase().includes(q)||String(c.id).includes(q))}
  if(archiveFilter.month!=='all')trimise=trimise.filter(c=>{const d=parseShortDate(c.sentDate||c.finala);return d&&d.getMonth()===Number(archiveFilter.month)});
  const total=trimise.length;
  const avgDays=total?Math.round(trimise.reduce((s,c)=>s+(c.durationDays||5),0)/total*10)/10:0;
  const onTime=total?Math.round(trimise.filter(c=>!c.late).length/total*100):100;
  const clCounts={};trimise.forEach(c=>{clCounts[c.clinic]=(clCounts[c.clinic]||0)+1});
  const topCl=Object.entries(clCounts).sort((a,b)=>b[1]-a[1])[0];
  const groups={};trimise.forEach(c=>{const d=parseShortDate(c.sentDate||c.finala);const k=d?`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`:'unknown';(groups[k]=groups[k]||[]).push(c)});
  const sortedKeys=Object.keys(groups).sort((a,b)=>b.localeCompare(a));
  let h=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item active" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><a class="nav-item" href="stats.html"><span class="nav-icon"></span>Statistici</a><div class="nav-section">Date</div><a class="nav-item" href="clinici.html"><span class="nav-icon round"></span>Clinici</a><a class="nav-item" href="echipa.html"><span class="nav-icon round"></span>Echipa</a></aside><main class="main" style="padding:0"><div class="ar-shell"><div class="ar-topbar"><div><div class="ar-title">Arhivă lucrări</div><div class="ar-subtitle">${total} lucrări trimise · istoric filtrabil</div></div><div class="spacer"></div><button class="ar-btn" id="arExport">Export CSV</button></div><div class="ar-kpis"><div class="ar-kpi"><div class="ar-kpi-num">${total}</div><div class="ar-kpi-lbl">Lucrări trimise</div></div><div class="ar-kpi"><div class="ar-kpi-num">${avgDays} zile</div><div class="ar-kpi-lbl">Timp mediu</div></div><div class="ar-kpi"><div class="ar-kpi-num">${onTime}%</div><div class="ar-kpi-lbl">La timp</div></div><div class="ar-kpi"><div class="ar-kpi-num">${topCl?getClinic(topCl[0]).name:'—'}</div><div class="ar-kpi-lbl">Clinică top</div><div class="ar-kpi-sub">${topCl?topCl[1]+' lucrări':''}</div></div></div><div class="ar-filters"><div class="ar-filter"><label class="ar-filter-label">Caută pacient</label><input class="ar-input" id="arQ" value="${archiveFilter.q}" placeholder="Nume pacient sau caz #"></div><div class="ar-filter"><label class="ar-filter-label">An</label><select class="ar-select" id="arY"><option value="2026" ${archiveFilter.year==='2026'?'selected':''}>2026</option><option value="2025">2025</option></select></div><div class="ar-filter"><label class="ar-filter-label">Lună</label><select class="ar-select" id="arM"><option value="all">Toate</option>${MONTH_NAMES_RO.map((m,i)=>`<option value="${i}" ${archiveFilter.month===String(i)?'selected':''}>${m}</option>`).join('')}</select></div><div class="ar-filter"><label class="ar-filter-label">Clinică</label><select class="ar-select" id="arC"><option value="all">Toate</option>${CLINICS.map(cl=>`<option value="${cl.id}" ${archiveFilter.clinic===cl.id?'selected':''}>${cl.name}</option>`).join('')}</select></div><div class="ar-filter"><label class="ar-filter-label">Tehnician</label><select class="ar-select" id="arT"><option value="all">Toți</option>${EMPLOYEES.map(e=>`<option value="${e.id}" ${archiveFilter.tech===e.id?'selected':''}>${e.name}</option>`).join('')}</select></div></div>`;
  if(!sortedKeys.length){h+='<div style="padding:60px;text-align:center;color:var(--text-dim)">Nicio lucrare trimisă în filtrul curent.</div>'}
  sortedKeys.forEach(k=>{
    const cs=groups[k];
    let lbl='Necunoscută';
    if(k!=='unknown'){const[y,m]=k.split('-').map(Number);lbl=`${MONTH_NAMES_RO[m]} ${y}`}
    h+=`<div class="ar-month-section">${lbl} · ${cs.length} lucrări</div><div class="ar-tbl-wrap"><table class="ar-tbl"><thead><tr><th>#</th><th>Pacient</th><th>Clinică</th><th>Tip</th><th>Tehnician</th><th>Intrată</th><th>Trimis</th><th>Durată</th><th>Acțiuni</th></tr></thead><tbody>${cs.map(c=>{const t=getEmployee(c.finalTech||c.assignee);return `<tr data-case-id="${c.id}"><td><span class="tbl-num">#${c.id}</span></td><td><span class="tbl-name">${c.name}</span></td><td><span class="tbl-clinic">${getClinic(c.clinic).name}</span></td><td><span class="tag">${c.type}</span></td><td>${t?`<span class="ar-tech-av-mini"><span class="ar-tech-av-circle-mini ${t.id}">${t.initials}</span>${t.name}</span>`:'—'}</td><td><span class="tbl-due">${c.intrata}</span></td><td><span class="tbl-due-bold">${c.sentDate||c.finala}</span></td><td><span class="tbl-due">${c.durationDays||'—'} zile</span></td><td><button class="ar-action-icon" data-pdf="${c.id}">PDF</button> <button class="ar-action-icon" data-view="${c.id}">Vezi</button></td></tr>`}).join('')}</tbody></table></div>`;
  });
  h+=`</div></main></div>`;
  root.innerHTML=h;
  ['arQ','arY','arM','arC','arT'].forEach(id=>{document.getElementById(id)?.addEventListener('change',()=>{archiveFilter.q=document.getElementById('arQ').value;archiveFilter.year=document.getElementById('arY').value;archiveFilter.month=document.getElementById('arM').value;archiveFilter.clinic=document.getElementById('arC').value;archiveFilter.tech=document.getElementById('arT').value;renderArchive()})});
  document.getElementById('arQ')?.addEventListener('input',e=>{archiveFilter.q=e.target.value;renderArchive()});
  document.querySelectorAll('[data-pdf]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const c=getCase(Number(b.dataset.pdf));if(c)generateFisaPDF(c)}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();location.href=`case.html?id=${b.dataset.view}`}));
  document.querySelectorAll('.ar-tbl tbody tr').forEach(r=>r.addEventListener('click',e=>{if(e.target.tagName==='BUTTON')return;location.href=`case.html?id=${r.dataset.caseId}`}));
  document.getElementById('arExport')?.addEventListener('click',()=>{if(typeof exportCSV==='function')exportCSV()});
}

// === ECHIPA ===
function renderEchipa(){
  const root=document.getElementById('echipaShell');if(!root)return;
  const stats={};EMPLOYEES.forEach(e=>{stats[e.id]={active:0,done:0,late:0}});
  CASES.forEach(c=>Object.entries(c.assignees||{}).forEach(([s,t])=>{
    if(!stats[t])return;
    const st=c.stageStatuses?.[s];
    if(st==='finalizat')stats[t].done++;
    else if(st==='in_lucru'||st==='la_proba'){stats[t].active++;if(c.late)stats[t].late++}
  }));
  root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><a class="nav-item" href="stats.html"><span class="nav-icon"></span>Statistici</a><div class="nav-section">Date</div><a class="nav-item" href="clinici.html"><span class="nav-icon round"></span>Clinici</a><a class="nav-item active" href="echipa.html"><span class="nav-icon round"></span>Echipa</a></aside><main class="main"><div style="padding:24px;max-width:900px"><h1 style="font-size:22px;font-weight:500;margin:0 0 6px">Echipa</h1><div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">${EMPLOYEES.length} tehnicieni · ${CASES.filter(c=>c.stage!=='trimis').length} lucrări active</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">${EMPLOYEES.map(e=>{const st=stats[e.id];const stageColor={pc:'#D85A30',ik:'#185FA5',vc:'#534AB7',mt:'#1D9E75',an:'#444441'}[e.id];const role={pc:'Designer (CAD)',ik:'Tehnician CAM',vc:'Tehnician prelucrare',mt:'Tehnician ceramică',an:'Tehnician finisaj'}[e.id]||'Tehnician';return `<div style="background:var(--bg);border:0.5px solid var(--border);border-radius:8px;padding:16px;display:flex;align-items:center;gap:14px"><div style="width:44px;height:44px;border-radius:50%;background:${stageColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:14px;flex-shrink:0">${e.initials}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:500">${e.name}</div><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${role}</div></div><div style="display:flex;gap:14px;font-size:11px;text-align:center"><div><div style="font-size:18px;font-weight:500;color:#BA7517">${st.active}</div><div style="color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;font-size:9px">activ</div></div><div><div style="font-size:18px;font-weight:500;color:#1D9E75">${st.done}</div><div style="color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;font-size:9px">terminat</div></div>${st.late?`<div><div style="font-size:18px;font-weight:500;color:#A32D2D">${st.late}</div><div style="color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;font-size:9px">restant</div></div>`:''}</div></div>`}).join('')}</div></div></main></div>`;
}

// === STATS ===
function renderStats(){
  const root=document.getElementById('statsShell');if(!root)return;
  const onTime=statsOnTimeRate();
  const trimise=CASES.filter(c=>c.stage==='trimis').length;
  const active=CASES.length-trimise;
  root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><a class="nav-item active" href="stats.html"><span class="nav-icon"></span>Statistici</a><div class="nav-section">Date</div><a class="nav-item" href="clinici.html"><span class="nav-icon round"></span>Clinici</a><a class="nav-item" href="echipa.html"><span class="nav-icon round"></span>Echipa</a></aside><main class="main"><div style="padding:24px"><h1 style="font-size:22px;font-weight:500;margin:0 0 16px">Statistici</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px"><div style="background:var(--bg-soft);padding:16px;border-radius:8px"><div style="font-size:24px;font-weight:500">${CASES.length}</div><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">Total</div></div><div style="background:var(--bg-soft);padding:16px;border-radius:8px"><div style="font-size:24px;font-weight:500;color:${onTime.late?'#A32D2D':'#1D9E75'}">${onTime.rate}%</div><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">La timp</div></div><div style="background:var(--bg-soft);padding:16px;border-radius:8px"><div style="font-size:24px;font-weight:500">${active}</div><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">Active</div></div><div style="background:var(--bg-soft);padding:16px;border-radius:8px"><div style="font-size:24px;font-weight:500;color:#27500A">${trimise}</div><div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">Trimise</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:var(--bg);border:0.5px solid var(--border);border-radius:8px;padding:16px"><div style="font-size:13px;font-weight:500;margin-bottom:14px">Cazuri pe etapă</div><div style="position:relative;height:240px"><canvas id="chartStage"></canvas></div></div><div style="background:var(--bg);border:0.5px solid var(--border);border-radius:8px;padding:16px"><div style="font-size:13px;font-weight:500;margin-bottom:14px">Cazuri pe clinică</div><div style="position:relative;height:240px"><canvas id="chartClinic"></canvas></div></div><div style="background:var(--bg);border:0.5px solid var(--border);border-radius:8px;padding:16px"><div style="font-size:13px;font-weight:500;margin-bottom:14px">Pe tehnician</div><div style="position:relative;height:240px"><canvas id="chartTech"></canvas></div></div><div style="background:var(--bg);border:0.5px solid var(--border);border-radius:8px;padding:16px"><div style="font-size:13px;font-weight:500;margin-bottom:14px">La timp vs întârziere</div><div style="position:relative;height:240px"><canvas id="chartOnTime"></canvas></div></div></div></div></main></div>`;
  setTimeout(()=>{
    if(typeof Chart==='undefined')return;
    Chart.defaults.font.size=11;Chart.defaults.color='#6b7280';
    const sd=statsCountsByStage();
    new Chart(document.getElementById('chartStage'),{type:'bar',data:{labels:sd.map(s=>s.name),datasets:[{data:sd.map(s=>s.count),backgroundColor:sd.map(s=>s.color)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
    const cd=statsCountsByClinic();
    new Chart(document.getElementById('chartClinic'),{type:'bar',data:{labels:cd.map(c=>c.name),datasets:[{data:cd.map(c=>c.count),backgroundColor:'#1a1a1a'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}}}});
    const techCnt={};EMPLOYEES.forEach(e=>techCnt[e.id]=0);
    CASES.forEach(c=>{Object.values(c.assignees||{}).forEach(t=>{if(techCnt[t]!==undefined)techCnt[t]++})});
    new Chart(document.getElementById('chartTech'),{type:'bar',data:{labels:EMPLOYEES.map(e=>e.name),datasets:[{data:EMPLOYEES.map(e=>techCnt[e.id]),backgroundColor:['#D85A30','#185FA5','#534AB7','#444441','#1D9E75']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
    new Chart(document.getElementById('chartOnTime'),{type:'doughnut',data:{labels:['La timp','Întârziate'],datasets:[{data:[onTime.onTime,onTime.late],backgroundColor:['#1D9E75','#A32D2D'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%'}});
  },50);
}

// === CLINICI LIST ===
function renderClinici(){
  const root=document.getElementById('cliniciShell');if(!root)return;
  root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><a class="nav-item" href="stats.html"><span class="nav-icon"></span>Statistici</a><div class="nav-section">Date</div><a class="nav-item active" href="clinici.html"><span class="nav-icon round"></span>Clinici</a><a class="nav-item" href="echipa.html"><span class="nav-icon round"></span>Echipa</a></aside><main class="main"><div style="padding:24px;max-width:1100px"><h1 style="font-size:22px;font-weight:500;margin:0 0 6px">Clinici</h1><div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">${CLINICS.length} clinici · ${CASES.filter(c=>c.stage!=='trimis').length} lucrări active</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">${CLINICS.map(cl=>{const cases=casesForClinic(cl.id);const active=cases.filter(c=>c.stage!=='trimis').length;const late=cases.filter(c=>c.late).length;const ready=cases.filter(c=>c.stage==='terminat').length;const proba=cases.filter(c=>c.stage==='proba').length;return `<a href="clinic.html?id=${cl.id}" style="background:var(--bg);border:0.5px solid var(--border);border-radius:10px;padding:18px;text-decoration:none;color:var(--text);display:block"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><div style="width:42px;height:42px;border-radius:8px;background:var(--bg-soft);border:0.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--text-muted)">${cl.name.slice(0,2)}</div><div><div style="font-size:15px;font-weight:500">${cl.name}</div><div style="font-size:11px;color:var(--text-dim)">${cl.doctor}</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding-top:12px;border-top:0.5px solid var(--border)"><div><div style="font-size:18px;font-weight:500">${active}</div><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">Active</div></div><div><div style="font-size:18px;font-weight:500;color:#BA7517">${proba}</div><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">Probă</div></div><div><div style="font-size:18px;font-weight:500;color:#1D9E75">${ready}</div><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">Gata</div></div><div><div style="font-size:18px;font-weight:500;color:${late?'#A32D2D':'var(--text-dim)'}">${late}</div><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">Restant</div></div></div></a>`}).join('')}</div></div></main></div>`;
}

function adminSidebarHTML(active){
  const item=(href,label,key,round=false)=>`<a class="nav-item ${active===key?'active':''}" href="${href}"><span class="nav-icon ${round?'round':''}"></span>${label}</a>`;
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div>${item('index.html','Lucrări','lucrari')}${item('calendar.html','Calendar','calendar')}${item('arhiva.html','Arhivă','arhiva')}${item('stats.html','Statistici','stats')}<div class="nav-section">Date</div>${item('clinici.html','Clinici','clinici',true)}${item('echipa.html','Echipa','echipa',true)}${item('workdrive.html','WorkDrive','workdrive',true)}${item('termeni.html','Termeni','termeni',true)}</aside>`;
}

function termEditorHTML(){
  return `<div class="terms-editor">
    <div class="terms-editor-actions"><button class="btn" id="termAdd" type="button">+ Rând nou</button><button class="btn" id="termReset" type="button">Reset default</button><button class="btn primary" id="termSave" type="button">Salvează termeni</button></div>
    <div class="terms-editor-table-wrap"><table class="terms-editor-table"><thead><tr><th>Categorie</th><th>Serviciu</th><th>Timp execuție</th><th>Min. urgent</th><th></th></tr></thead><tbody>${LAB_TERMS.map((t,i)=>`<tr data-term-index="${i}"><td><input data-field="category" value="${escAttr(t.category)}"></td><td><input data-field="service" value="${escAttr(t.service)}"></td><td><input data-field="time" value="${escAttr(t.time)}"></td><td><input data-field="urgentMin" type="number" min="1" value="${escAttr(t.urgentMin||t.min)}"></td><td><button class="btn term-remove" type="button">Șterge</button></td></tr>`).join('')}</tbody></table></div>
    <div class="file-storage-note">Editările sunt folosite imediat de calculul de urgență și de pagina clinicilor.</div>
  </div>`;
}

function gatherTermEditorRows(){
  return Array.from(document.querySelectorAll('.terms-editor-table tbody tr')).map(tr=>{
    const old=LAB_TERMS[Number(tr.dataset.termIndex)]||{};
    const val=field=>tr.querySelector(`[data-field="${field}"]`)?.value.trim()||'';
    const category=val('category')||'ALTE TIPURI';
    const service=val('service')||'Serviciu nou';
    const min=Number(val('urgentMin'))||old.urgentMin||old.min||1;
    const inferred=inferTermMatch({category,service});
    const match=old.match&&old.match.length?[...new Set([...old.match,...inferred])]:inferred;
    return {category,service,time:val('time')||`${min} zile`,min:old.min||min,max:old.max||min,urgentMin:min,match};
  });
}

function renderTermeniPage(){
  const root=document.getElementById('termsShell');if(!root)return;
  const params=new URLSearchParams(location.search);
  const user=getCurrentUser()||{role:'admin'};
  const clinicId=params.get('clinic')||user.clinic||'crisdent';
  const clinic=getClinic(clinicId)||CLINICS[0];
  const clinicView=params.get('view')==='clinic'||user.role==='clinic';
  const canEdit=user.role==='admin'&&!clinicView;
  if(clinicView){
    root.innerHTML=`<div class="pc-shell terms-page"><div class="pc-topbar"><div class="pc-logo">${clinic.name.slice(0,2)}</div><div><div class="pc-clinic-name">Termenii laboratorului</div><div class="pc-clinic-sub">${clinic.name} · pagină informativă</div></div><div class="spacer"></div><a href="clinic.html?id=${clinic.id}" class="btn">Înapoi la clinică</a></div><div class="terms-page-body">${labTermsTableHTML(false)}</div></div>`;
    return;
  }
  root.innerHTML=`<div class="app">${adminSidebarHTML('termeni')}<main class="main"><div class="topbar"><div class="crumb">Date / <b>Termeni</b></div><div class="spacer"></div><a href="${termsPageUrl('crisdent')}" class="btn">Previzualizare clinică</a></div><section class="terms-page-body"><div class="terms-page-head"><div><div class="dash-eyebrow">Admin</div><h1 class="dash-title">Termenii laboratorului</h1></div><div class="file-storage-note">Clinicele văd aceeași listă în mod read-only.</div></div>${canEdit?termEditorHTML():labTermsTableHTML(false)}</section></main></div>`;
  document.getElementById('termAdd')?.addEventListener('click',()=>{const terms=gatherTermEditorRows();terms.push({category:'ALTE TIPURI',service:'Serviciu nou',time:'3 - 4 zile',min:3,max:4,urgentMin:3});saveLabTerms(terms);renderTermeniPage()});
  document.querySelectorAll('.term-remove').forEach(btn=>btn.addEventListener('click',()=>btn.closest('tr')?.remove()));
  document.getElementById('termReset')?.addEventListener('click',()=>{if(confirm('Resetăm termenii la lista inițială?')){resetLabTerms();renderTermeniPage()}});
  document.getElementById('termSave')?.addEventListener('click',()=>{saveLabTerms(gatherTermEditorRows());renderTermeniPage()});
}

// === MODAL + NEW CASE ===
function openModal(content, modalClass=''){
  const o=document.createElement('div');o.className='modal-overlay';
  o.innerHTML=`<div class="modal ${modalClass}">${content}</div>`;
  o.addEventListener('click',e=>{if(e.target===o)closeModal()});
  document.body.appendChild(o);
  document.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',closeModal));
  document.addEventListener('keydown',escClose);
}
function closeModal(){document.querySelector('.modal-overlay')?.remove();document.removeEventListener('keydown',escClose)}
function escClose(e){if(e.key==='Escape')closeModal()}

function openNewCaseModal(defClinic){
  const cOpts=CLINICS.map(c=>`<option value="${c.id}" ${c.id===defClinic?'selected':''}>${c.name}</option>`).join('');
  const tOpts=allWorkTypes().map(t=>`<option value="${escAttr(t)}">${escHTML(t)}</option>`).join('');
  const colOpts=COLORS_VITA.map(c=>`<option>${c}</option>`).join('');
  const today=new Date();const pD=new Date(today);pD.setDate(today.getDate()+5);const fD=new Date(today);fD.setDate(today.getDate()+7);
  const upper=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tooth=n=>`<button type="button" class="tooth-cell" data-tooth="${n}">${n}</button>`;
  const renderRow=arr=>arr.slice(0,8).map(tooth).join('')+'<div class="tc-divider-form"></div>'+arr.slice(8).map(tooth).join('');
  openModal(`<div class="modal-head"><div><div class="modal-kicker">Flux organizat</div><div class="modal-title">Caz nou</div></div><button class="modal-close" type="button">×</button></div>
    <div class="modal-body modal-body-compact">
      <div class="case-wizard">
        <aside class="wizard-steps">
          <div class="wizard-step on"><span>1</span><div><b>Pacient</b><small>clinică și medic</small></div></div>
          <div class="wizard-step"><span>2</span><div><b>Lucrare</b><small>tip, culoare, dinți</small></div></div>
          <div class="wizard-step"><span>3</span><div><b>Date</b><small>intrare, probă, finală</small></div></div>
          <div class="wizard-step"><span>4</span><div><b>Fișiere</b><small>atașări și note</small></div></div>
        </aside>
        <div class="wizard-content">
          <section class="wizard-panel">
            <div class="wizard-panel-title">Pacient & clinică</div>
            <div class="field-row"><div class="field"><label>Nume</label><input id="ncLast" placeholder="Nume pacient" autofocus></div><div class="field"><label>Prenume</label><input id="ncFirst" placeholder="Prenume"></div></div>
            <div class="field-row"><div class="field"><label>Clinică</label><select id="ncClinic">${cOpts}</select></div><div class="field"><label>Medic</label><input id="ncDoctor"></div></div>
          </section>
          <section class="wizard-panel">
            <div class="wizard-panel-title">Lucrare</div>
            <div class="field-row"><div class="field"><label>Tip</label><select id="ncType">${tOpts}</select></div><div class="field"><label>Culoare</label><select id="ncColor">${colOpts}</select></div></div>
            <div class="field"><label>Schema dentară (FDI)</label>
              <div class="tc-jaw-controls">
                <button type="button" class="tc-jaw-btn" data-jaw="upper">Maxilar complet</button>
                <button type="button" class="tc-jaw-btn" data-jaw="lower">Mandibulă completă</button>
                <button type="button" class="tc-jaw-btn tc-jaw-clear" data-jaw="clear">Șterge tot</button>
              </div>
              <div class="tc-form-wrap" id="toothChartWrap"><div class="tc-row-form">${renderRow(upper)}</div><div class="tc-row-form">${renderRow(lower)}</div></div><div class="tc-summary" id="toothSummary"><div style="color:var(--text-dim)">Niciun dinte selectat</div></div></div>
            <div class="field-row"><div class="field"><label>Tip implant</label><input id="ncImplant"></div><div class="field"><label>Tip amprentă</label><select id="ncAmprenta"><option>Silicon</option><option>Polieter</option><option>Alginat</option><option>Digital</option><option>STL</option></select></div></div>
          </section>
          <section class="wizard-panel">
            <div class="wizard-panel-title">Planificare</div>
            <div class="field-row three"><div class="field"><label>Intrată</label><input id="ncIntrata" value="${fmtShortDate(today)}"></div><div class="field"><label>Probă</label><input id="ncProba" value="${fmtShortDate(pD)}"></div><div class="field"><label>Finală</label><input id="ncFinala" value="${fmtShortDate(fD)}"></div></div>
            <div id="deadlineAdvisor"></div>
          </section>
          <section class="wizard-panel"><div class="wizard-panel-title">Termeni laborator</div><a class="btn" href="termeni.html" target="_blank" rel="noreferrer">Deschide tabelul complet</a></section>
          <section class="wizard-panel">
            <div class="wizard-panel-title">Fișiere & note</div>
            <button class="upload-well" id="ncUploadBtn" type="button"><span>PDF / STL</span><b>Adaugă fișiere</b></button>
            <input id="ncFileInput" type="file" multiple hidden>
            <div class="upload-file-list" id="ncFileList"></div>
            <div class="field"><label>Note</label><textarea id="ncNotes"></textarea></div>
          </section>
        </div>
      </div>
    </div><div class="modal-foot"><button class="btn modal-close" type="button">Anulează</button><button class="btn primary" id="ncSave" type="button">Salvează</button></div>`, 'modal-wide');
  const newCaseFiles=[];
  const updateNewCaseFiles=()=>{
    const list=document.getElementById('ncFileList');
    if(!list)return;
    list.innerHTML=newCaseFiles.length
      ? newCaseFiles.map(f=>`<div class="upload-file-item"><span>${fileExt(f.name)}</span><b>${f.name}</b><em>${formatBytes(f.size)}</em></div>`).join('')
      : '';
  };
  document.getElementById('ncUploadBtn')?.addEventListener('click',()=>document.getElementById('ncFileInput')?.click());
  document.getElementById('ncFileInput')?.addEventListener('change',e=>{Array.from(e.target.files||[]).forEach(f=>newCaseFiles.push(f));updateNewCaseFiles();e.target.value=''});
  const updateDeadlineAdvisor=()=>{
    const probe={type:document.getElementById('ncType')?.value||'',intrata:document.getElementById('ncIntrata')?.value||'',finala:document.getElementById('ncFinala')?.value||''};
    const status=labDeadlineStatus(probe);
    const box=document.getElementById('deadlineAdvisor');
    const finalInput=document.getElementById('ncFinala');
    if(box)box.innerHTML=deadlineHintHTML(status);
    finalInput?.classList.toggle('deadline-bad',status.urgent);
  };
  ['ncType','ncIntrata','ncFinala'].forEach(id=>document.getElementById(id)?.addEventListener('change',updateDeadlineAdvisor));
  updateDeadlineAdvisor();
  const tMap=new Map();
  document.querySelectorAll('#toothChartWrap .tooth-cell').forEach(b=>{
    b.addEventListener('click',e=>{e.stopPropagation();openToothPop(b)});
  });
  // Jaw select buttons
  document.querySelectorAll('.tc-jaw-btn').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const jaw=btn.dataset.jaw;
      if(jaw==='clear'){
        tMap.clear();
        document.querySelectorAll('#toothChartWrap .tooth-cell').forEach(tb=>{tb.className='tooth-cell'});
        updateSum();return;
      }
      const jawTeeth=jaw==='upper'?upper:lower;
      // Open type picker popover anchored to the button
      document.querySelectorAll('.tooth-popover').forEach(p=>p.remove());
      const p=document.createElement('div');p.className='tooth-popover';p.style.cssText='position:absolute;top:34px;left:0;z-index:100';
      p.innerHTML=`<div class="tp-header">${jaw==='upper'?'Maxilar complet':'Mandibulă completă'}</div><button class="tp-btn" data-type="crown"><span class="tp-swatch crown"></span>Coroană</button><button class="tp-btn" data-type="implant"><span class="tp-swatch implant"></span>Pe implant</button><button class="tp-btn" data-type="emax"><span class="tp-swatch emax"></span>Emax</button><button class="tp-btn" data-type="veneer"><span class="tp-swatch veneer"></span>Fațetă</button>`;
      btn.style.position='relative';btn.appendChild(p);
      p.querySelectorAll('.tp-btn').forEach(pb=>pb.addEventListener('click',ev=>{
        ev.stopPropagation();const t=pb.dataset.type;
        jawTeeth.forEach(n=>{
          tMap.set(String(n),t);
          const tb=document.querySelector(`#toothChartWrap [data-tooth="${n}"]`);
          if(tb)tb.className='tooth-cell '+t;
        });
        p.remove();updateSum();
      }));
      setTimeout(()=>{const cl=ev=>{if(!p.contains(ev.target)){p.remove();document.removeEventListener('click',cl)}};document.addEventListener('click',cl)},0);
    });
  });
  function openToothPop(tb){
    document.querySelectorAll('.tooth-popover').forEach(p=>p.remove());
    document.querySelectorAll('.tooth-cell.popped').forEach(c=>c.classList.remove('popped'));
    tb.classList.add('popped');const n=tb.dataset.tooth;
    const p=document.createElement('div');p.className='tooth-popover';
    p.innerHTML=`<div class="tooth-popover-arrow"></div><div class="tp-header">Dinte ${n}</div><button class="tp-btn" data-type="crown"><span class="tp-swatch crown"></span>Coroană</button><button class="tp-btn" data-type="implant"><span class="tp-swatch implant"></span>Pe implant</button><button class="tp-btn" data-type="emax"><span class="tp-swatch emax"></span>Emax</button><button class="tp-btn" data-type="veneer"><span class="tp-swatch veneer"></span>Fațetă</button><div class="tp-btn-divider"></div><button class="tp-btn danger" data-type="erase"><span class="tp-swatch eraser">×</span>Șterge</button>`;
    p.style.top=(tb.offsetTop+tb.offsetHeight+6)+'px';p.style.left=Math.max(0,tb.offsetLeft-16)+'px';
    document.getElementById('toothChartWrap').appendChild(p);
    p.querySelectorAll('.tp-btn').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();const t=b.dataset.type;
      if(t==='erase'){tMap.delete(n);tb.className='tooth-cell'}
      else{tMap.set(n,t);tb.className='tooth-cell '+t}
      p.remove();tb.classList.remove('popped');updateSum();
    }));
    setTimeout(()=>{const cl=ev=>{if(!p.contains(ev.target)&&ev.target!==tb){p.remove();tb.classList.remove('popped');document.removeEventListener('click',cl)}};document.addEventListener('click',cl)},0);
  }
  function updateSum(){
    const s=document.getElementById('toothSummary');
    if(!tMap.size){s.innerHTML='<div style="color:var(--text-dim)">Niciun dinte selectat</div>';return}
    const bt={};tMap.forEach((t,n)=>{(bt[t]=bt[t]||[]).push(Number(n))});
    const lb={crown:'Coroană',implant:'Pe implant',emax:'Emax',veneer:'Fațetă'};
    s.innerHTML=Object.entries(bt).map(([t,ns])=>`<div class="tc-summary-line"><span class="tc-sum-mini ${t}"></span><span>${lb[t]}:</span><b>${ns.sort((a,b)=>a-b).join(', ')}</b></div>`).join('');
  }
  document.getElementById('ncSave').addEventListener('click',async()=>{
    const last=document.getElementById('ncLast').value.trim();const first=document.getElementById('ncFirst').value.trim();
    if(!last&&!first){document.getElementById('ncLast').style.borderColor='#A32D2D';return}
    const teeth=[];tMap.forEach((type,n)=>teeth.push({n:Number(n),type}));
    const type=document.getElementById('ncType').value.trim()||allWorkTypes()[0]||'Lucrare';
    rememberWorkType(type);
    const nc={name:(last+' '+first).trim(),lastName:last,firstName:first,clinic:document.getElementById('ncClinic').value,doctor:document.getElementById('ncDoctor').value,type,color:document.getElementById('ncColor').value,stage:'design',intrata:document.getElementById('ncIntrata').value,probaDate:document.getElementById('ncProba').value,finala:document.getElementById('ncFinala').value,teeth,implantType:document.getElementById('ncImplant').value,amprentaType:document.getElementById('ncAmprenta').value,notes:document.getElementById('ncNotes').value,assignees:{},stageStatuses:{},notStarted:true};
    if(!SUPABASE_CONFIGURED)nc.id=nextCaseId();
    nc.deadlineUrgent=labDeadlineStatus(nc).urgent;
    nc.priority=computePriority(nc);
    if(SUPABASE_CONFIGURED){try{await sbSaveCase(nc)}catch(e){alert('Eroare la salvare: '+e.message);return}}
    else{persistNewCase(nc)}
    CASES.unshift(nc);
    if(newCaseFiles.length)await storeCaseFiles(nc.id,newCaseFiles);closeModal();
    updateMainSummary();
    if(typeof renderTable==='function')renderTable();renderPipeline();renderClinic();
  });
}

function openQuickEdit(id){
  const c=getCase(id);if(!c)return;
  const stOpts=STAGES.map(s=>`<option value="${s.id}" ${s.id===c.stage?'selected':''}>${s.name}</option>`).join('');
  const colOpts=COLORS_VITA.map(x=>`<option ${x===c.color?'selected':''}>${x}</option>`).join('');
  const safeVal=v=>String(v||'').replace(/"/g,'&quot;');
  openModal(`<div class="modal-head"><div class="modal-title">Editare rapidă · ${c.name}</div><button class="modal-close" type="button">×</button></div><div class="modal-body"><div class="field-row"><div class="field"><label>Pacient</label><input id="qeName" value="${safeVal(c.name)}"></div><div class="field"><label>Etapă</label><select id="qeStage">${stOpts}</select></div></div><div class="field-row three"><div class="field"><label>Tip</label><input id="qeType" value="${safeVal(c.type)}"></div><div class="field"><label>Culoare</label><select id="qeColor">${colOpts}</select></div><div class="field"><label>Tip implant</label><input id="qeImplant" value="${safeVal(c.implantType)}"></div></div><div class="field-row three"><div class="field"><label>Intrată</label><input id="qeI" value="${safeVal(c.intrata)}"></div><div class="field"><label>Probă</label><input id="qeP" value="${safeVal(c.probaDate)}"></div><div class="field"><label>Finală</label><input id="qeF" value="${safeVal(c.finala)}"></div></div><div class="field-row"><div class="field"><label>Amprentă</label><input id="qeAmprenta" value="${safeVal(c.amprentaType)}"></div><div class="field"><label>Note</label><textarea id="qeN">${c.notes||''}</textarea></div></div></div><div class="modal-foot"><button class="btn modal-close">Anulează</button><button class="btn primary" id="qeSave">Salvează</button></div>`);
  document.getElementById('qeSave').addEventListener('click',()=>{
    c.name=document.getElementById('qeName').value.trim()||c.name;c.stage=document.getElementById('qeStage').value;c.type=document.getElementById('qeType').value.trim()||c.type;rememberWorkType(c.type);
    c.color=document.getElementById('qeColor').value;c.implantType=document.getElementById('qeImplant').value;c.amprentaType=document.getElementById('qeAmprenta').value;
    c.intrata=document.getElementById('qeI').value;c.probaDate=document.getElementById('qeP').value;c.finala=document.getElementById('qeF').value;c.notes=document.getElementById('qeN').value;
    c.deadlineUrgent=labDeadlineStatus(c).urgent;
    c.priority=computePriority(c);
    overrides.edits=overrides.edits||{};overrides.edits[c.id]={name:c.name,stage:c.stage,type:c.type,color:c.color,implantType:c.implantType,amprentaType:c.amprentaType,intrata:c.intrata,probaDate:c.probaDate,finala:c.finala,notes:c.notes,deadlineUrgent:c.deadlineUrgent,priority:c.priority};
    saveOverrides(overrides);_syncCase(c);closeModal();renderCaseDetail();if(typeof renderTable==='function')renderTable();renderPipeline();
  });
}

// === PDF MODEL B ===
function buildFisaHTML(c){
  const cl=getClinic(c.clinic);
  const safe=s=>{const v=String(s==null?'':s).trim();return v?v.replace(/</g,'&lt;'):'—'};
  const upper=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tcell=n=>{const t=(c.teeth||[]).find(x=>x.n===n);const cls=t?t.type:'';const stl=cls==='crown'?'background:#F1F5F9;color:#334155;border:1px solid #94A3B8;font-weight:bold':cls==='implant'?'background:#FFF7ED;color:#9A3412;border:1.5px solid #EA580C;font-weight:bold':cls==='emax'?'background:#E6F1FB;color:#185FA5;border:1.5px solid #185FA5;font-weight:bold':cls==='veneer'?'background:#F8FAFC;color:#475569;border:1.5px dashed #64748B;font-weight:bold':'';return `<td style="text-align:center;padding:6px 2px;font-size:13px;font-family:monospace;border:0.5px solid #E5E7EB;${stl}">${n}</td>`};
  const trow=arr=>'<tr>'+arr.slice(0,8).map(tcell).join('')+'<td style="border:0;width:6px"></td>'+arr.slice(8).map(tcell).join('')+'</tr>';
  const byType={};(c.teeth||[]).forEach(t=>{(byType[t.type]=byType[t.type]||[]).push(t.n)});
  const labels={crown:'Coroană',implant:'Pe implant',emax:'Emax',veneer:'Fațetă'};
  const swatches={crown:'background:#F1F5F9;border:1px solid #94A3B8',implant:'background:#FFF7ED;border:1px solid #EA580C',emax:'background:#E6F1FB;border:1px solid #185FA5',veneer:'background:#F8FAFC;border:1px dashed #64748B'};
  const stageName=publicStageName(c);
  const tehnician=getEmployee(c.assignee)?.name||'—';
  const pdfDeadlineUrgent=labDeadlineStatus(c).urgent;
  const summaryHTML=Object.keys(byType).length
    ? `<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-top:10px;padding-top:10px;border-top:0.5px solid #E5E7EB">${Object.entries(byType).map(([t,ns])=>`<span><span style="display:inline-block;width:9px;height:9px;${swatches[t]};vertical-align:middle;margin-right:4px"></span><b>${labels[t]}</b> (${ns.length}): ${ns.sort((a,b)=>a-b).join(', ')}</span>`).join('')}</div>`
    : `<div style="font-size:13px;color:#94A3B8;margin-top:10px;padding-top:10px;border-top:0.5px solid #E5E7EB;font-style:italic">Niciun dinte selectat</div>`;
  const sec=t=>`<div style="font-size:13px;text-transform:uppercase;letter-spacing:0.6px;color:#64748B;font-weight:bold;padding-bottom:4px;border-bottom:1px solid #D8E2EE;margin-bottom:8px">${t}</div>`;
  const hi=(label,value,tone='blue')=>{const colors={blue:['#E6F1FB','#185FA5'],red:['#FCEBEB','#A32D2D'],amber:['#FAEEDA','#BA7517'],green:['#EAF3DE','#1D9E75']};const [bg,fg]=colors[tone]||colors.blue;return `<span style="display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:5px;background:${bg};color:${fg};font-size:14px"><span style="opacity:.75">${label}:</span><b>${safe(value)}</b></span>`};
  // A5 portrait: 148mm × 210mm (~560px wide) — fonturi mărite proporțional pentru lizibilitate
  return `<div style="font-family:Arial,sans-serif;color:#1F2937;font-size:12px;line-height:1.5;width:560px;background:white">
<div style="background:#F8FAFC;color:#1F2937;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #D8E2EE"><div><div style="font-weight:bold;font-size:15px;color:#185FA5">LAB CAD · Laborator Dentar</div><div style="font-size:11px;color:#64748B;margin-top:2px">Chișinău · contact@labdentar.md · +373 22 000 000</div></div><div style="font-family:monospace;font-size:18px;font-weight:bold;color:#185FA5">#${c.id}</div></div>
<div style="padding:18px 22px">
<div style="margin-bottom:12px">${sec('Pacient & Clinică')}<div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap;align-items:center">${hi('Pacient',c.name,'blue')}<span>Clinică: <b>${safe(cl.name)}</b></span><span>Medic: <b>${safe(c.doctor||cl.doctor)}</b></span></div></div>
<div style="margin-bottom:12px">${sec('Date')}<div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap;align-items:center"><span>Intrată: <b>${safe(c.intrata)}</b></span><span>Probă: <b>${safe(c.probaDate)}</b></span>${hi('Finală',c.finala,c.late||pdfDeadlineUrgent?'red':'amber')}</div></div>
<div style="margin-bottom:12px">${sec('Lucrare')}<div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap;align-items:center"><span>Tip: <b>${safe(c.type)}</b></span>${hi('Culoare',c.color||'—','green')}<span>Etapă: <b>${safe(stageName)}</b></span><span>Tehnician: <b>${safe(tehnician)}</b></span><span>Prioritate: <b>${safe(c.priority)}</b></span></div></div>
<div style="margin-bottom:12px">${sec('Implant & Amprentă')}<div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap;align-items:center">${hi('Tip implant',c.implantType||'—','amber')}<span>Tip amprentă: <b>${safe(c.amprentaType)}</b></span></div></div>
<div style="margin-bottom:12px">${sec('Schema dentară (FDI)')}<div style="background:#F8FAFC;padding:10px;border-radius:4px;border:0.5px solid #E5E7EB"><table style="border-collapse:collapse;width:100%;table-layout:fixed">${trow(upper)}${trow(lower)}</table>${summaryHTML}</div></div>
<div style="margin-bottom:14px">${sec('Indicații speciale')}<div style="font-size:12px;min-height:42px;padding:8px 10px;background:#F8FAFC;border-left:3px solid #185FA5">${c.notes?safe(c.notes):'<span style="color:#94A3B8;font-style:italic">Fără indicații suplimentare</span>'}</div></div>
<div style="display:flex;justify-content:space-between;margin-top:24px;gap:14px"><div style="flex:1"><div style="border-bottom:0.5px solid #64748B;height:26px"></div><div style="font-size:10px;color:#64748B;margin-top:3px">Semnătura medic clinică</div></div><div style="flex:1"><div style="border-bottom:0.5px solid #64748B;height:26px"></div><div style="font-size:10px;color:#64748B;margin-top:3px">Semnătura tehnician</div></div></div>
<div style="text-align:right;font-size:10px;color:#94A3B8;margin-top:10px">Emis ${new Date().toLocaleDateString('ro-RO')} · Fișa caz #${c.id}</div>
</div></div>`;
}
function generateFisaPDF(c){
  if(typeof html2pdf==='undefined'){alert('Librăria nu s-a încărcat');return}
  const w=document.createElement('div');w.innerHTML=buildFisaHTML(c);w.style.position='absolute';w.style.left='-9999px';document.body.appendChild(w);
  html2pdf().from(w.firstElementChild).set({margin:[6,6,6,6],filename:`fisa-${c.id}-${(c.lastName||c.name||'').split(' ')[0].toLowerCase()||'caz'}.pdf`,html2canvas:{scale:2.5,useCORS:true},jsPDF:{unit:'mm',format:'a5',orientation:'portrait'}}).save().finally(()=>document.body.removeChild(w));
}

function previewFisaPDF(c){
  const html=buildFisaHTML(c);
  openModal(`<div class="modal-head"><div class="modal-title">Fișă caz #${c.id} · ${c.name}</div><button class="modal-close" type="button">×</button></div><div class="modal-body" style="padding:0;overflow:auto;max-height:72vh"><div style="padding:16px;background:#F3F4F6">${html}</div></div><div class="modal-foot"><button class="btn modal-close" type="button">Închide</button><button class="btn primary" id="pdfDlBtn" type="button">Descarcă PDF</button></div>`,'modal-wide');
  document.getElementById('pdfDlBtn')?.addEventListener('click',()=>generateFisaPDF(c));
}

// === LOGIN ===
function renderLogin(){
  const root=document.getElementById('loginShell');if(!root)return;
  const sb=typeof SUPABASE_CONFIGURED!=='undefined'&&SUPABASE_CONFIGURED;
  const clinicOpts=CLINICS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const empOpts=EMPLOYEES.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  if(sb){
    // Supabase mode: username + password
    root.innerHTML=`<div class="login-shell"><div class="login-box"><div class="login-brand"><div class="login-brand-mark">L</div><div class="login-brand-name">Laborator Dentar</div></div>
<div id="loginForm"><div class="login-prompt">Autentificare</div>
<div class="field" style="margin-bottom:12px"><label>Utilizator</label><input id="lUser" placeholder="ex: maria_t" autocomplete="username"></div>
<div class="field" style="margin-bottom:16px"><label>Parolă</label><input id="lPass" type="password" autocomplete="current-password"></div>
<div id="loginErr" class="login-err" style="display:none"></div>
<button class="btn primary" id="lSubmit" style="width:100%;margin-bottom:12px">Intră în cont</button>
<button class="btn" id="showReg" style="width:100%;font-size:12px">Nu ai cont? Înregistrare</button></div>
<div id="regForm" style="display:none"><div class="login-prompt">Cont nou</div>
<div class="field" style="margin-bottom:10px"><label>Utilizator</label><input id="rUser" placeholder="ex: maria_t" autocomplete="username"></div>
<div class="field" style="margin-bottom:10px"><label>Parolă</label><input id="rPass" type="password" autocomplete="new-password"></div>
<div class="field" style="margin-bottom:10px"><label>Rol</label><select id="rRole"><option value="technician">Tehnician</option><option value="clinic">Clinică</option><option value="admin">Admin</option></select></div>
<div id="rClinicWrap" class="field" style="margin-bottom:10px;display:none"><label>Clinică</label><select id="rClinic">${clinicOpts}</select></div>
<div id="rEmpWrap" class="field" style="margin-bottom:16px;display:none"><label>Cont tehnician</label><select id="rEmp">${empOpts}</select></div>
<div id="regErr" class="login-err" style="display:none"></div>
<button class="btn primary" id="rSubmit" style="width:100%;margin-bottom:12px">Creează cont</button>
<button class="btn" id="showLogin" style="width:100%;font-size:12px">← Înapoi la autentificare</button></div>
</div></div>`;
    // Login submit
    const doLogin=async()=>{
      const u=root.querySelector('#lUser').value.trim(),p=root.querySelector('#lPass').value;
      if(!u||!p){_loginErr('loginErr','Completați toate câmpurile');return}
      root.querySelector('#lSubmit').textContent='...';
      try{const prof=await sbSignIn(u,p);_redirectAfterLogin(prof)}
      catch(e){root.querySelector('#lSubmit').textContent='Intră în cont';_loginErr('loginErr',e.message||'Eroare de autentificare')}
    };
    root.querySelector('#lSubmit')?.addEventListener('click',doLogin);
    root.querySelector('#lPass')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
    root.querySelector('#showReg')?.addEventListener('click',()=>{root.querySelector('#loginForm').style.display='none';root.querySelector('#regForm').style.display=''});
    root.querySelector('#showLogin')?.addEventListener('click',()=>{root.querySelector('#regForm').style.display='none';root.querySelector('#loginForm').style.display=''});
    root.querySelector('#rRole')?.addEventListener('change',e=>{
      root.querySelector('#rClinicWrap').style.display=e.target.value==='clinic'?'':'none';
      root.querySelector('#rEmpWrap').style.display=e.target.value==='technician'?'':'none';
    });
    root.querySelector('#rSubmit')?.addEventListener('click',async()=>{
      const u=root.querySelector('#rUser').value.trim(),p=root.querySelector('#rPass').value;
      const role=root.querySelector('#rRole').value;
      const clinic=root.querySelector('#rClinic').value;
      const emp=root.querySelector('#rEmp').value;
      if(!u||!p){_loginErr('regErr','Completați toate câmpurile');return}
      root.querySelector('#rSubmit').textContent='...';
      try{
        await sbSignUp(u,p,role,role==='clinic'?clinic:null,role==='technician'?emp:null);
        const prof=await sbSignIn(u,p);_redirectAfterLogin(prof);
      }catch(e){root.querySelector('#rSubmit').textContent='Creează cont';_loginErr('regErr',e.message||'Eroare la înregistrare')}
    });
  } else {
    root.innerHTML=`<div class="login-shell"><div class="login-box"><div class="login-brand"><div class="login-brand-mark">L</div><div class="login-brand-name">Laborator Dentar</div></div><div class="login-err" style="display:block">Sistemul necesită conexiune Supabase. Contactați administratorul.</div></div></div>`;
  }
}
function _loginErr(id,msg){const el=document.getElementById(id);if(el){el.textContent=msg;el.style.display='block'}}
function _redirectAfterLogin(prof){
  if(!prof)return;
  if(prof.role==='clinic')location.href=`clinic.html?id=${prof.clinic_id}`;
  else if(prof.role==='technician')location.href='tehnician.html';
  else location.href='index.html';
}

// === ACTIVITY LOG ===
async function renderActivityLog(){
  const root=document.getElementById('activityShell');if(!root)return;
  const user=getCurrentUser();if(user?.role!=='admin'&&user?.role!=='ad'){return}
  root.innerHTML=`<h1 style="font-size:20px;font-weight:500;margin:0 0 4px">Istoricul activității</h1><div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Toate acțiunile înregistrate în sistem</div><div id="actLog" style="font-size:13px">Se încarcă...</div>`;
  const logs=await sbLoadActivityLog(300);
  if(!logs.length){document.getElementById('actLog').innerHTML='<div style="color:var(--text-dim);font-style:italic;padding:16px 0">Nicio activitate înregistrată.</div>';return}
  const actionLabel={add_case:'Adăugat caz',update_case:'Actualizat caz',delete_case:'Șters caz',add_file:'Fișier adăugat',login:'Autentificare'};
  const rows=logs.map(l=>{
    const dt=new Date(l.created_at);
    const date=dt.toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit',year:'numeric'});
    const time=dt.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
    const det=l.details?Object.entries(l.details).map(([k,v])=>`${k}: ${v}`).join(' · '):'';
    return`<div class="act-row"><span class="act-time">${date} ${time}</span><span class="act-user">${l.username||'?'}</span><span class="act-role act-${l.role}">${l.role||''}</span><span class="act-action">${actionLabel[l.action]||l.action}</span><span class="act-detail">${det}</span></div>`;
  }).join('');
  document.getElementById('actLog').innerHTML=`<div class="act-table">${rows}</div>`;
}

// === SEARCH + FILTERS ===
function attachSearch(){
  const i=document.getElementById('searchInput');if(!i)return;
  i.addEventListener('input',()=>{const q=i.value.toLowerCase().trim();document.querySelectorAll('.tbl tbody tr,.kb-card').forEach(el=>el.style.display=(!q||el.textContent.toLowerCase().includes(q))?'':'none')});
}
function attachFilters(){
  const tabs=document.querySelectorAll('.subbar .tab');if(!tabs.length)return;
  const tm=['all','mine','late','week','notstarted','trimise'];
  tabs.forEach((t,i)=>t.addEventListener('click',()=>{tabs.forEach(x=>x.classList.remove('on'));t.classList.add('on');activeFilter.tab=tm[i];renderPipeline();if(typeof renderTable==='function')renderTable()}));
  const ch=document.getElementById('clinicFilterChip');
  if(ch){
    ch.addEventListener('click',e=>{e.stopPropagation();document.getElementById('clinicFilterMenu').classList.toggle('open')});
    document.addEventListener('click',()=>document.getElementById('clinicFilterMenu')?.classList.remove('open'));
    document.querySelectorAll('#clinicFilterMenu .chip-menu-item').forEach(it=>it.addEventListener('click',()=>{activeFilter.clinic=it.dataset.value;ch.textContent='Clinică: '+(it.dataset.value==='all'?'toate':getClinic(it.dataset.value).name);renderPipeline();if(typeof renderTable==='function')renderTable()}));
  }
}
function attachMobileMenu(){const b=document.querySelector('.mobile-menu-btn'),s=document.querySelector('.sidebar');if(!b||!s)return;b.addEventListener('click',()=>s.classList.toggle('open'))}

// === INLINE POPOVER SYSTEM ===
function positionFloatingUnder(pop, anchor) {
  const rect = anchor.getBoundingClientRect();
  const minLeft = window.scrollX + 8;
  const maxLeft = window.scrollX + window.innerWidth - pop.offsetWidth - 8;
  const left = Math.max(minLeft, Math.min(rect.left + window.scrollX, maxLeft));
  pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = left + 'px';
}

function openInlinePopover(anchor, items, onSelect, header, options={}) {
  document.querySelectorAll('.inline-popover').forEach(p => p.remove());
  const pop = document.createElement('div');
  pop.className = 'inline-popover';
  const headerHtml = header ? `<div class="inline-pop-header">${header}</div>` : '';
  pop.innerHTML = headerHtml + items.map((it, i) =>
    `<button class="inline-pop-item" data-idx="${i}">${it.label}</button>`
  ).join('');
  document.body.appendChild(pop);
  positionFloatingUnder(pop, options.positionAnchor || anchor);
  pop.querySelectorAll('.inline-pop-item').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      onSelect(items[Number(b.dataset.idx)]);
      pop.remove();
    });
  });
  setTimeout(() => {
    const close = ev => {
      if (!pop.contains(ev.target) && ev.target !== anchor) {
        pop.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 0);
}

function _parseNotes(raw){if(!raw)return[];try{const p=JSON.parse(raw);return Array.isArray(p)?p:[{text:raw,author:'—',initials:'—',ts:0}]}catch{return raw.trim()?[{text:raw,author:'—',initials:'—',ts:0}]:[]}}
function _noteItemHTML(n){return`<div class="note-item"><div class="note-author">${escHTML(n.initials||'?')}</div><div style="flex:1"><div class="note-meta"><b>${escHTML(n.author||'—')}</b>${n.ts?' · '+new Date(n.ts).toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',''):''}</div><div class="note-text">${escHTML(n.text)}</div></div></div>`}

function openInlineNoteEditor(anchor, c) {
  document.querySelectorAll('.inline-note-editor').forEach(p => p.remove());
  const existing=_parseNotes(c.notes);
  const pop = document.createElement('div');
  pop.className = 'inline-note-editor';
  pop.innerHTML = `<div class="inline-pop-header">Notițe · ${escHTML(c.name)}</div>
    ${existing.length?`<div class="note-list" style="max-height:140px;overflow-y:auto;margin-bottom:8px">${existing.slice().reverse().map(_noteItemHTML).join('')}</div>`:''}
    <textarea class="inline-note-input" rows="3" placeholder="Adaugă o notă nouă..."></textarea>
    <div class="inline-note-actions"><button class="btn" type="button" data-note-cancel>Anulează</button><button class="btn primary" type="button" data-note-save>Trimite</button></div>`;
  document.body.appendChild(pop);
  positionFloatingUnder(pop, anchor.closest('td') || anchor);
  const ta=pop.querySelector('.inline-note-input');
  ta.focus();
  pop.querySelector('[data-note-cancel]')?.addEventListener('click',()=>pop.remove());
  pop.querySelector('[data-note-save]')?.addEventListener('click',()=>{
    const txt=ta.value.trim();if(!txt)return;
    const user=getCurrentUser()||{name:'Utilizator',initials:'?'};
    const notes=_parseNotes(c.notes);
    notes.push({text:txt,author:user.name,initials:user.initials,ts:Date.now()});
    c.notes=JSON.stringify(notes);
    overrides.edits=overrides.edits||{};
    overrides.edits[c.id]=overrides.edits[c.id]||{};
    overrides.edits[c.id].notes=c.notes;
    saveOverrides(overrides);
    _syncCase(c);
    pop.remove();
    if(typeof renderTable==='function')renderTable();
    if(typeof renderPipeline==='function')renderPipeline();
  });
  setTimeout(()=>{
    const close=ev=>{if(!pop.contains(ev.target)&&ev.target!==anchor){pop.remove();document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },0);
}

function updateCaseField(c, field, value) {
  c[field] = value;
  c.deadlineUrgent = labDeadlineStatus(c).urgent;
  c.priority = computePriority(c);
  overrides.edits = overrides.edits || {};
  overrides.edits[c.id] = overrides.edits[c.id] || {};
  overrides.edits[c.id][field] = value;
  if (field === 'priority') overrides.edits[c.id].priority = value;
  overrides.edits[c.id].deadlineUrgent = c.deadlineUrgent;
  overrides.edits[c.id].priority = c.priority;
  saveOverrides(overrides);
  _syncCase(c);
}

function attachInlineEditors(root) {
  if (!root) root = document;

  // TIP LUCRARE — click on .tag in table row
  root.querySelectorAll('tbody .tag, .kb-tag, .tbl-tag').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card,.pc-row-grid');
      if (!tr) return;
      const id = Number(tr.dataset.caseId);
      const c = getCase(id);
      if (!c) return;
      const items = [...allWorkTypes().map(t => ({ value: t, label: t })), { value: '__custom__', label: '+ Adaugă tip nou' }];
      openInlinePopover(el, items, sel => {
        let value=sel.value;
        if(value==='__custom__'){
          value=prompt('Tip lucrare nou:','');
          if(!value||!value.trim())return;
          value=value.trim();
          rememberWorkType(value);
        }
        updateCaseField(c, 'type', value);
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderPipeline === 'function') renderPipeline();
      }, 'Tip lucrare');
    });
  });

  // PRIORITATE — click on .tbl-prio
  root.querySelectorAll('.tbl-prio').forEach(el => {
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      const items = [
        { value: 'urgent', label: '🔴 Urgent' },
        { value: 'mediu', label: '🟠 Mediu' },
        { value: 'reusim', label: '🟢 Reusim' }
      ];
      openInlinePopover(el, items, sel => {
        c.priority = sel.value;
        overrides.edits = overrides.edits || {};
        overrides.edits[c.id] = overrides.edits[c.id] || {};
        overrides.edits[c.id].priority = sel.value;
        saveOverrides(overrides);
        _syncCase(c);
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderPipeline === 'function') renderPipeline();
      }, 'Prioritate');
    });
  });

  // STAGE / ETAPĂ — click on .tbl-pill (the stage pill in Etapă column)
  root.querySelectorAll('.tbl-pill').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      const items = STAGES.map(s => ({ value: s.id, label: s.name }));
      openInlinePopover(el, items, sel => {
        c.stage = sel.value;
        overrides.stages = overrides.stages || {};
        overrides.stages[c.id] = sel.value;
        saveOverrides(overrides);
        _syncCase(c);
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderPipeline === 'function') renderPipeline();
      }, 'Schimbă etapă', { positionAnchor: el.closest('td') || el });
    });
  });

  // STAGE NODE — click on .node or .node-em → richer menu
  root.querySelectorAll('.node, .node-em').forEach(el => {
    if (el.dataset.menuAttached) return;
    el.dataset.menuAttached = '1';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(el.dataset.caseId);
      const stage = el.dataset.stage;
      const c = getCase(id);
      if (!c) return;
      const user = getCurrentUser() || { id: 'admin', initials: 'AD', name: 'Admin' };
      const items = [
        { value: 'claim', label: 'Preia (Eu lucrez la asta)' },
        { value: 'in_lucru', label: 'Marchez ca: În lucru' },
        { value: 'la_proba', label: 'Marchez ca: La probă' },
        { value: 'finalizat', label: 'Marchez ca: Finalizat ✓' },
        { value: 'reset', label: 'Resetează (neincepute)' }
      ];
      // Add tech-change submenu items
      EMPLOYEES.forEach(emp => {
        if (emp.id !== c.assignees?.[stage]) {
          items.push({ value: 'tech:' + emp.id, label: 'Reasignează → ' + emp.name });
        }
      });
      openInlinePopover(el, items, sel => {
        c.stageStatuses = c.stageStatuses || {};
        c.assignees = c.assignees || {};
        if (sel.value === 'claim') {
          c.stageStatuses[stage] = 'in_lucru';
          c.assignees[stage] = user.id;
          c.assignee = user.id;
          c.notStarted = false;
        } else if (sel.value === 'reset') {
          c.stageStatuses[stage] = 'neincepute';
          c.assignees[stage] = null;
        } else if (sel.value.startsWith('tech:')) {
          c.assignees[stage] = sel.value.slice(5);
        } else {
          if (sel.value === 'finalizat') completeLabStage(c, stage);
          else c.stageStatuses[stage] = sel.value;
        }
        overrides.edits = overrides.edits || {};
        overrides.edits[c.id] = overrides.edits[c.id] || {};
        Object.assign(overrides.edits[c.id], {
          stageStatuses: c.stageStatuses,
          assignees: c.assignees,
          stage: c.stage,
          assignee: c.assignee,
          notStarted: c.notStarted
        });
        saveOverrides(overrides);
        _syncCase(c);
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderPipeline === 'function') renderPipeline();
      }, 'Etapă: ' + (getStage(stage)?.name || stage), { positionAnchor: el.closest('td') || el.closest('.flow') || el });
    });
  });

  // DATE FIELDS — click on .tbl-due, .tbl-due-bold to edit dates
  root.querySelectorAll('.tbl-due, .tbl-due-bold').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      const currentText = el.textContent.trim();
      const isProba = el.previousElementSibling?.textContent?.includes('Probă') || tr.querySelector('th:nth-child(7)')?.textContent === 'Probă';
      // Use prompt for simplicity
      const which = prompt('Schimbă data (format: May 5):\nCurent: ' + currentText, currentText === '—' ? '' : currentText);
      if (which === null) return;
      // Determine which date field based on column position
      const cells = Array.from(tr.children);
      const idx = cells.indexOf(el.closest('td') || el);
      // In table: 0=#, 1=name, 2=clinic, 3=type, 4=fisa, 5=intrata, 6=proba, 7=finala
      const fieldMap = { 5: 'intrata', 6: 'probaDate', 7: 'finala' };
      const tdIdx = cells.indexOf(el.parentElement);
      const field = fieldMap[tdIdx] || 'finala';
      c[field] = which;
      c.deadlineUrgent = labDeadlineStatus(c).urgent;
      c.priority = computePriority(c);
      overrides.edits = overrides.edits || {};
      overrides.edits[c.id] = overrides.edits[c.id] || {};
      overrides.edits[c.id][field] = which;
      overrides.edits[c.id].deadlineUrgent = c.deadlineUrgent;
      overrides.edits[c.id].priority = c.priority;
      saveOverrides(overrides);
      _syncCase(c);
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderPipeline === 'function') renderPipeline();
    });
  });

  // NUME PACIENT — click on .tbl-name to edit name
  root.querySelectorAll('.tbl-name').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      const newName = prompt('Schimbă nume pacient:', c.name);
      if (newName === null || !newName.trim()) return;
      c.name = newName.trim();
      overrides.edits = overrides.edits || {};
      overrides.edits[c.id] = overrides.edits[c.id] || {};
      overrides.edits[c.id].name = c.name;
      saveOverrides(overrides);
      _syncCase(c);
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderPipeline === 'function') renderPipeline();
    });
  });

  // CLINICĂ — click on .tbl-clinic to change clinic
  root.querySelectorAll('.tbl-clinic').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      const items = CLINICS.map(cl => ({ value: cl.id, label: cl.name }));
      openInlinePopover(el, items, sel => {
        c.clinic = sel.value;
        overrides.edits = overrides.edits || {};
        overrides.edits[c.id] = overrides.edits[c.id] || {};
        overrides.edits[c.id].clinic = sel.value;
        saveOverrides(overrides);
        _syncCase(c);
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderPipeline === 'function') renderPipeline();
      }, 'Schimbă clinică');
    });
  });

  // NOTE — click on .tbl-notes to edit notes
  root.querySelectorAll('.tbl-notes').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      const c = getCase(Number(tr.dataset.caseId));
      if (!c) return;
      openInlineNoteEditor(el,c);
    });
  });

  // CAZ # — click on .tbl-num to open case detail
  root.querySelectorAll('.tbl-num').forEach(el => {
    if (el.closest('thead')) return;
    if (el.dataset.editorAttached) return;
    el.dataset.editorAttached = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tr = el.closest('tr,.kb-card');
      if (!tr) return;
      location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });
}

// Hook into existing render functions — call after each render
const _origRenderTable = typeof renderTable === 'function' ? renderTable : null;
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (typeof renderTable === 'function') {
      const orig = renderTable;
      window.renderTable = function() { orig.apply(this, arguments); attachInlineEditors(document.getElementById('tableView')); };
    }
    if (typeof renderPipeline === 'function') {
      const orig = renderPipeline;
      window.renderPipeline = function() { orig.apply(this, arguments); attachInlineEditors(document.getElementById('pipeline')); };
    }
  }, 0);
}

async function initApp(){
  // Login page — just render login form, no auth needed
  if(document.getElementById('loginShell')){renderLogin();return}
  // Auth + data loading
  if(SUPABASE_CONFIGURED){
    const prof=await sbRequireAuth();
    if(!prof)return;
    // Clinic users go straight to their own portal
    if(prof.role==='clinic'&&prof.clinic_id&&!location.pathname.includes('clinic.html')){
      location.href='clinic.html?id='+prof.clinic_id;return;
    }
    const sbCases=await sbLoadCases();
    if(sbCases){
      CASES.length=0;
      sbCases.forEach(c=>{postProcessCase(c);CASES.push(c)});
    }
    sbSubscribeCases(reRenderAll);
  }
  applySidebarRoles();
  updateMainSummary();
  renderClinic();
  renderCaseDetail();
  renderCalendar();
  renderTechnicianPortal();
  renderArchive();
  renderEchipa();
  renderClinici();
  renderTermeniPage();
  renderStats();
  attachSearch();
  attachFilters();
  attachNotifications();
  attachMobileMenu();
  document.getElementById('newCaseBtnGlobal')?.addEventListener('click',()=>openNewCaseModal());
  if(document.getElementById('activityShell'))await renderActivityLog();
  // Re-render table/pipeline after Supabase data loaded (table.js may have rendered with empty data)
  if(SUPABASE_CONFIGURED&&typeof setMainView==='function')setMainView(localStorage.getItem('dental-lab-view')||'table');
}
document.addEventListener('DOMContentLoaded',initApp);
