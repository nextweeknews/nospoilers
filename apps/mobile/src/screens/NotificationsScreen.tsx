import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { StyleSheet, View } from "react-native";
import { AppText } from "../components/Typography";

export const NotificationsScreen = ({ theme, events }: { theme: AppTheme; events: Array<{ id: string; type: string; createdAt: string; text: string }> }) => (
  <View style={styles.root}>
    {events.map((event) => (
      <View key={event.id} style={[styles.card, { borderColor: theme.colors.border }]}>
        <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{event.type}</AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>{event.text}</AppText>
        <AppText style={{ color: theme.colors.textSecondary }}>{new Date(event.createdAt).toLocaleString()}</AppText>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({ root: { gap: spacingTokens.sm }, card: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacingTokens.md, gap: spacingTokens.xs } });
