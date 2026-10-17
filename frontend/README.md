# Evida frontend

React + Vite + TypeScript client for the Evida API. See the [root README](../README.md)
for full setup.

```
npm install
npm run dev     # http://localhost:5173
npm run lint
npm test
npm run build
```

Configuration comes from `.env.local` (copy `.env.example`).

## Structure

- `src/auth/` – Supabase session context, route guards, auth error messages
- `src/services/` – Supabase client and the FastAPI client (`api.ts` attaches the access token)
- `src/pages/` – sign in, sign up, chat, documents
- `src/components/` – layout (sidebar, shell) and chat (messages, sources, composer)
