# Evida

Evida is an agentic RAG research assistant. It answers questions using general LLM
knowledge, your uploaded PDFs, and web sources, grades the evidence, and cites it.

| Part | Stack |
|---|---|
| `frontend/` | React, Vite, TypeScript, Supabase Auth |
| `backend/` | FastAPI, LangGraph, Chroma, Groq, Tavily |
| Services | Supabase Auth, PostgreSQL (RLS), private Storage |

## Prerequisites

- Python 3.12+ and Node.js 20+
- A Supabase project, plus Groq and Tavily API keys

## Supabase setup (once)

1. In the SQL editor, run the files in `backend/migrations/` in order (`001` to `004`).
2. In Storage, create a **private** bucket named `evida-documents`.
3. In Authentication → URL Configuration, add `http://localhost:5173` to the redirect
   URLs (needed for email confirmation links).

## Backend

Create `backend/.env`:

```
GROQ_API_KEY=...
TAVILY_API_KEY=...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
# Optional; defaults to the local Vite origins.
# CORS_ORIGINS=["http://localhost:5173"]
```

Then:

```
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at http://localhost:8000 (interactive docs at `/docs`).

## Frontend

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the values. Only the
Supabase URL, the publishable key, and the API URL belong here; every `VITE_` variable is
shipped to the browser, so never put server keys in it.

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Tests

```
cd backend
pytest --ignore=tests/live --ignore=tests/db --ignore=tests/test_scripts_real_workflow
```

`tests/live`, `tests/db`, and `tests/test_scripts_real_workflow` call Groq, Tavily, and
Supabase and need real credentials.

```
cd frontend
npm run lint
npm test
npm run build
```

## Using Evida

1. Sign up (confirm your email if the Supabase project requires it) and sign in.
2. Under **Documents**, upload a PDF. Evida uploads it, then indexes it for search.
3. Start a **New conversation** and ask a question. Answers show their PDF and web sources.
