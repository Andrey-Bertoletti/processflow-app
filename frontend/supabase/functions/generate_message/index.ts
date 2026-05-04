/// <reference types="@supabase/functions-js" />
import { serve } from "@supabase/functions-js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

serve(async (req) => {
  const { leadId, campaignId } = await req.json();

  // Busca lead e campanha (RLS já protege por workspace)
  const [{ data: lead }, { data: campaign }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
  ]);

  if (!lead || !campaign) {
    return new Response(
      JSON.stringify({ error: "Lead ou campanha não encontrados." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const prompt = `
${campaign.base_prompt}

Lead: ${lead.name}
Etapa: ${lead.stage_id}
Contexto da campanha: ${campaign.context}
Contato: ${lead.email ?? ""} ${lead.phone ?? ""}

Crie uma mensagem curta, amigável e persuasiva para esse contato.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",               // trocar por "gpt-oss-120b" se desejar
    messages: [{ role: "system", content: prompt }],
    max_tokens: 250,
    temperature: 0.7,
  });

  const message = completion.choices[0].message?.content?.trim() ?? "";

  return new Response(JSON.stringify({ message }), {
    headers: { "Content-Type": "application/json" },
  });
});
