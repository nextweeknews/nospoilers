import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { AuthUser } from "@nospoilers/auth";
import { radiusTokens, spacingTokens, type AppTheme, type ThemePreference } from "@nospoilers/ui";
import { authService } from "../services/authClient";

type ProfileSettingsScreenProps = {
  userId?: string;
  onProfileUpdated: (user: AuthUser) => void;
  theme: AppTheme;
  themePreference: ThemePreference;
  onThemePreferenceChanged: (next: ThemePreference) => void;
};

export const ProfileSettingsScreen = ({ userId, onProfileUpdated, theme, themePreference, onThemePreferenceChanged }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("Sign in to edit account settings.");

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.status, { color: theme.colors.textSecondary }]}>Sign in first, then open Account to edit your profile.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Account settings</Text>

      <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const user = await authService.updateProfile(userId, { displayName });
          setStatus(`Saved display name: ${user.displayName ?? "(none)"}`);
          onProfileUpdated(user);
        }}
      >
        <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Save display name</Text>
      </Pressable>

      <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const availability = await authService.checkUsernameAvailability(username);
          if (!availability.available) {
            setStatus(`Username unavailable (${availability.reason ?? "unknown"}).`);
            return;
          }
          await authService.reserveUsername(username, userId);
          const user = await authService.updateProfile(userId, { username });
          setStatus(`Saved username: @${user.username}`);
          onProfileUpdated(user);
        }}
      >
        <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Reserve + save username</Text>
      </Pressable>

      <Text style={[styles.status, { color: theme.colors.textSecondary }]}>Theme preference</Text>
      <View style={styles.themeRow}>
        {(["system", "light", "dark"] as ThemePreference[]).map((option) => (
          <Pressable
            key={option}
            style={[
              styles.themeChoice,
              {
                borderColor: theme.colors.border,
                backgroundColor: option === themePreference ? theme.colors.accent : theme.colors.surfaceMuted
              }
            ]}
            onPress={async () => {
              const user = await authService.updateProfile(userId, { themePreference: option });
              onProfileUpdated(user);
              onThemePreferenceChanged(option);
              setStatus(`Theme preference saved as ${option}.`);
            }}
          >
            <Text style={{ color: option === themePreference ? theme.colors.accentText : theme.colors.textPrimary }}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: theme.colors.accent }]}
        onPress={async () => {
          const upload = await authService.createAvatarUploadPlan(userId, {
            fileName: "mobile-avatar.png",
            contentType: "image/png",
            bytes: 240_000,
            width: 512,
            height: 512
          });
          const user = await authService.finalizeAvatarUpload(userId, upload.uploadId, {
            contentType: "image/png",
            bytes: 240_000,
            width: 512,
            height: 512
          });
          setStatus(`Avatar updated with signed upload URL (${upload.uploadId}).`);
          onProfileUpdated(user);
        }}
      >
        <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Update avatar</Text>
      </Pressable>

      <Text style={[styles.status, { color: theme.colors.success }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: radiusTokens.md, padding: spacingTokens.lg, gap: spacingTokens.sm, borderWidth: 1 },
  title: { fontSize: 20, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: radiusTokens.sm,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  button: { borderRadius: radiusTokens.sm, paddingVertical: 10, alignItems: "center" },
  buttonText: { fontWeight: "600" },
  status: {},
  themeRow: { flexDirection: "row", gap: spacingTokens.sm },
  themeChoice: { flex: 1, borderWidth: 1, borderRadius: radiusTokens.sm, alignItems: "center", paddingVertical: 8 }
});
