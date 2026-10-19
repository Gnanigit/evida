type WordmarkProps = {
  // Any CSS font-size (e.g. "1rem", "2.25rem", 18). Inherits the parent's size when omitted.
  size?: string | number
  className?: string
}

// "Evida" in the brand style: bold primary text with a mint dot on the i.
// Screen readers get the plain word; the styled letters are hidden from them.
export default function Wordmark({ size, className }: WordmarkProps) {
  return (
    <span
      className={`wordmark${className ? ` ${className}` : ''}`}
      style={size !== undefined ? { fontSize: size } : undefined}
    >
      <span className="visually-hidden">Evida</span>
      <span aria-hidden="true">
        Ev
        <span className="wordmark-i">
          ı<span className="wordmark-dot" />
        </span>
        da
      </span>
    </span>
  )
}
