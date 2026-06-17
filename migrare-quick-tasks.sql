-- ============================================================
-- MIGRARE — tabela "quick_tasks" (TODO partajat al echipei)
-- PRIVATE CAD
--
-- Codul (js/supabase.js + js/app.js) folosește tabela `quick_tasks`
-- pentru lista de task-uri rapide a echipei, dar tabela nu era creată
-- în niciun script SQL. Fără ea, funcția eșuează silențios
-- ("relation public.quick_tasks does not exist").
--
-- Rulează în: https://app.supabase.com → proiectul tău → SQL Editor.
-- Comenzile sunt idempotente — le poți rula liniștit.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quick_tasks (
  id            BIGSERIAL PRIMARY KEY,
  text          TEXT NOT NULL,
  done          BOOLEAN DEFAULT FALSE,
  created_by    TEXT,
  completed_by  TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quick_tasks ENABLE ROW LEVEL SECURITY;

-- Doar echipa (admin + tehnicieni) vede și gestionează task-urile rapide.
-- Clinicile NU au acces (lista e internă laboratorului).
DROP POLICY IF EXISTS "quick_tasks_team_read"  ON public.quick_tasks;
DROP POLICY IF EXISTS "quick_tasks_team_write" ON public.quick_tasks;

CREATE POLICY "quick_tasks_team_read" ON public.quick_tasks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin','technician')
    )
  );

CREATE POLICY "quick_tasks_team_write" ON public.quick_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin','technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin','technician')
    )
  );

-- ============================================================
-- Activează Realtime pentru sincronizare live între dispozitive:
--   Supabase Dashboard → Database → Replication → Enable quick_tasks
-- (codul folosește sbSubscribeQuickTasks pe canalul "quick_tasks_live").
-- ============================================================
