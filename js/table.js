/* ==========================================================================
   Table view — Monday-style spreadsheet of all cases with team handling
   ========================================================================== */

// Derive the team (all employees who have/will work on the case based on stage progression)
const STAGE_OWNER_DEFAULTS = {
  design:    'pc',
  cam:       'ik',
  prelucrare:'vc',
  ceramica:  'mt',
  proba:     'an',
  trimisa:   'an'
};

function getTeam(c) {
  const team = new Set();
  if (c.team && Array.isArray(c.team)) {
    c.team.forEach(id => team.add(id));
  }
  const stageIdx = STAGES.findIndex(s => s.id === c.stage);
  STAGES.slice(0, stageIdx + 1).forEach(s => {
    const id = STAGE_OWNER_DEFAULTS[s.id];
    if (id) team.add(id);
  });
  if (c.assignee) team.add(c.assignee);
  return [...team];
}

// Hex tweak: returns rgba string with given alpha
function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderTable() {
  const root = document.getElementById('tableView');
  if (!root) return;

  const cases = applyFilter(CASES);

  root.innerHTML = `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:60px">#</th>
            <th>Pacient</th>
            <th>Clinică</th>
            <th>Tip lucrare</th>
            <th>Etapă</th>
            <th>Echipa</th>
            <th>Intrată</th>
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

  root.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      window.location.href = `case.html?id=${tr.dataset.caseId}`;
    });
  });
}

function renderTableRow(c) {
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage);
  const team = getTeam(c);
  const teamHtml = team.map(id => {
    const e = getEmployee(id);
    return e ? `<div class="av" title="${e.name}">${e.initials}</div>` : '';
  }).join('');

  const dueClass = c.late ? 'late' : c.warn ? 'warn' : '';
  const dueText = c.late ? 'restant' : c.finala;
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
      <td><div class="tbl-team">${teamHtml}</div></td>
      <td><span class="tbl-due">${c.intrata}</span></td>
      <td><span class="tbl-due ${dueClass}">${dueText}</span></td>
      <td><span class="tbl-prio ${c.priority}">${c.priority}</span></td>
      <td><span class="tbl-notes" title="${noteText}">${noteText}</span></td>
    </tr>
  `;
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

  // Wire up view tabs
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => setMainView(tab.dataset.view));
  });

  // Re-render table when filters change (app.js handles activeFilter, we re-render after)
  document.querySelectorAll('.subbar .tab').forEach(tab => {
    tab.addEventListener('click', () => setTimeout(renderTable, 0));
  });
  document.querySelectorAll('#clinicFilterMenu .chip-menu-item').forEach(item => {
    item.addEventListener('click', () => setTimeout(renderTable, 0));
  });

  // Re-render table on search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#tableView tbody tr').forEach(tr => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });

  // Initial view (restore from localStorage if user previously chose pipeline)
  const saved = localStorage.getItem('dental-lab-view') || 'table';
  setMainView(saved);
});