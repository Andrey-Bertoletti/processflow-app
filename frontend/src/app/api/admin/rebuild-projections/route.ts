import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gate mínimo: apenas roles administrativas conseguem acionar operações destrutivas.
    // A tabela `workspace_users` é RLS-safe para o próprio user (política "view own memberships").
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: membership, error: membershipError } = await db
      .from("workspace_users")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("[ADMIN_REBUILD_AUTHZ_ERROR]", membershipError);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (sessionError || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!supabaseUrl || !webhookSecret) {
      console.error("[ADMIN_REBUILD_MISCONFIG]", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasWebhookSecret: Boolean(webhookSecret),
      });
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const upstream = await fetch(`${supabaseUrl}/functions/v1/projection-worker/rebuild`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-webhook-secret": webhookSecret,
      },
    });

    const bodyText = await upstream.text().catch(() => "");

    if (!upstream.ok) {
      console.error("[ADMIN_REBUILD_UPSTREAM_ERROR]", {
        status: upstream.status,
        body: bodyText?.slice(0, 500) || "",
      });
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    // Tenta repassar JSON quando possível, mas não vaza nada sensível.
    try {
      const json = bodyText ? JSON.parse(bodyText) : {};
      return NextResponse.json(json, { status: 200 });
    } catch {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  } catch (error) {
    console.error("[ADMIN_REBUILD_FATAL]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

