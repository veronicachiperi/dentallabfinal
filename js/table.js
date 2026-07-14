/* © 2026 Veronica Chiperi — PRIVATE CAD. Cod proprietar / Proprietary code. Toate drepturile rezervate / All rights reserved. Reproducerea, redistribuirea sau crearea unei aplicații similare fără acord scris sunt interzise. */
function withAlpha(hex, alpha) {
  const h = hex.replace('#',''); const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const MONTH_NAMES = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
let _expeditedOpen = false; // secțiunea „Expediate" e pliată implicit; reține starea între redări
// MON_SHORT and shortDayMon are now defined in data.js (used on every page).

function renderTable() {
  const root = document.getElementById('tableView');
  if (!root) return;
  assignCaseNumbers();
  const filtered = applyFilter(CASES);

  const tblHeaders = `<thead><tr>
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
  </tr></thead>`;

  const scope = (typeof activeFilter !== 'undefined' && activeFilter.scope) || 'current';

  // Vederea „Expediate" — doar lucrări expediate/anulate, tabel unic.
  if (scope === 'shipped') {
    const _tab = activeFilter.tab;
    activeFilter.tab = 'trimise';
    let exp = applyFilter(CASES);
    activeFilter.tab = _tab;
    exp = exp.slice().sort((a, b) => {
      const da = parseShortDate(a.sentDate || a.completedDate || a.finala) || 0;
      const db = parseShortDate(b.sentDate || b.completedDate || b.finala) || 0;
      return db - da;
    });
    root.innerHTML = exp.length
      ? `<div class="month-section">
          <div class="month-header"><span class="month-name">Expediate</span><span class="month-count">${exp.length} ${exp.length === 1 ? 'lucrare' : 'lucrări'}</span></div>
          <div class="tbl-wrap"><table class="tbl">${tblHeaders}<tbody>${exp.map(renderTableRow).join('')}</tbody></table></div>
        </div>`
      : '<div style="padding:40px;text-align:center;color:var(--text-dim)">Nicio lucrare expediată pentru filtrul curent.</div>';
    attachTableHandlers(root);
    return;
  }

  let html = '';
  const sortMode = (typeof activeFilter !== 'undefined' && activeFilter.sort) || 'default';

  if (sortMode !== 'default') {
    // Sortare globală pe Data Probei sau Data Finală (asc/desc), fără grupare pe luni.
    const field = sortMode.startsWith('proba') ? 'probaDate' : 'finala';
    const dir = sortMode.endsWith('-desc') ? -1 : 1;
    const sorted = filtered.slice().sort((a, b) => {
      const da = parseShortDate(a[field]);
      const db = parseShortDate(b[field]);
      if (!da && !db) return 0;
      if (!da) return 1;          // fără dată — la final, indiferent de direcție
      if (!db) return -1;
      return (da - db) * dir;
    });
    const labels = {
      'proba-asc': 'Data probei — crescător',
      'proba-desc': 'Data probei — descrescător',
      'finala-asc': 'Data finală — crescător',
      'finala-desc': 'Data finală — descrescător'
    };
    html = sorted.length
      ? `<div class="month-section">
          <div class="month-header"><span class="month-name">${labels[sortMode] || 'Sortare'}</span><span class="month-count">${sorted.length} ${sorted.length === 1 ? 'lucrare' : 'lucrări'}</span></div>
          <div class="tbl-wrap"><table class="tbl">${tblHeaders}<tbody>${sorted.map(renderTableRow).join('')}</tbody></table></div>
        </div>`
      : '<div style="padding:40px;text-align:center;color:var(--text-dim)">Nicio lucrare pentru filtrul curent.</div>';
  } else {
    // Default: grupare pe luni după data Intrată (cu fallback pe finală).
    const groupDate = c => parseShortDate(c.intrata) || parseShortDate(c.finala);
    const groups = {};
    filtered.forEach(c => {
      const d = groupDate(c);
      const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}` : 'unknown';
      (groups[key] = groups[key] || []).push(c);
    });
    const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    sortedKeys.forEach(k => {
      groups[k].sort((a,b) => (groupDate(b) || 0) - (groupDate(a) || 0));
    });
    sortedKeys.forEach(k => {
      if (k === 'unknown') return;
      const cases = groups[k];
      const [y, m] = k.split('-').map(Number);
      const monthLabel = `${MONTH_NAMES[m]} ${y}`;
      html += `
        <div class="month-section">
          <div class="month-header"><span class="month-name">${monthLabel}</span><span class="month-count">${cases.length} ${cases.length === 1 ? 'lucrare' : 'lucrări'}</span></div>
          <div class="tbl-wrap"><table class="tbl">${tblHeaders}<tbody>${cases.map(renderTableRow).join('')}</tbody></table></div>
        </div>`;
    });
    if (!sortedKeys.length) html = '<div style="padding:40px;text-align:center;color:var(--text-dim)">Nicio lucrare pentru filtrul curent.</div>';
  }

  // Expediate într-un tabel separat jos — la sortare, la filtrarea pe clinică ȘI
  // la căutarea după clinică/cuvinte cheie. Excepție: dacă cauți după NUMELE
  // pacientului, acel caz expediat apare inline sus (deci îl scoatem de jos ca să
  // nu se dubleze). Lista principală rămâne doar cu lucrări active.
  if (scope === 'all' && activeFilter.tab !== 'trimise') {
    const _tab = activeFilter.tab;
    activeFilter.tab = 'trimise';            // refolosim filtrul (respectă clinică + căutare)
    let expedited = applyFilter(CASES);
    activeFilter.tab = _tab;
    if (activeFilter.q) {
      // cele potrivite pe nume apar deja inline sus — nu le dublăm jos
      expedited = expedited.filter(c => !(typeof caseQueryMatchesName === 'function' && caseQueryMatchesName(c, activeFilter.q)));
    }
    expedited = expedited.slice().sort((a, b) => {
      const da = parseShortDate(a.sentDate || a.completedDate || a.finala) || 0;
      const db = parseShortDate(b.sentDate || b.completedDate || b.finala) || 0;
      return db - da;                        // cele mai recent expediate primele
    });
    const showExpedited = expedited.length > 0 && (activeFilter.clinic !== 'all' || sortMode !== 'default' || !!activeFilter.q);
    if (showExpedited) {
      // Pliabil. Se deschide automat la căutare (ca să vezi rezultatele expediate).
      html += `<details class="month-section expedited-section"${(_expeditedOpen || activeFilter.q) ? ' open' : ''}>
        <summary class="month-header expedited-summary"><span class="month-name">Expediate</span><span class="month-count">${expedited.length} ${expedited.length === 1 ? 'lucrare' : 'lucrări'}</span></summary>
        <div class="tbl-wrap"><table class="tbl">${tblHeaders}<tbody>${expedited.map(renderTableRow).join('')}</tbody></table></div>
      </details>`;
    }
  }

  root.innerHTML = html;
  root.querySelector('.expedited-section')?.addEventListener('toggle', e => { _expeditedOpen = e.target.open; });
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
  const noteText=lastNote||'+ Notiță';
  const noteEsc=noteText.replace(/</g,'&lt;');
  const hasNote=parsedNotes.length>0;
  const rowClasses=[c.notStarted?'tbl-row-faded':'',typeof isCaseBlocked==='function'&&isCaseBlocked(c)?'tbl-row-blocked':''].filter(Boolean).join(' ');
 return `<tr data-case-id="${c.id}" class="${rowClasses}">
    <td class="tc-num" data-label="Nr"><span class="tbl-num">#${c.seq || c.id}</span></td>
    <td class="tc-name" data-label="Pacient"><span class="tbl-name">${c.name}</span></td>
    <td data-label="Clinică"><span class="tbl-clinic">${clinic.name}</span></td>
    <td data-label="Tip"><span class="tag">${c.type}</span></td>
    <td class="tbl-actions-cell tc-actions" data-label="Acțiuni"><div class="row-actions"><button class="fisa-btn row-actions-btn" data-row-actions="${c.id}" type="button">Acțiuni ▾</button><div class="row-actions-menu" data-row-menu="${c.id}"><button type="button" data-row-action="edit" data-case-id="${c.id}">Editare completă</button><button type="button" data-row-action="preview-pdf" data-case-id="${c.id}">Previzualizează PDF</button><button type="button" data-row-action="pdf" data-case-id="${c.id}">Descarcă PDF</button><button type="button" data-row-action="attach" data-case-id="${c.id}">Atașează fișiere</button><button type="button" data-row-action="view" data-case-id="${c.id}">Deschide cazul</button><button type="button" data-row-action="block" data-case-id="${c.id}">Blochează temporar</button><button type="button" data-row-action="archive" data-case-id="${c.id}">Arhivează</button><button type="button" data-row-action="cancel" data-case-id="${c.id}" class="danger">Anulează lucrarea</button><button type="button" data-row-action="reset" data-case-id="${c.id}">Clear all → Neînceput</button>${c.stage==='terminat'?'<button type="button" data-row-action="send" data-case-id="'+c.id+'">Marchează expediat</button>':''}<button type="button" data-row-action="delete" data-case-id="${c.id}" class="danger">Șterge lucrarea</button></div></div></td>
    <td data-label="Intrată"><span class="tbl-due" data-date-field="intrata">${shortDayMon(c.intrata)}${extractTime(c.intrata)?'<small class="tbl-due-time">'+extractTime(c.intrata)+'</small>':''}</span></td>
    <td data-label="Probă"><span class="tbl-due-bold" data-date-field="probaDate">${shortDayMon(c.probaDate)}${extractTime(c.probaDate)?'<small class="tbl-due-time">'+extractTime(c.probaDate)+'</small>':''}</span></td>
    <td data-label="Finală"><span class="tbl-due-bold ${dueClass}" data-date-field="finala">${finalText}${(!c.late&&extractTime(c.finala))?'<small class="tbl-due-time">'+extractTime(c.finala)+'</small>':''}</span></td>
    <td data-label="Prioritate"><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
    <td class="tc-flow" data-label="Etape lab">${renderFlowIndicator(c)}</td>
    <td data-label="Etapă"><span class="tbl-pill" style="background:${withAlpha(stageColor,0.15)};color:${stageColor}">${stageIcon}<span style="margin-left:${stageIcon?'4px':'0'}">${stageLabel}</span></span></td>
    <td class="tc-notes" data-label="Notițe"><span class="tbl-notes ${hasNote?'has-note':'is-empty'}" title="${hasNote?noteEsc:'Adaugă notiță'}">${noteEsc}${parsedNotes.length>1?` <small>+${parsedNotes.length-1}</small>`:''}</span></td>
  </tr>`;
}

function renderFlowIndicator(c) {
  const stages = getEtapeLabStages(c.type); // 4 sau 3 etape (skip Ceramică)
  const labels = { design: '1', cam: '2', prelucrare: '3', ceramica: '4' };
  // Mapare: dacă c.stage este varianta "_finisat" a unei etape de lab,
  // tratăm acea etapă ca finalizată chiar dacă stageStatuses nu e setat.
  const finisatToLab = { print_finisat: 'la_print', cam_finisat: 'cam' };
  const labFromFinisat = finisatToLab[c.stage];
  const activeStage = probaLabStage(c) || probaApprovedStage(c) || barsWaitingStage(c) || barsReadyStage(c) || (stages.includes(c.stage) ? c.stage : null);
  const archived = typeof isCaseArchived === 'function' ? isCaseArchived(c) : c.stage === 'trimis';
  const activeIndex = c.stage === 'terminat' || archived
    ? stages.length
    : activeStage
      ? stages.indexOf(activeStage)
      : -1;
  let html = '<span class="flow">';
  stages.forEach((sId, i) => {
    let status = c.stageStatuses?.[sId] || 'neincepute';
    // Dacă cazul e marcat ca "X_finisat", tratează etapa X ca finalizată.
    if (labFromFinisat === sId) status = 'finalizat';
    // Dacă cazul e la o etapă mai târzie decât asta, marchează asta ca finalizată.
    if (c.stage === 'terminat' || archived) status = 'finalizat';
    let techIds = stageAssignees(c,sId);
    if(!c.notStarted && activeIndex > -1 && i > activeIndex && c.stage !== 'terminat' && !archived && status !== 'finalizat'){
      status = 'neincepute';
      techIds = [];
    }
    const techs = techIds.map(id=>getEmployee(id)).filter(Boolean);
    const tech = techs[0] || null;
    // FINALIZAT cu tehnician → avatar tehnician + badge mic ✓ (procesul vechi).
    // FINALIZAT fără tehnician → cerc verde plin cu ✓ (cazuri marcate manual).
    // EXCEPȚIE: cam și la_print sunt utilaje, NU afișează inițiale chiar dacă există tech asignat.
    const NO_TECH_DISPLAY_STAGES = new Set(['cam','la_print']);
    if ((status === 'finalizat' || status === 'bari_finalizate') && tech && !NO_TECH_DISPLAY_STAGES.has(sId)) {
      const badge = `<span class="substate-badge final">✓</span>`;
      html += `<span class="node-stack" data-case-id="${c.id}" data-stage="${sId}" title="${techs.map(t=>t.name).join(', ')} · finalizat"><span class="node ${tech.id}" data-case-id="${c.id}" data-stage="${sId}">${tech.initials}${badge}</span>${techs.slice(1,3).map(t=>`<span class="node mini ${t.id}" data-case-id="${c.id}" data-stage="${sId}">${t.initials}</span>`).join('')}</span>`;
    } else if (status === 'finalizat' || status === 'bari_finalizate') {
      html += `<span class="node-stack" data-case-id="${c.id}" data-stage="${sId}" title="Etapă finalizată"><span class="node-done" data-case-id="${c.id}" data-stage="${sId}">✓</span></span>`;
    } else if ((status === 'in_lucru' || status === 'la_proba' || status === 'proba_aprobata' || status === 'asteptare_bari') && tech) {
      const badge = status === 'asteptare_bari' ? `<span class="substate-badge bars">B</span>` :
                    status === 'proba_aprobata' ? `<span class="substate-badge approved">A</span>` :
                    status === 'la_proba' ? `<span class="substate-badge proba">P</span>` :
                    `<span class="substate-badge lucru">●</span>`;
      html += `<span class="node-stack" data-case-id="${c.id}" data-stage="${sId}" title="${techs.map(t=>t.name).join(', ')} · ${status}"><span class="node ${tech.id}" data-case-id="${c.id}" data-stage="${sId}">${tech.initials}${badge}</span>${techs.slice(1,3).map(t=>`<span class="node mini ${t.id}" data-case-id="${c.id}" data-stage="${sId}">${t.initials}</span>`).join('')}</span>`;
    } else if (!c.notStarted && c.stage === sId) {
      html += `<span class="node-current" data-case-id="${c.id}" data-stage="${sId}" title="Etapa curentă · click pentru a o revendica">${labels[sId]}</span>`;
    } else {
      html += `<span class="node-em" data-case-id="${c.id}" data-stage="${sId}" title="Click pentru a marca în lucru">${labels[sId]}</span>`;
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
      const name=e.target.closest('.tbl-name');
      if(!name||!tr.contains(name))return;
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
      if(btn.dataset.rowAction==='block')moveCaseToStage(id,'blocat');
      if(btn.dataset.rowAction==='archive')archiveCase(id);
      if(btn.dataset.rowAction==='cancel')archiveCase(id,'anulat');
      if(btn.dataset.rowAction==='reset'&&confirm('Resetezi TOT cazul la „neîncepute"? Toate etapele se pierd.'))resetCaseToNotStarted(c);
      if(btn.dataset.rowAction==='send'){
        archiveCase(id,'trimis');
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

  // Design: neincepute → in_lucru → la_proba → proba_aprobata → finalizat.
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
    if(typeof setLabStageStatus==='function')setLabStageStatus(c,stageId,'la_proba',primaryStageAssignee(c,stageId)||user.id);
    else{c.stageStatuses[stageId] = 'la_proba';c.stage = 'proba';c.notStarted = false;}
  } else if (status === 'in_lucru') {
    completeLabStage(c, stageId);
    completedStage=true;
  } else if (status === 'la_proba') {
    if(typeof setLabStageStatus==='function')setLabStageStatus(c,stageId,'proba_aprobata',primaryStageAssignee(c,stageId)||user.id);
    else{c.stageStatuses[stageId]='proba_aprobata';c.stage=stageId;c.notStarted=false;}
  } else if (status === 'proba_aprobata') {
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
  const filtered = applyFilter(CASES);
  // Exportăm în ACEEAȘI ordine ca afișarea: sortare aleasă sau grupare pe luni.
  const sortMode = (typeof activeFilter !== 'undefined' && activeFilter.sort) || 'default';
  let cases;
  if (sortMode !== 'default') {
    const field = sortMode.startsWith('proba') ? 'probaDate' : 'finala';
    const dir = sortMode.endsWith('-desc') ? -1 : 1;
    cases = filtered.slice().sort((a, b) => {
      const da = parseShortDate(a[field]), db = parseShortDate(b[field]);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return (da - db) * dir;
    });
  } else {
    const groupDate = c => parseShortDate(c.intrata) || parseShortDate(c.finala);
    const groups = {};
    filtered.forEach(c => { const d = groupDate(c); const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}` : 'unknown'; (groups[key] = groups[key] || []).push(c); });
    const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    keys.forEach(k => groups[k].sort((a, b) => (groupDate(b) || 0) - (groupDate(a) || 0)));
    cases = keys.filter(k => k !== 'unknown').flatMap(k => groups[k]);
  }
  const headers = ['ID','Pacient','Clinică','Medic','Tip','Culoare','Etapă','Intrată','Probă','Finală','Prioritate','Dinți','Punți','Implant','Amprentă','Note'];
  const rows = cases.map(c => {const notes=(typeof _parseNotes==='function'?_parseNotes(c.notes):[]).map(n=>n.text).join(' | ');const cl=getClinic(c.clinic)||{name:c.clinic||'—',doctor:''};const punti=(c.bridges||[]).filter(g=>g&&g.length>=2).map(g=>g.join('-')).join(' | ');return [c.id, c.name, cl.name, c.doctor || cl.doctor, c.type, c.color || '', publicStageName(c), c.intrata, c.probaDate || '', c.finala, c.priority, (c.teeth || []).map(t => t.n).join(' '), punti, c.implantType || '', c.amprentaType || '', notes]});
  const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `lucrari-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// === EXPORT PDF listă lucrări (Curente / Expediate / Toate + clinică) ===
function _scopedCasesForExport(scope, clinic) {
  const saved = { tab: activeFilter.tab, clinic: activeFilter.clinic, q: activeFilter.q };
  activeFilter.clinic = clinic || 'all';
  activeFilter.q = ''; // exportul e independent de caseta de căutare
  const gather = tab => { activeFilter.tab = tab; return applyFilter(CASES); };
  let list;
  if (scope === 'shipped') list = gather('trimise');
  else if (scope === 'all') list = gather('all').concat(gather('trimise'));
  else list = gather('all');
  activeFilter.tab = saved.tab; activeFilter.clinic = saved.clinic; activeFilter.q = saved.q;
  const gd = c => parseShortDate(c.intrata) || parseShortDate(c.finala) || 0;
  return list.slice().sort((a, b) => (gd(b) || 0) - (gd(a) || 0));
}

function _buildListPDFHTML(cases, meta) {
  const d = v => { const p = parseShortDate(v); return p ? (typeof shortDayMon === 'function' ? shortDayMon(v) : v) : '—'; };
  const esc = s => String(s == null ? '' : s).replace(/</g, '&lt;');
  const th = 'padding:5px 7px;border:0.5px solid #888;font-size:10px;text-align:left;background:#EEE;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact';
  const td = 'padding:4px 7px;border:0.5px solid #ccc;font-size:10.5px;vertical-align:top';
  const rows = cases.map((c, i) => {
    const cl = getClinic(c.clinic) || { name: c.clinic || '—' };
    return `<tr>
      <td style="${td};text-align:center">${c.seq || i + 1}</td>
      <td style="${td}">${esc(c.name)}</td>
      <td style="${td}">${esc(cl.name)}</td>
      <td style="${td}">${esc(c.type)}</td>
      <td style="${td}">${d(c.intrata)}</td>
      <td style="${td}">${c.noProba ? '—' : d(c.probaDate)}</td>
      <td style="${td}">${d(c.finala)}</td>
      <td style="${td}">${esc(publicStageName(c))}</td>
    </tr>`;
  }).join('');
  return `<div style="font-family:Arial,sans-serif;color:#111;padding:6px;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px">
      <div>
        <div style="font-size:16px;font-weight:700">Lucrări — ${esc(meta.scopeLabel)}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${esc(meta.clinicLabel)} · ${cases.length} ${cases.length === 1 ? 'lucrare' : 'lucrări'}</div>
      </div>
      <div style="font-size:10px;color:#666">PRIVATE CAD · ${new Date().toLocaleDateString('ro-RO')}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${th};width:34px;text-align:center">#</th>
        <th style="${th}">Nume</th>
        <th style="${th}">Clinică</th>
        <th style="${th}">Tip</th>
        <th style="${th}">Intrată</th>
        <th style="${th}">Probă</th>
        <th style="${th}">Finală</th>
        <th style="${th}">Etapă</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="8" style="${td};text-align:center;color:#888;padding:20px">Nicio lucrare.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function exportListPDF(scope, clinic) {
  if (typeof html2pdf === 'undefined') { alert('Librăria PDF nu s-a încărcat'); return; }
  const cases = _scopedCasesForExport(scope, clinic);
  const scopeLabel = scope === 'shipped' ? 'Expediate' : scope === 'all' ? 'Toate' : 'Curente';
  const clinicLabel = clinic === 'all' ? 'Toate clinicile' : (getClinic(clinic)?.name || clinic);
  const w = document.createElement('div');
  w.innerHTML = _buildListPDFHTML(cases, { scopeLabel, clinicLabel });
  w.style.position = 'fixed'; w.style.left = '0'; w.style.top = '0'; w.style.width = '1040px'; w.style.background = '#fff'; w.style.zIndex = '-1';
  document.body.appendChild(w);
  html2pdf().from(w.firstElementChild).set({
    margin: [8, 8, 8, 8],
    filename: `lucrari-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  }).save().finally(() => { document.body.removeChild(w); if (typeof closeModal === 'function') closeModal(); });
}

function openExportPdfDialog() {
  const clinicOpts = `<option value="all">Toate clinicile</option>` +
    CLINICS.map(cl => `<option value="${escAttr(cl.id)}">${escHTML(cl.name)}</option>`).join('');
  openModal(`<div class="modal-head"><div class="modal-title">Export PDF lucrări</div><button class="modal-close" type="button">×</button></div>
    <div class="modal-body">
      <div class="field"><label>Ce exporți</label>
        <div class="scope-seg" id="pdfScopeSeg">
          <button class="scope-btn" data-scope="current" type="button">Curente</button>
          <button class="scope-btn" data-scope="shipped" type="button">Expediate</button>
          <button class="scope-btn" data-scope="all" type="button">Toate</button>
        </div>
      </div>
      <div class="field" style="margin-top:12px"><label>Clinică</label><select id="pdfClinicSel">${clinicOpts}</select></div>
      <div id="pdfCountHint" style="font-size:12px;color:var(--text-dim);margin-top:10px"></div>
    </div>
    <div class="modal-foot"><button class="btn modal-close" type="button">Anulează</button><button class="btn primary" id="pdfDoExport" type="button">Descarcă PDF</button></div>`, '');
  let scope = ['current', 'shipped', 'all'].includes(activeFilter.scope) ? activeFilter.scope : 'current';
  const seg = document.getElementById('pdfScopeSeg');
  const clinicSel = document.getElementById('pdfClinicSel');
  if (clinicSel) clinicSel.value = activeFilter.clinic || 'all';
  const hint = document.getElementById('pdfCountHint');
  const refresh = () => { const n = _scopedCasesForExport(scope, clinicSel?.value || 'all').length; if (hint) hint.textContent = `${n} ${n === 1 ? 'lucrare' : 'lucrări'} în export.`; };
  const syncSeg = () => seg?.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('on', b.dataset.scope === scope));
  seg?.querySelectorAll('.scope-btn').forEach(b => b.addEventListener('click', () => { scope = b.dataset.scope; syncSeg(); refresh(); }));
  syncSeg(); refresh();
  clinicSel?.addEventListener('change', refresh);
  document.getElementById('pdfDoExport')?.addEventListener('click', () => exportListPDF(scope, clinicSel?.value || 'all'));
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
  document.getElementById('exportPdfBtn')?.addEventListener('click', openExportPdfDialog);
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
