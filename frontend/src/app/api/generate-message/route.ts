import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated route.",
      message: "Use the Supabase Edge Function `generate-message` via `supabase.functions.invoke()`.",
    },
    { status: 410 }
  );
}

