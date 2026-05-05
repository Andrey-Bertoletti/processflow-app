create extension if not exists "pg_net" with schema "extensions";

drop policy "Users can view automation logs from their workspace" on "public"."automation_logs";

drop policy "Users can insert messages to their workspace" on "public"."messages";

drop policy "Users can view messages from their workspace" on "public"."messages";

revoke delete on table "public"."automation_logs" from "anon";

revoke insert on table "public"."automation_logs" from "anon";

revoke references on table "public"."automation_logs" from "anon";

revoke select on table "public"."automation_logs" from "anon";

revoke trigger on table "public"."automation_logs" from "anon";

revoke truncate on table "public"."automation_logs" from "anon";

revoke update on table "public"."automation_logs" from "anon";

revoke delete on table "public"."automation_logs" from "authenticated";

revoke insert on table "public"."automation_logs" from "authenticated";

revoke references on table "public"."automation_logs" from "authenticated";

revoke select on table "public"."automation_logs" from "authenticated";

revoke trigger on table "public"."automation_logs" from "authenticated";

revoke truncate on table "public"."automation_logs" from "authenticated";

revoke update on table "public"."automation_logs" from "authenticated";

revoke delete on table "public"."automation_logs" from "service_role";

revoke insert on table "public"."automation_logs" from "service_role";

revoke references on table "public"."automation_logs" from "service_role";

revoke select on table "public"."automation_logs" from "service_role";

revoke trigger on table "public"."automation_logs" from "service_role";

revoke truncate on table "public"."automation_logs" from "service_role";

revoke update on table "public"."automation_logs" from "service_role";

alter table "public"."automation_logs" drop constraint "automation_logs_campaign_id_fkey";

alter table "public"."automation_logs" drop constraint "automation_logs_lead_id_fkey";

alter table "public"."automation_logs" drop constraint "automation_logs_stage_id_fkey";

alter table "public"."automation_logs" drop constraint "automation_logs_workspace_id_fkey";

alter table "public"."stages" drop constraint "stages_auto_campaign_id_fkey";

alter table "public"."automation_logs" drop constraint "automation_logs_pkey";

drop index if exists "public"."automation_logs_pkey";

drop index if exists "public"."idx_automation_idempotency";

drop table "public"."automation_logs";

alter table "public"."messages" drop column "is_automated";

alter table "public"."messages" drop column "status";

alter table "public"."stages" drop column "auto_campaign_id";


