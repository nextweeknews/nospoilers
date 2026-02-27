import { spacingTokens, type AppTheme } from "@nospoilers/ui";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";

type GroupReactionPill = {
  emoji: string;
  count: number;
  viewerHasReacted: boolean;
};

type FeedPost = {
  id: string;
  previewText: string | null;
  created_at: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  catalogItemTitle?: string;
  progressLine?: string;
  isSpoilerHidden?: boolean;
  reactionCount: number;
  viewerHasReacted: boolean;
  canDelete?: boolean;
  groupReactionPills?: GroupReactionPill[];
};

type PublicFeedScreenProps = {
  theme: AppTheme;
  status: "loading" | "ready" | "empty" | "error";
  errorMessage?: string;
  posts: FeedPost[];
  title?: string;
  loadingMessage?: string;
  emptyMessage?: string;
  showCatalogContext?: boolean;
  mode?: "public" | "group";
  onToggleReaction?: (postId: string, source: "double_click" | "pill_click") => void;
  onToggleGroupEmojiReaction?: (postId: string, emoji: string) => void;
  onDeletePost?: (postId: string) => void;
  onSharePost?: (postId: string) => void;
  onReportPost?: (postId: string) => void;
};

const formatRelativeTimestamp = (
  createdAt: string,
  nowMs: number = Date.now(),
): string => {
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

  if (elapsedMs < minute)
    return `${Math.max(1, Math.floor(elapsedMs / second))}s`;
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
  emptyMessage = "No public posts yet.",
  showCatalogContext = true,
  mode = "public",
  onToggleReaction,
  onToggleGroupEmojiReaction,
  onDeletePost,
  onSharePost,
  onReportPost,
}: PublicFeedScreenProps) => {
  const [pickerForPostId, setPickerForPostId] = useState<string | null>(null);
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [menuForPostId, setMenuForPostId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuForPostId) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuForPostId(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuForPostId]);

  const renderTimestamp = (createdAt: string) => (
    <small
      style={{
        color: theme.colors.textSecondary,
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {formatRelativeTimestamp(createdAt)}
    </small>
  );

  return (
    <section style={{ display: "grid", gap: spacingTokens.sm }}>
      <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>{title}</h3>
      {status === "loading" ? (
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          {loadingMessage}
        </p>
      ) : null}
      {status === "error" ? (
        <p style={{ margin: 0, color: "#d11" }}>
          {errorMessage ?? "Unable to load posts."}
        </p>
      ) : null}
      {status === "empty" ? (
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          {emptyMessage}
        </p>
      ) : null}
      {posts.map((post) => (
        <article
          key={post.id}
          onDoubleClick={() => {
            onToggleReaction?.(post.id, "double_click");
          }}
          onMouseEnter={() => setHoveredPostId(String(post.id))}
          onMouseLeave={() => {
            setHoveredPostId((current) => (current === String(post.id) ? null : current));
            setMenuForPostId((current) => (current === String(post.id) ? null : current));
          }}
          style={{
            display: "grid",
            gridTemplateColumns: "44px minmax(0, 1fr)",
            columnGap: spacingTokens.sm,
            padding: spacingTokens.md,
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor:
              hoveredPostId === String(post.id)
                ? theme.colors.surfaceMuted ?? `${theme.colors.textPrimary}08`
                : "transparent",
            transition: "background-color 140ms ease",
          }}
        >
          <img
            src={post.authorAvatarUrl}
            alt={`${post.authorDisplayName} avatar`}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              objectFit: "cover",
            }}
            loading="lazy"
          />
          <div style={{ display: "grid", gap: 4, minWidth: 0, position: "relative" }}>
            {hoveredPostId === String(post.id) ? (
              <div ref={menuRef} style={{ position: "absolute", top: 0, right: 0 }}>
                <button
                  type="button"
                  aria-label="Post options"
                  onClick={() => {
                    setMenuForPostId((current) => (current === String(post.id) ? null : String(post.id)));
                  }}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    color: theme.colors.textSecondary,
                    borderRadius: 999,
                    width: 24,
                    height: 24,
                    cursor: "pointer"
                  }}
                >
                  ⋯
                </button>
                {menuForPostId === String(post.id) ? (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 28,
                      minWidth: 160,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 10,
                      background: theme.colors.surface,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                      padding: 4,
                      display: "grid",
                      gap: 2,
                      zIndex: 25
                    }}
                  >
                    {mode === "public" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuForPostId(null);
                          onSharePost?.(String(post.id));
                        }}
                        style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: theme.colors.textPrimary }}
                      >
                        Share post
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuForPostId(null);
                        onReportPost?.(String(post.id));
                      }}
                      style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: theme.colors.textPrimary }}
                    >
                      Report post
                    </button>
                    {post.canDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuForPostId(null);
                          onDeletePost?.(String(post.id));
                        }}
                        style={{ textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}
                      >
                        Delete post
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "nowrap",
                minWidth: 0,
              }}
            >
              <strong
                style={{
                  color: theme.colors.textPrimary,
                  fontWeight: 600,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {post.authorDisplayName}
              </strong>
              {showCatalogContext && post.catalogItemTitle ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      backgroundColor: theme.colors.textSecondary,
                      maskImage: "url('/graphics/rightarrow.svg')",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                      maskSize: "contain",
                      WebkitMaskImage: "url('/graphics/rightarrow.svg')",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      WebkitMaskSize: "contain",
                    }}
                  />
                  <span
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: 13,
                      fontWeight: 600,
                      minWidth: 0,
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {post.catalogItemTitle}
                    </span>
                    <span
                      style={{
                        color: theme.colors.textSecondary,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    {renderTimestamp(post.created_at)}
                  </span>
                </span>
              ) : null}
              {!showCatalogContext || !post.catalogItemTitle ? (
                <>
                  <span
                    style={{ color: theme.colors.textSecondary, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  {renderTimestamp(post.created_at)}
                </>
              ) : null}
            </div>
            {post.progressLine ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 500,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    backgroundColor: theme.colors.textSecondary,
                    maskImage: "url('/graphics/downrightconnectorarrow.svg')",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                    maskSize: "contain",
                    WebkitMaskImage:
                      "url('/graphics/downrightconnectorarrow.svg')",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    WebkitMaskSize: "contain",
                  }}
                />
                {post.progressLine}
              </span>
            ) : null}
            <p
              style={{
                margin: 0,
                color: post.isSpoilerHidden ? theme.colors.textSecondary : theme.colors.textPrimary,
                whiteSpace: "pre-wrap",
                fontSize: 13,
                fontWeight: post.isSpoilerHidden ? 500 : 400,
              }}
            >
              {post.previewText ?? "(No text)"}
            </p>
            {mode === "group" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {(post.groupReactionPills ?? []).map((pill) => (
                  <button
                    key={`${post.id}-${pill.emoji}`}
                    type="button"
                    onClick={() => onToggleGroupEmojiReaction?.(String(post.id), pill.emoji)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      border: `1px solid ${pill.viewerHasReacted ? theme.colors.accent : theme.colors.border}`,
                      padding: "2px 10px",
                      background: pill.viewerHasReacted ? `${theme.colors.accent}15` : "transparent",
                      color: theme.colors.textPrimary,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    <span aria-hidden="true">{pill.emoji}</span>
                    <span>{pill.count}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPickerForPostId((cur) => (cur === String(post.id) ? null : String(post.id)))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    border: `1px solid ${theme.colors.border}`,
                    padding: "2px 10px",
                    background: "transparent",
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                  aria-label="Add reaction"
                >
                  +
                </button>

                {pickerForPostId === String(post.id) ? (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", zIndex: 50, top: 6 }}>
                      <EmojiPicker
                        onEmojiClick={(emojiData: EmojiClickData) => {
                          const chosen = String(emojiData.emoji ?? "");
                          setPickerForPostId(null);
                          if (chosen) onToggleGroupEmojiReaction?.(String(post.id), chosen);
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onToggleReaction?.(post.id, "pill_click");
                }}
                aria-label={post.viewerHasReacted ? "Remove heart reaction" : "Add heart reaction"}
                style={{
                  justifySelf: "start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  border: `1px solid ${post.viewerHasReacted ? "#ef4444" : theme.colors.border}`,
                  padding: "1px 8px",
                  backgroundColor: post.viewerHasReacted ? "#fee2e2" : "transparent",
                  color: post.viewerHasReacted ? "#ef4444" : theme.colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 1.3,
                  cursor: "pointer"
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 12 }}>{post.viewerHasReacted ? "♥" : "♡"}</span>
                <span>{post.reactionCount}</span>
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
};
