# ProcessFlow - SDR Intelligence & CRM 🚀

> Mini CRM voltado para equipes de Pré-Vendas (SDR) com funcionalidades de geração de mensagens personalizadas utilizando Inteligência Artificial.

**ProcessFlow** é uma plataforma de gestão de leads desenvolvida como prova técnica para demonstrar competências em engenharia de software full stack, integração com Inteligência Artificial e arquitetura de sistemas escaláveis e seguros, utilizando ferramentas modernas de *Vibe Coding*.

O sistema permite que equipes organizem leads em um funil visual Kanban, criem campanhas de abordagem com contextos específicos (ex: Black Friday) e gerem mensagens personalizadas usando IA — considerando os dados padrão e campos customizados de cada lead.

---

## 📺 Demonstração & Links

- **Aplicação:** https://processflow-app-eosin.vercel.app
- **Root Directory na Vercel:** `frontend`
- **Vídeo de Walkthrough:** Pendente — adicionar o link (YouTube/Drive) antes da submissão final.

## 📎 Edital (Prova)

- O edital original está versionado na raiz: `Prova Técnica — Desenvolvedor Vibe Coding Full Stack-20260505132034.md`

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia / Ferramenta |
|--------|-------------------------|
| **Frontend** | Next.js 14 (App Router) + React 18 + TypeScript |
| **Estilização** | Tailwind CSS + Design System customizado (CSS Variables) |
| **Componentes** | Shadcn/UI (base com customizações avançadas), Recharts, Lucide React, Sonner |
| **Estado/Dados** | React Context API & React Server Components |
| **Backend** | Supabase Edge Functions (Deno 2 / TypeScript) |
| **Banco de Dados** | Supabase (PostgreSQL 17 gerenciado) |
| **Autenticação** | Supabase Auth (Email, Password, JWT & Session) |
| **Integração IA** | OpenAI API (GPT-4o-mini) via Edge Functions |
| **Hospedagem** | Vercel (Frontend) + Supabase Cloud (Backend) |

---

## 🏗️ Arquitetura & Decisões Técnicas

O projeto adota uma arquitetura descentralizada para garantir performance e segurança:

1. **Frontend (Next.js):** Camada de apresentação reativa, otimizada para SEO e interações de baixa latência no Kanban.
2. **Backend Serverless (Edge Functions):** Lógicas pesadas e integrações com APIs externas (OpenAI) ocorrem em funções de borda, reduzindo o tempo de resposta global.
3. **Database Layer (Postgres):** O banco atua como guardião da integridade via Triggers, RPCs e RLS.

### Multi-tenancy & Segurança
O isolamento entre empresas (Workspaces) é garantido nativamente no banco de dados.
- Cada tabela possui uma coluna `workspace_id`.
- Usuários só podem acessar dados onde possuem um vínculo na tabela `workspace_users`.
- Cada usuário cria seu workspace e é adicionado como `admin`. O sistema adota um modelo de permissões binário: `admin` (gestão total) e `member` (operação).
- **Desafio Resolvido (Recursão em RLS):** Policies que faziam `SELECT` em `workspace_users` causavam loop infinito. A solução foi criar funções `SECURITY DEFINER` (`can_access_workspace()`) que bypassam o RLS internamente para validação segura. Isso impede ataques IDOR.

### Modelagem de Campos Customizados (EAV Relacional)
Em vez de usar colunas `JSONB` fixas, o sistema utiliza um modelo relacional flexível:
- `workspace_custom_fields`: Define o esquema de dados do cliente (text, number, select).
- `lead_custom_field_values`: Armazena os valores (relação N:N), garantindo flexibilidade sem alterar o schema base e permitindo validações por etapa do funil.

### Integração com LLM (OpenAI)
- A Edge Function `generate-message` recebe `lead_id` e `campaign_id`, carrega os dados (incluindo custom fields via join) e monta um prompt estruturado.
- **Segurança:** Respostas em JSON estrito com sanitização e proteção contra injeção de prompt.
- **Cache Inteligente:** Utiliza `prompt_hash` (SHA-256). Se os dados do lead e campanha não mudaram, retorna a geração anterior, poupando tokens. Possui suporte a retry com timeout e rate limiting.
- As mensagens geradas são persistidas na tabela `messages` com metadados (modelo, latência, estilo).

---

## 🎯 Funcionalidades Implementadas (Checklist)

### ✅ Requisitos Obrigatórios
- [x] **Cadastro e Login:** Gestão de usuários com Supabase Auth.
- [x] **Gestão de Leads (CRUD):** Criação, edição, exclusão, visualização detalhada e atribuição de responsável.
- [x] **Funil Kanban:** Pipeline com drag-and-drop e 7 etapas padronizadas:
    1. Base | 2. Lead Mapeado | 3. Tentando Contato | 4. Conexão Iniciada | 5. Desqualificado | 6. Qualificado | 7. Reunião Agendada.
- [x] **Gestão de Campanhas:** Definição de nome, contexto e prompt base.
- [x] **Geração de Mensagens IA:** Criação de 3 variações (Direta, Consultiva, Criativa).
- [x] **Ação de Envio Simulada:** Transação que marca a mensagem como enviada, move o lead para "Tentando Contato" e registra no histórico.
- [x] **Isolamento de Workspaces (RLS):** Criação de workspace com seed automático e isolamento total.
- [x] **Campos Customizados:** Suporte configurável por workspace.
- [x] **Dashboard:** Métricas gerais (leads por etapa, totais).

### ✨ Diferenciais (Hardening & UX)
- [x] **Regras de Transição:** O `required_fields` na tabela `stages` bloqueia a movimentação no Kanban caso faltem dados obrigatórios (padrão ou customizados) na etapa destino.
- [x] **Timeline de Eventos:** Registro histórico detalhado das interações com o lead.
- [x] **Automação de Gatilho:** Implementação de `auto_campaign_id` via trigger/webhook que dispara a Edge Function gerando IA automaticamente ao entrar no estágio.
- [x] **Multi-workspace:** Usuário pode participar/alternar entre vários workspaces.
- [x] **Cache IA:** Sistema de hash para evitar requisições redundantes.

---

## 🔒 Painel Administrativo (Workspace)

- **URL (local):** `http://localhost:3000/admin`
- **Quem acessa:** Usuários com papel `admin` no workspace selecionado.
- **Regras de Atribuição:** 
    - O primeiro usuário de um workspace vira `admin` automaticamente.
    - Usuários adicionados ou convidados posteriormente vira `member` por padrão.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Supabase CLI (opcional para rodar local completo)
- Conta no OpenAI (API Key)

### 1) Clonar o Repositório
```bash
git clone https://github.com/Andrey-Bertoletti/processflow-app.git
cd processflow-app
```

### 2) Instalar Dependências
```bash
# dependências do frontend
cd frontend
npm install
cd ..
```

### 3) Configuração de Ambiente (sem secrets no Git)

**Frontend (Vercel / Next.js):**
- Copie `frontend/.env.example` → `frontend/.env.local`
- Configure apenas as variáveis públicas (seguras para o browser):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Edge Functions (Supabase):**
- As variáveis de backend devem ser configuradas via Supabase CLI (`supabase secrets set`) ou no Painel do Supabase:
- **Server-only (Secrets):**
  - `PROJECT_URL`: URL base do projeto Supabase.
  - `SERVICE_ROLE_KEY`: Chave de serviço para operações administrativas.
  - `OPENAI_API_KEY`: Chave da API para inteligência artificial.
  - `WEBHOOK_SECRET`: Segredo de validação para gatilhos (se configurado).

> [!IMPORTANT]
> `OPENAI_API_KEY` e `SERVICE_ROLE_KEY` são segredos críticos. **Nunca** os inclua no frontend ou em variáveis prefixadas com `NEXT_PUBLIC_`.

### 4) Banco de Dados & Supabase Local
```bash
# inicia o stack local (Docker) + aplica migrations
npm run supabase:start
```

### 5) Rodar Edge Functions e Frontend
```bash
# Edge Functions
npm run back

# Frontend
npm run front
```

---

## 📁 Estrutura do Projeto

```text
processflow-app/
├── frontend/                 # Next.js 14 App
│   ├── src/app/              # Rotas e páginas
│   ├── src/components/       # Componentes React
│   ├── src/lib/              # Utilitários e clients
│   └── src/types/            # TypeScript types
├── backend/                  # Backend (Supabase CLI + Edge Functions)
│   └── supabase/
│       ├── functions/        # Edge Functions (IA, workers)
│       └── migrations/       # mirror gerado via sync (não editar direto)
├── database/                 # Banco (fonte da verdade)
│   ├── migrations/           # migrations SQL (source of truth)
│   ├── seed.sql              # seed opcional
│   └── schema.sql            # snapshot opcional
└── contexto.md               # Contexto técnico para continuidade
```

---

## 🔐 Segurança & Build de Produção

- **Secrets:** Nunca comite arquivos `.env` reais. Use o Painel da Vercel para gerenciar variáveis de produção de forma segura.
- **Rotação:** Se alguma chave já foi exposta/commitada em algum momento, faça rotação imediata no Supabase e no provedor da LLM (OpenAI).

---

## 👤 Autor

Desenvolvido por **Andrey Bertoletti**.  
Especialista em soluções escaláveis com foco em experiência do usuário e IA.
