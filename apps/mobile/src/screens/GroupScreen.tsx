import { Image, StyleSheet, View } from "react-native";
import { AppText } from "../components/Typography";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupSummary = {
  name: string;
  description?: string | null;
  coverUrl?: string | null;
};

type GroupScreenProps = {
  group?: GroupSummary;
  status: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  theme: AppTheme;
};

export const GroupScreen = ({ group, status, errorMessage, theme }: GroupScreenProps) => {
  const placeholderText =
    status === "loading"
      ? "Loading your groups from Supabase…"
      : status === "error"
        ? errorMessage ?? "Unable to load groups from backend."
        : "No groups found for this account yet.";

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.colors.border }]}>
        {group?.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.groupCover} /> : null}
        <View style={styles.headerText}>
          <AppText style={[styles.title, { color: theme.colors.textPrimary }]}>{group?.name ?? "Your Groups"}</AppText>
          <AppText style={[styles.progress, { color: theme.colors.textSecondary }]}>{group?.description ?? "Real group data appears here after loading."}</AppText>
        </View>
      </View>

      {status !== "ready" ? (
        <View style={[styles.placeholder, { borderColor: theme.colors.border }]}> 
          <AppText style={[styles.progress, { color: theme.colors.textSecondary }]}>{placeholderText}</AppText>
        </View>
      ) : null}
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
  placeholder: {
    margin: spacingTokens.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radiusTokens.md,
    padding: spacingTokens.md
  }
});
