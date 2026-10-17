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

// Renders exactly the source fields the backend returned with the answer.
export default function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div className="sources">
      <h3 className="sources-heading">Sources</h3>
      <ol className="sources-list">
        {sources.map((source, index) => {
          const url = safeHttpUrl(source.url)

          if (url) {
            return (
              <li key={index}>
                <span className="source-kind">Web</span>
                <a href={url.href} target="_blank" rel="noopener noreferrer">
                  {source.source || url.href}
                </a>
                <span className="muted small"> · {url.hostname}</span>
              </li>
            )
          }

          return (
            <li key={index}>
              <span className="source-kind">PDF</span>
              <span>{source.source || 'Document'}</span>
              {source.page != null && <span className="muted small"> · page {source.page}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
