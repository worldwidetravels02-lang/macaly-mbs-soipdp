-- Private storage for customer identity documents. Safe to apply more than once.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-documents', 'identity-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists "Members upload own identity documents" on storage.objects;
create policy "Members upload own identity documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'identity-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Members read own identity documents" on storage.objects;
create policy "Members read own identity documents" on storage.objects
for select to authenticated using (
  bucket_id = 'identity-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
);

drop policy if exists "Members replace own identity documents" on storage.objects;
create policy "Members replace own identity documents" on storage.objects
for update to authenticated using (
  bucket_id = 'identity-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'identity-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
);
