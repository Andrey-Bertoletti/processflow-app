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

    if (!user) return jsonResponse({ success: false, error: "Auth missing" }, 401);

    const body = await req.json().catch(() => ({}));
    const lead_id = body?.lead_id as string | undefined;
    const campaign_id = body?.campaign_id as string | undefined;

    if (!lead_id || !campaign_id) {
      return jsonResponse({ success: false, error: "lead_id and campaign_id are required" }, 400);
    }

    const [{ data: lead }, { data: campaign }, { data: customFields }, { data: insights }] = await Promise.all([
      supabaseAdmin.from("leads").select("*").eq("id", lead_id).maybeSingle(),
      supabaseAdmin.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabaseAdmin.from("lead_custom_field_values").select("*, workspace_custom_fields(name)").eq("lead_id", lead_id),
      supabaseAdmin.from("lead_insights").select("*").eq("lead_id", lead_id).maybeSingle(),
    ]);

    if (!lead || !campaign) return jsonResponse({ success: false, error: "Not found" }, 404);

    if (lead.workspace_id !== campaign.workspace_id) {
      return jsonResponse({ success: false, error: "Workspace mismatch" }, 403);
    }

    const allowed = await canAccessLeadWorkspace(supabaseAdmin, user.id, lead.workspace_id as string);
    if (!allowed) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const extraContext = (customFields || [])
      .map((f: any) => `${f.workspace_custom_fields?.name ?? "campo"}: ${f.value}`)
      .join(", ");
    const sentiment = insights?.sentiment || "Neutro";

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_MODEL") ?? "llama-3.3-70b-versatile";
    const baseUrl = apiKey.startsWith("gsk_")
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const systemPrompt = `Você é um SDR Senior B2B. Gere 3 sugestões de mensagens personalizadas para ${lead.name} (${lead.company}).
    
    CONDIÇÕES DO LEAD:
    - Contexto Extra: ${extraContext || "Nenhum"}
    - Sentimento Atual: ${sentiment}
    - Campanha: ${campaign.context}
    
    DIRETRIZES:
    1. Se o sentimento for "Positivo", use um tom mais direto para fechamento.
    2. Se houver "Site" ou campos extras, mencione algo relevante.
    3. JSON: {"messages":["v1","v2","v3"]}`;

    const aiRes = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.8,
      }),
    });

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : content);

    const { data: saved } = await supabaseAdmin
      .from("messages")
      .insert(
        (parsed.messages || []).map((m: string, i: number) => ({
          workspace_id: lead.workspace_id,
          lead_id: lead.id,
          campaign_id: campaign.id,
          content: m,
          status: "generated",
          variation_index: i,
          is_automated: false,
        })),
      )
      .select("*");

    return jsonResponse({ success: true, messages: saved });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
});
