-- ============================================================
-- VERIFICARE — cazuri posibil duplicate (nume + clinică + tip)
-- PRIVATE CAD
--
-- Rulează în: https://app.supabase.com → proiectul tău → SQL Editor.
-- Doar CITEȘTE date (SELECT) — nu modifică nimic, poți rula liniștit.
--
-- Motivație: am găsit cazul #425 / #415 ("Furculita Ion", FAV Dental,
-- ZR FULL IMPL) — două rânduri distincte în tabela `cases` pentru
-- aceeași lucrare, introduse la o zi distanță (29 Iul vs 28 Iul).
-- Query-ul de mai jos găsește toate grupurile similare din baza de
-- date, ca să poți verifica manual și șterge rândul greșit.
-- ============================================================

-- 1. Grupuri de cazuri cu același pacient + clinică + tip de lucrare
--    (comparație case-insensitive, ignoră spații multiple).
SELECT
  c.clinic_id,
  regexp_replace(lower(trim(c.name)), '\s+', ' ', 'g') AS pacient_normalizat,
  c.type,
  count(*)                         AS nr_cazuri,
  array_agg(c.id ORDER BY c.created_at)         AS id_uri,
  array_agg(c.created_at ORDER BY c.created_at) AS create_la,
  array_agg(c.intrata ORDER BY c.created_at)    AS intrata,
  array_agg(c.finala ORDER BY c.created_at)     AS finala
FROM public.cases c
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY nr_cazuri DESC, pacient_normalizat;

-- 2. Detaliu: pentru fiecare caz suspect de mai sus, cine l-a creat și
--    când (din activity_log) — util ca să vezi dacă e vorba de
--    dublu-click (creat de ACELAȘI user, la câteva secunde distanță)
--    sau reintroducere manuală (zile diferite, poate useri diferiți).
--    Înlocuiește (123, 456) cu id-urile găsite la pasul 1.
SELECT a.created_at, a.username, a.role, a.action, a.entity_id, a.details
FROM public.activity_log a
WHERE a.action = 'add_case'
  AND a.entity_id IN ('123', '456')   -- <-- pune aici id-urile din pasul 1
ORDER BY a.created_at;

-- 3. (Opțional) Șterge un caz duplicat, DUPĂ ce ai confirmat manual
--    care e cel greșit — schimbă :id cu id-ul real. Ireversibil.
-- DELETE FROM public.cases WHERE id = <ID_DE_ȘTERS>;
