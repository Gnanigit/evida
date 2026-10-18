import { describe, expect, it } from 'vitest'
import { relativeTime } from './relativeTime'

const now = new Date(2026, 9, 18, 15, 0, 0)
const at = (...parts: [number, number, number, number?, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0).toISOString()

describe('relativeTime', () => {
  it('describes the last minute as just now', () => {
    expect(relativeTime(at(2026, 9, 18, 14, 59), new Date(2026, 9, 18, 14, 59, 30))).toBe('just now')
  })

  it('treats future times as just now', () => {
    expect(relativeTime(at(2026, 9, 18, 16), now)).toBe('just now')
  })

  it('counts minutes and hours today', () => {
    expect(relativeTime(at(2026, 9, 18, 14, 59), now)).toBe('1 minute ago')
    expect(relativeTime(at(2026, 9, 18, 14, 25), now)).toBe('35 minutes ago')
    expect(relativeTime(at(2026, 9, 18, 13, 0), now)).toBe('2 hours ago')
    expect(relativeTime(at(2026, 9, 18, 0, 30), now)).toBe('14 hours ago')
  })

  it('uses calendar days after today', () => {
    expect(relativeTime(at(2026, 9, 17, 23, 30), now)).toBe('Yesterday')
    expect(relativeTime(at(2026, 9, 15, 9), now)).toBe('3 days ago')
  })

  it('shows a date after a week, with the year only if different', () => {
    expect(relativeTime(at(2026, 9, 1), now, 'en-US')).toBe('Oct 1')
    expect(relativeTime(at(2025, 11, 25), now, 'en-US')).toBe('Dec 25, 2025')
  })

  it('returns an empty string for an invalid date', () => {
    expect(relativeTime('not-a-date', now)).toBe('')
  })
})
