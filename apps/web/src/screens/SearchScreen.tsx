import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type SearchItem = { id: string; title: string; chapter: string | null; episode: string | null };

export const SearchScreen = ({ theme, query, onQueryChange, results, recent, popular }: { theme: AppTheme; query: string; onQueryChange: (query: string) => void; results: SearchItem[]; recent: SearchItem[]; popular: SearchItem[] }) => (
  <section style={{ display: "grid", gap: spacingTokens.sm, animation: "slideInFromLeft 220ms ease-out" }}>
    <style>{"@keyframes slideInFromLeft{from{opacity:.6;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}"}</style>
    <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by title, chapter, or episode" style={{ padding: spacingTokens.sm, borderRadius: radiusTokens.md, border: `1px solid ${theme.colors.border}` }} />
    {query ? (
      <article style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
        {results.map((item) => <p key={item.id} style={{ margin: 0, color: theme.colors.textPrimary }}>{item.title} {item.chapter ? `· ${item.chapter}` : ""} {item.episode ? `· ${item.episode}` : ""}</p>)}
      </article>
    ) : (
      <>
        <article style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Recent</h4>
          {recent.map((item) => <p key={item.id} style={{ margin: 0, color: theme.colors.textSecondary }}>{item.title}</p>)}
        </article>
        <article style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Popular</h4>
          {popular.map((item) => <p key={item.id} style={{ margin: 0, color: theme.colors.textSecondary }}>{item.title}</p>)}
        </article>
      </>
    )}
  </section>
);
