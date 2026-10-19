-- Migration: 008_profile_names
-- Purpose: Store first and last names from sign-up in profiles.
-- The sign-up form sends them as auth user metadata (first_name, last_name);
-- a trigger copies them into public.profiles when the auth user is created.

alter table public.profiles
add column first_name text,
add column last_name text;

-- Runs as the table owner so it can write profiles during sign-up,
-- before the user has a session. Empty names are stored as null.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    -- v_ prefix: avoids ambiguity with the profiles columns of the same name.
    v_first text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
    v_last text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
    insert into public.profiles (id, first_name, last_name, display_name)
    values (
        new.id,
        v_first,
        v_last,
        nullif(concat_ws(' ', v_first, v_last), '')
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill: a profile for every existing user (names only if present in metadata).
insert into public.profiles (id, first_name, last_name, display_name)
select
    id,
    nullif(trim(raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'last_name'), ''),
    nullif(concat_ws(
        ' ',
        nullif(trim(raw_user_meta_data ->> 'first_name'), ''),
        nullif(trim(raw_user_meta_data ->> 'last_name'), '')
    ), '')
from auth.users
on conflict (id) do nothing;
