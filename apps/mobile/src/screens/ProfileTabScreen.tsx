import type { AuthUser } from "../../../../services/auth/src";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../components/Typography";

export const ProfileTabScreen = ({ theme, user, onEditProfile, onAccountSettings }: { theme: AppTheme; user: AuthUser; onEditProfile: () => void; onAccountSettings: () => void }) => (
  <View style={[styles.root, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceMuted }]} />
    <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>@{user.username ?? "pending"}</AppText>
    <AppText style={{ color: theme.colors.textSecondary }}>{user.displayName ?? "No display name"}</AppText>
    <View style={styles.actions}>
      <Pressable onPress={onEditProfile} style={[styles.button, { borderColor: theme.colors.border }]}><AppText>Edit profile</AppText></Pressable>
      <Pressable onPress={onAccountSettings} style={[styles.button, { borderColor: theme.colors.border }]}><AppText>Account settings</AppText></Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, gap: spacingTokens.sm },
  avatar: { width: 72, height: 72, borderRadius: 999 },
  actions: { flexDirection: "row", gap: spacingTokens.sm },
  button: { borderWidth: 1, borderRadius: radiusTokens.md, paddingHorizontal: spacingTokens.md, paddingVertical: spacingTokens.sm }
});
