import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client (Frontend Safe)
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);