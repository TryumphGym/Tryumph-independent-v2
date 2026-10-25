-- Uploaded workout files are readable only by the coach who uploaded them.
-- Playback goes through a signed URL minted by the app, so no public read rule is needed.
DROP POLICY IF EXISTS "videos read" ON storage.objects;

CREATE POLICY "videos own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Uploads must land in the uploader's own folder.
DROP POLICY IF EXISTS "videos own upload" ON storage.objects;

CREATE POLICY "videos own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);