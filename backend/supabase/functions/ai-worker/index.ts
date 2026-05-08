import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/**
 * Worker operacional: idealmente chamado só por cron/ops.
 * Se `WEBHOOK_SECRET` estiver definido no ambiente da função, exige header `x-webhook-secret` igual.
 * (Evita invocação anônima com service role em aberto.)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  if (webhookSecret) {
    const provided = req.headers.get("x-webhook-secret") ?? "";
    if (provided !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_MODEL") ?? "llama-3.3-70b-versatile";
    const baseUrl = apiKey.startsWith("gsk_") ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";

    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, company, workspace_id, updated_at")
      .order("updated_at", { ascending: true })
      .limit(5);

    for (const lead of leads || []) {
      const { data: actRows } = await supabase
        .from("activities")
        .select("type, content, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(25);

      const history =
        (actRows || []).map((a: any) => `${a.type}: ${JSON.stringify(a.content)}`).join("\n") || "Sem histórico.";

      const systemPrompt = `Você é um Analista de Dados de Vendas.
      Analise o histórico do lead ${lead.name} da empresa ${lead.company}.
      Histórico: ${history}
      
      Gere um score de 0 a 100 baseado na probabilidade de fechamento.
      Determine o sentimento atual e o nível de risco de perda (Low, Medium, High).
      Explique o raciocínio em 1 frase.
      
      Retorne APENAS JSON: 
      {
        "score": number,
        "sentiment": "Positivo/Neutro/Negativo",
        "risk_level": "Low/Medium/High",
        "recommended_action": "texto curto",
        "reasoning": "texto curto"
      }`;

      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "system", content: systemPrompt }],
          temperature: 0.2,
        }),
      });

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || "{}";
      const match = content.match(/\{[\s\S]*\}/);
      const insight = JSON.parse(match ? match[0] : content);

      await supabase.from("lead_insights").upsert({
        lead_id: lead.id,
        workspace_id: lead.workspace_id,
        ...insight,
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, count: leads?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
