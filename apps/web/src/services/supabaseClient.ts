import { createClient } from "@supabase/supabase-js";
import { webConfig } from "../config/env";

const supabaseUrl = webConfig.supabaseUrl;
const supabaseAnonKey = webConfig.supabaseAnonKey;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn("[nospoilers/web] Supabase env vars are missing. Falling back to local placeholders so the app can render in dev mode.");
}

const resolvedSupabaseUrl = hasSupabaseConfig ? supabaseUrl : "http://127.0.0.1:54321";
const resolvedSupabaseAnonKey = hasSupabaseConfig ? supabaseAnonKey : "dev-anon-key";

export const supabaseClient = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
