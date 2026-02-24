import { createClient } from "@supabase/supabase-js";
import { webConfig } from "../config/env";

const supabaseUrl = webConfig.supabaseUrl;
const supabaseAnonKey = webConfig.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration for web app. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env.local (for local dev) or provide them as build-time env vars in CI/deployment."
  );
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
