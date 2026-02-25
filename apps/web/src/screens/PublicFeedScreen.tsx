import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";

type FeedPost = {
  id: string;
  previewText: string | null;
  created_at: string;
};

type PublicFeedScreenProps = {
  theme: AppTheme;
  status: "loading" | "ready" | "empty" | "error";
  errorMessage?: string;
  posts: FeedPost[];
  title?: string;
  loadingMessage?: string;
  emptyMessage?: string;
};

export const PublicFeedScreen = ({
  theme,
  status,
  errorMessage,
  posts,
  title = "For You",
  loadingMessage = "Loading public posts…",
  emptyMessage = "No public posts yet."
}: PublicFeedScreenProps) => (
  <section style={{ display: "grid", gap: spacingTokens.sm }}>
    <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>{title}</h3>
    {status === "loading" ? <p style={{ margin: 0, color: theme.colors.textSecondary }}>{loadingMessage}</p> : null}
    {status === "error" ? <p style={{ margin: 0, color: "#d11" }}>{errorMessage ?? "Unable to load posts."}</p> : null}
    {status === "empty" ? <p style={{ margin: 0, color: theme.colors.textSecondary }}>{emptyMessage}</p> : null}
    {posts.map((post) => (
      <article key={post.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.md }}>
        <p style={{ margin: 0, color: theme.colors.textPrimary }}>{post.previewText ?? "(No text)"}</p>
        <small style={{ color: theme.colors.textSecondary }}>{new Date(post.created_at).toLocaleString()}</small>
      </article>
    ))}
  </section>
);
