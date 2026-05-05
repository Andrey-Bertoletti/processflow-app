# ProcessFlow - SDR Intelligence & CRM 🚀

**ProcessFlow** é um Mini CRM especializado em Pré-Vendas (SDR), desenvolvido como prova técnica para demonstrar competências em engenharia de software full stack, integração com Inteligência Artificial e arquitetura de sistemas escaláveis e seguros.

---

## 📺 Demonstração & Links
- **Aplicação:** [LINK_DA_PUBLICACAO_VERCEL_AQUI]
- **Vídeo de Walkthrough:** [LINK_DO_VIDEO_OBRIGATORIO_AQUI] (Máx 10 min)

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS (Rich Aesthetics & Modern UI)
- **Estado/Dados:** React Context API & React Server Components
- **Componentes:** Shadcn/UI (base) com customizações avançadas

### Backend & Database (BaaS)
- **Infraestrutura:** Supabase
- **Banco de Dados:** PostgreSQL (Relacional)
- **Autenticação:** Supabase Auth (JWT & Session)
- **Armazenamento:** Supabase Storage (para assets se necessário)
- **Segurança:** Row Level Security (RLS) & Policies granulares

### Inteligência Artificial
- **Engine:** OpenAI GPT-4o-mini
- **Processamento:** Supabase Edge Functions (Deno Runtime)
- **Padronização:** Respostas em JSON estrito com sanitização de prompts

---

## 🏗️ Arquitetura do Sistema

O projeto adota uma arquitetura descentralizada para garantir performance e segurança:

1.  **Frontend (Next.js):** Camada de apresentação reativa, otimizada para SEO e interações de baixa latência no Kanban.
2.  **Backend Serverless (Edge Functions):** Lógicas pesadas e integrações com APIs externas (OpenAI) ocorrem em funções de borda, reduzindo o tempo de resposta global.
3.  **Database Layer (Postgres):** O banco não é apenas um depósito de dados, mas o guardião da integridade via Triggers, RPCs e RLS.

### Multi-tenancy & Segurança
O isolamento entre empresas (Workspaces) é garantido nativamente no banco de dados via **RLS (Row Level Security)**. 
- Cada tabela possui uma coluna `workspace_id`.
- Usuários só podem acessar dados onde possuem um vínculo na tabela `workspace_users`.
- Isso impede ataques de acesso cruzado (IDOR) mesmo que as rotas de API sejam conhecidas.

### Modelagem de Campos Customizados (EAV Relacional)
Em vez de usar colunas JSONB fixas para campos dinâmicos, o ProcessFlow utiliza um modelo relacional:
- `workspace_custom_fields`: Define o esquema de dados do cliente.
- `lead_custom_field_values`: Armazena os valores, permitindo validações de tipos e obrigatoriedade dinâmica por etapa do funil.

---

## 🎯 Funcionalidades Implementadas (Checklist Edital)

### ✅ Requisitos Obrigatórios
- [x] **Gestão de Leads (CRUD):** Criação, edição, exclusão e visualização detalhada.
- [x] **Funil Kanban:** Pipeline com 7 etapas padronizadas conforme edital:
    1. Base | 2. Lead Mapeado | 3. Tentando Contato | 4. Conexão Iniciada | 5. Desqualificado | 6. Qualificado | 7. Reunião Agendada.
- [x] **Gestão de Campanhas:** Definição de contexto, prompt base e tom de voz.
- [x] **Geração de Mensagens IA:** Criação de 3 variações (Direta, Consultiva, Criativa) personalizadas por lead.
- [x] **Ação de Envio Simulada:** Transação atômica que marca a mensagem como enviada, move o lead e registra no histórico.
- [x] **Isolamento de Workspaces:** RLS aplicado em Leads, Campanhas, Mensagens e Configurações.
- [x] **Campos Customizados:** Suporte a Segmento, Faturamento, etc., configuráveis por workspace.

### ✨ Diferenciais (Hardening)
- [x] **Regras de Transição:** Bloqueio de movimentação no Kanban caso faltem dados obrigatórios na etapa destino.
- [x] **Timeline de Eventos:** Registro histórico detalhado de todas as interações com o lead.
- [x] **Automação de Gatilho:** Configuração de "Etapa Gatilho" que dispara a geração de IA automaticamente ao entrar no estágio.
- [x] **Sanitização de IA:** Tratamento robusto contra injeção de prompt e fallbacks de JSON inválido.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Supabase CLI (opcional para rodar local)
- Conta no OpenAI (API Key)

### 1. Clonar e Instalar
```bash
git clone https://github.com/Andrey-Bertoletti/processflow-app.git
cd processflow-app/frontend
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env.local` na pasta `frontend` e `.env` na raiz:
```env
NEXT_PUBLIC_SUPABASE_URL=seu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
OPENAI_API_KEY=sua_chave_openai
```
*Consulte `.env.example` para a lista completa.*

### 3. Banco de Dados & Migrations
Se estiver usando Supabase Cloud, as migrations estão em `backend/supabase/migrations`.
```bash
npx supabase db push
```

### 5. Executar Testes
O projeto possui uma suíte de testes unitários e de integração:
```bash
# Testes Unitários e de Componentes (Vitest)
npm run test

# Testes E2E (Playwright) - Requer servidor rodando
npm run test:e2e
```

---

## 🏗️ Build de Produção
- **Secrets:** Nunca comite arquivos `.env` reais. Use o Painel da Vercel para variáveis de produção.
- **Rotação:** Em caso de exposição de chaves, revogue imediatamente no dashboard do Supabase e OpenAI.

---

## 🔐 Segurança
- **Secrets:** Nunca comite arquivos `.env` reais. Use o Painel da Vercel para variáveis de produção.
- **Rotação:** Em caso de exposição de chaves, revogue imediatamente no dashboard do Supabase e OpenAI.

---

## 👤 Autor
Desenvolvido por **Andrey Bertoletti**. 
Especialista em soluções escaláveis com foco em experiência do usuário e IA.
