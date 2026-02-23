import { useEffect, useMemo, useState } from "react";
import type { Group } from "@nospoilers/types";
import type { AuthUser, ProviderLoginResult } from "@nospoilers/auth";
import { createTheme, resolveThemePreference, spacingTokens, type ThemeMode, type ThemePreference } from "@nospoilers/ui";
import { BottomNav } from "./components/BottomNav";
import { GroupScreen } from "./screens/GroupScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ProfileSettingsScreen } from "./screens/ProfileSettingsScreen";
import { webConfig } from "./config/env";

const THEME_KEY = "nospoilers:web:theme-preference";

const demoGroup: Group = {
  id: "group-1",
  name: "Mystery Readers Club",
  description: "Spoiler-safe discussions by chapter milestones.",
  coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200",
  activeMediaId: "media-1",
  media: [
    {
      id: "media-1",
      kind: "book",
      title: "The Last Heist",
      coverUrl: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=300",
      progress: { completed: 6, total: 12 }
    }
  ]
};

const getSystemMode = (): ThemeMode => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const App = () => {
  const [activeTab, setActiveTab] = useState("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [systemMode, setSystemMode] = useState<ThemeMode>(() => getSystemMode());
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const selectedMedia = useMemo(() => demoGroup.media[0], []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const onSignedIn = (result: ProviderLoginResult) => {
    setCurrentUser(result.user);
    if (result.user.preferences?.themePreference) {
      setThemePreference(result.user.preferences.themePreference);
    }
  };

  const onThemePreferenceChanged = (next: ThemePreference) => {
    setThemePreference(next);
    window.localStorage.setItem(THEME_KEY, next);
  };

  const theme = createTheme(resolveThemePreference(systemMode, themePreference));

  return (
    <div style={{ minHeight: "100vh", background: theme.colors.background, padding: spacingTokens.xl, display: "grid", gap: spacingTokens.md }}>
      <p style={{ color: theme.colors.textSecondary }}>
        Env: {webConfig.environment} • API: {webConfig.apiBaseUrl} • Auth Client: {webConfig.authClientId}
      </p>
      <LoginScreen onSignedIn={onSignedIn} theme={theme} />
      {activeTab === "account" ? (
        <ProfileSettingsScreen
          userId={currentUser?.id}
          onProfileUpdated={setCurrentUser}
          onThemePreferenceChanged={onThemePreferenceChanged}
          themePreference={themePreference}
          theme={theme}
        />
      ) : (
        <GroupScreen group={demoGroup} selectedMedia={selectedMedia} theme={theme} />
      )}
      <BottomNav activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
    </div>
  );
};
