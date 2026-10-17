import type { Message, Source } from '../../types/api'

// A saved message as displayed in the chat thread.
export type ChatItem = Message & { sources?: Source[] }
