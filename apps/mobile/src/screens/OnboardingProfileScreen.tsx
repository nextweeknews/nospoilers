import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";
import { supabaseClient } from "../services/supabaseClient";
import { checkUsernameAvailability } from "../services/username";
import { isUsernameFormatValid, normalizeUsername } from "../services/usernameValidation";
import { AppText, AppTextInput } from "../components/Typography";

type OnboardingProfileScreenProps = {
  user: AuthUser;
  theme: AppTheme;
  onProfileCompleted: (user: AuthUser) => void;
  onChooseDifferentLoginMethod: () => Promise<void>;
};

type UsernameFeedback = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const validateUsername = (value: string): UsernameFeedback => {
  if (!value) {
    return { tone: "neutral", message: "" };
  }

  if (!isUsernameFormatValid(value)) {
    return { tone: "error", message: "Use 3-16 chars: letters, numbers, underscore." };
  }

  return { tone: "neutral", message: "" };
};

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted, onChooseDifferentLoginMethod }: OnboardingProfileScreenProps) => {
  const defaultStatus = "Finish profile setup to continue.";
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState((user.username ?? "").toLowerCase());
  const [status, setStatus] = useState(defaultStatus);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; general?: string }>({});
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({ tone: "neutral", message: "" });

  useEffect(() => {
    let active = true;
    const normalized = normalizeUsername(username);
    const localValidation = validateUsername(normalized);

    if (!normalized) {
      setCheckingUsername(false);
      setUsernameFeedback({ tone: "neutral", message: "" });
      return;
    }

    if (localValidation.tone === "error") {
      setCheckingUsername(false);
      setUsernameFeedback(localValidation);
      return;
    }

    setCheckingUsername(false);
    const timeout = setTimeout(() => {
      setCheckingUsername(true);
      void (async () => {
        const availability = await checkUsernameAvailability(normalized);

        if (!active) {
          return;
        }

        setCheckingUsername(false);
        const unavailable = !availability.available && normalized !== user.usernameNormalized;

        if (availability.error) {
          setUsernameFeedback({ tone: "error", message: "Could not check username right now." });
          return;
        }

        if (unavailable) {
          setUsernameFeedback({ tone: "error", message: "This username is not available." });
          return;
        }

        setUsernameFeedback({ tone: "success", message: "This username is available." });
      })();
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [username, user.usernameNormalized]);

  const submitProfile = async (skipOptional: boolean) => {
    const nextDisplayName = displayName.trim();
    const nextUsername = normalizeUsername(username);

    if (!nextUsername) {
      setFieldErrors((prev) => ({ ...prev, username: "Username is required." }));
      return;
    }

    const validation = validateUsername(nextUsername);
    if (validation.tone === "error") {
      setFieldErrors((prev) => ({ ...prev, username: validation.message }));
      return;
    }

    setSaving(true);
    setFieldErrors((prev) => ({ ...prev, general: undefined }));

    try {
      const availability = await checkUsernameAvailability(nextUsername);
      if (availability.error) {
        setFieldErrors((prev) => ({ ...prev, general: "Could not check username right now." }));
        return;
      }

      if (!availability.available && nextUsername !== user.usernameNormalized) {
        setFieldErrors((prev) => ({ ...prev, username: "This username is not available." }));
        return;
      }

      if (availability.available) {
        await authService.reserveUsername(nextUsername, user.id);
      }

      const updatedUser = await authService.updateProfile(user.id, {
        displayName: skipOptional ? nextUsername : nextDisplayName || nextUsername,
        username: nextUsername
      });

      const profilePayload = {
        id: user.id,
        username: nextUsername,
        display_name: skipOptional ? nextUsername : nextDisplayName || nextUsername,
        email: user.email ?? null,
        avatar_path: updatedUser.avatarUrl ?? null,
        updated_at: new Date().toISOString()
      };

      const { error: userUpsertError } = await supabaseClient
        .from("users")
        .upsert(profilePayload, { onConflict: "id" });
      
      if (userUpsertError) {
        if (userUpsertError.code === "23505") {
          setFieldErrors((prev) => ({ ...prev, username: "This username is not available." }));
        } else {
          setFieldErrors((prev) => ({ ...prev, general: userUpsertError.message }));
        }
        return;
      }

      const completedUser: AuthUser = updatedUser.username
        ? updatedUser
        : {
            ...updatedUser,
            username: nextUsername,
            usernameNormalized: nextUsername
          };

      setStatus("Profile complete. Entering app…");
      onProfileCompleted(completedUser);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>Complete your profile</AppText>
      <AppText style={[styles.stepText, { color: theme.colors.textSecondary }]}>Step {step} of 2</AppText>
      <AppText style={{ color: theme.colors.textSecondary }}>
        {step === 1
          ? "Pick a unique username so friends can find you and mentions stay unambiguous."
          : "Display name and avatar are optional — you can personalize now or later."}
      </AppText>

      {step === 1 ? (
        <>
          <AppTextInput
            value={username}
            onChangeText={(value) => {
              const nextUsername = value.toLowerCase();
              setUsername(nextUsername);
              setFieldErrors((prev) => ({ ...prev, username: undefined }));

              if (validateUsername(nextUsername.trim()).tone !== "error") {
                setStatus(defaultStatus);
              }
            }}
            placeholder="Username"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            maxLength={16}
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
          />
          {fieldErrors.username ? <AppText style={styles.errorText}>{fieldErrors.username}</AppText> : null}
          <AppText style={{ color: usernameFeedback.tone === "error" ? "#d14343" : usernameFeedback.tone === "success" ? theme.colors.success : theme.colors.textSecondary }}>
            {checkingUsername ? "Checking availability…" : usernameFeedback.message}
          </AppText>

          <Pressable
            style={[styles.button, { backgroundColor: theme.colors.accent, opacity: saving || checkingUsername ? 0.6 : 1 }]}
            disabled={saving || checkingUsername}
            onPress={() => {
              const nextUsername = normalizeUsername(username);
              const validation = validateUsername(nextUsername);

              if (!nextUsername) {
                setFieldErrors((prev) => ({ ...prev, username: "Username is required." }));
                return;
              }

              if (validation.tone === "error") {
                setFieldErrors((prev) => ({ ...prev, username: validation.message }));
                return;
              }

              if (usernameFeedback.tone === "error") {
                setFieldErrors((prev) => ({ ...prev, username: usernameFeedback.message }));
                return;
              }

              setStep(2);
            }}
          >
            <AppText style={[styles.buttonText, { color: theme.colors.accentText }]}>Continue</AppText>
          </Pressable>
        </>
      ) : (
        <>
          <AppTextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
          />
          <AppText style={{ color: theme.colors.textSecondary }}>Avatar is optional and can be added later from profile settings.</AppText>

          <Pressable style={[styles.button, { backgroundColor: theme.colors.accent }]} disabled={saving} onPress={() => void submitProfile(false)}>
            <AppText style={[styles.buttonText, { color: theme.colors.accentText }]}>{saving ? "Saving…" : "Save and continue"}</AppText>
          </Pressable>

          <Pressable style={[styles.secondaryButton, { borderColor: theme.colors.border }]} disabled={saving} onPress={() => void submitProfile(true)}>
            <AppText style={[styles.buttonText, { color: theme.colors.textPrimary }]}>Skip for now</AppText>
          </Pressable>
        </>
      )}

      <Pressable
        style={styles.escapeButton}
        onPress={() => {
          void onChooseDifferentLoginMethod();
        }}
      >
        <AppText style={[styles.escapeText, { color: theme.colors.textSecondary }]}>Choose a different login method</AppText>
      </Pressable>

      {fieldErrors.general ? <AppText style={styles.errorText}>{fieldErrors.general}</AppText> : null}
      <AppText style={{ color: theme.colors.success }}>{status}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.lg, gap: spacingTokens.sm },
  title: { fontSize: 20, fontWeight: "600" },
  stepText: { fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radiusTokens.sm, paddingHorizontal: 10, paddingVertical: 8 },
  button: { borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  secondaryButton: { borderWidth: 1, borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  escapeButton: { alignItems: "flex-start", paddingVertical: 4 },
  escapeText: { textDecorationLine: "underline" },
  errorText: { color: "#d14343" },
  buttonText: { fontWeight: "600" }
});
