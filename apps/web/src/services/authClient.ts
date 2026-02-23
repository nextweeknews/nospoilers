import { webConfig } from "../config/env";
import { supabaseClient } from "./supabaseClient";

export const authClient = supabaseClient.auth;
export const authRedirectTo = webConfig.supabaseAuthRedirectUrl;

export const signInWithGoogle = async () =>
  authClient.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectTo
    }
  });

export const signOut = async () => authClient.signOut();

// Backward-compatible alias while migration is in progress.
export const authService: any = supabaseClient;
