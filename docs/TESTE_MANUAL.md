# 🧪 Roteiro de Teste Manual e QA - ProcessFlow

Este guia fornece o passo-a-passo para validar as funcionalidades exigidas no edital e os principais diferenciais técnicos do **ProcessFlow**.

---

## 📋 Pré-requisitos para o Teste

1. **Ambiente:** aplicação publicada ou local.
2. **Infra (local):** Supabase migrations aplicadas (`npm run supabase:start` ou `npm run banco:reset`).
3. **Segredos:** `OPENAI_API_KEY` configurada no ambiente do Supabase / Edge Functions.
4. **Workers:** Edge Functions `ai-worker` e `generate-message` servidas/deployadas.

---

## 🚀 Fluxo Principal de Testes

### 1. Autenticação e Onboarding
- **Ação:** Criar uma conta nova em `/auth/register`.
- **Esperado:** redirecionamento para criação de Workspace.
- **Ação:** Criar o primeiro Workspace (ex: "Vendas Alpha").
- **Esperado:** funil de 7 etapas criado automaticamente e redirecionamento para o Dashboard.

### 2. Configuração de Campos Personalizados
- **Ação:** Ir na área de Campos Customizados.
- **Ação:** Criar campo "Segmento" (Tipo: Texto, Obrigatório: Sim).
- **Ação:** Criar campo "Faturamento Anual" (Tipo: Número).
- **Esperado:** campos aparecem na lista de gerenciamento e no formulário/detalhe do lead.

### 3. Gestão de Leads e Regras de Transição
- **Ação:** Criar um lead na etapa **Base** preenchendo apenas os campos padrão.
- **Ação:** Tentar mover o lead para a etapa **Lead Mapeado**.
- **Esperado:** sistema bloqueia a movimentação e informa os campos obrigatórios da etapa.
- **Ação:** Preencher o campo "Segmento" no detalhe do lead e mover novamente.
- **Esperado:** movimentação realizada com sucesso.

### 4. Inteligência de Vendas (IA - Manual)
- **Ação:** Criar uma campanha (ex: "Outbound SaaS") com contexto e prompt.
- **Ação:** No detalhe do lead, selecionar a campanha criada.
- **Ação:** Clicar em **✨ Ver Sugestões**.
- **Esperado:** surgem 2–3 variações de mensagens com botões de copiar e enviar.
- **Ação:** Clicar em **🔄 Regenerar**.
- **Esperado:** novas mensagens são geradas.

### 5. Envio Simulável e Timeline
- **Ação:** Escolher uma variação e clicar em **Enviar**.
- **Esperado:**
  1. Toast de sucesso.
  2. Lead move-se automaticamente para **Tentando Contato**.
  3. Status da mensagem muda para "ENVIADA".
  4. Na seção **Linha do Tempo**, surge um evento "Mensagem Enviada".

### 6. Automação por Etapa Gatilho (Diferencial)

**Objetivo:** quando uma etapa possui `stages.auto_campaign_id`, o sistema deve:
1) enfileirar um job em `public.job_queue` ao **criar** um lead direto na etapa gatilho;
2) enfileirar um job em `public.job_queue` ao **mover** um lead para a etapa gatilho;
3) criar/atualizar uma mensagem placeholder `pending` para feedback imediato;
4) o worker `ai-worker` deve gerar as mensagens e marcar como `success` (equivalente a “generated”).

#### 6.1 Vincular campanha à etapa gatilho
- **Ação:** Editar a campanha (ex: "Outbound SaaS") e selecionar a etapa **Lead Mapeado** como "Etapa Gatilho".
- **Esperado:** a etapa fica com `auto_campaign_id = <campaign_id>`.

#### 6.2 Criar lead direto na etapa gatilho (AFTER INSERT)
- **Ação:** Criar um novo lead diretamente na etapa **Lead Mapeado**.
- **Esperado (banco):**
  - 1 linha em `public.job_queue` com `type = 'generate_ai_message'` e `status = 'pending'`.
  - 1 linha em `public.messages` com `status = 'pending'`, `is_automated = true` e `metadata.origin = 'trigger_stage'`.

#### 6.3 Mover lead para etapa gatilho (AFTER UPDATE OF stage_id)
- **Ação:** Criar outro lead em outra etapa e mover para **Lead Mapeado**.
- **Esperado:** mesmo comportamento (job + placeholder), **sem duplicar** jobs pendentes para a mesma combinação lead/campanha.

#### 6.4 Executar o worker (manual)
- **Ação (local):** com o Supabase local rodando (`npm run supabase:start`) e as funções servidas (`npm run back`), executar:
  - `curl -X POST http://localhost:54321/functions/v1/ai-worker`
  - se `WEBHOOK_SECRET` estiver configurado, usar também `-H "x-webhook-secret: <WEBHOOK_SECRET>"`
- **Esperado:**
  - `public.job_queue.status` muda para `completed`.
  - a mensagem placeholder `pending` é atualizada para `success` com o conteúdo da primeira variação.
  - as demais variações são inseridas em `public.messages`.

#### 6.5 Verificações rápidas (SQL)
- **Job:** `select id, type, status, payload from public.job_queue where type = 'generate_ai_message' order by created_at desc limit 5;`
- **Mensagens:** `select id, status, is_automated, metadata, content from public.messages where lead_id = '<lead_id>' order by created_at desc;`

### 7. Dashboard e Métricas
- **Ação:** Acessar o Dashboard.
- **Esperado:**
  - cards e métricas refletem as movimentações e jobs.

---

## 🛠️ Checklist Técnico de QA

| Item | Validação | Status |
| :--- | :--- | :--- |
| **RLS** | Tentar acessar lead de outro workspace via URL/API | 🔒 Bloqueado |
| **Responsividade** | Abrir Kanban no mobile | 📱 OK |
| **Performance** | Tempo de resposta da IA < 10s | ⚡ OK |
| **Integridade** | Deletar lead e verificar cascade (mensagens/eventos) | 🗑️ OK |

---

**Documento:** Homologação de Edital ProcessFlow  
**Autor:** QA Engineering Team

