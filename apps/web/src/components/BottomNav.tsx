import { BASE_BOTTOM_NAV_ITEMS, colorTokens, spacingTokens } from "@nospoilers/ui";

type BottomNavProps = {
  activeTab: string;
  onSelect: (key: string) => void;
};

export const BottomNav = ({ activeTab, onSelect }: BottomNavProps) => (
  <nav style={{ display: "flex", gap: spacingTokens.sm, borderTop: `1px solid ${colorTokens.border}`, padding: spacingTokens.md }}>
    {BASE_BOTTOM_NAV_ITEMS.map((item) => {
      const active = item.key === activeTab;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          style={{
            padding: `${spacingTokens.sm}px ${spacingTokens.md}px`,
            borderRadius: 999,
            border: `1px solid ${active ? colorTokens.accent : colorTokens.border}`,
            background: active ? colorTokens.accent : "transparent",
            color: colorTokens.textPrimary
          }}
        >
          {item.label}
        </button>
      );
    })}
  </nav>
);
