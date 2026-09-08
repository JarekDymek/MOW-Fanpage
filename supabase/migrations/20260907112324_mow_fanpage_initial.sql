create extension if not exists pgcrypto;

do $$ begin create type public.mow_user_role as enum ('employee','moderator'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mow_submission_status as enum ('draft','submitted','editing','awaiting_author','changes_requested','approved','published','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mow_editorial_mode as enum ('original','edit_approval'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mow_consent_status as enum ('verified','group_shots','needs_review'); exception when duplicate_object then null; end $$;

create table if not exists public.mow_profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(full_name) between 2 and 120),
 unit text not null check(length(unit) between 1 and 120),
 role public.mow_user_role not null default 'employee',
 created_at timestamptz not null default now()
);

create table if not exists public.mow_submissions(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.mow_profiles(id),
 title text not null check(length(title) between 2 and 180),
 event_date date not null,
 location text not null check(length(location) between 1 and 160),
 body_original text not null check(length(body_original) between 2 and 10000),
 editor_notes text check(length(coalesce(editor_notes,'')) <= 3000),
 editorial_mode public.mow_editorial_mode not null,
 consent_status public.mow_consent_status not null,
 rights_confirmed boolean not null default false,
 consents_verified boolean not null default false,
 safe_content_confirmed boolean not null default false,
 youth_objection_checked boolean not null default false,
 accuracy_confirmed boolean not null default false,
 status public.mow_submission_status not null default 'draft',
 published_url text,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mow_submissions_author_idx on public.mow_submissions(author_id,created_at desc);
create index if not exists mow_submissions_status_idx on public.mow_submissions(status,created_at desc);

create table if not exists public.mow_submission_photos(
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.mow_submissions(id) on delete cascade,
 storage_path text not null unique,
 order_index int not null check(order_index between 0 and 14),
 uploaded_by uuid not null references public.mow_profiles(id),
 created_at timestamptz not null default now(),
 unique(submission_id,order_index)
);

create table if not exists public.mow_revisions(
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.mow_submissions(id) on delete cascade,
 version_no int not null,
 content text not null check(length(content) between 2 and 12000),
 created_by uuid not null references public.mow_profiles(id),
 sent_at timestamptz not null default now(),
 response text check(response in ('approved','changes_requested')),
 author_comment text check(length(coalesce(author_comment,'')) <= 3000),
 responded_at timestamptz,
 unique(submission_id,version_no)
);

create table if not exists public.mow_notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.mow_profiles(id) on delete cascade,
 submission_id uuid references public.mow_submissions(id) on delete cascade,
 title text not null,
 body text not null,
 kind text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.mow_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.mow_profiles(id) on delete cascade,
 endpoint text not null,
 p256dh text not null,
 auth text not null,
 user_agent text,
 created_at timestamptz not null default now(),
 unique(user_id,endpoint)
);

create or replace function public.mow_is_moderator() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from mow_profiles where id=auth.uid() and role='moderator')$$;

create or replace function public.mow_create_profile(p_full_name text,p_unit text) returns public.mow_profiles language plpgsql security definer set search_path=public,auth as $$
declare v_email text; v_row public.mow_profiles;
begin
 select lower(email) into v_email from auth.users where id=auth.uid();
 if v_email is null then raise exception 'Brak zalogowanego użytkownika.'; end if;
 insert into public.mow_profiles(id,full_name,unit,role)
 values(auth.uid(),p_full_name,p_unit,case when v_email='jarekdymek@gmail.com' then 'moderator'::public.mow_user_role else 'employee'::public.mow_user_role end)
 on conflict(id) do update set full_name=excluded.full_name,unit=excluded.unit
 returning * into v_row;
 return v_row;
end$$;

alter table public.mow_profiles enable row level security;
alter table public.mow_submissions enable row level security;
alter table public.mow_submission_photos enable row level security;
alter table public.mow_revisions enable row level security;
alter table public.mow_notifications enable row level security;
alter table public.mow_push_subscriptions enable row level security;

create policy "mow_profiles_read_own_or_mod" on public.mow_profiles for select using(id=auth.uid() or public.mow_is_moderator());
create policy "mow_submissions_read_own_or_mod" on public.mow_submissions for select using(author_id=auth.uid() or public.mow_is_moderator());
create policy "mow_submissions_create_own_draft" on public.mow_submissions for insert with check(author_id=auth.uid() and status='draft');
create policy "mow_submissions_owner_update_draft" on public.mow_submissions for update using(author_id=auth.uid() and status='draft') with check(author_id=auth.uid() and status='draft');
create policy "mow_submissions_mod_update" on public.mow_submissions for update using(public.mow_is_moderator()) with check(public.mow_is_moderator());
create policy "mow_photos_read_own_or_mod" on public.mow_submission_photos for select using(exists(select 1 from public.mow_submissions s where s.id=submission_id and (s.author_id=auth.uid() or public.mow_is_moderator())));
create policy "mow_photos_insert_own_draft" on public.mow_submission_photos for insert with check(uploaded_by=auth.uid() and exists(select 1 from public.mow_submissions s where s.id=submission_id and s.author_id=auth.uid() and s.status='draft'));
create policy "mow_photos_delete_own_draft" on public.mow_submission_photos for delete using(exists(select 1 from public.mow_submissions s where s.id=submission_id and s.author_id=auth.uid() and s.status='draft'));
create policy "mow_revisions_read_own_or_mod" on public.mow_revisions for select using(exists(select 1 from public.mow_submissions s where s.id=submission_id and (s.author_id=auth.uid() or public.mow_is_moderator())));
create policy "mow_notifications_own_read" on public.mow_notifications for select using(user_id=auth.uid());
create policy "mow_notifications_own_update" on public.mow_notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "mow_push_own_all" on public.mow_push_subscriptions for all using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mow-materials','mow-materials',false,3145728,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/jpeg'];
create policy "mow_storage_upload_own_folder" on storage.objects for insert to authenticated with check(bucket_id='mow-materials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "mow_storage_author_or_mod_read" on storage.objects for select to authenticated using(bucket_id='mow-materials' and ((storage.foldername(name))[1]=auth.uid()::text or public.mow_is_moderator()));
create policy "mow_storage_own_delete" on storage.objects for delete to authenticated using(bucket_id='mow-materials' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.mow_submit_submission(p_submission_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update mow_submissions set status='submitted',updated_at=now() where id=p_submission_id and author_id=auth.uid() and status='draft' and rights_confirmed and consents_verified and safe_content_confirmed and youth_objection_checked and accuracy_confirmed;
 if not found then raise exception 'Nie można wysłać zgłoszenia.'; end if;
 if (select count(*) from mow_submission_photos where submission_id=p_submission_id) not between 1 and 15 then raise exception 'Wymagane 1-15 zdjęć.'; end if;
end$$;

create or replace function public.mow_create_revision_and_send(p_submission_id uuid,p_content text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_no int;
begin
 if not public.mow_is_moderator() then raise exception 'Brak uprawnień.'; end if;
 select coalesce(max(version_no),0)+1 into v_no from mow_revisions where submission_id=p_submission_id;
 insert into mow_revisions(submission_id,version_no,content,created_by) values(p_submission_id,v_no,p_content,auth.uid()) returning id into v_id;
 update mow_submissions set status='awaiting_author',updated_at=now() where id=p_submission_id;
 return v_id;
end$$;

create or replace function public.mow_respond_to_revision(p_revision_id uuid,p_approved boolean,p_comment text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_sub uuid;
begin
 select r.submission_id into v_sub from mow_revisions r join mow_submissions s on s.id=r.submission_id where r.id=p_revision_id and s.author_id=auth.uid() and s.status='awaiting_author';
 if v_sub is null then raise exception 'Brak dostępu lub nieaktualna wersja.'; end if;
 update mow_revisions set response=case when p_approved then 'approved' else 'changes_requested' end,author_comment=p_comment,responded_at=now() where id=p_revision_id;
 update mow_submissions set status=case when p_approved then 'approved'::mow_submission_status else 'changes_requested'::mow_submission_status end,updated_at=now() where id=v_sub;
end$$;

create or replace function public.mow_mark_published(p_submission_id uuid,p_url text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mow_is_moderator() then raise exception 'Brak uprawnień.'; end if;
 if p_url !~ '^https?://' then raise exception 'Nieprawidłowy URL.'; end if;
 update mow_submissions set status='published',published_url=p_url,published_at=now(),updated_at=now() where id=p_submission_id and (status='approved' or editorial_mode='original');
 if not found then raise exception 'Materiał nie jest gotowy do publikacji.'; end if;
end$$;

grant execute on function public.mow_create_profile(text,text) to authenticated;
grant execute on function public.mow_submit_submission(uuid) to authenticated;
grant execute on function public.mow_create_revision_and_send(uuid,text) to authenticated;
grant execute on function public.mow_respond_to_revision(uuid,boolean,text) to authenticated;
grant execute on function public.mow_mark_published(uuid,text) to authenticated;
