import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Source } from '../../types/api'
import {
  citedSources,
  hostLabel,
  isGenericCitationText,
  normalizeCitations,
} from '../../utils/citations'
import rehypeLineBreaks from '../../utils/rehypeLineBreaks'
import AssistantLabel from './AssistantLabel'
import MessageAttachments from './MessageAttachments'
import SourceList from './SourceList'
import type { ChatItem } from './types'

function textOf(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOf).join('')
  return ''
}

// react-markdown does not render raw HTML and strips unsafe URLs.
// Links that only name a source become numbered chips matching the source
// cards (like Perplexity); links within a sentence stay normal links.
function markdownComponentsFor(sources: Source[] | undefined): Components {
  const cited = citedSources(sources)

  return {
    a: ({ href, children }) => {
      if (href && isGenericCitationText(textOf(children), href)) {
        const source = cited.get(href)
        const label = source ? String(source.number) : hostLabel(href)
        return (
          <a
            className="citation"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={source ? `${source.title} · ${hostLabel(href)}` : href}
            aria-label={source ? `Source ${source.number}: ${source.title}` : `Source: ${label}`}
          >
            {label}
          </a>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    // Wide tables scroll inside the answer instead of stretching the page.
    table: ({ children }) => (
      <div className="table-scroll">
        <table>{children}</table>
      </div>
    ),
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard access can be denied; there is nothing useful to show.
    }
  }

  return (
    <button
      type="button"
      className="turn-action"
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : 'Copy answer'}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function MessageItem({ message }: { message: ChatItem }) {
  const components = useMemo(() => markdownComponentsFor(message.sources), [message.sources])
  // Older answers (and some models) cite as 【url】; render those as chips too.
  const content = useMemo(() => normalizeCitations(message.content), [message.content])

  if (message.role === 'user') {
    return (
      <div className="turn turn-user">
        <MessageAttachments files={message.attachments ?? []} />
        <div className="user-bubble">{message.content}</div>
      </div>
    )
  }

  return (
    <article className="turn turn-assistant">
      <AssistantLabel />
      <div className="markdown">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeLineBreaks]}
          components={components}
        >
          {content}
        </Markdown>
      </div>
      {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
      <div className="turn-actions">
        <CopyButton text={message.content} />
      </div>
    </article>
  )
}
