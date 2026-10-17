import { useOutletContext } from 'react-router'

// Shared with pages rendered inside AppLayout.
export type AppContext = {
  refreshConversations: () => Promise<void>
}

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>()
}
