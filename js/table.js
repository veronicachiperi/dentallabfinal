/* © 2026 Veronica Chiperi — PRIVATE CAD. Cod proprietar / Proprietary code. Toate drepturile rezervate / All rights reserved. Reproducerea, redistribuirea sau crearea unei aplicații similare fără acord scris sunt interzise. */
function withAlpha(hex, alpha) {
  const h = hex.replace('#',''); const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const MONTH_NAMES = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
// MON_SHORT and shortDayMon are now defined in data.js (used on every page).

function renderTable() {
  const root = document.getElementById('tableView');
  if (!root) return;
  assignCaseNumbers();
  const filtered = applyFilter(CASES);

  const groupDate = c => parseShortDate(c.intrata) || parseShortDate(c.finala);
  const groups = {};
  filtered.forEach(c => {
    const d = groupDate(c);
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}` : 'unknown';
    (groups[key] = groups[key] || []).push(c);
  });
  // Newest month first; within each month newest case on top. Numerotarea
  // c.seq rămâne neschimbată (calculată după data Intrată, ascendent global),
  // deci #15 apare sus, #1 jos — ordinea afișării NU afectează numărul.
  const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  sortedKeys.forEach(k => {
    groups[k].sort((a,b) => (groupDate(b) || 0) - (groupDate(a) || 0));
  });

  let html = '';
  sortedKeys.forEach(k => {
    if (k === 'unknown') return;
    const cases = groups[k];
    const [y, m] = k.split('-').map(Number);
    const monthLabel = `${MONTH_NAMES[m]} ${y}`;
    html += `
      <div class="month-section">
        <div class="month-header"><span class="month-name">${monthLabel}</span><span class="month-count">${cases.length} ${cases.length === 1 ? 'lucrare' : 'lucrări'}</span></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th style="width:40px">#</th>
              <th>Nume</th>
              <th>Clinică</th>
              <th>Tip</th>
              <th style="width:94px">Acțiuni</th>
              <th>Intrată</th>
              <th>Probă</th>
              <th>Finală</th>
              <th>Prioritate</th>
              <th style="width:200px">Etape lab</th>
              <th>Etapă</th>
              <th>Notițe</th>
            </tr></thead>
            <tbody>${cases.map(renderTableRow).join('')}</tbody>
          </table>
        </div>
      </div>`;
  });
  if (!sortedKeys.length) html = '<div style="padding:40px;text-align:center;color:var(--text-dim)">Nicio lucrare pentru filtrul curent.</div>';
  root.innerHTML = html;
  attachTableHandlers(root);
}

function renderTableRow(c) {
  const clinic = getClinic(c.clinic) || { name: c.clinic || '—', doctor: '' };
  const stage = getStage(c.stage) || STAGES[0];
  const stageColor = publicStageColor(c);
  const stageLabel = publicStageName(c);
  const stageIcon = c.notStarted ? '' : stageIconSVG(stage.id);
  const deadlineUrgent = labDeadlineStatus(c).urgent;
  const dueClass = c.late || deadlineUrgent ? 'late' : c.warn ? 'warn' : '';
  const finalText = c.late ? 'restant' : shortDayMon(c.finala);
  const parsedNotes=typeof _parseNotes==='function'?_parseNotes(c.notes):[];
  const lastNote=parsedNotes.length?parsedNotes[parsedNotes.length-1].text:'';
  const noteText=lastNote||'—';
  const noteEsc=noteText.replace(/</g,'&lt;');
  const hasNote=parsedNotes.length>0;
 return `<tr data-case-id="${c.id}" class="${c.notStarted?'tbl-row-faded':''}">
    <td><span class="tbl-num">#${c.seq || c.id}</span></td>
    <td><span class="tbl-name">${c.name}</span></td>
    <td><span class="tbl-clinic">${clinic.name}</span></td>
    <td><span class="tag">${c.type}</span></td>
    <td class="tbl-actions-cell"><div class="row-actions"><button class="fisa-btn row-actions-btn" data-row-actions="${c.id}" type="button">Acțiuni ▾</button><div class="row-actions-menu" data-row-menu="${c.id}"><button type="button" data-row-action="edit" data-case-id="${c.id}">Editare completă</button><button type="button" data-row-action="preview-pdf" data-case-id="${c.id}">Previzualizează PDF</button><button type="button" data-row-action="pdf" data-case-id="${c.id}">Descarcă PDF</button><button type="button" data-row-action="attach" data-case-id="${c.id}">Atașează fișiere</button><button type="button" data-row-action="view" data-case-id="${c.id}">Deschide cazul</button>${c.stage==='terminat'?'<button type="button" data-row-action="send" data-case-id="'+c.id+'">Marchează expediat</button>':''}<button type="button" data-row-action="delete" data-case-id="${c.id}" class="danger">Șterge cazul</button></div></div></td>
    <td><span class="tbl-due" data-date-field="intrata">${shortDayMon(c.intrata)}${extractTime(c.intrata)?'<small class="tbl-due-time">'+extractTime(c.intrata)+'</small>':''}</span></td>
    <td><span class="tbl-due-bold" data-date-field="probaDate">${shortDayMon(c.probaDate)}${extractTime(c.probaDate)?'<small class="tbl-due-time">'+extractTime(c.probaDate)+'</small>':''}</span></td>
    <td><span class="tbl-due-bold ${dueClass}" data-date-field="finala">${finalText}${(!c.late&&extractTime(c.finala))?'<small class="tbl-due-time">'+extractTime(c.finala)+'</small>':''}</span></td>
    <td><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
    <td>${renderFlowIndicator(c)}</td>
    <td><span class="tbl-pill" style="background:${withAlpha(stageColor,0.15)};color:${stageColor}">${stageIcon}<span style="margin-left:${stageIcon?'4px':'0'}">${stageLabel}</span></span></td>
    <td><span class="tbl-notes ${hasNote?'has-note':''}" title="${noteEsc}">${noteEsc}</span></td>
  </tr>`;
}

function renderFlowIndicator(c) {
  const stages = getEtapeLabStages(c.type); // 4 sau 3 etape (skip Ceramică)
  const labels = { design: '1', cam: '2', prelucrare: '3', ceramica: '4' };
  const activeStage = probaLabStage(c) || probaApprovedStage(c) || barsWaitingStage(c) || barsReadyStage(c) || (stages.includes(c.stage) ? c.stage : null);
  const activeIndex = c.stage === 'terminat' || c.stage === 'trimis'
    ? stages.length
    : activeStage
      ? stages.indexOf(activeStage)
      : -1;
  let html = '<span class="flow">';
  stages.forEach((sId, i) => {
    let status = c.stageStatuses?.[sId] || 'neincepute';
    let techIds = stageAssignees(c,sId);
    if(!c.notStarted && activeIndex > -1 && i > activeIndex && c.stage !== 'terminat' && c.stage !== 'trimis'){
      status = 'neincepute';
      techIds = [];
    }
    const techs = techIds.map(id=>getEmployee(id)).filter(Boolean);
    const tech = techs[0] || null;
    if ((status === 'finalizat' || status === 'in_lucru' || status === 'la_proba' || status === 'proba_aprobata' || status === 'asteptare_bari' || status === 'bari_finalizate') && tech) {
      const badge = status === 'finalizat' ? `<span class="substate-badge final">✓</span>` :
                    status === 'bari_finalizate' ? `<span class="substate-badge final">✓</span>` :
                    status === 'asteptare_bari' ? `<span class="substate-badge bars">B</span>` :
                    status === 'proba_aprobata' ? `<span class="substate-badge approved">A</span>` :
                    status === 'la_proba' ? `<span class="substate-badge proba">P</span>` :
                    `<span class="substate-badge lucru">●</span>`;
      html += `<span class="node-stack" data-case-id="${c.id}" data-stage="${sId}" title="${techs.map(t=>t.name).join(', ')} · ${status}"><span class="node ${tech.id}" data-case-id="${c.id}" data-stage="${sId}">${tech.initials}${badge}</span>${techs.slice(1,3).map(t=>`<span class="node mini ${t.id}" data-case-id="${c.id}" data-stage="${sId}">${t.initials}</span>`).join('')}</span>`;
    } else if (!c.notStarted && c.stage === sId) {
      html += `<span class="node-current" data-case-id="${c.id}" data-stage="${sId}" title="Etapa curentă · nerevendicată">${labels[sId]}</span>`;
    } else {
      html += `<span class="node-em" data-case-id="${c.id}" data-stage="${sId}" title="Click pentru a începe">${labels[sId]}</span>`;
    }
    if (i < stages.length - 1) {
      const nextStatus = c.stageStatuses?.[stages[i + 1]] || 'neincepute';
      html += `<span class="line ${status === 'finalizat' && nextStatus !== 'neincepute' ? 'done' : ''}"></span>`;
    }
  });
  html += '</span>';
  return html;
}

function attachTableHandlers(root) {
  root.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('.node, .node-stack, .node-em, .fisa-btn, button, .row-actions-menu')) return;
      location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });
  root.querySelectorAll('.node, .node-stack, .node-em, .node-current').forEach(node => {
    node.addEventListener('click', e => { if(node.dataset.menuAttached)return; e.stopPropagation(); handleStageClick(Number(node.dataset.caseId), node.dataset.stage); });
  });
  root.querySelectorAll('[data-row-actions]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menu = root.querySelector(`[data-row-menu="${btn.dataset.rowActions}"]`);
      root.querySelectorAll('.row-actions-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
      if(!menu)return;
      const willOpen=!menu.classList.contains('open');
      menu.classList.toggle('open',willOpen);
      if(willOpen){
        const r=btn.getBoundingClientRect();
        menu.style.left=`${Math.max(8,Math.min(r.left,window.innerWidth-210))}px`;
        menu.style.top=`${Math.min(r.bottom+6,window.innerHeight-260)}px`;
      }
    });
  });
  root.querySelectorAll('[data-row-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      root.querySelectorAll('.row-actions-menu.open').forEach(m => m.classList.remove('open'));
      const id=Number(btn.dataset.caseId), c=getCase(id);
      if(!c)return;
      if(btn.dataset.rowAction==='edit')openQuickEdit(id);
      if(btn.dataset.rowAction==='preview-pdf')previewFisaPDF(c);
      if(btn.dataset.rowAction==='pdf')generateFisaPDF(c);
      if(btn.dataset.rowAction==='attach')chooseFilesForCase(id,()=>renderTable());
      if(btn.dataset.rowAction==='view')location.href=`case.html?id=${id}`;
      if(btn.dataset.rowAction==='send'){
        if(!confirm('Marchezi această lucrare ca expediată?'))return;
        c.stage='trimis';
        c.sentDate=fmtShortDate(todayLabDate());
        if(typeof _syncCase==='function')_syncCase(c);
        renderTable();if(typeof renderPipeline==='function')renderPipeline();
      }
      if(btn.dataset.rowAction==='delete')deleteCase(id);
    });
  });
  if(window.tableActionsCloseHandler)document.removeEventListener('click',window.tableActionsCloseHandler);
  window.tableActionsCloseHandler=e=>{if(!e.target.closest('.row-actions'))root.querySelectorAll('.row-actions-menu.open').forEach(m=>m.classList.remove('open'))};
  document.addEventListener('click',window.tableActionsCloseHandler);
  // Always attach inline editors after table renders
  if(typeof attachInlineEditors==='function')attachInlineEditors(root);
}

function handleStageClick(caseId, stageId) {
  const c = getCase(caseId); if (!c) return;
  const user = getCurrentUser() || { id: 'admin', name: 'Admin', initials: 'AD' };
  c.stageStatuses = c.stageStatuses || {}; c.assignees = c.assignees || {};
  const status = c.stageStatuses[stageId] || 'neincepute';
  let completedStage=false;

  // Design: neincepute → in_lucru → la_proba → finalizat.
  // Restul etapelor: neincepute → in_lucru → finalizat.
    if (status === 'neincepute') {
    if(typeof activateLabStage==='function')activateLabStage(c,stageId,primaryStageAssignee(c,stageId)||user.id);
    else {
      c.stageStatuses[stageId] = 'in_lucru';
      if (!stageAssignees(c,stageId).length) addStageAssignee(c,stageId,user.id);
      c.notStarted = false;
      c.stage = stageId;
      c.assignee = primaryStageAssignee(c,stageId);
    }
  } else if (status === 'in_lucru' && typeof labStageRequiresProbe==='function' && labStageRequiresProbe(stageId)) {
    c.stageStatuses[stageId] = 'la_proba';
    c.stage = 'proba';
    c.notStarted = false;
  } else if (status === 'in_lucru') {
    completeLabStage(c, stageId);
    completedStage=true;
  } else if (status === 'la_proba') {
    completeLabStage(c, stageId);
    completedStage=true;
  } else if (status === 'finalizat') {
    if (confirm('Reîncepe această etapă?')) c.stageStatuses[stageId] = 'in_lucru';
    else return;
  }
  if(typeof syncCaseStageFromLabStatus==='function'&&!completedStage)syncCaseStageFromLabStatus(c,stageId);
  overrides.edits = overrides.edits || {}; overrides.edits[c.id] = overrides.edits[c.id] || {};
  Object.assign(overrides.edits[c.id], { stageStatuses: c.stageStatuses, assignees: c.assignees, stage: c.stage, notStarted: c.notStarted, assignee: c.assignee, finalTech: c.finalTech, completedDate: c.completedDate });
  saveOverrides(overrides);
  // Persist the full case to Supabase so the change reaches every other user.
  if (typeof _syncCase === 'function') _syncCase(c);
  renderTable();
  if (typeof renderPipeline === 'function') renderPipeline();
}

function exportCSV() {
  const cases = applyFilter(CASES);
  const headers = ['ID','Pacient','Clinică','Medic','Tip','Culoare','Etapă','Intrată','Probă','Finală','Prioritate','Dinți','Implant','Amprentă','Note'];
  const rows = cases.map(c => {const notes=(typeof _parseNotes==='function'?_parseNotes(c.notes):[]).map(n=>n.text).join(' | ');const cl=getClinic(c.clinic)||{name:c.clinic||'—',doctor:''};return [c.id, c.name, cl.name, c.doctor || cl.doctor, c.type, c.color || '', publicStageName(c), c.intrata, c.probaDate || '', c.finala, c.priority, (c.teeth || []).map(t => t.n).join(' '), c.implantType || '', c.amprentaType || '', notes]});
  const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `lucrari-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function setMainView(view) {
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('on', t.dataset.view === view));
  const table = document.getElementById('tableView'), pipeline = document.getElementById('pipeline');
  if (!table || !pipeline) return;
  if (view === 'pipeline') { table.style.display = 'none'; pipeline.style.display = 'grid'; renderPipeline(); }
  else { pipeline.style.display = 'none'; table.style.display = 'block'; renderTable(); }
  localStorage.setItem('dental-lab-view', view);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('tableView')) return;
  document.querySelectorAll('.view-tab').forEach(tab => tab.addEventListener('click', () => setMainView(tab.dataset.view)));
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);
  const savedView = localStorage.getItem('dental-lab-view') || 'table';
  if (typeof SUPABASE_CONFIGURED === 'undefined' || !SUPABASE_CONFIGURED) {
    setMainView(savedView);
  } else {
    // Supabase: sync tab+layout immediately so there is no view-switch flash
    // when initApp calls setMainView after data loads
    document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('on', t.dataset.view === savedView));
    const tbl = document.getElementById('tableView'), pipe = document.getElementById('pipeline');
    if (tbl && pipe) {
      tbl.style.display = savedView === 'pipeline' ? 'none' : 'block';
      pipe.style.display = savedView === 'pipeline' ? 'grid' : 'none';
    }
  }
});
