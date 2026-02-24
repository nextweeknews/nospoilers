import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type FeedPost = {
  id: string;
  previewText: string | null;
  created_at: string;
};

export const PublicFeedScreen = ({ theme, status, errorMessage, posts }: { theme: AppTheme; status: "loading" | "ready" | "empty" | "error"; errorMessage?: string; posts: FeedPost[] }) => (
  <section style={{ display: "grid", gap: spacingTokens.sm }}>
    <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>For You</h3>
    {status === "loading" ? <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading public posts…</p> : null}
    {status === "error" ? <p style={{ margin: 0, color: "#d11" }}>{errorMessage ?? "Unable to load public posts."}</p> : null}
    {status === "empty" ? <p style={{ margin: 0, color: theme.colors.textSecondary }}>No public posts yet.</p> : null}
    {posts.map((post) => (
      <article key={post.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
        <p style={{ margin: 0, color: theme.colors.textPrimary }}>{post.previewText ?? "(No text)"}</p>
        <small style={{ color: theme.colors.textSecondary }}>{new Date(post.created_at).toLocaleString()}</small>
      </article>
    ))}
  </section>
);
