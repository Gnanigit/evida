// The Evida wordmark. The image already contains the name, so it is the alt text.
export default function Brand({ large = false }: { large?: boolean }) {
  return (
    <img
      src="/evida-logo.png"
      alt="Evida"
      className={`brand-logo${large ? ' brand-logo-large' : ''}`}
    />
  )
}
