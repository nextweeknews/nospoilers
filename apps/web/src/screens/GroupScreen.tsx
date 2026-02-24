import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupSummary = {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
};

type GroupScreenProps = {
  groups: GroupSummary[];
  status: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  onCreateGroup: () => void;
  theme: AppTheme;
};

export const GroupScreen = ({ groups, status, errorMessage, onCreateGroup, theme }: GroupScreenProps) => {
  const placeholderText =
    status === "loading"
      ? "Loading your groups from Supabase…"
      : status === "error"
        ? errorMessage ?? "We could not load groups from the backend."
        : "No groups were found for this account yet.";

  return (
    <section style={{ background: theme.colors.surface, borderRadius: radiusTokens.lg, overflow: "hidden", border: `1px solid ${theme.colors.border}`, display: "grid", gridTemplateRows: "1fr auto", minHeight: 380 }}>
      <div style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", gap: spacingTokens.md }}>
        <header>
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 18 }}>Your Groups</h2>
        </header>

        {status !== "ready" ? (
          <article style={{ border: `1px dashed ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
            <p style={{ color: theme.colors.textSecondary, margin: 0 }}>{placeholderText}</p>
          </article>
        ) : (
          groups.map((group) => (
            <article key={group.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md, display: "grid", gridTemplateColumns: "58px 1fr", gap: spacingTokens.md, alignItems: "center" }}>
              {group.coverUrl ? <img src={group.coverUrl} alt={`${group.name} cover`} style={{ width: 58, height: 58, borderRadius: radiusTokens.md, objectFit: "cover" }} /> : <div style={{ width: 58, height: 58, borderRadius: radiusTokens.md, background: theme.colors.surfaceMuted }} />}
              <div>
                <h3 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 16 }}>{group.name}</h3>
                <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 13 }}>{group.description ?? "No description yet."}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <div style={{ borderTop: `1px solid ${theme.colors.border}`, padding: spacingTokens.md, background: theme.colors.surface }}>
        <button
          type="button"
          onClick={onCreateGroup}
          style={{ width: "100%", border: "none", borderRadius: radiusTokens.md, padding: "12px 16px", fontWeight: 700, background: theme.colors.accent, color: theme.colors.accentText, cursor: "pointer" }}
        >
          Create group
        </button>
      </div>
    </section>
  );
};
