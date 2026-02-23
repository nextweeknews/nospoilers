export const colorTokens = {
  background: "#0f172a",
  surface: "#111827",
  textPrimary: "#f9fafb",
  textSecondary: "#cbd5e1",
  accent: "#8b5cf6",
  border: "#334155"
} as const;

export const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24
} as const;

export const radiusTokens = {
  sm: 8,
  md: 12,
  lg: 16
} as const;

export type BottomNavItem = {
  key: "create-post" | "feed" | "groups" | "account";
  label: "Create Post" | "Feed" | "Groups" | "Account";
};

export const BASE_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { key: "create-post", label: "Create Post" },
  { key: "feed", label: "Feed" },
  { key: "groups", label: "Groups" },
  { key: "account", label: "Account" }
];
