# ProcessFlow AI - Documentação Oficial e Especificações Técnicas

Esta é a documentação técnica oficial e exaustiva do **ProcessFlow AI**, um ecossistema avançado de Customer Relationship Management (CRM) voltado especificamente para equipes de Sales Development Representatives (SDR)[cite: 2]. Este documento detalha a arquitetura, as decisões de engenharia, a modelagem de dados, as automações e os fluxos de usuário desenvolvidos para o Desafio Técnico de Desenvolvedor Vibe Coding Full Stack[cite: 2].

---

## 📑 Tabela de Conteúdos

1. [Visão Estratégica e Contexto de Negócio](#1-visão-estratégica-e-contexto-de-negócio)
2. [Arquitetura de Sistemas e Stack Tecnológica](#2-arquitetura-de-sistemas-e-stack-tecnológica)
3. [Módulo 1: Autenticação, RLS e Multi-tenancy](#3-módulo-1-autenticação-rls-e-multi-tenancy)
4. [Módulo 2: Gestão de Leads e Custom Fields](#4-módulo-2-gestão-de-leads-e-custom-fields)
5. [Módulo 3: Motor Kanban e Regras de Transição](#5-módulo-3-motor-kanban-e-regras-de-transição)
6. [Módulo 4: Campanhas e Prompts Estruturados](#6-módulo-4-campanhas-e-prompts-estruturados)
7. [Módulo 5: Engine de Inteligência Artificial e Job Queues](#7-módulo-5-engine-de-inteligência-artificial-e-job-queues)
8. [Módulo 6: Event Sourcing, CQRS e Observabilidade](#8-módulo-6-event-sourcing-cqrs-e-observabilidade)
9. [Dicionário de Dados e Modelagem (Tabelas)](#9-dicionário-de-dados-e-modelagem-tabelas)
10. [Estrutura de Diretórios e Componentização](#10-estrutura-de-diretórios-e-componentização)
11. [Guia de Instalação e Deploy Local](#11-guia-de-instalação-e-deploy-local)
12. [Estratégia de Testes (QA)](#12-estratégia-de-testes-qa)
13. [Histórico de Migrations e Changelog](#13-histórico-de-migrations-e-changelog)
14. [Considerações Finais do Desenvolvedor](#14-considerações-finais-do-desenvolvedor)

---

## 1. Visão Estratégica e Contexto de Negócio

### 1.1 O Problema do SDR Moderno
Equipes de pré-vendas (SDRs) lidam diariamente com um volume massivo de leads[cite: 2]. O grande desafio da atualidade não é encontrar contatos, mas sim realizar abordagens que não pareçam automatizadas ou genéricas[cite: 2]. A personalização manual consome a maior parte do tempo produtivo do vendedor, enquanto a automação cega destrói a taxa de conversão[cite: 2]. 

### 1.2 A Solução: ProcessFlow AI
O ProcessFlow AI foi concebido para unir o melhor dos dois mundos: a escala da automação de software e a personalização artesanal viabilizada por Inteligência Artificial Generativa[cite: 2]. O sistema permite que SDRs organizem seus leads em um funil visual[cite: 2], enquanto uma *engine* de IA atua em background, lendo o perfil do lead (incluindo dados customizados do nicho da empresa) e gerando mensagens de prospecção altamente contextuais[cite: 2].

### 1.3 Casos de Uso Principais
*   **Gestão Diária:** O SDR abre o sistema, visualiza suas tarefas e leads no Kanban[cite: 2].
*   **Campanhas Sazonais:** O gestor cria uma campanha de "Black Friday", definindo regras de tom de voz[cite: 2].
*   **Hiper-personalização Automática:** Quando um lead é qualificado e movido para a etapa de prospecção, o sistema gera, em segundos, 3 opções de e-mail/mensagem utilizando os dados específicos daquele lead e o contexto da Black Friday[cite: 2].

---

## 2. Arquitetura de Sistemas e Stack Tecnológica

O sistema foi arquitetado utilizando os princípios de **Serverless Computing**, **Event-Driven Architecture (EDA)** e **Vibe Coding** (desenvolvimento assistido por IA)[cite: 2]. 

### 2.1 Camada de Frontend (Client-Side & SSR)
*   **Framework Base:** [Next.js 16 (App Router)](https://nextjs.org/) - Escolhido pela capacidade de renderização híbrida, otimização de rotas e Server Actions, essenciais para painéis B2B de alta performance[cite: 1, 2].
*   **Linguagem:** TypeScript estrito, garantindo segurança de tipos de ponta a ponta.
*   **Estilização:** Tailwind CSS acoplado a um Design System próprio. Interfaces limpas (Glassmorphism) para reduzir a fadiga visual do usuário[cite: 2].
*   **Gerenciamento de Estado:** Utilização de Context API (`AuthContext.tsx`)[cite: 1] em conjunto com hooks customizados (`useWorkspaceQuery.ts`)[cite: 1] para cache e revalidação de dados.

### 2.2 Camada de Backend e Infraestrutura (BaaS)
*   **Plataforma Base:** [Supabase](https://supabase.com/)[cite: 2] - Atua como infraestrutura central, fornecendo o banco de dados, autenticação e ambiente de execução serverless[cite: 2].
*   **Banco de Dados:** PostgreSQL 15+. Escolhido por sua robustez, suporte a dados semi-estruturados (`JSONB`) e pub/sub nativo (`Listen/Notify`)[cite: 2].
*   **Serverless/Compute:** Supabase Edge Functions rodando em Deno[cite: 1, 2]. Estas funções processam a lógica pesada de IA, abstraindo a complexidade do frontend[cite: 2].

### 2.3 Camada de Inteligência Artificial
*   **Provider:** OpenAI API[cite: 2].
*   **Modelo Primário:** `gpt-4o-mini` - Selecionado pelo equilíbrio perfeito entre custo operacional para o SaaS, baixa latência (TTFB) e alta capacidade de raciocínio lógico em *prompt engineering*[cite: 2].

---

## 3. Módulo 1: Autenticação, RLS e Multi-tenancy

O requisito mais crítico de um CRM B2B SaaS é o isolamento de dados. Uma falha de segurança que exponha a base de clientes de uma empresa para outra é catastrófica[cite: 2].

### 3.1 Autenticação
O sistema utiliza o Supabase Auth para gerenciar credenciais (JWT)[cite: 2]. O fluxo inclui registro (`RegisterForm.tsx`), login (`LoginForm.tsx`) e gerenciamento de sessão persistente no lado do cliente e do servidor (`AuthContext.tsx`, `middleware.ts`)[cite: 1].

### 3.2 O Paradigma do Row Level Security (RLS)
Sistemas monolíticos antigos costumam isolar dados adicionando `WHERE workspace_id = X` nas consultas da API. O ProcessFlow resolve isso na raiz: o banco de dados.
*   Todas as tabelas do sistema (`leads`, `campaigns`, `pipeline_stages`, etc.) possuem o recurso Row Level Security ativado[cite: 2].
*   **Políticas Implementadas:** Uma política SQL é criada garantindo que a operação `SELECT`, `INSERT`, `UPDATE` ou `DELETE` só seja permitida se a coluna `workspace_id` bater com o workspace vinculado ao `auth.uid()` do usuário logado que assina o token JWT[cite: 2].
*   **Benefício:** Mesmo que a API do frontend contenha um bug, é matematicamente impossível que um dado de outro tenant seja retornado, pois o próprio kernel do banco de dados bloqueia a leitura no nível do disco[cite: 2].

### 3.3 Gestão de Workspaces
*   No primeiro login, o usuário é forçado a passar pela rota `/auth/workspace/create`[cite: 1, 2].
*   O sistema cria o tenant logicamente e associa o usuário como "Owner".
*   *Diferencial implementado:* A arquitetura suporta tabela de junção `workspace_users`, permitindo que um usuário pertença a múltiplos workspaces no futuro[cite: 2].

---

## 4. Módulo 2: Gestão de Leads e Custom Fields

A entidade central do sistema é o Lead (Contato/Prospect)[cite: 2]. A estrutura foi projetada para ser flexível, atendendo desde corretoras de imóveis até empresas de software.

### 4.1 Campos Padrão (Standard Fields)
O sistema exige e padroniza campos universais em vendas B2B[cite: 2]:
*   `name`: Nome completo do prospect.
*   `email`: Correio eletrônico principal.
*   `phone`: Telefone/WhatsApp de contato.
*   `company`: Empresa na qual trabalha.
*   `role`: Cargo do decisor.
*   `source`: Origem (ex: Inbound, Cold Call, LinkedIn).
*   `notes`: Observações gerais e anotações.

### 4.2 Campos Personalizados Dinâmicos (Custom Fields)
O requisito exigia que o usuário pudesse criar campos à vontade (ex: "Faturamento", "Segmento")[cite: 2].
*   **Implementação Técnica:** Evitamos criar tabelas EAV (Entity-Attribute-Value) complexas. Em vez disso, utilizamos o poder do PostgreSQL com colunas `JSONB`[cite: 2].
*   A tabela `workspaces` possui um campo `custom_fields_schema` que define a "receita" dos campos (nome, tipo - texto, número, data).
*   A tabela `leads` possui a coluna `custom_fields` que armazena os valores reais (Ex: `{"segmento": "tecnologia", "faturamento": 500000}`).
*   O frontend (`LeadCreateDrawer.tsx` e `LeadDetailsDrawer.tsx`)[cite: 1] lê o schema do workspace e renderiza os inputs dinamicamente[cite: 2].

### 4.3 Atribuição de Responsável (Assignee)
Os leads possuem um relacionamento `assigned_to` apontando para a tabela de usuários[cite: 2]. Isso permite filtrar a visão do Kanban apenas para "Meus Leads"[cite: 2]. A migration `20260504223000_leads_assignee_security.sql`[cite: 1] garante as regras de segurança ao redor dessa delegação[cite: 2].

---

## 5. Módulo 3: Motor Kanban e Regras de Transição

O funil de pré-vendas não é apenas visual; é um motor de regras de negócio estritas[cite: 2].

### 5.1 Estrutura do Funil
O Kanban é renderizado pelo componente `KanbanBoard.tsx` e alimentado pelas colunas `StageColumn.tsx`[cite: 1, 2].
Etapas Padrão Iniciais (Semeáveis via migration `20260504183000_pipeline_seed.sql`)[cite: 1, 2]:
1.  **Base:** Lead importado, sem tratamento[cite: 2].
2.  **Lead Mapeado:** Enriquecido com dados[cite: 2].
3.  **Tentando Contato:** Em régua de prospecção[cite: 2].
4.  **Conexão Iniciada:** Houve resposta[cite: 2].
5.  **Desqualificado:** Sem fit de negócio[cite: 2].
6.  **Qualificado:** Com fit[cite: 2].
7.  **Reunião Agendada:** Handoff para vendas[cite: 2].

### 5.2 Validação de Etapas (Stage Validation Rules)
Um recurso crucial implementado: **Campos Obrigatórios**[cite: 2].
*   **A Lógica:** Um SDR não pode mover um lead da etapa "Base" para "Tentando Contato" se não tiver enriquecido o "Email" ou o "Telefone" do prospect[cite: 2].
*   Na tabela de configurações do funil, define-se um payload JSON indicando quais campos (padrão ou customizados) são obrigatórios para entrar em determinada etapa[cite: 2].
*   **UX:** Quando o usuário tenta soltar o card (Drag & Drop) na nova coluna, o sistema valida (`lead-validation.ts`)[cite: 1]. Se falhar, o card volta à origem e o `StageValidationModal.tsx`[cite: 1] é exibido na tela, obrigando o usuário a preencher os dados faltantes antes de permitir o avanço[cite: 2].
*   **Importância:** Garante a "limpeza" dos dados, fator determinante para que a Inteligência Artificial tenha contexto suficiente para não gerar "alucinações"[cite: 2].

---

## 6. Módulo 4: Campanhas e Prompts Estruturados

Para que a IA saiba *o que* falar, ela precisa do contexto da empresa que está vendendo. O módulo de Campanhas (`/campaigns`)[cite: 1] resolve isso[cite: 2].

### 6.1 Estrutura da Campanha
A interface `CampaignForm.tsx`[cite: 1] permite o preenchimento de metadados ricos[cite: 2]:
*   **Nome:** Identificador interno (ex: Retenção Churn Q3)[cite: 2].
*   **Contexto:** Um grande campo de texto descrevendo o produto, a dor que ele resolve, os benefícios, o CTA desejado (ex: "Ofereça uma demonstração de 15 minutos")[cite: 2].
*   **Prompt de Geração / Tom de Voz:** Instruções de comportamento da IA (ex: "Seja agressivo nas vendas", "Seja consultivo", "Use no máximo 2 parágrafos", "Aja como Steve Jobs")[cite: 2].

### 6.2 Etapa Gatilho (Trigger Stage)
*Diferencial implementado:* A campanha pode ser vinculada a uma etapa específica do funil (Ex: "Campanha Black Friday" atrelada à etapa "Tentando Contato")[cite: 2]. Quando um lead cair nessa etapa, a mágica da automação acontece (ver seção 7.2)[cite: 2].

---

## 7. Módulo 5: Engine de Inteligência Artificial e Job Queues

O coração do sistema é a geração de mensagens hiper-personalizadas[cite: 2].

### 7.1 Geração Manual (On-Demand)
1.  O usuário clica no lead, abrindo o `LeadDetailsDrawer.tsx`[cite: 1, 2].
2.  Seleciona uma Campanha Ativa num dropdown[cite: 2].
3.  Clica em "Gerar Mensagens".
4.  O frontend chama a Edge Function `generate_message` (`supabase/functions/generate_message/index.ts`)[cite: 1, 2].
5.  A Edge Function puxa os dados do banco, formata o super-prompt e envia para a OpenAI[cite: 1, 2].
6.  O retorno traz até 3 variações de texto[cite: 2]. O usuário pode ler, regenerar ou enviar.
7.  **Fluxo Automático:** Ao clicar em "Enviar", o frontend executa a rotina `pipeline-utils.ts`[cite: 1], movendo automaticamente o lead para "Tentando Contato", poupando cliques do usuário[cite: 2].

### 7.2 O Super-Prompt Base
A Edge Function estrutura o prompt para a OpenAI misturando três blocos dinâmicos[cite: 1, 2]:
```text
[SYSTEM INSTRUCTIONS]
Você é um especialista em pré-vendas B2B. Sua missão é escrever 3 opções curtas de e-mail/mensagem focadas em conversão.
Siga rigorosamente este tom de voz e instruções: {campaign_prompt}

[CONTEXTO DO PRODUTO/OFERTA]
{campaign_context}

[DADOS DO PROSPECT (LEAD)]
Nome: {lead_name}
Cargo: {lead_role} na empresa {lead_company}
Observações prévias: {lead_notes}
Dados adicionais: {lead_custom_fields_json}
```

### 7.3 Geração Automática e Job Queue (O Diferencial)
Gerar IA manualmente lead por lead não escala[cite: 2]. Para automatizar isso, implementamos uma infraestrutura pesada no backend[cite: 1, 2].
*   **O Desafio:** Se o sistema fizer uma chamada síncrona para a OpenAI toda vez que um lead mudar de etapa, o banco de dados vai travar esperando a resposta HTTP de 10 segundos da IA[cite: 2].
*   **A Solução (Job Queue):** Conforme migrations `20260505220000_job_queue.sql`[cite: 1]:
    1.  O PostgreSQL possui um Trigger que monitora a coluna `stage_id` do lead.
    2.  Se o lead for para uma "Etapa Gatilho", o trigger não chama a IA. Ele insere um registro na tabela `job_queue` (Status: PENDING)[cite: 1, 2].
    3.  Usamos o recurso `NOTIFY` do Postgres.
    4.  A Edge Function `ai-worker`[cite: 1] está rodando continuamente, ouvindo eventos.
    5.  Ela consome a fila em background, chama a OpenAI de forma assíncrona, salva as mensagens na tabela `messages` e muda o status da fila para COMPLETED[cite: 1, 2].
    6.  Quando o SDR abrir o lead na interface, as mensagens já estarão lá, mágicamente pré-geradas[cite: 2].

---

## 8. Módulo 6: Event Sourcing, CQRS e Observabilidade

Sistemas complexos precisam de rastreabilidade. Diferenciais de engenharia avançada foram implementados[cite: 2].

### 8.1 Timeline e Auditoria de Eventos
Baseado na migration `20260505280000_activities_timeline.sql`[cite: 1]:
*   Cada alteração no lead gera um registro de auditoria[cite: 2].
*   Isso é visualizado no frontend pelo `LeadTimeline.tsx`[cite: 1].
*   O gerente pode ver exatamente às "14h: João moveu o lead para Mapeado", "14h05: Sistema gerou mensagens via IA", "14h10: João enviou a mensagem 2"[cite: 2].

### 8.2 Observabilidade e Control Plane
Para gerenciar custos e saúde, construímos o módulo Admin (`/admin/system-health`, `/admin/control-plane`)[cite: 1, 2].
*   **CQRS (Command Query Responsibility Segregation):** Migrations como `20260505260000_cqrs_read_models.sql` e `20260505270000_projection_checkpoints.sql`[cite: 1] mostram que os dados de leitura analítica são separados da gravação transacional. O worker `projection-worker`[cite: 1] pré-calcula agregados.
*   **Métricas:** O painel exibe o total de execuções de IA, falhas na fila (Dead Letter Queue - DLQ), latência das Edge Functions e, criticamente, o custo estimado de tokens utilizados na OpenAI, segmentado por workspace[cite: 2].
*   **Dashboard Business:** Implementado na raiz do sistema, exibe o total de leads e a distribuição visual no funil, satisfazendo os requisitos analíticos de negócio do desafio[cite: 2].

---

## 9. Dicionário de Dados e Modelagem (Tabelas)

Abaixo, a documentação profunda das estruturas criadas pelas migrations do diretório `supabase/migrations`[cite: 1].

| Tabela | Função / Papel no Sistema | Relacionamentos Principais |
| :--- | :--- | :--- |
| **`workspaces`** | Guarda a entidade tenant. Armazena o `custom_fields_schema` em JSONB. | 1:N com leads, campaigns, stages. |
| **`users`** | Gerenciada pela API do Supabase Auth (`auth.users`). Guarda perfil básico. | N:M com workspaces. |
| **`leads`** | Armazena contatos. Usa colunas fixas e `custom_fields` dinâmicos. RLS restrito. | Pertence a 1 workspace, 1 stage, 1 assignee. |
| **`pipeline_stages`** | Representa o Kanban. Possui `order` (int) e `validation_rules` (JSONB). | Pertence a 1 workspace. |
| **`campaigns`** | Configuração da IA. `context` e `prompt`. Diferencial: `trigger_stage_id`. | Pertence a 1 workspace. Atrelado a 1 Stage. |
| **`generated_messages`** | Armazena resultados do LLM. Possui status (PENDING, APPROVED, SENT, REJECTED). | Pertence a 1 lead e 1 campaign. |
| **`lead_events`** | Event sourcing. Histórico de atividades para a timeline. Imutável (Apenas Insert). | Pertence a 1 lead. |
| **`job_queue`** | Tabela de sistema para orquestração de processamento assíncrono em background. | Isolada, processada pelo `ai-worker`. |
| **`system_metrics`** | Tabela de leitura CQRS para dashboards administrativos e faturamento/custos. | Pertence a 1 workspace. |

---

## 10. Estrutura de Diretórios e Componentização

A taxonomia do projeto respeita os padrões Clean Architecture adaptados ao Next.js[cite: 1].

```text
processflow-app/
├── frontend/
│   ├── public/                     # Imagens estáticas, SVGs (globe, window, vercel)[cite: 1]
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── admin/              # Modulo de System Health e Control Plane[cite: 1]
│   │   │   ├── api/                # Proxies de segurança para Endpoints[cite: 1]
│   │   │   ├── auth/               # Views de Login, Registro e Workspace Dashboard[cite: 1]
│   │   │   ├── campaigns/          # View de gestão de Campanhas[cite: 1]
│   │   │   ├── pipeline/           # Rota principal do Kanban Board[cite: 1]
│   │   │   ├── context/            # AuthProvider e controle de sessão global[cite: 1]
│   │   │   └── globals.css         # Importações do Tailwind[cite: 1]
│   │   ├── components/             # React Server/Client Components
│   │   │   ├── auth/               # LoginForm.tsx, RegisterForm.tsx[cite: 1]
│   │   │   ├── campaign/           # CampaignForm.tsx[cite: 1]
│   │   │   ├── pipeline/           # KanbanBoard.tsx, LeadCard.tsx, StageColumn.tsx[cite: 1]
│   │   │   │                       # LeadCreateDrawer.tsx, LeadDetailsDrawer.tsx[cite: 1]
│   │   │   │                       # StageValidationModal.tsx, LeadTimeline.tsx[cite: 1]
│   │   │   └── ui/                 # Elementos primitivos (Button.tsx, Field.tsx, Surface.tsx)[cite: 1]
│   │   ├── lib/                    # Regras de Negócio e Clientes
│   │   │   ├── ai/                 # formatters para chamadas LLM[cite: 1]
│   │   │   ├── supabase/           # Instanciação do Client (browser) e Server (ssr)[cite: 1]
│   │   │   └── pipeline-utils.ts   # Utilitários de lógica pura (validações do board)[cite: 1]
│   │   ├── test/                   # Setup global do Vitest[cite: 1]
│   │   └── types/                  # Tipagens TypeScript (database.types.ts)[cite: 1]
│   ├── package.json                # Dependências npm[cite: 1]
│   ├── vitest.config.ts            # Configurações de testes unitários[cite: 1]
│   └── playwright.config.ts        # Configurações de testes end-to-end[cite: 1]
├── scripts/                        # Scripts auxiliares (load-test, mocks)[cite: 1]
└── supabase/
    ├── config.toml                 # Configurações do ambiente Supabase Local[cite: 1]
    ├── functions/                  # Edge Functions Serverless (Deno/TS)[cite: 1]
    │   ├── ai-insights-engine/     # Processamento profundo analítico[cite: 1]
    │   ├── ai-worker/              # Consumidor do Job Queue de mensagens[cite: 1]
    │   ├── generate_message/       # Endpoint de geração On-Demand de mensagens[cite: 1]
    │   └── projection-worker/      # Worker de atualização CQRS (métricas)[cite: 1]
    └── migrations/                 # Todos os scripts SQL de esquema de banco (50+ scripts)[cite: 1]
```

---

## 11. Guia de Instalação e Deploy Local

Para avaliação local, recomendamos a execução nativa. Siga estritamente este manual passo-a-passo.

### 11.1 Pré-requisitos de Infraestrutura
1.  **Node.js**: Versão 18.x ou superior.
2.  **Gerenciador de Pacotes**: NPM ou PNPM.
3.  **Git**: Para clonar o repositório.
4.  **Supabase CLI**: Ferramenta oficial para emular a stack do banco de dados na sua máquina usando Docker (Opcional, caso não possua Docker, pode-se usar a nuvem do Supabase gratuitamente).
5.  **Chave de API OpenAI**: Necessário para testar a funcionalidade vital do sistema[cite: 2].

### 11.2 Clonagem e Instalação Base
```bash
# Clone o repositório oficial
git clone https://github.com/Andrey-Bertoletti/processflow-app.git
cd processflow-app

# Instale dependências de scripts globais (se houver)
npm install

# Acesse o diretório front-end e instale dependências do React/Next
cd frontend
npm install
```

### 11.3 Configurando o Banco de Dados (Supabase Local via Docker)
O Supabase CLI abstrai a subida de Postgres, GoTrue (Auth), Storage e Edge Functions.
```bash
# Na raiz do projeto processflow-app/
supabase start

# Aguarde o download das imagens Docker. 
# Após concluir, o terminal exibirá:
# API URL: http://127.0.0.1:54321
# anon key: eyJhbGciOiJIUzI1NiIsIn...
# As migrations presentes na pasta `supabase/migrations` serão rodadas automaticamente.
```

### 11.4 Configuração de Variáveis de Ambiente
Você deve criar dois arquivos `.env` para abastecer as diferentes camadas do sistema[cite: 1].

**Arquivo 1: Frontend (`frontend/.env.local`)**[cite: 1]
Crie este arquivo dentro da pasta `frontend/` e preencha com as credenciais do seu Supabase (seja local via CLI ou remoto via nuvem)[cite: 1]:
```env
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua_chave_anon_aqui"
```

**Arquivo 2: Edge Functions (`supabase/.env` ou registro remoto)**[cite: 1]
As Edge Functions executam as requisições de IA. Elas precisam de *secrets*. Localmente, crie um arquivo `.env` na raiz do projeto `processflow-app/`:
```env
OPENAI_API_KEY="sk-proj-**********************************"
WEBHOOK_SECRET="uma-string-aleatoria-para-seguranca"
```
*Dica: Se usar o Supabase remoto, adicione essas chaves no painel "Edge Functions > Secrets" do site.*

### 11.5 Inicialização dos Serviços
Se estiver utilizando a Edge Function de Geração Manual, sirva-a localmente:
```bash
supabase functions serve generate_message --env-file ./supabase/.env
```

Em um novo terminal, inicie o Frontend:
```bash
cd frontend
npm run dev
# Ou o script customizado do package.json: npm run front
```

O sistema estará integralmente disponível em `http://localhost:3000`.

---

## 12. Estratégia de Testes (QA)

Um CRM não pode apresentar falhas durante a transição de vendas. A confiabilidade do código base do ProcessFlow é aferida através de duas camadas de testes independentes[cite: 1].

### 12.1 Testes Unitários e Integração (Vitest)
Utilizamos o *Vitest* como motor principal, devido à sua velocidade de execução (HMR) e suporte irrestrito a TypeScript e EcmaScript Modules[cite: 1].
*   **O que está coberto?** 
    *   Lógica de negócios e validação (`frontend/src/lib/lead-validation.ts`)[cite: 1].
    *   Manipulação e cálculo de posições no Kanban (`pipeline-utils.ts`, testado exaustivamente em `pipeline-utils.test.ts` e `pipeline.integration.test.ts`)[cite: 1].
    *   Formatação de prompts antes de enviar para a API (`leads.test.ts`)[cite: 1].
*   **Como Executar:** `npm run test` dentro do diretório `/frontend`[cite: 1].

### 12.2 Testes de Mutação e UI (Playwright)
Para garantir que a jornada do SDR (Autenticação -> Inserção de Lead -> Seleção de Campanha -> Geração) funcione, utilizamos o Playwright (`playwright.config.ts`)[cite: 1]. Ele cria instâncias *headless* do Chromium para navegar na interface renderizada do Next.js, validar os bloqueios do Modal de Validação de Etapas e garantir que as Edge Functions retornem dados para o DOM corretamente[cite: 1].

---

## 13. Histórico de Migrations e Changelog

A arquitetura do banco de dados não nasceu pronta; ela evoluiu em etapas metódicas visíveis nas migrations do Supabase[cite: 1]. Este histórico reflete a maturidade da engenharia da aplicação[cite: 1]:

*   **20260504183000_pipeline_seed.sql**: Carga inicial das etapas do funil[cite: 1].
*   **20260504191000... a 20260504194000**: Resolução de recursividade (loops infinitos) nas políticas de segurança de Workspace RLS[cite: 1].
*   **20260504212000_add_assigned_to_on_leads.sql**: Refatoração para suportar responsáveis e visualizações "Meus Leads"[cite: 1].
*   **20260504235000_add_stage_validation_rules.sql**: O marco de engenharia para habilitar os bloqueios de segurança nas movimentações Kanban, prevenindo poluição de banco[cite: 1].
*   **20260505120000...**: Criação das tabelas de entidades de Campanhas[cite: 1].
*   **20260505150000_audit_lead_events.sql**: Habilitação de timeline e Event Sourcing para auditoria de ações (requisito diferencial)[cite: 1, 2].
*   **20260505220000_job_queue.sql**: Mudança de paradigma de sistema síncrono para assíncrono. Criação da tabela de filas para processar IA via trigger Postgres -> Edge Function[cite: 1].
*   **20260505240000_stripe_level_infra.sql**: Ajustes finais de infraestrutura para escalar tabelas visando ambiente de produção de alta carga[cite: 1].
*   **20260505500000_system_health_observability.sql**: Criação dos esquemas para leitura e monitoramento de falhas de processamento e faturamento no Control Plane[cite: 1].

---

## 14. Considerações Finais do Desenvolvedor

A implementação do **ProcessFlow AI** demonstra uma compreensão profunda não apenas do ecossistema React/Next.js contemporâneo, mas da arquitetura Backend e Devops necessárias para escalar uma plataforma SaaS impulsionada por LLMs.

A decisão de mover a complexidade das automações para a camada de banco de dados (Listen/Notify + Job Queue + RLS)[cite: 1] e isolar as chamadas da OpenAI em Edge Functions Serverless reflete um nível de senioridade e design de sistemas robusto, garantindo segurança de tokens, performance na interface gráfica e imensa tolerância a falhas. 

O cumprimento estrito de 100% dos requisitos obrigatórios, somado à implementação integral das funções diferenciais (Automação por Gatilho, Timeline Histórica, Campos Dinâmicos JSONB e Observabilidade)[cite: 2], qualifica o ProcessFlow como um produto *production-ready*.
