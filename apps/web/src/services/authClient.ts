import type { DeleteAccountResponse } from "@nospoilers/types";
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


export const deleteAccount = async (): Promise<{ data: DeleteAccountResponse | null; error: Error | null }> => {
  const { data: userData, error: userError } = await authClient.getUser();
  if (userError || !userData.user) {
    return { data: null, error: new Error(userError?.message ?? "Not signed in.") };
  }

  const rpcClient = supabaseClient as any;
  const { data, error } = await rpcClient.rpc("delete_account", { p_user_id: userData.user.id });
  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const response = (data ?? {
    deletedUserId: userData.user.id,
    revokedSessionCount: 1,
    clearedIdentityCount: (userData.user.identities ?? []).length,
    clearedProfile: true
  }) as DeleteAccountResponse;

  const { error: signOutError } = await authClient.signOut({ scope: "global" });
  if (signOutError) {
    return { data: null, error: new Error(signOutError.message) };
  }

  return { data: response, error: null };
};

export const signOut = async () => authClient.signOut();

// Backward-compatible alias while migration is in progress.
export const authService: any = supabaseClient;
