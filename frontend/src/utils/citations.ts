import type { Source } from '../types/api'

// Link text used for citations converted from 【url】, so the renderer can tell
// them apart from links written into a sentence.
export const CITATION_LABEL = 'cite'

// 【...】: CJK lenticular brackets. Some models cite this way instead of with
// Markdown links; older saved answers contain them.
const LENTICULAR = /【\s*([^】]*?)\s*】/g
const URL_ONLY = /^https?:\/\/\S+$/

// Turns 【https://…】 into a Markdown citation link and drops any other 【…】
// marker (e.g. 【1†source】). <…> lets URLs contain parentheses.
export function normalizeCitations(text: string): string {
  return text.replace(LENTICULAR, (_match, inner: string) =>
    URL_ONLY.test(inner) && !/[<>]/.test(inner) ? ` [${CITATION_LABEL}](<${inner}>)` : '',
  )
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export type CitedSource = { number: number; title: string }

// URL -> its number in the source cards (1-based, same order as SourceList).
export function citedSources(sources: Source[] = []): Map<string, CitedSource> {
  const map = new Map<string, CitedSource>()
  sources.forEach((source, index) => {
    if (source.url && !map.has(source.url)) {
      map.set(source.url, { number: index + 1, title: source.source || hostLabel(source.url) })
    }
  })
  return map
}

// Link text that only names the source (rather than words in the sentence)
// is shown as a compact citation chip.
export function isGenericCitationText(text: string, href: string): boolean {
  const value = text.trim().toLowerCase()
  return (
    value === CITATION_LABEL ||
    value === 'source' ||
    value === href.toLowerCase() ||
    value === hostLabel(href).toLowerCase() ||
    /^\[?\d+\]?$/.test(value)
  )
}
