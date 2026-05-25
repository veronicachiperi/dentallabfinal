-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Creates clinics and employees tables, RLS policies, and
-- seeds the initial data matching data.js hardcoded values.
-- ============================================================

-- ── Clinics ──────────────────────────────────────────────────
-- Allow admins to remove clinic/employee login profiles from the app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_admin_delete'
  ) THEN
    CREATE POLICY "profiles_admin_delete" ON profiles
      FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clinics (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  doctor    text DEFAULT '',
  phone     text DEFAULT '',
  color     text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read clinics
CREATE POLICY "clinics_select" ON clinics
  FOR SELECT TO authenticated USING (true);

-- Only admins can insert / update / delete
CREATE POLICY "clinics_admin_write" ON clinics
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Seed initial clinics (skip if already inserted)
INSERT INTO clinics (id, name, doctor) VALUES
  ('crisdent', 'CRISDENT',        'Dr. Popescu A.'),
  ('pana',     'PANA DENT',       'Dr. Pană M.'),
  ('elite',    'ELITE MED',       'Dr. Ionescu R.'),
  ('fav',      'FAV Dental',      'Dr. Favorov S.'),
  ('esthetic', 'Dental Esthetic', 'Dr. Stoica L.'),
  ('melian',   'Melian Clinic',   'Dr. —')
ON CONFLICT (id) DO NOTHING;


-- ── Employees ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  initials  text NOT NULL DEFAULT '',
  stage     text NOT NULL DEFAULT 'design',
  color     text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "employees_admin_write" ON employees
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Seed initial employees
INSERT INTO employees (id, name, initials, stage) VALUES
  ('tchi', 'Timofei Chiochiu',  'TC', 'design'),
  ('vcel', 'Vadim Celac',       'VC', 'design'),
  ('ikar', 'Ivan Kara',         'IK', 'design'),
  ('acur', 'Alina Curtis',      'AC', 'ceramica'),
  ('vgra', 'Valentin Grajdianu','VG', 'ceramica'),
  ('amoi', 'Alexandru Moisei',  'AM', 'prelucrare'),
  ('avar', 'Alexandru Varzari', 'AV', 'prelucrare')
ON CONFLICT (id) DO NOTHING;
