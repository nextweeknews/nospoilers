import type { DeleteAccountResponse } from "@nospoilers/types";
import type { AuthUser, AvatarMeta, AvatarUploadPlan, AvatarUploadRequest, UsernameAvailability } from "../../../../services/auth/src";
import { webConfig } from "../config/env";
import { supabaseClient } from "./supabaseClient";

export const authClient = supabaseClient.auth;

export const getSession = async () => authClient.getSession();

export const onAuthStateChange = (...args: Parameters<typeof authClient.onAuthStateChange>) =>
  authClient.onAuthStateChange(...args);

export const signInWithOtp = async (phone: string) => authClient.signInWithOtp({ phone });

export const verifySmsOtp = async (phone: string, token: string) =>
  authClient.verifyOtp({ phone, token, type: "sms" });

export const verifyPhoneChangeOtp = async (phone: string, token: string) =>
  authClient.verifyOtp({ phone, token, type: "phone_change" });

export const signInWithPassword = async (email: string, password: string) =>
  authClient.signInWithPassword({ email, password });

export const signUpWithPassword = async (email: string, password: string) =>
  authClient.signUp({ email, password });

/**
 * Builds a safe auth redirect URL for OAuth/password reset.
 * In dev (Codespaces), prefer the current runtime origin so redirects stay valid
 * even when the preview URL changes.
 *
 * IMPORTANT: The resulting URL must be included in Supabase Auth Redirect URLs.
 */
const getRuntimeAuthRedirectUrl = (): string => {
  // SSR-safe guard (web app should normally be browser-only here)
  if (typeof window !== "undefined" && window.location?.origin) {
    // If your login screen itself handles callback state + session restoration,
    // redirect back to the current page path. If you have a dedicated callback route,
    // change this to `${window.location.origin}/auth/callback`.
    return `${window.location.origin}${window.location.pathname}`;
  }

  return webConfig.supabaseAuthRedirectUrl;
};

export const authRedirectTo = getRuntimeAuthRedirectUrl();

export const requestPasswordReset = async (email: string) =>
  authClient.resetPasswordForEmail(email, { redirectTo: authRedirectTo });

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

export const linkEmailPasswordIdentity = async (email: string, password: string) =>
  authClient.updateUser({ email, password });

export const updateCurrentUserPassword = async (password: string) =>
  authClient.updateUser({ password });

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

type UpdateProfileInput = {
  displayName?: string;
  username?: string;
  themePreference?: "system" | "light" | "dark";
};

const buildApiUrl = (path: string): string => `${webConfig.apiBaseUrl}${path}`;

const getAccessToken = async (): Promise<string> => {
  const { data, error } = await authClient.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? "Missing auth session.");
  }

  return data.session.access_token;
};

const callAuthApi = async <TResponse>(path: string, init?: RequestInit): Promise<TResponse> => {
  const accessToken = await getAccessToken();
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
};

export const authService = {
  checkUsernameAvailability: async (username: string): Promise<UsernameAvailability> =>
    callAuthApi<UsernameAvailability>(`/auth/usernames/availability?username=${encodeURIComponent(username)}`),

  reserveUsername: async (username: string, userId: string): Promise<UsernameAvailability> =>
    callAuthApi<UsernameAvailability>(`/auth/users/${encodeURIComponent(userId)}/username-reservation`, {
      method: "POST",
      body: JSON.stringify({ username })
    }),

  updateProfile: async (userId: string, updates: UpdateProfileInput): Promise<AuthUser> =>
    callAuthApi<AuthUser>(`/auth/users/${encodeURIComponent(userId)}/profile`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    }),

  createAvatarUploadPlan: async (userId: string, request: AvatarUploadRequest): Promise<AvatarUploadPlan> =>
    callAuthApi<AvatarUploadPlan>(`/auth/users/${encodeURIComponent(userId)}/avatar-upload-plan`, {
      method: "POST",
      body: JSON.stringify(request)
    }),

  finalizeAvatarUpload: async (userId: string, uploadId: string, metadata: AvatarMeta): Promise<AuthUser> =>
    callAuthApi<AuthUser>(
      `/auth/users/${encodeURIComponent(userId)}/avatar-upload-plan/${encodeURIComponent(uploadId)}/finalize`,
      {
        method: "POST",
        body: JSON.stringify({ metadata })
      }
    )
};
