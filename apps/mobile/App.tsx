import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View, useColorScheme } from "react-native";
import type { Group } from "@nospoilers/types";
import type { AuthUser, ProviderLoginResult } from "@nospoilers/auth";
import { createTheme, resolveThemePreference, spacingTokens, type ThemePreference } from "@nospoilers/ui";
import { GroupScreen } from "./src/screens/GroupScreen";
import { BottomTabs } from "./src/components/BottomTabs";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ProfileSettingsScreen } from "./src/screens/ProfileSettingsScreen";
import { mobileConfig } from "./src/config/env";

const demoGroup: Group = {
  id: "group-1",
  name: "Mystery Readers Club",
  description: "Spoiler-safe discussions by chapter milestones.",
  coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200",
  activeMediaId: "media-1",
  media: [
    {
      id: "media-1",
      kind: "show",
      title: "Quiet Harbor",
      coverUrl: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300",
      progress: { completed: 3, total: 8 }
    }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const colorScheme = useColorScheme();
  const theme = createTheme(resolveThemePreference(colorScheme === "dark" ? "dark" : "light", themePreference));
  const selectedMedia = demoGroup.media[0];

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
        <LoginScreen onSignedIn={onSignedIn} theme={theme} />
        {activeTab === "account" ? (
          <ProfileSettingsScreen
            userId={currentUser?.id}
            onProfileUpdated={setCurrentUser}
            theme={theme}
            themePreference={themePreference}
            onThemePreferenceChanged={setThemePreference}
          />
        ) : (
          <GroupScreen group={demoGroup} selectedMedia={selectedMedia} theme={theme} />
        )}
        <BottomTabs activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, gap: 12 },
  configText: { fontSize: 12 }
});
