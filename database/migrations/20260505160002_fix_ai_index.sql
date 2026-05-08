alter table "public"."leads" add column if not exists "is_generating_ai" boolean default false;

CREATE INDEX idx_ai_generations_hash ON public.ai_generations USING btree (prompt_hash) WHERE (status = 'success'::text);

CREATE INDEX idx_leads_is_generating_ai ON public.leads USING btree (is_generating_ai) WHERE (is_generating_ai = true);


