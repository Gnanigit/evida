import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { missingConfig } from './config'
import ConfigError from './components/common/ConfigError'

const root = createRoot(document.getElementById('root')!)

if (missingConfig.length > 0) {
  root.render(<ConfigError missing={missingConfig} />)
} else {
  // Loaded only once configuration exists, because the Supabase client
  // cannot be created without its URL and key.
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
}
