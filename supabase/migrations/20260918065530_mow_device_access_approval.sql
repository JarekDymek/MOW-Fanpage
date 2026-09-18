alter table public.mow_profiles add column if not exists work_email text;

create table if not exists public.mow_access_requests(
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique,
  work_email text not null,
  secret_hash text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','revoked')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  request_ip_hash text,
  user_agent text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  last_notified_at timestamptz,
  is_legacy boolean not null default false
);
create index if not exists mow_access_requests_email_idx on public.mow_access_requests(lower(work_email),status);
create index if not exists mow_access_requests_ip_idx on public.mow_access_requests(request_ip_hash,requested_at desc);
alter table public.mow_access_requests enable row level security;
revoke all on public.mow_access_requests from public,anon,authenticated;
grant all on public.mow_access_requests to service_role;

update public.mow_profiles p set work_email=lower(u.email)
from auth.users u where u.id=p.id and p.work_email is null and u.email is not null;

insert into public.mow_access_requests(device_id,work_email,status,auth_user_id,approved_at,is_legacy)
select gen_random_uuid(),lower(u.email),'approved',p.id,now(),true
from public.mow_profiles p join auth.users u on u.id=p.id
where u.email is not null and not exists(select 1 from public.mow_access_requests a where a.auth_user_id=p.id);

create or replace function public.mow_has_access()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(
    select 1 from public.mow_access_requests
    where auth_user_id=auth.uid() and status='approved'
  )
$$;
revoke all on function public.mow_has_access() from public,anon;
grant execute on function public.mow_has_access() to authenticated,service_role;

create or replace function public.mow_is_moderator()
returns boolean language sql stable security definer set search_path=public as $$
  select public.mow_has_access() and exists(
    select 1 from public.mow_profiles where id=auth.uid() and role='moderator'
  )
$$;
revoke all on function public.mow_is_moderator() from public,anon;
grant execute on function public.mow_is_moderator() to authenticated,service_role;

create or replace function public.mow_create_profile(p_full_name text,p_unit text)
returns public.mow_profiles language plpgsql security definer set search_path=public,auth as $$
declare v_work_email text; v_row public.mow_profiles;
begin
 if not public.mow_has_access() then raise exception 'Dostęp do aplikacji nie został zatwierdzony.'; end if;
 if length(btrim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Imię i nazwisko: od 2 do 120 znaków.'; end if;
 if length(btrim(coalesce(p_unit,''))) not between 1 and 120 then raise exception 'Funkcja, miejsce i grupa: łącznie do 120 znaków.'; end if;
 select work_email into v_work_email from public.mow_access_requests
 where auth_user_id=auth.uid() and status='approved'
 order by approved_at desc nulls last,requested_at desc limit 1;
 insert into public.mow_profiles(id,full_name,unit,role,work_email)
 values(auth.uid(),btrim(p_full_name),btrim(p_unit),'employee'::public.mow_user_role,v_work_email)
 on conflict(id) do update set full_name=excluded.full_name,unit=excluded.unit,
   work_email=coalesce(public.mow_profiles.work_email,excluded.work_email)
 returning * into v_row;
 return v_row;
end$$;

create or replace function public.mow_update_profile(p_full_name text,p_unit text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mow_has_access() then raise exception 'Dostęp do aplikacji nie jest aktywny.'; end if;
 if length(btrim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Imię i nazwisko: od 2 do 120 znaków.'; end if;
 if length(btrim(coalesce(p_unit,''))) not between 1 and 120 then raise exception 'Funkcja, miejsce i grupa: łącznie do 120 znaków.'; end if;
 update public.mow_profiles set full_name=btrim(p_full_name),unit=btrim(p_unit) where id=auth.uid();
 if not found then raise exception 'Profil nie istnieje.'; end if;
end$$;

create or replace function public.mow_submit_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mow_has_access() then raise exception 'Dostęp do aplikacji nie jest aktywny.'; end if;
 update mow_submissions set status='submitted',updated_at=now() where id=p_submission_id and author_id=auth.uid() and status='draft' and rights_confirmed and consents_verified and safe_content_confirmed and youth_objection_checked and accuracy_confirmed;
 if not found then raise exception 'Nie można wysłać zgłoszenia.'; end if;
 if (select count(*) from mow_submission_photos where submission_id=p_submission_id) not between 1 and 15 then raise exception 'Wymagane 1-15 zdjęć.'; end if;
end$$;

create or replace function public.mow_respond_to_revision(p_revision_id uuid,p_approved boolean,p_comment text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_sub uuid; v_latest uuid;
begin
 if not public.mow_has_access() then raise exception 'Dostęp do aplikacji nie jest aktywny.'; end if;
 select s.id into v_sub from mow_submissions s join mow_revisions r on r.submission_id=s.id
 where r.id=p_revision_id and s.author_id=auth.uid() and s.status='awaiting_author' for update of s;
 if v_sub is null then raise exception 'Brak dostępu lub nieaktualna wersja.'; end if;
 select id into v_latest from mow_revisions where submission_id=v_sub order by version_no desc limit 1;
 if v_latest<>p_revision_id then raise exception 'Otwórz najnowszą wersję tekstu.'; end if;
 update mow_revisions set response=case when p_approved then 'approved' else 'changes_requested' end,author_comment=p_comment,responded_at=now() where id=p_revision_id;
 update mow_submissions set status=case when p_approved then 'approved'::mow_submission_status else 'changes_requested'::mow_submission_status end,updated_at=now() where id=v_sub;
end$$;

create or replace function public.mow_delete_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_author uuid;
begin
 if not public.mow_has_access() then raise exception 'Dostęp do aplikacji nie jest aktywny.';end if;
 select author_id into v_author from public.mow_submissions where id=p_submission_id for update;
 if not found then return;end if;
 if v_author<>auth.uid() and not public.mow_is_moderator() then raise exception 'Brak uprawnień do usunięcia tego materiału.';end if;
 if exists(select 1 from storage.objects o where o.bucket_id='mow-materials' and
  (o.name like v_author::text||'/'||p_submission_id::text||'/%' or exists(
   select 1 from public.mow_submission_photos p where p.submission_id=p_submission_id and p.storage_path=o.name)))
 then raise exception 'Zdjęcia nie zostały jeszcze usunięte. Ponów usuwanie.';end if;
 delete from public.mow_submissions where id=p_submission_id;
end$$;

drop policy if exists mow_profiles_access_gate on public.mow_profiles;
create policy mow_profiles_access_gate on public.mow_profiles as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());
drop policy if exists mow_notifications_access_gate on public.mow_notifications;
create policy mow_notifications_access_gate on public.mow_notifications as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());
drop policy if exists mow_push_access_gate on public.mow_push_subscriptions;
create policy mow_push_access_gate on public.mow_push_subscriptions as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());
drop policy if exists mow_revisions_access_gate on public.mow_revisions;
create policy mow_revisions_access_gate on public.mow_revisions as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());
drop policy if exists mow_photos_access_gate on public.mow_submission_photos;
create policy mow_photos_access_gate on public.mow_submission_photos as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());
drop policy if exists mow_submissions_access_gate on public.mow_submissions;
create policy mow_submissions_access_gate on public.mow_submissions as restrictive for all to authenticated
using(public.mow_has_access()) with check(public.mow_has_access());

drop policy if exists mow_storage_author_or_mod_read on storage.objects;
create policy mow_storage_author_or_mod_read on storage.objects for select to authenticated
using(bucket_id='mow-materials' and public.mow_has_access() and ((storage.foldername(name))[1]=auth.uid()::text or public.mow_is_moderator()));
drop policy if exists mow_storage_own_delete on storage.objects;
create policy mow_storage_own_delete on storage.objects for delete to authenticated
using(bucket_id='mow-materials' and public.mow_has_access() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists mow_storage_upload_own_folder on storage.objects;
create policy mow_storage_upload_own_folder on storage.objects for insert to authenticated
with check(bucket_id='mow-materials' and public.mow_has_access() and (storage.foldername(name))[1]=auth.uid()::text);
