-- Google OAuth replaces email+password login (src/app/login/). Supabase's
-- OAuth flow has no "sign-in only, never sign-up" mode at the API level --
-- exchangeCodeForSession() auto-provisions a brand-new auth.users row for
-- ANY @esb.co.id Google account the first time it signs in, which would
-- silently turn "restricted to management & eksekutif" into "anyone at the
-- company can self-signup". This table is the actual gate, checked by
-- src/app/auth/callback/route.ts independent of whatever auth.users ends up
-- containing -- it is never written to by the auth flow itself, only by an
-- admin running an insert by hand.
create table allowed_users (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table allowed_users enable row level security;
-- No policies -- zero anon/authenticated access, same lock-it-down pattern
-- as the raw_* tables (20260813090600_rls_and_grants.sql). Only reachable
-- through fn_is_allowed_email() below.

-- Grandfather in everyone who already had an account under the old
-- email+password system -- this is what "sudah didaftarkan di database"
-- means on the day this migration runs. Anyone added after must be inserted
-- by hand: insert into allowed_users (email) values ('nama@esb.co.id');
insert into allowed_users (email)
select lower(email) from auth.users where email is not null
on conflict (email) do nothing;

create or replace function fn_is_allowed_email(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_users where email = lower(p_email)
  );
$$;

grant execute on function fn_is_allowed_email(text) to authenticated;
