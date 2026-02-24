import { BASE_BOTTOM_NAV_ITEMS, componentTokens, spacingTokens, type AppTheme, type BottomNavItem } from "@nospoilers/ui";

type BottomNavProps = {
  activeTab: BottomNavItem["key"];
  onSelect: (key: BottomNavItem["key"]) => void;
  theme: AppTheme;
};

export const BottomNav = ({ activeTab, onSelect, theme }: BottomNavProps) => (
  <nav style={{ display: "flex", gap: spacingTokens.sm, borderTop: `1px solid ${theme.colors.border}`, padding: spacingTokens.md }}>
    {BASE_BOTTOM_NAV_ITEMS.map((item) => {
      const active = item.key === activeTab;
      const tokens = componentTokens.navBar(theme, active);
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          style={{
            padding: `${spacingTokens.sm}px ${spacingTokens.md}px`,
            borderRadius: 999,
            border: `1px solid ${tokens.borderColor}`,
            background: tokens.background,
            color: tokens.textColor
          }}
        >
          {item.label}
        </button>
      );
    })}
  </nav>
);
