# Frontend (Next.js)

Este diretório contém a aplicação **Next.js** (UI + SSR/Route Handlers quando aplicável).

## Como rodar

Pré-requisitos:
- Node.js

Configuração de ambiente:
- Copie `frontend/.env.example` → `frontend/.env.local` e preencha com seus valores.
- Observação: o frontend **não** usa `OPENAI_API_KEY` (a IA roda nas Supabase Edge Functions).

Comandos:
- A partir da raiz: `npm run front`
- Ou diretamente aqui dentro: `npm run dev`

## Integrações

- Auth/DB: Supabase (clients em `frontend/src/lib/supabase/`)
- Edge Functions: chamadas via `supabase.functions.invoke(...)` quando aplicável

