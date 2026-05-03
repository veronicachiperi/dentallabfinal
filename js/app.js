/* ==========================================================================
   App logic — pipeline, clinic portal, case detail, calendar, stats, login
   Plus: filters, drag-and-drop, modal, mobile menu, PDF generation
   ========================================================================== */

const STORAGE_KEY = 'dental-lab-overrides-v1';

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }
const overrides = loadOverrides();

function applyOverrides() {
  if (overrides.proba) {
    Object.entries(overrides.proba).forEach(([id, state]) => {
      const c = getCase(id); if (c) c.probaState = state;
    });
  }
  if (overrides.stages) {
    Object.entries(overrides.stages).forEach(([id, stage]) => {
      const c = getCase(id); if (c) c.stage = stage;
    });
  }
  if (overrides.read) {
    overrides.read.forEach(id => {
      const n = NOTIFICATIONS.find(x => x.id === id); if (n) n.unread = false;
    });
  }
}
applyOverrides();

// =========================================================================
// Filters (pipeline)
// =========================================================================
const activeFilter = { tab: 'all', clinic: 'all' };

function applyFilter(cases) {
  const today = new Date(2026, 4, 2);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  return cases.filter(c => {
    const isTrimis = c.stage === 'trimis';

    if (activeFilter.tab === 'trimise') return isTrimis;
    if (isTrimis) return false; // hide from all other views

    if (activeFilter.clinic !== 'all' && c.clinic !== activeFilter.clinic) return false;
    if (activeFilter.tab === 'mine' && c.assignee !== 'vc') return false;
    if (activeFilter.tab === 'late' && !c.late) return false;
    if (activeFilter.tab === 'week') {
      const fin = parseShortDate(c.finala);
      if (!fin || fin < today || fin > weekEnd) return false;
    }
    if (activeFilter.tab === 'notstarted') {
      if (!c.notStarted && c.assignees?.design) return false;
    }
    return true;
  });
}

// =========================================================================
// Pipeline page (index.html)
// =========================================================================
function renderPipeline() {
  const root = document.getElementById('pipeline');
  if (!root) return;

  root.innerHTML = '';
  STAGES.forEach(stage => {
    const cases = applyFilter(casesInStage(stage.id));
    const col = document.createElement('div');
    col.className = 'col';
    col.dataset.stage = stage.id;
    col.innerHTML = `
      <div class="col-head">
        <span class="stage-dot" style="background:${stage.color}"></span>
        <span class="col-name">${stage.name}</span>
        <span class="col-count">${cases.length}</span>
      </div>
    `;
    cases.forEach(c => col.appendChild(renderCard(c)));
    attachDropZone(col, stage.id);
    root.appendChild(col);
  });

  // Notification panel
  const panel = document.createElement('aside');
  panel.className = 'notif-panel';
  panel.innerHTML = `
    <div class="notif-head">
      <div class="notif-title">Notificări</div>
      <button class="notif-clear" id="markAllRead">Marcare ca citit</button>
    </div>
  `;
  NOTIFICATIONS.forEach(n => panel.appendChild(renderNotif(n)));
  root.appendChild(panel);

  document.getElementById('markAllRead')?.addEventListener('click', () => {
    NOTIFICATIONS.forEach(n => n.unread = false);
    overrides.read = NOTIFICATIONS.map(n => n.id);
    saveOverrides(overrides);
    renderPipeline();
    updateBellDot();
  });

  updateLateBanner();
  updateBellDot();
}

function renderCard(c) {
  const card = document.createElement('a');
  card.className = 'case-card' + (c.late ? ' late' : c.warn ? ' warn' : '');
  card.href = `case.html?id=${c.id}`;
  card.draggable = true;
  card.dataset.caseId = c.id;

  const clinic = getClinic(c.clinic);
  const emp = getEmployee(c.assignee);
  const dueClass = c.late ? 'late' : c.warn ? 'warn' : '';

  let probaPill = '';
  if (c.stage === 'proba' && c.probaState) {
    const label = PROBA_STATES.find(s => s.id === c.probaState).label;
    probaPill = `<span class="proba-pill ${c.probaState}" data-proba="${c.id}"><span class="pdot"></span>${label} · ${c.probaHours || 0}h</span>`;
  }

  const probaDateBadge = c.probaDate
    ? `<div class="date-row"><span class="date-lbl">Probă:</span><span class="date-val">${c.probaDate}</span></div>`
    : '';
  const finalDateBadge = `<div class="date-row"><span class="date-lbl">Finală:</span><span class="date-val ${dueClass}">${c.late ? 'restant' : c.finala}</span></div>`;

  card.innerHTML = `
    <button class="case-menu-btn" type="button" title="Editare rapidă" data-edit="${c.id}">⋯</button>
    <div class="case-meta">
      <span class="case-num">#${c.id}</span><span>·</span><span>${clinic.name}</span>
    </div>
    <div class="case-name">${c.name}</div>
    <div class="case-row">
      <span class="tag">${c.type}</span>
      <span class="tbl-prio ${c.priority}">${c.priority}</span>
      ${probaPill}
    </div>
    <div class="case-dates">
      ${probaDateBadge}
      ${finalDateBadge}
    </div>
    ${emp ? `<div class="case-row" style="margin-top:2px"><div class="av">${emp.initials}</div><span style="font-size:10px;color:var(--text-dim)">${emp.name}</span></div>` : ''}
  `;

  const pill = card.querySelector('[data-proba]');
  if (pill) {
    pill.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const next = nextProbaState(c.probaState);
      c.probaState = next; c.probaHours = 0;
      overrides.proba = overrides.proba || {};
      overrides.proba[c.id] = next;
      saveOverrides(overrides);
      renderPipeline();
    });
  }

  const menuBtn = card.querySelector('[data-edit]');
  if (menuBtn) {
    menuBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      openQuickEdit(c.id);
    });
    menuBtn.addEventListener('mousedown', e => e.stopPropagation());
  }

  card.addEventListener('dragstart', e => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', String(c.id));
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}
function attachDropZone(col, stageId) {
  col.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  });
  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const id = Number(e.dataTransfer.getData('text/plain'));
    const c = getCase(id);
    if (c && c.stage !== stageId) {
      c.stage = stageId;
      if (stageId === 'proba' && !c.probaState) { c.probaState = 'lab'; c.probaHours = 0; }
      overrides.stages = overrides.stages || {};
      overrides.stages[c.id] = stageId;
      saveOverrides(overrides);
      renderPipeline();
    }
  });
}

function renderNotif(n) {
  const item = document.createElement('a');
  item.className = 'n-item' + (n.unread ? ' unread' : '');
  item.href = n.caseId ? `case.html?id=${n.caseId}` : '#';
  item.innerHTML = `
    <div class="n-meta"><span class="pill">${n.kind}</span><span>${n.time}</span></div>
    <div class="n-text">${n.text}</div>
  `;
  return item;
}

function updateLateBanner() {
  const banner = document.getElementById('lateBanner');
  if (!banner) return;
  const lateCount = CASES.filter(c => c.late).length;
  if (lateCount > 0) {
    banner.classList.remove('hidden');
    banner.querySelector('b').textContent = `${lateCount} lucrări în întârziere`;
  } else {
    banner.classList.add('hidden');
  }
}

function updateBellDot() {
  const dot = document.querySelector('.bell-dot');
  if (!dot) return;
  const unread = NOTIFICATIONS.some(n => n.unread);
  dot.style.display = unread ? 'block' : 'none';
}

// Search filter -----------------------------------------------------------
function attachSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.case-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
}

// Filter wiring ----------------------------------------------------------
function attachFilters() {
  const tabs = document.querySelectorAll('.subbar .tab');
  if (!tabs.length) return;

  const tabMap = ['all', 'mine', 'late', 'week', 'notstarted', 'trimise'];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('on'));
      tab.classList.add('on');
      activeFilter.tab = tabMap[i];
      renderPipeline();
    });
  });

  // Clinic dropdown
  const chip = document.getElementById('clinicFilterChip');
  if (chip) {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('clinicFilterMenu').classList.toggle('open');
    });
    document.addEventListener('click', () => {
      document.getElementById('clinicFilterMenu')?.classList.remove('open');
    });
    document.querySelectorAll('#clinicFilterMenu .chip-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        activeFilter.clinic = item.dataset.value;
        chip.textContent = 'Clinică: ' + (item.dataset.value === 'all' ? 'toate' : getClinic(item.dataset.value).name);
        renderPipeline();
      });
    });
  }
}

// Mobile menu toggle ------------------------------------------------------
function attachMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;

  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('show');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  });
}

// =========================================================================
// New case modal
// =========================================================================
function openModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', escClose);
}
function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }

const COMMON_TYPES = [
  'ZR FULL', 'ZR FULL IMPL', 'ZR STR DINTE', 'ZR STR IMPL',
  'PROVIZORIE', 'STANDART', 'EMAX',
  'PMMA DINTI', 'PMMA IMPL', 'PMMA DINTI/IMPL',
  'SUPERIOR', 'SUPERIOR TITAN', 'COMPLEX',
  'MOCKUP', 'MARYLAND', 'MODEL', 'GHID', 'REFACERE', 'incrustatie', 'Capă Bruxism'
];

function openNewCaseModal(defaultClinic) {
  const clinicOpts = CLINICS.map(c =>
    `<option value="${c.id}" ${c.id === defaultClinic ? 'selected' : ''}>${c.name}</option>`
  ).join('');
  const typeOpts = COMMON_TYPES.map(t => `<option>${t}</option>`).join('');

  const today = new Date(2026, 4, 2);
  const probaD = new Date(today); probaD.setDate(today.getDate() + 5);
  const finalD = new Date(today); finalD.setDate(today.getDate() + 7);

  const colorOpts = ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','D2','D3','BL1','BL2','BL3','BL4']
    .map(c => `<option>${c}</option>`).join('');

  const upperRow = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
  const lowerRow = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];
  const toothBtn = n => `<button type="button" class="tooth" data-tooth="${n}">${n}</button>`;

  openModal(`
    <div class="modal-head">
      <div class="modal-title">Caz nou — fișă completă</div>
      <button class="modal-close" type="button">×</button>
    </div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label>Nume pacient</label><input id="ncLastName" placeholder="Bengoi" autofocus></div>
        <div class="field"><label>Prenume</label><input id="ncFirstName" placeholder="Elvis Marius"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Clinică</label><select id="ncClinic">${clinicOpts}</select></div>
        <div class="field"><label>Medic</label><input id="ncDoctor" placeholder="Dr. Popescu A."></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tip lucrare</label><select id="ncType">${typeOpts}</select></div>
        <div class="field"><label>Culoare</label><select id="ncColor">${colorOpts}</select></div>
      </div>
      <div class="field-row" style="grid-template-columns: 1fr 1fr 1fr">
        <div class="field"><label>Data intrării</label><input id="ncIntrata" value="${fmtShortDate(today)}"></div>
        <div class="field"><label>Data probei</label><input id="ncProbaDate" value="${fmtShortDate(probaD)}"></div>
        <div class="field"><label>Data finală</label><input id="ncFinala" value="${fmtShortDate(finalD)}"></div>
      </div>
      <div class="field">
        <label>Schema dentară (FDI) — click pe dinți pentru a-i selecta</label>
        <div class="tooth-chart-form">
          <div class="tooth-row">
            ${upperRow.slice(0,8).map(toothBtn).join('')}
            <div class="tooth-divider"></div>
            ${upperRow.slice(8).map(toothBtn).join('')}
          </div>
          <div class="tooth-row">
            ${lowerRow.slice(0,8).map(toothBtn).join('')}
            <div class="tooth-divider"></div>
            ${lowerRow.slice(8).map(toothBtn).join('')}
          </div>
        </div>
        <div id="selectedTeethDisplay" class="selected-teeth-display">Niciun dinte selectat</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tip implant</label><input id="ncImplant" placeholder="Straumann, Nobel, AlphaBio..."></div>
        <div class="field"><label>Tip amprentă</label><input id="ncAmprenta" placeholder="Silicon, digital, alginat..."></div>
      </div>
      <div class="field">
        <label>Note generale</label>
        <textarea id="ncNotes" placeholder="Detalii suplimentare, indicații..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn modal-close" type="button">Anulează</button>
      <button class="btn primary" id="ncSave" type="button">Salvează caz</button>
    </div>
  `);

  const selectedTeeth = new Set();
  const display = document.getElementById('selectedTeethDisplay');
  document.querySelectorAll('.tooth-chart-form .tooth').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tooth;
      if (selectedTeeth.has(t)) { selectedTeeth.delete(t); btn.classList.remove('selected'); }
      else { selectedTeeth.add(t); btn.classList.add('selected'); }
      const sorted = [...selectedTeeth].map(Number).sort((a,b) => a - b);
      display.textContent = sorted.length ? 'Dinți selectați: ' + sorted.join(', ') : 'Niciun dinte selectat';
    });
  });

  document.getElementById('ncSave').addEventListener('click', () => {
    const last = document.getElementById('ncLastName').value.trim();
    const first = document.getElementById('ncFirstName').value.trim();
    if (!last && !first) { document.getElementById('ncLastName').style.borderColor = '#A32D2D'; return; }
    const fullName = (last + ' ' + first).trim();

    const newCase = {
      id: nextCaseId(),
      name: fullName,
      lastName: last,
      firstName: first,
      clinic: document.getElementById('ncClinic').value,
      doctor: document.getElementById('ncDoctor').value,
      type: document.getElementById('ncType').value,
      color: document.getElementById('ncColor').value,
      stage: 'design',
      priority: 'mediu',
      intrata: document.getElementById('ncIntrata').value,
      probaDate: document.getElementById('ncProbaDate').value,
      finala: document.getElementById('ncFinala').value,
      teeth: [...selectedTeeth].map(Number).sort((a,b) => a - b),
      implantType: document.getElementById('ncImplant').value,
      amprentaType: document.getElementById('ncAmprenta').value,
      notes: document.getElementById('ncNotes').value,
      assignees: {},
      stageStatuses: {},
      notStarted: true
    };
    newCase.priority = computePriority(newCase);

    CASES.push(newCase);
    persistNewCase(newCase);
    closeModal();
    renderPipeline();
    renderClinic();
    if (typeof renderTable === 'function') renderTable();
  });
}

  // Tooth selection
  const selectedTeeth = new Set();
  const display = document.getElementById('selectedTeethDisplay');
  document.querySelectorAll('.tooth-chart-form .tooth').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tooth;
      if (selectedTeeth.has(t)) {
        selectedTeeth.delete(t);
        btn.classList.remove('selected');
      } else {
        selectedTeeth.add(t);
        btn.classList.add('selected');
      }
      const sorted = [...selectedTeeth].map(Number).sort((a,b) => a - b);
      display.textContent = sorted.length ? 'Dinți selectați: ' + sorted.join(', ') : 'Niciun dinte selectat';
    });
  });

  document.getElementById('ncSave').addEventListener('click', () => {
    const last = document.getElementById('ncLastName').value.trim();
    const first = document.getElementById('ncFirstName').value.trim();
    if (!last && !first) {
      document.getElementById('ncLastName').style.borderColor = '#A32D2D';
      return;
    }
    const fullName = (last + ' ' + first).trim();
    const designAssignee = document.getElementById('ncAssigneeDesign').value || null;
    const ceramAssignee = document.getElementById('ncAssigneeCeram').value || null;

    const newCase = {
      id: nextCaseId(),
      name: fullName,
      lastName: last,
      firstName: first,
      clinic: document.getElementById('ncClinic').value,
      doctor: document.getElementById('ncDoctor').value,
      type: document.getElementById('ncType').value,
      color: document.getElementById('ncColor').value,
      stage: 'design',
      priority: 'mediu',
      intrata: document.getElementById('ncIntrata').value,
      probaDate: document.getElementById('ncProbaDate').value,
      finala: document.getElementById('ncFinala').value,
      teeth: [...selectedTeeth].map(Number).sort((a,b) => a - b),
      implantType: document.getElementById('ncImplant').value,
      amprentaType: document.getElementById('ncAmprenta').value,
      notes: document.getElementById('ncNotes').value,
      assignee: designAssignee,
      assignees: { design: designAssignee, ceramica: ceramAssignee },
      notStarted: !designAssignee
    };
    newCase.priority = computePriority(newCase);

    CASES.push(newCase);
    persistNewCase(newCase);
    closeModal();
    renderPipeline();
    renderClinic();
    if (typeof renderTable === 'function') renderTable();
  });
};
function renderClinic() {
  const root = document.getElementById('clinicShell');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const clinicId = params.get('id') || 'crisdent';
  const clinic = getClinic(clinicId);
  if (!clinic) { root.innerHTML = '<p>Clinică inexistentă.</p>'; return; }

  const cases = casesForClinic(clinicId);
  const active = cases.filter(c => c.stage !== 'trimisa');
  const proba = cases.filter(c => c.stage === 'proba');
  const ready = cases.filter(c => c.stage === 'trimisa');
  const late  = cases.filter(c => c.late);

  const switcher = CLINICS.map(c =>
    `<a class="chip" href="clinic.html?id=${c.id}" style="${c.id === clinicId ? 'background:var(--accent);color:var(--bg);border-color:var(--accent)' : ''}">${c.name}</a>`
  ).join(' ');

  root.innerHTML = `
    <div class="clinic-head">
      <div class="clinic-logo">${clinic.name.slice(0,2)}</div>
      <div>
        <div class="clinic-name">${clinic.name}</div>
        <div class="clinic-sub">Portalul clinicii · ${active.length} lucrări active</div>
      </div>
      <div class="spacer"></div>
      <a href="index.html" class="btn">Vezi panoul echipei</a>
      <button class="btn primary" id="newCaseBtn">+ Caz nou</button>
    </div>

    <div style="margin-bottom: 16px; display:flex; gap: 6px; flex-wrap:wrap;">
      ${switcher}
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${active.length}</div><div class="stat-lbl">Active</div></div>
      <div class="stat-card"><div class="stat-num">${proba.length}</div><div class="stat-lbl">La probă</div></div>
      <div class="stat-card"><div class="stat-num">${ready.length}</div><div class="stat-lbl">Gata de ridicat</div></div>
      <div class="stat-card"><div class="stat-num ${late.length ? 'late' : ''}">${late.length}</div><div class="stat-lbl">În întârziere</div></div>
    </div>

    <div class="cases-table">
      <div class="row-grid head">
        <div>Caz</div><div>Pacient</div><div>Tip lucrare</div><div>Etapă</div><div>Finală</div><div></div>
      </div>
      ${cases.map(c => renderClinicRow(c)).join('')}
    </div>
  `;

  document.getElementById('newCaseBtn')?.addEventListener('click', () => openNewCaseModal(clinicId));
}

function renderClinicRow(c) {
  const stage = getStage(c.stage);
  const stageOrder = stage.order;
  const totalStages = STAGES.length;
  const pct = Math.round((stageOrder / totalStages) * 100);
  const isDone = c.stage === 'trimisa';
  const dueClass = c.late ? 'late' : '';
  const action = c.stage === 'proba' && c.probaState === 'clinic'
    ? 'Aprobă probă'
    : isDone ? 'Confirmă primire' : 'Adaugă notă';

  return `
    <a href="case.html?id=${c.id}" class="row-grid">
      <div class="row-num">#${c.id}</div>
      <div class="row-name">${c.name}</div>
      <div><span class="tag">${c.type}</span></div>
      <div class="row-stage">
        <div class="progress-bar"><span class="${isDone ? 'done' : ''}" style="width:${pct}%"></span></div>
        ${stage.name}
      </div>
      <div class="row-due ${dueClass}">${c.late ? 'restant' : c.finala}</div>
      <button class="row-action" type="button">${action}</button>
    </a>
  `;
}

// =========================================================================
// Case detail page (case.html)
// =========================================================================
function renderCaseDetail() {
  const root = document.getElementById('caseShell');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('id');
  const c = getCase(caseId);
  if (!c) { root.innerHTML = '<p>Caz inexistent. <a href="index.html">Înapoi</a></p>'; return; }

  const clinic = getClinic(c.clinic);
  const emp = getEmployee(c.assignee);
  const stage = getStage(c.stage);

  const timeline = STAGES.map(s => {
    let cls = 'pending';
    if (s.order < stage.order) cls = 'done';
    else if (s.order === stage.order) cls = 'now';
    return { ...s, cls };
  });

  root.innerHTML = `
    <a href="index.html" class="case-back">← Pipeline</a>

    <div class="case-head" style="margin-top:8px">
      <div>
        <h1 class="case-title">${c.name} <span class="case-id">#${c.id}</span></h1>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
          ${clinic.name} · ${clinic.doctor}
        </div>
      </div>
      <div class="spacer"></div>
      <button class="btn">Editează</button>
      <button class="btn primary" id="advanceStageBtn">Etapă următoare →</button>
    </div>

    <div class="case-grid">
      <div>
        <div class="section">
          <div class="section-head"><div class="section-title">Detalii caz</div></div>
          <div class="section-body">
            <div class="kv-grid">
              <div><div class="kv-label">Tip lucrare</div><div class="kv-val">${c.type}</div></div>
              <div><div class="kv-label">Etapa curentă</div><div class="kv-val"><span class="stage-dot" style="background:${stage.color};display:inline-block;margin-right:6px"></span>${stage.name}</div></div>
              <div><div class="kv-label">Intrată</div><div class="kv-val">${c.intrata}</div></div>
              <div><div class="kv-label">Finală</div><div class="kv-val ${c.late ? 'row-due late' : ''}">${c.finala}${c.late ? ' (restant)' : ''}</div></div>
              <div><div class="kv-label">Prioritate</div><div class="kv-val">${c.priority}</div></div>
              <div><div class="kv-label">Tehnician</div><div class="kv-val">${emp ? emp.name : '—'}</div></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><div class="section-title">Fișă de laborator</div></div>
          <div class="section-body" id="fisaSection">
            ${renderFisaSection(c)}
          </div>
        </div>

        <div class="section">
          <div class="section-head"><div class="section-title">Note & activitate</div></div>
          <div class="section-body">
            <textarea class="note-input" id="noteInput" placeholder="Adaugă o notă pentru echipă sau clinică…"></textarea>
            <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
              <button class="btn">Vizibil doar în lab</button>
              <button class="btn primary" id="addNoteBtn">Trimite notă</button>
            </div>
            <div class="note-list" id="noteList">
              ${renderNotesFor(c)}
            </div>
          </div>
        </div>
      </div>

      <aside>
        <div class="aside-section">
          <h3 class="aside-title">Timeline etape</h3>
          <div class="timeline">
            ${timeline.map(s => `
              <div class="timeline-item">
                <span class="tl-marker ${s.cls}"></span>
                <div>
                  <div class="tl-name">${s.name}</div>
                  <div class="tl-meta">${s.cls === 'done' ? 'finalizat' : s.cls === 'now' ? 'în curs' : 'în așteptare'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${c.stage === 'proba' ? `
        <div class="aside-section">
          <h3 class="aside-title">Status probă</h3>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${PROBA_STATES.map(s => `
              <button class="btn" data-set-proba="${s.id}" style="${s.id === c.probaState ? 'background:var(--accent);color:var(--bg);border-color:var(--accent)' : ''}">${s.label}</button>
            `).join('')}
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:8px">
            ${c.probaHours || 0}h în starea curentă
          </div>
        </div>
        ` : ''}

        <div class="aside-section">
          <h3 class="aside-title">Fișiere atașate</h3>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
            <div>amprenta.stl <span style="color:var(--text-dim)">· 12 MB</span></div>
            <div>fisa.pdf <span style="color:var(--text-dim)">· 84 KB</span></div>
            <div>proba_foto.jpg <span style="color:var(--text-dim)">· 2.1 MB</span></div>
          </div>
          <button class="btn" style="margin-top:10px;width:100%">+ Atașează fișier</button>
        </div>
      </aside>
    </div>
  `;

  document.querySelectorAll('[data-set-proba]').forEach(btn => {
    btn.addEventListener('click', () => {
      c.probaState = btn.dataset.setProba;
      c.probaHours = 0;
      overrides.proba = overrides.proba || {};
      overrides.proba[c.id] = c.probaState;
      saveOverrides(overrides);
      renderCaseDetail();
    });
  });

  document.getElementById('advanceStageBtn')?.addEventListener('click', () => {
    const next = nextStage(c.stage);
    if (next === c.stage) return;
    c.stage = next;
    if (next === 'proba' && !c.probaState) { c.probaState = 'lab'; c.probaHours = 0; }
    overrides.stages = overrides.stages || {};
    overrides.stages[c.id] = next;
    saveOverrides(overrides);
    renderCaseDetail();
  });

  document.getElementById('generateFisaBtn')?.addEventListener('click', () => generateFisaPDF(c));

  document.getElementById('addNoteBtn')?.addEventListener('click', () => {
    const ta = document.getElementById('noteInput');
    if (!ta.value.trim()) return;
    if (!c._notes) c._notes = [];
    c._notes.unshift({
      author: 'Tu',
      initials: 'EU',
      time: 'acum câteva secunde',
      text: ta.value.trim()
    });
    ta.value = '';
    document.getElementById('noteList').innerHTML = renderNotesFor(c);
  });
}

function renderFisaSection(c) {
  const hasFisa = c.id % 2 === 0;
  if (hasFisa) {
    return `
      <div class="fisa-attached">
        <div class="fisa-attached-icon">PDF</div>
        <div style="flex:1">
          <div class="fisa-attached-name">fisa-${c.id}-${c.name.split(' ')[0].toLowerCase()}.pdf</div>
          <div class="fisa-attached-meta">84 KB · încărcat de ${getClinic(c.clinic).name} · acum 2 zile</div>
        </div>
        <button class="btn">Înlocuiește</button>
        <button class="btn">Descarcă</button>
      </div>
    `;
  }
  return `
    <div class="fisa-options">
      <div class="fisa-opt">
        <div class="fisa-opt-icon">↑</div>
        <div class="fisa-opt-title">Încarcă fișă PDF</div>
        <div class="fisa-opt-sub">Trage fișierul aici<br>sau răsfoiește · max 10 MB</div>
        <button class="btn">Selectează fișier</button>
      </div>
      <div class="fisa-opt solid">
        <div class="fisa-opt-icon">★</div>
        <div class="fisa-opt-title">Generează din date</div>
        <div class="fisa-opt-sub">Construiește automat fișa<br>din câmpurile cazului</div>
        <button class="btn primary" id="generateFisaBtn">Generează PDF</button>
      </div>
    </div>
  `;
}

function renderNotesFor(c) {
  const seed = [
    { author: clinicAuthor(c), initials: getClinic(c.clinic).name.slice(0,2), time: 'acum 2 ore', text: c.notes || 'Lucrare standard.' },
    { author: getEmployee(c.assignee)?.name || 'Lab', initials: getEmployee(c.assignee)?.initials || 'LB', time: 'ieri', text: 'Pornit etapa ' + getStage(c.stage).name + '.' }
  ];
  const all = (c._notes || []).concat(seed);
  return all.map(n => `
    <div class="note-item">
      <div class="note-author">${n.initials}</div>
      <div class="note-body">
        <div class="note-meta"><b>${n.author}</b> · ${n.time}</div>
        <div class="note-text">${n.text}</div>
      </div>
    </div>
  `).join('');
}

function clinicAuthor(c) { return getClinic(c.clinic).doctor; }

// =========================================================================
// Calendar page (calendar.html)
// =========================================================================
let calMonth = 4; // May (0-indexed)
let calYear = 2026;

function renderCalendar() {
  const root = document.getElementById('calShell');
  if (!root) return;

  const monthNames = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  const weekdays = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];
  const today = new Date(2026, 4, 2);

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    const date = new Date(calYear, calMonth, dayNum);
    const isOutside = dayNum < 1 || dayNum > daysInMonth;
    cells.push({ date, isOutside });
  }

  const casesByDate = {};
  CASES.forEach(c => {
    const fin = parseShortDate(c.finala);
    if (fin) {
      const key = fin.toDateString();
      if (!casesByDate[key]) casesByDate[key] = [];
      casesByDate[key].push(c);
    }
  });

  root.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav-btn" id="calPrev" type="button">←</button>
      <div class="cal-month">${monthNames[calMonth]} ${calYear}</div>
      <button class="cal-nav-btn" id="calNext" type="button">→</button>
      <div class="spacer"></div>
      <a href="index.html" class="btn">Pipeline</a>
    </div>
    <div class="cal-grid">
      ${weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
      ${cells.map(cell => {
        const isToday = cell.date.toDateString() === today.toDateString();
        const cls = (cell.isOutside ? 'outside ' : '') + (isToday ? 'today' : '');
        const dateCases = casesByDate[cell.date.toDateString()] || [];
        return `
          <div class="cal-day ${cls}">
            <div class="cal-day-num">${cell.date.getDate()}</div>
            <div class="cal-day-cases">
              ${dateCases.slice(0, 3).map(c => `
                <a href="case.html?id=${c.id}" class="cal-case ${c.late ? 'late' : c.warn ? 'warn' : ''}">${c.name}</a>
              `).join('')}
              ${dateCases.length > 3 ? `<div style="font-size:9px;color:var(--text-dim);margin-top:2px">+${dateCases.length - 3} alte</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('calPrev')?.addEventListener('click', () => {
    if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--;
    renderCalendar();
  });
  document.getElementById('calNext')?.addEventListener('click', () => {
    if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++;
    renderCalendar();
  });
}

// =========================================================================
// Statistics page (stats.html)
// =========================================================================
function renderStats() {
  const root = document.getElementById('statsShell');
  if (!root) return;

  const onTime = statsOnTimeRate();
  const avgDays = statsAvgDays();

  root.innerHTML = `
    <div class="stats-head">
      <div class="stats-title">Statistici</div>
      <div class="spacer"></div>
      <a href="index.html" class="btn">Pipeline</a>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-num">${CASES.length}</div><div class="kpi-lbl">Total cazuri</div><div class="kpi-sub">active în sistem</div></div>
      <div class="kpi"><div class="kpi-num ${onTime.late > 0 ? 'late' : 'good'}">${onTime.rate}%</div><div class="kpi-lbl">Livrate la timp</div><div class="kpi-sub">${onTime.onTime} din ${onTime.total}</div></div>
      <div class="kpi"><div class="kpi-num info">${avgDays}</div><div class="kpi-lbl">Zile medie</div><div class="kpi-sub">de la intrare la trimitere</div></div>
      <div class="kpi"><div class="kpi-num">${CLINICS.length}</div><div class="kpi-lbl">Clinici active</div></div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">Cazuri pe etapă</div>
        <div class="chart-container"><canvas id="chartStage"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Cazuri pe clinică</div>
        <div class="chart-container"><canvas id="chartClinic"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Top tipuri lucrări</div>
        <div class="chart-container"><canvas id="chartType"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Livrare la timp</div>
        <div class="chart-container"><canvas id="chartOnTime"></canvas></div>
      </div>
    </div>
  `;

  setTimeout(() => {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, Inter, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#6b7280';
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;

    const stageData = statsCountsByStage();
    new Chart(document.getElementById('chartStage'), {
      type: 'bar',
      data: {
        labels: stageData.map(s => s.name),
        datasets: [{ label: 'Cazuri', data: stageData.map(s => s.count), backgroundColor: stageData.map(s => s.color), borderRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const clinicData = statsCountsByClinic();
    new Chart(document.getElementById('chartClinic'), {
      type: 'bar',
      data: {
        labels: clinicData.map(c => c.name),
        datasets: [{ label: 'Cazuri', data: clinicData.map(c => c.count), backgroundColor: '#1a1a1a', borderRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const typeData = statsCountsByType().slice(0, 8);
    new Chart(document.getElementById('chartType'), {
      type: 'bar',
      data: {
        labels: typeData.map(t => t.name),
        datasets: [{ label: 'Cazuri', data: typeData.map(t => t.count), backgroundColor: '#534AB7', borderRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    new Chart(document.getElementById('chartOnTime'), {
      type: 'doughnut',
      data: {
        labels: ['La timp', 'Întârziate'],
        datasets: [{ data: [onTime.onTime, onTime.late], backgroundColor: ['#1D9E75', '#A32D2D'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
    });
  }, 50);
}

// =========================================================================
// Login page (login.html)
// =========================================================================
function renderLogin() {
  const root = document.getElementById('loginShell');
  if (!root) return;

  const clinicOpts = CLINICS.map(c => `
    <a class="login-role-btn" href="clinic.html?id=${c.id}">
      <div class="login-role-icon">${c.name.slice(0,2)}</div>
      <div><span class="login-role-name">${c.name}</span><div class="login-role-sub">${c.doctor}</div></div>
    </a>
  `).join('');

  root.innerHTML = `
    <div class="login-box">
      <div class="login-brand">
        <div class="login-brand-mark">L</div>
        <div class="login-brand-name">Laborator Dentar</div>
      </div>

      <div class="login-prompt">Continuă ca:</div>

      <a class="login-role-btn" href="index.html">
        <div class="login-role-icon">AD</div>
        <div><span class="login-role-name">Admin / Manager</span><div class="login-role-sub">Acces complet la pipeline și statistici</div></div>
      </a>

      <a class="login-role-btn" href="index.html">
        <div class="login-role-icon">VC</div>
        <div><span class="login-role-name">Tehnician laborator</span><div class="login-role-sub">Pipeline + propriul work view</div></div>
      </a>

      <button class="login-role-btn" id="showClinics" type="button">
        <div class="login-role-icon">CL</div>
        <div><span class="login-role-name">Reprezentant clinică</span><div class="login-role-sub">Doar cazurile clinicii tale</div></div>
      </button>

      <div class="login-clinic-select" id="clinicSelect">
        ${clinicOpts}
      </div>

      <div class="login-divider">demo prototype</div>
      <div class="login-foot">Niciun login real — selectează un rol pentru a explora.</div>
    </div>
  `;

  document.getElementById('showClinics')?.addEventListener('click', () => {
    document.getElementById('clinicSelect').classList.toggle('show');
  });
}

// =========================================================================
// PDF generation (fișă)
// =========================================================================
function generateFisaPDF(c) {
  if (typeof window.jspdf === 'undefined') {
    alert('jsPDF nu s-a încărcat. Verifică conexiunea la internet.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Laborator Dentar Privat CAD', 20, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Chișinău · contact@labdentar.md · +373 22 000 000', 20, 28);
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`#${c.id}`, 190, 22, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(`Emis ${new Date().toLocaleDateString('ro-RO')}`, 190, 28, { align: 'right' });
  doc.setTextColor(0);
  doc.setLineWidth(0.2);
  doc.line(20, 32, 190, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('FIȘĂ DE LABORATOR', 105, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 52;
  const col1 = 22, col2 = 110;

  doc.setTextColor(110);
  doc.text('CLINICĂ', col1, y);
  doc.text('PACIENT', col2, y);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(clinic.name, col1, y + 6);
  doc.text(c.name, col2, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(clinic.doctor, col1, y + 11);
  doc.text('—', col2, y + 11);

  y += 22;
  doc.text('DATE', col1, y);
  doc.text('TIP LUCRARE', col2, y);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(`Intrată: ${c.intrata}`, col1, y + 6);
  doc.text(c.type, col2, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Finală: ${c.finala}`, col1, y + 11);
  doc.text(`Etapa curentă: ${stage.name}`, col2, y + 11);
  doc.setTextColor(0);

  y += 24;
  doc.line(20, y, 190, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SPECIFICAȚII', 22, y + 6);
  doc.setFont('helvetica', 'normal');
  y += 12;

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Lucrare', 22, y);
  doc.text('Material', 80, y);
  doc.text('Culoare', 140, y);
  doc.text('Cantitate', 175, y);
  doc.setTextColor(0);
  doc.line(20, y + 2, 190, y + 2);
  y += 8;
  doc.setFontSize(10);
  doc.text(c.type, 22, y);
  doc.text('Conform tipului', 80, y);
  doc.text('A2', 140, y);
  doc.text('—', 175, y);

  y += 18;
  doc.line(20, y, 190, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INDICAȚII SPECIALE', 22, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const notes = c.notes || 'Fără indicații suplimentare.';
  const wrapped = doc.splitTextToSize(notes, 168);
  doc.text(wrapped, 22, y + 14);

  y = 250;
  doc.line(22, y, 80, y);
  doc.line(112, y, 170, y);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text('Semnătura medic clinică', 22, y + 5);
  doc.text('Semnătura tehnician laborator', 112, y + 5);

  doc.save(`fisa-${c.id}-${c.name.split(' ')[0].toLowerCase()}.pdf`);
}

// =========================================================================
// Init
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderPipeline();
  renderClinic();
  renderCaseDetail();
  renderCalendar();
  renderStats();
  renderLogin();

  attachSearch();
  attachFilters();
  attachMobileMenu();

  // "+ Caz nou" buttons across pages
  document.getElementById('newCaseBtnGlobal')?.addEventListener('click', () => openNewCaseModal());
});
