import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import type { AuthUser } from "../../../../services/auth/src";

type ShelfItem = {
  catalogItemId: string;
  title: string;
  status: string;
  progressLabel: string;
};

export const ProfileTabScreen = ({ theme, user, onEditProfile, onAccountSettings, shelfItems }: { theme: AppTheme; user: AuthUser; onEditProfile: () => void; onAccountSettings: () => void; shelfItems: ShelfItem[] }) => (
  <section style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}>
    <img src={user.avatarUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover", background: theme.colors.surfaceMuted }} />
    <strong style={{ color: theme.colors.textPrimary }}>@{user.username ?? "pending"}</strong>
    <p style={{ margin: 0, color: theme.colors.textSecondary }}>{user.displayName ?? "No display name"}</p>
    <div style={{ display: "flex", gap: spacingTokens.sm }}>
      <button type="button" onClick={onEditProfile}>Edit profile</button>
      <button type="button" onClick={onAccountSettings}>Account settings</button>
    </div>

    <section style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm, display: "grid", gap: 8 }}>
      <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Shelf</h4>
      {shelfItems.length ? shelfItems.map((item) => (
        <article key={item.catalogItemId} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: "8px 10px", display: "grid", gap: 2 }}>
          <strong style={{ color: theme.colors.textPrimary, fontSize: 14 }}>{item.title}</strong>
          <small style={{ color: theme.colors.textSecondary }}>{item.status} · {item.progressLabel}</small>
        </article>
      )) : <small style={{ color: theme.colors.textSecondary }}>No titles on your shelf yet.</small>}
    </section>
  </section>
);
