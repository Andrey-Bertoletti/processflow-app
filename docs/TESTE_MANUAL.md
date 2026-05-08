# Roteiro de teste manual e QA — ProcessFlow

Guia para validar a aplicação end-to-end. **Preencha a coluna “Verificado” somente após executar o passo no ambiente real** (local ou produção com Supabase + Edge Functions configurados).

---

## Pré-requisitos

1. Frontend com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` válidos.
2. Projeto Supabase com migrations aplicadas e RLS ativo.
3. Edge Functions `generate-message` e `ai-worker` publicadas; segredos (`OPENAI_API_KEY`, `SERVICE_ROLE_KEY`, etc.) definidos no Supabase.
4. Opcional: duas contas — uma **admin** de um workspace e outra **member** do mesmo workspace — para validar papéis.

---

## Validação automatizada (CI / agente)

Estes itens **não substituem** o teste manual de UI, mas foram executados no repositório:

| Verificação | Resultado (07/05/2026) | Observação |
|-------------|------------------------|------------|
| `cd frontend && npm run build` | OK | Build de produção Next.js concluído sem erros. |
| `cd frontend && npm run test` (Vitest) | OK — 5 testes | Testes em `src/lib/*.test.ts` usam **mocks** do cliente Supabase; **não** exigem rede nem projeto real. |

Fluxos que dependem de **OpenAI**, **cron/webhook** do worker ou políticas RLS no banco **devem** ser validados manualmente na coluna abaixo.

---

## Checklist — botões e fluxos principais

Para cada linha: execute a ação e marque apenas quando o resultado bater com o esperado.

Legenda sugerida na coluna **Verificado**: `OK` | `FALHA` | `N/A`

| # | Tela / contexto | Ação | Resultado esperado | Verificado |
|---|-----------------|------|-------------------|------------|
| 1 | Login (`/auth/login`) | Preencher email/senha válidos e **Entrar** | Redireciona para `/auth/dashboard` ou `/auth/workspace/create` se não houver workspace; toast em caso de erro do Supabase. | |
| 2 | Login | Campos vazios e **Entrar** | Toast pedindo preenchimento; não chama API sem dados. | |
| 3 | Cadastro (`/auth/register`) | Criar conta | Toast de sucesso; redireciona para login (ou fluxo configurado). | |
| 4 | Cadastro | Senhas diferentes | Toast de validação; não cria usuário. | |
| 5 | Qualquer tela autenticada | **Sair** (menu da conta no header) | Sessão encerrada; vai para `/auth/login`; workspace ativo limpo. | |
| 6 | Header (logado) | **Trocar workspace** (select, se houver mais de um) | Kanban/dashboard/campanhas passam a usar o workspace selecionado. | |
| 7 | Header | **Member**: item **Admin** no menu | **Não** deve aparecer **Admin** para `member`. | |
| 8 | Header | **Admin**: **Admin** | Abre `/admin` e sub-rotas permitidas; `member` recebe 403 nas rotas `/admin/*`. | |
| 9 | Dashboard (`/auth/dashboard`) | **+ Novo Workspace** / criar primeiro | Workspace criado; aparece na lista; vira ativo quando aplicável. | |
|10 | Dashboard | Clicar em um card de workspace | Workspace selecionado (indicação visual); métricas recarregam se houver RPC. | |
|11 | Dashboard | Falha ao carregar métricas (RPC erro) | Toast amigável; interface não quebra. | |
|12 | Criar workspace (`/auth/workspace/create`) | **Criar Workspace** | Redireciona ao dashboard; novo workspace na lista e preferido como ativo. | |
|13 | Pipeline (`/pipeline`) | Sem workspace selecionado | Mensagem para escolher workspace + link para dashboard. | |
|14 | Pipeline | **Novo Lead** → salvar | Lead aparece na coluna correta; drawer fecha ou atualiza. | |
|15 | Pipeline | **Recarregar** | Dados sincronizam com o servidor. | |
|16 | Pipeline | Busca e filtros (texto, responsável, etapa, campanha) | Lista filtra; **Limpar filtros** zera todos (incl. campanha). | |
|17 | Pipeline | Arrastar lead entre colunas (válido) | Move e persiste; toast de sucesso. | |
|18 | Pipeline | Mover sem campos obrigatórios | Modal de validação; preencher e confirmar move o lead. | |
|19 | Pipeline | Funil vazio + **Inicializar etapas** (só admin) | Seed aplica estágios; **member** vê mensagem para pedir admin. | |
|20 | Drawer lead | **Fechar** | Drawer fecha sem perder dados não salvos de forma inesperada (comportamento atual). | |
|21 | Drawer lead | Editar campos + **Salvar alterações** | Dados persistem; toast de sucesso. | |
|22 | Drawer lead | **Excluir** | Confirmação; lead removido do board. | |
|23 | Drawer lead | Escolher campanha + **Gerar 3 mensagens** | Três sugestões ou erro amigável (rede/RLS/OpenAI). | |
|24 | Drawer lead | **Regenerar** | Novas variações ou mensagem de erro clara. | |
|25 | Drawer lead | **Copiar** em mensagem gerada/enfileirada | Conteúdo no clipboard; toast ou erro amigável se clipboard bloqueado. | |
|26 | Drawer lead | **Enviar** (simulado) em mensagem `generated` | Sucesso; lead tende a ir para “Tentando Contato”; timeline atualiza. | |
|27 | Drawer lead | **Enviar** com mensagem `pending` | Botão desabilitado / tooltip explicando espera da automação. | |
|28 | Campanhas (`/campaigns`) | **Nova campanha** (admin) | Modal/form; salva e lista atualiza. | |
|29 | Campanhas | **Editar** / **Excluir** (admin) | Persistência correta; **member** só leitura / toast. | |
|30 | Campanhas | Definir **etapa gatilho** no formulário | Valor salvo; automação dispara ao mover lead (validar com worker/cron reais). | |
|31 | Campos personalizados (`/admin/settings/fields`) | Só **admin** | Acesso permitido; **member** bloqueado pelo layout admin. | |
|32 | Campos personalizados | Salvar definições / obrigatoriedade por etapa | Regras refletidas no Kanban (bloqueio de movimento). | |
|33 | Membros (`/admin/members`) | Adicionar/remover/alterar papel (se existir na UI) | RLS e UI coerentes; **member** não acessa. | |
|34 | Automação (`/admin/automation`) | Abrir tela | Lista jobs / explicação de dependência cron; **member** não acessa. | |
|35 | Admin — pipeline / funil | Salvar configuração de etapas (se aplicável) | Alterações persistem. | |
|36 | Responsividade | Reduzir largura (mobile) | Menu do header acessível; pipeline rolável horizontalmente; drawers usáveis. | |

---

## Roteiro do vídeo (edital)

1. Cadastro em `/auth/register`.
2. Criar workspace e confirmar **admin**.
3. Criar lead e abrir detalhe.
4. Criar campanha com **etapa gatilho**.
5. Gerar 3 mensagens IA no lead.
6. **Enviar** mensagem simulada.
7. Mostrar lead em “Tentando Contato”.
8. Mostrar diferencial: automação `pending` → `generated`, dashboard por papel, tela `/admin/automation`.

---

## Segurança e regras (checklist rápido)

| Item | Resultado esperado | Verificado |
|------|-------------------|------------|
| Isolamento RLS | Não acessar dados de outro `workspace_id` via manipulação de URL/client. | |
| Transição por campos | Movimento bloqueado quando faltam obrigatórios da etapa destino. | |
| Timeline | Eventos de movimento/envio aparecem no histórico do lead. | |

---

**Documento:** Plano de testes ProcessFlow  
**Última atualização:** 07/05/2026
