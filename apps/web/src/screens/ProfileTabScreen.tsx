import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import type { AuthUser } from "../../../../services/auth/src";

export const ProfileTabScreen = ({ theme, user, onEditProfile, onAccountSettings }: { theme: AppTheme; user: AuthUser; onEditProfile: () => void; onAccountSettings: () => void }) => (
  <section style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}>
    <img src={user.avatarUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover", background: theme.colors.surfaceMuted }} />
    <strong style={{ color: theme.colors.textPrimary }}>@{user.username ?? "pending"}</strong>
    <p style={{ margin: 0, color: theme.colors.textSecondary }}>{user.displayName ?? "No display name"}</p>
    <div style={{ display: "flex", gap: spacingTokens.sm }}>
      <button type="button" onClick={onEditProfile}>Edit profile</button>
      <button type="button" onClick={onAccountSettings}>Account settings</button>
    </div>
  </section>
);
