import { describe, expect, it } from 'vitest'
import { citedSources, hostLabel, isGenericCitationText, normalizeCitations } from './citations'

describe('normalizeCitations', () => {
  it('turns 【url】 into a citation link', () => {
    expect(normalizeCitations('One century【https://example.com/a】.')).toBe(
      'One century [cite](<https://example.com/a>).',
    )
  })

  it('keeps URLs with parentheses intact', () => {
    expect(normalizeCitations('See【https://en.wikipedia.org/wiki/Kohli_(cricketer)】')).toBe(
      'See [cite](<https://en.wikipedia.org/wiki/Kohli_(cricketer)>)',
    )
  })

  it('removes markers that are not URLs', () => {
    expect(normalizeCitations('Claim【1†source】 here【 】.')).toBe('Claim here.')
  })

  it('handles several citations in a row', () => {
    expect(normalizeCitations('x【https://a.com】【https://b.com】')).toBe(
      'x [cite](<https://a.com>) [cite](<https://b.com>)',
    )
  })

  it('leaves normal text and Markdown links alone', () => {
    const text = 'Plain [Reuters](https://reuters.com/x) text.'
    expect(normalizeCitations(text)).toBe(text)
  })
})

describe('citedSources', () => {
  it('numbers sources in card order, web only', () => {
    const map = citedSources([
      { source: 'report.pdf', page: 2 },
      { source: 'Wikipedia', url: 'https://en.wikipedia.org/x', type: 'web' },
      { url: 'https://www.yahoo.com/y', type: 'web' },
    ])

    expect(map.get('https://en.wikipedia.org/x')).toEqual({ number: 2, title: 'Wikipedia' })
    expect(map.get('https://www.yahoo.com/y')).toEqual({ number: 3, title: 'yahoo.com' })
    expect(map.size).toBe(2)
  })
})

describe('isGenericCitationText', () => {
  it('treats source-only labels as citations', () => {
    expect(isGenericCitationText('cite', 'https://a.com/x')).toBe(true)
    expect(isGenericCitationText('Source', 'https://a.com/x')).toBe(true)
    expect(isGenericCitationText('a.com', 'https://www.a.com/x')).toBe(true)
    expect(isGenericCitationText('[2]', 'https://a.com/x')).toBe(true)
  })

  it('keeps links that are part of the sentence', () => {
    expect(isGenericCitationText('the annual report', 'https://a.com/x')).toBe(false)
  })

  it('reads hosts without www', () => {
    expect(hostLabel('https://www.example.com/page')).toBe('example.com')
  })
})
