import { componentTokens, radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import type { Group, MediaItem } from "@nospoilers/types";

type GroupScreenProps = {
  group: Group;
  selectedMedia: MediaItem;
  theme: AppTheme;
};

export const GroupScreen = ({ group, selectedMedia, theme }: GroupScreenProps) => {
  const progress = componentTokens.progressControl(theme, selectedMedia.progress.completed / selectedMedia.progress.total);
  const postCard = componentTokens.postCard(theme);

  return (
    <section style={{ background: theme.colors.surface, borderRadius: radiusTokens.lg, overflow: "hidden", border: `1px solid ${theme.colors.border}`, display: "grid", gap: spacingTokens.md, padding: spacingTokens.md }}>
      <header style={{ display: "flex", alignItems: "center", gap: spacingTokens.md }}>
        <img src={group.coverUrl} alt={`${group.name} cover`} style={{ width: 58, height: 58, borderRadius: radiusTokens.md, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 18 }}>{group.name}</h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 13 }}>
            {selectedMedia.title} • {selectedMedia.progress.completed}/{selectedMedia.progress.total}
          </p>
          <div style={{ marginTop: spacingTokens.xs, background: progress.track, height: 8, borderRadius: radiusTokens.pill }}>
            <div style={{ width: progress.widthPercent, background: progress.fill, height: "100%", borderRadius: radiusTokens.pill }} />
          </div>
        </div>
      </header>

      <article style={{ background: postCard.background, border: `1px solid ${postCard.borderColor}`, borderRadius: radiusTokens.md, padding: spacingTokens.md, boxShadow: postCard.shadow }}>
        <h3 style={{ marginTop: 0, marginBottom: spacingTokens.xs }}>Weekly checkpoint</h3>
        <p style={{ color: theme.colors.textSecondary, margin: 0 }}>{group.description}</p>
      </article>
    </section>
  );
};
