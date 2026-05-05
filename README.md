# ProcessFlow AI - Inteligência Operacional para Vendas

ProcessFlow é um ecossistema de CRM inteligente projetado para equipes de Pré-Vendas (SDR) escalar operações através de automação orientada a eventos e inteligência artificial generativa[cite: 2]. Construído sobre uma arquitetura multi-tenant robusta, o sistema transforma o funil de vendas tradicional em um motor de decisão proativo com geração de abordagens personalizadas[cite: 2].

---

## 🔗 Links Importantes

*   **Aplicação em Produção (Deploy):** [INSERIR LINK DO DEPLOY AQUI][cite: 2]
*   **Apresentação em Vídeo (Overview Técnico):** [INSERIR LINK DO VÍDEO AQUI][cite: 2]
*   **Repositório Github:** [INSERIR LINK DO REPOSITÓRIO AQUI][cite: 2]

---

## 📑 Índice

1. [Visão Geral e Contexto de Negócio](#1-visão-geral-e-contexto-de-negócio)
2. [Arquitetura do Sistema e Decisões Técnicas](#2-arquitetura-do-sistema-e-decisões-técnicas)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Modelagem de Dados e Multi-tenancy](#4-modelagem-de-dados-e-multi-tenancy)
5. [Motor de IA e Automação (Edge Functions)](#5-motor-de-ia-e-automação)
6. [Funcionalidades e Checklist de Requisitos](#6-funcionalidades-e-checklist-de-requisitos)
7. [Estrutura de Diretórios](#7-estrutura-de-diretórios)
8. [Como Rodar Localmente (Nativamente no Windows)](#8-como-rodar-localmente)
9. [Variáveis de Ambiente](#9-variáveis-de-ambiente)
10. [Estratégia de Testes](#10-estratégia-de-testes)
11. [Próximos Passos e Roadmap](#11-próximos-passos-e-roadmap)

---

## 1. Visão Geral e Contexto de Negócio

Equipes de SDR (Sales Development Representatives) enfrentam um dilema constante: **Volume vs. Personalização**[cite: 2]. Ferramentas tradicionais forçam a escolha entre enviar milhares de emails genéricos com baixa conversão ou gastar horas pesquisando leads para enviar poucas mensagens altamente personalizadas[cite: 2].

O **ProcessFlow** resolve esse problema integrando LLMs diretamente ao pipeline de vendas[cite: 2]. O sistema permite organizar leads em um funil Kanban customizável e utilizar o contexto de campanhas específicas (como Black Friday, Lançamentos, etc.) para gerar mensagens únicas por lead[cite: 2].

### O Fluxo de Valor
1. **Captura e Enriquecimento:** O lead entra no funil. Campos personalizados (ex: Segmento, Faturamento, Quantidade de Produtos) são preenchidos[cite: 2].
2. **Validação de Etapa:** O lead só avança se cumprir os requisitos de dados daquela etapa[cite: 2].
3. **Geração Contextual:** A IA lê o perfil do lead e o contexto da campanha para redigir abordagens consultivas[cite: 2].
4. **Automação por Gatilho:** Se configurado, o sistema detecta a mudança de etapa e gera as mensagens em background (assíncrono)[cite: 2].

---

## 2. Arquitetura do Sistema e Decisões Técnicas

A arquitetura foi projetada para alta concorrência e isolamento absoluto de dados.

### Arquitetura em 3 camadas
*   **Frontend:** `frontend/` (Next.js + UI)
*   **Backend:** `backend/supabase/functions/` (Supabase Edge Functions)
*   **Database:** `database/migrations/` (PostgreSQL/Supabase)

### Isolamento Físico de Dados (Row Level Security - RLS)
Em vez de depender exclusivamente da lógica da aplicação (`WHERE workspace_id = X`), a segurança é garantida na camada do banco de dados[cite: 2]. O Supabase Auth injeta o JWT na sessão do Postgres, e as políticas RLS garantem que cada query seja intrinsecamente filtrada para o tenant correspondente, prevenindo vazamentos[cite: 2].

### Automação Orientada a Eventos (CQRS & Job Queue)
A geração de mensagens via LLM é um processo custoso e sujeito a latência[cite: 2]. Para evitar timeouts na interface:
*   Utilizamos o padrão **Listen/Notify** do PostgreSQL para detectar mudanças no estado do Lead[cite: 1, 2].
*   Eventos são enfileirados em uma tabela de `job_queue`[cite: 1].
*   Edge Functions assíncronas processam a fila, chamam a OpenAI, e atualizam o lead com o status das mensagens[cite: 1, 2].
*   Padrões de reconexão (*Exponential Backoff*) garantem resiliência caso a API da OpenAI falhe.

### Metadados Dinâmicos (Modelagem Relacional)
Campos personalizados agora são modelados em duas tabelas: `workspace_custom_fields` define o catálogo por workspace e `lead_custom_field_values` armazena os valores por lead. A coluna `metadata` do lead continua como espelho compatível para prompts e migração incremental, mas o valor canônico passa a ser relacional.

---

## 3. Stack Tecnológica

### Frontend
*   **Next.js 16 (App Router):** Renderização híbrida (SSR/SSG) para SEO e performance[cite: 1, 2].
*   **Tailwind CSS:** Estilização utilitária com design system (Glassmorphism e Dark Mode)[cite: 2].
*   **Componentes UI:** Interface construída com primitivas acessíveis (ex: `LeadCreateDrawer.tsx`, `LeadDetailsDrawer.tsx`, `KanbanBoard.tsx`)[cite: 1, 2].

### Backend & Infraestrutura (Supabase)
*   **PostgreSQL:** Banco de dados relacional com extensões ativas[cite: 2].
*   **Supabase Auth:** Autenticação JWT integrada nativamente ao RLS[cite: 2].
*   **Edge Functions (Deno/TypeScript):** Execução de código serverless distribuído globalmente para integrações externas[cite: 1, 2].

### Engine de Inteligência Artificial
*   **OpenAI API (GPT-4o-mini):** Selecionado pelo equilíbrio entre custo, latência e qualidade de raciocínio[cite: 2].
*   **Prompts Dinâmicos:** Injeção de templates baseados no perfil do lead e nas restrições da campanha[cite: 2].

### Qualidade e Testes
*   **Vitest:** Para testes unitários e de integração (`leads.test.ts`, `pipeline.integration.test.ts`)[cite: 1].
*   **Playwright:** Para testes E2E (configuração presente em `playwright.config.ts`)[cite: 1].

---

## 4. Modelagem de Dados e Multi-tenancy

O esquema do banco de dados (gerenciado pelas migrations em `database/migrations/`) reflete as necessidades de um SaaS B2B moderno[cite: 1, 2].

### Tabelas Principais

1.  **`workspaces`**[cite: 2]
    *   `id` (UUID, PK)
    *   `name` (Varchar)
    *   Relaciona-se com `workspace_custom_fields` para definir campos dinâmicos por tenant.

2.  **`users`**[cite: 2]
    *   Gerenciado pelo Supabase Auth, vinculado à tabela pública de perfis.
    *   Mapeamento N:M com `workspaces` (suporte a múltiplos workspaces).

3.  **`leads`**[cite: 2]
    *   `id` (UUID, PK)
    *   `workspace_id` (UUID, FK)
    *   `name`, `email`, `phone`, `company`, `role`, `source`, `notes` (Campos padrão).
    *   `metadata` (JSONB) - Espelho compatível dos valores personalizados preenchidos no lead.
    *   `stage_id` (UUID, FK) - Relacionamento com o funil.
    *   `assigned_to` (UUID, FK) - Responsável pelo lead.

4.  **`workspace_custom_fields`**
    *   `id` (UUID, PK)
    *   `workspace_id` (UUID, FK)
    *   `name`, `key`, `field_type`
    *   `required` (Boolean) - Marca o campo como obrigatório no workspace.
    *   `options` (JSONB) - Opções quando o tipo é seleção.
    *   `is_active` (Boolean) - Permite desativar sem apagar histórico.

5.  **`lead_custom_field_values`**
    *   `id` (UUID, PK)
    *   `lead_id` (UUID, FK)
    *   `custom_field_id` (UUID, FK)
    *   `value` (JSONB)
    *   `created_at` / `updated_at`

6.  **`pipeline_stages`**[cite: 2]
    *   `id` (UUID, PK)
    *   `name` (Varchar) - Ex: Base, Lead Mapeado, Tentando Contato.
    *   `order` (Integer) - Ordenação no Kanban.
    *   `required_fields` (JSONB) - Regras de campos obrigatórios base ou customizados[cite: 1].

7.  **`campaigns`**[cite: 2]
    *   `id` (UUID, PK)
    *   `name` (Varchar)
    *   `context` (Text) - Produto, oferta, tom de voz.
    *   `trigger_stage_id` (UUID, FK, Nullable) - Gatilho para automação.

8.  **`lead_events` (Timeline)**[cite: 1, 2]
    *   `id` (UUID, PK)
    *   `lead_id` (UUID, FK)
    *   `event_type` (Varchar) - (Ex: 'STAGE_CHANGED', 'MESSAGE_GENERATED').

---

## 5. Motor de IA e Automação

A inteligência do ProcessFlow não reside apenas na interface, mas nos *workers* assíncronos implementados em Deno[cite: 1, 2].

### Edge Functions Implementadas

*   **`api-generate-message`**[cite: 1]
    *   **Responsabilidade:** Recebe `lead_id` e `campaign_id`, busca os dados no Postgres e chama a OpenAI para gerar variações de abordagem.
    *   **Retorno:** Retorna até 3 variações de mensagem para o frontend.

*   **`ai-worker` / `ai-insights-engine`**[cite: 1]
    *   **Responsabilidade:** Consome a fila do banco de dados (Job Queue). Quando um lead entra em uma "Etapa Gatilho", o trigger do Postgres insere um evento na fila. Este worker captura o evento e invoca a geração de mensagens em lote, permitindo o escalonamento horizontal.

*   **`projection-worker`**[cite: 1]
    *   **Responsabilidade:** Mantém tabelas de leitura (Read Models) atualizadas para o Control Plane (CQRS), agregando métricas de saúde e consumo de tokens em tempo real.

---

## 6. Funcionalidades e Checklist de Requisitos

Abaixo, o detalhamento da entrega de acordo com as especificações da Prova Técnica[cite: 2].

### ✅ Requisitos Obrigatórios Entregues

- [x] **Autenticação e Workspaces:** Fluxos de `login`, `register` e `dashboard` implementados com Supabase Auth[cite: 1, 2].
- [x] **Gestão de Leads:** Cadastro completo com suporte a campos padrão e campos personalizados por workspace, com persistência relacional e espelho compatível para IA. Possibilidade de designar um `assigned_to`[cite: 1, 2].
- [x] **Funil de Pré-Vendas (Kanban):** Componente `KanbanBoard.tsx` implementado com Drag & Drop[cite: 1, 2].
- [x] **Regras de Transição:** O componente `StageValidationModal.tsx` intercepta a movimentação se o lead não possuir os campos obrigatórios configurados na etapa destino[cite: 1, 2].
- [x] **Criação de Campanhas:** Tela dedicada (`CampaignForm.tsx`) para estruturar contexto, prompt e tom de voz[cite: 1, 2].
- [x] **Geração de Mensagens com IA:** Integração real gerando variações adaptativas diretamente na visualização do Lead (`LeadDetailsDrawer.tsx`)[cite: 1, 2].
- [x] **Ação de Envio (Simulada):** Ao selecionar uma mensagem, o lead é automaticamente transicionado para a etapa "Tentando Contato"[cite: 2].
- [x] **Dashboard:** Métricas na raiz do app com sumarização de leads por etapa[cite: 2].

### 🌟 Requisitos Diferenciais Entregues

- [x] **Geração Automática por Gatilho (Destaque):** O sistema detecta quando um lead entra em uma etapa mapeada como gatilho de campanha e enfileira a geração via `ai-worker`[cite: 1, 2].
- [x] **Histórico de Atividades (Timeline):** O componente `LeadTimeline.tsx` exibe o log completo de movimentações e ações[cite: 1, 2].
- [x] **Painel de Controle (Observability):** Visão administrativa (`/admin/system-health` e `/admin/control-plane`) para monitorar o consumo de tokens e falhas na fila[cite: 1, 2].
- [x] **Job Queue Resiliente:** Infraestrutura de mensageria construída dentro do PostgreSQL garantindo tolerância a falhas na comunicação com APIs externas[cite: 1, 2].

---

## 7. Estrutura de Diretórios

Organização modular focada na separação de responsabilidades (Clean Architecture e App Router)[cite: 1]:

```text
processflow-app/
├── frontend/
│   ├── public/                     # Assets e ícones estáticos
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/              # Control Plane e System Health
│   │   │   ├── api/                # Rotas de API Next.js (Proxies para segurança)
│   │   │   ├── auth/               # Fluxos de Login, Registro e Workspace
│   │   │   ├── campaigns/          # Gestão de Campanhas
│   │   │   ├── pipeline/           # View principal do Kanban
│   │   │   ├── context/            # AuthContext (Gerenciamento de Estado)
│   │   │   └── globals.css         # Configurações do Tailwind
│   │   ├── components/
│   │   │   ├── auth/               # Formulários de autenticação
│   │   │   ├── campaign/           # Componentes de configuração de prompt
│   │   │   ├── pipeline/           # KanbanBoard, LeadCard, Drawers, Validations
│   │   │   └── ui/                 # Design System (Buttons, Surfaces, Fields)
│   │   ├── lib/
│   │   │   ├── ai/                 # Integrações e formatações de chamadas de LLM
│   │   │   ├── supabase/           # Clients SSR e CSR do Supabase
│   │   │   └── pipeline-utils.ts   # Lógica de negócios do board e validações
│   │   └── test/                   # Configuração global de testes
│   ├── vitest.config.ts            # Configuração de Testes Unitários
│   └── playwright.config.ts        # Configuração de Testes E2E
├── backend/
│   ├── supabase/                   # Supabase CLI + Edge Functions (Deno)
│   │   ├── functions/
│   │   │   ├── api-generate-message/
│   │   │   ├── ai-worker/
│   │   │   ├── projection-worker/
│   │   │   └── ai-insights-engine/
│   │   └── config.toml
│   └── README.md
├── database/
│   ├── migrations/                 # Versionamento do Banco de Dados (SQL)
│   ├── seed.sql
│   ├── schema.sql                  # Snapshot opcional (gerável)
│   └── README.md
├── README.md
├── .env.example
└── .gitignore
```

---

## 8. Como Rodar Localmente

Para garantir o melhor desempenho e evitar limitações de rede no ambiente de desenvolvimento, recomendamos executar o projeto **nativamente no Windows**, utilizando o PowerShell ou CMD.

### Pré-requisitos
*   **Node.js** (versão 18 ou superior instalada nativamente no Windows)
*   **Git** para Windows
*   **Docker** (Opcional, necessário para `npm run supabase:start`)
*   **Supabase CLI** (Opcional, para rodar o banco localmente. Você pode utilizar um projeto hospedado no Supabase.com).

### Passo 1: Clonar e Instalar
Abra o seu terminal no Windows (PowerShell) e execute:

```powershell
# Clonar o repositório
git clone https://github.com/Andrey-Bertoletti/processflow-app.git
cd processflow-app

# Instalar dependências da raiz (se aplicável)
npm install

# Entrar na pasta do frontend e instalar as dependências
cd frontend
npm install
```

### Passo 2: Configuração de Banco de Dados (Supabase Remoto)
Crie um projeto gratuito no [Supabase](https://supabase.com/).
1.  Vá em Project Settings -> API e copie a URL e a Anon Key.
2.  Vá em Project Settings -> Database e copie a Connection String.
3.  Vá no SQL Editor do Supabase e rode os scripts localizados em `processflow-app/database/migrations/` em ordem cronológica para gerar as tabelas e políticas[cite: 1].

### Passo 3: Configuração de ambiente
Crie os arquivos locais de ambiente **a partir dos exemplos** (não commitáveis):

1) Frontend (Next.js):
- Copie `frontend/.env.example` → `frontend/.env.local`
- Preencha com seus valores reais.

2) Backend / Edge Functions / Scripts (opcional para desenvolvimento local):
- Copie `.env.example` → `.env` (ou use `backend/supabase/functions/.env` para servir functions localmente via Supabase CLI)
- Preencha com seus valores reais (principalmente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `OPENAI_API_KEY`).

```env
# frontend/.env.local (exemplo)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-only (NÃO use NEXT_PUBLIC_ para secrets) (opcional)
WEBHOOK_SECRET=your-webhook-secret
```

### Passo 4: Iniciar a Aplicação
Você pode iniciar cada camada de forma independente:

**Frontend (Next.js):**

```powershell
npm run front
# ou: cd frontend && npm run dev
```

**Supabase local (Database/API/Studio) (opcional):**

```powershell
npm run supabase:start
# (se precisar reaplicar tudo) npm run banco:reset
```

Se você quiser usar o CLI diretamente, rode os comandos dentro de `backend/supabase`.
Na raiz do repositório, prefira `npm run banco` ou `npm run supabase:push` em vez de `npx supabase db push`.

**Edge Functions (opcional, local):**

```powershell
npm run back
```
Acesse `http://localhost:3000` no seu navegador. O sistema está pronto para uso nativo.

---

## 9. Variáveis de Ambiente Detalhadas

As variáveis de ambiente são divididas entre as necessárias para o **Frontend (Next.js)** e as necessárias para as **Edge Functions (Backend)**.

### Frontend (`frontend/.env.local`)
| Variável | Descrição | Obrigatório |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de conexão REST do projeto Supabase. Usada pelos clients SSR/CSR. | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anônima. Utilizada para chamadas autenticadas via RLS. | Sim |
| `WEBHOOK_SECRET` | Secret server-only para proxyar chamadas admin a Edge Functions protegidas (nunca expor no browser). | Se usar Control Plane |

### Edge Functions (Supabase Secrets)
Para configurar as variáveis de backend no Supabase, utilize a dashboard (Edge Functions -> Secrets) ou a CLI (`supabase secrets set NOME=valor`).

| Variável | Descrição | Obrigatório |
| :--- | :--- | :--- |
| `SUPABASE_URL` | URL do projeto Supabase usada pelos workers/Edge Functions e scripts. | Sim |
| `SUPABASE_ANON_KEY` | Chave `anon` usada para aplicar RLS em funções invocadas pelo usuário (ex.: `generate-message`, `semantic-analysis`). | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa utilizada pelos workers (`ai-worker`, `projection-worker`) para bypass de RLS durante o processamento em background. | Sim |
| `WEBHOOK_SECRET` | Chave criptográfica usada para validar as chamadas entre os triggers do DB e as funções serverless. | Sim |
| `OPENAI_API_KEY` | Chave de autenticação da OpenAI para acesso ao modelo. | Se usar IA |

---

## Segurança: rotação de chaves
Se qualquer key/secret (OpenAI, Supabase anon/service_role, webhook secret, etc.) **já foi commitada e enviada para um remoto**, assuma comprometimento e:
1) Rotacione/revogue imediatamente no provedor.
2) Remova do histórico do git (ex.: `git filter-repo`/BFG) se o repositório foi publicado.
3) Substitua os valores em todos os ambientes (local, CI, hosting, Supabase Secrets).

## 10. Estratégia de Testes

O projeto foi construído com resiliência em mente, implementando duas camadas de testes automatizados configuradas no diretório `frontend/`[cite: 1].

### Testes Unitários e de Integração (Vitest)
Utilizamos o **Vitest** devido à sua rapidez e compatibilidade nativa com ecossistemas modernos (ESM e TypeScript)[cite: 1].
*   Os testes cobrem as regras de negócio puras, localizadas na pasta `lib/`[cite: 1].
*   Exemplos: `leads.test.ts`, `pipeline-utils.test.ts` e `pipeline.integration.test.ts`[cite: 1].
*   Os testes validam funções de ordenação do Kanban, checagem de regras de transição e formatação de payloads da IA.
*   **Comando:** `npm run test` (dentro da pasta frontend).

### Testes End-to-End (Playwright)
O arquivo `playwright.config.ts` estabelece as diretrizes para testes de aceitação simulando o navegador real[cite: 1].
*   Ideal para validar o fluxo crítico: Cadastro -> Criação de Lead -> Seleção de Campanha -> Geração de Mensagem.

---

## 11. Decisões Técnicas e Trade-offs

Durante o desenvolvimento deste mini CRM, algumas decisões arquiteturais exigiram escolhas ponderadas:

**1. RLS (Row Level Security) vs Filtros no App**
*   *Decisão:* Optamos por usar RLS nativo do Postgres em 100% das tabelas[cite: 2].
*   *Trade-off:* Isso adiciona complexidade no desenvolvimento inicial (escrever políticas SQL precisas) e ao usar funções serverless (necessidade de injetar o cabeçalho de auth manualmente ou usar Service Role com cautela). No entanto, o ganho em segurança é inestimável, pois torna matematicamente impossível um cliente buscar dados de outro workspace através das APIs REST autogeradas pelo Supabase[cite: 2].

**2. Geração Assíncrona via Job Queue vs Chamada Síncrona via API**
*   *Decisão:* O requisito diferencial de "Geração Automática" foi implementado através de uma fila em banco (Job Queue) e processamento em background (Listen/Notify)[cite: 1, 2].
*   *Trade-off:* O fluxo de UX precisa ser adaptado (o usuário vê um estado de "Gerando..." ou recebe a mensagem depois). Em contrapartida, isso blinda o frontend contra timeouts longos da API da OpenAI, melhora a experiência e permite escalar o processamento horizontalmente se houver picos de uso[cite: 2].

**3. Supabase Edge Functions vs Next.js API Routes**
*   *Decisão:* Embora o Next.js (App Router) possua as *Route Handlers*, decidimos alocar a lógica pesada de IA e processamento de filas nas *Edge Functions* do Supabase (`api-generate-message`, `ai-worker`)[cite: 1, 2].
*   *Trade-off:* Centraliza a lógica de backend mais perto do banco de dados (reduzindo latência) e permite que a arquitetura seja agnóstica de frontend. Caso no futuro exista um app Mobile, as funções de backend já estarão centralizadas na infraestrutura de dados.

---
**Desenvolvido por Andrey Bertoletti**  
*Candidato a Desenvolvedor Vibe Coding Full Stack.*
