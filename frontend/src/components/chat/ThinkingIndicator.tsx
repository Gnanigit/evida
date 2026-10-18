import { useEffect, useState } from 'react'
import AssistantLabel from './AssistantLabel'

// Shown while Evida works on an answer. The elapsed time reassures users
// during longer research runs.
export default function ThinkingIndicator() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="turn turn-assistant">
      <AssistantLabel />
      <div className="thinking">
        <span className="thinking-text" role="status">
          Evida is researching
        </span>
        <span className="thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {seconds >= 3 && (
          <span className="thinking-time" aria-hidden="true">
            {seconds}s
          </span>
        )}
      </div>
    </div>
  )
}
