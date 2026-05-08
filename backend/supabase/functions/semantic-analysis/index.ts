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

async function canAccessLeadWorkspace(
  admin: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data: ws } = await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
  if (ws?.owner_id === userId) return true;

  const { data: row } = await admin
    .from("workspace_users")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(row);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    const supabaseAdmin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } });
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (!user) return jsonResponse({ error: "Auth required" }, 401);

    const body = await req.json().catch(() => ({}));
    const leadId = body?.lead_id ?? body?.leadId;

    if (!leadId || typeof leadId !== "string") {
      return jsonResponse({ error: "lead_id required" }, 400);
    }

    const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (!lead) return jsonResponse({ error: "Lead not found" }, 404);

    const allowed = await canAccessLeadWorkspace(supabaseAdmin, user.id, lead.workspace_id as string);
    if (!allowed) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: activities } = await supabaseAdmin
      .from("activities")
      .select("id, type, content, created_at, created_by")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(30);

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_MODEL") ?? "llama-3.3-70b-versatile";

    let baseUrl = "https://api.openai.com/v1/chat/completions";
    if (apiKey.startsWith("gsk_")) baseUrl = "https://api.groq.com/openai/v1/chat/completions";

    const systemPrompt = `Você é um Analista de Inteligência de Vendas.
    Analise o histórico de interações do lead ${lead.name} (${lead.company}) e gere um resumo estratégico.
    
    Histórico: ${JSON.stringify(activities)}
    
    Retorne APENAS um JSON:
    {
      "summary": "Resumo executivo de 2 frases sobre o momento do lead.",
      "engagement_status": "Alta / Média / Baixa",
      "sentiment": "Positivo / Neutro / Negativo",
      "suggested_action": "O que o vendedor deve fazer agora (ex: Ligar, Mandar Zap, Esperar)."
    }`;

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.1,
      }),
    });

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);

    return jsonResponse({ analysis: JSON.parse(match ? match[0] : content) });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
});
