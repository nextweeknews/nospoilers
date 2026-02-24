import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, View, useColorScheme } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser, ProviderLoginResult } from "../../services/auth/src";
import { createTheme, resolveThemePreference, spacingTokens, type ThemePreference } from "@nospoilers/ui";
import { mapAvatarPathToUiValue, type SupabaseGroupRow, type SupabaseUserProfileRow } from "@nospoilers/types";
import { GroupScreen } from "./src/screens/GroupScreen";
import { BottomTabs } from "./src/components/BottomTabs";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ProfileSettingsScreen } from "./src/screens/ProfileSettingsScreen";
import { OnboardingProfileScreen } from "./src/screens/OnboardingProfileScreen";
import { mobileConfig } from "./src/config/env";
import { getSession, onAuthStateChange, signOut } from "./src/services/authClient";
import { supabaseClient } from "./src/services/supabaseClient";
import { AppText } from "./src/components/Typography";
import { profileNeedsOnboarding } from "./src/profileOnboarding";

type GroupEntity = SupabaseGroupRow;

type GroupLoadStatus = "loading" | "ready" | "empty" | "error";


const mapUser = (user: User, session: Session): AuthUser => ({
  id: user.id,
  email: user.email,
  primaryPhone: user.phone,
  identities: (user.identities ?? []).map((identity) => ({
    provider: identity.provider === "sms" ? "phone" : (identity.provider as "google" | "email"),
    subject: identity.identity_id,
    verified: Boolean(identity.last_sign_in_at)
  })),
  createdAt: user.created_at,
  updatedAt: user.updated_at ?? user.created_at,
  displayName: (user.user_metadata.full_name as string | undefined) ?? (user.user_metadata.name as string | undefined),
  avatarUrl: user.user_metadata.avatar_url as string | undefined,
  preferences: { themePreference: session.user.user_metadata.theme_preference as ThemePreference | undefined }
});



type ProfileRecord = SupabaseUserProfileRow;

const mergeProfileIntoUser = (authUser: AuthUser, profile?: ProfileRecord | null): AuthUser => {
  if (!profile) {
    return authUser;
  }

  const normalizedUsername = profile.username?.trim();
  const username = normalizedUsername || authUser.username;

  return {
    ...authUser,
    username,
    usernameNormalized: normalizedUsername ? normalizedUsername.toLowerCase() : authUser.usernameNormalized,
    displayName: profile.display_name?.trim() ? profile.display_name.trim() : authUser.displayName,
    avatarUrl: mapAvatarPathToUiValue(profile.avatar_path) ?? authUser.avatarUrl
  };
};

const mapUserWithProfile = async (user: User, session: Session): Promise<{ user: AuthUser; needsOnboarding: boolean }> => {
  const mappedUser = mapUser(user, session);
  const { data: profile } = await supabaseClient.from("users").select("id,username,display_name,avatar_path").eq("id", user.id).maybeSingle();
  const normalizedProfile = (profile as ProfileRecord | null) ?? null;

  return {
    user: mergeProfileIntoUser(mappedUser, normalizedProfile),
    needsOnboarding: profileNeedsOnboarding(normalizedProfile)
  };
};
export default function App() {
  const [activeTab, setActiveTab] = useState("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [groupStatus, setGroupStatus] = useState<GroupLoadStatus>("loading");
  const [groupError, setGroupError] = useState<string>();
  const [groups, setGroups] = useState<GroupEntity[]>([]);
  const [authResolved, setAuthResolved] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showCreateGroupSheet, setShowCreateGroupSheet] = useState(false);
  const colorScheme = useColorScheme();
  const theme = createTheme(resolveThemePreference(colorScheme === "dark" ? "dark" : "light", themePreference));

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await getSession();
      if (data.session?.user) {
        const mapped = await mapUserWithProfile(data.session.user, data.session);
        setCurrentUser(mapped.user);
        setNeedsOnboarding(mapped.needsOnboarding);
      } else {
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
      setAuthResolved(true);
    };

    void syncSession();

    const { data } = onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const mapped = await mapUserWithProfile(session.user, session);
        setCurrentUser(mapped.user);
        setNeedsOnboarding(mapped.needsOnboarding);
      } else {
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
      setAuthResolved(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setGroupStatus("loading");
      setGroupError(undefined);
      return;
    }

    let cancelled = false;

    const loadGroups = async () => {
      setGroupStatus("loading");
      const result = await supabaseClient
        .from("group_memberships")
        .select("groups(id,name,description,avatar_path)")
        .eq("user_id", currentUser.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (cancelled) {
        return;
      }

      if (result.error) {
        setGroups([]);
        setGroupStatus("error");
        setGroupError(result.error.message);
        return;
      }

      const memberships = (result.data as Array<{ groups: GroupEntity | GroupEntity[] | null }> | null) ?? [];
      const loaded = memberships
        .flatMap((membership) => (Array.isArray(membership.groups) ? membership.groups : membership.groups ? [membership.groups] : []));
      setGroups(loaded);
      setGroupStatus(loaded.length ? "ready" : "empty");
      setGroupError(undefined);
    };

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const onSignedIn = (result: ProviderLoginResult) => {
    setThemePreference(result.user.preferences?.themePreference ?? "system");
  };

  const onChooseDifferentLoginMethod = async () => {
    await signOut();
    setCurrentUser(undefined);
    setNeedsOnboarding(false);
    setAuthResolved(true);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.container, { padding: spacingTokens.lg }]}>
        <AppText style={[styles.configText, { color: theme.colors.textSecondary }]}> 
          Env {mobileConfig.environment} · API {mobileConfig.apiBaseUrl} · Auth {mobileConfig.authClientId}
        </AppText>
        {!authResolved ? (
          <View style={styles.authLoadingState}>
            <ActivityIndicator color={theme.colors.accent} />
            <AppText style={[styles.authLoadingText, { color: theme.colors.textSecondary }]}>Signing you in…</AppText>
          </View>
        ) : !currentUser ? (
          <LoginScreen onSignedIn={onSignedIn} theme={theme} />
        ) : needsOnboarding ? (
          <OnboardingProfileScreen
            user={currentUser}
            theme={theme}
            onProfileCompleted={(user) => {
              setCurrentUser(user);
              setNeedsOnboarding(false);
            }}
            onChooseDifferentLoginMethod={onChooseDifferentLoginMethod}
          />
        ) : (
          <>
            {activeTab === "account" ? (
              <ProfileSettingsScreen
                user={currentUser}
                onProfileUpdated={setCurrentUser}
                onAccountDeleted={() => {
                  setCurrentUser(undefined);
                  setNeedsOnboarding(false);
                  setActiveTab("groups");
                }}
                theme={theme}
                themePreference={themePreference}
                onThemePreferenceChanged={setThemePreference}
              />
            ) : (
              <GroupScreen
                groups={groups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  coverUrl: mapAvatarPathToUiValue(group.avatar_path)
                }))}
                status={groupStatus}
                errorMessage={groupError}
                onCreateGroup={() => setShowCreateGroupSheet(true)}
                theme={theme}
              />
            )}
            <BottomTabs activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
            <Modal visible={showCreateGroupSheet} transparent animationType="slide" onRequestClose={() => setShowCreateGroupSheet(false)}>
              <View style={styles.modalBackdrop}>
                <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <AppText style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Create group</AppText>
                  <AppText style={[styles.modalBody, { color: theme.colors.textSecondary }]}>This placeholder sheet confirms the create-group flow is wired. Full group creation is coming next.</AppText>
                  <Pressable onPress={() => setShowCreateGroupSheet(false)} style={[styles.modalButton, { backgroundColor: theme.colors.accent }]}>
                    <AppText style={{ color: theme.colors.accentText, fontWeight: "700" }}>Close</AppText>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, gap: 12 },
  configText: { fontSize: 12 },
  authLoadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  authLoadingText: { fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", padding: spacingTokens.lg },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: spacingTokens.lg, gap: spacingTokens.sm },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { fontSize: 14 },
  modalButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: spacingTokens.sm }
});
