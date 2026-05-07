import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_PUBLIC_CONFIG = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
} as const;

export function isSupabaseConfigured() {
  return SUPABASE_PUBLIC_CONFIG.isConfigured;
}

const DEV_ERROR_MESSAGE =
  "Supabase env vars missing.\n\n" +
  "Required:\n" +
  "- NEXT_PUBLIC_SUPABASE_URL\n" +
  "- NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n" +
  "Fix:\n" +
  "1) Copy `frontend/.env.example` -> `frontend/.env.local`\n" +
  "2) Fill in the values\n\n" +
  "Note: do NOT put SERVICE_ROLE_KEY or OPENAI_API_KEY in the frontend.";

const PROD_ERROR_MESSAGE = "APP_MISCONFIGURED_SUPABASE_PUBLIC_ENV";

function createMisconfiguredSupabaseProxy() {
  // Build-time safety: Next may import client modules during prerender/analysis.
  // We must not throw at module load; only when the client is actually used.
  return new Proxy(
    {},
    {
      get() {
        if (process.env.NODE_ENV === "production") {
          // In production we deliberately avoid leaking implementation details.
          throw new Error(PROD_ERROR_MESSAGE);
        }
        throw new Error(DEV_ERROR_MESSAGE);
      },
    },
  );
}

export const supabase = (SUPABASE_PUBLIC_CONFIG.isConfigured
  ? createBrowserClient<Database>(SUPABASE_PUBLIC_CONFIG.url, SUPABASE_PUBLIC_CONFIG.anonKey)
  : createMisconfiguredSupabaseProxy()) as any;

