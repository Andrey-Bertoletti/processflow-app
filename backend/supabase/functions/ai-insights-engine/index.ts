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
    
    // Auth básica do Webhook
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.warn("Unauthorized webhook attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();

    // Filtra apenas eventos da fila de tipo 'generate_insight'
    if (payload.type !== "INSERT" || payload.table !== "job_queue" || payload.record.type !== "generate_insight") {
      return new Response(JSON.stringify({ message: "Ignored." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const jobTrigger = payload.record;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const traceUUID = crypto.randomUUID();

    // Tenta pegar o lock do job para evitar execução duplicada
    const { data: lockedJobs, error: lockError } = await supabaseAdmin
      .rpc('acquire_ai_job', { p_job_id: jobTrigger.id, p_trace_id: traceUUID, p_lease_minutes: 2 });

    if (lockError) throw lockError;
    if (!lockedJobs || lockedJobs.length === 0) {
      return new Response(JSON.stringify({ message: "Job picked up by another worker or not ready." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const lockedJob = lockedJobs[0];
    const traceId = traceUUID;
    const startTime = Date.now();

    console.log(`[INSIGHT_TRACE:${traceId}] Iniciando processamento do Job ${lockedJob.id}.`);

    // Roda assincronamente (Fire and Forget)
    (async () => {
      try {
        const { lead_id, workspace_id } = lockedJob.payload;

        // 1. Fetch de Histórico (Activities)
        const { data: activities, error: actError } = await supabaseAdmin
          .from('activities')
          .select('*')
          .eq('lead_id', lead_id)
          .order('event_sequence', { ascending: true, nullsFirst: false })
          .limit(50); // Pegamos os ultimos 50 para ter contexto rico

        if (actError) throw actError;

        // 2. Formatar o Prompt
        const timelineText = (activities || []).map(act => {
          let desc = act.type;
          if (act.type === 'stage_change') desc += ` (${act.content?.old_stage_name} -> ${act.content?.new_stage_name})`;
          if (act.type === 'ai_message' || act.type === 'manual_message') desc += `: "${act.content?.content}"`;
          return `[${new Date(act.created_at).toISOString()}] ${desc}`;
        }).join('\n');

        const prompt = `Você é um AI Sales Decision Engine.
Sua missão é classificar a conversão e sugerir o próximo melhor passo baseado estritamente na timeline do Lead.

TIMELINE DO LEAD:
${timelineText}

REGRAS RÍGIDAS DE SAÍDA (FORMATO JSON EXATO):
{
  "score": inteiro_de_0_a_100,
  "sentiment": "hot" | "warm" | "cold",
  "risk_level": "low" | "medium" | "high",
  "recommended_action": "texto curto direto, ex: Ligar imediatamente",
  "reasoning": "explicação concisa do porquê em uma frase"
}`;

        // 3. Chamada OpenAI
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: prompt }],
            max_tokens: 300,
            temperature: 0.3, // Menos criatividade, mais analítico
          })
        });
        
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI Error: ${errText}`);
        }
        
        const jsonRes = await res.json();
        const parsedResponse = JSON.parse(jsonRes.choices[0].message.content.trim());
        const processingTimeMs = Date.now() - startTime;

        console.log(`[INSIGHT_TRACE:${traceId}] OpenAI gerou insight em ${processingTimeMs}ms.`);

        // 4. Salvar/Atualizar Insight no DB
        await supabaseAdmin.from('lead_insights').upsert({
          lead_id: lead_id,
          workspace_id: workspace_id,
          score: parsedResponse.score,
          sentiment: parsedResponse.sentiment,
          risk_level: parsedResponse.risk_level,
          recommended_action: parsedResponse.recommended_action,
          reasoning: parsedResponse.reasoning,
          updated_at: new Date().toISOString()
        }, { onConflict: 'lead_id' });

        // 5. Finalizar Job
        await supabaseAdmin.from("job_queue").update({
          status: "completed",
          updated_at: new Date().toISOString()
        }).eq("id", lockedJob.id);

      } catch (err: any) {
        const errorLog = err.message || "Unknown error";
        console.error(`[INSIGHT_TRACE:${traceId}] Erro: ${errorLog}`);
        
        const hasExceededRetries = lockedJob.attempts >= lockedJob.max_attempts;

        if (hasExceededRetries) {
           await supabaseAdmin.rpc('route_to_dlq', { p_job_id: lockedJob.id, p_error: errorLog });
        } else {
          // Re-enfileirar
          const backoffMinutes = Math.pow(2, lockedJob.attempts);
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
          await supabaseAdmin.from("job_queue").update({
            status: "pending",
            error_log: errorLog,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString()
          }).eq("id", lockedJob.id);
        }
      }
    })(); // Dispara e esquece

    return new Response(JSON.stringify({ success: true, status: "processing_insight", traceId: lockedJob.trace_id }), {
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
