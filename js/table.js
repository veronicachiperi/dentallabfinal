function withAlpha(hex, alpha) {
  const h = hex.replace('#',''); const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const MONTH_NAMES = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

function renderTable() {
  const root = document.getElementById('tableView');
  if (!root) return;
  const filtered = applyFilter(CASES);

  // Group by month of intrata
  const groups = {};
  filtered.forEach(c => {
    const d = parseShortDate(c.intrata);
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}` : 'unknown';
    (groups[key] = groups[key] || []).push(c);
  });
  const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  sortedKeys.forEach(k => {
    groups[k].sort((a,b) => (parseShortDate(a.intrata) || 0) - (parseShortDate(b.intrata) || 0));
    groups[k].forEach((c, i) => c._monthlyNum = i + 1);
  });

  let html = '';
  sortedKeys.forEach(k => {
    const cases = groups[k];
    let monthLabel = 'Necunoscută';
    if (k !== 'unknown') { const [y, m] = k.split('-').map(Number); monthLabel = `${MONTH_NAMES[m]} ${y}`; }
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
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage) || STAGES[0];
  const stageColor = publicStageColor(c);
  const stageLabel = publicStageName(c);
  const stageIcon = c.notStarted ? '' : stageIconSVG(stage.id);
  const deadlineUrgent = labDeadlineStatus(c).urgent;
  const dueClass = c.late || deadlineUrgent ? 'late' : c.warn ? 'warn' : '';
  const finalText = c.late ? 'restant' : c.finala;
  const noteText = (c.notes || '—').replace(/</g, '&lt;');
 return `<tr data-case-id="${c.id}" class="${c.notStarted?'tbl-row-faded':''}">
    <td><span class="tbl-num">#${c._monthlyNum || c.id}</span></td>
    <td><span class="tbl-name">${c.name}</span></td>
    <td><span class="tbl-clinic">${clinic.name}</span></td>
    <td><span class="tag">${c.type}</span></td>
    <td class="tbl-actions-cell"><div class="row-actions"><button class="fisa-btn row-actions-btn" data-row-actions="${c.id}" type="button">Acțiuni ▾</button><div class="row-actions-menu" data-row-menu="${c.id}"><button type="button" data-row-action="edit" data-case-id="${c.id}">Editare rapidă</button><button type="button" data-row-action="pdf" data-case-id="${c.id}">Descarcă PDF</button><button type="button" data-row-action="attach" data-case-id="${c.id}">Atașează fișiere</button><button type="button" data-row-action="view" data-case-id="${c.id}">Deschide cazul</button></div></div></td>
    <td><span class="tbl-due">${c.intrata}</span></td>
    <td><span class="tbl-due-bold">${c.probaDate || '—'}</span></td>
    <td><span class="tbl-due-bold ${dueClass}">${finalText}</span></td>
    <td><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
    <td>${renderFlowIndicator(c)}</td>
    <td><span class="tbl-pill" style="background:${withAlpha(stageColor,0.15)};color:${stageColor}">${stageIcon}<span style="margin-left:${stageIcon?'4px':'0'}">${stageLabel}</span></span></td>
    <td><span class="tbl-notes" title="${noteText}">${noteText}</span></td>
  </tr>`;
}

function renderFlowIndicator(c) {
  const stages = getEtapeLabStages(c.type); // 4 sau 3 etape (skip Ceramică)
  const labels = { design: '1', cam: '2', ceramica: '3', prelucrare: stages.length === 4 ? '4' : '3' };
  let html = '<span class="flow">';
  stages.forEach((sId, i) => {
    const status = c.stageStatuses?.[sId] || 'neincepute';
    const techId = c.assignees?.[sId];
    const tech = techId ? getEmployee(techId) : null;
    if ((status === 'finalizat' || status === 'in_lucru' || status === 'la_proba') && tech) {
      const badge = status === 'finalizat' ? `<span class="substate-badge final">✓</span>` :
                    status === 'la_proba' ? `<span class="substate-badge proba">P</span>` :
                    `<span class="substate-badge lucru">●</span>`;
      html += `<span class="node ${tech.id}" data-case-id="${c.id}" data-stage="${sId}" title="${tech.name} · ${status}">${tech.initials}${badge}</span>`;
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
      if (e.target.closest('.node, .node-em, .fisa-btn, button, .row-actions-menu')) return;
      location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });
  root.querySelectorAll('.node, .node-em').forEach(node => {
    node.addEventListener('click', e => { if(node.dataset.menuAttached)return; e.stopPropagation(); handleStageClick(Number(node.dataset.caseId), node.dataset.stage); });
  });
  root.querySelectorAll('[data-row-actions]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menu = root.querySelector(`[data-row-menu="${btn.dataset.rowActions}"]`);
      root.querySelectorAll('.row-actions-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
      menu?.classList.toggle('open');
    });
  });
  root.querySelectorAll('[data-row-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      root.querySelectorAll('.row-actions-menu.open').forEach(m => m.classList.remove('open'));
      const id=Number(btn.dataset.caseId), c=getCase(id);
      if(!c)return;
      if(btn.dataset.rowAction==='edit')openQuickEdit(id);
      if(btn.dataset.rowAction==='pdf')generateFisaPDF(c);
      if(btn.dataset.rowAction==='attach')chooseFilesForCase(id,()=>renderTable());
      if(btn.dataset.rowAction==='view')location.href=`case.html?id=${id}`;
    });
  });
  if(window.tableActionsCloseHandler)document.removeEventListener('click',window.tableActionsCloseHandler);
  window.tableActionsCloseHandler=e=>{if(!e.target.closest('.row-actions'))root.querySelectorAll('.row-actions-menu.open').forEach(m=>m.classList.remove('open'))};
  document.addEventListener('click',window.tableActionsCloseHandler);
}

function handleStageClick(caseId, stageId) {
  const c = getCase(caseId); if (!c) return;
  const user = getCurrentUser() || { id: 'admin', name: 'Admin', initials: 'AD' };
  c.stageStatuses = c.stageStatuses || {}; c.assignees = c.assignees || {};
  const status = c.stageStatuses[stageId] || 'neincepute';

  // Cycle: neincepute → in_lucru → la_proba → finalizat → (next stage)
  if (status === 'neincepute') {
    c.stageStatuses[stageId] = 'in_lucru';
    if (!c.assignees[stageId]) c.assignees[stageId] = user.id;
    c.notStarted = false;
  } else if (status === 'in_lucru') {
    c.stageStatuses[stageId] = 'la_proba';
  } else if (status === 'la_proba') {
    completeLabStage(c, stageId);
  } else if (status === 'finalizat') {
    if (confirm('Reîncepe această etapă?')) c.stageStatuses[stageId] = 'in_lucru';
    else return;
  }
  overrides.edits = overrides.edits || {}; overrides.edits[c.id] = overrides.edits[c.id] || {};
  Object.assign(overrides.edits[c.id], { stageStatuses: c.stageStatuses, assignees: c.assignees, stage: c.stage, notStarted: c.notStarted, assignee: c.assignee });
  saveOverrides(overrides);
  renderTable();
  if (typeof renderPipeline === 'function') renderPipeline();
}

function exportCSV() {
  const cases = applyFilter(CASES);
  const headers = ['ID','Pacient','Clinică','Medic','Tip','Culoare','Etapă','Intrată','Probă','Finală','Prioritate','Dinți','Implant','Amprentă','Note'];
  const rows = cases.map(c => [c.id, c.name, getClinic(c.clinic).name, c.doctor || getClinic(c.clinic).doctor, c.type, c.color || '', publicStageName(c), c.intrata, c.probaDate || '', c.finala, c.priority, (c.teeth || []).map(t => t.n).join(' '), c.implantType || '', c.amprentaType || '', (c.notes || '').replace(/[\r\n]+/g, ' ')]);
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
  setMainView(localStorage.getItem('dental-lab-view') || 'table');
});
