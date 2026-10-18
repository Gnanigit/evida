import { FileText, Globe } from 'lucide-react'
import type { Source } from '../../types/api'

function safeHttpUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

// Numbered source cards built only from the fields the backend returned.
// Web sources open in a new tab; documents show their file name and page.
export default function SourceList({ sources }: { sources: Source[] }) {
  return (
    <section className="sources" aria-label="Sources">
      <h3 className="sources-title">
        Sources <span className="sources-count">· {sources.length}</span>
      </h3>
      <ol className="source-cards">
        {sources.map((source, index) => {
          const url = safeHttpUrl(source.url)
          const number = <span className="source-number">{index + 1}</span>

          if (url) {
            const host = url.hostname.replace(/^www\./, '')
            return (
              <li key={index}>
                <a
                  className="source-card"
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={source.source || url.href}
                >
                  {number}
                  <Globe size={14} className="source-icon" aria-hidden="true" />
                  <span className="source-text">
                    <span className="source-name">{source.source || host}</span>
                    <span className="source-detail">{host}</span>
                  </span>
                </a>
              </li>
            )
          }

          const name = source.source || 'Document'
          return (
            <li key={index}>
              <div className="source-card" title={name}>
                {number}
                <FileText size={14} className="source-icon" aria-hidden="true" />
                <span className="source-text">
                  <span className="source-name">{name}</span>
                  <span className="source-detail">
                    {source.page != null ? `Page ${source.page}` : 'Document'}
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
