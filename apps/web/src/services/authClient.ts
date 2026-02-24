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

export const linkGoogleIdentity = async () =>
  (authClient as any).linkIdentity({
    provider: "google",
    options: {
      redirectTo: authRedirectTo
    }
  });

export const reauthenticateForIdentityLink = async () => {
  const authApi = authClient as any;
  if (typeof authApi.reauthenticate !== "function") {
    return { data: null, error: null };
  }

  return authApi.reauthenticate();
};

export const linkEmailPasswordIdentity = async (email: string, password: string) => authClient.updateUser({ email, password });

export const linkPhoneIdentity = async (phone: string) => authClient.updateUser({ phone });

export const getAuthUser = async () => authClient.getUser();

export const signOut = async () => authClient.signOut();

// Backward-compatible alias while migration is in progress.
export const authService: any = supabaseClient;
