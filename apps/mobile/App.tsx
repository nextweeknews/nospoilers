import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View, useColorScheme } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser, ProviderLoginResult } from "../../services/auth/src";
import { createTheme, resolveThemePreference, spacingTokens, type ThemePreference } from "@nospoilers/ui";
import { GroupScreen } from "./src/screens/GroupScreen";
import { BottomTabs } from "./src/components/BottomTabs";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ProfileSettingsScreen } from "./src/screens/ProfileSettingsScreen";
import { OnboardingProfileScreen } from "./src/screens/OnboardingProfileScreen";
import { mobileConfig } from "./src/config/env";
import { supabaseClient } from "./src/services/supabaseClient";

type GroupEntity = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
};

type GroupLoadStatus = "loading" | "ready" | "empty" | "error";

const hasCompleteProfile = (user: AuthUser): boolean => Boolean(user.displayName?.trim() && user.username?.trim() && user.avatarUrl?.trim());

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

export default function App() {
  const [activeTab, setActiveTab] = useState("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [groupStatus, setGroupStatus] = useState<GroupLoadStatus>("loading");
  const [groupError, setGroupError] = useState<string>();
  const [groups, setGroups] = useState<GroupEntity[]>([]);
  const [authResolved, setAuthResolved] = useState(false);
  const colorScheme = useColorScheme();
  const theme = createTheme(resolveThemePreference(colorScheme === "dark" ? "dark" : "light", themePreference));

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user) {
        setCurrentUser(mapUser(data.session.user, data.session));
      } else {
        setCurrentUser(undefined);
      }
      setAuthResolved(true);
    };

    void syncSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(mapUser(session.user, session));
      } else {
        setCurrentUser(undefined);
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
      const result = await supabaseClient.from("groups").select("id,name,description,cover_url").order("created_at", { ascending: false });
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
    setCurrentUser(result.user);
    setThemePreference(result.user.preferences?.themePreference ?? "system");
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.container, { padding: spacingTokens.lg }]}>
        <Text style={[styles.configText, { color: theme.colors.textSecondary }]}> 
          Env {mobileConfig.environment} · API {mobileConfig.apiBaseUrl} · Auth {mobileConfig.authClientId}
        </Text>
        {!authResolved || !currentUser ? (
          <LoginScreen onSignedIn={onSignedIn} theme={theme} />
        ) : !hasCompleteProfile(currentUser) ? (
          <OnboardingProfileScreen user={currentUser} theme={theme} onProfileCompleted={setCurrentUser} />
        ) : (
          <>
            {activeTab === "account" ? (
              <ProfileSettingsScreen
                user={currentUser}
                onProfileUpdated={setCurrentUser}
                onAccountDeleted={() => {
                  setCurrentUser(undefined);
                  setActiveTab("groups");
                }}
                theme={theme}
                themePreference={themePreference}
                onThemePreferenceChanged={setThemePreference}
              />
            ) : (
              <GroupScreen
                group={groups[0] ? { name: groups[0].name, description: groups[0].description, coverUrl: groups[0].cover_url } : undefined}
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
  configText: { fontSize: 12 }
});
