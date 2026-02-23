import type { Group, MediaItem } from "@nospoilers/types";
import { Image, StyleSheet, Text, View } from "react-native";
import { componentTokens, radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupScreenProps = {
  group: Group;
  selectedMedia: MediaItem;
  theme: AppTheme;
};

export const GroupScreen = ({ group, selectedMedia, theme }: GroupScreenProps) => {
  const progress = componentTokens.progressControl(theme, selectedMedia.progress.completed / selectedMedia.progress.total);
  const postCard = componentTokens.postCard(theme);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        <Image source={{ uri: group.coverUrl }} style={styles.groupCover} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{group.name}</Text>
          <Text style={[styles.progress, { color: theme.colors.textSecondary }]}>Progress {selectedMedia.progress.completed}/{selectedMedia.progress.total}</Text>
          <View style={[styles.progressTrack, { backgroundColor: progress.track }]}> 
            <View style={[styles.progressFill, { backgroundColor: progress.fill, width: progress.widthPercent as `${number}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.feedArea}>
          <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>Group Feed</Text>
          <View style={[styles.postCard, { backgroundColor: postCard.background, borderColor: postCard.borderColor }]}>
            <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>Weekly checkpoint</Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{group.description}</Text>
          </View>
        </View>
        <View style={[styles.sidePanel, { borderLeftColor: theme.colors.border }]}>
          <Image source={{ uri: selectedMedia.coverUrl }} style={styles.mediaCover} />
          <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>{selectedMedia.title}</Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{selectedMedia.kind.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusTokens.lg,
    overflow: "hidden",
    borderWidth: 1
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingTokens.md,
    borderBottomWidth: 1,
    padding: spacingTokens.lg
  },
  groupCover: {
    width: 56,
    height: 56,
    borderRadius: radiusTokens.md
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: "700" },
  progress: { fontSize: 13 },
  progressTrack: { marginTop: spacingTokens.xs, height: 8, borderRadius: radiusTokens.pill },
  progressFill: { height: "100%", borderRadius: radiusTokens.pill },
  contentRow: { flexDirection: "row", minHeight: 320 },
  feedArea: { flex: 1, padding: spacingTokens.lg },
  sidePanel: { width: 160, borderLeftWidth: 1, padding: spacingTokens.md },
  mediaCover: { width: "100%", height: 180, borderRadius: radiusTokens.sm, marginBottom: spacingTokens.sm },
  heading: { fontWeight: "700", marginBottom: 6 },
  body: {},
  postCard: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.md }
});
