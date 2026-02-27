export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | ThemeMode;

export const brandPalette = {
  green: {
    50: "#effef6",
    100: "#d8fbe7",
    200: "#b2f5d0",
    300: "#7be9b0",
    400: "#47d991",
    500: "#1fc278",
    600: "#119e62",
    700: "#0f7b4f",
    800: "#10613f",
    900: "#0f5035"
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a"
  }
} as const;

export const spacingTokens = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radiusTokens = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const typographyTokens = {
  family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  size: { caption: 12, body: 14, title: 20, headline: 24 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" }
} as const;
export const elevationTokens = {
  low: "0 1px 2px rgba(15, 23, 42, 0.10)",
  medium: "0 8px 24px rgba(15, 23, 42, 0.18)",
  high: "0 20px 48px rgba(15, 23, 42, 0.24)"
} as const;

export type AppTheme = {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    accent: string;
    accentStrong: string;
    accentText: string;
    success: string;
  };
};

export const resolveThemePreference = (systemMode: ThemeMode, preference: ThemePreference): ThemeMode =>
  preference === "system" ? systemMode : preference;

export const createTheme = (mode: ThemeMode): AppTheme => {
  if (mode === "light") {
    return {
      mode,
      colors: {
        background: "#ffffff",
        surface: "#ffffff",
        surfaceMuted: brandPalette.slate[100],
        textPrimary: brandPalette.slate[900],
        textSecondary: brandPalette.slate[600],
        border: brandPalette.slate[200],
        accent: brandPalette.green[600],
        accentStrong: brandPalette.green[700],
        accentText: "#ffffff",
        success: brandPalette.green[700]
      }
    };
  }

  return {
    mode,
    colors: {
      background: "#1f1f1f",
      surface: "#0f1f19",
      surfaceMuted: "#143027",
      textPrimary: brandPalette.slate[50],
      textSecondary: brandPalette.slate[300],
      border: "#245041",
      accent: brandPalette.green[400],
      accentStrong: brandPalette.green[300],
      accentText: "#053222",
      success: brandPalette.green[300]
    }
  };
};

export type BottomNavItem = {
  key: "groups" | "for-you" | "notifications" | "profile";
  label: "Groups" | "For You" | "Notifications" | "Profile";
};

export const BASE_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { key: "groups", label: "Groups" },
  { key: "for-you", label: "For You" },
  { key: "notifications", label: "Notifications" },
  { key: "profile", label: "Profile" }
];

export const componentTokens = {
  authCard: (theme: AppTheme) => ({ background: theme.colors.surface, borderColor: theme.colors.border }),
  navBar: (theme: AppTheme, active: boolean) => ({
    background: active ? theme.colors.accent : theme.colors.surface,
    borderColor: active ? theme.colors.accentStrong : theme.colors.border,
    textColor: active ? theme.colors.accentText : theme.colors.textPrimary
  }),
  postCard: (theme: AppTheme) => ({ background: theme.colors.surface, borderColor: theme.colors.border, shadow: elevationTokens.low }),
  progressControl: (theme: AppTheme, ratio: number) => ({
    track: theme.colors.surfaceMuted,
    fill: theme.colors.accent,
    widthPercent: `${Math.min(100, Math.max(0, ratio * 100))}%`
  }),
  groupHeader: (theme: AppTheme) => ({ background: theme.colors.surface, borderColor: theme.colors.border })
} as const;
