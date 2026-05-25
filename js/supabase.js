// ============================================================
// Supabase integration — auth + database + real-time
// Fill in SUPABASE_URL and SUPABASE_ANON_KEY from:
//   https://app.supabase.com → Project Settings → API
// ============================================================
const SUPABASE_URL      = 'https://rzfxahuaoblpniaakqun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZnhhaHVhb2JscG5pYWFrcXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTE3NTAsImV4cCI6MjA5NDMyNzc1MH0.LKmQNLhvg8t93yBp-zNSP1-csVbJwjrusdVL4yNxq5Q';

const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _sb      = null;
let _session = null;
let _profile = null;

function _client() {
  if (!_sb && SUPABASE_CONFIGURED) {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _sb;
}

// Converts any username to a valid email local part.
// If autofill pastes a full email (contains @), use it as-is.
function _toEmail(username) {
  const u = username.toLowerCase().trim();
  if (u.includes('@')) return u;
  return u.replace(/[^a-z0-9._+-]/g, '_') + '@gmail.com';
}

// ── Auth ─────────────────────────────────────────────────────
async function sbRequireAuth() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await _client().auth.getSession();
  if (!data.session) {
    if (!location.pathname.includes('login.html')) location.href = 'login.html';
    return null;
  }
  _session = data.session;
  const { data: p } = await _client().from('profiles').select('*').eq('id', _session.user.id).single();
  _profile = p || null;
  if (_profile) {
    setCurrentUser({
      id:         _profile.employee_id || _profile.clinic_id || _profile.id,
      supabaseId: _profile.id,
      name:       _profile.username,
      initials:   _profile.username.slice(0, 2).toUpperCase(),
      role:       _profile.role,
      clinic:     _profile.clinic_id  || null,
      employeeId: _profile.employee_id || null,
    });
  }
  return _profile;
}

async function sbSignIn(username, password) {
  const { data, error } = await _client().auth.signInWithPassword({
    email:    _toEmail(username),
    password,
  });
  if (error) throw error;
  _session = data.session;
  const { data: p } = await _client().from('profiles').select('*').eq('id', data.user.id).single();
  _profile = p || null;
  if (!_profile) {
    // Auth succeeded but no profile row — account has no role, deny access
    await _client().auth.signOut();
    throw new Error('Cont neautorizat. Contactați administratorul pentru acces.');
  }
  setCurrentUser({
    id:         _profile.employee_id || _profile.clinic_id || _profile.id,
    supabaseId: _profile.id,
    name:       _profile.username,
    initials:   _profile.username.slice(0, 2).toUpperCase(),
    role:       _profile.role,
    clinic:     _profile.clinic_id  || null,
    employeeId: _profile.employee_id || null,
  });
  // Log successful sign-in
  await _sbLog('login', 'auth', _profile.username, { role: _profile.role });
  return _profile;
}

async function sbSignUp(username, password, role, clinicId, employeeId) {
  if (!['technician', 'clinic'].includes(role)) throw new Error('Rol invalid pentru auto-înregistrare');
  const { data, error } = await _client().auth.signUp({
    email:    _toEmail(username),
    password,
  });
  if (error) throw error;
  const { error: pe } = await _client().from('profiles').insert({
    id:          data.user.id,
    username:    username.trim(),
    role,
    clinic_id:   clinicId   || null,
    employee_id: employeeId || null,
  });
  if (pe) throw pe;
  _session = data.session;
  return data;
}

async function sbSignOut() {
  if (_client()) await _client().auth.signOut();
  localStorage.removeItem('dental-lab-user');
  location.href = 'login.html';
}

function sbProfile()   { return _profile; }
function sbSession()   { return _session; }
function sbIsAdmin()   { return _profile?.role === 'admin'; }
function sbIsTech()    { return _profile?.role === 'technician'; }
function sbIsClinic()  { return _profile?.role === 'clinic'; }
function sbClinicId()  { return _profile?.clinic_id || null; }

// ── Case DB mapping ──────────────────────────────────────────
function _dbToCase(row) {
  return {
    id:           row.id,
    name:         row.name           || '',
    lastName:     row.last_name      || '',
    firstName:    row.first_name     || '',
    clinic:       row.clinic_id      || '',
    doctor:       row.doctor         || '',
    type:         row.type           || '',
    color:        row.color          || '',
    stage:        row.stage          || 'design',
    notStarted:   row.not_started === true,
    assignee:     row.assignee       || null,
    assignees:    row.assignees      || {},
    stageStatuses:row.stage_statuses || {},
    intrata:      row.intrata        || '',
    probaDate:    row.proba_date     || '',
    finala:       row.finala         || '',
    implantType:  row.implant_type   || '',
    amprentaType: row.amprenta_type  || '',
    teeth:        row.teeth          || [],
    notes:        row.notes          || '',
    priority:     row.priority       || 'mediu',
    sentDate:     row.sent_date      || '',
    late:         false,
    warn:         false,
    deadlineUrgent: false,
    createdAt:    row.created_at,
  };
}

function _caseToDb(c) {
  return {
    name:           c.name         || '',
    last_name:      c.lastName     || '',
    first_name:     c.firstName    || '',
    clinic_id:      c.clinic       || '',
    doctor:         c.doctor       || '',
    type:           c.type         || '',
    color:          c.color        || '',
    stage:          c.stage        || 'design',
    not_started:    Boolean(c.notStarted),
    assignee:       c.assignee     || null,
    assignees:      c.assignees    || {},
    stage_statuses: c.stageStatuses || {},
    intrata:        c.intrata      || null,
    proba_date:     c.probaDate    || null,
    finala:         c.finala       || null,
    implant_type:   c.implantType  || '',
    amprenta_type:  c.amprentaType || '',
    teeth:          c.teeth        || [],
    notes:          c.notes        || '',
    priority:       c.priority     || 'mediu',
    sent_date:      c.sentDate     || null,
  };
}

// ── Cases CRUD ────────────────────────────────────────────────
async function sbLoadCases() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data, error } = await _client()
    .from('cases')
    .select('*')
    .order('id', { ascending: false });
  if (error) { console.error('[supabase] loadCases:', error.message); return null; }
  return data.map(_dbToCase);
}

async function sbSaveCase(c) {
  if (!SUPABASE_CONFIGURED) return;
  const db = _caseToDb(c);
  if (!c.id) {
    const { data, error } = await _client().from('cases').insert(db).select().single();
    if (error) throw error;
    c.id = data.id;
    await _sbLog('add_case', 'case', String(c.id), { patient: c.name, clinic: c.clinic });
  } else {
    const { error } = await _client().from('cases').update(db).eq('id', c.id);
    if (error) throw error;
    await _sbLog('update_case', 'case', String(c.id), { patient: c.name });
  }
}

async function sbUpdateField(c, field, value) {
  if (!SUPABASE_CONFIGURED || !c?.id) return;
  const colMap = {
    name: 'name', stage: 'stage', type: 'type', color: 'color',
    notes: 'notes', assignee: 'assignee', assignees: 'assignees',
    stageStatuses: 'stage_statuses', notStarted: 'not_started',
    intrata: 'intrata', probaDate: 'proba_date', finala: 'finala',
    priority: 'priority', implantType: 'implant_type', amprentaType: 'amprenta_type',
    sentDate: 'sent_date',
    teeth: 'teeth', doctor: 'doctor', clinic: 'clinic_id',
  };
  const col = colMap[field];
  if (!col) return;
  await _client().from('cases').update({ [col]: value }).eq('id', c.id);
  await _sbLog('update_case', 'case', String(c.id), { patient: c.name, field });
}

async function sbDeleteCase(caseId, caseName) {
  if (!SUPABASE_CONFIGURED) return;
  const { error } = await _client().from('cases').delete().eq('id', caseId);
  if (error) throw error;
  await _sbLog('delete_case', 'case', String(caseId), { patient: caseName });
}

// ── Activity log ─────────────────────────────────────────────
async function _sbLog(action, entityType, entityId, details) {
  if (!SUPABASE_CONFIGURED || !_session) return;
  await _client().from('activity_log').insert({
    user_id:     _session.user.id,
    username:    _profile?.username || 'unknown',
    role:        _profile?.role     || 'unknown',
    action,
    entity_type: entityType,
    entity_id:   String(entityId),
    details:     details || {},
  });
}

async function sbLoadActivityLog(limit = 300) {
  if (!SUPABASE_CONFIGURED) return [];
  const { data, error } = await _client()
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return error ? [] : data;
}

// ── Clinics CRUD ─────────────────────────────────────────────
async function sbLoadClinics() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data, error } = await _client().from('clinics').select('*').order('name');
  if (error) { console.error('[supabase] loadClinics:', error.message); return null; }
  return data.map(r => ({ id: r.id, name: r.name, doctor: r.doctor || '', phone: r.phone || '', color: r.color || '' }));
}

async function sbSaveClinic(clinic) {
  if (!SUPABASE_CONFIGURED) return;
  const { error } = await _client().from('clinics').upsert(
    { id: clinic.id, name: clinic.name, doctor: clinic.doctor || '', phone: clinic.phone || '', color: clinic.color || '' }
  );
  if (error) throw error;
  await _sbLog('save_clinic', 'clinic', clinic.id, { name: clinic.name });
}

async function sbDeleteClinic(id) {
  if (!SUPABASE_CONFIGURED) return;
  const { error: pe } = await _client().from('profiles').delete().eq('clinic_id', id);
  if (pe) throw pe;
  const { error } = await _client().from('clinics').delete().eq('id', id);
  if (error) throw error;
  await _sbLog('delete_clinic', 'clinic', id, {});
}

// ── Employees CRUD ────────────────────────────────────────────
async function sbLoadEmployees() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data, error } = await _client().from('employees').select('*').order('name');
  if (error) { console.error('[supabase] loadEmployees:', error.message); return null; }
  return data.map(r => ({ id: r.id, name: r.name, initials: r.initials || '', stage: r.stage || 'design', color: r.color || '' }));
}

async function sbSaveEmployee(emp) {
  if (!SUPABASE_CONFIGURED) return;
  const { error } = await _client().from('employees').upsert(
    { id: emp.id, name: emp.name, initials: emp.initials || '', stage: emp.stage || 'design', color: emp.color || '' }
  );
  if (error) throw error;
  await _sbLog('save_employee', 'employee', emp.id, { name: emp.name });
}

async function sbDeleteEmployee(id) {
  if (!SUPABASE_CONFIGURED) return;
  const { error: pe } = await _client().from('profiles').delete().eq('employee_id', id);
  if (pe) throw pe;
  const { error } = await _client().from('employees').delete().eq('id', id);
  if (error) throw error;
  await _sbLog('delete_employee', 'employee', id, {});
}

// Creates a login account for a clinic or employee (admin only)
async function sbAdminCreateUser(username, password, role, clinicId, employeeId) {
  if (!SUPABASE_CONFIGURED) return;
  const { data, error } = await _client().auth.signUp({ email: _toEmail(username), password });
  if (error) throw error;
  // data.user is null when Supabase "Confirm email" is enabled — must be turned off
  if (!data.user) throw new Error('Dezactivați "Confirm email" în Supabase → Authentication → Providers → Email');
  const { error: pe } = await _client().from('profiles').insert({
    id: data.user.id,
    username: username.trim(),
    role,
    clinic_id:   clinicId   || null,
    employee_id: employeeId || null,
  });
  if (pe) throw pe;
  await _sbLog('create_user', 'profile', data.user.id, { username, role });
  return data;
}

// ── Real-time ────────────────────────────────────────────────
function sbSubscribeCases(onRefresh) {
  if (!SUPABASE_CONFIGURED) return;
  _client()
    .channel('cases_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, payload => {
      const evt = payload.eventType;
      if (evt === 'INSERT') {
        const c = _dbToCase(payload.new);
        postProcessCase(c);
        if (!CASES.find(x => x.id === c.id)) CASES.unshift(c);
      } else if (evt === 'UPDATE') {
        const c = _dbToCase(payload.new);
        postProcessCase(c);
        const i = CASES.findIndex(x => x.id === c.id);
        if (i >= 0) CASES[i] = c; else CASES.unshift(c);
      } else if (evt === 'DELETE') {
        const oldId = payload.old.id;
        const i = CASES.findIndex(x => x.id === oldId);
        if (i >= 0) CASES.splice(i, 1);
        // Also clear the case from this device's local cache so it can't
        // reappear from localStorage on the next page load.
        if (typeof purgeCaseFromLocalCache === 'function') purgeCaseFromLocalCache(oldId);
      }
      if (onRefresh) onRefresh();
    })
    .subscribe();
}

// ── Post-process (compute late/priority/stages) ───────────────
function postProcessCase(c) {
  c.assignees      = c.assignees      || {};
  c.stageStatuses  = c.stageStatuses  || {};
  if (!c.notStarted && typeof getEtapeLabStages === 'function') {
    const stages  = getEtapeLabStages(c.type);
    const curIdx  = stages.indexOf(c.stage);
    const def     = typeof STAGE_ASSIGNEE_DEFAULTS !== 'undefined' ? STAGE_ASSIGNEE_DEFAULTS : {};
    stages.forEach((s, i) => {
      if (curIdx === -1 || i < curIdx) {
        if (!c.assignees[s])     c.assignees[s]     = def[s];
        if (!c.stageStatuses[s]) c.stageStatuses[s] = 'finalizat';
      } else if (i === curIdx) {
        if (!c.assignees[s])     c.assignees[s]     = def[s];
        if (!c.stageStatuses[s]) c.stageStatuses[s] = 'in_lucru';
      }
    });
    if (!c.assignee) c.assignee = typeof primaryStageAssignee === 'function'
      ? (primaryStageAssignee(c,c.stage) || primaryStageAssignee(c,stages[0]))
      : (Array.isArray(c.assignees[c.stage]) ? c.assignees[c.stage][0] : c.assignees[c.stage]) || (Array.isArray(c.assignees[stages[0]]) ? c.assignees[stages[0]][0] : c.assignees[stages[0]]);
  }
  if (typeof computePriority    === 'function') c.priority      = computePriority(c);
  if (typeof labDeadlineStatus  === 'function') c.deadlineUrgent = labDeadlineStatus(c).urgent;
  if (typeof todayLabDate === 'function' && typeof parseShortDate === 'function') {
    const today = todayLabDate();
    const due   = parseShortDate(c.finala);
    if (due) {
      const d  = Math.ceil((due - today) / 86400000);
      const sent = parseShortDate(c.sentDate);
      c.late   = c.stage === 'trimis'
        ? Boolean(sent && sent > due)
        : d < 0;
      c.warn   = c.stage !== 'trimis' && d >= 0 && d <= 2;
    }
  }
}
