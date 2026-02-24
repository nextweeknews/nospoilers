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

export const linkGoogleIdentity = async () =>
  (authClient as any).linkIdentity({
    provider: "google",
    options: {
      redirectTo: authRedirectTo,
      skipBrowserRedirect: true
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

export const completeOAuthSession = async (callbackUrl: string) => {
  const { params } = Linking.parse(callbackUrl);
  const accessToken = typeof params.access_token === "string" ? params.access_token : undefined;
  const refreshToken = typeof params.refresh_token === "string" ? params.refresh_token : undefined;

  if (!accessToken || !refreshToken) {
    return { data: null, error: new Error("Missing session tokens from OAuth callback.") };
  }

  return authClient.setSession({ access_token: accessToken, refresh_token: refreshToken });
};

export const signOut = async () => authClient.signOut();

// Backward-compatible alias while migration is in progress.
export const authService: any = supabaseClient;
