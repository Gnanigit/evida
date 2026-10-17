import type { SubmitEvent, KeyboardEvent } from 'react'
import { MAX_QUESTION_LENGTH } from '../../services/chat'

type ComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export default function Composer({ value, onChange, onSubmit, disabled }: ComposerProps) {
  const canSend = !disabled && value.trim().length > 0

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
      <textarea
        className="composer-input"
        placeholder="Ask a research question…"
        aria-label="Your question"
        rows={2}
        maxLength={MAX_QUESTION_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="button button-primary" disabled={!canSend}>
        {disabled ? 'Working…' : 'Send'}
      </button>
    </form>
  )
}
