-- Store the sources Evida used for each assistant answer.
alter table public.messages
add column sources jsonb not null default '[]'::jsonb;
