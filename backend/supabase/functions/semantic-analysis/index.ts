import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeForPrompt(input: unknown, max = 2000) {
  if (input === null || input === undefined) return "";
  return String(input).replace(/\s+/g, " ").trim().slice(0, max);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Server misconfigured: missing Supabase env vars." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const leadId = body?.lead_id ?? body?.leadId;
  if (!isUuid(leadId)) return jsonResponse({ error: "lead_id is required (UUID)." }, 400);

  const { data: activities, error: actError } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("event_sequence", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(80);

  if (actError || !activities) return jsonResponse({ error: "Failed to fetch activities." }, 500);

  const timelineText = activities
    .map((act: any) => {
      let desc = act.type;
      if (act.type === "stage_change") desc += ` (${act.content?.old_stage_name} -> ${act.content?.new_stage_name})`;
      if (act.type === "ai_message" || act.type === "manual_message") desc += `: "${sanitizeForPrompt(act.content?.content, 300)}"`;
      const ts = act.created_at ? new Date(act.created_at).toISOString() : "";
      return `[${ts}] ${desc}`;
    })
    .join("\n");

  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  if (!openaiKey) return jsonResponse({ error: "AI not configured." }, 500);

  const prompt = `Você é um AI Sales Assistant sênior analisando a linha do tempo de um lead em nosso CRM.
Baseado exclusivamente nos eventos abaixo, forneça:
1) Um resumo curto do momento atual do lead (1-2 frases).
2) O humor/engajamento deduzido do lead (ex: Frio, Engajado, Ignorando, etc).
3) A próxima melhor ação sugerida para o vendedor humano tomar.

Eventos do Lead:
${timelineText}

Responda em JSON estrito (sem markdown) exatamente neste formato:
{
  "summary": "string",
  "engagement_status": "string",
  "suggested_action": "string"
}`;

  const timeoutMs = Number(Deno.env.get("AI_TIMEOUT_MS") ?? "10000");
  let openaiJson: any;
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: openaiModel,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: prompt }],
          temperature: 0.3,
          max_tokens: 350,
        }),
      },
      Number.isFinite(timeoutMs) ? Math.max(1000, Math.min(60000, timeoutMs)) : 10000
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonResponse({ error: "OpenAI request failed.", detail: errText }, res.status === 429 ? 429 : 502);
    }
    openaiJson = await res.json();
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return jsonResponse({ error: isTimeout ? "AI request timed out." : "AI request failed." }, isTimeout ? 504 : 502);
  }

  const content = openaiJson?.choices?.[0]?.message?.content ?? "{}";
  let analysis: any = null;
  try {
    analysis = JSON.parse(content);
  } catch {
    analysis = null;
  }

  if (!analysis || typeof analysis.summary !== "string") {
    return jsonResponse({ error: "AI returned an invalid payload." }, 502);
  }

  return jsonResponse({ analysis }, 200);
});

