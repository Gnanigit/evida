export default function ConfigError({ missing }: { missing: string[] }) {
  return (
    <main className="centered-page">
      <div className="card">
        <h1>Configuration required</h1>
        <p>
          Missing environment variables: <code>{missing.join(', ')}</code>
        </p>
        <p className="muted">
          Copy <code>frontend/.env.example</code> to <code>frontend/.env.local</code>, fill in the
          values, and restart the dev server.
        </p>
      </div>
    </main>
  )
}
