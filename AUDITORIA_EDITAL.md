# Auditoria do edital — ProcessFlow

**Última revisão:** 08/05/2026  
**Escopo desta revisão:** desempenho (queries / payload), segurança (Edge Functions + RPCs conhecidas), aderência ao edital `Prova Técnica — Desenvolvedor Vibe Coding Full Stack-20260505132034.md`, build/testes/ZIP.

**Status geral:** Funcionalidades obrigatórias e diferenciais principais implementados; **vídeo obrigatório** ainda pendente no `README.md`.

---

## 1) Entregáveis do edital

| Item | Status | Evidência / nota honesta |
|------|--------|---------------------------|
| Repositório Git | Completo | Raiz do projeto |
| README (descrição, stack, decisões, checklist) | Completo | `README.md` |
| Aplicação publicada | Completo | Link em `README.md` (Vercel, root `frontend`) |
| Vídeo ≤ 10 min (obrigatório) | **Pendente** | `README.md` e `docs/TESTE_MANUAL.md` — ainda sem URL Drive/YouTube |

---

## 2) Aderência — requisitos funcionais obrigatórios

| Requisito (edital) | Status | Evidência |
|---------------------|--------|-----------|
| Cadastro e login | Completo | `frontend/src/components/auth/RegisterForm.tsx`, `LoginForm.tsx` |
| Workspaces | Completo | `frontend/src/app/auth/workspace/create/page.tsx`, `frontend/src/app/auth/dashboard/page.tsx`; RPC `create_workspace_with_owner` |
| Isolamento por workspace | Completo | RLS com `is_user_in_workspace` / `can_access_workspace`; `database/migrations/20260504194000_fix_workspace_policies_recursion.sql` |
| Leads: campos padrão | Completo | Modelo em migrations + `LeadCreateDrawer` / `LeadDetailsDrawer` |
| Campos personalizados | Completo | `workspace_custom_fields`, `lead_custom_field_values`; `frontend/src/app/admin/settings/fields/page.tsx` |
| Responsável (opcional) | Completo | `assigned_to` em leads; atribuição na UI |
| Kanban + mover | Completo | `frontend/src/app/pipeline/page.tsx`, `KanbanBoard.tsx` |
| Funil 7 etapas (ou variação justificada) | Completo | Seed / padrão documentado no `README` |
| Campanhas (nome, contexto, prompt) | Completo | `frontend/src/app/campaigns/page.tsx`, `CampaignForm.tsx` |
| IA: 2–3 variações | Completo | Três variações na UI (`LeadDetailsDrawer`); Edge `generate-message` |
| Regenerar / copiar / enviar simulado | Completo | `LeadDetailsDrawer`; RPC `send_message_simulated` |
| Envio simulado → "Tentando Contato" | Completo | `database/migrations/20260507150000_standardize_send_message_simulated.sql` (e fixes associados) |
| Etapa gatilho (diferencial no edital; listado também em 4.3) | Completo | `auto_campaign_id` em stages + worker / fila; migrations de automação |
| Regras de transição (campos obrigatórios) | Completo | `required_fields` em stages; `validateLeadMovement` + `StageValidationModal` |
| Dashboard (básico + extras) | Completo | `frontend/src/app/auth/dashboard/page.tsx`; RPC `get_dashboard_metrics` |

**Nota edital vs stack:** o edital cita ferramentas tipo Lovable/Bolt como exemplo de *Vibe Coding*; o projeto entrega **Next.js + Cursor** (declarado no `README`). Isso atende ao espírito de “ferramenta assistida por IA” de forma equivalente — registrar como decisão explícita no README (já documentado como prova técnica).

---

## 3) Diferenciais (edital)

| Diferencial | Status | Evidência |
|-------------|--------|-----------|
| Geração automática por gatilho | Completo | Triggers / `ai-worker`, migrations `20260506170000_*`, página `admin/automation` |
| Edição de funil | Completo | `frontend/src/app/admin/pipeline/page.tsx` |
| Multi-workspace | Completo | `AuthContext`, dashboard, header (troca de workspace) |
| Membros admin/member | Completo | `workspace_users.role`, `RequireWorkspaceAdmin`, RLS em campanhas |
| Histórico / timeline | Completo | `activities`, `LeadTimeline.tsx` |
| Mensagens enviadas | Completo | Seção no drawer + RPC de envio simulado |
| Filtros e busca | Completo | `pipeline/page.tsx` |
| Métricas avançadas | Completo | RPC métricas; visão diferenciada admin/member no dashboard |
| RLS bem definida | Completo | Políticas por `workspace_id` + funções `SECURITY DEFINER` com `search_path` onde aplicável |

---

## 4) Performance (auditoria 08/05/2026)

| Área | Antes | Depois | Evidência |
|------|-------|--------|-----------|
| Carga do Kanban | `stages` com `leads(*, messages(*), lead_events(*), …)` — payload enorme e repetido | Select enxuto: leads + `lead_insights` + `lead_custom_field_values` apenas | `frontend/src/lib/pipeline.ts` |
| Campanhas / campos no pipeline | `select("*")` | Colunas explícitas necessárias à UI | `frontend/src/app/pipeline/page.tsx` |
| Índices compostos frequência | Parcialmente coberto por índices antigos | Novos índices `(workspace_id, stage_id, created_at)`, mensagens `(workspace_id, status, created_at)`, atividades `(lead_id, created_at)` | `database/migrations/20260508110000_query_performance_indexes.sql` |

**Pendências / próximos incrementos (não bloqueantes):** paginação de leads por coluna se workspaces crescerem muito; memoização fina de cards; virtualização horizontal (só se medição indicar gargalo).

---

## 5) Segurança (auditoria 08/05/2026)

| Tema | Status | Detalhe |
|------|--------|---------|
| IDOR nas Edge Functions IA | **Corrigido** | `generate-message` e `semantic-analysis` validam JWT, pertencimento ao workspace (`workspace_users` ou `workspaces.owner_id`), e alinhamento `lead.workspace_id` ↔ `campaign.workspace_id` | `backend/supabase/functions/generate-message/index.ts`, `semantic-analysis/index.ts` |
| `ai-worker` acessível sem gate | **Endurecido** | Se `WEBHOOK_SECRET` estiver definido, exige header `x-webhook-secret`. Sem secret, compatível com ambientes legados (recomenda-se configurar secret em produção). | `backend/supabase/functions/ai-worker/index.ts`, `backend/supabase/config.toml` |
| RPC sensível para `anon` | Revisado em migrations anteriores | Ex.: `get_dashboard_metrics` com `is_user_in_workspace`, revogar `anon` — `20260507202000_lockdown_sensitive_rpcs.sql` |
| `SECURITY DEFINER` + `search_path` | Coberto nas migrations de lockdown | `20260507202000_lockdown_sensitive_rpcs.sql`; `get_user_workspaces` em `20260506182000_restore_essential_rpcs.sql` |
| Secrets no frontend | OK | Só `NEXT_PUBLIC_*` para Supabase; comentário em `frontend/src/lib/supabase/client.ts` |
| ZIP de submissão | OK | `scripts/create-submission-zip.mjs` usa apenas `git ls-files` + bloqueio de `.env`, `node_modules`, `.next`, `.git`, `.vercel`, `.temp`, logs |

---

## 6) Build, testes e ZIP

| Verificação | Status (08/05/2026) | Observação |
|-------------|---------------------|------------|
| `cd frontend && npm run build` | OK | Next.js 14.2.3 |
| `cd frontend && npm run test` | OK — 5 testes | Vitest; mocks locais (sem Supabase em rede) |
| `npm run db:sync` | OK | 62 migrations espelhadas em `backend/supabase/migrations` |
| `npm run zip:submission` | OK — 160 arquivos | Script rejeita artefatos/segredos listados nas regras |

**Testes manuais** (RLS, OpenAI, cron): ver checklist em `docs/TESTE_MANUAL.md`.

---

## 7) Conclusão honesta

- **Cobertura do edital (código):** obrigatórios e diferenciais listados acima estão endereçados com evidências.
- **Único entregável obrigatório em aberto:** link do **vídeo** no README.
- **Risco residual:** funções internas legadas no banco — mitigação contínua via migrations de `REVOKE`/`search_path` (padrão já estabelecido em `20260507202000_*`).

**Pontuação de conformidade (aproximada):** alta para código e segurança em caminhos críticos auditados; submissão “100% edital” depende apenas do **vídeo** e de validação manual no deploy.
