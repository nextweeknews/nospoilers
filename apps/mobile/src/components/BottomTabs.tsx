import { BASE_BOTTOM_NAV_ITEMS, componentTokens, spacingTokens, type AppTheme, type BottomNavItem } from "@nospoilers/ui";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./Typography";

type BottomTabsProps = {
  activeTab: BottomNavItem["key"];
  onSelect: (key: BottomNavItem["key"]) => void;
  theme: AppTheme;
};

export const BottomTabs = ({ activeTab, onSelect, theme }: BottomTabsProps) => (
  <View style={[styles.container, { borderTopColor: theme.colors.border }]}> 
    {BASE_BOTTOM_NAV_ITEMS.map((item) => {
      const active = item.key === activeTab;
      const tokens = componentTokens.navBar(theme, active);
      return (
        <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.item, { borderColor: tokens.borderColor, backgroundColor: tokens.background }]}>
          <AppText style={[styles.label, { color: tokens.textColor }]}>{item.label}</AppText>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacingTokens.sm,
    borderTopWidth: 1,
    padding: spacingTokens.md
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center"
  },
  label: {
    fontSize: 12,
    fontWeight: "600"
  }
});
