import { Pressable, ScrollView, Image, StyleSheet, View } from "react-native";
import { AppText } from "../components/Typography";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupSummary = {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
};

type GroupScreenProps = {
  groups: GroupSummary[];
  status: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  onCreateGroup: () => void;
  theme: AppTheme;
};

export const GroupScreen = ({ groups, status, errorMessage, onCreateGroup, theme }: GroupScreenProps) => {
  const placeholderText =
    status === "loading"
      ? "Loading your groups from Supabase…"
      : status === "error"
        ? errorMessage ?? "Unable to load groups from backend."
        : "No groups found for this account yet.";

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <ScrollView contentContainerStyle={styles.listContent} style={styles.scrollArea}>
        <AppText style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Your Groups</AppText>
        {status !== "ready" ? (
          <View style={[styles.placeholder, { borderColor: theme.colors.border }]}> 
            <AppText style={[styles.progress, { color: theme.colors.textSecondary }]}>{placeholderText}</AppText>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.id} style={[styles.groupRow, { borderColor: theme.colors.border }]}> 
              {group.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.groupCover} /> : <View style={[styles.groupCover, { backgroundColor: theme.colors.surfaceMuted }]} />}
              <View style={styles.headerText}>
                <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>{group.name}</AppText>
                <AppText style={[styles.progress, { color: theme.colors.textSecondary }]}>{group.description ?? "No description yet."}</AppText>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}> 
        <Pressable onPress={onCreateGroup} style={[styles.ctaButton, { backgroundColor: theme.colors.accent }]}> 
          <AppText style={[styles.ctaText, { color: theme.colors.accentText }]}>Create group</AppText>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusTokens.lg,
    overflow: "hidden",
    borderWidth: 1,
    flex: 1
  },
  scrollArea: {
    flex: 1
  },
  listContent: {
    gap: spacingTokens.md,
    padding: spacingTokens.lg
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingTokens.md,
    borderWidth: 1,
    borderRadius: radiusTokens.md,
    padding: spacingTokens.md
  },
  groupCover: {
    width: 56,
    height: 56,
    borderRadius: radiusTokens.md
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700" },
  progress: { fontSize: 13 },
  placeholder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radiusTokens.md,
    padding: spacingTokens.md
  },
  footer: {
    borderTopWidth: 1,
    padding: spacingTokens.md
  },
  ctaButton: {
    borderRadius: radiusTokens.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  ctaText: {
    fontWeight: "700"
  }
});
