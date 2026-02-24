import { createClient } from "@supabase/supabase-js";
import { webConfig } from "../config/env";

const supabaseUrl = webConfig.supabaseUrl;
const supabaseAnonKey = webConfig.supabaseAnonKey;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration for web app. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env.local (for local dev) or provide them as build-time env vars in CI/deployment."
  );
}

const resolvedSupabaseUrl = hasSupabaseConfig ? supabaseUrl : "http://127.0.0.1:54321";
const resolvedSupabaseAnonKey = hasSupabaseConfig ? supabaseAnonKey : "dev-anon-key";

export const supabaseClient = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
