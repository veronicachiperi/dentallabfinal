/* ==========================================================================
   Table view — Monday-style with 3 stage assignee columns + CSV export
   ========================================================================== */

function renderTable() {
  const root = document.getElementById('tableView');
  if (!root) return;

  const cases = applyFilter(CASES);

  root.innerHTML = `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Pacient</th>
            <th>Clinică</th>
            <th>Tip lucrare</th>
            <th>Etapă</th>
            <th>Design</th>
            <th>Prelucrare</th>
            <th>Ceramică</th>
            <th>Intrată</th>
            <th>Probă</th>
            <th>Finală</th>
            <th>Prioritate</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map(c => renderTableRow(c)).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Row click → case detail (but not when clicking inline selects)
  root.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
      window.location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });

  // Inline assignee select handlers
  root.querySelectorAll('.tbl-assignee-select').forEach(sel => {
    sel.addEventListener('click', e => e.stopPropagation());
    sel.addEventListener('change', e => {
      e.stopPropagation();
      const id = Number(sel.dataset.caseId);
      const stage = sel.dataset.stage;
      const c = getCase(id);
      if (!c) return;
      c.assignees = c.assignees || {};
      c.assignees[stage] = sel.value || null;
      // If updating design and case was notStarted, mark started
      if (stage === 'design' && sel.value) c.notStarted = false;
      // Update overall assignee to current stage's assignee
      if (c.stage === stage) c.assignee = sel.value || c.assignee;

      overrides.edits = overrides.edits || {};
      overrides.edits[c.id] = overrides.edits[c.id] || {};
      overrides.edits[c.id].assignees = c.assignees;
      overrides.edits[c.id].notStarted = c.notStarted;
      saveOverrides(overrides);
    });
  });
}

function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function inlineAssigneeSelect(caseId, stage, currentId) {
  const opts = ['<option value="">—</option>']
    .concat(EMPLOYEES.map(e => `<option value="${e.id}" ${e.id === currentId ? 'selected' : ''}>${e.name}</option>`))
    .join('');
  return `<select class="tbl-assignee-select" data-case-id="${caseId}" data-stage="${stage}">${opts}</select>`;
}

function renderTableRow(c) {
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage);
  const dueClass = c.late ? 'late' : c.warn ? 'warn' : '';
  const finalText = c.late ? 'restant' : c.finala;
  const noteText = (c.notes || '—').replace(/</g, '&lt;');

  return `
    <tr data-case-id="${c.id}">
      <td><span class="tbl-num">#${c.id}</span></td>
      <td><span class="tbl-name">${c.name}</span></td>
      <td><span class="tbl-clinic">${clinic.name}</span></td>
      <td><span class="tag">${c.type}</span></td>
      <td>
        <span class="tbl-pill" style="background:${withAlpha(stage.color, 0.12)}; color:${stage.color}">
          <span class="pdot" style="background:${stage.color}"></span>${stage.name}
        </span>
      </td>
      <td>${inlineAssigneeSelect(c.id, 'design', c.assignees?.design)}</td>
      <td>${inlineAssigneeSelect(c.id, 'prelucrare', c.assignees?.prelucrare)}</td>
      <td>${inlineAssigneeSelect(c.id, 'ceramica', c.assignees?.ceramica)}</td>
      <td><span class="tbl-due">${c.intrata}</span></td>
      <td><span class="tbl-due"><b>${c.probaDate || '—'}</b></span></td>
      <td><span class="tbl-due ${dueClass}"><b>${finalText}</b></span></td>
      <td><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
      <td><span class="tbl-notes" title="${noteText}">${noteText}</span></td>
    </tr>
  `;
}

// CSV export --------------------------------------------------------------
function exportCSV() {
  const cases = applyFilter(CASES);
  const headers = ['ID','Pacient','Clinică','Medic','Tip','Culoare','Etapă','Design','Prelucrare','Ceramică','Intrată','Probă','Finală','Prioritate','Dinți','Implant','Amprentă','Note'];
  const rows = cases.map(c => [
    c.id,
    c.name,
    getClinic(c.clinic).name,
    c.doctor || getClinic(c.clinic).doctor,
    c.type,
    c.color || '',
    getStage(c.stage).name,
    getEmployee(c.assignees?.design)?.name || '',
    getEmployee(c.assignees?.prelucrare)?.name || '',
    getEmployee(c.assignees?.ceramica)?.name || '',
    c.intrata,
    c.probaDate || '',
    c.finala,
    c.priority,
    (c.teeth || []).join(' '),
    c.implantType || '',
    c.amprentaType || '',
    (c.notes || '').replace(/[\r\n]+/g, ' ')
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
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

// View toggle (Tabel / Pipeline) ------------------------------------------
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

  const saved = localStorage.getItem('dental-lab-view') || 'table';
  setMainView(saved);
});