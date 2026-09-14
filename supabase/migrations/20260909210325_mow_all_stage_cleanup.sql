drop policy if exists mow_storage_mod_delete_published on storage.objects;
create policy mow_storage_mod_delete_material on storage.objects for delete to authenticated using (
 bucket_id='mow-materials' and public.mow_is_moderator() and exists (
  select 1 from public.mow_submissions s where
   name like s.author_id::text||'/'||s.id::text||'/%'
   or exists(select 1 from public.mow_submission_photos p where p.submission_id=s.id and p.storage_path=storage.objects.name)
 )
);
create or replace function public.mow_delete_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_author uuid;
begin
 if auth.uid() is null then raise exception 'Zaloguj się ponownie.';end if;
 select author_id into v_author from public.mow_submissions where id=p_submission_id for update;
 if not found then return;end if;
 if v_author<>auth.uid() and not public.mow_is_moderator() then raise exception 'Brak uprawnień do usunięcia tego materiału.';end if;
 if exists(select 1 from storage.objects o where o.bucket_id='mow-materials' and
  (o.name like v_author::text||'/'||p_submission_id::text||'/%' or exists(
   select 1 from public.mow_submission_photos p where p.submission_id=p_submission_id and p.storage_path=o.name)))
 then raise exception 'Zdjęcia nie zostały jeszcze usunięte. Ponów usuwanie.';end if;
 delete from public.mow_submissions where id=p_submission_id;
end$$;
revoke all on function public.mow_delete_submission(uuid) from public,anon;
grant execute on function public.mow_delete_submission(uuid) to authenticated;
