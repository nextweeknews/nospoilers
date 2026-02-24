import { supabaseClient } from "./supabaseClient";
import { normalizeUsername } from "./usernameValidation";

export type UsernameCheckResult =
  | { available: boolean; error: null }
  | { available: false; error: Error };

export const checkUsernameAvailability = async (username: string): Promise<UsernameCheckResult> => {
  const candidate = normalizeUsername(username);
  const { data, error } = await supabaseClient.rpc("is_username_available", { candidate });

  if (error) {
    return { available: false, error: new Error(error.message) };
  }

  return { available: Boolean(data), error: null };
};
