-- ============================================================
-- MIGRARE — coloane noi pentru tabela "cases"
-- PRIVATE CAD
--
-- RULEAZĂ ACEST SCRIPT ÎNAINTE de a face push la noul cod.
-- (Dacă pui codul nou înainte de a adăuga coloanele, salvarea
--  cazurilor va da eroare „column does not exist".)
--
-- În Supabase → proiectul tău → SQL Editor → lipește și Run.
-- Comenzile sunt idempotente (IF NOT EXISTS), le poți rula liniștit.
-- ============================================================

alter table public.cases add column if not exists no_proba       boolean default false;
alter table public.cases add column if not exists completed_date  text;
alter table public.cases add column if not exists final_tech      text;
alter table public.cases add column if not exists duration_days   text;

-- Verificare rapidă: vezi coloanele tabelei
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='cases' order by column_name;
