-- Admin role for allowed_users (20260917090000_google_sso_allowlist.sql) so
-- the "who can log in" list can be managed from a dashboard page instead of
-- a manual SQL insert every time (src/app/admin/users/).
alter table allowed_users add column if not exists is_admin boolean not null default false;

-- Seed the first admin. Upsert rather than plain update -- this email should
-- already exist from the grandfather-in in the previous migration, but this
-- makes the migration correct on its own even if that row were ever missing.
insert into allowed_users (email, is_admin)
values ('andreas.rolando@esb.co.id', true)
on conflict (email) do update set is_admin = true;

-- All three functions below re-check the CALLER's own admin status inside
-- the function body, not just at the Next.js page/action layer -- these are
-- security definer (bypass RLS same as fn_is_allowed_email), so a check that
-- only lived in the UI could be bypassed by calling the RPC directly with a
-- valid (non-admin) session.
create or replace function fn_is_admin_email()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from allowed_users where email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    false
  );
$$;

grant execute on function fn_is_admin_email() to authenticated;

create or replace function fn_admin_list_users()
returns table (email text, is_admin boolean, added_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fn_is_admin_email() then
    raise exception 'not authorized';
  end if;

  return query select au.email, au.is_admin, au.added_at from allowed_users au order by au.added_at desc;
end;
$$;

grant execute on function fn_admin_list_users() to authenticated;

create or replace function fn_admin_add_user(p_email text, p_is_admin boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fn_is_admin_email() then
    raise exception 'not authorized';
  end if;

  insert into allowed_users (email, is_admin) values (lower(p_email), p_is_admin)
  on conflict (email) do update set is_admin = excluded.is_admin;
end;
$$;

grant execute on function fn_admin_add_user(text, boolean) to authenticated;

create or replace function fn_admin_remove_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fn_is_admin_email() then
    raise exception 'not authorized';
  end if;

  if lower(p_email) = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'cannot remove your own access';
  end if;

  delete from allowed_users where email = lower(p_email);
end;
$$;

grant execute on function fn_admin_remove_user(text) to authenticated;
