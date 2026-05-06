# 🧪 Roteiro de Teste Manual e QA - ProcessFlow

Este guia fornece o passo-a-passo para validar todas as funcionalidades do **ProcessFlow** exigidas no edital e seus diferenciais técnicos.

---

## 📋 Pré-requisitos para o Teste
1.  **Ambiente:** Acesso à aplicação publicada ou local (`npm run dev`).
2.  **Infra:** Supabase migrations aplicadas (`npx supabase db push`).
3.  **Segredos:** `OPENAI_API_KEY` configurada no Supabase Secrets.
4.  **Worker:** Edge Function `ai-worker` e `generate-message` deployadas.

---

## 🚀 Fluxo Principal de Testes

### 1. Autenticação e Onboarding
- **Ação:** Criar uma conta nova em `/auth/register`.
- **Esperado:** Redirecionamento para a criação de Workspace.
- **Ação:** Criar o primeiro Workspace (ex: "Vendas Alpha").
- **Esperado:** Funil de 7 etapas criado automaticamente e redirecionamento para o Dashboard.

### 2. Configuração de Campos Personalizados
- **Ação:** Ir em "Configurações" ou área de Campos Customizados.
- **Ação:** Criar campo "Segmento" (Tipo: Texto, Obrigatório: Sim).
- **Ação:** Criar campo "Faturamento Anual" (Tipo: Número).
- **Esperado:** Campos aparecem na lista de gerenciamento e no formulário de lead.

### 3. Gestão de Leads e Regras de Transição
- **Ação:** Criar um Lead na etapa **Base** preenchendo apenas os campos padrão.
- **Ação:** Tentar arrastar o Lead para a etapa **Lead Mapeado**.
- **Esperado:** Sistema bloqueia a movimentação exibindo um modal avisando que o campo "Segmento" é obrigatório para esta etapa.
- **Ação:** Preencher o campo "Segmento" no detalhe do lead e mover novamente.
- **Esperado:** Movimentação realizada com sucesso.

### 4. Inteligência de Vendas (IA)
- **Ação:** Criar uma Campanha (ex: "Outbound SaaS") com contexto e prompt.
- **Ação:** No detalhe do Lead, selecionar a campanha criada.
- **Ação:** Clicar em **✨ Ver Sugestões**.
- **Esperado:** Surgem 3 variações de mensagens (Direta, Consultiva, Criativa) com botão de copiar e enviar.
- **Ação:** Clicar em **🔄 Regenerar**.
- **Esperado:** Novas mensagens são geradas, substituindo ou complementando as anteriores.

### 5. Envio Simulável e Timeline
- **Ação:** Escolher uma variação e clicar em **Enviar**.
- **Esperado:** 
    1. Toast de sucesso.
    2. Lead move-se automaticamente para **Tentando Contato**.
    3. Status da mensagem muda para "ENVIADA".
    4. Na seção **Linha do Tempo**, surge um evento "Mensagem Enviada" com data e detalhes.

### 6. Automação por Etapa Gatilho (Diferencial)
- **Ação:** Editar a Campanha e selecionar a etapa **Lead Mapeado** como "Etapa Gatilho".
- **Ação:** Criar um novo Lead diretamente na etapa **Lead Mapeado**.
- **Ação:** (Manual no teste) Executar o worker: `curl -X POST .../ai-worker`.
- **Esperado:** Ao abrir o detalhe do lead, as mensagens já devem estar pré-geradas no histórico, sem necessidade de clique manual.

### 7. Dashboard e Métricas
- **Ação:** Acessar o Dashboard.
- **Esperado:** 
    - Card com total de leads atualizado.
    - Gráfico de distribuição por etapas refletindo as movimentações feitas.
    - Métricas de eficiência de mensagens (se configuradas).

---

## 🛠️ Checklist Técnico de QA

| Item | Validação | Status |
| :--- | :--- | :--- |
| **RLS** | Tentar acessar ID de lead de outro workspace via URL/API. | 🔒 Bloqueado |
| **Responsividade** | Abrir Kanban no Mobile. | 📱 OK |
| **Performance** | Tempo de resposta da IA < 10s. | ⚡ OK |
| **Integridade** | Deletar lead e verificar se mensagens/eventos somem. | 🗑️ OK |

---
**Documento Gerado para:** Homologação de Edital ProcessFlow
**Autor:** QA Engineering Team
