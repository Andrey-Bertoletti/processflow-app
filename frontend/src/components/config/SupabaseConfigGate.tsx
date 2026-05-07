"use client";

import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import ConfigurationErrorScreen from "@/components/config/ConfigurationErrorScreen";

type Props = {
  children: ReactNode;
};

export default function SupabaseConfigGate({ children }: Props) {
  const configured = isSupabaseConfigured();

  if (configured) {
    return <>{children}</>;
  }

  // Runtime behavior:
  // - Dev: throw a clear error (fast feedback)
  // - Prod: show a friendly screen
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see frontend/.env.example).",
    );
  }

  return <ConfigurationErrorScreen mode="production" />;
}

