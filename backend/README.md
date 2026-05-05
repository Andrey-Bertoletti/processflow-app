# Backend (Supabase Edge Functions)

Este diretório centraliza o **backend** do projeto, implementado como **Supabase Edge Functions** (Deno).

## Estrutura

- `backend/supabase/functions/`: Edge Functions
- `backend/supabase/config.toml`: configuração do Supabase CLI / funções

## Como rodar localmente

Pré-requisitos:
- Supabase CLI instalado
- Docker (para `supabase start`)

Comandos (a partir da raiz do repositório):
- `npm run db:sync` sincroniza `database/migrations/` para `backend/supabase/migrations/`
- `npm run supabase:start` inicia o stack local do Supabase
- `npm run back` serve as Edge Functions localmente

## Deploy

- `npm run back:deploy` (deploy das Edge Functions via Supabase CLI)

