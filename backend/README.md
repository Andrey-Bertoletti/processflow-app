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

Nota: o Supabase CLI deve ser executado a partir de `backend/` (workdir), pois ele procura por `supabase/config.toml` dentro desse diretÃ³rio.

## Deploy

- `npm run back:deploy` (deploy das Edge Functions via Supabase CLI)

## AutomaÃ§Ã£o por Etapa Gatilho (AI Worker)

O fluxo de automaÃ§Ã£o por etapa usa:
- `stages.auto_campaign_id` como vÃ­nculo "etapa gatilho" â†’ campanha.
- Trigger no banco (`AFTER INSERT OR UPDATE OF stage_id ON public.leads`) para enfileirar um job em `public.job_queue` (`type = 'generate_ai_message'`) e criar/atualizar uma mensagem placeholder `pending` em `public.messages` (`metadata.origin = 'trigger_stage'`).
- Edge Function `ai-worker` para consumir `job_queue` e transformar `pending` → `generated` (mensagens geradas).

### Rodando manualmente (local)

1) `npm run supabase:start`
2) `npm run back`
3) Executar o worker:
   - `curl -X POST http://localhost:54321/functions/v1/ai-worker`
   - se `WEBHOOK_SECRET` estiver configurado, inclua `-H \"x-webhook-secret: <WEBHOOK_SECRET>\"`

### Agendamento via pg_cron + pg_net (opcional)

Exemplo (rodar no SQL Editor do Supabase):

```sql
-- Habilite as extensÃµes (se disponÃ­veis no seu projeto)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Chama a Edge Function a cada minuto
select cron.schedule(
  'ai-worker-generate-ai-message',
  '*/1 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/ai-worker',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
