import { spacingTokens, type AppTheme } from "@nospoilers/ui";
import {
  Avatar,
  Box,
  Button,
  Card,
  DropdownMenu,
  Flex,
  Heading,
  IconButton,
  Separator,
  Text,
} from "@radix-ui/themes";
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
  const [hoveredGroupPillKey, setHoveredGroupPillKey] = useState<string | null>(null);
  const [hoveredGroupAddPostId, setHoveredGroupAddPostId] = useState<string | null>(null);
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerForPostId) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setPickerForPostId(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [pickerForPostId]);

  return (
    <Box style={{ display: "grid", gap: spacingTokens.sm }}>
      <Heading size="4" style={{ margin: 0, color: theme.colors.textPrimary }}>
        {title}
      </Heading>
      {status === "loading" ? (
        <Text size="2" style={{ color: theme.colors.textSecondary }}>
          {loadingMessage}
        </Text>
      ) : null}
      {status === "error" ? (
        <Text size="2" color="red">
          {errorMessage ?? "Unable to load posts."}
        </Text>
      ) : null}
      {status === "empty" ? (
        <Text size="2" style={{ color: theme.colors.textSecondary }}>
          {emptyMessage}
        </Text>
      ) : null}
      {posts.map((post) => {
        const isPostHovered = hoveredPostId === String(post.id);
        const isReactionHovered = hoveredReactionPostId === String(post.id);

        return (
          <Card
            key={post.id}
            onDoubleClick={() => {
              onToggleReaction?.(post.id, "double_click");
            }}
            onMouseEnter={() => setHoveredPostId(String(post.id))}
            onMouseLeave={() => {
              setHoveredPostId((current) => (current === String(post.id) ? null : current));
            }}
            style={{
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: isPostHovered
                ? theme.colors.surfaceMuted ?? `${theme.colors.textPrimary}08`
                : theme.colors.surface,
              boxShadow: "none",
              transition: "background-color 140ms ease",
            }}
          >
            {/* This layout keeps avatar and post body aligned while switching to Radix layout primitives. */}
            <Flex gap="3" align="start">
              <Avatar
                src={post.authorAvatarUrl}
                fallback={post.authorDisplayName.slice(0, 1).toUpperCase()}
                size="3"
                radius="full"
                alt={`${post.authorDisplayName} avatar`}
              />
              <Box style={{ display: "grid", gap: 6, width: "100%", minWidth: 0, position: "relative" }}>
                {isPostHovered ? (
                  <Box style={{ position: "absolute", top: 0, right: 0 }}>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <IconButton
                          variant="soft"
                          radius="full"
                          size="1"
                          aria-label="Post options"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          ⋯
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        {mode === "public" ? (
                          <DropdownMenu.Item onSelect={() => onSharePost?.(String(post.id))}>
                            Share post
                          </DropdownMenu.Item>
                        ) : null}
                        <DropdownMenu.Item onSelect={() => onReportPost?.(String(post.id))}>
                          Report post
                        </DropdownMenu.Item>
                        {post.canDelete ? (
                          <DropdownMenu.Item color="red" onSelect={() => onDeletePost?.(String(post.id))}>
                            Delete post
                          </DropdownMenu.Item>
                        ) : null}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Box>
                ) : null}

                <Flex align="center" gap="2" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                  <Text weight="bold" size="2" style={{ color: theme.colors.textPrimary, flexShrink: 0 }}>
                    {post.authorDisplayName}
                  </Text>
                  {showCatalogContext && post.catalogItemTitle ? (
                    <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
                      <Text size="1" style={{ color: theme.colors.textSecondary }} aria-hidden="true">
                        →
                      </Text>
                      <Text size="2" weight="bold" style={{ color: theme.colors.textPrimary, minWidth: 0 }}>
                        <Box
                          as="span"
                          style={{
                            minWidth: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {post.catalogItemTitle}
                        </Box>
                      </Text>
                    </Flex>
                  ) : null}
                  <Text size="1" style={{ color: theme.colors.textSecondary, flexShrink: 0 }}>
                    · {formatRelativeTimestamp(post.created_at)}
                  </Text>
                </Flex>

                {post.progressLine ? (
                  <Text size="1" style={{ color: theme.colors.textSecondary }}>
                    ↳ {post.progressLine}
                  </Text>
                ) : null}

                <Text
                  size="2"
                  style={{
                    color: post.isSpoilerHidden ? theme.colors.textSecondary : theme.colors.textPrimary,
                    whiteSpace: "pre-wrap",
                    fontWeight: post.isSpoilerHidden ? 500 : 400,
                  }}
                >
                  {post.previewText ?? "(No text)"}
                </Text>

                {mode === "group" ? (
                  <Flex wrap="wrap" gap="2" mt="2" align="center">
                    {(post.groupReactionPills ?? []).map((pill) => {
                      const pillKey = `${post.id}-${pill.emoji}`;
                      const isHovered = hoveredGroupPillKey === pillKey;
                      const borderColor =
                        pill.viewerHasReacted || isHovered
                          ? theme.colors.accent
                          : theme.colors.border;

                      return (
                        <Button
                          key={pillKey}
                          type="button"
                          size="1"
                          variant="outline"
                          radius="full"
                          onClick={() => onToggleGroupEmojiReaction?.(String(post.id), pill.emoji)}
                          onMouseEnter={() => setHoveredGroupPillKey(pillKey)}
                          onMouseLeave={() =>
                            setHoveredGroupPillKey((current) =>
                              current === pillKey ? null : current,
                            )
                          }
                          style={{
                            borderColor,
                            color: theme.colors.textPrimary,
                            background: pill.viewerHasReacted
                              ? `${theme.colors.accent}15`
                              : "transparent",
                          }}
                        >
                          {pill.emoji} {pill.count}
                        </Button>
                      );
                    })}

                    <Button
                      type="button"
                      size="1"
                      variant="outline"
                      radius="full"
                      onClick={() => setPickerForPostId((cur) => (cur === String(post.id) ? null : String(post.id)))}
                      onMouseEnter={() => setHoveredGroupAddPostId(String(post.id))}
                      onMouseLeave={() => setHoveredGroupAddPostId((current) => (current === String(post.id) ? null : current))}
                      style={{
                        borderColor: hoveredGroupAddPostId === String(post.id) ? theme.colors.accent : theme.colors.border,
                        color: hoveredGroupAddPostId === String(post.id) ? theme.colors.accent : theme.colors.textSecondary,
                      }}
                      aria-label="Add reaction"
                    >
                      +
                    </Button>

                    {pickerForPostId === String(post.id) ? (
                      <Box ref={menuRef} style={{ position: "relative" }}>
                        <Box style={{ position: "absolute", zIndex: 50, top: 6 }}>
                          <EmojiPicker
                            onEmojiClick={(emojiData: EmojiClickData) => {
                              const chosen = String(emojiData.emoji ?? "");
                              setPickerForPostId(null);
                              if (chosen) onToggleGroupEmojiReaction?.(String(post.id), chosen);
                            }}
                          />
                        </Box>
                      </Box>
                    ) : null}
                  </Flex>
                ) : (
                  <Button
                    type="button"
                    size="1"
                    variant="outline"
                    radius="full"
                    onClick={() => {
                      onToggleReaction?.(post.id, "pill_click");
                    }}
                    aria-label={post.viewerHasReacted ? "Remove heart reaction" : "Add heart reaction"}
                    onMouseEnter={() => setHoveredReactionPostId(String(post.id))}
                    onMouseLeave={() => setHoveredReactionPostId((current) => (current === String(post.id) ? null : current))}
                    style={{
                      justifySelf: "start",
                      borderColor: post.viewerHasReacted || isReactionHovered ? theme.colors.accent : theme.colors.border,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {post.viewerHasReacted ? "❤" : "♡"} {post.reactionCount}
                  </Button>
                )}
                <Separator size="4" style={{ marginTop: 2 }} />
              </Box>
            </Flex>
          </Card>
        );
      })}
    </Box>
  );
};
