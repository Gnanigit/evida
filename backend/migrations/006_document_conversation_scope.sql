alter table public.documents
add column conversation_id uuid references public.conversations(id) on delete cascade;

create index documents_conversation_id_idx on public.documents(conversation_id);