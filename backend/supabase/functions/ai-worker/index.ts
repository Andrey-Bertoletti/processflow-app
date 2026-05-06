import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  // Use service role for background processing
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch pending jobs
    const { data: jobs, error: fetchError } = await supabase
      .from("automation_jobs")
      .select("*, workspaces(name)")
      .eq("status", "pending")
      .limit(5); // Process in small batches

    if (fetchError) throw fetchError;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];

    for (const job of jobs) {
      // Mark as processing
      await supabase.from("automation_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job.id);

      try {
        // 2. Invoke the existing generation logic
        // We reuse the generate-message logic (we could also extract it to a shared lib, but for simplicity we invoke the function)
        const { data, error: genError } = await supabase.functions.invoke("generate-message", {
          body: { 
            lead_id: job.lead_id, 
            campaign_id: job.campaign_id,
            variations_count: 3,
            force_regenerate: true // Auto-gen is always fresh
          },
        });

        if (genError) throw genError;

        // 3. Mark as completed
        await supabase.from("automation_jobs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", job.id);
        results.push({ job_id: job.id, status: "success" });

      } catch (err: any) {
        // 4. Handle failure and increment attempts
        await supabase.from("automation_jobs").update({ 
          status: job.attempts >= 3 ? "failed" : "pending", 
          attempts: job.attempts + 1,
          last_error: err.message,
          updated_at: new Date().toISOString() 
        }).eq("id", job.id);
        results.push({ job_id: job.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
