import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { StyleSheet, View } from "react-native";
import { AppText } from "../components/Typography";

type FeedPost = {
  id: string;
  previewText: string | null;
  created_at: string;
};

export const PublicFeedScreen = ({ theme, status, errorMessage, posts }: { theme: AppTheme; status: "loading" | "ready" | "empty" | "error"; errorMessage?: string; posts: FeedPost[] }) => (
  <View style={styles.root}>
    <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: 18 }}>For You</AppText>
    {status === "loading" ? <AppText style={{ color: theme.colors.textSecondary }}>Loading public posts…</AppText> : null}
    {status === "error" ? <AppText style={{ color: "#b42318" }}>{errorMessage ?? "Unable to load public posts."}</AppText> : null}
    {status === "empty" ? <AppText style={{ color: theme.colors.textSecondary }}>No public posts yet.</AppText> : null}
    {posts.map((post) => (
      <View key={post.id} style={[styles.card, { borderColor: theme.colors.border }]}>
        <AppText style={{ color: theme.colors.textPrimary }}>{post.previewText ?? "(No text)"}</AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>{new Date(post.created_at).toLocaleString()}</AppText>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root: { gap: spacingTokens.sm },
  card: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.md, gap: spacingTokens.xs }
});
