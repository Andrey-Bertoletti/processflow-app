import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OpenAI } from 'openai';

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
    });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // 1. Busca os eventos do lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: activities, error } = await db
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('event_sequence', { ascending: true, nullsFirst: false });

    if (error || !activities) {
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    // 2. Formata a linha do tempo para o prompt
    const timelineText = activities.map((act: any) => {
      let desc = act.type;
      if (act.type === 'stage_change') desc += ` (${act.content?.old_stage_name} -> ${act.content?.new_stage_name})`;
      if (act.type === 'ai_message' || act.type === 'manual_message') desc += `: "${act.content?.content}"`;
      return `[${new Date(act.created_at).toISOString()}] ${desc}`;
    }).join('\n');

    // 3. Prompt para IA (Semantic Layer)
    const prompt = `
Você é um AI Sales Assistant sênior analisando a linha do tempo de um lead em nosso CRM.
Baseado exclusivamente nos eventos abaixo, forneça:
1. Um resumo curto do momento atual do lead (1-2 frases).
2. O "humor/engajamento" deduzido do lead (ex: Frio, Engajado, Ignorando, etc).
3. A próxima melhor ação sugerida para o vendedor humano tomar.

Eventos do Lead:
${timelineText}

Responda em formato JSON estrito:
{
  "summary": "string",
  "engagement_status": "string",
  "suggested_action": "string"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: "json_object" }
    });

    const resultString = completion.choices[0].message.content || '{}';
    const analysis = JSON.parse(resultString);

    return NextResponse.json({ analysis }, { status: 200 });

  } catch (error) {
    console.error('[SEMANTIC_ANALYSIS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
