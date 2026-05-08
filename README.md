# ProcessFlow App

Mini CRM para equipes de SDR com Kanban por workspace, campanhas, campos personalizados, automações de funil e geração de mensagens com IA.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth%20%2B%20Edge%20Functions-3FCF8E?style=flat-square&logo=supabase&logoColor=111)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-UI-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Grok](https://img.shields.io/badge/Grok-llama--3.3--70b--versatile-000000?style=flat-square)
![Status](https://img.shields.io/badge/status-pronto%20para%20avalia%C3%A7%C3%A3o-22c55e?style=flat-square)

---

## Links

| Recurso | Link |
|---|---|
| Deploy | [processflow-app-eosin.vercel.app](https://processflow-app-eosin.vercel.app) |
| Vídeo | Pendente — será adicionado antes da entrega final |
| Auditoria | [`AUDITORIA_EDITAL.md`](./AUDITORIA_EDITAL.md) |
| Testes manuais | [`docs/TESTE_MANUAL.md`](./docs/TESTE_MANUAL.md) |
| Edital | `Prova Técnica — Desenvolvedor Vibe Coding Full Stack-20260505132034.md` |

---

## Sobre o projeto

O **ProcessFlow App** é um Mini CRM voltado para times de pré-vendas.  
A aplicação permite organizar leads em um funil Kanban, criar campanhas de abordagem, configurar campos personalizados por workspace e gerar mensagens personalizadas com IA.

O sistema foi desenvolvido com foco em:

- isolamento de dados por workspace;
- geração de mensagens com IA via backend seguro;
- regras de qualidade de dados por etapa;
- automações por etapa gatilho;
- interface administrativa com papéis `admin` e `member`;
- segurança com Supabase Auth, PostgreSQL e RLS.

---

## Funcionalidades

### CRM e funil

- Cadastro e edição de leads.
- Campos padrão: nome, email, telefone, empresa, cargo, origem e observações.
- Responsável opcional pelo lead.
- Kanban por etapa do funil.
- Histórico de atividades.
- Histórico de mensagens geradas e enviadas.

### Funil padrão

1. Base
2. Lead Mapeado
3. Tentando Contato
4. Conexão Iniciada
5. Desqualificado
6. Qualificado
7. Reunião Agendada

### Campanhas e IA

- Criação de campanhas com nome, contexto e prompt.
- Geração de 2 a 3 variações de mensagens.
- Regeneração sob demanda.
- Cópia da mensagem gerada.
- Envio simulado.
- Movimentação automática para **Tentando Contato** após envio.

### Campos personalizados

- Criação de campos por workspace.
- Valores personalizados por lead.
- Uso dos campos personalizados no prompt da IA.
- Suporte a campos obrigatórios por etapa.

### Automação por etapa gatilho

- Campanha vinculada a uma etapa do funil.
- Geração automática quando o lead entra na etapa configurada.
- Processamento assíncrono via fila e Edge Functions.
- Mensagens persistidas no lead para visualização posterior.

### Administração

- Papéis simples: `admin` e `member`.
- `admin` gerencia funil, campos, campanhas e membros.
- `member` opera leads, Kanban e mensagens.
- Proteção por RLS e validações no backend.

---

## Checklist do edital

### Obrigatórios

- [x] Cadastro e login
- [x] Workspaces
- [x] Isolamento por workspace
- [x] Leads com campos padrão
- [x] Campos personalizados
- [x] Responsável pelo lead
- [x] Kanban
- [x] Funil de pré-vendas
- [x] Movimentação de leads
- [x] Detalhe e edição do lead
- [x] Campanhas com nome, contexto e prompt
- [x] Geração de mensagens com IA
- [x] 2 a 3 variações
- [x] Regeneração
- [x] Copiar mensagem
- [x] Envio simulado
- [x] Movimento automático para **Tentando Contato**
- [x] Regras de transição
- [x] Dashboard
- [x] Deploy público
- [ ] Vídeo obrigatório — pendente até a entrega final

### Diferenciais

- [x] Geração automática por etapa gatilho
- [x] Edição/configuração do funil
- [x] Multi-workspace
- [x] Gestão de membros `admin` / `member`
- [x] Histórico de atividades
- [x] Histórico de mensagens
- [x] Filtros e busca
- [x] Métricas avançadas
- [x] Row Level Security
- [x] ZIP seguro de submissão

---

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Supabase Edge Functions, TypeScript, Deno |
| Banco | Supabase PostgreSQL, RLS, migrations, triggers, RPCs |
| Auth | Supabase Auth |
| IA | OpenAI API |
| Deploy | Vercel + Supabase |
| DevOps | Supabase CLI, scripts de sync e ZIP seguro |

---

## Estrutura do projeto

```text
/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── public/
│   └── package.json
│
├── backend/
│   └── supabase/
│       ├── functions/
│       │   ├── generate-message/
│       │   ├── ai-worker/
│       │   ├── projection-worker/
│       │   └── ai-insights-engine/
│       └── config.toml
│
├── database/
│   ├── migrations/
│   ├── seed.sql
│   └── README.md
│
├── docs/
│   └── TESTE_MANUAL.md
│
├── scripts/
│   └── create-submission-zip.mjs
│
├── AUDITORIA_EDITAL.md
├── contexto.md
├── README.md
├── package.json
└── .env.example
````

| Pasta                         | Finalidade                                                      |
| ----------------------------- | --------------------------------------------------------------- |
| `frontend/`                   | Aplicação Next.js, rotas, componentes e integração com Supabase |
| `backend/supabase/functions/` | Edge Functions, geração de IA, workers e lógica sensível        |
| `database/migrations/`        | Schema, RLS, RPCs, triggers e policies                          |
| `docs/`                       | Testes manuais, roteiro do vídeo e documentação de apoio        |
| `scripts/`                    | Automação de ZIP seguro e rotinas auxiliares                    |

---

## Decisões técnicas

### Supabase como backend

O Supabase foi usado por reunir autenticação, PostgreSQL, RLS e Edge Functions em uma única plataforma, atendendo diretamente aos requisitos técnicos do desafio.

### Multi-tenancy por workspace

Os dados principais possuem `workspace_id`.
O vínculo do usuário com o workspace é controlado pela tabela `workspace_users`.

### Segurança com RLS

O isolamento entre workspaces é feito no banco.
Mesmo que alguém tente manipular IDs pelo frontend, as policies impedem acesso fora do workspace autorizado.

### Papéis simples

O sistema usa apenas dois papéis:

* `admin`: gerencia configurações, funil, campos, campanhas e membros;
* `member`: opera leads, Kanban, mensagens e dashboard básico.

### IA no backend

A OpenAI é chamada apenas pelas Supabase Edge Functions.
O frontend nunca recebe `OPENAI_API_KEY` ou `SERVICE_ROLE_KEY`.

### Envio simulado

Ao enviar uma mensagem, o sistema marca a mensagem como enviada, move o lead para **Tentando Contato** e registra o evento no histórico.

---

## Variáveis de ambiente

### Frontend / Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase Edge Functions

```env
PROJECT_URL=
SERVICE_ROLE_KEY=
OPENAI_API_KEY=
WEBHOOK_SECRET=
```

> `SERVICE_ROLE_KEY` e `OPENAI_API_KEY` devem ficar apenas no backend/Edge Functions.

---

## Como rodar localmente

### Pré-requisitos

* Node.js 18+
* Docker
* Supabase CLI
* Conta OpenAI para geração real de mensagens

### Instalação

```bash
npm install

cd frontend
npm install
cd ..
```

### Ambiente do frontend

Crie `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

### Rodar localmente

```bash
npm run supabase:start
npm run back
npm run front
```

---

## Deploy

### Vercel

| Configuração   | Valor                                                       |
| -------------- | ----------------------------------------------------------- |
| Root Directory | `frontend`                                                  |
| Build Command  | `npm run build`                                             |
| Output         | `.next`                                                     |
| Variáveis      | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

### Supabase Edge Functions

```bash
cd backend/supabase

supabase functions deploy generate-message
supabase functions deploy ai-worker
```

Secrets:

```bash
supabase secrets set PROJECT_URL="https://seu-projeto.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="sua-service-role-key"
supabase secrets set OPENAI_API_KEY="sua-openai-key"
```

---

## Testes e validação

### Build

```bash
cd frontend
npm run build
```

### Testes

```bash
cd frontend
npm run test
```

### ZIP seguro

```bash
npm run zip:submission
```

O ZIP final não deve conter:

* `.env`;
* `.env.local`;
* `.git`;
* `.vercel`;
* `node_modules`;
* `.next`;
* logs;
* arquivos temporários.

---

## Segurança

O projeto utiliza:

* Supabase Auth;
* Row Level Security;
* isolamento por workspace;
* roles `admin` e `member`;
* RPCs com validação por `auth.uid()`;
* Edge Functions com validação de sessão e workspace;
* secrets fora do frontend;
* ZIP seguro sem arquivos sensíveis.

---

## Roteiro sugerido para o vídeo

1. Cadastro e login.
2. Criação ou seleção de workspace.
3. Criação de lead.
4. Criação de campanha.
5. Geração de 3 mensagens com IA.
6. Regeneração de mensagens.
7. Cópia da mensagem.
8. Envio simulado.
9. Lead movido para **Tentando Contato**.
10. Histórico do lead.
11. Dashboard.
12. Explicação rápida da arquitetura e diferenciais.

---

## Status

Projeto tecnicamente pronto para avaliação de código e conformidade com o edital.

O vídeo obrigatório permanece pendente e será adicionado antes da entrega final.
