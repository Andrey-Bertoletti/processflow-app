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
    
    // Auth Simplificada de Operação Master
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Endpoint especial de REBUILD ENGINE
    const url = new URL(req.url);
    if (url.pathname.endsWith("/rebuild")) {
      console.warn("⚠️ PROJECTION REBUILD INITIATED");
      const { error } = await supabaseAdmin.rpc('cqrs_reset_projections');
      if (error) throw error;
      
      return new Response(JSON.stringify({ message: "V1 Read Models truncated and checkpoints reset. Ready for replay." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ==========================================
    // STREAM PROCESSOR (CHECKPOINT-BASED BATCHING)
    // ==========================================
    
    // Suportamos "Worker Pooling" permitindo chamar via URL parameter ?projection=lead_timeline_v1
    const projectionName = url.searchParams.get("projection") || "all";

    // Busca os checkpoints atuais
    const { data: checkpoints } = await supabaseAdmin
      .from("projection_checkpoints")
      .select("*");

    let processedCount = 0;

    // Iteramos as projections (se "all", processa as 3 sequencialmente)
    const activeProjections = checkpoints || [];

    for (const checkpoint of activeProjections) {
      if (projectionName !== "all" && checkpoint.projection_name !== projectionName) continue;

      // 1. Busca Batch de Eventos pós-checkpoint cronologicamente
      const { data: events, error: fetchError } = await supabaseAdmin
        .from("job_events")
        .select("*")
        .gt("created_at", checkpoint.last_event_created_at)
        .order("created_at", { ascending: true })
        .limit(100);

      if (fetchError || !events || events.length === 0) continue;

      console.log(`Processing ${events.length} events for ${checkpoint.projection_name}...`);

      let highestTimestamp = checkpoint.last_event_created_at;

      for (const event of events) {
        try {
          const payload = event.details?.payload || {};
          const workspaceId = payload.workspace_id || event.details?.workspace_id;
          const correlationId = event.correlation_id;

          // ROTEAMENTO DE PROJECTIONS ISOLADAS
          if (checkpoint.projection_name === "lead_timeline_v1" && correlationId && workspaceId) {
            const timelineUpdate: any = {
              lead_id: correlationId,
              workspace_id: workspaceId,
              updated_at: event.created_at
            };

            if (event.event_type === 'job_created') {
              timelineUpdate.current_stage_id = payload.stage_id;
              timelineUpdate.last_job_status = 'pending';
            } else if (event.event_type === 'job_claimed') {
              timelineUpdate.last_job_status = 'processing';
            } else if (event.event_type === 'job_completed') {
              timelineUpdate.last_job_status = 'completed';
              timelineUpdate.last_ai_response = event.details?.ai_response || 'Gerado com sucesso';
            } else if (event.event_type === 'job_failed') {
              timelineUpdate.last_job_status = 'failed';
              timelineUpdate.last_error_log = event.details?.error || 'Erro desconhecido';
            }

            await supabaseAdmin.from('v1_read_lead_timeline').upsert(timelineUpdate, {
              onConflict: 'lead_id', ignoreDuplicates: false
            });
          }

          if (checkpoint.projection_name === "workspace_metrics_v1" && workspaceId && (event.event_type === 'job_completed' || event.event_type === 'job_failed')) {
            const dateKey = new Date(event.created_at).toISOString().split('T')[0];
            const isSuccess = event.event_type === 'job_completed';
            
            const { data: currentMetrics } = await supabaseAdmin
              .from('v1_read_workspace_metrics')
              .select('*').eq('workspace_id', workspaceId).eq('date_key', dateKey).single();

            await supabaseAdmin.from('v1_read_workspace_metrics').upsert({
              workspace_id: workspaceId,
              date_key: dateKey,
              total_jobs_processed: (currentMetrics?.total_jobs_processed || 0) + (isSuccess ? 1 : 0),
              total_jobs_failed: (currentMetrics?.total_jobs_failed || 0) + (!isSuccess ? 1 : 0),
            }, { onConflict: 'workspace_id, date_key' });
          }

          if (checkpoint.projection_name === "campaign_performance_v1") {
            const campaignId = payload.campaign_id;
            if (campaignId && workspaceId && (event.event_type === 'job_completed' || event.event_type === 'job_failed')) {
               const isSuccess = event.event_type === 'job_completed';

               const { data: currentCampaign } = await supabaseAdmin
                 .from('v1_read_campaign_performance')
                 .select('*').eq('campaign_id', campaignId).single();

               await supabaseAdmin.from('v1_read_campaign_performance').upsert({
                 campaign_id: campaignId,
                 workspace_id: workspaceId,
                 leads_processed: (currentCampaign?.leads_processed || 0) + 1,
                 successful_generations: (currentCampaign?.successful_generations || 0) + (isSuccess ? 1 : 0),
                 failed_generations: (currentCampaign?.failed_generations || 0) + (!isSuccess ? 1 : 0),
               }, { onConflict: 'campaign_id' });
            }
          }

          highestTimestamp = event.created_at;
          processedCount++;
        } catch (err) {
          console.error(`Error processing event ${event.id} in ${checkpoint.projection_name}:`, err);
          break; // Stop to guarantee order per projection
        }
      }

      // Avança o Checkpoint Atômico
      if (highestTimestamp !== checkpoint.last_event_created_at) {
        await supabaseAdmin.rpc('advance_projection_checkpoint', { 
          p_projection_name: checkpoint.projection_name, 
          p_last_timestamp: highestTimestamp 
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed_count: processedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Projection Worker Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})
