alter table public.messages
add column attachments jsonb not null default '[]'::jsonb;