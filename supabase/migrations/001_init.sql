-- MOW Fanpage — schemat Supabase
create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('employee','moderator'); exception when duplicate_object then null; end $$;
do $$ begin create type public.submission_status as enum ('draft','submitted','editing','awaiting_author','changes_requested','approved','published','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.editorial_mode as enum ('original','edit_approval'); exception when duplicate_object then null; end $$;
do $$ begin create type public.consent_status as enum ('verified','group_shots','needs_review'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(full_name) between 2 and 120),
 unit text not null check(length(unit) between 1 and 120),
 role public.user_role not null default 'employee',
 created_at timestamptz not null default now()
);

create table if not exists public.submissions(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id),
 title text not null check(length(title) between 2 and 180),
 event_date date not null,
 location text not null check(length(location) between 1 and 160),
 body_original text not null check(length(body_original) between 2 and 10000),
 editor_notes text check(length(coalesce(editor_notes,'')) <= 3000),
 editorial_mode public.editorial_mode not null,
 consent_status public.consent_status not null,
 rights_confirmed boolean not null default false,
 consents_verified boolean not null default false,
 safe_content_confirmed boolean not null default false,
 youth_objection_checked boolean not null default false,
 accuracy_confirmed boolean not null default false,
 status public.submission_status not null default 'draft',
 published_url text,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists submissions_author_idx on public.submissions(author_id,created_at desc);
create index if not exists submissions_status_idx on public.submissions(status,created_at desc);

create table if not exists public.submission_photos(
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.submissions(id) on delete cascade,
 storage_path text not null unique,
 order_index int not null check(order_index between 0 and 14),
 uploaded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(submission_id,order_index)
);

create table if not exists public.revisions(
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.submissions(id) on delete cascade,
 version_no int not null,
 content text not null check(length(content) between 2 and 12000),
 created_by uuid not null references public.profiles(id),
 sent_at timestamptz not null default now(),
 response text check(response in ('approved','changes_requested')),
 author_comment text check(length(coalesce(author_comment,'')) <= 3000),
 responded_at timestamptz,
 unique(submission_id,version_no)
);

create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 submission_id uuid references public.submissions(id) on delete cascade,
 title text not null,
 body text not null,
 kind text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null,
 p256dh text not null,
 auth text not null,
 user_agent text,
 created_at timestamptz not null default now(),
 unique(user_id,endpoint)
);

create or replace function public.is_moderator() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='moderator')$$;

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.revisions enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "profiles read own or moderator" on public.profiles for select using(id=auth.uid() or public.is_moderator());
create policy "profiles insert own employee" on public.profiles for insert with check(id=auth.uid() and role='employee');

create policy "submissions read own or moderator" on public.submissions for select using(author_id=auth.uid() or public.is_moderator());
create policy "submissions create own draft" on public.submissions for insert with check(author_id=auth.uid() and status='draft');
create policy "submissions owner update draft" on public.submissions for update using(author_id=auth.uid() and status='draft') with check(author_id=auth.uid() and status='draft');
create policy "submissions moderator update" on public.submissions for update using(public.is_moderator()) with check(public.is_moderator());

create policy "photos read own or moderator" on public.submission_photos for select using(exists(select 1 from submissions s where s.id=submission_id and (s.author_id=auth.uid() or public.is_moderator())));
create policy "photos insert own draft" on public.submission_photos for insert with check(uploaded_by=auth.uid() and exists(select 1 from submissions s where s.id=submission_id and s.author_id=auth.uid() and s.status='draft'));
create policy "photos delete own draft" on public.submission_photos for delete using(exists(select 1 from submissions s where s.id=submission_id and s.author_id=auth.uid() and s.status='draft'));

create policy "revisions read own or moderator" on public.revisions for select using(exists(select 1 from submissions s where s.id=submission_id and (s.author_id=auth.uid() or public.is_moderator())));
create policy "notifications own read" on public.notifications for select using(user_id=auth.uid());
create policy "notifications own update" on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "push own all" on public.push_subscriptions for all using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mow-materials','mow-materials',false,3145728,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/jpeg'];
create policy "storage upload own folder" on storage.objects for insert to authenticated with check(bucket_id='mow-materials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "storage author or moderator read" on storage.objects for select to authenticated using(bucket_id='mow-materials' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_moderator()));
create policy "storage own draft delete" on storage.objects for delete to authenticated using(bucket_id='mow-materials' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.submit_submission(p_submission_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update submissions set status='submitted',updated_at=now() where id=p_submission_id and author_id=auth.uid() and status='draft'
 and rights_confirmed and consents_verified and safe_content_confirmed and youth_objection_checked and accuracy_confirmed;
 if not found then raise exception 'Nie można wysłać zgłoszenia.'; end if;
 if (select count(*) from submission_photos where submission_id=p_submission_id) not between 1 and 15 then raise exception 'Wymagane 1-15 zdjęć.'; end if;
end$$;

create or replace function public.create_revision_and_send(p_submission_id uuid,p_content text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_no int;
begin
 if not public.is_moderator() then raise exception 'Brak uprawnień.'; end if;
 select coalesce(max(version_no),0)+1 into v_no from revisions where submission_id=p_submission_id;
 insert into revisions(submission_id,version_no,content,created_by) values(p_submission_id,v_no,p_content,auth.uid()) returning id into v_id;
 update submissions set status='awaiting_author',updated_at=now() where id=p_submission_id;
 return v_id;
end$$;

create or replace function public.respond_to_revision(p_revision_id uuid,p_approved boolean,p_comment text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_sub uuid;
begin
 select r.submission_id into v_sub from revisions r join submissions s on s.id=r.submission_id where r.id=p_revision_id and s.author_id=auth.uid() and s.status='awaiting_author';
 if v_sub is null then raise exception 'Brak dostępu lub nieaktualna wersja.'; end if;
 update revisions set response=case when p_approved then 'approved' else 'changes_requested' end,author_comment=p_comment,responded_at=now() where id=p_revision_id;
 update submissions set status=case when p_approved then 'approved'::submission_status else 'changes_requested'::submission_status end,updated_at=now() where id=v_sub;
end$$;

create or replace function public.mark_published(p_submission_id uuid,p_url text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_moderator() then raise exception 'Brak uprawnień.'; end if;
 if p_url !~ '^https?://' then raise exception 'Nieprawidłowy URL.'; end if;
 update submissions set status='published',published_url=p_url,published_at=now(),updated_at=now() where id=p_submission_id and (status='approved' or editorial_mode='original');
 if not found then raise exception 'Materiał nie jest gotowy do publikacji.'; end if;
end$$;

grant execute on function public.submit_submission(uuid) to authenticated;
grant execute on function public.create_revision_and_send(uuid,text) to authenticated;
grant execute on function public.respond_to_revision(uuid,boolean,text) to authenticated;
grant execute on function public.mark_published(uuid,text) to authenticated;
