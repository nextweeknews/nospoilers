import * as Linking from "expo-linking";
import { mobileConfig } from "../config/env";
import { supabaseClient } from "./supabaseClient";

const fallbackRedirectTo = Linking.createURL("auth/callback", {
  scheme: mobileConfig.supabaseAuthDeepLinkScheme
});

export const authClient = supabaseClient.auth;
export const authRedirectTo = mobileConfig.supabaseAuthRedirectUrl ?? fallbackRedirectTo;

export const signInWithGoogle = async () =>
  authClient.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectTo,
      skipBrowserRedirect: true
    }
  });

export const signOut = async () => authClient.signOut();

// Backward-compatible alias while migration is in progress.
export const authService: any = supabaseClient;
