import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, View, useColorScheme } from "react-native";
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

  const username = profile.username?.trim() ? profile.username.trim() : authUser.username;

  return {
    ...authUser,
    username,
    usernameNormalized: username?.toLowerCase() ?? authUser.usernameNormalized,
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
    needsOnboarding: !normalizedProfile
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
      const result = await supabaseClient.from("groups").select("id,name,description,avatar_path").order("created_at", { ascending: false });
      if (cancelled) {
        return;
      }

      if (result.error) {
        setGroups([]);
        setGroupStatus("error");
        setGroupError(result.error.message);
        return;
      }

      const loaded = (result.data as GroupEntity[] | null) ?? [];
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
                group={groups[0] ? { name: groups[0].name, description: groups[0].description, coverUrl: mapAvatarPathToUiValue(groups[0].avatar_path) } : undefined}
                status={groupStatus}
                errorMessage={groupError}
                theme={theme}
              />
            )}
            <BottomTabs activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
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
  authLoadingText: { fontSize: 14 }
});
