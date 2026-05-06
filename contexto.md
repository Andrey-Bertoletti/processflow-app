# 🧠 ProcessFlow - Technical Memory Context

Este documento é a "fonte da verdade" técnica para o projeto ProcessFlow. Ele foi projetado para ser consumido por IAs em novas sessões para garantir continuidade sem perda de contexto.

## 🌳 Mapeamento de Estrutura (Tree)
```text
.
├── supabase/                # Core de Infraestrutura e Banco (Fonte da Verdade)
│   ├── migrations/          # 49 Migrações SQL (Esquema, RLS, Triggers, RPCs)
│   ├── functions/           # Edge Functions (IA, Workers, Análise Semântica)
│   ├── config.toml          # Configuração CLI do Supabase
│   ├── schema.sql           # Snaphot do esquema atual
│   └── seed.sql             # Dados iniciais de desenvolvimento
├── frontend/                # Aplicação Principal (UI/UX)
│   ├── src/
│   │   ├── app/             # Rotas e Layouts (Next.js App Router)
│   │   ├── components/      # Componentes React (Shared e Específicos)
│   │   ├── lib/             # Clientes Supabase, Utils e Integrações
│   │   └── hooks/           # Lógica de estado e hooks customizados
│   ├── tests/               # Testes E2E (Playwright) e Unitários (Vitest)
│   └── public/              # Ativos estáticos e Assets
├── scripts/                 # Automações de DevOps e Entrega Segura
├── .env                     # Variáveis de ambiente (PROJECT_URL, SERVICE_ROLE_KEY)
└── contexto.md              # Este arquivo (Memória Técnica)
```

## 🛠️ Visão Geral Técnica
*   **Stack Principal**: React 18 + Next.js 14.2 (App Router) + TypeScript.
*   **Banco de Dados**: PostgreSQL 17 (Gerenciado via Supabase).
*   **IA**: OpenAI API (GPT-4o mini) via Edge Functions (Deno 2).
*   **Dependências Críticas**: 
    *   `@supabase/supabase-js` (Comunicação com backend).
    *   `tailwindcss` (Estilização atômica).
    *   `lucide-react` (Iconografia).
    *   `sonner` (Sistema de notificações).

## ⚙️ Fluxo do Backend (Supabase-Centric)
*   **Migrations**: Localizadas em `./supabase/migrations`. São a única fonte de verdade para o esquema do banco.
*   **Conexão**: O frontend se comunica via PostgREST (API automática do Supabase) respeitando RLS.
*   **Lógica Assíncrona**: O banco de dados alimenta uma tabela `job_queue`. O Worker (`projection-worker` ou similar) processa essa fila e dispara as Edge Functions.
*   **Endpoints de IA**: As Edge Functions (`generate-message`, `semantic-analysis`) são chamadas via `supabase.functions.invoke()`.

## 🎨 Resumo de Componentes (Frontend)
### Shared (Reutilizáveis)
*   `CustomFieldForm`: Renderizador dinâmico para tipos de campos customizados.
*   `StatusBadge`: Componente visual para status de leads e mensagens.
*   `ConfirmationModal`: Diálogos de ação destrutiva.

### Página-Específicos (Pipeline/Kanban)
*   `KanbanBoard`: Componente principal da visualização de funil.
*   `LeadDetailsDrawer`: Gaveta lateral densa com histórico, campos e regeneração de mensagens por IA.
*   `CampaignSelector`: Seleção de contexto para automação de etapas.

## 🚩 Estado Atual
*   **Banco de Dados**: 100% migrado (49 migrations). Estrutura de Multi-tenancy (Workspaces) e RLS ativa.
*   **Funcionalidades Operacionais**:
    *   Movimentação de leads entre etapas com persistência.
    *   Geração automática de mensagens via IA ao entrar em etapas "Gatilho".
    *   Simulação de envio de mensagem com transição automática de estágio.
    *   Gestão de Campos Personalizados (Texto, Número, Data, Select).
*   **Próximos Passos**: Refinamento de Dashboards e Auditoria final de performance.

---
**Nota para IA**: Ao ler este arquivo, assuma o papel de um Engenheiro de Software Sênior especializado em Next.js e Supabase. Priorize segurança (RLS) e performance de banco em todas as sugestões.
