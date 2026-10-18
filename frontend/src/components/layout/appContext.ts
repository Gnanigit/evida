import { useOutletContext } from 'react-router'
import type { Conversation } from '../../types/api'

// Shared with pages rendered inside AppLayout.
export type AppContext = {
  conversations: Conversation[]
  refreshConversations: () => Promise<void>
}

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>()
}
