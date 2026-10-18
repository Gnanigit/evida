import Wordmark from '../common/Wordmark'

// "e" mark + Evida wordmark shown at the top of each Evida turn.
export default function AssistantLabel() {
  return (
    <div className="assistant-label">
      <span className="assistant-avatar" aria-hidden="true">
        <img src="/evida-mark.png" alt="" width={18} height={18} />
      </span>
      <Wordmark size="0.95rem" />
    </div>
  )
}
