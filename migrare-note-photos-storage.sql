-- ============================================================
-- MIGRARE — Storage bucket "note-photos" (poze/screenshot-uri atașate la notițe)
-- PRIVATE CAD
--
-- Codul (js/supabase.js → sbUploadNotePhoto, js/app.js → uploadNotePhoto)
-- încarcă fotografiile atașate la note/comentarii într-un bucket Supabase
-- Storage numit "note-photos". Fără acest bucket + politicile de mai jos,
-- upload-ul eșuează silențios și aplicația cade automat pe stocare locală
-- (base64, doar pe dispozitivul curent — nu se sincronizează).
--
-- Rulează în: https://app.supabase.com → proiectul tău → SQL Editor.
-- Comenzile sunt idempotente — le poți rula liniștit de mai multe ori.
-- ============================================================

-- 1. Bucket-ul (public = URL-urile pozelor pot fi accesate direct, fără
--    semnătură — la fel ca orice imagine dintr-o pagină web obișnuită).
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-photos', 'note-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politici RLS pe storage.objects, limitate la bucket-ul "note-photos".
DROP POLICY IF EXISTS "note_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "note_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "note_photos_delete" ON storage.objects;

-- Oricine (inclusiv vizitatori neautentificați, pentru <img> direct din URL
-- public) poate vizualiza pozele — bucket-ul e deja public, dar politica e
-- necesară pentru citire prin API/SDK (nu doar prin URL brut).
CREATE POLICY "note_photos_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'note-photos');

-- Orice utilizator autentificat (admin, tehnician sau clinică — oricine are
-- deja cont în aplicație) poate încărca o poză la o notă.
CREATE POLICY "note_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'note-photos');

-- Ștergerea rămâne rezervată echipei laboratorului (admin/tehnician), ca la
-- restul ștergerilor din aplicație.
CREATE POLICY "note_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'note-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin','technician')
    )
  );
