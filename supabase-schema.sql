-- ============================================================
-- Dental Lab — Supabase Schema
-- Run this in: https://app.supabase.com → SQL Editor
-- ============================================================

-- 1. Profiles (extends auth.users with role + clinic/employee binding)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('admin','technician','clinic')),
  clinic_id    TEXT,    -- set when role = 'clinic'
  employee_id  TEXT,    -- set when role = 'technician'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_admin_read"  ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Cases
CREATE TABLE IF NOT EXISTS public.cases (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  last_name      TEXT,
  first_name     TEXT,
  clinic_id      TEXT NOT NULL,
  doctor         TEXT,
  type           TEXT,
  color          TEXT,
  stage          TEXT DEFAULT 'design',
  not_started    BOOLEAN DEFAULT TRUE,
  assignee       TEXT,
  assignees      JSONB DEFAULT '{}',
  stage_statuses JSONB DEFAULT '{}',
  intrata        TEXT,
  proba_date     TEXT,
  finala         TEXT,
  implant_type   TEXT,
  amprenta_type  TEXT,
  teeth          JSONB DEFAULT '[]',
  notes          TEXT DEFAULT '',
  priority       TEXT DEFAULT 'mediu',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Admin + technicians see all cases; clinic sees only their own
CREATE POLICY "cases_select" ON public.cases FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND (p.role IN ('admin','technician') OR p.clinic_id = cases.clinic_id)
  )
);
CREATE POLICY "cases_insert" ON public.cases FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND (p.role IN ('admin','technician') OR p.clinic_id = cases.clinic_id)
  )
);
CREATE POLICY "cases_update" ON public.cases FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND (p.role IN ('admin','technician') OR p.clinic_id = cases.clinic_id)
  )
);
-- Only admin or the owning clinic can delete
CREATE POLICY "cases_delete" ON public.cases FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND (p.role = 'admin' OR p.clinic_id = cases.clinic_id)
  )
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE PROCEDURE _set_updated_at();

-- 3. Activity log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id),
  username    TEXT,
  role        TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Only admin reads the activity log; anyone authenticated can write
CREATE POLICY "activity_admin_read" ON public.activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Enable Realtime for cases table:
--   Supabase Dashboard → Database → Replication → Enable cases
-- ============================================================

-- ============================================================
-- DISABLE email confirmation (so password-only signup works):
--   Supabase Dashboard → Authentication → Email →
--   Uncheck "Enable email confirmations"
-- ============================================================
