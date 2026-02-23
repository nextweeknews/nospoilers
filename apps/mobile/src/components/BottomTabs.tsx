import { BASE_BOTTOM_NAV_ITEMS } from "@nospoilers/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

type BottomTabsProps = {
  activeTab: string;
  onSelect: (key: string) => void;
};

export const BottomTabs = ({ activeTab, onSelect }: BottomTabsProps) => (
  <View style={styles.container}>
    {BASE_BOTTOM_NAV_ITEMS.map((item) => {
      const active = item.key === activeTab;
      return (
        <Pressable key={item.key} onPress={() => onSelect(item.key)} style={[styles.item, active && styles.itemActive]}>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    padding: 12
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center"
  },
  itemActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6"
  },
  label: {
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: "600"
  }
});
