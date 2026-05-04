const STORAGE_KEY = 'dental-lab-overrides-v2';
function loadOverrides() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }
const overrides = loadOverrides();

function applyOverrides() {
  if (overrides.stages) Object.entries(overrides.stages).forEach(([id, s]) => { const c = getCase(id); if (c) c.stage = s; });
  if (overrides.edits) Object.entries(overrides.edits).forEach(([id, e]) => { const c = getCase(id); if (c) Object.assign(c, e); });
  if (overrides.read) overrides.read.forEach(id => { const n = NOTIFICATIONS.find(x => x.id === id); if (n) n.unread = false; });
}
applyOverrides();

const activeFilter = { tab: 'all', clinic: 'all' };
function applyFilter(cases) {
  const today = new Date(2026, 4, 4);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  return cases.filter(c => {
    const isTrimis = c.stage === 'trimis';
    if (activeFilter.tab === 'trimise') return isTrimis;
    if (isTrimis) return false;
    if (activeFilter.clinic !== 'all' && c.clinic !== activeFilter.clinic) return false;
    if (activeFilter.tab === 'mine' && c.assignee !== (getCurrentUser()?.id || 'vc')) return false;
    if (activeFilter.tab === 'late' && !c.late) return false;
    if (activeFilter.tab === 'week') {
      const fin = parseShortDate(c.finala);
      if (!fin || fin < today || fin > weekEnd) return false;
    }
    if (activeFilter.tab === 'notstarted' && !c.notStarted) return false;
    return true;
  });
}

// =========================================================================
// PIPELINE KANBAN
// =========================================================================
function renderPipeline() {
  const root = document.getElementById('pipeline');
  if (!root) return;
  const pipelineCols = ['design', 'cam', 'prelucrare', 'ceramica', 'proba', 'terminat'];
  root.innerHTML = '';
  pipelineCols.forEach(stageId => {
    const stage = getStage(stageId);
    const cases = applyFilter(casesInStage(stageId));
    const col = document.createElement('div');
    col.className = 'kb-col';
    col.dataset.stage = stageId;
    col.innerHTML = `
      <div class="kb-col-head">
        <span class="kb-stage-dot" style="background:${stage.color}"></span>
        <span class="kb-col-name">${stage.name === 'Terminat' ? 'Finalizat' : stage.name}</span>
        <span class="kb-col-count">${cases.length}</span>
      </div>`;
    cases.forEach(c => col.appendChild(renderKanbanCard(c)));
    attachDropZone(col, stageId);
    root.appendChild(col);
  });
}

function renderKanbanCard(c) {
  const card = document.createElement('a');
  card.className = 'kb-card' + (c.late ? ' late' : c.warn ? ' warn' : c.stage === 'terminat' ? ' ready' : '');
  card.href = `case.html?id=${c.id}`;
  card.draggable = true;
  card.dataset.caseId = c.id;
  const clinic = getClinic(c.clinic);
  const tech = getEmployee(c.assignee);
  const subStatus = c.stageStatuses?.[c.stage] || 'in_lucru';
  const subBadge = subStatus === 'finalizat' ? `<span class="substate-badge final">✓</span>` :
                   subStatus === 'la_proba' ? `<span class="substate-badge proba">P</span>` :
                   subStatus === 'in_lucru' ? `<span class="substate-badge lucru">●</span>` : '';
  const finalText = c.late ? 'restant' : c.stage === 'terminat' ? 'gata' : c.finala;
  const finalCls = c.late ? 'late' : c.stage === 'terminat' ? 'ready' : '';
  card.innerHTML = `
    <div class="kb-card-clinic">${clinic.name}</div>
    <div class="kb-card-name">${c.name}</div>
    <div class="kb-card-row">
      <span class="kb-tag">${c.type}</span>
      <span class="kb-final ${finalCls}">${finalText}</span>
    </div>
    <div class="kb-card-foot">
      ${tech ? `<span class="kb-av ${tech.id}" style="position:relative">${tech.initials}${subBadge}</span><span class="kb-tehnician-name">${tech.name}</span>` : `<span class="kb-unassigned">— neasignat</span>`}
    </div>`;
  card.addEventListener('dragstart', e => { card.style.opacity = '0.4'; e.dataTransfer.setData('text/plain', String(c.id)); });
  card.addEventListener('dragend', () => card.style.opacity = '1');
  return card;
}

function attachDropZone(col, stageId) {
  col.addEventListener('dragover', e => e.preventDefault());
  col.addEventListener('drop', e => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    const c = getCase(id);
    if (c && c.stage !== stageId) {
      c.stage = stageId;
      overrides.stages = overrides.stages || {};
      overrides.stages[c.id] = stageId;
      saveOverrides(overrides);
      renderPipeline();
      if (typeof renderTable === 'function') renderTable();
    }
  });
}

// =========================================================================
// CLINIC PORTAL
// =========================================================================
function renderClinic() {
  const root = document.getElementById('clinicShell');
  if (!root) return;
  const clinicId = new URLSearchParams(location.search).get('id') || 'crisdent';
  const clinic = getClinic(clinicId);
  if (!clinic) { root.innerHTML = '<p>Clinică inexistentă.</p>'; return; }
  const cases = casesForClinic(clinicId);
  const active = cases.filter(c => c.stage !== 'trimis');
  const proba = cases.filter(c => c.stage === 'proba');
  const ready = cases.filter(c => c.stage === 'terminat');
  const late = cases.filter(c => c.late);
  const trimise = cases.filter(c => c.stage === 'trimis');

  function publicStage(c) {
    if (c.stage === 'trimis') return { cls: 'trimis', label: 'Trimisă' };
    if (c.stage === 'terminat') return { cls: 'gata', label: 'Gata de ridicat' };
    if (c.stage === 'proba') return { cls: 'proba', label: 'La probă' };
    return { cls: 'lucru', label: 'În lucru' };
  }
  function rowAction(c) {
    if (c.stage === 'proba') return { cls: 'primary', label: 'Aprobă probă' };
    if (c.stage === 'terminat') return { cls: 'primary', label: 'Confirmă ridicare' };
    return { cls: 'note', label: 'Adaugă notă' };
  }

  root.innerHTML = `
    <div class="pc-shell">
      <div class="pc-topbar">
        <div class="pc-logo">${clinic.name.slice(0,2)}</div>
        <div><div class="pc-clinic-name">${clinic.name}</div><div class="pc-clinic-sub">Portalul clinicii</div></div>
        <div class="spacer"></div>
        <button class="btn primary" id="newCaseBtnClinic">+ Caz nou</button>
        <div class="icon-btn">N<span class="bell-dot"></span></div>
        <div class="avatar">${clinic.doctor.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
      </div>
      <div class="pc-greet">
        <h1 class="pc-greet-title">Bună, ${clinic.doctor.split(' ').slice(-1)[0]}</h1>
        <div class="pc-greet-sub">Ai ${proba.length + ready.length} lucrări care necesită atenție astăzi · ${active.length} lucrări active</div>
      </div>
      <div class="pc-stats">
        <div class="pc-stat"><div class="pc-stat-num">${active.length}</div><div class="pc-stat-lbl">Active</div></div>
        <div class="pc-stat"><div class="pc-stat-num proba">${proba.length}</div><div class="pc-stat-lbl">La probă</div></div>
        <div class="pc-stat"><div class="pc-stat-num ready">${ready.length}</div><div class="pc-stat-lbl">Gata de ridicat</div></div>
        <div class="pc-stat"><div class="pc-stat-num ${late.length ? 'late' : ''}">${late.length}</div><div class="pc-stat-lbl">În întârziere</div></div>
      </div>
      <div class="pc-filter-row">
        <button class="pc-tab on">Toate (${active.length})</button>
        <button class="pc-tab">La probă (${proba.length})</button>
        <button class="pc-tab">Gata (${ready.length})</button>
        <button class="pc-tab">Trimise (${trimise.length})</button>
      </div>
      <div class="pc-table">
        <div class="pc-row-grid head">
          <div>Caz</div><div>Pacient</div><div>Tip</div><div>Etapă</div><div>Probă</div><div>Finală</div><div>Acțiune</div>
        </div>
        ${cases.map(c => {
          const ps = publicStage(c);
          const act = rowAction(c);
          return `<div class="pc-row-grid" data-case-id="${c.id}">
            <div class="tbl-num">#${c.id}</div>
            <div class="tbl-name">${c.name}</div>
            <div><span class="tag">${c.type}</span></div>
            <div><span class="pc-public-stage ${ps.cls}">${ps.label}</span></div>
            <div class="tbl-due-bold">${c.probaDate || '—'}</div>
            <div class="tbl-due-bold ${c.late ? 'late' : ''}">${c.late ? 'restant' : c.finala}</div>
            <div><button class="pc-action ${act.cls}" type="button">${act.label}</button></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  document.getElementById('newCaseBtnClinic')?.addEventListener('click', () => openNewCaseModal(clinicId));
  document.querySelectorAll('.pc-row-grid[data-case-id]').forEach(r => {
    r.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      location.href = `case.html?id=${r.dataset.caseId}`;
    });
  });
}

// =========================================================================
// CASE DETAIL
// =========================================================================
function renderCaseDetail() {
  const root = document.getElementById('caseShell');
  if (!root) return;
  const caseId = new URLSearchParams(location.search).get('id');
  const c = getCase(caseId);
  if (!c) { root.innerHTML = '<p>Caz inexistent. <a href="index.html">Înapoi</a></p>'; return; }
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage) || STAGES[0];
  const stages = getEtapeLabStages(c.type);

  // Tooth chart display
  const upperRow = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lowerRow = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  function toothCell(n) {
    const t = (c.teeth || []).find(x => x.n === n);
    const cls = t ? t.type : '';
    return `<div class="t-display ${cls}">${n}</div>`;
  }
  function row(arr) {
    return arr.slice(0,8).map(toothCell).join('') + '<div class="tc-divider-form"></div>' + arr.slice(8).map(toothCell).join('');
  }

  // Summary by type
  const byType = {};
  (c.teeth || []).forEach(t => { byType[t.type] = byType[t.type] || []; byType[t.type].push(t.n); });
  const typeLabels = { crown: 'Coroană', implant: 'Pe implant', emax: 'Emax', veneer: 'Fațetă' };

  root.innerHTML = `
    <div class="case-shell">
      <div class="cd-topbar">
        <a href="index.html" class="cd-back">← Pipeline</a>
        <div class="spacer"></div>
        <button class="btn">Editează</button>
        <button class="btn primary">Marchează etapă completă →</button>
      </div>
      <div class="cd-head">
        <div class="cd-clinic-line">${clinic.name} · Caz #${c.id}</div>
        <h1 class="cd-title">${c.name}</h1>
        <div class="cd-doctor">Medic: ${c.doctor || clinic.doctor}</div>
      </div>
      <div class="cd-grid">
        <div class="cd-main">
          <div class="cd-section">
            <div class="cd-section-head"><span class="cd-section-title">Detalii caz</span></div>
            <div class="cd-section-body">
              <div class="cd-kv-grid">
                <div><div class="cd-kv-label">Tip lucrare</div><div class="cd-kv-val"><span class="tag">${c.type}</span></div></div>
                <div><div class="cd-kv-label">Culoare</div><div class="cd-kv-val">${c.color || '—'}</div></div>
                <div><div class="cd-kv-label">Etapa curentă</div><div class="cd-kv-val">${stage.name}</div></div>
                <div><div class="cd-kv-label">Data intrării</div><div class="cd-kv-val">${c.intrata}</div></div>
                <div><div class="cd-kv-label">Data probei</div><div class="cd-kv-val bold-date">${c.probaDate || '—'}</div></div>
                <div><div class="cd-kv-label">Data finală</div><div class="cd-kv-val bold-date ${c.late ? 'late' : ''}">${c.finala}</div></div>
                <div><div class="cd-kv-label">Tip implant</div><div class="cd-kv-val">${c.implantType || '—'}</div></div>
                <div><div class="cd-kv-label">Tip amprentă</div><div class="cd-kv-val">${c.amprentaType || '—'}</div></div>
                <div><div class="cd-kv-label">Prioritate</div><div class="cd-kv-val">${c.priority}</div></div>
              </div>
            </div>
          </div>
          ${(c.teeth && c.teeth.length) ? `
          <div class="cd-section">
            <div class="cd-section-head"><span class="cd-section-title">Schema dentară (FDI)</span><span class="cd-section-action">${c.teeth.length} dinți</span></div>
            <div class="cd-section-body">
              <div class="tc-display-wrap">
                <div class="tc-display-row">${row(upperRow)}</div>
                <div class="tc-display-row">${row(lowerRow)}</div>
              </div>
              <div class="tc-summary" style="margin-top:10px">
                ${Object.entries(byType).map(([type, nums]) => `<div class="tc-summary-line"><span class="tc-sum-mini ${type}"></span><span>${typeLabels[type]}:</span><b>${nums.join(', ')}</b></div>`).join('')}
              </div>
            </div>
          </div>` : ''}
          <div class="cd-section">
            <div class="cd-section-head"><span class="cd-section-title">Fișă de laborator</span></div>
            <div class="fisa-attached">
              <div class="fisa-icon-pdf">PDF</div>
              <div style="flex:1"><div class="fisa-fname">fisa-${c.id}-${c.name.split(' ')[0].toLowerCase()}.pdf</div><div class="fisa-fmeta">generat din date · A4</div></div>
              <button class="btn">Înlocuiește</button>
              <button class="btn primary" id="dlFisaBtn">Descarcă</button>
            </div>
          </div>
          <div class="cd-section">
            <div class="cd-section-head"><span class="cd-section-title">Note & activitate</span></div>
            <div class="cd-section-body">
              <textarea class="note-form-input" id="noteInput" placeholder="Adaugă o notă pentru echipă sau clinică…"></textarea>
              <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn">Vizibil doar în lab</button><button class="btn primary" id="addNoteBtn">Trimite notă</button></div>
              <div class="note-list" id="noteList">
                <div class="note-item"><div class="note-author">${clinic.name.slice(0,2)}</div><div style="flex:1"><div class="note-meta"><b>${c.doctor || clinic.doctor}</b> · acum 2 ore</div><div class="note-text">${c.notes || 'Lucrare standard.'}</div></div></div>
              </div>
            </div>
          </div>
        </div>
        <aside class="cd-aside">
          <div class="aside-section">
            <h3 class="aside-title">Etape lab</h3>
            <div class="tl-list">
              ${stages.map(sId => {
                const s = getStage(sId);
                const status = c.stageStatuses?.[sId] || 'neincepute';
                const cls = status === 'finalizat' ? 'done' : status === 'in_lucru' || status === 'la_proba' ? 'now' : '';
                const tech = getEmployee(c.assignees?.[sId]);
                const meta = status === 'finalizat' ? 'finalizat' : status === 'in_lucru' ? 'în lucru' : status === 'la_proba' ? 'la probă' : 'în așteptare';
                return `<div class="tl-item ${cls}">
                  <span class="tl-marker ${cls}"></span>
                  <div><div class="tl-name">${s.name}</div><div class="tl-meta">${tech ? `<span class="tl-tech ${tech.id}">${tech.initials}</span>` : ''}${meta}</div></div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <div class="aside-section">
            <h3 class="aside-title">Fișiere atașate</h3>
            <div class="file-list">
              <div class="file-item"><div class="file-icon-mini">STL</div><span class="file-name">amprenta.stl</span><span class="file-size">12 MB</span></div>
              <div class="file-item"><div class="file-icon-mini">PDF</div><span class="file-name">fisa.pdf</span><span class="file-size">84 KB</span></div>
              <div class="file-item"><div class="file-icon-mini">JPG</div><span class="file-name">proba.jpg</span><span class="file-size">2.1 MB</span></div>
            </div>
            <button class="btn" style="margin-top:10px;width:100%">+ Atașează fișier</button>
          </div>
        </aside>
      </div>
    </div>`;
  document.getElementById('dlFisaBtn')?.addEventListener('click', () => generateFisaPDF(c));
  document.getElementById('addNoteBtn')?.addEventListener('click', () => {
    const ta = document.getElementById('noteInput');
    if (!ta.value.trim()) return;
    const list = document.getElementById('noteList');
    list.insertAdjacentHTML('afterbegin', `<div class="note-item"><div class="note-author">EU</div><div style="flex:1"><div class="note-meta"><b>Tu</b> · acum câteva secunde</div><div class="note-text">${ta.value}</div></div></div>`);
    ta.value = '';
  });
}

// =========================================================================
// CALENDAR
// =========================================================================
const MONTH_NAMES_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
let calMonth = 4, calYear = 2026, calClinicFilter = 'all';

function renderCalendar() {
  const root = document.getElementById('calShell');
  if (!root) return;
  const today = new Date(2026, 4, 4);
  const firstDay = new Date(calYear, calMonth, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const filterCases = c => calClinicFilter === 'all' || c.clinic === calClinicFilter;
  const monthCases = CASES.filter(filterCases);

  // Group by date
  const byDate = {};
  CASES.filter(filterCases).forEach(c => {
    const d = parseShortDate(c.finala);
    if (d) { const k = d.toDateString(); (byDate[k] = byDate[k] || []).push(c); }
  });

  // Clinic counts
  const clinicCounts = { all: monthCases.length };
  CLINICS.forEach(cl => clinicCounts[cl.id] = casesForClinic(cl.id).length);

  let html = `
    <div class="cal-shell">
      <div class="cal-topbar">
        <button class="cal-nav-btn" id="calPrev">‹</button>
        <div class="cal-month-title">${MONTH_NAMES_RO[calMonth]} ${calYear}</div>
        <button class="cal-nav-btn" id="calNext">›</button>
        <button class="cal-today-btn" id="calToday">Astăzi</button>
        <div class="spacer"></div>
        <a href="index.html" class="btn">Lucrări</a>
      </div>
      <div class="cal-clinic-tabs">
        <button class="cal-clinic-tab ${calClinicFilter === 'all' ? 'on' : ''}" data-clinic="all">Toate clinicile <span class="cal-clinic-count">${clinicCounts.all}</span></button>
        ${CLINICS.map(cl => `<button class="cal-clinic-tab ${calClinicFilter === cl.id ? 'on' : ''}" data-clinic="${cl.id}">${cl.name} <span class="cal-clinic-count">${clinicCounts[cl.id]}</span></button>`).join('')}
      </div>
      <div class="cal-weekdays">${['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'].map(d => `<div class="cal-weekday">${d}</div>`).join('')}</div>
      <div class="cal-grid">`;

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    const date = new Date(calYear, calMonth, dayNum);
    const isOutside = dayNum < 1 || dayNum > daysInMonth;
    const isToday = date.toDateString() === today.toDateString();
    const isWeekend = i % 7 >= 5;
    const dateCases = byDate[date.toDateString()] || [];
    let cls = '';
    if (isOutside) cls += ' outside';
    if (isToday) cls += ' today';
    if (isWeekend) cls += ' weekend';

    html += `<div class="cal-day${cls}">
      <div class="cal-day-num">${date.getDate()}${isToday ? ' <span class="cal-today-pill">azi</span>' : ''}</div>
      <div class="cal-day-cases">
        ${dateCases.slice(0, 3).map(c => {
          const status = getCalendarStatus(c);
          return `<a href="case.html?id=${c.id}" class="cal-case-pill ${status}" title="${c.name} · ${getClinic(c.clinic).name}">${c.name.split(' ')[0]} · ${getClinic(c.clinic).name.slice(0,4)}</a>`;
        }).join('')}
        ${dateCases.length > 3 ? `<div class="cal-day-more">+${dateCases.length - 3} alte</div>` : ''}
      </div>
    </div>`;
  }

  html += `</div>
      <div class="cal-legend-row">
        <div class="cal-legend-item"><span class="cal-legend-swatch neincepute"></span>Neincepute</div>
        <div class="cal-legend-item"><span class="cal-legend-swatch proces"></span>În proces</div>
        <div class="cal-legend-item"><span class="cal-legend-swatch terminat"></span>Terminat</div>
      </div>
    </div>`;
  root.innerHTML = html;

  document.getElementById('calPrev')?.addEventListener('click', () => { if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--; renderCalendar(); });
  document.getElementById('calNext')?.addEventListener('click', () => { if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++; renderCalendar(); });
  document.getElementById('calToday')?.addEventListener('click', () => { calMonth = 4; calYear = 2026; renderCalendar(); });
  document.querySelectorAll('.cal-clinic-tab').forEach(tab => {
    tab.addEventListener('click', () => { calClinicFilter = tab.dataset.clinic; renderCalendar(); });
  });
}

// =========================================================================
// MODAL — NEW CASE WITH TOOTH POPOVER
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
function closeModal() { document.querySelector('.modal-overlay')?.remove(); document.removeEventListener('keydown', escClose); }
function escClose(e) { if (e.key === 'Escape') closeModal(); }

function openNewCaseModal(defaultClinic) {
  const clinicOpts = CLINICS.map(c => `<option value="${c.id}" ${c.id === defaultClinic ? 'selected' : ''}>${c.name}</option>`).join('');
  const typeOpts = COMMON_TYPES.map(t => `<option>${t}</option>`).join('');
  const colorOpts = COLORS_VITA.map(c => `<option>${c}</option>`).join('');
  const today = new Date(2026, 4, 4);
  const probaD = new Date(today); probaD.setDate(today.getDate() + 5);
  const finalD = new Date(today); finalD.setDate(today.getDate() + 7);
  const upperRow = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lowerRow = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const tooth = n => `<button type="button" class="tooth-cell" data-tooth="${n}">${n}</button>`;
  const renderRow = arr => arr.slice(0,8).map(tooth).join('') + '<div class="tc-divider-form"></div>' + arr.slice(8).map(tooth).join('');

  openModal(`
    <div class="modal-head"><div class="modal-title">Caz nou — fișă completă</div><button class="modal-close" type="button">×</button></div>
    <div class="modal-body">
      <div class="field-row"><div class="field"><label>Nume pacient</label><input id="ncLast" placeholder="Bengoi" autofocus></div><div class="field"><label>Prenume</label><input id="ncFirst" placeholder="Elvis Marius"></div></div>
      <div class="field-row"><div class="field"><label>Clinică</label><select id="ncClinic">${clinicOpts}</select></div><div class="field"><label>Medic</label><input id="ncDoctor" placeholder="Dr. Popescu A."></div></div>
      <div class="field-row"><div class="field"><label>Tip lucrare</label><select id="ncType">${typeOpts}</select></div><div class="field"><label>Culoare (Vita)</label><select id="ncColor">${colorOpts}</select></div></div>
      <div class="field-row three"><div class="field"><label>Data intrării</label><input id="ncIntrata" value="${fmtShortDate(today)}"></div><div class="field"><label>Data probei</label><input id="ncProba" value="${fmtShortDate(probaD)}"></div><div class="field"><label>Data finală</label><input id="ncFinala" value="${fmtShortDate(finalD)}"></div></div>
      <div class="field"><label>Schema dentară (FDI) — click pe dinte pentru a alege tipul</label>
        <div class="tc-form-wrap" id="toothChartWrap">
          <div class="tc-row-form">${renderRow(upperRow)}</div>
          <div class="tc-row-form">${renderRow(lowerRow)}</div>
        </div>
        <div class="tc-summary" id="toothSummary"><div style="color:var(--text-dim)">Niciun dinte selectat</div></div>
      </div>
      <div class="field-row"><div class="field"><label>Tip implant</label><input id="ncImplant" placeholder="Straumann, Nobel..."></div><div class="field"><label>Tip amprentă</label><select id="ncAmprenta"><option>Silicon</option><option>Polieter</option><option>Alginat</option><option>Digital</option><option>STL</option></select></div></div>
      <div class="field"><label>Note generale</label><textarea id="ncNotes" placeholder="Detalii suplimentare..."></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn modal-close" type="button">Anulează</button><button class="btn primary" id="ncSave" type="button">Salvează caz</button></div>
  `);

  // Tooth selection state
  const toothMap = new Map();
  document.querySelectorAll('#toothChartWrap .tooth-cell').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openToothPopover(btn); });
  });
  function openToothPopover(toothBtn) {
    document.querySelectorAll('.tooth-popover').forEach(p => p.remove());
    document.querySelectorAll('.tooth-cell.popped').forEach(c => c.classList.remove('popped'));
    toothBtn.classList.add('popped');
    const n = toothBtn.dataset.tooth;
    const pop = document.createElement('div');
    pop.className = 'tooth-popover';
    pop.innerHTML = `
      <div class="tooth-popover-arrow"></div>
      <div class="tp-header">Dinte ${n} — selectează tipul</div>
      <button class="tp-btn" data-type="crown"><span class="tp-swatch crown"></span>Coroană</button>
      <button class="tp-btn" data-type="implant"><span class="tp-swatch implant"></span>Pe implant</button>
      <button class="tp-btn" data-type="emax"><span class="tp-swatch emax"></span>Emax</button>
      <button class="tp-btn" data-type="veneer"><span class="tp-swatch veneer"></span>Fațetă</button>
      <div class="tp-btn-divider"></div>
      <button class="tp-btn danger" data-type="erase"><span class="tp-swatch eraser">×</span>Șterge selecția</button>`;
    pop.style.top = (toothBtn.offsetTop + toothBtn.offsetHeight + 6) + 'px';
    pop.style.left = Math.max(0, toothBtn.offsetLeft - 16) + 'px';
    document.getElementById('toothChartWrap').appendChild(pop);
    pop.querySelectorAll('.tp-btn').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const type = b.dataset.type;
        if (type === 'erase') { toothMap.delete(n); toothBtn.className = 'tooth-cell'; }
        else { toothMap.set(n, type); toothBtn.className = 'tooth-cell ' + type; }
        pop.remove();
        toothBtn.classList.remove('popped');
        updateToothSummary();
      });
    });
    setTimeout(() => {
      const close = ev => { if (!pop.contains(ev.target) && ev.target !== toothBtn) { pop.remove(); toothBtn.classList.remove('popped'); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 0);
  }
  function updateToothSummary() {
    const sum = document.getElementById('toothSummary');
    if (toothMap.size === 0) { sum.innerHTML = '<div style="color:var(--text-dim)">Niciun dinte selectat</div>'; return; }
    const byType = {};
    toothMap.forEach((t, n) => { (byType[t] = byType[t] || []).push(Number(n)); });
    const labels = { crown: 'Coroană', implant: 'Pe implant', emax: 'Emax', veneer: 'Fațetă' };
    sum.innerHTML = Object.entries(byType).map(([t, ns]) => `<div class="tc-summary-line"><span class="tc-sum-mini ${t}"></span><span>${labels[t]}:</span><b>${ns.sort((a,b) => a-b).join(', ')}</b></div>`).join('');
  }

  document.getElementById('ncSave').addEventListener('click', () => {
    const last = document.getElementById('ncLast').value.trim();
    const first = document.getElementById('ncFirst').value.trim();
    if (!last && !first) { document.getElementById('ncLast').style.borderColor = '#A32D2D'; return; }
    const teeth = [];
    toothMap.forEach((type, n) => teeth.push({ n: Number(n), type }));
    const newCase = {
      id: nextCaseId(),
      name: (last + ' ' + first).trim(), lastName: last, firstName: first,
      clinic: document.getElementById('ncClinic').value, doctor: document.getElementById('ncDoctor').value,
      type: document.getElementById('ncType').value, color: document.getElementById('ncColor').value,
      stage: 'design', intrata: document.getElementById('ncIntrata').value,
      probaDate: document.getElementById('ncProba').value, finala: document.getElementById('ncFinala').value,
      teeth, implantType: document.getElementById('ncImplant').value, amprentaType: document.getElementById('ncAmprenta').value,
      notes: document.getElementById('ncNotes').value, assignees: {}, stageStatuses: {}, notStarted: true
    };
    newCase.priority = computePriority(newCase);
    CASES.push(newCase);
    persistNewCase(newCase);
    closeModal();
    if (typeof renderTable === 'function') renderTable();
    renderPipeline(); renderClinic();
  });
}

// =========================================================================
// PDF (html2pdf)
// =========================================================================
function buildFisaHTML(c) {
  const clinic = getClinic(c.clinic);
  const stage = getStage(c.stage) || STAGES[0];
  const teethStr = (c.teeth || []).map(t => t.n).join(', ') || '—';
  const safe = s => String(s || '').replace(/</g, '&lt;');
  return `<div style="font-family:Arial,sans-serif;padding:30px;color:#1a1a1a;font-size:12px;line-height:1.5;width:750px">
    <div style="display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid #ccc;margin-bottom:20px">
      <div><div style="font-size:16px;font-weight:bold">Laborator Dentar Privat CAD</div><div style="font-size:10px;color:#666">Chișinău · contact@labdentar.md</div></div>
      <div style="text-align:right"><div style="font-family:monospace;font-size:14px;font-weight:bold">#${c.id}</div><div style="font-size:10px;color:#666">${new Date().toLocaleDateString('ro-RO')}</div></div>
    </div>
    <h2 style="text-align:center;font-size:16px;margin:0 0 20px">FIȘĂ DE LABORATOR</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:8px;border:1px solid #ddd;width:50%"><div style="font-size:9px;color:#666;text-transform:uppercase">CLINICĂ</div><div style="font-weight:bold">${safe(clinic.name)}</div><div style="font-size:11px;color:#666">${safe(c.doctor || clinic.doctor)}</div></td><td style="padding:8px;border:1px solid #ddd"><div style="font-size:9px;color:#666;text-transform:uppercase">PACIENT</div><div style="font-weight:bold">${safe(c.name)}</div></td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><div style="font-size:9px;color:#666;text-transform:uppercase">DATE</div><div>Intrată: <b>${safe(c.intrata)}</b></div><div>Probă: <b>${safe(c.probaDate || '—')}</b></div><div>Finală: <b>${safe(c.finala)}</b></div></td><td style="padding:8px;border:1px solid #ddd"><div style="font-size:9px;color:#666;text-transform:uppercase">LUCRARE</div><div>Tip: <b>${safe(c.type)}</b></div><div>Culoare: <b>${safe(c.color || '—')}</b></div></td></tr>
    </table>
    <div style="margin-bottom:16px"><div style="font-size:10px;color:#666;text-transform:uppercase;margin-bottom:6px">DINȚI INVOLVAȚI (FDI)</div><div style="font-family:monospace;padding:10px;background:#f5f5f5;border-radius:4px">${teethStr}</div></div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:8px;border:1px solid #ddd;width:50%"><div style="font-size:9px;color:#666;text-transform:uppercase">TIP IMPLANT</div><div>${safe(c.implantType || '—')}</div></td><td style="padding:8px;border:1px solid #ddd"><div style="font-size:9px;color:#666;text-transform:uppercase">TIP AMPRENTĂ</div><div>${safe(c.amprentaType || '—')}</div></td></tr>
    </table>
    <div style="border:1px solid #ddd;padding:10px;margin-bottom:30px;min-height:60px"><div style="font-size:9px;color:#666;text-transform:uppercase;margin-bottom:4px">INDICAȚII</div><div>${safe(c.notes || 'Fără indicații.')}</div></div>
    <div style="display:flex;justify-content:space-between;padding-top:50px"><div style="border-top:1px solid #1a1a1a;padding-top:4px;width:220px;font-size:10px;color:#666">Semnătura medic</div><div style="border-top:1px solid #1a1a1a;padding-top:4px;width:220px;font-size:10px;color:#666">Semnătura tehnician</div></div>
  </div>`;
}
function generateFisaPDF(c) {
  if (typeof html2pdf === 'undefined') { alert('Librăria nu s-a încărcat.'); return; }
  const wrap = document.createElement('div'); wrap.innerHTML = buildFisaHTML(c);
  wrap.style.position = 'absolute'; wrap.style.left = '-9999px';
  document.body.appendChild(wrap);
  html2pdf().from(wrap.firstElementChild).set({
    margin: 10, filename: `fisa-${c.id}-${(c.lastName || c.name).split(' ')[0].toLowerCase()}.pdf`,
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' }
  }).save().finally(() => document.body.removeChild(wrap));
}

// =========================================================================
// LOGIN
// =========================================================================
function renderLogin() {
  const root = document.getElementById('loginShell');
  if (!root) return;
  // Keep existing simple version — can redesign later
}

// =========================================================================
// SEARCH + FILTERS + MOBILE
// =========================================================================
function attachSearch() {
  const inp = document.getElementById('searchInput');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.toLowerCase().trim();
    document.querySelectorAll('.tbl tbody tr, .kb-card').forEach(el => {
      el.style.display = (!q || el.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  });
}
function attachFilters() {
  const tabs = document.querySelectorAll('.subbar .tab');
  if (!tabs.length) return;
  const tabMap = ['all','mine','late','week','notstarted','trimise'];
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    activeFilter.tab = tabMap[i];
    renderPipeline();
    if (typeof renderTable === 'function') renderTable();
  }));
  const chip = document.getElementById('clinicFilterChip');
  if (chip) {
    chip.addEventListener('click', e => { e.stopPropagation(); document.getElementById('clinicFilterMenu').classList.toggle('open'); });
    document.addEventListener('click', () => document.getElementById('clinicFilterMenu')?.classList.remove('open'));
    document.querySelectorAll('#clinicFilterMenu .chip-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        activeFilter.clinic = item.dataset.value;
        chip.textContent = 'Clinică: ' + (item.dataset.value === 'all' ? 'toate' : getClinic(item.dataset.value).name);
        renderPipeline();
        if (typeof renderTable === 'function') renderTable();
      });
    });
  }
}
function attachMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn'), sb = document.querySelector('.sidebar');
  if (!btn || !sb) return;
  btn.addEventListener('click', () => sb.classList.toggle('open'));
}

document.addEventListener('DOMContentLoaded', () => {
  renderClinic();
  renderCaseDetail();
  renderCalendar();
  renderLogin();
  attachSearch(); attachFilters(); attachMobileMenu();
  document.getElementById('newCaseBtnGlobal')?.addEventListener('click', () => openNewCaseModal());
});