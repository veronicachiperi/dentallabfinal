-- ============================================================
-- MIGRARE — Poze de profil (avatar) pentru fiecare cont
-- PRIVATE CAD
--
-- Codul (js/supabase.js → sbUploadAvatar/sbRemoveAvatar, js/app.js →
-- popover-ul de avatar) permite fiecărui utilizator (admin, tehnician,
-- clinică, medic) să-și încarce singur o poză de profil, care înlocuiește
-- cercul colorat cu inițiale.
--
-- Rulează în: https://app.supabase.com → proiectul tău → SQL Editor.
-- Comenzile sunt idempotente — le poți rula liniștit de mai multe ori.
-- ============================================================

-- 1. Bucket-ul Storage "avatars" (public = poza poate fi afișată direct,
--    fără semnătură, la fel ca note-photos).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politici RLS pe storage.objects — fiecare user poate scrie DOAR în
--    propriul folder, numit după user id-ul lui din Auth
--    (ex: "3fa1...uid.../avatar.jpg"). Oricine poate citi (poze publice).
DROP POLICY IF EXISTS "avatars_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;

CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Coloana avatar_url — pe profiles (folosită de admin + medic) și pe
--    employees / clinics (folosită de tehnicieni / clinici, ca poza să
--    fie vizibilă și pentru ceilalți useri — vezi nota de mai jos).
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.clinics   ADD COLUMN IF NOT EXISTS avatar_url text;

-- 4. Funcție-gardă: un user ne-admin care actualizează rândul lui propriu
--    (profiles / employees / clinics) poate schimba DOAR avatar_url — orice
--    altă coloană trimisă accidental sau intenționat e ignorată automat.
--    Adminii nu sunt afectați (pot edita orice, ca până acum).
CREATE OR REPLACE FUNCTION public.guard_self_avatar_update()
RETURNS trigger AS $$
DECLARE
  is_admin boolean;
  new_avatar text;
BEGIN
  SELECT (role = 'admin') INTO is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(is_admin, false) THEN
    new_avatar := NEW.avatar_url;
    NEW := OLD;
    NEW.avatar_url := new_avatar;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_avatar_profiles  ON public.profiles;
DROP TRIGGER IF EXISTS trg_guard_avatar_employees ON public.employees;
DROP TRIGGER IF EXISTS trg_guard_avatar_clinics   ON public.clinics;

CREATE TRIGGER trg_guard_avatar_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_avatar_update();

CREATE TRIGGER trg_guard_avatar_employees
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_avatar_update();

CREATE TRIGGER trg_guard_avatar_clinics
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_avatar_update();

-- 5. Politici RLS de UPDATE pentru fiecare user pe propriul rând.
--    (Scrierile pe orice altă coloană sunt oricum blocate de trigger-ul
--    de mai sus, deci politicile pot rămâne simple.)
DROP POLICY IF EXISTS "profiles_self_avatar_update"  ON profiles;
DROP POLICY IF EXISTS "employees_self_avatar_update" ON employees;
DROP POLICY IF EXISTS "clinics_self_avatar_update"   ON clinics;

CREATE POLICY "profiles_self_avatar_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "employees_self_avatar_update" ON employees
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = employees.id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = employees.id
  ));

CREATE POLICY "clinics_self_avatar_update" ON clinics
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.clinic_id = clinics.id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.clinic_id = clinics.id
  ));

-- ============================================================
-- NOTĂ despre vizibilitate:
-- Poza unui tehnician (employees.avatar_url) și a unei clinici
-- (clinics.avatar_url) e vizibilă pentru TOȚI userii autentificați,
-- pentru că tabelele employees/clinics sunt deja public-lizibile
-- (employees_select / clinics_select).
--
-- Poza unui admin sau a unui medic (profiles.avatar_url) e vizibilă
-- DOAR pentru el însuși și pentru admini, pentru că tabela profiles nu
-- are (și n-am adăugat aici) o politică de citire publică — doar
-- profiles_self_read + profiles_admin_read. Dacă vrei ca și pozele de
-- admin/medic să fie vizibile pentru toată lumea (ex. în echipă, pe
-- cazuri), spune-mi și adaug o vedere (view) separată, sigură, care
-- expune doar id + avatar_url, fără restul datelor din profiles.
-- ============================================================
