revoke execute on function public.mow_create_profile(text,text) from anon;
revoke execute on function public.mow_submit_submission(uuid) from anon;
revoke execute on function public.mow_create_revision_and_send(uuid,text) from anon;
revoke execute on function public.mow_respond_to_revision(uuid,boolean,text) from anon;
revoke execute on function public.mow_mark_published(uuid,text) from anon;
revoke execute on function public.mow_is_moderator() from anon;

create or replace function public.mow_mark_published(p_submission_id uuid,p_url text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mow_is_moderator() then raise exception 'Brak uprawnień.'; end if;
 if p_url !~ '^https?://' then raise exception 'Nieprawidłowy URL.'; end if;
 update mow_submissions set status='published',published_url=p_url,published_at=now(),updated_at=now()
 where id=p_submission_id
   and consent_status <> 'needs_review'
   and (status='approved' or editorial_mode='original');
 if not found then raise exception 'Materiał nie jest gotowy do publikacji lub wymaga weryfikacji wizerunku.'; end if;
end$$;
grant execute on function public.mow_mark_published(uuid,text) to authenticated;

