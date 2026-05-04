


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."is_user_in_workspace"("ws_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from workspace_users
    where workspace_id = ws_id
    and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_user_in_workspace"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "start_date" timestamp without time zone,
    "end_date" timestamp without time zone,
    "workspace_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'finished'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "stage_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "lead_id" "uuid",
    "campaign_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "check_relation" CHECK ((("lead_id" IS NOT NULL) OR ("campaign_id" IS NOT NULL)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "order" integer NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspace_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processes"
    ADD CONSTRAINT "processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "unique_stage_order" UNIQUE ("workspace_id", "order");



ALTER TABLE ONLY "public"."workspace_users"
    ADD CONSTRAINT "workspace_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_users"
    ADD CONSTRAINT "workspace_users_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_campaigns_workspace" ON "public"."campaigns" USING "btree" ("workspace_id");



CREATE INDEX "idx_leads_stage" ON "public"."leads" USING "btree" ("stage_id");



CREATE INDEX "idx_leads_workspace" ON "public"."leads" USING "btree" ("workspace_id");



CREATE INDEX "idx_messages_campaign" ON "public"."messages" USING "btree" ("campaign_id");



CREATE INDEX "idx_messages_lead" ON "public"."messages" USING "btree" ("lead_id");



CREATE INDEX "idx_messages_workspace" ON "public"."messages" USING "btree" ("workspace_id");



CREATE INDEX "idx_stages_workspace" ON "public"."stages" USING "btree" ("workspace_id");



CREATE OR REPLACE TRIGGER "update_campaigns_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stages_updated_at" BEFORE UPDATE ON "public"."stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_users"
    ADD CONSTRAINT "workspace_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_users"
    ADD CONSTRAINT "workspace_users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "User can create workspace" ON "public"."workspaces" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "User can insert own membership" ON "public"."workspace_users" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "User can view own memberships" ON "public"."workspace_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "User can view own workspaces" ON "public"."workspaces" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_users" "wu"
  WHERE (("wu"."workspace_id" = "workspaces"."id") AND ("wu"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_delete" ON "public"."campaigns" FOR DELETE USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "campaigns_insert" ON "public"."campaigns" FOR INSERT WITH CHECK ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "campaigns_select" ON "public"."campaigns" FOR SELECT USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "campaigns_update" ON "public"."campaigns" FOR UPDATE USING ("public"."is_user_in_workspace"("workspace_id"));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_delete" ON "public"."leads" FOR DELETE USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "leads_insert" ON "public"."leads" FOR INSERT WITH CHECK ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "leads_select" ON "public"."leads" FOR SELECT USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "leads_update" ON "public"."leads" FOR UPDATE USING ("public"."is_user_in_workspace"("workspace_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete" ON "public"."messages" FOR DELETE USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT WITH CHECK ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "messages_update" ON "public"."messages" FOR UPDATE USING ("public"."is_user_in_workspace"("workspace_id"));



ALTER TABLE "public"."processes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stages_delete" ON "public"."stages" FOR DELETE USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "stages_insert" ON "public"."stages" FOR INSERT WITH CHECK ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "stages_select" ON "public"."stages" FOR SELECT USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "stages_update" ON "public"."stages" FOR UPDATE USING ("public"."is_user_in_workspace"("workspace_id"));



CREATE POLICY "users_can_add_workspace_members" ON "public"."workspace_users" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "workspace_users"."workspace_id") AND ("workspaces"."owner_id" = "auth"."uid"())))));



CREATE POLICY "users_can_create_workspaces" ON "public"."workspaces" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "users_can_update_own_workspaces" ON "public"."workspaces" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "users_can_view_own_workspaces" ON "public"."workspaces" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "users_can_view_workspace_members" ON "public"."workspace_users" FOR SELECT USING ((("workspace_id" IN ( SELECT "workspace_users_1"."workspace_id"
   FROM "public"."workspace_users" "workspace_users_1"
  WHERE ("workspace_users_1"."user_id" = "auth"."uid"()))) OR ("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."workspace_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."is_user_in_workspace"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_workspace"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_workspace"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."processes" TO "anon";
GRANT ALL ON TABLE "public"."processes" TO "authenticated";
GRANT ALL ON TABLE "public"."processes" TO "service_role";



GRANT ALL ON TABLE "public"."stages" TO "anon";
GRANT ALL ON TABLE "public"."stages" TO "authenticated";
GRANT ALL ON TABLE "public"."stages" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_users" TO "anon";
GRANT ALL ON TABLE "public"."workspace_users" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_users" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop trigger if exists "update_campaigns_updated_at" on "public"."campaigns";

drop trigger if exists "update_leads_updated_at" on "public"."leads";

drop trigger if exists "update_messages_updated_at" on "public"."messages";

drop trigger if exists "update_stages_updated_at" on "public"."stages";

drop policy "campaigns_delete" on "public"."campaigns";

drop policy "campaigns_insert" on "public"."campaigns";

drop policy "campaigns_select" on "public"."campaigns";

drop policy "campaigns_update" on "public"."campaigns";

drop policy "leads_delete" on "public"."leads";

drop policy "leads_insert" on "public"."leads";

drop policy "leads_select" on "public"."leads";

drop policy "leads_update" on "public"."leads";

drop policy "messages_delete" on "public"."messages";

drop policy "messages_insert" on "public"."messages";

drop policy "messages_select" on "public"."messages";

drop policy "messages_update" on "public"."messages";

drop policy "stages_delete" on "public"."stages";

drop policy "stages_insert" on "public"."stages";

drop policy "stages_select" on "public"."stages";

drop policy "stages_update" on "public"."stages";

drop policy "users_can_add_workspace_members" on "public"."workspace_users";

drop policy "users_can_view_workspace_members" on "public"."workspace_users";

drop policy "User can view own workspaces" on "public"."workspaces";

alter table "public"."campaigns" drop constraint "campaigns_workspace_id_fkey";

alter table "public"."leads" drop constraint "leads_stage_id_fkey";

alter table "public"."leads" drop constraint "leads_workspace_id_fkey";

alter table "public"."messages" drop constraint "messages_campaign_id_fkey";

alter table "public"."messages" drop constraint "messages_lead_id_fkey";

alter table "public"."messages" drop constraint "messages_workspace_id_fkey";

alter table "public"."stages" drop constraint "stages_workspace_id_fkey";

alter table "public"."workspace_users" drop constraint "workspace_users_workspace_id_fkey";

alter table "public"."campaigns" add constraint "campaigns_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE not valid;

alter table "public"."campaigns" validate constraint "campaigns_workspace_id_fkey";

alter table "public"."leads" add constraint "leads_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE SET NULL not valid;

alter table "public"."leads" validate constraint "leads_stage_id_fkey";

alter table "public"."leads" add constraint "leads_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE not valid;

alter table "public"."leads" validate constraint "leads_workspace_id_fkey";

alter table "public"."messages" add constraint "messages_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_campaign_id_fkey";

alter table "public"."messages" add constraint "messages_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_lead_id_fkey";

alter table "public"."messages" add constraint "messages_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_workspace_id_fkey";

alter table "public"."stages" add constraint "stages_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE not valid;

alter table "public"."stages" validate constraint "stages_workspace_id_fkey";

alter table "public"."workspace_users" add constraint "workspace_users_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE not valid;

alter table "public"."workspace_users" validate constraint "workspace_users_workspace_id_fkey";


  create policy "campaigns_delete"
  on "public"."campaigns"
  as permissive
  for delete
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "campaigns_insert"
  on "public"."campaigns"
  as permissive
  for insert
  to public
with check (public.is_user_in_workspace(workspace_id));



  create policy "campaigns_select"
  on "public"."campaigns"
  as permissive
  for select
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "campaigns_update"
  on "public"."campaigns"
  as permissive
  for update
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "leads_delete"
  on "public"."leads"
  as permissive
  for delete
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "leads_insert"
  on "public"."leads"
  as permissive
  for insert
  to public
with check (public.is_user_in_workspace(workspace_id));



  create policy "leads_select"
  on "public"."leads"
  as permissive
  for select
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "leads_update"
  on "public"."leads"
  as permissive
  for update
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "messages_delete"
  on "public"."messages"
  as permissive
  for delete
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "messages_insert"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (public.is_user_in_workspace(workspace_id));



  create policy "messages_select"
  on "public"."messages"
  as permissive
  for select
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "messages_update"
  on "public"."messages"
  as permissive
  for update
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "stages_delete"
  on "public"."stages"
  as permissive
  for delete
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "stages_insert"
  on "public"."stages"
  as permissive
  for insert
  to public
with check (public.is_user_in_workspace(workspace_id));



  create policy "stages_select"
  on "public"."stages"
  as permissive
  for select
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "stages_update"
  on "public"."stages"
  as permissive
  for update
  to public
using (public.is_user_in_workspace(workspace_id));



  create policy "users_can_add_workspace_members"
  on "public"."workspace_users"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = workspace_users.workspace_id) AND (workspaces.owner_id = auth.uid())))));



  create policy "users_can_view_workspace_members"
  on "public"."workspace_users"
  as permissive
  for select
  to public
using (((workspace_id IN ( SELECT workspace_users_1.workspace_id
   FROM public.workspace_users workspace_users_1
  WHERE (workspace_users_1.user_id = auth.uid()))) OR (workspace_id IN ( SELECT workspaces.id
   FROM public.workspaces
  WHERE (workspaces.owner_id = auth.uid())))));



  create policy "User can view own workspaces"
  on "public"."workspaces"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.workspace_users wu
  WHERE ((wu.workspace_id = workspaces.id) AND (wu.user_id = auth.uid())))));


CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


