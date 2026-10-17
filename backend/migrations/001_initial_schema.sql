-- Migration: 001_initial_schema
-- Purpose: Create initial Evida database schema,
-- indexes, Row Level Security, and access policies.
-- Run this migration once against a new database.


-- User profile, linked to Supabase Auth.
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now()
);

-- Conversations belong to an authenticated user.
create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'New conversation',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Messages belong to a conversation.
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

-- Document metadata; the PDF itself will live in Supabase Storage.
create table public.documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    filename text not null,
    storage_path text not null,
    content_type text not null default 'application/pdf',
    created_at timestamptz not null default now()
);

-- Useful indexes for user-scoped queries.
create index conversations_user_id_idx on public.conversations(user_id);
create index messages_conversation_id_idx on public.messages(conversation_id);
create index messages_user_id_idx on public.messages(user_id);
create index documents_user_id_idx on public.documents(user_id);

-- Enable Row Level Security.
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;

-- Profiles: users can read and update only their own profile.
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Conversations: users can manage only their own conversations.
create policy "Users can manage own conversations"
on public.conversations for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Messages: the message user and conversation owner must match.
create policy "Users can read own messages"
on public.messages for select
to authenticated
using (
    (select auth.uid()) = user_id
    and exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and c.user_id = (select auth.uid())
    )
);

create policy "Users can insert own messages"
on public.messages for insert
to authenticated
with check (
    (select auth.uid()) = user_id
    and exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and c.user_id = (select auth.uid())
    )
);

create policy "Users can delete own messages"
on public.messages for delete
to authenticated
using (
    (select auth.uid()) = user_id
    and exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and c.user_id = (select auth.uid())
    )
);

-- Documents: users can manage only their own metadata.
create policy "Users can manage own documents"
on public.documents for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
