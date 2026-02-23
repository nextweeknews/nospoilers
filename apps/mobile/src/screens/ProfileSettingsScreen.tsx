import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { AuthUser } from "@nospoilers/auth";
import { authService } from "../services/authClient";

type ProfileSettingsScreenProps = {
  userId?: string;
  onProfileUpdated: (user: AuthUser) => void;
};

export const ProfileSettingsScreen = ({ userId, onProfileUpdated }: ProfileSettingsScreenProps) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("Sign in to edit account settings.");

  if (!userId) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Sign in first, then open Account to edit your profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account settings</Text>

      <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor="#64748b" style={styles.input} />
      <Pressable
        style={styles.button}
        onPress={async () => {
          const user = await authService.updateProfile(userId, { displayName });
          setStatus(`Saved display name: ${user.displayName ?? "(none)"}`);
          onProfileUpdated(user);
        }}
      >
        <Text style={styles.buttonText}>Save display name</Text>
      </Pressable>

      <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#64748b" style={styles.input} />
      <Pressable
        style={styles.button}
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
        <Text style={styles.buttonText}>Reserve + save username</Text>
      </Pressable>

      <Pressable
        style={styles.button}
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
        <Text style={styles.buttonText}>Update avatar</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: "#111827", borderRadius: 12, padding: 16, gap: 10 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#1e293b"
  },
  button: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#eff6ff", fontWeight: "600" },
  status: { color: "#a7f3d0" }
});
