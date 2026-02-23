import { useMemo, useState } from "react";
import type { Group } from "@nospoilers/types";
import type { AuthUser, ProviderLoginResult } from "@nospoilers/auth";
import { colorTokens, spacingTokens } from "@nospoilers/ui";
import { BottomNav } from "./components/BottomNav";
import { GroupScreen } from "./screens/GroupScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ProfileSettingsScreen } from "./screens/ProfileSettingsScreen";
import { webConfig } from "./config/env";

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

export const App = () => {
  const [activeTab, setActiveTab] = useState("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const selectedMedia = useMemo(() => demoGroup.media[0], []);

  const onSignedIn = (result: ProviderLoginResult) => {
    setCurrentUser(result.user);
  };

  return (
    <div style={{ minHeight: "100vh", background: colorTokens.background, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.md }}>
      <p style={{ color: colorTokens.textSecondary }}>
        Env: {webConfig.environment} • API: {webConfig.apiBaseUrl} • Auth Client: {webConfig.authClientId}
      </p>
      <LoginScreen onSignedIn={onSignedIn} />
      {activeTab === "account" ? (
        <ProfileSettingsScreen userId={currentUser?.id} onProfileUpdated={setCurrentUser} />
      ) : (
        <GroupScreen group={demoGroup} selectedMedia={selectedMedia} />
      )}
      <BottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </div>
  );
};
