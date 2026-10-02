-- ============================================================
-- MIGRARE — etape de tratament în ACELAȘI caz
-- (Mockup → PMMA → Finală etc., prin butonul "+ Următoarea etapă")
-- PRIVATE CAD
--
-- RULEAZĂ ACEST SCRIPT ÎNAINTE de a face push la noul cod.
-- (Dacă pui codul nou înainte de a adăuga coloanele, salvarea
--  cazurilor va da eroare „column does not exist".)
--
-- În Supabase → proiectul tău → SQL Editor → lipește și Run.
-- Comenzile sunt idempotente (IF NOT EXISTS), le poți rula liniștit.
-- ============================================================

-- 1. Istoricul etapelor încheiate ale cazului (array JSON):
--    [{label, intrata, finala, completedAt}, ...]
alter table public.cases
  add column if not exists phases jsonb default '[]'::jsonb;

-- 2. Eticheta etapei curente (ex. "Mockup", "PMMA", "Finală").
--    Dacă e goală, cazul se comportă exact ca înainte (fără timeline afișat).
alter table public.cases
  add column if not exists current_phase_label text default '';

-- 3. Etapele planificate, NEÎNCEPUTE ÎNCĂ (alese la crearea cazului, în
--    constructorul din modalul "Caz nou"): [{label, estFinala}, ...]
--    Sunt "consumate" (eliminate din listă) pe măsură ce se avansează cu
--    "+ Următoarea etapă" — prima din listă devine etapa curentă.
alter table public.cases
  add column if not exists phase_plan jsonb default '[]'::jsonb;

-- Verificare rapidă: vezi coloanele tabelei
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='cases' order by column_name;
