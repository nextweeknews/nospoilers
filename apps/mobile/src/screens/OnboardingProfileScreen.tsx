import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";
import { supabaseClient } from "../services/supabaseClient";
import { AppText, AppTextInput } from "../components/Typography";

type OnboardingProfileScreenProps = {
  user: AuthUser;
  theme: AppTheme;
  onProfileCompleted: (user: AuthUser) => void;
};

type UsernameFeedback = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const validateUsername = (value: string): UsernameFeedback => {
  if (!value) {
    return { tone: "neutral", message: "Username must be at least 3 characters." };
  }
  if (value.length < 3) {
    return { tone: "error", message: "Usernames must be 3 characters." };
  }
  if (value.length > 16) {
    return { tone: "error", message: "Usernames must be 16 characters or fewer." };
  }
  if (!/^[a-z0-9.]+$/.test(value)) {
    return { tone: "error", message: "Usernames must contain only letters, numbers, and periods." };
  }
  if (value.includes("..")) {
    return { tone: "error", message: "Usernames may not contain consecutive periods." };
  }
  return { tone: "neutral", message: "Checking username availability..." };
};

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted }: OnboardingProfileScreenProps) => {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState((user.username ?? "").toLowerCase());
  const [status, setStatus] = useState("Finish profile setup to continue.");
  const [saving, setSaving] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({ tone: "neutral", message: "Username must be at least 3 characters." });

  useEffect(() => {
    let active = true;
    const normalized = username.trim().toLowerCase();
    const localValidation = validateUsername(normalized);
    if (localValidation.tone === "error" || !normalized) {
      setUsernameFeedback(localValidation);
      return;
    }

    const timeout = setTimeout(() => {
      void (async () => {
        const [availability, dbResult] = await Promise.all([
          authService.checkUsernameAvailability(normalized),
          supabaseClient.from("profiles").select("id", { count: "exact", head: true }).eq("username", normalized).neq("id", user.id)
        ]);

        if (!active) {
          return;
        }

        const takenInDb = !dbResult.error && (dbResult.count ?? 0) > 0;
        const unavailableInAuth = !availability.available && availability.normalized !== user.usernameNormalized;

        if (unavailableInAuth || takenInDb) {
          setUsernameFeedback({ tone: "error", message: "This username is not available." });
          return;
        }

        setUsernameFeedback({ tone: "success", message: "This username is available." });
      })();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [username, user.id, user.usernameNormalized]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>Complete your profile</AppText>
      <AppText style={{ color: theme.colors.textSecondary }}>Add a username before entering NoSpoilers. Display name is optional and defaults to your username.</AppText>
      <AppTextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <AppTextInput value={username} onChangeText={(value) => setUsername(value.toLowerCase())} placeholder="Username" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="none" maxLength={16} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <AppText style={{ color: usernameFeedback.tone === "error" ? "#d14343" : usernameFeedback.tone === "success" ? theme.colors.success : theme.colors.textSecondary }}>{usernameFeedback.message}</AppText>

      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
        disabled={saving}
        onPress={async () => {
          const nextDisplayName = displayName.trim();
          const nextUsername = username.trim().toLowerCase();

          if (!nextUsername) {
            setStatus("Username is required.");
            return;
          }

          const validation = validateUsername(nextUsername);
          if (validation.tone === "error") {
            setStatus(validation.message);
            return;
          }

          if (usernameFeedback.tone !== "success" && user.usernameNormalized !== nextUsername) {
            setStatus("Choose an available username to continue.");
            return;
          }

          setSaving(true);
          try {
            const availability = await authService.checkUsernameAvailability(nextUsername);
            if (!availability.available && availability.normalized !== user.usernameNormalized) {
              setStatus("This username is not available.");
              return;
            }

            if (availability.available) {
              await authService.reserveUsername(nextUsername, user.id);
            }

            const updatedUser = await authService.updateProfile(user.id, {
              displayName: nextDisplayName || nextUsername,
              username: nextUsername
            });

            setStatus("Profile complete. Entering app…");
            onProfileCompleted(updatedUser);
          } finally {
            setSaving(false);
          }
        }}
      >
        <AppText style={[styles.buttonText, { color: theme.colors.accentText }]}>{saving ? "Saving…" : "Save and continue"}</AppText>
      </Pressable>

      <AppText style={{ color: theme.colors.success }}>{status}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.lg, gap: spacingTokens.sm },
  title: { fontSize: 20, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radiusTokens.sm, paddingHorizontal: 10, paddingVertical: 8 },
  button: { borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  buttonText: { fontWeight: "600" }
});
