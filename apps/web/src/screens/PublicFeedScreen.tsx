import { spacingTokens, type AppTheme } from "@nospoilers/ui";

type FeedPost = {
  id: string;
  previewText: string | null;
  created_at: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
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

const formatRelativeTimestamp = (createdAt: string, nowMs: number = Date.now()): string => {
  const timestampMs = new Date(createdAt).getTime();
  if (!Number.isFinite(timestampMs)) {
    return "now";
  }

  const elapsedMs = Math.max(0, nowMs - timestampMs);
  const second = 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < minute) return `${Math.max(1, Math.floor(elapsedMs / second))}s`;
  if (elapsedMs < hour) return `${Math.floor(elapsedMs / minute)}m`;
  if (elapsedMs < day) return `${Math.floor(elapsedMs / hour)}h`;
  if (elapsedMs < week) return `${Math.floor(elapsedMs / day)}d`;
  if (elapsedMs < month) return `${Math.floor(elapsedMs / week)}w`;
  if (elapsedMs < year) return `${Math.floor(elapsedMs / month)}mo`;
  return `${Math.floor(elapsedMs / year)}y`;
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
      <article
        key={post.id}
        style={{
          display: "grid",
          gridTemplateColumns: "44px minmax(0, 1fr)",
          columnGap: spacingTokens.sm,
          padding: `${spacingTokens.sm} 0`,
          borderBottom: `1px solid ${theme.colors.border}`
        }}
      >
        <img
          src={post.authorAvatarUrl}
          alt={`${post.authorDisplayName} avatar`}
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
          loading="lazy"
        />
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacingTokens.xs }}>
            <strong style={{ color: theme.colors.textPrimary }}>{post.authorDisplayName}</strong>
            <small style={{ color: theme.colors.textSecondary }}>{formatRelativeTimestamp(post.created_at)}</small>
          </div>
          <p style={{ margin: 0, color: theme.colors.textPrimary, whiteSpace: "pre-wrap" }}>{post.previewText ?? "(No text)"}</p>
        </div>
      </article>
    ))}
  </section>
);
