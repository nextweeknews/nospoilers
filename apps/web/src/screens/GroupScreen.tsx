import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type GroupSummary = {
  name: string;
  description?: string | null;
  coverUrl?: string | null;
};

type GroupScreenProps = {
  group?: GroupSummary;
  status: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  theme: AppTheme;
};

export const GroupScreen = ({ group, status, errorMessage, theme }: GroupScreenProps) => {
  const placeholderText =
    status === "loading"
      ? "Loading your groups from Supabase…"
      : status === "error"
        ? errorMessage ?? "We could not load groups from the backend."
        : "No groups were found for this account yet.";

  return (
    <section style={{ background: theme.colors.surface, borderRadius: radiusTokens.lg, overflow: "hidden", border: `1px solid ${theme.colors.border}`, display: "grid", gap: spacingTokens.md, padding: spacingTokens.md }}>
      <header style={{ display: "flex", alignItems: "center", gap: spacingTokens.md }}>
        {group?.coverUrl ? <img src={group.coverUrl} alt={`${group.name} cover`} style={{ width: 58, height: 58, borderRadius: radiusTokens.md, objectFit: "cover" }} /> : null}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 18 }}>{group?.name ?? "Your Groups"}</h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 13 }}>{group?.description ?? "Real group data appears here once loaded."}</p>
        </div>
      </header>

      {status !== "ready" ? (
        <article style={{ border: `1px dashed ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
          <p style={{ color: theme.colors.textSecondary, margin: 0 }}>{placeholderText}</p>
        </article>
      ) : null}
    </section>
  );
};
