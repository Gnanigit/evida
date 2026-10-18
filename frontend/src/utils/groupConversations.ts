import type { Conversation } from '../types/api'

export type ConversationGroup = {
  label: string
  items: Conversation[]
}

function updatedTime(conversation: Conversation): number {
  const time = new Date(conversation.updated_at).getTime()
  return Number.isNaN(time) ? -Infinity : time
}

// Pinned conversations first, then the rest grouped by how recently they were
// updated (local calendar days). Each group is newest first; empty groups are
// left out.
export function groupConversationsByDate(
  items: Conversation[],
  now: Date = new Date(),
): ConversationGroup[] {
  const daysAgo = (days: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime()

  const boundaries = [
    { label: 'Today', from: daysAgo(0) },
    { label: 'Yesterday', from: daysAgo(1) },
    { label: 'Previous 7 days', from: daysAgo(7) },
    { label: 'Previous 30 days', from: daysAgo(30) },
    { label: 'Older', from: -Infinity },
  ]

  const pinned: ConversationGroup = { label: 'Pinned', items: [] }
  const dated: ConversationGroup[] = boundaries.map(({ label }) => ({ label, items: [] }))

  const newestFirst = [...items].sort((a, b) => updatedTime(b) - updatedTime(a))

  for (const conversation of newestFirst) {
    if (conversation.is_pinned) {
      pinned.items.push(conversation)
      continue
    }
    const updated = updatedTime(conversation)
    // Unparseable dates (-Infinity) match the last boundary, "Older".
    const index = boundaries.findIndex(({ from }) => updated >= from)
    dated[index].items.push(conversation)
  }

  return [pinned, ...dated].filter((group) => group.items.length > 0)
}
