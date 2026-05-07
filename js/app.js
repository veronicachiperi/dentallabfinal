const STORAGE_KEY='dental-lab-overrides-v3';
function loadOverrides(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return{}}}
function saveOverrides(o){localStorage.setItem(STORAGE_KEY,JSON.stringify(o))}
const overrides=loadOverrides();
function applyOverrides(){
  if(overrides.stages)Object.entries(overrides.stages).forEach(([id,s])=>{const c=getCase(id);if(c)c.stage=s});
  if(overrides.edits)Object.entries(overrides.edits).forEach(([id,e])=>{const c=getCase(id);if(c)Object.assign(c,e)});
  if(overrides.read)overrides.read.forEach(id=>{const n=NOTIFICATIONS.find(x=>x.id===id);if(n)n.unread=false});
}
applyOverrides();

const activeFilter={tab:'all',clinic:'all'};
function applyFilter(cases){
  const today=new Date(2026,4,4);
  const weekEnd=new Date(today);weekEnd.setDate(today.getDate()+7);
  return cases.filter(c=>{
    const isTrimis=c.stage==='trimis';
    if(activeFilter.tab==='trimise')return isTrimis;
    if(isTrimis)return false;
    if(activeFilter.clinic!=='all'&&c.clinic!==activeFilter.clinic)return false;
    if(activeFilter.tab==='mine'){const u=getCurrentUser();if(!u||c.assignee!==u.id)return false}
    if(activeFilter.tab==='late'&&!c.late)return false;
    if(activeFilter.tab==='week'){const f=parseShortDate(c.finala);if(!f||f<today||f>weekEnd)return false}
    if(activeFilter.tab==='notstarted'&&!c.notStarted)return false;
    return true;
  });
}

// === ROLE-BASED SIDEBAR ===
function applySidebarRoles(){
  const user=getCurrentUser()||{role:'admin',name:'Admin',initials:'AD',id:'admin'};
  const av=document.getElementById('userAvatar');
  if(av)av.textContent=user.initials;
}

// === PIPELINE KANBAN ===
function renderPipeline(){
  const root=document.getElementById('pipeline');
  if(!root)return;
  const cols=['design','cam','prelucrare','ceramica','proba','terminat'];
  root.innerHTML='';
  cols.forEach(stageId=>{
    const stage=getStage(stageId);
    const cases=applyFilter(casesInStage(stageId));
    const col=document.createElement('div');
    col.className='kb-col';col.dataset.stage=stageId;
    col.innerHTML=`<div class="kb-col-head" data-stage="${stageId}"><span class="kb-stage-dot" style="background:${stage.color}"></span><span class="kb-col-name">${stageId==='terminat'?'Finalizat':stage.name}</span><span class="kb-col-count">${cases.length}</span><button class="kb-col-toggle" type="button" title="Restrânge/extinde">▾</button><button class="kb-col-menu" type="button" data-stage="${stageId}" title="Acțiuni">⋯</button></div>`;
    cases.forEach(c=>col.appendChild(renderKanbanCard(c)));
    attachDropZone(col,stageId);
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
}

function renderKanbanCard(c){
  const card=document.createElement('a');
  card.className='kb-card'+(c.late?' late':c.warn?' warn':c.stage==='terminat'?' ready':'');
  card.href=`case.html?id=${c.id}`;card.draggable=true;card.dataset.caseId=c.id;
  const clinic=getClinic(c.clinic);const tech=getEmployee(c.assignee);
  const ss=c.stageStatuses?.[c.stage]||'in_lucru';
  const badge=ss==='finalizat'?`<span class="substate-badge final">✓</span>`:ss==='la_proba'?`<span class="substate-badge proba">P</span>`:`<span class="substate-badge lucru">●</span>`;
  const ft=c.late?'restant':c.stage==='terminat'?'gata':c.finala;
  const fc=c.late?'late':c.stage==='terminat'?'ready':'';
  card.innerHTML=`<div class="kb-card-clinic">${clinic.name}</div><div class="kb-card-name">${c.name}</div><div class="kb-card-row"><span class="kb-tag">${c.type}</span><span class="kb-final ${fc}">${ft}</span></div><div class="kb-card-foot">${tech?`<span class="kb-av ${tech.id}" style="position:relative">${tech.initials}${badge}</span><span class="kb-tehnician-name">${tech.name}</span>`:`<span class="kb-unassigned">— neasignat</span>`}</div>`;
  card.addEventListener('dragstart',e=>{card.style.opacity='0.4';e.dataTransfer.setData('text/plain',String(c.id))});
  card.addEventListener('dragend',()=>card.style.opacity='1');
  return card;
}

function attachDropZone(col,stageId){
  col.addEventListener('dragover',e=>e.preventDefault());
  col.addEventListener('drop',e=>{
    e.preventDefault();
    const id=Number(e.dataTransfer.getData('text/plain'));
    const c=getCase(id);
    if(c&&c.stage!==stageId){
      c.stage=stageId;
      overrides.stages=overrides.stages||{};overrides.stages[c.id]=stageId;saveOverrides(overrides);
      renderPipeline();
      if(typeof renderTable==='function')renderTable();
    }
  });
}

// === CLINIC PORTAL ===
function renderClinic(){
  const root=document.getElementById('clinicShell');
  if(!root)return;
  const clinicId=new URLSearchParams(location.search).get('id')||'crisdent';
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

  const clinicTabs=CLINICS.map(cl=>`<button class="pc-clinic-tab ${cl.id===clinicId?'on':''}" data-clinic-id="${cl.id}">${cl.name}</button>`).join('');

  root.innerHTML=`<div class="pc-shell">
    <div class="pc-topbar">
      <div class="pc-logo">${clinic.name.slice(0,2)}</div>
      <div>
        <div class="pc-clinic-name">${clinic.name}</div>
        <div class="pc-clinic-sub">Portalul clinicii · ${active.length} lucrări active</div>
      </div>
      <div class="spacer"></div>
      <a href="index.html" class="btn">Vezi panoul echipei</a>
      <button class="btn primary" id="newCaseBtnClinic">+ Caz nou</button>
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
        const stage=getStage(c.stage);
        const pct=progressPct(c.stage);
        const stageName=c.stage==='trimis'?'Trimisă':c.stage==='terminat'?'Gata':stage.name;
        return `<div class="pc-row-grid" data-case-id="${c.id}">
          <div class="tbl-num">#${c.id}</div>
          <div class="tbl-name">${c.name}</div>
          <div><span class="tag">${c.type}</span></div>
          <div class="pc-progress-cell">
            <div class="pc-progress-bar"><div class="pc-progress-fill" style="width:${pct}%"></div></div>
            <span class="pc-progress-label">${stageName}</span>
          </div>
          <div class="tbl-due-bold ${c.late?'late':''}">${c.late?'restant':c.finala}</div>
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
}

function handleClinicAction(action,caseId){
  const c=getCase(caseId);if(!c)return;
  if(action==='approve'){
    c.stage='terminat';
    overrides.stages=overrides.stages||{};overrides.stages[c.id]='terminat';saveOverrides(overrides);
    alert('Probă aprobată — lucrarea a trecut la finalizare');renderClinic();
  } else if(action==='pickup'){
    c.stage='trimis';c.sentDate=fmtShortDate(new Date(2026,4,4));
    overrides.stages=overrides.stages||{};overrides.stages[c.id]='trimis';saveOverrides(overrides);
    alert('Ridicare confirmată — lucrarea a fost arhivată');renderClinic();
  } else if(action==='note'){
    const n=prompt('Adaugă notă:');if(n){c.notes=(c.notes||'')+'\n'+n;
      overrides.edits=overrides.edits||{};overrides.edits[c.id]={...overrides.edits[c.id],notes:c.notes};saveOverrides(overrides);
      alert('Notă salvată');
    }
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
  root.innerHTML=`<div class="case-shell"><div class="cd-topbar"><a href="index.html" class="cd-back">← Pipeline</a><div class="spacer"></div><button class="btn" id="editCaseBtn">Editează</button><button class="btn primary" id="advanceStageBtn">Marchează etapă completă →</button></div><div class="cd-head"><div class="cd-clinic-line">${clinic.name} · Caz #${c.id}</div><h1 class="cd-title">${c.name}</h1><div class="cd-doctor">Medic: ${c.doctor||clinic.doctor}</div></div><div class="cd-grid"><div class="cd-main"><div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Detalii caz</span></div><div class="cd-section-body"><div class="cd-kv-grid"><div><div class="cd-kv-label">Tip</div><div class="cd-kv-val"><span class="tag">${c.type}</span></div></div><div><div class="cd-kv-label">Culoare</div><div class="cd-kv-val">${c.color||'—'}</div></div><div><div class="cd-kv-label">Etapă</div><div class="cd-kv-val">${stage.name}</div></div><div><div class="cd-kv-label">Intrată</div><div class="cd-kv-val">${c.intrata}</div></div><div><div class="cd-kv-label">Probă</div><div class="cd-kv-val bold-date">${c.probaDate||'—'}</div></div><div><div class="cd-kv-label">Finală</div><div class="cd-kv-val bold-date ${c.late?'late':''}">${c.finala}</div></div><div><div class="cd-kv-label">Implant</div><div class="cd-kv-val">${c.implantType||'—'}</div></div><div><div class="cd-kv-label">Amprentă</div><div class="cd-kv-val">${c.amprentaType||'—'}</div></div><div><div class="cd-kv-label">Prioritate</div><div class="cd-kv-val">${c.priority}</div></div></div></div></div>${(c.teeth&&c.teeth.length)?`<div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Schema dentară (FDI)</span><span class="cd-section-action">${c.teeth.length} dinți</span></div><div class="cd-section-body"><div class="tc-display-wrap"><div class="tc-display-row">${trow(upper)}</div><div class="tc-display-row">${trow(lower)}</div></div><div class="tc-summary" style="margin-top:10px">${Object.entries(byType).map(([t,n])=>`<div class="tc-summary-line"><span class="tc-sum-mini ${t}"></span><span>${labels[t]}:</span><b>${n.join(', ')}</b></div>`).join('')}</div></div></div>`:''}<div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Fișă de laborator</span></div><div class="fisa-attached"><div class="fisa-icon-pdf">PDF</div><div style="flex:1"><div class="fisa-fname">fisa-${c.id}.pdf</div><div class="fisa-fmeta">A4 · model B</div></div><button class="btn">Înlocuiește</button><button class="btn primary" id="dlFisaBtn">Descarcă</button></div></div><div class="cd-section"><div class="cd-section-head"><span class="cd-section-title">Note & activitate</span></div><div class="cd-section-body"><textarea class="note-form-input" id="noteInput" placeholder="Adaugă o notă..."></textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn">Vizibil doar lab</button><button class="btn primary" id="addNoteBtn">Trimite</button></div><div class="note-list" id="noteList"><div class="note-item"><div class="note-author">${clinic.name.slice(0,2)}</div><div style="flex:1"><div class="note-meta"><b>${c.doctor||clinic.doctor}</b> · acum 2 ore</div><div class="note-text">${c.notes||'Lucrare standard.'}</div></div></div></div></div></div></div><aside class="cd-aside"><div class="aside-section"><h3 class="aside-title">Etape lab</h3><div class="tl-list">${stages.map(sId=>{const s=getStage(sId);const st=c.stageStatuses?.[sId]||'neincepute';const cls=st==='finalizat'?'done':(st==='in_lucru'||st==='la_proba')?'now':'';const t=getEmployee(c.assignees?.[sId]);const m=st==='finalizat'?'finalizat':st==='in_lucru'?'în lucru':st==='la_proba'?'la probă':'în așteptare';return `<div class="tl-item ${cls}"><span class="tl-marker ${cls}"></span><div><div class="tl-name">${s.name}</div><div class="tl-meta">${t?`<span class="tl-tech ${t.id}">${t.initials}</span>`:''}${m}</div></div></div>`}).join('')}</div></div><div class="aside-section"><h3 class="aside-title">Fișiere atașate</h3><div class="file-list"><div class="file-item"><div class="file-icon-mini">STL</div><span class="file-name">amprenta.stl</span><span class="file-size">12 MB</span></div><div class="file-item"><div class="file-icon-mini">PDF</div><span class="file-name">fisa.pdf</span><span class="file-size">84 KB</span></div></div><button class="btn" style="margin-top:10px;width:100%">+ Atașează fișier</button></div></aside></div></div>`;
  document.getElementById('dlFisaBtn')?.addEventListener('click',()=>generateFisaPDF(c));
  document.getElementById('editCaseBtn')?.addEventListener('click',()=>openQuickEdit(c.id));
  document.getElementById('advanceStageBtn')?.addEventListener('click',()=>{
    const next=nextStage(c.stage);if(next===c.stage){alert('Etapă finală deja');return}
    c.stage=next;overrides.stages=overrides.stages||{};overrides.stages[c.id]=next;saveOverrides(overrides);renderCaseDetail();
  });
  document.getElementById('addNoteBtn')?.addEventListener('click',()=>{
    const ta=document.getElementById('noteInput');if(!ta.value.trim())return;
    document.getElementById('noteList').insertAdjacentHTML('afterbegin',`<div class="note-item"><div class="note-author">EU</div><div style="flex:1"><div class="note-meta"><b>Tu</b> · acum</div><div class="note-text">${ta.value}</div></div></div>`);
    ta.value='';
  });
}

// === CALENDAR ===
const MONTH_NAMES_RO=['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
let calMonth=4,calYear=2026,calClinicFilter='all';
function renderCalendar(){
  const root=document.getElementById('calShell');if(!root)return;
  const today=new Date(2026,4,4);
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
  document.getElementById('calToday')?.addEventListener('click',()=>{calMonth=4;calYear=2026;renderCalendar()});
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
  if(!user||user.role!=='tech'){user={id:'mt',name:'Maria T.',initials:'MT',role:'tech'};setCurrentUser(user)}
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
  root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item active" href="tehnician.html"><span class="nav-icon round"></span>Acasă</a><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><div class="nav-section">Setări</div><a class="nav-item" href="login.html"><span class="nav-icon round"></span>Schimbă rol</a></aside><main class="main"><div class="tp-shell"><div class="tp-topbar"><div class="tp-tech-av" style="background:${stageColors[myStage]||'#1D9E75'}">${user.initials}</div><div><div class="tp-tech-name">${user.name}</div><div class="tp-tech-role">Tehnician ${stageName.toLowerCase()}</div></div><div class="spacer"></div><a href="login.html" class="btn">Schimbă rol</a></div><div class="tp-greet"><h1 class="tp-greet-title">Bună, ${user.name.split(' ')[0]}</h1><div class="tp-greet-sub">${myActive.length} lucrări în curs · ${claimable.length} de revendicat</div></div><div class="tp-stats"><div class="tp-stat"><div class="tp-stat-num warn">${myActive.length}</div><div class="tp-stat-lbl">În lucru</div></div><div class="tp-stat"><div class="tp-stat-num">${claimable.length}</div><div class="tp-stat-lbl">De revendicat</div></div><div class="tp-stat"><div class="tp-stat-num good">${completed.length}</div><div class="tp-stat-lbl">Finalizate</div></div><div class="tp-stat"><div class="tp-stat-num late">${lateCount}</div><div class="tp-stat-lbl">În întârziere</div></div></div><div class="tp-section"><div class="tp-section-head"><span class="tp-section-title">În lucru la tine</span><span class="tp-section-count">${myActive.length} lucrări</span></div>${myActive.length?myActive.map(c=>{const cl=getClinic(c.clinic);const st=c.stageStatuses?.[myStage];return `<div class="tp-task-card ${c.late?'late':c.warn?'warn':''}" data-case-id="${c.id}"><div class="tp-task-stage-icon" style="background:${stageColors[myStage]}">${stageName[0]}</div><div class="tp-task-meta"><div class="tp-task-name">${c.name} · ${cl.name}</div><div class="tp-task-info"><b>${c.type}</b>${c.color?' · culoare '+c.color:''}</div></div><div class="tp-task-due"><div class="tp-task-due-bold ${c.late?'late':''}">${c.late?'restant':c.finala}</div><div>finală</div></div><span class="tp-task-status ${st==='la_proba'?'la-proba':'in-lucru'}">${st==='la_proba'?'La probă':'În lucru'}</span><div class="tp-task-actions">${st==='in_lucru'?`<button class="tp-task-btn" data-action="proba" data-case-id="${c.id}" data-stage="${myStage}">La probă</button>`:''}<button class="tp-task-btn primary" data-action="finalize" data-case-id="${c.id}" data-stage="${myStage}">Finalizează</button></div></div>`}).join(''):'<div style="color:var(--text-dim);padding:14px;text-align:center;font-style:italic">Nicio lucrare activă</div>'}</div><div class="tp-section"><div class="tp-section-head"><span class="tp-section-title">Așteaptă să fie revendicate</span><span class="tp-section-count">${claimable.length} lucrări</span></div>${claimable.length?claimable.map(c=>{const cl=getClinic(c.clinic);return `<div class="tp-task-card tp-claimable ${c.late?'late':''}" data-case-id="${c.id}"><div class="tp-task-stage-icon" style="background:${stageColors[myStage]}">${stageName[0]}</div><div class="tp-task-meta"><div class="tp-task-name">${c.name} · ${cl.name}</div><div class="tp-task-info"><b>${c.type}</b>${c.color?' · culoare '+c.color:''}</div></div><div class="tp-task-due"><div class="tp-task-due-bold ${c.late?'late':''}">${c.late?'restant':c.finala}</div><div>finală</div></div><div class="tp-task-actions"><button class="tp-task-btn primary" data-action="claim" data-case-id="${c.id}" data-stage="${myStage}">Pun în proces</button></div></div>`}).join(''):'<div style="color:var(--text-dim);padding:14px;text-align:center;font-style:italic">Nicio lucrare de revendicat</div>'}</div></div></main></div>`;
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
      else if(act==='finalize'){c.stageStatuses[sid]='finalizat';const ms=getEtapeLabStages(c.type);const nx=ms.indexOf(sid)+1;if(nx<ms.length)c.stage=ms[nx];else if(ms.every(s=>c.stageStatuses[s]==='finalizat'))c.stage='proba'}
      overrides.edits=overrides.edits||{};overrides.edits[c.id]=overrides.edits[c.id]||{};
      Object.assign(overrides.edits[c.id],{stageStatuses:c.stageStatuses,assignees:c.assignees,stage:c.stage,notStarted:c.notStarted,assignee:c.assignee});
      saveOverrides(overrides);renderTechnicianPortal();
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
  let h=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">L</div><div class="brand-name">Laborator</div></div><div class="nav-section">Workflow</div><a class="nav-item" href="index.html"><span class="nav-icon"></span>Lucrări</a><a class="nav-item" href="calendar.html"><span class="nav-icon"></span>Calendar</a><a class="nav-item active" href="arhiva.html"><span class="nav-icon"></span>Arhivă</a><a class="nav-item" href="stats.html"><span class="nav-icon"></span>Statistici</a><div class="nav-section">Date</div><a class="nav-item" href="clinici.html"><span class="nav-icon round"></span>Clinici</a><a class="nav-item" href="echipa.html"><span class="nav-icon round"></span>Echipa</a></aside><main class="main" style="padding:0"><div class="ar-shell"><div class="ar-topbar"><div><div class="ar-title">Arhivă lucrări</div><div class="ar-subtitle">${total} lucrări trimise · istoric filtrabil</div></div><div class="spacer"></div><button class="ar-btn" id="arExport">Export CSV</button></div><div class="ar-kpis"><div class="ar-kpi"><div class="ar-kpi-num">${total}</div><div class="ar-kpi-lbl">Lucrări trimise</div></div><div class="ar-kpi"><div class="ar-kpi-num">${avgDays} zile</div><div class="ar-kpi-lbl">Timp mediu</div></div><div class="ar-kpi"><div class="ar-kpi-num">${onTime}%</div><div class="ar-kpi-lbl">La timp</div></div><div class="ar-kpi"><div class="ar-kpi-num">${topCl?getClinic(topCl[0]).name:'—'}</div><div class="ar-kpi-lbl">Clinică top</div><div class="ar-kpi-sub">${topCl?topCl[1]+' lucrări':''}</div></div></div><div class="ar-filters"><div class="ar-filter"><label class="ar-filter-label">Caută pacient</label><input class="ar-input" id="arQ" value="${archiveFilter.q}" placeholder="ex: Bengoi"></div><div class="ar-filter"><label class="ar-filter-label">An</label><select class="ar-select" id="arY"><option value="2026" ${archiveFilter.year==='2026'?'selected':''}>2026</option><option value="2025">2025</option></select></div><div class="ar-filter"><label class="ar-filter-label">Lună</label><select class="ar-select" id="arM"><option value="all">Toate</option>${MONTH_NAMES_RO.map((m,i)=>`<option value="${i}" ${archiveFilter.month===String(i)?'selected':''}>${m}</option>`).join('')}</select></div><div class="ar-filter"><label class="ar-filter-label">Clinică</label><select class="ar-select" id="arC"><option value="all">Toate</option>${CLINICS.map(cl=>`<option value="${cl.id}" ${archiveFilter.clinic===cl.id?'selected':''}>${cl.name}</option>`).join('')}</select></div><div class="ar-filter"><label class="ar-filter-label">Tehnician</label><select class="ar-select" id="arT"><option value="all">Toți</option>${EMPLOYEES.map(e=>`<option value="${e.id}" ${archiveFilter.tech===e.id?'selected':''}>${e.name}</option>`).join('')}</select></div></div>`;
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

// === MODAL + NEW CASE ===
function openModal(content){
  const o=document.createElement('div');o.className='modal-overlay';
  o.innerHTML=`<div class="modal">${content}</div>`;
  o.addEventListener('click',e=>{if(e.target===o)closeModal()});
  document.body.appendChild(o);
  document.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click',closeModal));
  document.addEventListener('keydown',escClose);
}
function closeModal(){document.querySelector('.modal-overlay')?.remove();document.removeEventListener('keydown',escClose)}
function escClose(e){if(e.key==='Escape')closeModal()}

function openNewCaseModal(defClinic){
  const cOpts=CLINICS.map(c=>`<option value="${c.id}" ${c.id===defClinic?'selected':''}>${c.name}</option>`).join('');
  const tOpts=COMMON_TYPES.map(t=>`<option>${t}</option>`).join('');
  const colOpts=COLORS_VITA.map(c=>`<option>${c}</option>`).join('');
  const today=new Date(2026,4,4);const pD=new Date(today);pD.setDate(today.getDate()+5);const fD=new Date(today);fD.setDate(today.getDate()+7);
  const upper=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tooth=n=>`<button type="button" class="tooth-cell" data-tooth="${n}">${n}</button>`;
  const renderRow=arr=>arr.slice(0,8).map(tooth).join('')+'<div class="tc-divider-form"></div>'+arr.slice(8).map(tooth).join('');
  openModal(`<div class="modal-head"><div class="modal-title">Caz nou</div><button class="modal-close" type="button">×</button></div><div class="modal-body"><div class="field-row"><div class="field"><label>Nume</label><input id="ncLast" placeholder="Bengoi" autofocus></div><div class="field"><label>Prenume</label><input id="ncFirst" placeholder="Elvis"></div></div><div class="field-row"><div class="field"><label>Clinică</label><select id="ncClinic">${cOpts}</select></div><div class="field"><label>Medic</label><input id="ncDoctor"></div></div><div class="field-row"><div class="field"><label>Tip</label><select id="ncType">${tOpts}</select></div><div class="field"><label>Culoare</label><select id="ncColor">${colOpts}</select></div></div><div class="field-row three"><div class="field"><label>Intrată</label><input id="ncIntrata" value="${fmtShortDate(today)}"></div><div class="field"><label>Probă</label><input id="ncProba" value="${fmtShortDate(pD)}"></div><div class="field"><label>Finală</label><input id="ncFinala" value="${fmtShortDate(fD)}"></div></div><div class="field"><label>Schema dentară (FDI)</label><div class="tc-form-wrap" id="toothChartWrap"><div class="tc-row-form">${renderRow(upper)}</div><div class="tc-row-form">${renderRow(lower)}</div></div><div class="tc-summary" id="toothSummary"><div style="color:var(--text-dim)">Niciun dinte selectat</div></div></div><div class="field-row"><div class="field"><label>Tip implant</label><input id="ncImplant"></div><div class="field"><label>Tip amprentă</label><select id="ncAmprenta"><option>Silicon</option><option>Polieter</option><option>Alginat</option><option>Digital</option><option>STL</option></select></div></div><div class="field"><label>Note</label><textarea id="ncNotes"></textarea></div></div><div class="modal-foot"><button class="btn modal-close" type="button">Anulează</button><button class="btn primary" id="ncSave" type="button">Salvează</button></div>`);
  const tMap=new Map();
  document.querySelectorAll('#toothChartWrap .tooth-cell').forEach(b=>{
    b.addEventListener('click',e=>{e.stopPropagation();openToothPop(b)});
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
  document.getElementById('ncSave').addEventListener('click',()=>{
    const last=document.getElementById('ncLast').value.trim();const first=document.getElementById('ncFirst').value.trim();
    if(!last&&!first){document.getElementById('ncLast').style.borderColor='#A32D2D';return}
    const teeth=[];tMap.forEach((type,n)=>teeth.push({n:Number(n),type}));
    const nc={id:nextCaseId(),name:(last+' '+first).trim(),lastName:last,firstName:first,clinic:document.getElementById('ncClinic').value,doctor:document.getElementById('ncDoctor').value,type:document.getElementById('ncType').value,color:document.getElementById('ncColor').value,stage:'design',intrata:document.getElementById('ncIntrata').value,probaDate:document.getElementById('ncProba').value,finala:document.getElementById('ncFinala').value,teeth,implantType:document.getElementById('ncImplant').value,amprentaType:document.getElementById('ncAmprenta').value,notes:document.getElementById('ncNotes').value,assignees:{},stageStatuses:{},notStarted:true};
    nc.priority=computePriority(nc);CASES.push(nc);persistNewCase(nc);closeModal();
    if(typeof renderTable==='function')renderTable();renderPipeline();renderClinic();
  });
}

function openQuickEdit(id){
  const c=getCase(id);if(!c)return;
  const stOpts=STAGES.map(s=>`<option value="${s.id}" ${s.id===c.stage?'selected':''}>${s.name}</option>`).join('');
  openModal(`<div class="modal-head"><div class="modal-title">Editare rapidă · ${c.name}</div><button class="modal-close" type="button">×</button></div><div class="modal-body"><div class="field-row"><div class="field"><label>Etapă</label><select id="qeStage">${stOpts}</select></div><div class="field"><label>Tip</label><input id="qeType" value="${c.type}"></div></div><div class="field-row three"><div class="field"><label>Intrată</label><input id="qeI" value="${c.intrata}"></div><div class="field"><label>Probă</label><input id="qeP" value="${c.probaDate||''}"></div><div class="field"><label>Finală</label><input id="qeF" value="${c.finala}"></div></div><div class="field"><label>Note</label><textarea id="qeN">${c.notes||''}</textarea></div></div><div class="modal-foot"><button class="btn modal-close">Anulează</button><button class="btn primary" id="qeSave">Salvează</button></div>`);
  document.getElementById('qeSave').addEventListener('click',()=>{
    c.stage=document.getElementById('qeStage').value;c.type=document.getElementById('qeType').value;
    c.intrata=document.getElementById('qeI').value;c.probaDate=document.getElementById('qeP').value;c.finala=document.getElementById('qeF').value;c.notes=document.getElementById('qeN').value;
    overrides.edits=overrides.edits||{};overrides.edits[c.id]={stage:c.stage,type:c.type,intrata:c.intrata,probaDate:c.probaDate,finala:c.finala,notes:c.notes};
    saveOverrides(overrides);closeModal();renderCaseDetail();if(typeof renderTable==='function')renderTable();renderPipeline();
  });
}

// === PDF MODEL B ===
function buildFisaHTML(c){
  const cl=getClinic(c.clinic);const safe=s=>String(s||'').replace(/</g,'&lt;');
  const upper=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tcell=n=>{const t=(c.teeth||[]).find(x=>x.n===n);const cls=t?t.type:'';const stl=cls==='crown'?'background:#1a1a1a;color:white;border-color:#1a1a1a;font-weight:bold':cls==='implant'?'background:white;color:#1a1a1a;border:1.5px solid #1a1a1a;font-weight:bold':cls==='emax'?'background:#E6F1FB;color:#185FA5;border:1.5px solid #185FA5;font-weight:bold':cls==='veneer'?'background:transparent;color:#1a1a1a;border:1.5px dashed #1a1a1a;font-weight:bold':'';return `<td style="text-align:center;padding:4px 2px;font-size:8px;font-family:monospace;border:0.5px solid #ddd;${stl}">${n}</td>`};
  const trow=arr=>'<tr>'+arr.slice(0,8).map(tcell).join('')+'<td style="border:0;width:6px"></td>'+arr.slice(8).map(tcell).join('')+'</tr>';
  const byType={};(c.teeth||[]).forEach(t=>{(byType[t.type]=byType[t.type]||[]).push(t.n)});
  const labels={crown:'Coroană',implant:'Pe implant',emax:'Emax',veneer:'Fațetă'};
  const swatches={crown:'background:#1a1a1a',implant:'background:white;border:1px solid #1a1a1a',emax:'background:#E6F1FB;border:1px solid #185FA5',veneer:'background:transparent;border:1px dashed #1a1a1a'};
  return `<div style="font-family:Arial,sans-serif;color:#1a1a1a;font-size:11px;line-height:1.5;width:750px"><div style="background:#1a1a1a;color:white;padding:14px 24px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:bold;font-size:14px">LAB CAD · Laborator Dentar</div><div style="font-size:9px;opacity:0.7;margin-top:2px">Chișinău · contact@labdentar.md · +373 22 000 000</div></div><div style="font-family:monospace;font-size:18px;font-weight:bold">#${c.id}</div></div><div style="padding:24px 28px"><div style="margin-bottom:14px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:bold;padding-bottom:4px;border-bottom:1.5px solid #1a1a1a;margin-bottom:8px">Pacient & Clinică</div><div style="display:flex;gap:24px;font-size:10px"><span>Pacient: <b>${safe(c.name)}</b></span><span>Clinică: <b>${safe(cl.name)}</b></span><span>Medic: <b>${safe(c.doctor||cl.doctor)}</b></span></div></div><div style="margin-bottom:14px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:bold;padding-bottom:4px;border-bottom:1.5px solid #1a1a1a;margin-bottom:8px">Date</div><div style="display:flex;gap:24px;font-size:10px"><span>Intrată: <b>${safe(c.intrata)}</b></span><span>Probă: <b>${safe(c.probaDate||'—')}</b></span><span>Finală: <b>${safe(c.finala)}</b></span></div></div><div style="margin-bottom:14px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:bold;padding-bottom:4px;border-bottom:1.5px solid #1a1a1a;margin-bottom:8px">Lucrare</div><div style="display:flex;gap:24px;font-size:10px"><span>Tip: <b>${safe(c.type)}</b></span><span>Culoare: <b>${safe(c.color||'—')}</b></span><span>Amprentă: <b>${safe(c.amprentaType||'—')}</b></span>${c.implantType?`<span>Implant: <b>${safe(c.implantType)}</b></span>`:''}</div></div><div style="margin-bottom:14px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:bold;padding-bottom:4px;border-bottom:1.5px solid #1a1a1a;margin-bottom:8px">Schema dentară (FDI)</div><div style="background:#f5f5f5;padding:10px;border-radius:4px"><table style="border-collapse:collapse;width:100%;table-layout:fixed">${trow(upper)}${trow(lower)}</table>${Object.keys(byType).length?`<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:9px;margin-top:8px">${Object.entries(byType).map(([t,ns])=>`<span><span style="display:inline-block;width:8px;height:8px;${swatches[t]};vertical-align:middle;margin-right:4px"></span>${labels[t]} (${ns.length}): ${ns.sort((a,b)=>a-b).join(', ')}</span>`).join('')}</div>`:''}</div></div><div style="margin-bottom:18px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:bold;padding-bottom:4px;border-bottom:1.5px solid #1a1a1a;margin-bottom:8px">Indicații speciale</div><div style="font-size:10px;min-height:40px">${safe(c.notes||'Fără indicații suplimentare.')}</div></div><div style="display:flex;justify-content:space-between;margin-top:30px"><div style="width:220px"><div style="border-bottom:0.5px solid #1a1a1a;height:24px"></div><div style="font-size:8px;color:#888;margin-top:4px">Semnătura medic clinică</div></div><div style="width:220px"><div style="border-bottom:0.5px solid #1a1a1a;height:24px"></div><div style="font-size:8px;color:#888;margin-top:4px">Semnătura tehnician</div></div></div><div style="text-align:right;font-size:8px;color:#888;margin-top:14px">Emis ${new Date().toLocaleDateString('ro-RO')}</div></div></div>`;
}
function generateFisaPDF(c){
  if(typeof html2pdf==='undefined'){alert('Librăria nu s-a încărcat');return}
  const w=document.createElement('div');w.innerHTML=buildFisaHTML(c);w.style.position='absolute';w.style.left='-9999px';document.body.appendChild(w);
  html2pdf().from(w.firstElementChild).set({margin:0,filename:`fisa-${c.id}-${(c.lastName||c.name).split(' ')[0].toLowerCase()}.pdf`,html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4'}}).save().finally(()=>document.body.removeChild(w));
}

// === LOGIN ===
function renderLogin(){
  const root=document.getElementById('loginShell');if(!root)return;
  const techBtns=EMPLOYEES.map(e=>`<button class="login-role-btn" data-user='${JSON.stringify({id:e.id,name:e.name,initials:e.initials,role:'tech'})}' data-href="tehnician.html"><div class="login-role-icon">${e.initials}</div><div><span class="login-role-name">${e.name}</span><div class="login-role-sub">Tehnician</div></div></button>`).join('');
  const clinicBtns=CLINICS.map(c=>`<button class="login-role-btn" data-user='${JSON.stringify({id:'clinic_'+c.id,name:c.name,initials:c.name.slice(0,2),role:'clinic',clinic:c.id})}' data-href="clinic.html?id=${c.id}"><div class="login-role-icon">${c.name.slice(0,2)}</div><div><span class="login-role-name">${c.name}</span><div class="login-role-sub">${c.doctor}</div></div></button>`).join('');
  root.innerHTML=`<div class="login-shell"><div class="login-box"><div class="login-brand"><div class="login-brand-mark">L</div><div class="login-brand-name">Laborator Dentar</div></div><div class="login-prompt">Continuă ca:</div><button class="login-role-btn" data-user='{"id":"admin","name":"Admin","initials":"AD","role":"admin"}' data-href="index.html"><div class="login-role-icon">AD</div><div><span class="login-role-name">Admin / Manager</span><div class="login-role-sub">Acces complet</div></div></button><div class="login-divider">Tehnicieni</div>${techBtns}<button class="login-role-btn" id="showCl"><div class="login-role-icon">CL</div><div><span class="login-role-name">Reprezentant clinică</span><div class="login-role-sub">Doar cazurile clinicii</div></div></button><div class="login-clinic-select" id="clSel">${clinicBtns}</div><div class="login-divider">demo</div><div class="login-foot">Selectează cine ești</div></div></div>`;
  document.getElementById('showCl')?.addEventListener('click',()=>document.getElementById('clSel').classList.toggle('show'));
  root.querySelectorAll('[data-user]').forEach(b=>b.addEventListener('click',()=>{try{setCurrentUser(JSON.parse(b.dataset.user));location.href=b.dataset.href}catch(e){console.error(e)}}));
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

document.addEventListener('DOMContentLoaded',()=>{
  applySidebarRoles();
  renderClinic();
  renderCaseDetail();
  renderCalendar();
  renderTechnicianPortal();
  renderArchive();
  renderEchipa();
  renderClinici();
  renderStats();
  renderLogin();
  attachSearch();
  attachFilters();
  attachMobileMenu();
  document.getElementById('newCaseBtnGlobal')?.addEventListener('click',()=>openNewCaseModal());
});
