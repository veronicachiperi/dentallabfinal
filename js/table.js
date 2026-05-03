/* ==========================================================================
   Table view — Monday-style with monthly grouping, stage workflow, PDF column
   ========================================================================== */

function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  // Sort groups by month descending; assign monthly numbers within each
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  sortedKeys.forEach(key => {
    const group = groups[key];
    group.sort((a, b) => (parseShortDate(a.intrata) || 0) - (parseShortDate(b.intrata) || 0));
    group.forEach((c, i) => { c._monthlyNum = i + 1; });
  });

  let html = '';
  sortedKeys.forEach(key => {
    const cases = groups[key];
    let monthLabel = 'Necunoscută';
    if (key !== 'unknown') {
      const [y, m] = key.split('-').map(Number);
      monthLabel = `${MONTH_NAMES[m]} ${y}`;
    }

    html += `
      <div class="month-section">
        <div class="month-header">
          <span class="month-name">${monthLabel}</span>
          <span class="month-count">${cases.length} ${cases.length === 1 ? 'lucrare' : 'lucrări'}</span>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th style="width:50px">#</th>
                <th>Pacient</th>
                <th>Clinică</th>
                <th>Intrată</th>
                <th>Probă</th>
                <th>Finală</th>
                <th>Tip lucrare</th>
                <th>Prioritate</th>
                <th style="width:60px">Fișă</th>
                <th style="width:130px">Design</th>
                <th style="width:130px">Ceramică</th>
                <th style="width:130px">Prelucrare</th>
                <th>Etapă</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${cases.map(c => renderTableRow(c)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  if (!sortedKeys.length) {
    html = '<div style="padding: 40px; text-align: center; color: var(--text-dim);">Nicio lucrare pentru filtrul curent.</div>';
  }

  root.innerHTML = html;
  attachTableHandlers(root);
}

function renderTableRow(c) {
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage) || STAGES[0];
  const dueClass = c.late ? 'late' : c.warn ? 'warn' : '';
  const finalText = c.late ? 'restant' : c.finala;
  const noteText = (c.notes || '—').replace(/</g, '&lt;');

  return `
    <tr data-case-id="${c.id}">
      <td><span class="tbl-num">#${c._monthlyNum || c.id}</span></td>
      <td><span class="tbl-name">${c.name}</span></td>
      <td><span class="tbl-clinic">${clinic.name}</span></td>
      <td><span class="tbl-due">${c.intrata}</span></td>
      <td><span class="tbl-due-bold">${c.probaDate || '—'}</span></td>
      <td><span class="tbl-due-bold ${dueClass}">${finalText}</span></td>
      <td><span class="tag">${c.type}</span></td>
      <td><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
      <td>${renderFisaCell(c)}</td>
      <td>${renderStageCell(c, 'design')}</td>
      <td>${renderStageCell(c, 'ceramica')}</td>
      <td>${renderStageCell(c, 'prelucrare')}</td>
      <td>${renderEtapaCell(stage)}</td>
      <td><span class="tbl-notes" title="${noteText}">${noteText}</span></td>
    </tr>
  `;
}

function renderFisaCell(c) {
  return `<button class="fisa-btn" data-fisa="${c.id}" type="button" title="Descarcă fișa PDF">PDF</button>`;
}

function renderStageCell(c, stageId) {
  const status = c.stageStatuses?.[stageId] || 'neincepute';
  const techId = c.assignees?.[stageId];
  const tech = techId ? getEmployee(techId) : null;

  if (status === 'finalizat') {
    return `
      <div class="stage-cell finalizat" data-case-id="${c.id}" data-stage="${stageId}" title="Click pentru a redeschide">
        <div class="stage-ico done">✓</div>
        ${tech ? `<div class="av-mini" title="${tech.name}">${tech.initials}</div>` : ''}
        <span class="stage-cell-label">Finalizat</span>
      </div>
    `;
  } else if (status === 'in_proces') {
    return `
      <div class="stage-cell in-proces" data-case-id="${c.id}" data-stage="${stageId}" title="Click pentru a marca finalizat">
        <div class="stage-ico working"></div>
        ${tech ? `<div class="av-mini" title="${tech.name}">${tech.initials}</div>` : ''}
        <span class="stage-cell-label">În lucru</span>
      </div>
    `;
  } else {
    return `
      <div class="stage-cell empty" data-case-id="${c.id}" data-stage="${stageId}" title="Click pentru a începe">
        <span class="stage-cell-label">+ Începe</span>
      </div>
    `;
  }
}

function renderEtapaCell(stage) {
  return `
    <span class="tbl-pill" style="background:${withAlpha(stage.color, 0.15)}; color:${stage.color}">
      <span class="stage-icon-inline">${stageIconSVG(stage.id)}</span>${stage.name}
    </span>
  `;
}

function attachTableHandlers(root) {
  root.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('.stage-cell, .fisa-btn, button, select')) return;
      window.location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });

  root.querySelectorAll('.stage-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      e.stopPropagation();
      handleStageAction(Number(cell.dataset.caseId), cell.dataset.stage);
    });
  });

  root.querySelectorAll('.fisa-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const c = getCase(Number(btn.dataset.fisa));
      if (c && typeof generateFisaPDF === 'function') generateFisaPDF(c);
    });
  });
}

function handleStageAction(caseId, stageId) {
  const c = getCase(caseId);
  if (!c) return;
  const user = getCurrentUser() || { id: 'admin', name: 'Admin', initials: 'AD', role: 'admin' };

  c.stageStatuses = c.stageStatuses || {};
  c.assignees = c.assignees || {};
  const status = c.stageStatuses[stageId] || 'neincepute';

  if (status === 'neincepute') {
    c.stageStatuses[stageId] = 'in_proces';
    c.assignees[stageId] = user.id;
    c.notStarted = false;
    if (!c.assignee) c.assignee = user.id;
  } else if (status === 'in_proces') {
    c.stageStatuses[stageId] = 'finalizat';
    // Auto-advance overall stage to next non-finalized
    for (const s of STAGES) {
      const st = c.stageStatuses[s.id];
      if (st !== 'finalizat') { c.stage = s.id; break; }
    }
    // If all stages we track are finalized, mark as terminat → trimis
    const allDone = ['design','ceramica','prelucrare'].every(s => c.stageStatuses[s] === 'finalizat');
    if (allDone && c.stage !== 'trimis') c.stage = 'terminat';
  } else {
    if (confirm('Reîncepe această etapă?')) {
      c.stageStatuses[stageId] = 'in_proces';
    } else return;
  }

  overrides.edits = overrides.edits || {};
  overrides.edits[c.id] = overrides.edits[c.id] || {};
  Object.assign(overrides.edits[c.id], {
    stageStatuses: c.stageStatuses,
    assignees: c.assignees,
    stage: c.stage,
    notStarted: c.notStarted,
    assignee: c.assignee
  });
  saveOverrides(overrides);

  renderTable();
  if (typeof renderPipeline === 'function') renderPipeline();
}

function exportCSV() {
  const cases = applyFilter(CASES);
  const headers = ['ID','Luna #','Pacient','Clinică','Medic','Tip','Culoare','Etapă','Design','Ceramică','Prelucrare','Intrată','Probă','Finală','Prioritate','Dinți','Implant','Amprentă','Note'];
  const rows = cases.map(c => [
    c.id, c._monthlyNum || '',
    c.name, getClinic(c.clinic).name, c.doctor || getClinic(c.clinic).doctor,
    c.type, c.color || '', getStage(c.stage)?.name || '',
    getEmployee(c.assignees?.design)?.name || '',
    getEmployee(c.assignees?.ceramica)?.name || '',
    getEmployee(c.assignees?.prelucrare)?.name || '',
    c.intrata, c.probaDate || '', c.finala, c.priority,
    (c.teeth || []).join(' '), c.implantType || '', c.amprentaType || '',
    (c.notes || '').replace(/[\r\n]+/g, ' ')
  ]);
  const csv = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lucrari-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setMainView(view) {
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('on', t.dataset.view === view);
  });
  const table = document.getElementById('tableView');
  const pipeline = document.getElementById('pipeline');
  if (!table || !pipeline) return;

  if (view === 'pipeline') {
    table.style.display = 'none';
    pipeline.style.display = 'grid';
    if (typeof renderPipeline === 'function') renderPipeline();
  } else {
    pipeline.style.display = 'none';
    table.style.display = 'block';
    renderTable();
  }
  localStorage.setItem('dental-lab-view', view);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('tableView')) return;

  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => setMainView(tab.dataset.view));
  });
  document.querySelectorAll('.subbar .tab').forEach(tab => {
    tab.addEventListener('click', () => setTimeout(renderTable, 0));
  });
  document.querySelectorAll('#clinicFilterMenu .chip-menu-item').forEach(item => {
    item.addEventListener('click', () => setTimeout(renderTable, 0));
  });
  document.getElementById('searchInput')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tableView tbody tr').forEach(tr => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);

  setMainView(localStorage.getItem('dental-lab-view') || 'table');
});