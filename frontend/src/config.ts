// Public frontend configuration, read from Vite environment variables.
// These values are bundled into the browser build, so they must never be secrets.

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
}

export const missingConfig: string[] = [
  ['VITE_SUPABASE_URL', config.supabaseUrl],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', config.supabasePublishableKey],
  ['VITE_API_BASE_URL', config.apiBaseUrl],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)
