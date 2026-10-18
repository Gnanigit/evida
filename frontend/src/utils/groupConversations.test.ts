import { describe, expect, it } from 'vitest'
import type { Conversation } from '../types/api'
import { groupConversationsByDate } from './groupConversations'

// Local time, mid-afternoon, so day boundaries are unambiguous.
const now = new Date(2026, 9, 18, 15, 0, 0)

function conversation(id: string, updated: Date | string): Conversation {
  const updatedAt = typeof updated === 'string' ? updated : updated.toISOString()
  return { id, title: id, created_at: updatedAt, updated_at: updatedAt }
}

function labels(items: Conversation[]) {
  return groupConversationsByDate(items, now).map((group) => [
    group.label,
    group.items.map((item) => item.id),
  ])
}

describe('groupConversationsByDate', () => {
  it('puts each conversation in the right group, keeping order', () => {
    const items = [
      conversation('this-morning', new Date(2026, 9, 18, 8, 0)),
      conversation('midnight', new Date(2026, 9, 18, 0, 0)),
      conversation('yesterday-late', new Date(2026, 9, 17, 23, 59)),
      conversation('yesterday-early', new Date(2026, 9, 17, 0, 0)),
      conversation('three-days', new Date(2026, 9, 15, 12, 0)),
      conversation('seven-days', new Date(2026, 9, 11, 0, 0)),
      conversation('eight-days', new Date(2026, 9, 10, 23, 0)),
      conversation('thirty-days', new Date(2026, 8, 18, 0, 0)),
      conversation('old', new Date(2026, 8, 17, 23, 0)),
    ]

    expect(labels(items)).toEqual([
      ['Today', ['this-morning', 'midnight']],
      ['Yesterday', ['yesterday-late', 'yesterday-early']],
      ['Previous 7 days', ['three-days', 'seven-days']],
      ['Previous 30 days', ['eight-days', 'thirty-days']],
      ['Older', ['old']],
    ])
  })

  it('leaves out empty groups', () => {
    const items = [
      conversation('today', new Date(2026, 9, 18, 9, 0)),
      conversation('old', new Date(2025, 0, 1)),
    ]

    expect(labels(items)).toEqual([
      ['Today', ['today']],
      ['Older', ['old']],
    ])
  })

  it('puts pinned conversations first, newest first, whatever their age', () => {
    const items = [
      conversation('recent', new Date(2026, 9, 18, 9, 0)),
      { ...conversation('pinned-old', new Date(2025, 0, 1)), is_pinned: true },
      { ...conversation('pinned-new', new Date(2026, 9, 17, 9, 0)), is_pinned: true },
    ]

    expect(labels(items)).toEqual([
      ['Pinned', ['pinned-new', 'pinned-old']],
      ['Today', ['recent']],
    ])
  })

  it('sorts each group newest first even if the input is not', () => {
    const items = [
      conversation('earlier', new Date(2026, 9, 18, 8, 0)),
      conversation('later', new Date(2026, 9, 18, 12, 0)),
    ]

    expect(labels(items)).toEqual([['Today', ['later', 'earlier']]])
  })

  it('returns no groups for no conversations', () => {
    expect(groupConversationsByDate([], now)).toEqual([])
  })

  it('puts unparseable dates in Older', () => {
    expect(labels([conversation('broken', 'not-a-date')])).toEqual([['Older', ['broken']]])
  })
})
