-- Storage for trainer-owned product photos; trainers only write in their own UUID folder.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('trainer-store-images','trainer-store-images',true,5242880,
 ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS "store photos public" ON storage.objects;
CREATE POLICY "store photos public" ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='trainer-store-images');
DROP POLICY IF EXISTS "trainer uploads own photo" ON storage.objects;
CREATE POLICY "trainer uploads own photo" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='trainer-store-images' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "trainer replaces own photo" ON storage.objects;
CREATE POLICY "trainer replaces own photo" ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='trainer-store-images' AND (storage.foldername(name))[1]=auth.uid()::text)
 WITH CHECK(bucket_id='trainer-store-images' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS "trainer deletes own photo" ON storage.objects;
CREATE POLICY "trainer deletes own photo" ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='trainer-store-images' AND (storage.foldername(name))[1]=auth.uid()::text);

CREATE OR REPLACE FUNCTION public.reorder_program_workouts(p_program_id uuid,p_video_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; i integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.trainer_programs
    WHERE id=p_program_id AND trainer_id=auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT count(*) INTO n FROM public.trainer_program_workouts WHERE program_id=p_program_id;
 IF n<>coalesce(array_length(p_video_ids,1),0) OR
    (SELECT count(DISTINCT x) FROM unnest(p_video_ids)x)<>n OR
    (SELECT count(*) FROM public.trainer_program_workouts WHERE program_id=p_program_id
      AND video_id=ANY(p_video_ids))<>n THEN RAISE EXCEPTION 'Invalid workout order'; END IF;
 -- Unique constraint allows two-phase shuffle using unused positions.
 UPDATE public.trainer_program_workouts SET position=position+1000000 WHERE program_id=p_program_id;
 FOR i IN 1..n LOOP
   UPDATE public.trainer_program_workouts SET position=i-1
     WHERE program_id=p_program_id AND video_id=p_video_ids[i];
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reorder_program_workouts(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_program_workouts(uuid,uuid[]) TO authenticated;
