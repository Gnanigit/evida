import Markdown, { type Components } from 'react-markdown'
import SourceList from './SourceList'
import type { ChatItem } from './types'

// react-markdown does not render raw HTML and strips unsafe URLs.
// Links in answers point to external web sources, so open them separately.
const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
}

export default function MessageItem({ message }: { message: ChatItem }) {
  if (message.role === 'user') {
    return (
      <div className="message message-user">
        <p className="message-text">{message.content}</p>
      </div>
    )
  }

  return (
    <div className="message message-assistant">
      <div className="message-role">Evida</div>
      <div className="markdown">
        <Markdown components={markdownComponents}>{message.content}</Markdown>
      </div>
      {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
    </div>
  )
}
