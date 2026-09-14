-- Only moderator-selected, published MOW materials may be removed.
create policy mow_storage_mod_delete_published on storage.objects for delete to authenticated
using (
 bucket_id='mow-materials' and public.mow_is_moderator() and exists (
  select 1 from public.mow_submission_photos p join public.mow_submissions s on s.id=p.submission_id
  where p.storage_path=storage.objects.name and s.status='published'
 )
);

create or replace function public.mow_delete_published(p_submission_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_status public.mow_submission_status;
begin
 if auth.uid() is null or not public.mow_is_moderator() then raise exception 'Tylko moderator może usuwać materiały.'; end if;
 select status into v_status from public.mow_submissions where id=p_submission_id for update;
 if not found then return; end if; -- An acknowledged retry is safe.
 if v_status<>'published' then raise exception 'Można usunąć tylko opublikowany materiał.'; end if;
 if exists(select 1 from storage.objects o join public.mow_submission_photos p on p.storage_path=o.name
   where o.bucket_id='mow-materials' and p.submission_id=p_submission_id)
 then raise exception 'Zdjęcia nie zostały jeszcze usunięte. Ponów usuwanie.'; end if;
 -- Foreign keys cascade to photos metadata, revisions and notifications.
 delete from public.mow_submissions where id=p_submission_id;
end$$;
revoke all on function public.mow_delete_published(uuid) from public,anon;
grant execute on function public.mow_delete_published(uuid) to authenticated;
