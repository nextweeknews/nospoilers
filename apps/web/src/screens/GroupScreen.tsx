import { componentTokens, radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import type { Group, MediaItem } from "@nospoilers/types";

type GroupScreenProps = {
  group: Group;
  selectedMedia: MediaItem;
  theme: AppTheme;
};

export const GroupScreen = ({ group, selectedMedia, theme }: GroupScreenProps) => {
  const progress = componentTokens.progressControl(theme, selectedMedia.progress.completed / selectedMedia.progress.total);
  const header = componentTokens.groupHeader(theme);
  const postCard = componentTokens.postCard(theme);

  return (
    <section style={{ background: theme.colors.surface, borderRadius: radiusTokens.lg, overflow: "hidden", border: `1px solid ${theme.colors.border}` }}>
      <header style={{ display: "flex", alignItems: "center", gap: spacingTokens.md, padding: spacingTokens.md, borderBottom: `1px solid ${header.borderColor}`, background: header.background }}>
        <img src={group.coverUrl} alt={`${group.name} cover`} style={{ width: 64, height: 64, borderRadius: radiusTokens.md, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, color: theme.colors.textPrimary }}>{group.name}</h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Progress: {selectedMedia.progress.completed}/{selectedMedia.progress.total}
          </p>
          <div style={{ marginTop: spacingTokens.xs, background: progress.track, height: 8, borderRadius: radiusTokens.pill }}>
            <div style={{ width: progress.widthPercent, background: progress.fill, height: "100%", borderRadius: radiusTokens.pill }} />
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 420 }}>
        <main style={{ padding: spacingTokens.lg, color: theme.colors.textPrimary, display: "grid", gap: spacingTokens.md }}>
          <h2>Group Feed</h2>
          <article style={{ background: postCard.background, border: `1px solid ${postCard.borderColor}`, borderRadius: radiusTokens.md, padding: spacingTokens.md, boxShadow: postCard.shadow }}>
            <h3 style={{ marginTop: 0 }}>Weekly checkpoint</h3>
            <p style={{ color: theme.colors.textSecondary, marginBottom: 0 }}>{group.description}</p>
          </article>
        </main>
        <aside style={{ borderLeft: `1px solid ${theme.colors.border}`, padding: spacingTokens.md }}>
          <h3 style={{ color: theme.colors.textPrimary, marginTop: 0 }}>Selected Media</h3>
          <img src={selectedMedia.coverUrl} alt={selectedMedia.title} style={{ width: "100%", borderRadius: radiusTokens.md, marginBottom: spacingTokens.md }} />
          <p style={{ color: theme.colors.textPrimary, margin: 0 }}>{selectedMedia.title}</p>
          <small style={{ color: theme.colors.textSecondary }}>{selectedMedia.kind.toUpperCase()}</small>
        </aside>
      </div>
    </section>
  );
};
