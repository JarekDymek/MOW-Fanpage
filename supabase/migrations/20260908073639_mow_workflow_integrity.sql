-- Scope: MOW only. No existing material is changed.
revoke all on public.mow_profiles,public.mow_submissions,public.mow_submission_photos,public.mow_revisions,public.mow_notifications,public.mow_push_subscriptions from anon;
revoke truncate,references,trigger on public.mow_profiles,public.mow_submissions,public.mow_submission_photos,public.mow_revisions,public.mow_notifications,public.mow_push_subscriptions from authenticated;

create or replace function public.mow_respond_to_revision(p_revision_id uuid,p_approved boolean,p_comment text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_sub uuid; v_latest uuid;
begin
 select s.id into v_sub from mow_submissions s join mow_revisions r on r.submission_id=s.id
 where r.id=p_revision_id and s.author_id=auth.uid() and s.status='awaiting_author' for update of s;
 if v_sub is null then raise exception 'Brak dostępu lub nieaktualna wersja.'; end if;
 select id into v_latest from mow_revisions where submission_id=v_sub order by version_no desc limit 1;
 if v_latest<>p_revision_id then raise exception 'Otwórz najnowszą wersję tekstu.'; end if;
 update mow_revisions set response=case when p_approved then 'approved' else 'changes_requested' end,author_comment=p_comment,responded_at=now() where id=p_revision_id;
 update mow_submissions set status=case when p_approved then 'approved'::mow_submission_status else 'changes_requested'::mow_submission_status end,updated_at=now() where id=v_sub;
end$$;

create or replace function public.mow_create_revision_and_send(p_submission_id uuid,p_content text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_no int;
begin
 if not public.mow_is_moderator() then raise exception 'Brak uprawnień.'; end if;
 perform 1 from mow_submissions where id=p_submission_id and editorial_mode='edit_approval' and status in ('submitted','editing','awaiting_author','changes_requested') for update;
 if not found then raise exception 'Materiał nie jest dostępny do redakcji.'; end if;
 select coalesce(max(version_no),0)+1 into v_no from mow_revisions where submission_id=p_submission_id;
 insert into mow_revisions(submission_id,version_no,content,created_by) values(p_submission_id,v_no,p_content,auth.uid()) returning id into v_id;
 update mow_submissions set status='awaiting_author',updated_at=now() where id=p_submission_id;
 return v_id;
end$$;

create or replace function public.mow_mark_published(p_submission_id uuid,p_url text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.mow_is_moderator() then raise exception 'Brak uprawnień.'; end if;
 if p_url is null or p_url !~ '^https://([a-zA-Z0-9-]+\.)*facebook\.com/' and p_url !~ '^https://fb\.watch/[^/?#]+' then raise exception 'Wklej adres posta na Facebooku.'; end if;
 if p_url ~ '^https://([a-zA-Z0-9-]+\.)*facebook\.com/' and not (p_url ~ '/(posts|photos|videos|reel|share)/[^?#]+' or (p_url ~ '/(photo|permalink|story)(\.php)?\?' and p_url ~ '[?&](fbid|story_fbid)=[^&]+')) then raise exception 'Wklej adres konkretnego posta, nie strony fanpage.'; end if;
 update mow_submissions set status='published',published_url=p_url,published_at=now(),updated_at=now()
 where id=p_submission_id and consent_status<>'needs_review' and
 ((editorial_mode='original' and status='submitted') or (editorial_mode='edit_approval' and status='approved' and
 (select response from mow_revisions where submission_id=p_submission_id order by version_no desc limit 1)='approved'));
 if not found then raise exception 'Materiał nie jest gotowy do publikacji lub wymaga weryfikacji wizerunku.'; end if;
end$$;

create or replace function public.mow_update_profile(p_full_name text,p_unit text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Brak aktywnej sesji.'; end if;
 if length(btrim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Imię i nazwisko: od 2 do 120 znaków.'; end if;
 if length(btrim(coalesce(p_unit,''))) not between 1 and 120 then raise exception 'Funkcja, miejsce i grupa: łącznie do 120 znaków.'; end if;
 update mow_profiles set full_name=btrim(p_full_name),unit=btrim(p_unit) where id=auth.uid();
 if not found then raise exception 'Profil nie istnieje.'; end if;
end$$;
