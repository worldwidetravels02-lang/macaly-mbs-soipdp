-- Allow customers to remove their own private identity upload when a
-- verification record cannot be created, and to clean up replaced documents.
drop policy if exists "Members delete own identity documents" on storage.objects;
create policy "Members delete own identity documents" on storage.objects
for delete to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
