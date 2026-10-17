CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'evida-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can read their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'evida-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'evida-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);