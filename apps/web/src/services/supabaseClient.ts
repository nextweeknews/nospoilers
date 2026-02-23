import { createClient } from "@supabase/supabase-js";
import { webConfig } from "../config/env";

const supabaseUrl = webConfig.supabaseUrl;
const supabaseAnonKey = webConfig.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
