create or replace function public.mow_update_profile(p_full_name text, p_unit text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name,''));
  v_unit text := btrim(coalesce(p_unit,''));
begin
  if v_uid is null then
    raise exception 'Brak aktywnej sesji.';
  end if;
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'Nieprawidłowe imię i nazwisko.';
  end if;
  if length(v_unit) < 2 or length(v_unit) > 160 then
    raise exception 'Nieprawidłowy opis miejsca/funkcji.';
  end if;

  update public.mow_profiles
     set full_name = v_name,
         unit = v_unit
   where id = v_uid;

  if not found then
    raise exception 'Profil nie istnieje.';
  end if;
end;
$$;

revoke execute on function public.mow_update_profile(text,text) from public, anon;
grant execute on function public.mow_update_profile(text,text) to authenticated;
