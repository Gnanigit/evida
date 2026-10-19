import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SubmitEvent,
} from 'react'
import { ArrowUp, Globe, LoaderCircle, Paperclip } from 'lucide-react'
import { MAX_QUESTION_LENGTH } from '../../services/chat'

// Show the character counter only when the limit is getting close.
const COUNTER_THRESHOLD = MAX_QUESTION_LENGTH - 1000

const DEFAULT_HINT = 'Evida can make mistakes. Check the cited sources.'

// True once the text needs more than one line at its current width.
function wrapsPastOneLine(textarea: HTMLTextAreaElement): boolean {
  const style = getComputedStyle(textarea)
  const lineHeight = parseFloat(style.lineHeight)
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  return textarea.scrollHeight > lineHeight * 1.5 + padding
}

type ComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  // An answer is being generated: the send button shows a spinner.
  busy?: boolean
  placeholder?: string
  inputRef?: Ref<HTMLTextAreaElement>
  // Attachment chips shown inside the card, above the text.
  attachments?: ReactNode
  // Omit to hide the attach button.
  onAttach?: (files: File[]) => void
  // Web search mode; omit onToggleWebSearch to hide the toggle.
  webSearch?: boolean
  onToggleWebSearch?: () => void
  hint?: string
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy = false,
  placeholder = 'Ask a research question…',
  inputRef,
  attachments,
  onAttach,
  webSearch = false,
  onToggleWebSearch,
  hint = DEFAULT_HINT,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSend = !disabled && value.trim().length > 0

  // Multi-line text takes the full width, with the buttons on a row below.
  // It switches back only when the box is emptied: switching back as soon as
  // the text fits would flicker, because the wider box fits more per line.
  const [wrapped, setWrapped] = useState(false)
  const expanded = wrapped && value.length > 0

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const textarea = event.target
    // Re-measure while compact (also clears a stale flag after a send empties
    // the box); once expanded, stay expanded until the box is empty.
    if (!textarea.value) setWrapped(false)
    else if (!expanded) setWrapped(wrapsPastOneLine(textarea))
    onChange(textarea.value)
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (canSend) onSubmit()
  }

  // Enter sends; Shift+Enter inserts a newline. Ignore Enter while an IME is composing.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-card">
        {attachments}
        <div className={`composer-row${expanded ? ' is-expanded' : ''}`}>
          <textarea
            ref={inputRef}
            className="composer-input"
            placeholder={placeholder}
            aria-label="Your question"
            rows={1}
            maxLength={MAX_QUESTION_LENGTH}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <div className="composer-actions">
            {value.length > COUNTER_THRESHOLD && (
              <span className="composer-count">
                {value.length.toLocaleString()} / {MAX_QUESTION_LENGTH.toLocaleString()}
              </span>
            )}
            {/* Attach and web search sit together, just before Send. */}
            {(onAttach || onToggleWebSearch) && (
              <div className="composer-tools">
                {onAttach && (
                  <>
                    <button
                      type="button"
                      className="attach-button"
                      aria-label="Attach PDFs"
                      title="Attach PDFs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip size={18} aria-hidden="true" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      hidden
                      onChange={(event) => {
                        onAttach(Array.from(event.target.files ?? []))
                        // Allow choosing the same file again.
                        event.target.value = ''
                      }}
                    />
                  </>
                )}
                {onToggleWebSearch && (
                  <button
                    type="button"
                    className="web-search-toggle"
                    aria-pressed={webSearch}
                    aria-label="Web search"
                    title={webSearch ? 'Web search is on' : 'Search the web'}
                    onClick={onToggleWebSearch}
                  >
                    <Globe size={18} aria-hidden="true" />
                    {webSearch && <span className="web-search-label">Web search</span>}
                  </button>
                )}
              </div>
            )}
            <button
              type="submit"
              className="send-button"
              disabled={!canSend}
              aria-label={busy ? 'Evida is answering' : 'Send'}
              title="Send (Enter)"
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <ArrowUp size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="composer-hint" aria-live="polite">
        {hint}
      </p>
    </form>
  )
}
