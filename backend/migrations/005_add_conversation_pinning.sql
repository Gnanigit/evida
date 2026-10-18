
-- Add pinning support to conversations.
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
