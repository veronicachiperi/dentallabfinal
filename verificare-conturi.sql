-- ============================================================
-- VERIFICARE & REPARARE CONTURI — PRIVATE CAD
-- Rulează în: https://app.supabase.com → proiectul tău → SQL Editor
-- Rulează fiecare secțiune pe rând.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- SECȚIUNEA 1 — VERIFICARE: vezi toate conturile și rolul lor
-- ─────────────────────────────────────────────────────────────
-- Orice rând cu role = NULL este un cont STRICAT: poate avea parolă,
-- dar nu are profil/rol, deci la login primește "Cont neautorizat".
-- email_confirmed_at = NULL înseamnă că emailul nu e confirmat și,
-- dacă "Confirm email" e pornit, contul NU se poate loga.

select
  u.email,
  p.username,
  p.role,
  p.clinic_id,
  p.employee_id,
  u.email_confirmed_at,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;


-- ─────────────────────────────────────────────────────────────
-- SECȚIUNEA 2 — REPARARE POLITICI (elimină recursiunea infinită)
-- Cauza: politicile pe "profiles" interogau "profiles" în interior.
-- Soluția: o funcție SECURITY DEFINER care verifică rolul fără RLS.
-- ─────────────────────────────────────────────────────────────

-- 2a. Funcție ajutătoare (ocolește RLS în interior → fără recursiune)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2b. Rescrie politicile pe profiles ca să folosească funcția
drop policy if exists "profiles_admin_read"   on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;

create policy "profiles_admin_read" on public.profiles
  for select using (public.is_admin());

create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_admin());

-- (Politica "profiles_self_read" / "profiles_self_insert" rămân neschimbate.)


-- ─────────────────────────────────────────────────────────────
-- SECȚIUNEA 3 — (opțional) REPARĂ UN CONT FĂRĂ PROFIL
-- Dacă în Secțiunea 1 ai văzut un cont cu role = NULL, dă-i un profil.
-- Înlocuiește valorile între < > și șterge ce nu folosești.
-- ─────────────────────────────────────────────────────────────

-- Exemplu pentru un cont de CLINICĂ:
-- insert into public.profiles (id, username, role, clinic_id)
-- select id, '<nume_utilizator>', 'clinic', '<id_clinica>'
-- from auth.users where email = '<email_contului>'
-- on conflict (id) do update
--   set role = excluded.role, clinic_id = excluded.clinic_id;

-- Exemplu pentru un cont de TEHNICIAN:
-- insert into public.profiles (id, username, role, employee_id)
-- select id, '<nume_utilizator>', 'technician', '<id_angajat>'
-- from auth.users where email = '<email_contului>'
-- on conflict (id) do update
--   set role = excluded.role, employee_id = excluded.employee_id;
