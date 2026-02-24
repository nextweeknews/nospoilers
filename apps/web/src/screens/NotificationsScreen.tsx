import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type NotificationEvent = { id: string; type: string; createdAt: string; text: string };

export const NotificationsScreen = ({ theme, events }: { theme: AppTheme; events: NotificationEvent[] }) => (
  <section style={{ display: "grid", gap: spacingTokens.sm }}>
    {events.map((event) => (
      <article key={event.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
        <strong style={{ color: theme.colors.textPrimary }}>{event.type}</strong>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>{event.text}</p>
        <small style={{ color: theme.colors.textSecondary }}>{new Date(event.createdAt).toLocaleString()}</small>
      </article>
    ))}
  </section>
);
