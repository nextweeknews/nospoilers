import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "../components/Typography";

type SearchItem = { id: string; title: string; chapter: string | null; episode: string | null };

export const SearchScreen = ({ theme, query, onQueryChange, results, recent, popular }: { theme: AppTheme; query: string; onQueryChange: (q: string) => void; results: SearchItem[]; recent: SearchItem[]; popular: SearchItem[] }) => (
  <View style={[styles.root, { transform: [{ translateX: -2 }] }]}>
    <TextInput value={query} onChangeText={onQueryChange} placeholder="Search by title, chapter, episode" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.textPrimary }]} />
    {query ? (
      <View style={[styles.card, { borderColor: theme.colors.border }]}>{results.map((item) => <AppText key={item.id} style={{ color: theme.colors.textPrimary }}>{item.title} {item.chapter ? `· ${item.chapter}` : ""} {item.episode ? `· ${item.episode}` : ""}</AppText>)}</View>
    ) : (
      <>
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Recent</AppText>
          {recent.map((item) => <AppText key={item.id} style={{ color: theme.colors.textSecondary }}>{item.title}</AppText>)}
        </View>
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Popular</AppText>
          {popular.map((item) => <AppText key={item.id} style={{ color: theme.colors.textSecondary }}>{item.title}</AppText>)}
        </View>
      </>
    )}
  </View>
);

const styles = StyleSheet.create({
  root: { gap: spacingTokens.sm },
  input: { borderWidth: 1, borderRadius: radiusTokens.md, paddingHorizontal: spacingTokens.sm, paddingVertical: spacingTokens.sm },
  card: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.md, gap: spacingTokens.xs }
});
