import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = {
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  required?: boolean
  minLength?: number
}

// Password input with a show/hide toggle. Browsers' own reveal buttons
// (Edge's ::-ms-reveal) are hidden in CSS so there is only one eye icon.
export default function PasswordInput({
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="password-field">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        // Keep focus (and the caret) in the input while toggling.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  )
}
