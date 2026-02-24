import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme, type ThemePreference } from "@nospoilers/ui";
import {
  authRedirectTo,
  authService,
  completeOAuthSession,
  deleteAccount,
  getAuthUser,
  linkEmailPasswordIdentity,
  linkGoogleIdentity,
  linkPhoneIdentity,
  reauthenticateForIdentityLink
} from "../services/authClient";

type ProfileSettingsScreenProps = {
  user?: AuthUser;
  onProfileUpdated: (user: AuthUser) => void;
  onAccountDeleted: () => void;
  theme: AppTheme;
  themePreference: ThemePreference;
  onThemePreferenceChanged: (next: ThemePreference) => void;
};

export const ProfileSettingsScreen = ({ user, onProfileUpdated, onAccountDeleted, theme, themePreference, onThemePreferenceChanged }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [status, setStatus] = useState("Sign in to edit account settings.");

  const identityStatus = useMemo(() => {
    const providers = new Set((user?.identities ?? []).map((identity) => identity.provider));
    return {
      phone: providers.has("phone"),
      google: providers.has("google"),
      email: providers.has("email")
    };
  }, [user]);

  const refreshIdentityState = async () => {
    if (!user) {
      return;
    }

    const { data, error } = await getAuthUser();
    if (error || !data.user) {
      setStatus(error?.message ?? "Unable to refresh identity status.");
      return;
    }

    const identities = (data.user.identities ?? []).map((identity) => ({
      provider: identity.provider === "sms" ? "phone" : (identity.provider as "phone" | "google" | "email"),
      subject: identity.identity_id,
      verified: Boolean(identity.last_sign_in_at)
    }));

    onProfileUpdated({
      ...user,
      email: data.user.email,
      primaryPhone: data.user.phone,
      identities
    });
  };

  if (!user) {
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
          const updatedUser = await authService.updateProfile(user.id, { displayName });
          setStatus(`Saved display name: ${updatedUser.displayName ?? "(none)"}`);
          onProfileUpdated(updatedUser);
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
          await authService.reserveUsername(username, user.id);
          const updatedUser = await authService.updateProfile(user.id, { username });
          setStatus(`Saved username: @${updatedUser.username}`);
          onProfileUpdated(updatedUser);
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
              const updatedUser = await authService.updateProfile(user.id, { themePreference: option });
              onProfileUpdated(updatedUser);
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
          const upload = await authService.createAvatarUploadPlan(user.id, {
            fileName: "mobile-avatar.png",
            contentType: "image/png",
            bytes: 240_000,
            width: 512,
            height: 512
          });
          const updatedUser = await authService.finalizeAvatarUpload(user.id, upload.uploadId, {
            contentType: "image/png",
            bytes: 240_000,
            width: 512,
            height: 512
          });
          setStatus(`Avatar updated with signed upload URL (${upload.uploadId}).`);
          onProfileUpdated(updatedUser);
        }}
      >
        <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Update avatar</Text>
      </Pressable>

      <View style={[styles.linkSection, { borderTopColor: theme.colors.border }]}> 
        <Text style={[styles.subtitle, { color: theme.colors.textPrimary }]}>Connected sign-in methods</Text>
        <Text style={[styles.status, { color: theme.colors.textSecondary }]}>Phone: {identityStatus.phone ? "Connected" : "Not connected"} · Google: {identityStatus.google ? "Connected" : "Not connected"} · Email/password: {identityStatus.email ? "Connected" : "Not connected"}</Text>

        <TextInput value={linkPhone} onChangeText={setLinkPhone} placeholder="Phone for linking" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        <Pressable
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
          onPress={async () => {
            await reauthenticateForIdentityLink();
            const { error } = await linkPhoneIdentity(linkPhone);
            if (error) {
              setStatus(error.message);
              return;
            }
            await refreshIdentityState();
            setStatus("Phone link started. Verify OTP sent to complete linking.");
          }}
        >
          <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Link phone</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
          onPress={async () => {
            await reauthenticateForIdentityLink();
            const { data, error } = await linkGoogleIdentity();
            if (error || !data?.url) {
              setStatus(error?.message ?? "Unable to start Google link flow.");
              return;
            }

            const oauthResult = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo);
            if (oauthResult.type !== "success" || !oauthResult.url) {
              setStatus("Google link cancelled.");
              return;
            }

            const { error: sessionError } = await completeOAuthSession(oauthResult.url);
            if (sessionError) {
              setStatus(sessionError.message);
              return;
            }

            await refreshIdentityState();
            setStatus("Google identity linked.");
          }}
        >
          <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Link Google</Text>
        </Pressable>

        <TextInput value={linkEmail} onChangeText={setLinkEmail} placeholder="Email for linking" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        <TextInput value={linkPassword} onChangeText={setLinkPassword} placeholder="Password for linking" placeholderTextColor={theme.colors.textSecondary} secureTextEntry style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        <Pressable
          style={[styles.button, { backgroundColor: theme.colors.accent }]}
          onPress={async () => {
            await reauthenticateForIdentityLink();
            const { error } = await linkEmailPasswordIdentity(linkEmail, linkPassword);
            if (error) {
              setStatus(error.message);
              return;
            }
            await refreshIdentityState();
            setStatus("Email/password linked. Check your email if verification is required.");
          }}
        >
          <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Link email/password</Text>
        </Pressable>
      </View>

      <View style={[styles.linkSection, { borderTopColor: theme.colors.border }]}> 
        <Text style={[styles.subtitle, { color: "#b42318" }]}>Delete account</Text>
        <Text style={[styles.status, { color: theme.colors.textSecondary }]}>Permanent warning: this deletes your profile and identities, revokes all sessions, and cannot be undone.</Text>
        <TextInput value={deleteConfirmation} onChangeText={setDeleteConfirmation} placeholder='Type "DELETE" to enable' placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]} />
        <Pressable
          disabled={deleteConfirmation !== "DELETE"}
          style={[styles.button, { backgroundColor: "#b42318", opacity: deleteConfirmation === "DELETE" ? 1 : 0.6 }]}
          onPress={() => {
            Alert.alert("Delete account permanently?", "This cannot be undone. Your profile, identities, and active sessions will be removed.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete permanently",
                style: "destructive",
                onPress: async () => {
                  const { error } = await deleteAccount();
                  if (error) {
                    setStatus(`Delete failed: ${error.message}`);
                    return;
                  }
                  onAccountDeleted();
                }
              }
            ]);
          }}
        >
          <Text style={[styles.buttonText, { color: "#fff" }]}>Delete account permanently</Text>
        </Pressable>
      </View>

      <Text style={[styles.status, { color: theme.colors.success }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: radiusTokens.md, padding: spacingTokens.lg, gap: spacingTokens.sm, borderWidth: 1 },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: { fontSize: 16, fontWeight: "600" },
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
  themeChoice: { flex: 1, borderWidth: 1, borderRadius: radiusTokens.sm, alignItems: "center", paddingVertical: 8 },
  linkSection: { marginTop: 6, borderTopWidth: 1, paddingTop: 8, gap: spacingTokens.sm }
});
