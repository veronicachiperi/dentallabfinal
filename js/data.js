/* © 2026 Veronica Chiperi — PRIVATE CAD. Cod proprietar / Proprietary code. Toate drepturile rezervate / All rights reserved. Reproducerea, redistribuirea sau crearea unei aplicații similare fără acord scris sunt interzise. */
const STAGES = [
  { id: 'design',         name: 'Design',         color: '#85B7EB', order: 1 },
  { id: 'la_print',       name: 'La print',       color: '#185FA5', order: 2 },
  { id: 'print_finisat',  name: 'Print finisat',  color: '#1D9E75', order: 3 },
  { id: 'cam',            name: 'CAM',            color: '#444441', order: 4 },
  { id: 'cam_finisat',    name: 'CAM finisat',    color: '#1D9E75', order: 5 },
  { id: 'la_bare',        name: 'La bare',        color: '#854F0B', order: 6 },
  { id: 'prelucrare',     name: 'Prelucrare',     color: '#854F0B', order: 7 },
  { id: 'ceramica',       name: 'Ceramică',       color: '#EF9F27', order: 8 },
  { id: 'proba',          name: 'La probă',       color: '#EAC04A', order: 9 },
  { id: 'terminat',       name: 'Terminat',       color: '#97C459', order: 10 },
  { id: 'blocat',         name: 'Blocat',         color: '#A32D2D', order: 11 },
  { id: 'trimis',         name: 'Trimis',         color: '#27500A', order: 12 },
  { id: 'anulat',         name: 'Anulat',         color: '#7A1F1F', order: 13 }
];

// Etape lab arătate în coloana "Etape lab" — 4 max (Design, CAM, Prelucrare, Ceramică)
// Ordinea fluxului: Design → CAM → Prelucrare → Ceramică → Terminat.
const ETAPE_LAB_FULL = ['design', 'cam', 'prelucrare', 'ceramica'];
const ETAPE_LAB_NO_CERAMIC = ['design', 'cam', 'prelucrare'];
const ETAPE_LAB_DESIGN_ONLY = ['design'];
const TYPES_DESIGN_ONLY = ['MOCKUP'];
// Tipuri de lucrări care NU includ Ceramică
const TYPES_SKIP_CERAMICA = ['PROVIZORIE', 'STANDART', 'PMMA DINTI', 'PMMA IMPL', 'PMMA DINTI/IMPL'];

function isDesignOnlyType(type) {
  const workType = normTerm(type);
  return TYPES_DESIGN_ONLY.some(t => workType.includes(normTerm(t)));
}
function getEtapeLabStages(type) {
  const workType = normTerm(type);
  if (isDesignOnlyType(type)) return ETAPE_LAB_DESIGN_ONLY;
  return TYPES_SKIP_CERAMICA.some(t => workType.includes(normTerm(t))) ? ETAPE_LAB_NO_CERAMIC : ETAPE_LAB_FULL;
}

const PIPELINE_STAGES = ['design', 'cam', 'prelucrare', 'ceramica', 'proba', 'terminat']; // Flux rapid/advance. No Trimis
const PIPELINE_STAGES_NO_CERAMIC = ['design', 'cam', 'prelucrare', 'proba', 'terminat'];
const PIPELINE_COLUMNS = ['design', 'la_print', 'print_finisat', 'cam', 'cam_finisat', 'la_bare', 'prelucrare', 'ceramica', 'proba', 'terminat', 'blocat'];
const STAGE_MOVE_SEQUENCE = ['design', 'la_print', 'print_finisat', 'cam', 'cam_finisat', 'la_bare', 'prelucrare', 'ceramica', 'proba', 'proba_aprobata', 'terminat', 'blocat', 'anulat'];

const STAGE_ICONS = {
  design:     '<polygon points="12,3 21,21 3,21"/>',
  cam:        '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  la_print:   '<rect x="6" y="9" width="12" height="8"/><polyline points="6,9 6,3 18,3 18,9"/><circle cx="18" cy="13" r="1"/>',
  prelucrare: '<path d="M14.7 6.3l3 3-9 9-4 1 1-4z"/>',
  ceramica:   '<circle cx="12" cy="13" r="6"/><path d="M9 7 L9 4 L15 4 L15 7"/>',
  proba:      '<polyline points="20,6 9,17 4,12"/>',
  terminat:   '<circle cx="12" cy="12" r="9"/><polyline points="9,12 11,14 15,10"/>',
  blocat:     '<circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/>',
  trimis:     '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>',
  anulat:     '<circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
};
function stageIconSVG(stageId) {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${STAGE_ICONS[stageId] || ''}</svg>`;
}

const PROBA_STATES = [
  { id: 'lab',    label: 'La lab' },
  { id: 'clinic', label: 'La clinică' },
  { id: 'back',   label: 'Înapoi la lab' }
];

let CLINICS = [
  { id: 'crisdent', name: 'CRISDENT',        doctor: 'Dr. Popescu A.' },
  { id: 'pana',     name: 'PANA DENT',       doctor: 'Dr. Pană M.' },
  { id: 'elite',    name: 'ELITE MED',       doctor: 'Dr. Ionescu R.' },
  { id: 'fav',      name: 'FAV Dental',      doctor: 'Dr. Favorov S.' },
  { id: 'esthetic', name: 'Dental Esthetic', doctor: 'Dr. Stoica L.' },
  { id: 'melian',   name: 'Melian Clinic',   doctor: 'Dr. —' }
];

let EMPLOYEES = [
  { id: 'tchi', name: 'Timofei Chiochiu',    initials: 'TC', stage: 'design' },
  { id: 'vcel', name: 'Vadim Celac',          initials: 'VC', stage: 'design' },
  { id: 'ikar', name: 'Ivan Kara',            initials: 'IK', stage: 'design' },
  { id: 'acur', name: 'Alina Curtis',         initials: 'AC', stage: 'ceramica' },
  { id: 'vgra', name: 'Valentin Grajdianu',   initials: 'VG', stage: 'ceramica' },
  { id: 'amoi', name: 'Alexandru Moisei',     initials: 'AM', stage: 'prelucrare' },
  { id: 'avar', name: 'Alexandru Varzari',    initials: 'AV', stage: 'prelucrare' },
];

const CASES = [];

const NOTIFICATIONS = [];
// TODO partajat al echipei (task-uri rapide). Sincronizat din Supabase (tabel quick_tasks).
const QUICK_TASKS = [];

const LAB_TERMS_KEY = 'dental-lab-terms-v1';
const DEFAULT_LAB_TERMS = [
  { category:'DESIGN', service:'Mockup motivational sau functional', time:'3 - 4 zile', min:3, max:4, match:['MOCKUP','DESIGN'] },
  { category:'PROVIZORII', service:'PMMA pe dinti sau implanti', time:'min. 3 zile lucratoare', min:3, max:5, urgentMin:3, match:['PMMA'] },
  { category:'PROVIZORII', service:'Provizorie all on x cu bara', time:'5 - 7 zile', min:5, max:7, urgentMin:5, match:['PROVIZOR','ALL ON','ALLON','ALL X','BARA'] },
  { category:'PROVIZORII', service:'Provizorie all on x pe tuburi', time:'4 - 5 zile', min:4, max:5, urgentMin:5, match:['PROVIZOR','TUB'] },
  { category:'ZIRCONIU', service:'Full anatomic pe dinti sau implanti', time:'5 - 7 zile', min:5, max:7, urgentMin:5, match:['ZR','ZIRCON','ZIRCONIU'] },
  { category:'ZIRCONIU', service:'Abutment individual', time:'5 - 7 zile', min:5, max:7, urgentMin:5, match:['ABUTMENT'] },
  { category:'ZIRCONIU', service:'Zr stratificat pe dinti sau implanti', time:'6 - 8 zile', min:6, max:8, urgentMin:5, match:['ZR STR','ZIRCON STR','STRATIFICAT'] },
  { category:'EMAX', service:'Full anatomic', time:'9 - 12 zile', min:9, max:12, match:['EMAX FULL','EMAX'] },
  { category:'EMAX', service:'Stratificat', time:'10 - 12 zile', min:10, max:12, match:['EMAX STR','EMAX STRATIFICAT'] },
  { category:'EMAX', service:'Inlay / Onlay', time:'5 - 7 zile', min:5, max:7, match:['INLAY','ONLAY'] },
  { category:'DEFINITIVE', service:'Proteza totala Standard CR-CO/TITAN (PMMA)', time:'7 - 9 zile', min:7, max:9, urgentMin:7, match:['STANDARD','STANDART','DEFINITIV'] },
  { category:'DEFINITIVE', service:'Proteza totala Superior CR-CO/TITAN (ZIRCONIU)', time:'10 - 14 zile', min:10, max:14, urgentMin:7, match:['SUPERIOR'] },
  { category:'DEFINITIVE', service:'Proteza totala Superior Digital TITAN/CR-CO', time:'10 - 14 zile', min:10, max:14, urgentMin:7, match:['SUPERIOR DIGITAL'] },
  { category:'DEFINITIVE', service:'Proteza totala Zirconiu pe Ti-base', time:'10 - 14 zile', min:10, max:14, urgentMin:7, match:['TI-BASE','TIBASE'] },
  { category:'ALTE TIPURI', service:'Gutiera bruxism', time:'2 - 4 zile', min:2, max:4, match:['GUTIERA','BRUXISM'] },
  { category:'ALTE TIPURI', service:'Ghid chirurgical gingivectomie', time:'3 - 4 zile', min:3, max:4, match:['GHID','GINGIVECTOMIE'] },
  { category:'ALTE TIPURI', service:'Ghid reconstructie bonturi', time:'4 - 5 zile', min:4, max:5, match:['GHID','BONT'] }
];
let LAB_TERMS = loadLabTerms();

function normTerm(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
function inferTermMatch(term) {
  const words = normTerm(`${term.category || ''} ${term.service || ''}`)
    .split(/[^A-Z0-9]+/)
    .filter(w => w.length >= 4 && !['DINTI','SAU','IMPLANTI','TOTALA','TITAN','FULL','ANATOMIC','PROTEZA','LUCRATOARE','ZILE'].includes(w));
  return [...new Set(words)].slice(0, 6);
}
function hydrateLabTerm(term) {
  const min = Number(term.min || term.urgentMin || 0);
  const urgentMin = Number(term.urgentMin || min || 0);
  return {
    category: String(term.category || '').trim() || 'ALTE TIPURI',
    service: String(term.service || '').trim() || 'Serviciu nou',
    time: String(term.time || '').trim() || `${min || 1} zile`,
    min: min || urgentMin || 1,
    max: Number(term.max || term.min || urgentMin || 1),
    urgentMin: urgentMin || min || 1,
    match: Array.isArray(term.match) && term.match.length ? term.match : inferTermMatch(term)
  };
}
function loadLabTerms() {
  try {
    const stored = JSON.parse(localStorage.getItem(LAB_TERMS_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) return stored.map(hydrateLabTerm);
  } catch {}
  return DEFAULT_LAB_TERMS.map(hydrateLabTerm);
}
function saveLabTerms(terms) {
  LAB_TERMS = terms.map(hydrateLabTerm);
  try { localStorage.setItem(LAB_TERMS_KEY, JSON.stringify(LAB_TERMS)); } catch {}
}
function resetLabTerms() {
  saveLabTerms(DEFAULT_LAB_TERMS);
}
function getLabTerm(type) {
  const t = normTerm(type);
  if (!t) return null;
  let best = null;
  LAB_TERMS.forEach(term => {
    const matchList = Array.isArray(term.match) && term.match.length ? term.match : inferTermMatch(term);
    const matches = matchList
      .map(m => normTerm(m))
      .filter(m => t.includes(m));
    if (!matches.length) return;
    const exactCategory = t.includes(normTerm(term.category)) ? 8 : 0;
    const fullPhrase = matches.some(m => m.length > 6) ? 5 : 0;
    const serviceWords = normTerm(term.service)
      .split(/[^A-Z0-9]+/)
      .filter(w => w.length >= 4 && !['DINTI','SAU','IMPLANTI','TOTALA','TITAN','FULL','ANATOMIC','PROTEZA'].includes(w));
    const serviceOverlap = serviceWords.filter(w => t.includes(w)).length;
    const score = matches.length * 10 + Math.max(...matches.map(m => m.length)) / 100 + exactCategory + fullPhrase + serviceOverlap * 3;
    if (!best || score > best.score) best = { term, score };
  });
  return best ? best.term : null;
}
function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}
function businessDaysBetween(start, end) {
  if (!start || !end || end < start) return 0;
  const d = new Date(start);
  let days = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) days++;
  }
  return days;
}
function labDeadlineStatus(c) {
  const term = getLabTerm(c.type);
  const start = parseShortDate(c.intrata);
  const finala = parseShortDate(c.finala);
  const businessDays = start && finala ? businessDaysBetween(start, finala) : null;
  const min = term ? (term.urgentMin || term.min) : null;
  const urgent = Boolean(term && businessDays !== null && businessDays < min);
  return { term, businessDays, min, urgent };
}

// Helper folosit peste tot ca să excludem înregistrările goale (fără nume,
// fără clinică și fără tip). Garantează că toate contoarele (sidebar, KPI,
// tabel pe luni) folosesc aceeași definiție de „caz valid".
function isValidCase(c) {
  if (!c) return false;
  return Boolean((c.name||'').trim() || (c.clinic||'').trim() || (c.type||'').trim());
}

function getClinic(id)   { return CLINICS.find(c => c.id === id); }
function getEmployee(id) { return id ? EMPLOYEES.find(e => e.id === id) : null; }
function getStage(id)    { return STAGES.find(s => s.id === id); }
function getCase(id)     { return CASES.find(c => c.id === Number(id)); }
function casesForClinic(id) { return CASES.filter(c => c.clinic === id); }
function casesInStage(id)   { return CASES.filter(c => c.stage === id); }
function isCaseArchived(c) { return c?.stage === 'trimis' || c?.stage === 'anulat'; }
function isCaseBlocked(c) { return c?.stage === 'blocat'; }
function nextStage(current, type) {
  const workType = normTerm(type);
  const flow = isDesignOnlyType(type)
    ? (current === 'proba' ? ['proba', 'terminat', 'trimis'] : ['design', 'terminat', 'trimis'])
    : workType && TYPES_SKIP_CERAMICA.some(t => workType.includes(normTerm(t)))
    ? PIPELINE_STAGES_NO_CERAMIC.concat('trimis')
    : PIPELINE_STAGES.concat('trimis');
  const i = flow.indexOf(current);
  return flow[Math.min(i + 1, flow.length - 1)] || current;
}
function resolveLabStageForCase(c, preferredStage) {
  const stages = getEtapeLabStages(c?.type);
  if (!stages.length) return null;
  if (preferredStage && stages.includes(preferredStage)) return preferredStage;
  const withStatus = status => stages.find(s => c?.stageStatuses?.[s] === status) || null;
  return withStatus('la_proba')
    || withStatus('proba_aprobata')
    || withStatus('asteptare_bari')
    || withStatus('bari_finalizate')
    || (stages.includes(c?.stage) ? c.stage : null)
    || stages.find(s => {
      const st = c?.stageStatuses?.[s];
      return st && st !== 'neincepute' && st !== 'finalizat';
    })
    || stages.find(s => (c?.stageStatuses?.[s] || 'neincepute') !== 'finalizat')
    || stages[0];
}
function setLabStageStatus(c, stageId, status, assigneeId) {
  if (!c) return null;
  const stages = getEtapeLabStages(c.type);
  const idx = stages.indexOf(stageId);
  if (idx < 0) return null;
  c.stageStatuses = c.stageStatuses || {};
  c.assignees = c.assignees || {};
  stages.forEach((s, i) => {
    if (i < idx) c.stageStatuses[s] = 'finalizat';
    else if (i === idx) c.stageStatuses[s] = status;
    else c.stageStatuses[s] = 'neincepute';
  });
  c.notStarted = false;
  c.stage = status === 'la_proba' ? 'proba' : stageId;
  const assignee = assigneeId || primaryStageAssignee(c, stageId) || null;
  if (assignee && !stageAssignees(c, stageId).includes(assignee)) addStageAssignee(c, stageId, assignee);
  c.assignee = primaryStageAssignee(c, stageId) || assignee || c.assignee || null;
  return stageId;
}
function applyCaseStageSelection(c, stageId, assigneeId) {
  if (!c || !stageId) return null;
  const stages = getEtapeLabStages(c.type);
  const activeLabStage = resolveLabStageForCase(c, stages.includes(stageId) ? stageId : null) || stages[0];
  if (stageId === 'proba') {
    return setLabStageStatus(c, activeLabStage, 'la_proba', assigneeId);
  }
  if (stageId === 'proba_aprobata') {
    return setLabStageStatus(c, activeLabStage, 'proba_aprobata', assigneeId);
  }
  if (stages.includes(stageId)) {
    return setLabStageStatus(c, stageId, 'in_lucru', assigneeId);
  }
  const finisatMap = { cam_finisat: 'cam', print_finisat: 'la_print' };
  const labStage = finisatMap[stageId];
  if (labStage) {
    c.stageStatuses = c.stageStatuses || {};
    c.assignees = c.assignees || {};
    if (stages.includes(labStage)) {
      stages.forEach((s, i) => {
        const labIdx = stages.indexOf(labStage);
        if (i <= labIdx) c.stageStatuses[s] = 'finalizat';
        else if (!c.stageStatuses[s]) c.stageStatuses[s] = 'neincepute';
      });
    }
    c.stageStatuses[labStage] = 'finalizat';
    if (assigneeId && !stageAssignees(c, labStage).includes(assigneeId)) addStageAssignee(c, labStage, assigneeId);
    c.stage = stageId;
    c.notStarted = false;
    c.assignee = primaryStageAssignee(c, labStage) || assigneeId || c.assignee || null;
    return stageId;
  }
  if (stageId === 'blocat') {
    c.stage = 'blocat';
    c.notStarted = false;
    c.assignee = null;
    return stageId;
  }
  if (stageId === 'terminat' || stageId === 'trimis' || stageId === 'anulat') {
    c.stageStatuses = c.stageStatuses || {};
    stages.forEach(s => { c.stageStatuses[s] = 'finalizat'; });
    c.stage = stageId;
    c.notStarted = false;
    c.assignee = null;
    if (stageId === 'terminat') {
      if (!c.finalTech) c.finalTech = primaryStageAssignee(c, stages[stages.length - 1]) || c.finalTech || null;
      if (!c.completedDate && typeof fmtShortDate === 'function') c.completedDate = fmtShortDate(todayLabDate());
    }
    if ((stageId === 'trimis' || stageId === 'anulat') && !c.sentDate && typeof fmtShortDate === 'function') c.sentDate = fmtShortDate(todayLabDate());
    return stageId;
  }
  c.stage = stageId;
  c.notStarted = false;
  return stageId;
}
function stageMoveOptions(c, opts = {}) {
  const options = [];
  const seen = new Set();
  const add = (value, label) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ value, label });
  };
  const skipCeramica = TYPES_SKIP_CERAMICA.some(t => normTerm(c?.type || '').includes(normTerm(t)));
  const designOnly = isDesignOnlyType(c?.type);
  STAGE_MOVE_SEQUENCE.forEach(id => {
    if (designOnly && !['design', 'proba', 'proba_aprobata', 'terminat', 'blocat', 'anulat'].includes(id)) return;
    if (skipCeramica && id === 'ceramica') return;
    add(id, getStage(id)?.name || (id === 'proba_aprobata' ? 'Probă aprobată' : id));
  });
  if (opts.includeTrimis) add('trimis', 'Trimis');
  if (opts.includeAnulat) add('anulat', 'Anulat');
  return options;
}
function selectedStageMoveValue(c) {
  if (!c) return '';
  const stages = getEtapeLabStages(c.type);
  if (stages.some(s => c.stageStatuses?.[s] === 'proba_aprobata')) return 'proba_aprobata';
  if (c.stage === 'proba' || stages.some(s => c.stageStatuses?.[s] === 'la_proba')) return 'proba';
  return c.stage || '';
}
function displayLabStageStatus(c, stageId) {
  if (!c || !stageId) return 'neincepute';
  const stages = getEtapeLabStages(c.type);
  const idx = stages.indexOf(stageId);
  if (idx < 0) return c.stageStatuses?.[stageId] || 'neincepute';
  if (c.stage === 'terminat' || c.stage === 'trimis' || c.stage === 'anulat') return 'finalizat';
  if (c.notStarted) return 'neincepute';
  const active = resolveLabStageForCase(c);
  const activeIdx = stages.indexOf(active);
  let status = c.stageStatuses?.[stageId] || 'neincepute';
  if (activeIdx > -1 && idx > activeIdx) return 'neincepute';
  if (activeIdx > -1 && idx < activeIdx && status === 'neincepute') return 'finalizat';
  if (activeIdx > -1 && idx === activeIdx && status === 'finalizat') return 'in_lucru';
  return status;
}
function completeLabStage(c, stageId) {
  c.stageStatuses = c.stageStatuses || {};
  c.assignees = c.assignees || {};
  const stages = getEtapeLabStages(c.type);
  setLabStageStatus(c, stageId, 'finalizat', primaryStageAssignee(c, stageId) || c.assignee || null);
  const nextIdx = stages.indexOf(stageId) + 1;
  if (nextIdx > 0 && nextIdx < stages.length) {
    const next = stages[nextIdx];
    c.stage = next;
    if (!c.stageStatuses[next]) c.stageStatuses[next] = 'neincepute';
    c.assignee = primaryStageAssignee(c,next);
  } else if (stages.every(s => c.stageStatuses[s] === 'finalizat')) {
    if (c.stage !== 'terminat' && c.stage !== 'trimis' && c.stage !== 'anulat') {
      c.stage = 'terminat';
      c.finalTech = primaryStageAssignee(c, stageId) || c.assignee || c.finalTech || null;
      c.completedDate = typeof fmtShortDate === 'function' ? fmtShortDate(todayLabDate()) : c.completedDate;
      c.assignee = null;
    }
  }
}
function syncCaseStageFromLabStatus(c, preferredStage) {
  if (!c || c.stage === 'trimis' || c.stage === 'terminat' || c.stage === 'anulat' || c.stage === 'blocat') return;
  const stages = getEtapeLabStages(c.type);
  c.stageStatuses = c.stageStatuses || {};
  const active = preferredStage && stages.includes(preferredStage)
    ? preferredStage
    : stages.find(s => ['in_lucru','la_proba','proba_aprobata','asteptare_bari','bari_finalizate'].includes(c.stageStatuses[s]))
      || stages.find(s => c.stageStatuses[s] !== 'finalizat')
      || stages[0];
  if (!active) return;
  const status = c.stageStatuses[active] || 'neincepute';
  if (status === 'la_proba') c.stage = 'proba';
  else c.stage = active;
  c.notStarted = stages.every(s => (c.stageStatuses[s] || 'neincepute') === 'neincepute');
  if (!c.notStarted) c.assignee = primaryStageAssignee(c, active) || c.assignee || null;
}
function labStageRequiresProbe(stageId) {
  return stageId === 'design';
}
function stageAssignees(c, stageId) {
  const raw = c?.assignees?.[stageId];
  if (!raw) return [];
  return Array.isArray(raw) ? raw.filter(Boolean) : [raw];
}
function primaryStageAssignee(c, stageId) {
  return stageAssignees(c, stageId)[0] || null;
}
function setStageAssignees(c, stageId, ids) {
  c.assignees = c.assignees || {};
  const clean = [...new Set((ids || []).filter(Boolean))];
  if (!clean.length) delete c.assignees[stageId];
  else c.assignees[stageId] = clean.length === 1 ? clean[0] : clean;
  if (c.stage === stageId) c.assignee = clean[0] || null;
}
function addStageAssignee(c, stageId, id) {
  setStageAssignees(c, stageId, [...stageAssignees(c, stageId), id]);
}
function nextCaseId() { return CASES.length ? Math.max(...CASES.map(c => c.id)) + 1 : 1; }

function extractTime(str) {
  if (!str) return '';
  const m = str.match(/\s(\d{2}:\d{2})$/);
  return m ? m[1] : '';
}

// Format european: "DD Lun" (fără an) și "DD Lun HH:MM" cu oră 24h.
// Folosit în dashboard-ul de tehnician și oriunde vrem o dată compactă.
const MON_SHORT = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
function shortDayMon(str) {
  if (!str) return '—';
  const d = parseShortDate(str);
  if (!d) return str;
  return `${d.getDate()} ${MON_SHORT[d.getMonth()]}`;
}
function shortDayMonTime(str) {
  if (!str) return '—';
  const d = parseShortDate(str);
  if (!d) return str;
  const t = extractTime(str);
  return t ? `${d.getDate()} ${MON_SHORT[d.getMonth()]} ${t}` : `${d.getDate()} ${MON_SHORT[d.getMonth()]}`;
}
function parseShortDate(str) {
  if (!str) return null;
  const s = str.split(' ')[0]; // strip HH:MM if present
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
                   Ian:0, Mai:4, Iun:5, Iul:6 }; // acceptă și prescurtările românești (Ian/Mai/Iun/Iul)
  const [m, d, explicitYear] = s.split(' ');
  if (months[m] === undefined) return null;
  const month = months[m];
  const today = new Date();
  let year = explicitYear ? Number(explicitYear) : today.getFullYear();
  const todayMonth = today.getMonth();
  if (!explicitYear) {
    if (month - todayMonth > 6) year--;
    else if (todayMonth - month > 6) year++;
  }
  return new Date(year, month, parseInt(d));
}
function fmtShortDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function todayLabDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Global, continuous numbering across ALL cases by entry order:
// #1 = first case entered (oldest "Intrată" date), #N = newest. The same
// c.seq is used everywhere a case number is shown (table, clinic portal,
// archive, case detail, lab fișă). Defined here in data.js so it is available
// on every page, not only on pages that load table.js.
function assignCaseNumbers() {
  const entryDate = c => parseShortDate(c.intrata) || parseShortDate(c.finala)
    || (c.createdAt ? new Date(c.createdAt) : null);
  // Numerotăm DOAR cazurile valide (au cel puțin nume, clinică sau tip);
  // rândurile goale din DB nu primesc seq, ca să nu inflateze contorul.
  const valid = CASES.filter(c => typeof isValidCase === 'function' ? isValidCase(c)
    : ((c.name||'').trim() || (c.clinic||'').trim() || (c.type||'').trim()));
  const sorted = valid.slice().sort((a, b) => {
    const da = entryDate(a), db = entryDate(b);
    if (da && db && da - db !== 0) return da - db;
    if (da && !db) return -1;
    if (!da && db) return 1;
    return (a.id || 0) - (b.id || 0);
  });
  sorted.forEach((c, i) => c.seq = i + 1);
}

// Nu asignăm tehnicieni automat. Cazurile primesc responsabil doar printr-o
// acțiune explicită: „Preia”, „Colaboratori” sau alegere manuală.
const STAGE_ASSIGNEE_DEFAULTS = {};

CASES.forEach(c => {
  c.assignees = c.assignees || {};
  c.stageStatuses = c.stageStatuses || {};
  // If marked as notStarted — leave ALL stages empty (no assignee, no status)
  if (c.notStarted) {
    return;
  }
  const stages = getEtapeLabStages(c.type);
  const currentIdx = stages.indexOf(c.stage);
  stages.forEach((s, i) => {
    if (currentIdx === -1) {
      // Stage not in the lab stages (e.g., 'proba', 'terminat', 'trimis') — mark all earlier as done
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'finalizat';
    } else if (i < currentIdx) {
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'finalizat';
    } else if (i === currentIdx) {
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'in_lucru';
    }
  });
  // Set primary assignee for backwards compat
  if (!c.assignee) c.assignee = primaryStageAssignee(c,c.stage) || null;
});

function computePriority(c) {
  const today = todayLabDate();
  const finala = parseShortDate(c.finala);
  const proba = c.probaDate ? parseShortDate(c.probaDate) : null;
  if (labDeadlineStatus(c).urgent) return 'urgent';
  if (!finala) return 'mediu';
  const dF = Math.ceil((finala - today) / 86400000);
  const dP = proba ? Math.ceil((proba - today) / 86400000) : null;
  if (dF < 0) return 'urgent';
  if (dP !== null && dP <= 1 && dP >= 0) return 'urgent';
  if ((c.type || '').includes('ZR') && dF < 4) return 'urgent';
  if (dF <= 3) return 'urgent';
  if (dF <= 7) return 'mediu';
  return 'reusim';
}
CASES.forEach(c => { c.priority = computePriority(c); });

// Calendar status — only 3 categories
function getCalendarStatus(c) {
  if (c.stage === 'blocat') return 'blocat';
  if (c.stage === 'terminat' || c.stage === 'trimis' || c.stage === 'anulat') return 'terminat';
  const stages = getEtapeLabStages(c.type);
  if (c.notStarted || stages.every(s => (c.stageStatuses?.[s] || 'neincepute') === 'neincepute')) return 'neincepute';
  const anyStarted = stages.some(s => c.stageStatuses?.[s] && c.stageStatuses[s] !== 'neincepute');
  return anyStarted ? 'proces' : 'neincepute';
}

function statsCountsByStage() { return STAGES.map(s => ({ name: s.name, count: casesInStage(s.id).length, color: s.color })); }
function statsCountsByClinic() { return CLINICS.map(c => ({ name: c.name, count: casesForClinic(c.id).length })); }
// Numărul de lucrări pe tip (ZR, provizorii, standart etc.) — global sau pentru o listă dată.
function statsCountsByType(caseList) {
  const list = caseList || CASES;
  const valid = list.filter(c => typeof isValidCase === 'function' ? isValidCase(c) : ((c.name||'').trim()||(c.clinic||'').trim()||(c.type||'').trim()));
  const counts = {};
  valid.forEach(c => { const t = String(c.type || '').trim() || '—'; counts[t] = (counts[t] || 0) + 1; });
  return Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}
// Pentru fiecare clinică: tipurile de lucrări și câte din fiecare (sortat descrescător).
function statsTypesByClinic() {
  return CLINICS.map(cl => {
    const cases = casesForClinic(cl.id).filter(c => typeof isValidCase === 'function' ? isValidCase(c) : true);
    const types = statsCountsByType(cases);
    return { id: cl.id, name: String(cl.name || cl.id || 'Clinică'), total: cases.length, types };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
}
// Statistici termeni per clinică: câte zile lucrătoare oferă clinica (intrare→finală)
// față de minimul recomandat pe tip de lucrare, ce procent sunt URGENTĂRI (sub minim)
// și ce procent RESPECTĂ termenii. Sortat după % urgentări (cele mai problematice sus).
function statsTermsByClinic() {
  return CLINICS.map(cl => {
    const cases = casesForClinic(cl.id).filter(c => typeof isValidCase === 'function' ? isValidCase(c) : true);
    let measured = 0, urgent = 0, sumDays = 0, sumMin = 0;
    cases.forEach(c => {
      const st = labDeadlineStatus(c);
      if (st && st.term && st.businessDays !== null && st.min != null) {
        measured++;
        sumDays += st.businessDays;
        sumMin += st.min;
        if (st.urgent) urgent++;
      }
    });
    const respected = measured - urgent;
    return {
      id: cl.id,
      name: String(cl.name || cl.id || 'Clinică'),
      total: cases.length, measured, urgent, respected,
      pctUrgent: measured ? Math.round((urgent / measured) * 100) : 0,
      pctRespected: measured ? Math.round((respected / measured) * 100) : 0,
      avgDays: measured ? Math.round((sumDays / measured) * 10) / 10 : null,
      avgMin: measured ? Math.round((sumMin / measured) * 10) / 10 : null
    };
  }).filter(x => x.measured > 0).sort((a, b) => b.pctUrgent - a.pctUrgent);
}
// Paletă stabilă pentru tipuri de lucrări.
function workTypeColor(i) {
  const palette = ['#5B8DEF','#534AB7','#185FA5','#D85A30','#1D9E75','#B07D2A','#444441','#A32D2D','#27500A','#7B5EA7','#BA7517','#2D8C8C','#C2477E','#6B7280','#9C6ADE','#E0A82E','#3D9970','#85144B'];
  return palette[i % palette.length];
}
function statsOnTimeRate() {
  const sent = CASES.filter(c => isCaseArchived(c));
  const total = sent.length;
  const late = sent.filter(c => c.late).length;
  return { total, late, onTime: total - late, rate: total ? Math.round(((total - late) / total) * 100) : 100 };
}

const NEW_CASES_KEY = 'dental-lab-new-cases-v3-clean';
function loadNewCases() {
  try {
    const stored = JSON.parse(localStorage.getItem(NEW_CASES_KEY) || '[]');
    stored.forEach(c => { if (!CASES.find(x => x.id === c.id)) CASES.push(c); });
  } catch {}
}
function persistNewCase(c) {
  try {
    const stored = JSON.parse(localStorage.getItem(NEW_CASES_KEY) || '[]');
    stored.push(c);
    localStorage.setItem(NEW_CASES_KEY, JSON.stringify(stored));
  } catch {}
}
loadNewCases();

function getCurrentUser() { try { return JSON.parse(localStorage.getItem('dental-lab-user') || 'null'); } catch { return null; } }
function setCurrentUser(user) { localStorage.setItem('dental-lab-user', JSON.stringify(user)); }

const COMMON_TYPES = ['ZR FULL', 'ZR FULL IMPL', 'ZR STR DINTE', 'ZR STR IMPL', 'PROVIZORIE', 'STANDART', 'EMAX', 'PMMA DINTI', 'PMMA IMPL', 'PMMA DINTI/IMPL', 'SUPERIOR', 'SUPERIOR TITAN', 'COMPLEX', 'MOCKUP', 'MARYLAND', 'MODEL', 'GHID', 'REFACERE'];
const COLORS_VITA = ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','D2','D3','BL1','BL2','BL3','BL4'];
// Mapare tehnician → etapă
const TECH_STAGE_MAP = {
  tchi: 'design',
  vcel: 'design',
  ikar: 'design',
  acur: 'ceramica',
  vgra: 'ceramica',
  amoi: 'prelucrare',
  avar: 'prelucrare',
};
function techStage(techId) { return TECH_STAGE_MAP[techId] || 'design'; }

const ARCHIVED_CASES = [];
ARCHIVED_CASES.forEach(c => { if (!CASES.find(x => x.id === c.id)) { c.priority = computePriority(c); CASES.push(c); } });
