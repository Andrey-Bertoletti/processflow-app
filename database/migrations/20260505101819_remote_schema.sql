create extension if not exists "pg_net" with schema "extensions";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_logs') THEN
    DROP POLICY IF EXISTS "Users can view automation logs from their workspace" ON "public"."automation_logs";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DROP POLICY IF EXISTS "Users can insert messages to their workspace" ON "public"."messages";
    DROP POLICY IF EXISTS "Users can view messages from their workspace" ON "public"."messages";
  END IF;
END $$;

DO $$
BEGIN
  -- Safely drop constraints if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_logs') THEN
    ALTER TABLE "public"."automation_logs" DROP CONSTRAINT IF EXISTS "automation_logs_campaign_id_fkey";
    ALTER TABLE "public"."automation_logs" DROP CONSTRAINT IF EXISTS "automation_logs_lead_id_fkey";
    ALTER TABLE "public"."automation_logs" DROP CONSTRAINT IF EXISTS "automation_logs_stage_id_fkey";
    ALTER TABLE "public"."automation_logs" DROP CONSTRAINT IF EXISTS "automation_logs_workspace_id_fkey";
    ALTER TABLE "public"."automation_logs" DROP CONSTRAINT IF EXISTS "automation_logs_pkey";
  END IF;
END $$;

drop index if exists "public"."automation_logs_pkey";
drop index if exists "public"."idx_automation_idempotency";
drop table if exists "public"."automation_logs";

-- Safely drop columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE "public"."messages" DROP COLUMN IF EXISTS "is_automated";
    ALTER TABLE "public"."messages" DROP COLUMN IF EXISTS "status";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stages') THEN
    ALTER TABLE "public"."stages" DROP COLUMN IF EXISTS "auto_campaign_id";
    ALTER TABLE "public"."stages" DROP CONSTRAINT IF EXISTS "stages_auto_campaign_id_fkey";
  END IF;
END $$;


