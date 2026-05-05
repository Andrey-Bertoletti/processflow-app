import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      console.warn("Unauthorized webhook attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "job_queue") {
      return new Response(JSON.stringify({ message: "Ignored." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const jobTrigger = payload.record;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. RATE LIMIT BÁSICO: Impede que um único Workspace sufoque o sistema
    const { count: concurrentJobs } = await supabaseAdmin
      .from("job_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .eq("payload->>workspace_id", jobTrigger.payload.workspace_id);
    
    if (concurrentJobs && concurrentJobs > 10) {
      console.warn(`[THROTTLE] Workspace ${jobTrigger.payload.workspace_id} excedeu a cota de concorrência.`);
      // Retornar 200 pro webhook não retentar. O cron job (futuro) ou retry varre depois.
      return new Response(JSON.stringify({ message: "Throttled." }), { headers: corsHeaders });
    }

    const traceUUID = crypto.randomUUID();

    // 2. CONCURRENCY CONTROL SÊNIOR (FOR UPDATE SKIP LOCKED via RPC) com Lease Timestamp
    const { data: lockedJobs, error: lockError } = await supabaseAdmin
      .rpc('acquire_ai_job', { p_job_id: jobTrigger.id, p_trace_id: traceUUID, p_lease_minutes: 5 });

    if (lockError) throw lockError;
    if (!lockedJobs || lockedJobs.length === 0) {
      return new Response(JSON.stringify({ message: "Job picked up by another worker or not ready." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const lockedJob = lockedJobs[0];
    const traceId = traceUUID; // Usa a chave de rastreabilidade gerada
    const startTime = Date.now();

    console.log(`[TRACE:${traceId}] Iniciando processamento do Job ${lockedJob.id}. Tentativa: ${lockedJob.attempts}`);

    // Processamento Assíncrono para liberar o Webhook e rodar solto
    (async () => {
      try {
        const { lead_id, campaign_id, workspace_id, stage_id } = lockedJob.payload;

        const [{ data: lead }, { data: campaign }] = await Promise.all([
          supabaseAdmin.from("leads").select("*").eq("id", lead_id).single(),
          supabaseAdmin.from("campaigns").select("context, base_prompt").eq("id", campaign_id).single(),
        ]);

        if (!lead || !campaign) throw new Error("Referência fantasma (Lead/Campaign excluído)");

        const promptSanitizer = (val: string) => String(val || "").replace(/\s+/g, " ").trim().slice(0, 200);

        const systemPrompt = `Você é um SDR Especialista e Estrategista Comercial Sênior de altíssima conversão.
Sua missão é gerar uma mensagem de Outbound persuasiva, humana e com foco direto no próximo passo do funil.

CONTEXT (Instruções da Campanha):
${String(campaign.base_prompt).slice(0, 1500)}

${String(campaign.context).slice(0, 1500)}

LEAD (Dados Estruturados):
- Nome: ${promptSanitizer(lead.name)}
- Email: ${promptSanitizer(lead.email)}
- Telefone: ${promptSanitizer(lead.phone)}

GOAL:
Gerar uma mensagem totalmente personalizada para este Lead.

CONSTRAINTS (Regras Rígidas):
- Tom natural e consultivo (nunca pareça um robô ou spam genérico).
- Máximo de 300 caracteres.
- Se houver dados do lead faltando, NÃO invente. Apenas use o que tem.
- Termine a mensagem com uma Call to Action leve ou pergunta aberta.
- NUNCA use a palavra 'AI' ou 'Robô'.

FORMATO OBRIGATÓRIO DE SAÍDA (JSON strict):
Retorne EXATAMENTE este objeto JSON:
{
  "message": "a mensagem escrita aqui",
  "confidence": um número entre 0.0 e 1.0,
  "reasoning_tag": "cold" ou "warm" ou "hot"
}`;

        // 3. RETRY POLICY COM EXPONENTIAL BACKOFF NATIVO DA CHAMADA EXTERNA
        const fetchOpenAIWithBackoff = async (maxAttempts = 3, currentAttempt = 1): Promise<any> => {
          try {
             const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
                },
                body: JSON.stringify({
                  model: "gpt-4o-mini",
                  response_format: { type: "json_object" },
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Gere o JSON de saída agora." }
                  ],
                  max_tokens: 300,
                  temperature: 0.7,
                })
             });
             
             if (!res.ok) {
               const errText = await res.text();
               // Se for rate limit severo da OpenAI, recuar agressivamente
               if (res.status === 429) throw new Error(`OpenAI Rate Limit: ${errText}`);
               throw new Error(`OpenAI Error ${res.status}: ${errText}`);
             }
             
             return await res.json();
          } catch (e) {
            if (currentAttempt < maxAttempts) {
               const backoffMs = Math.pow(2, currentAttempt) * 1000 + Math.random() * 500; // Jitter adicionado
               console.log(`[TRACE:${traceId}] OpenAI request failed, retrying in ${backoffMs}ms... (Attempt ${currentAttempt + 1})`);
               await new Promise(r => setTimeout(r, backoffMs));
               return fetchOpenAIWithBackoff(maxAttempts, currentAttempt + 1);
            }
            throw e;
          }
        };

        const jsonRes = await fetchOpenAIWithBackoff();
        const contentStr = jsonRes.choices[0].message.content.trim();
        const parsedResponse = JSON.parse(contentStr);
        const processingTimeMs = Date.now() - startTime;
        const tokensUsed = jsonRes.usage?.total_tokens ?? 0;

        // 4. CONCLUSÃO BEM-SUCEDIDA
        console.log(`[TRACE:${traceId}] Sucesso em ${processingTimeMs}ms. Tokens: ${tokensUsed}`);

        await supabaseAdmin.from("job_queue").update({
          status: "completed",
          updated_at: new Date().toISOString()
        }).eq("id", lockedJob.id);

        await supabaseAdmin.from("messages").update({
          content: parsedResponse.message,
          status: "success",
          updated_at: new Date().toISOString()
        })
        .eq("lead_id", lead_id)
        .eq("campaign_id", campaign_id)
        .eq("status", "pending");

        // 5. OBSERVABILITY & COST GOVERNOR (Registra Custo Real na Cota Diária)
        
        // Atualiza métricas de Custo Diário ("Upsert" via RPC se quisesse, ou no Frontend)
        await supabaseAdmin.rpc('increment_ai_usage', { p_workspace_id: workspace_id, p_tokens: tokensUsed }).catch(() => {
           // Fallback insert manual via HTTP se RPC não existir ainda
           supabaseAdmin.from('workspace_ai_usage').upsert(
             { workspace_id, date_key: new Date().toISOString().split('T')[0], jobs_processed: 1, tokens_consumed: tokensUsed },
             { onConflict: 'workspace_id, date_key', ignoreDuplicates: false }
           ).then();
        });

        await supabaseAdmin.from("automation_logs").insert({
          workspace_id: workspace_id,
          lead_id: lead_id,
          campaign_id: campaign_id,
          stage_id: stage_id,
          status: "success",
          error: `Trace: ${traceId} | Latência: ${processingTimeMs}ms | Tokens: ${tokensUsed} | Confiança: ${parsedResponse.confidence} | Tag: ${parsedResponse.reasoning_tag}`
        });

      } catch (err: any) {
        const errorLog = err.message || "Unknown error";
        console.error(`[TRACE:${traceId}] Erro na execução: ${errorLog}`);
        
        const hasExceededRetries = lockedJob.attempts >= lockedJob.max_attempts;

        if (hasExceededRetries) {
          console.error(`[TRACE:${traceId}] Limite de retries atingido. Movendo para DLQ.`);
          // 6. ROTEAMENTO PARA DEAD LETTER QUEUE (DLQ)
          await supabaseAdmin.rpc('route_to_dlq', { p_job_id: lockedJob.id, p_error: errorLog });

          await supabaseAdmin.from("messages").update({
            content: "⚠️ Automação falhou definitivamente após múltiplas tentativas.",
            status: "error",
            updated_at: new Date().toISOString()
          })
          .eq("lead_id", lockedJob.payload.lead_id)
          .eq("campaign_id", lockedJob.payload.campaign_id)
          .eq("status", "pending");

          await supabaseAdmin.from("automation_logs").insert({
            workspace_id: lockedJob.payload.workspace_id,
            lead_id: lockedJob.payload.lead_id,
            campaign_id: lockedJob.payload.campaign_id,
            stage_id: lockedJob.payload.stage_id,
            status: "error",
            error: `Trace: ${traceId} | Error: ${errorLog}`
          });
        } else {
          // Agenda próximo retry (Exponencial no nível do Banco)
          const backoffMinutes = Math.pow(3, lockedJob.attempts); // 3m, 9m, 27m
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
          
          console.warn(`[TRACE:${traceId}] Job reagendado para ${nextRetry}`);

          await supabaseAdmin.from("job_queue").update({
            status: "pending",
            error_log: errorLog,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString()
          }).eq("id", lockedJob.id);
        }
      }
    })(); // Dispara e esquece

    return new Response(JSON.stringify({ success: true, status: "processing", traceId: lockedJob.trace_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Worker Global Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})
