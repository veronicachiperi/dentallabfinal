-- ============================================================
-- MIGRARE — sistem de "refaceri" + numerotare permanentă
-- PRIVATE CAD
--
-- RULEAZĂ ACEST SCRIPT ÎNAINTE de a face push la noul cod.
-- (Dacă pui codul nou înainte de a adăuga coloanele, salvarea
--  cazurilor va da eroare „column does not exist".)
--
-- În Supabase → proiectul tău → SQL Editor → lipește și Run.
-- Comenzile sunt idempotente (IF NOT EXISTS), le poți rula liniștit.
-- ============================================================

-- 1. Leagă un caz nou de cazul original, când e o refacere.
--    Dacă cazul original e șters vreodată, legătura dispare fără eroare
--    (ON DELETE SET NULL) — cazul refăcut rămâne valid.
alter table public.cases
  add column if not exists previous_case_id bigint references public.cases(id) on delete set null;

create index if not exists cases_previous_case_id_idx on public.cases(previous_case_id);

-- 2. Numărul de caz (# afișat peste tot) devine PERMANENT.
--    Până acum, "Caz #141" era doar o poziție recalculată la fiecare
--    încărcare (sortare după data de intrare) — putea aluneca la alt
--    pacient dacă se adăuga sau edita un caz cu dată mai veche.
--    Coloana de mai jos stochează numărul o singură dată, la creare.
alter table public.cases
  add column if not exists seq bigint;

create index if not exists cases_seq_idx on public.cases(seq);

-- Notă: nu punem UNIQUE pe seq — preferăm ca aplicația să nu blocheze
-- niciodată salvarea unui caz din cauza unei coliziuni rare de numerotare,
-- în locul unei garanții stricte de unicitate la nivel de bază de date.

-- Cazurile existente NU sunt renumerotate aici. La prima încărcare a
-- aplicației (js/data.js → assignCaseNumbers), fiecare caz fără `seq`
-- primește numărul pe care îl are deja afișat azi (aceeași logică de
-- sortare ca înainte), apoi acel număr e scris înapoi în DB și rămâne
-- fix pentru totdeauna. Nu e nevoie de niciun pas manual suplimentar.

-- Verificare rapidă: vezi coloanele tabelei
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='cases' order by column_name;
