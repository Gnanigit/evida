-- Migration: 009_drop_display_name
-- Purpose: Remove profiles.display_name. Nothing reads it; the full name is
-- first_name + last_name (added in 008).
-- Run after 008. The trigger function is replaced first, in the same
-- transaction, so sign-ups never write to the dropped column.

begin;

-- Same as 008's handle_new_user, without display_name.
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
    insert into public.profiles (id, first_name, last_name)
    values (new.id, v_first, v_last)
    on conflict (id) do nothing;

    return new;
end;
$$;

alter table public.profiles
drop column if exists display_name;

commit;
