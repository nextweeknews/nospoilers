import { colorTokens, radiusTokens, spacingTokens } from "@nospoilers/ui";
import type { Group, MediaItem } from "@nospoilers/types";

type GroupScreenProps = {
  group: Group;
  selectedMedia: MediaItem;
};

export const GroupScreen = ({ group, selectedMedia }: GroupScreenProps) => (
  <section style={{ background: colorTokens.surface, borderRadius: radiusTokens.lg, overflow: "hidden" }}>
    <header style={{ display: "flex", alignItems: "center", gap: spacingTokens.md, padding: spacingTokens.md, borderBottom: `1px solid ${colorTokens.border}` }}>
      <img src={group.coverUrl} alt={`${group.name} cover`} style={{ width: 64, height: 64, borderRadius: radiusTokens.md, objectFit: "cover" }} />
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, color: colorTokens.textPrimary }}>{group.name}</h1>
        <p style={{ margin: 0, color: colorTokens.textSecondary }}>
          Progress: {selectedMedia.progress.completed}/{selectedMedia.progress.total}
        </p>
      </div>
    </header>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 420 }}>
      <main style={{ padding: spacingTokens.lg, color: colorTokens.textPrimary }}>
        <h2>Group Feed</h2>
        <p>{group.description}</p>
      </main>
      <aside style={{ borderLeft: `1px solid ${colorTokens.border}`, padding: spacingTokens.md }}>
        <h3 style={{ color: colorTokens.textPrimary, marginTop: 0 }}>Selected Media</h3>
        <img src={selectedMedia.coverUrl} alt={selectedMedia.title} style={{ width: "100%", borderRadius: radiusTokens.md, marginBottom: spacingTokens.md }} />
        <p style={{ color: colorTokens.textPrimary, margin: 0 }}>{selectedMedia.title}</p>
        <small style={{ color: colorTokens.textSecondary }}>{selectedMedia.kind.toUpperCase()}</small>
      </aside>
    </div>
  </section>
);
