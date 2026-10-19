-- Migration: 010_delete_own_account
-- Purpose: Let a signed-in user delete their own account.
--
-- Deleting the auth.users row removes all of the user's rows: profiles,
-- conversations, messages and documents all reference auth.users(id)
-- with "on delete cascade" (documents also cascade via conversations).
-- Storage files and Chroma vectors are deleted by the backend
-- (DELETE /account) before this function is called.
--
-- Safety: the function takes no arguments. It only ever deletes the row
-- for auth.uid(), the user identified by the caller's own access token,
-- so a user can never delete anyone else.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    delete from auth.users where id = v_user_id;
end;
$$;

-- Only signed-in users may call it (Supabase grants new functions to
-- anon by default, so revoke that explicitly).
revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
