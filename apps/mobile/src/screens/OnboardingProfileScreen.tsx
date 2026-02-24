import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { authService } from "../services/authClient";
import { AppText, AppTextInput } from "../components/Typography";

type OnboardingProfileScreenProps = {
  user: AuthUser;
  theme: AppTheme;
  onProfileCompleted: (user: AuthUser) => void;
};

const isBlank = (value?: string): boolean => !value || value.trim().length === 0;

export const OnboardingProfileScreen = ({ user, theme, onProfileCompleted }: OnboardingProfileScreenProps) => {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [status, setStatus] = useState("Finish profile setup to continue.");
  const [saving, setSaving] = useState(false);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (isBlank(displayName)) {
      missing.push("display name");
    }
    if (isBlank(username)) {
      missing.push("username");
    }
    if (isBlank(user.avatarUrl)) {
      missing.push("avatar");
    }
    return missing;
  }, [displayName, username, user.avatarUrl]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>Complete your profile</AppText>
      <AppText style={{ color: theme.colors.textSecondary }}>Add all required profile fields before entering NoSpoilers.</AppText>
      <AppText style={{ color: theme.colors.textSecondary }}>Missing: {missingFields.join(", ") || "none"}</AppText>

      <AppTextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <AppTextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={theme.colors.textSecondary} autoCapitalize="none" style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />

      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
        disabled={saving}
        onPress={async () => {
          const nextDisplayName = displayName.trim();
          const nextUsername = username.trim();

          if (!nextDisplayName || !nextUsername) {
            setStatus("Display name and username are required.");
            return;
          }

          setSaving(true);
          try {
            const availability = await authService.checkUsernameAvailability(nextUsername);
            if (!availability.available && availability.normalized !== user.usernameNormalized) {
              setStatus(`Username unavailable (${availability.reason ?? "unknown"}).`);
              return;
            }

            if (availability.available) {
              await authService.reserveUsername(nextUsername, user.id);
            }

            let updatedUser = await authService.updateProfile(user.id, {
              displayName: nextDisplayName,
              username: nextUsername
            });

            if (isBlank(updatedUser.avatarUrl)) {
              const upload = await authService.createAvatarUploadPlan(user.id, {
                fileName: "mobile-avatar.png",
                contentType: "image/png",
                bytes: 240_000,
                width: 512,
                height: 512
              });

              updatedUser = await authService.finalizeAvatarUpload(user.id, upload.uploadId, {
                contentType: "image/png",
                bytes: 240_000,
                width: 512,
                height: 512
              });
            }

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
