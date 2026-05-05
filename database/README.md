# Database (PostgreSQL / Supabase)

Este diretório centraliza tudo relacionado ao **banco de dados** (PostgreSQL via Supabase).

## Estrutura

- `database/migrations/`: source of truth das migrations SQL
- `database/seed.sql`: seed opcional para desenvolvimento local
- `database/schema.sql`: snapshot opcional do schema (gerável)

## Aplicando migrations

O Supabase CLI espera migrations em `backend/supabase/migrations/`. Para manter uma única fonte da verdade, usamos um sync:

1) `npm run db:sync`
2) `npm run banco` (push) ou `npm run banco:reset` (reset)

## Gerando `schema.sql` (opcional)

1) `cd backend/supabase`
2) `supabase db dump --schema public --file ../../database/schema.sql`

