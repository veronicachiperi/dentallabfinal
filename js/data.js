/* ==========================================================================
   Demo data — replace with API calls when backend is ready
   ========================================================================== */

const STAGES = [
  { id: 'design',    name: 'Design',    color: '#7F77DD', order: 1 },
  { id: 'cam',       name: 'CAM',       color: '#1D9E75', order: 2 },
  { id: 'prelucrare',name: 'Prelucrare',color: '#D85A30', order: 3 },
  { id: 'ceramica',  name: 'Ceramică',  color: '#BA7517', order: 4 },
  { id: 'proba',     name: 'Probă',     color: '#185FA5', order: 5 },
  { id: 'trimisa',   name: 'Trimisă',   color: '#1D9E75', order: 6 }
];

const PROBA_STATES = [
  { id: 'lab',    label: 'La lab' },
  { id: 'clinic', label: 'La clinică' },
  { id: 'back',   label: 'Înapoi la lab' }
];

const CLINICS = [
  { id: 'crisdent',  name: 'CRISDENT',        doctor: 'Dr. Popescu A.' },
  { id: 'pana',      name: 'PANA DENT',       doctor: 'Dr. Pană M.' },
  { id: 'elite',     name: 'ELITE MED',       doctor: 'Dr. Ionescu R.' },
  { id: 'fav',       name: 'FAV Dental',      doctor: 'Dr. Favorov S.' },
  { id: 'esthetic',  name: 'Dental Esthetic', doctor: 'Dr. Stoica L.' }
];

const EMPLOYEES = [
  { id: 'pc',  name: 'Private CAD',  initials: 'PC' },
  { id: 'ik',  name: 'Ivan Kara',    initials: 'IK' },
  { id: 'vc',  name: 'Vadim Celac',  initials: 'VC' },
  { id: 'an',  name: 'Andrei N.',    initials: 'AN' },
  { id: 'mt',  name: 'Maria T.',     initials: 'MT' }
];

// Cases — taken from actual board data (April 2026)
const CASES = [
  // Design
  { id: 160, name: 'Farcasanu Anca',        clinic: 'crisdent', type: 'ZR FULL IMPL', stage: 'design',     priority: 'reusim', intrata: 'Apr 30', finala: 'May 5', assignee: 'ik', notes: 'Lucrare pe implant maxilar' },
  { id: 125, name: 'Radu Ana Maria',        clinic: 'crisdent', type: 'ZR FULL IMPL', stage: 'design',     priority: 'reusim', intrata: 'Apr 27', finala: 'May 5', assignee: 'pc', warn: true },
  { id: 162, name: 'Columbanu Ecaterina',   clinic: 'crisdent', type: 'PROVIZORIE',   stage: 'design',     priority: 'urgent', intrata: 'Apr 30', finala: 'May 4', assignee: 'pc', notes: 'DOAR DESIGN' },

  // CAM
  { id: 161, name: 'Vintu Irina',           clinic: 'elite',    type: 'ZR FULL',       stage: 'cam',        priority: 'urgent', intrata: 'Apr 30', finala: 'May 1', assignee: 'ik', late: true },
  { id: 156, name: 'Cojocaru Victoria',     clinic: 'elite',    type: 'ZR FULL',       stage: 'cam',        priority: 'mediu',  intrata: 'Apr 29', finala: 'May 7', assignee: 'ik' },
  { id: 141, name: 'Bengoi Elvis Marius',   clinic: 'crisdent', type: 'ZR FULL',       stage: 'cam',        priority: 'mediu',  intrata: 'Apr 28', finala: 'May 5', assignee: 'pc', notes: 'proba FREZATA la clinica' },
  { id: 144, name: 'Nastase Andreea Otilia',clinic: 'crisdent', type: 'PMMA DINTI',    stage: 'cam',        priority: 'mediu',  intrata: 'Apr 28', finala: 'May 4', assignee: 'an' },

  // Prelucrare
  { id: 132, name: 'Cecan Mina',            clinic: 'fav',      type: 'PROVIZORIE',    stage: 'prelucrare', priority: 'mediu',  intrata: 'Apr 27', finala: 'May 4', assignee: 'vc', notes: 'Bara Cara Ivan' },
  { id: 118, name: 'Tibuleac Ion',          clinic: 'fav',      type: 'STANDART',      stage: 'prelucrare', priority: 'mediu',  intrata: 'Apr 24', finala: 'May 4', assignee: 'vc', warn: true, notes: 'A2' },

  // Ceramică
  { id: 134, name: 'Ioxa Victoria',         clinic: 'elite',    type: 'ZR FULL IMPL',  stage: 'ceramica',   priority: 'mediu',  intrata: 'Apr 28', finala: 'May 5', assignee: 'mt' },
  { id: 108, name: 'Olaru Ioana',           clinic: 'esthetic', type: 'EMAX',          stage: 'ceramica',   priority: 'mediu',  intrata: 'Apr 24', finala: 'May 5', assignee: 'mt', notes: 'facem PROBA pmma pana se intareste' },

  // Probă (with proba state)
  { id: 145, name: 'Botan Mariana',         clinic: 'fav',      type: 'ZR FULL',       stage: 'proba',      priority: 'reusim', intrata: 'Apr 29', finala: 'May 6', assignee: 'mt', probaState: 'lab',    probaHours: 8 },
  { id: 154, name: 'Papanaga Valentina',    clinic: 'fav',      type: 'PROVIZORIE',    stage: 'proba',      priority: 'reusim', intrata: 'Apr 29', finala: 'May 6', assignee: 'vc', probaState: 'back',   probaHours: 1, notes: 'Bara Cara Ivan' },
  { id: 79,  name: 'Cristea Monica',        clinic: 'crisdent', type: 'STANDART',      stage: 'proba',      priority: 'reusim', intrata: 'Apr 16', finala: 'May 6', assignee: 'an', probaState: 'clinic', probaHours: 28, late: true },
  { id: 137, name: 'Litcanu Ileana',        clinic: 'crisdent', type: 'STANDART',      stage: 'proba',      priority: 'reusim', intrata: 'Apr 28', finala: 'May 6', assignee: 'an', probaState: 'lab',    probaHours: 1, notes: 'pmma standard plus bara' },
  { id: 155, name: 'Iapara Aurel',          clinic: 'fav',      type: 'PROVIZORIE',    stage: 'proba',      priority: 'reusim', intrata: 'Apr 30', finala: 'May 6', assignee: 'vc', probaState: 'lab',    probaHours: 4 },

  // Trimisă
  { id: 110, name: 'Iabanji Mihail',        clinic: 'elite',    type: 'ZR FULL IMPL',  stage: 'trimisa',    priority: 'urgent', intrata: 'Apr 24', finala: 'May 1', assignee: 'mt' },
  { id: 126, name: 'Svetlana Captari',      clinic: 'pana',     type: 'ZR FULL IMPL',  stage: 'trimisa',    priority: 'mediu',  intrata: 'Apr 27', finala: 'May 1', assignee: 'mt' }
];

const NOTIFICATIONS = [
  { id: 1, kind: 'Deadline',     time: 'acum 5 min', text: '<b>Cecan Mina</b> · #132 trebuia finalizat astăzi.', unread: true,  caseId: 132 },
  { id: 2, kind: 'Notă clinică', time: 'acum 14 min', text: 'CRISDENT pe <b>#141</b>: schimbați culoarea la A2.', unread: true,  caseId: 141 },
  { id: 3, kind: 'Etapă',        time: 'acum 1 oră',  text: '<b>#156</b> mutat din Design în CAM.',                unread: false, caseId: 156 },
  { id: 4, kind: 'Fișier',       time: 'acum 2 ore',  text: 'FAV Dental a încărcat amprentă pe <b>#132</b>.',     unread: false, caseId: 132 },
  { id: 5, kind: 'Probă',        time: 'acum 3 ore',  text: '<b>#79</b> Cristea Monica este la clinică de 28h.', unread: false, caseId: 79 }
];

// Persistence -------------------------------------------------------------
const NEW_CASES_KEY = 'dental-lab-new-cases-v1';

function loadNewCases() {
  try {
    const stored = JSON.parse(localStorage.getItem(NEW_CASES_KEY) || '[]');
    stored.forEach(c => {
      if (!CASES.find(x => x.id === c.id)) CASES.push(c);
    });
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

// Helpers ------------------------------------------------------------------
function getClinic(id)   { return CLINICS.find(c => c.id === id); }
function getEmployee(id) { return EMPLOYEES.find(e => e.id === id); }
function getStage(id)    { return STAGES.find(s => s.id === id); }
function getCase(id)     { return CASES.find(c => c.id === Number(id)); }
function casesForClinic(id) { return CASES.filter(c => c.clinic === id); }
function casesInStage(id)   { return CASES.filter(c => c.stage === id); }

function nextProbaState(current) {
  const idx = PROBA_STATES.findIndex(s => s.id === current);
  return PROBA_STATES[(idx + 1) % PROBA_STATES.length].id;
}

function nextStage(current) {
  const idx = STAGES.findIndex(s => s.id === current);
  return STAGES[Math.min(idx + 1, STAGES.length - 1)].id;
}

function nextCaseId() {
  return Math.max(...CASES.map(c => c.id)) + 1;
}

// Date helper — converts "May 5" / "Apr 28" to a real Date in current/year prior
function parseShortDate(str) {
  if (!str) return null;
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const [m, d] = str.split(' ');
  const month = months[m];
  const year = 2026; // demo year
  if (month === undefined) return null;
  return new Date(year, month, parseInt(d));
}

function fmtShortDate(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Statistics helpers ------------------------------------------------------
function statsCountsByStage() {
  return STAGES.map(s => ({ name: s.name, count: casesInStage(s.id).length, color: s.color }));
}
function statsCountsByClinic() {
  return CLINICS.map(c => ({ name: c.name, count: casesForClinic(c.id).length }));
}
function statsCountsByType() {
  const map = {};
  CASES.forEach(c => { map[c.type] = (map[c.type] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}
function statsOnTimeRate() {
  const total = CASES.length;
  const late = CASES.filter(c => c.late).length;
  return { total, late, onTime: total - late, rate: total ? Math.round(((total - late) / total) * 100) : 100 };
}
function statsAvgDays() {
  const completed = CASES.filter(c => c.stage === 'trimisa');
  if (!completed.length) return 0;
  let total = 0, n = 0;
  completed.forEach(c => {
    const intr = parseShortDate(c.intrata);
    const fin = parseShortDate(c.finala);
    if (intr && fin) { total += Math.round((fin - intr) / 86400000); n++; }
  });
  return n ? Math.round(total / n) : 0;
}
// =========================================================================
// Stage-specific assignees + auto-priority
// =========================================================================
const STAGE_ASSIGNEE_DEFAULTS = {
  design:    'pc',
  cam:       'ik',
  prelucrare:'vc',
  ceramica:  'mt',
  proba:     'an',
  trimisa:   'an'
};

// Auto-populate per-stage assignees
CASES.forEach(c => {
  c.assignees = c.assignees || {};
  const stageOrder = STAGES.findIndex(s => s.id === c.stage);
  STAGES.forEach((s, i) => {
    if (i <= stageOrder && !c.assignees[s.id]) {
      c.assignees[s.id] = c.assignee || STAGE_ASSIGNEE_DEFAULTS[s.id];
    }
  });
  if (!c.probaDate && (c.stage === 'proba' || c.stage === 'ceramica' || c.stage === 'prelucrare')) {
    const fin = parseShortDate(c.finala);
    if (fin) {
      const probaD = new Date(fin); probaD.setDate(fin.getDate() - 2);
      c.probaDate = fmtShortDate(probaD);
    }
  }
});

// Mark a couple cases as "neincepute" for demo
[160, 162].forEach(id => {
  const c = getCase(id);
  if (c) {
    c.assignees.design = null;
    c.notStarted = true;
  }
});

// Auto-priority based on final date / probă date / type
function computePriority(c) {
  const today = new Date(2026, 4, 2);
  const finala = parseShortDate(c.finala);
  const proba = c.probaDate ? parseShortDate(c.probaDate) : null;

  if (!finala) return c.priority || 'mediu';

  const daysToFinal = Math.ceil((finala - today) / 86400000);
  const daysToProba = proba ? Math.ceil((proba - today) / 86400000) : null;

  if (daysToFinal < 0) return 'urgent';
  if (daysToProba !== null && daysToProba <= 1 && daysToProba >= 0) return 'urgent';
  if ((c.type || '').includes('ZR') && daysToFinal < 4) return 'urgent';
  if (daysToFinal <= 3) return 'urgent';
  if (daysToFinal <= 7) return 'mediu';
  return 'reusim';
}

// Apply computed priority to all cases
CASES.forEach(c => { c.priority = computePriority(c); });