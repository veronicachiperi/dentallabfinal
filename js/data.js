const STAGES = [
  { id: 'design',     name: 'Design',     color: '#85B7EB', order: 1 },
  { id: 'cam',        name: 'CAM',        color: '#444441', order: 2 },
  { id: 'la_print',   name: 'La print',   color: '#185FA5', order: 3 },
  { id: 'prelucrare', name: 'Prelucrare', color: '#854F0B', order: 4 },
  { id: 'ceramica',   name: 'Ceramică',   color: '#EF9F27', order: 5 },
  { id: 'proba',      name: 'La probă',   color: '#EAC04A', order: 6 },
  { id: 'terminat',   name: 'Terminat',   color: '#97C459', order: 7 },
  { id: 'trimis',     name: 'Trimis',     color: '#27500A', order: 8 }
];

// Etape lab arătate în coloana "Etape lab" — 4 max (Design, CAM, Ceramică, Prelucrare)
const ETAPE_LAB_FULL = ['design', 'cam', 'ceramica', 'prelucrare'];
const ETAPE_LAB_NO_CERAMIC = ['design', 'cam', 'prelucrare'];
// Tipuri de lucrări care NU includ Ceramică
const TYPES_SKIP_CERAMICA = ['PROVIZORIE', 'STANDART', 'PMMA DINTI', 'PMMA IMPL', 'PMMA DINTI/IMPL'];

function getEtapeLabStages(type) {
  return TYPES_SKIP_CERAMICA.some(t => (type || '').includes(t)) ? ETAPE_LAB_NO_CERAMIC : ETAPE_LAB_FULL;
}

const PIPELINE_STAGES = ['design', 'cam', 'prelucrare', 'ceramica', 'proba', 'terminat']; // No Trimis
const PIPELINE_STAGES_NO_CERAMIC = ['design', 'cam', 'prelucrare', 'proba', 'terminat'];

const STAGE_ICONS = {
  design:     '<polygon points="12,3 21,21 3,21"/>',
  cam:        '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  la_print:   '<rect x="6" y="9" width="12" height="8"/><polyline points="6,9 6,3 18,3 18,9"/><circle cx="18" cy="13" r="1"/>',
  prelucrare: '<path d="M14.7 6.3l3 3-9 9-4 1 1-4z"/>',
  ceramica:   '<circle cx="12" cy="13" r="6"/><path d="M9 7 L9 4 L15 4 L15 7"/>',
  proba:      '<polyline points="20,6 9,17 4,12"/>',
  terminat:   '<circle cx="12" cy="12" r="9"/><polyline points="9,12 11,14 15,10"/>',
  trimis:     '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>'
};
function stageIconSVG(stageId) {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${STAGE_ICONS[stageId] || ''}</svg>`;
}

const PROBA_STATES = [
  { id: 'lab',    label: 'La lab' },
  { id: 'clinic', label: 'La clinică' },
  { id: 'back',   label: 'Înapoi la lab' }
];

const CLINICS = [
  { id: 'crisdent', name: 'CRISDENT',        doctor: 'Dr. Popescu A.' },
  { id: 'pana',     name: 'PANA DENT',       doctor: 'Dr. Pană M.' },
  { id: 'elite',    name: 'ELITE MED',       doctor: 'Dr. Ionescu R.' },
  { id: 'fav',      name: 'FAV Dental',      doctor: 'Dr. Favorov S.' },
  { id: 'esthetic', name: 'Dental Esthetic', doctor: 'Dr. Stoica L.' }
];

const EMPLOYEES = [
  { id: 'pc', name: 'Private CAD', initials: 'PC' },
  { id: 'ik', name: 'Ivan Kara',   initials: 'IK' },
  { id: 'vc', name: 'Vadim Celac', initials: 'VC' },
  { id: 'an', name: 'Andrei N.',   initials: 'AN' },
  { id: 'mt', name: 'Maria T.',    initials: 'MT' }
];

const CASES = [];

const NOTIFICATIONS = [];

const LAB_TERMS = [
  { category:'DESIGN', service:'Mockup motivational sau functional', time:'3 - 4 zile', min:3, max:4, match:['MOCKUP','DESIGN'] },
  { category:'PROVIZORII', service:'PMMA pe dinti sau implanti', time:'min. 3 zile lucratoare', min:3, max:5, match:['PMMA'] },
  { category:'PROVIZORII', service:'Provizorie all on x cu bara', time:'5 - 7 zile', min:5, max:7, match:['PROVIZOR','ALL ON','ALLON','ALL X','BARA'] },
  { category:'PROVIZORII', service:'Provizorie all on x pe tuburi', time:'4 - 5 zile', min:4, max:5, match:['PROVIZOR','TUB'] },
  { category:'ZIRCONIU', service:'Full anatomic pe dinti sau implanti', time:'5 - 7 zile', min:5, max:7, match:['ZR','ZIRCON','ZIRCONIU'] },
  { category:'ZIRCONIU', service:'Abutment individual', time:'5 - 7 zile', min:5, max:7, match:['ABUTMENT'] },
  { category:'ZIRCONIU', service:'Zr stratificat pe dinti sau implanti', time:'6 - 8 zile', min:6, max:8, match:['ZR STR','ZIRCON STR','STRATIFICAT'] },
  { category:'EMAX', service:'Full anatomic', time:'9 - 12 zile', min:9, max:12, match:['EMAX FULL','EMAX'] },
  { category:'EMAX', service:'Stratificat', time:'10 - 12 zile', min:10, max:12, match:['EMAX STR','EMAX STRATIFICAT'] },
  { category:'EMAX', service:'Inlay / Onlay', time:'5 - 7 zile', min:5, max:7, match:['INLAY','ONLAY'] },
  { category:'DEFINITIVE', service:'Proteza totala Standard CR-CO/TITAN (PMMA)', time:'7 - 9 zile', min:7, max:9, match:['STANDARD','STANDART','DEFINITIV'] },
  { category:'DEFINITIVE', service:'Proteza totala Superior CR-CO/TITAN (ZIRCONIU)', time:'10 - 14 zile', min:10, max:14, match:['SUPERIOR'] },
  { category:'DEFINITIVE', service:'Proteza totala Superior Digital TITAN/CR-CO', time:'10 - 14 zile', min:10, max:14, match:['SUPERIOR DIGITAL'] },
  { category:'DEFINITIVE', service:'Proteza totala Zirconiu pe Ti-base', time:'10 - 14 zile', min:10, max:14, match:['TI-BASE','TIBASE'] },
  { category:'ALTE TIPURI', service:'Gutiera bruxism', time:'2 - 4 zile', min:2, max:4, match:['GUTIERA','BRUXISM'] },
  { category:'ALTE TIPURI', service:'Ghid chirurgical gingivectomie', time:'3 - 4 zile', min:3, max:4, match:['GHID','GINGIVECTOMIE'] },
  { category:'ALTE TIPURI', service:'Ghid reconstructie bonturi', time:'4 - 5 zile', min:4, max:5, match:['GHID','BONT'] }
];

function normTerm(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
function getLabTerm(type) {
  const t = normTerm(type);
  if (!t) return null;
  let best = null;
  LAB_TERMS.forEach(term => {
    const matches = term.match
      .map(m => normTerm(m))
      .filter(m => t.includes(m));
    if (!matches.length) return;
    const exactCategory = t.includes(normTerm(term.category)) ? 8 : 0;
    const fullPhrase = matches.some(m => m.length > 6) ? 5 : 0;
    const score = matches.length * 10 + Math.max(...matches.map(m => m.length)) / 100 + exactCategory + fullPhrase;
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
  const urgent = Boolean(term && businessDays !== null && businessDays < term.min);
  return { term, businessDays, urgent };
}

function getClinic(id)   { return CLINICS.find(c => c.id === id); }
function getEmployee(id) { return id ? EMPLOYEES.find(e => e.id === id) : null; }
function getStage(id)    { return STAGES.find(s => s.id === id); }
function getCase(id)     { return CASES.find(c => c.id === Number(id)); }
function casesForClinic(id) { return CASES.filter(c => c.clinic === id); }
function casesInStage(id)   { return CASES.filter(c => c.stage === id); }
function nextStage(current, type) {
  const flow = type && TYPES_SKIP_CERAMICA.some(t => (type || '').includes(t))
    ? PIPELINE_STAGES_NO_CERAMIC.concat('trimis')
    : PIPELINE_STAGES.concat('trimis');
  const i = flow.indexOf(current);
  return flow[Math.min(i + 1, flow.length - 1)] || current;
}
function completeLabStage(c, stageId) {
  c.stageStatuses = c.stageStatuses || {};
  c.assignees = c.assignees || {};
  c.stageStatuses[stageId] = 'finalizat';
  c.notStarted = false;
  const stages = getEtapeLabStages(c.type);
  const nextIdx = stages.indexOf(stageId) + 1;
  if (nextIdx > 0 && nextIdx < stages.length) {
    const next = stages[nextIdx];
    c.stage = next;
    if (!c.stageStatuses[next] || c.stageStatuses[next] === 'neincepute') c.stageStatuses[next] = 'in_lucru';
    if (!c.assignees[next]) c.assignees[next] = STAGE_ASSIGNEE_DEFAULTS[next];
    c.assignee = c.assignees[next];
  } else if (stages.every(s => c.stageStatuses[s] === 'finalizat')) {
    c.stage = 'proba';
  }
}
function nextCaseId() { return CASES.length ? Math.max(...CASES.map(c => c.id)) + 1 : 1; }

function parseShortDate(str) {
  if (!str) return null;
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const [m, d] = str.split(' ');
  if (months[m] === undefined) return null;
  return new Date(2026, months[m], parseInt(d));
}
function fmtShortDate(date) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()] + ' ' + date.getDate();
}

const STAGE_ASSIGNEE_DEFAULTS = { design:'pc', cam:'ik', la_print:'ik', prelucrare:'vc', ceramica:'mt', proba:'an', terminat:'an', trimis:'an' };

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
      if (!c.assignees[s]) c.assignees[s] = STAGE_ASSIGNEE_DEFAULTS[s];
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'finalizat';
    } else if (i < currentIdx) {
      if (!c.assignees[s]) c.assignees[s] = STAGE_ASSIGNEE_DEFAULTS[s];
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'finalizat';
    } else if (i === currentIdx) {
      if (!c.assignees[s]) c.assignees[s] = STAGE_ASSIGNEE_DEFAULTS[s];
      if (!c.stageStatuses[s]) c.stageStatuses[s] = 'in_lucru';
    }
  });
  // Set primary assignee for backwards compat
  if (!c.assignee) c.assignee = c.assignees[c.stage] || c.assignees[stages[0]];
});

function computePriority(c) {
  const today = new Date(2026, 4, 4);
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
  if (c.stage === 'terminat' || c.stage === 'trimis') return 'terminat';
  if (c.notStarted) return 'neincepute';
  const stages = getEtapeLabStages(c.type);
  const anyStarted = stages.some(s => c.stageStatuses?.[s] && c.stageStatuses[s] !== 'neincepute');
  return anyStarted ? 'proces' : 'neincepute';
}

function statsCountsByStage() { return STAGES.map(s => ({ name: s.name, count: casesInStage(s.id).length, color: s.color })); }
function statsCountsByClinic() { return CLINICS.map(c => ({ name: c.name, count: casesForClinic(c.id).length })); }
function statsOnTimeRate() { const total = CASES.length, late = CASES.filter(c => c.late).length; return { total, late, onTime: total - late, rate: total ? Math.round(((total - late) / total) * 100) : 100 }; }

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
  pc: 'design',
  ik: 'cam',
  vc: 'prelucrare',
  mt: 'ceramica',
  an: 'prelucrare'
};
function techStage(techId) { return TECH_STAGE_MAP[techId] || 'design'; }

const ARCHIVED_CASES = [];
ARCHIVED_CASES.forEach(c => { if (!CASES.find(x => x.id === c.id)) { c.priority = computePriority(c); CASES.push(c); } });
