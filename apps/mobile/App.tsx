import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { Group } from "@nospoilers/types";
import { GroupScreen } from "./src/screens/GroupScreen";
import { BottomTabs } from "./src/components/BottomTabs";
import { LoginScreen } from "./src/screens/LoginScreen";
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
  const selectedMedia = demoGroup.media[0];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.configText}>
          Env {mobileConfig.environment} · API {mobileConfig.apiBaseUrl} · Auth {mobileConfig.authClientId}
        </Text>
        <LoginScreen />
        <GroupScreen group={demoGroup} selectedMedia={selectedMedia} />
        <BottomTabs activeTab={activeTab} onSelect={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  container: { flex: 1, padding: 16, gap: 12 },
  configText: { color: "#cbd5e1", fontSize: 12 }
});
