import type { Group, MediaItem } from "@nospoilers/types";
import { Image, StyleSheet, Text, View } from "react-native";

type GroupScreenProps = {
  group: Group;
  selectedMedia: MediaItem;
};

export const GroupScreen = ({ group, selectedMedia }: GroupScreenProps) => (
  <View style={styles.card}>
    <View style={styles.topBar}>
      <Image source={{ uri: group.coverUrl }} style={styles.groupCover} />
      <View style={styles.headerText}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.progress}>
          Progress {selectedMedia.progress.completed}/{selectedMedia.progress.total}
        </Text>
      </View>
    </View>

    <View style={styles.contentRow}>
      <View style={styles.feedArea}>
        <Text style={styles.heading}>Group Feed</Text>
        <Text style={styles.body}>{group.description}</Text>
      </View>
      <View style={styles.sidePanel}>
        <Image source={{ uri: selectedMedia.coverUrl }} style={styles.mediaCover} />
        <Text style={styles.heading}>{selectedMedia.title}</Text>
        <Text style={styles.body}>{selectedMedia.kind.toUpperCase()}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    padding: 16
  },
  groupCover: {
    width: 56,
    height: 56,
    borderRadius: 12
  },
  headerText: { flex: 1 },
  title: { color: "#f9fafb", fontSize: 18, fontWeight: "700" },
  progress: { color: "#cbd5e1", fontSize: 13 },
  contentRow: {
    flexDirection: "row",
    minHeight: 320
  },
  feedArea: {
    flex: 1,
    padding: 16
  },
  sidePanel: {
    width: 160,
    borderLeftWidth: 1,
    borderLeftColor: "#334155",
    padding: 12
  },
  mediaCover: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 8
  },
  heading: { color: "#f9fafb", fontWeight: "700", marginBottom: 6 },
  body: { color: "#cbd5e1" }
});
