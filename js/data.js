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

const CASES = [
  { id: 160, name: 'Farcasanu Anca',         clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'ZR FULL IMPL', color: 'A2', stage: 'design',     intrata: 'Apr 30', probaDate: 'May 3', finala: 'May 5', notes: 'Lucrare pe implant maxilar', teeth: [{n:14,type:'implant'},{n:13,type:'crown'}] },
  { id: 125, name: 'Radu Ana Maria',         clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'ZR FULL IMPL', color: 'A2', stage: 'design',     intrata: 'Apr 27', probaDate: 'May 3', finala: 'May 5', warn: true, teeth: [{n:11,type:'crown'},{n:21,type:'crown'}] },
  { id: 162, name: 'Columbanu Ecaterina',    clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'PROVIZORIE',   color: 'A3', stage: 'design',     intrata: 'Apr 30', finala: 'May 4', notes: 'DOAR DESIGN', notStarted: true, teeth: [] },
  { id: 161, name: 'Vintu Irina',            clinic: 'elite',    doctor: 'Dr. Ionescu R.', type: 'ZR FULL',       color: 'A2', stage: 'cam',        intrata: 'Apr 30', probaDate: 'May 1', finala: 'May 1', late: true, teeth: [{n:14,type:'crown'},{n:13,type:'crown'},{n:12,type:'crown'}] },
  { id: 156, name: 'Cojocaru Victoria',      clinic: 'elite',    doctor: 'Dr. Ionescu R.', type: 'ZR FULL',       color: 'A3', stage: 'cam',        intrata: 'Apr 29', probaDate: 'May 5', finala: 'May 7', teeth: [{n:24,type:'crown'},{n:25,type:'crown'}] },
  { id: 141, name: 'Bengoi Elvis Marius',    clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'ZR FULL',       color: 'A2', stage: 'cam',        intrata: 'Apr 28', probaDate: 'May 3', finala: 'May 5', notes: 'proba FREZATA la clinica', teeth: [{n:14,type:'crown'},{n:13,type:'crown'},{n:12,type:'implant'},{n:11,type:'crown'},{n:21,type:'crown'},{n:22,type:'implant'},{n:23,type:'crown'},{n:24,type:'crown'}], amprentaType: 'Silicon' },
  { id: 144, name: 'Nastase Andreea Otilia', clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'PMMA DINTI',     color: 'A3', stage: 'cam',        intrata: 'Apr 28', finala: 'May 4', teeth: [{n:13,type:'crown'}] },
  { id: 132, name: 'Cecan Mina',             clinic: 'fav',      doctor: 'Dr. Favorov S.', type: 'PROVIZORIE',     color: 'A2', stage: 'prelucrare', intrata: 'Apr 27', probaDate: 'May 2', finala: 'May 4', notes: 'Bara Cara Ivan', teeth: [{n:11,type:'crown'},{n:21,type:'crown'}] },
  { id: 118, name: 'Tibuleac Ion',           clinic: 'fav',      doctor: 'Dr. Favorov S.', type: 'STANDART',       color: 'A2', stage: 'prelucrare', intrata: 'Apr 24', probaDate: 'May 2', finala: 'May 4', warn: true, notes: 'A2', teeth: [{n:14,type:'crown'},{n:13,type:'crown'}] },
  { id: 134, name: 'Ioxa Victoria',          clinic: 'elite',    doctor: 'Dr. Ionescu R.', type: 'ZR FULL IMPL',   color: 'A2', stage: 'ceramica',   intrata: 'Apr 28', probaDate: 'May 3', finala: 'May 5', teeth: [{n:36,type:'implant'},{n:37,type:'implant'}] },
  { id: 108, name: 'Olaru Ioana',            clinic: 'esthetic', doctor: 'Dr. Stoica L.',  type: 'EMAX',           color: 'A1', stage: 'ceramica',   intrata: 'Apr 24', probaDate: 'May 3', finala: 'May 5', notes: 'facem PROBA pmma pana se intareste', teeth: [{n:11,type:'emax'},{n:21,type:'emax'}] },
  { id: 145, name: 'Botan Mariana',          clinic: 'fav',      doctor: 'Dr. Favorov S.', type: 'ZR FULL',        color: 'A2', stage: 'proba',      intrata: 'Apr 29', probaDate: 'May 5', finala: 'May 6', teeth: [{n:14,type:'crown'},{n:13,type:'crown'},{n:12,type:'crown'}] },
  { id: 154, name: 'Papanaga Valentina',     clinic: 'fav',      doctor: 'Dr. Favorov S.', type: 'PROVIZORIE',     color: 'A3', stage: 'terminat',   intrata: 'Apr 29', probaDate: 'May 4', finala: 'May 6', notes: 'Bara Cara Ivan', teeth: [{n:11,type:'crown'}] },
  { id: 79,  name: 'Cristea Monica',         clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'STANDART',       color: 'A2', stage: 'proba',      intrata: 'Apr 16', probaDate: 'May 5', finala: 'May 6', late: true, teeth: [{n:14,type:'crown'}] },
  { id: 137, name: 'Litcanu Ileana',         clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'STANDART',       color: 'A3', stage: 'terminat',   intrata: 'Apr 28', probaDate: 'May 4', finala: 'May 6', notes: 'pmma standard plus bara', teeth: [{n:13,type:'crown'},{n:23,type:'crown'}] },
  { id: 155, name: 'Iapara Aurel',           clinic: 'fav',      doctor: 'Dr. Favorov S.', type: 'PROVIZORIE',     color: 'A2', stage: 'proba',      intrata: 'Apr 30', probaDate: 'May 5', finala: 'May 6', teeth: [{n:24,type:'crown'}] },
  { id: 110, name: 'Iabanji Mihail',         clinic: 'elite',    doctor: 'Dr. Ionescu R.', type: 'ZR FULL IMPL',   color: 'A2', stage: 'trimis',     intrata: 'Apr 24', finala: 'May 1', teeth: [{n:36,type:'implant'}] },
  { id: 126, name: 'Svetlana Captari',       clinic: 'pana',     doctor: 'Dr. Pană M.',    type: 'ZR FULL IMPL',   color: 'A2', stage: 'trimis',     intrata: 'Apr 27', finala: 'May 1', teeth: [{n:11,type:'implant'}] }
];

const NOTIFICATIONS = [
  { id: 1, kind: 'Deadline',     time: 'acum 5 min',  text: '<b>Cecan Mina</b> · #132 trebuia finalizat astăzi.', unread: true,  caseId: 132 },
  { id: 2, kind: 'Notă clinică', time: 'acum 14 min', text: 'CRISDENT pe <b>#141</b>: schimbați culoarea la A2.', unread: true,  caseId: 141 },
  { id: 3, kind: 'Etapă',        time: 'acum 1 oră',  text: '<b>#156</b> mutat din Design în CAM.',                unread: false, caseId: 156 },
  { id: 4, kind: 'Fișier',       time: 'acum 2 ore',  text: 'FAV Dental a încărcat amprentă pe <b>#132</b>.',     unread: false, caseId: 132 },
  { id: 5, kind: 'Probă',        time: 'acum 3 ore',  text: '<b>#79</b> Cristea Monica este la clinică de 28h.', unread: false, caseId: 79 }
];

function getClinic(id)   { return CLINICS.find(c => c.id === id); }
function getEmployee(id) { return id ? EMPLOYEES.find(e => e.id === id) : null; }
function getStage(id)    { return STAGES.find(s => s.id === id); }
function getCase(id)     { return CASES.find(c => c.id === Number(id)); }
function casesForClinic(id) { return CASES.filter(c => c.clinic === id); }
function casesInStage(id)   { return CASES.filter(c => c.stage === id); }
function nextStage(current) { const i = STAGES.findIndex(s => s.id === current); return STAGES[Math.min(i + 1, STAGES.length - 1)].id; }
function nextCaseId() { return Math.max(...CASES.map(c => c.id)) + 1; }

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

const NEW_CASES_KEY = 'dental-lab-new-cases-v2';
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

// Cazuri arhivate (trimise) — adaugă pentru demo în arhivă
const ARCHIVED_CASES = [
  { id: 11, name: 'Iordan Mihai', clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'ZR FULL', color: 'A2', stage: 'trimis', intrata: 'Apr 10', finala: 'Apr 16', sentDate: 'Apr 16', durationDays: 6, finalTech: 'mt', teeth: [{n:14,type:'crown'}] },
  { id: 15, name: 'Murariu Tatiana', clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'STANDART', color: 'A2', stage: 'trimis', intrata: 'Apr 14', finala: 'Apr 19', sentDate: 'Apr 19', durationDays: 5, finalTech: 'an', teeth: [] },
  { id: 19, name: 'Bostan Vlad', clinic: 'fav', doctor: 'Dr. Favorov S.', type: 'PROVIZORIE', color: 'A3', stage: 'trimis', intrata: 'Apr 17', finala: 'Apr 22', sentDate: 'Apr 22', durationDays: 5, finalTech: 'vc', teeth: [] },
  { id: 22, name: 'Constanta R.', clinic: 'crisdent', doctor: 'Dr. Popescu A.', type: 'EMAX', color: 'A1', stage: 'trimis', intrata: 'Apr 22', finala: 'Apr 28', sentDate: 'Apr 28', durationDays: 6, finalTech: 'mt', teeth: [{n:11,type:'emax'}] }
];
ARCHIVED_CASES.forEach(c => { if (!CASES.find(x => x.id === c.id)) { c.priority = computePriority(c); CASES.push(c); } });