import { useEffect, useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import {
  Avatar,
  AlertDialog,
  Box,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  Flex,
  Heading,
  Separator,
  SegmentedControl,
  Text,
  TextField
} from "@radix-ui/themes";
import type { AuthUser } from "../../../../services/auth/src";

export type TvEpisodeProgressUnit = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
};

export type ShelfItem = {
  catalogItemId: string;
  title: string;
  itemType: "book" | "tv_show";
  coverImageUrl?: string;
  status: string;
  addedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  progressSummary: string;
  progressPercent: number;
  currentPage?: number | null;
  pageCount?: number | null;
  currentSeasonNumber?: number | null;
  currentEpisodeNumber?: number | null;
  progressPercentValue?: number | null;
  tvProgressUnits: TvEpisodeProgressUnit[];
};

const formatRelativeTime = (timestamp: string): string => {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return "recently";
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s`;
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h`;
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 30) return `${deltaDays}d`;
  const deltaMonths = Math.floor(deltaDays / 30);
  if (deltaMonths < 12) return `${deltaMonths}mo`;
  return `${Math.floor(deltaMonths / 12)}y`;
};

const coverFallback = (title: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="96" viewBox="0 0 72 96"><rect width="72" height="96" rx="8" fill="#334155"/><text x="50%" y="50%" fill="#cbd5e1" font-size="9" dominant-baseline="middle" text-anchor="middle">${title.slice(0, 18)}</text></svg>`
  )}`;

export const ProfileTabScreen = ({
  theme,
  user,
  onEditProfile,
  onAccountSettings,
  shelfItems,
  requestedEditorItemId,
  onEditorRequestHandled,
  onSaveShelfProgress,
  onRemoveShelfItem
}: {
  theme: AppTheme;
  user: AuthUser;
  onEditProfile: () => void;
  onAccountSettings: () => void;
  shelfItems: ShelfItem[];
  requestedEditorItemId?: string | null;
  onEditorRequestHandled?: () => void;
  onSaveShelfProgress: (params: {
    catalogItemId: string;
    status: "in_progress" | "completed";
    currentPage?: number | null;
    progressPercent?: number | null;
    currentSeasonNumber?: number | null;
    currentEpisodeNumber?: number | null;
    watchedEpisodeCount?: number | null;
  }) => Promise<void>;
  onRemoveShelfItem: (catalogItemId: string) => Promise<void>;
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [bookMode, setBookMode] = useState<"page" | "percent">("page");
  const [bookProgressInput, setBookProgressInput] = useState<string>("");
  const [markBookCompleted, setMarkBookCompleted] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Record<string, boolean>>({});
  const [expandedSeasons, setExpandedSeasons] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [pendingRemovalItem, setPendingRemovalItem] = useState<ShelfItem | null>(null);

  const editingItem = useMemo(() => shelfItems.find((item) => item.catalogItemId === editingItemId) ?? null, [editingItemId, shelfItems]);

  const groupedSeasons = useMemo(() => {
    if (!editingItem || editingItem.itemType !== "tv_show") return [];
    const map = new Map<number, TvEpisodeProgressUnit[]>();
    editingItem.tvProgressUnits.forEach((unit) => {
      const existing = map.get(unit.seasonNumber) ?? [];
      existing.push(unit);
      map.set(unit.seasonNumber, existing);
    });

    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([season, episodes]) => [
        season,
        [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
      ] as const);
  }, [editingItem]);

  // This effect lets the main feed ask the profile screen to open a specific editor.
  // We immediately clear the request so one click only opens one editor instance.
  useEffect(() => {
    if (!requestedEditorItemId) return;
    const requested = shelfItems.find((item) => item.catalogItemId === requestedEditorItemId);
    if (!requested) {
      onEditorRequestHandled?.();
      return;
    }
    openEditor(requested);
    onEditorRequestHandled?.();
  }, [requestedEditorItemId, shelfItems]);

  const openEditor = (item: ShelfItem) => {
    setEditingItemId(item.catalogItemId);
    setFormError(null);

    if (item.itemType === "book") {
      const usePercent = typeof item.progressPercentValue === "number" && item.progressPercentValue > 0;
      setBookMode(usePercent ? "percent" : "page");
      setBookProgressInput(usePercent ? String(Math.round(item.progressPercentValue ?? 0)) : String(item.currentPage ?? 0));
      setMarkBookCompleted(item.status === "completed");
      return;
    }

    const initialSelected: Record<string, boolean> = {};
    const savedCheckedCount = Math.max(0, Math.round(((item.progressPercentValue ?? 0) / 100) * item.tvProgressUnits.length));
    if (savedCheckedCount > 0) {
      const sortedUnits = [...item.tvProgressUnits].sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
      sortedUnits.slice(0, savedCheckedCount).forEach((unit) => {
        initialSelected[unit.id] = true;
      });
    }

    // Open all seasons initially so users can immediately verify episode checkmarks without extra clicks.
    const allSeasonIds = [...new Set(item.tvProgressUnits.map((unit) => unit.seasonNumber))]
      .sort((a, b) => a - b)
      .map((season) => String(season));
    setSelectedEpisodes(initialSelected);
    setExpandedSeasons(allSeasonIds);
  };

  const closeEditor = () => {
    setEditingItemId(null);
    setFormError(null);
    setExpandedSeasons([]);
  };

  const handleRemove = async (catalogItemId: string) => {
    setRemovingItemId(catalogItemId);
    try {
      await onRemoveShelfItem(catalogItemId);
      if (editingItemId === catalogItemId) {
        closeEditor();
      }
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setFormError(null);

    if (editingItem.itemType === "book") {
      const parsed = Number.parseInt(bookProgressInput, 10);
      if (!markBookCompleted && Number.isNaN(parsed)) {
        setFormError("Enter a valid progress value.");
        return;
      }

      if (!markBookCompleted && bookMode === "page") {
        const maxPages = editingItem.pageCount ?? 0;
        if (!Number.isInteger(parsed) || parsed <= 0 || (maxPages > 0 && parsed > maxPages)) {
          setFormError(`Page must be an integer between 1 and ${maxPages || "the total pages"}.`);
          return;
        }
      }

      if (!markBookCompleted && bookMode === "percent" && (!Number.isInteger(parsed) || parsed < 0 || parsed > 100)) {
        setFormError("Percent progress must be an integer between 0 and 100.");
        return;
      }

      setSaving(true);
      try {
        await onSaveShelfProgress({
          catalogItemId: editingItem.catalogItemId,
          status: markBookCompleted ? "completed" : "in_progress",
          currentPage: markBookCompleted ? editingItem.pageCount ?? null : bookMode === "page" ? parsed : null,
          progressPercent: markBookCompleted ? 100 : bookMode === "percent" ? parsed : null
        });
        closeEditor();
      } finally {
        setSaving(false);
      }
      return;
    }

    const selectedUnits = editingItem.tvProgressUnits.filter((unit) => selectedEpisodes[unit.id]);
    if (!selectedUnits.length) {
      setFormError("Select at least one episode or season.");
      return;
    }

    const sorted = [...selectedUnits].sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
    const last = sorted[sorted.length - 1];
    const completed = selectedUnits.length === editingItem.tvProgressUnits.length;
    const progressPercent = editingItem.tvProgressUnits.length
      ? Math.round((selectedUnits.length / editingItem.tvProgressUnits.length) * 100)
      : 0;

    setSaving(true);
    try {
      await onSaveShelfProgress({
        catalogItemId: editingItem.catalogItemId,
        status: completed ? "completed" : "in_progress",
        currentSeasonNumber: last.seasonNumber,
        currentEpisodeNumber: last.episodeNumber,
        watchedEpisodeCount: selectedUnits.length,
        progressPercent
      });
      closeEditor();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg }}>
      {/* This section keeps profile header and shelf actions in Radix components so controls look and behave consistently. */}
      <Flex direction="column" gap="3">
        <Avatar src={user.avatarUrl} fallback={(user.displayName ?? user.username ?? "U").slice(0, 1).toUpperCase()} size="6" radius="full" alt="avatar" />
        <Heading as="h3" size="4" style={{ color: theme.colors.textPrimary, margin: 0 }}>@{user.username ?? "pending"}</Heading>
        <Text size="2" style={{ margin: 0, color: theme.colors.textSecondary }}>{user.displayName ?? "No display name"}</Text>
        <Flex gap="2">
          <Button type="button" variant="soft" onClick={onEditProfile}>Edit profile</Button>
          <Button type="button" variant="soft" onClick={onAccountSettings}>Account settings</Button>
        </Flex>

        <section style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm, display: "grid", gap: 8 }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Shelf</h4>
          {shelfItems.length ? shelfItems.map((item) => (
            <article
              key={item.catalogItemId}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: radiusTokens.md,
                display: "grid",
                gridTemplateColumns: "56px 1fr auto",
                alignItems: "center",
                gap: spacingTokens.sm,
                padding: "10px",
                background: `linear-gradient(90deg, rgba(34,197,94,0.16) ${item.progressPercent}%, ${theme.colors.surface} ${item.progressPercent}%)`
              }}
            >
              <img
                src={item.coverImageUrl || coverFallback(item.title)}
                alt={`${item.title} cover`}
                style={{ width: 42, height: 58, objectFit: "cover", borderRadius: 6, justifySelf: "center" }}
              />
              <div style={{ display: "grid", gap: 2 }}>
                <strong style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: 600 }}>{item.title}</strong>
                <small style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                  Updated {formatRelativeTime(item.updatedAt)} ago • {item.status === "completed" ? `Completed ${formatRelativeTime(item.completedAt || item.addedAt)} ago` : item.progressSummary}
                </small>
              </div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="soft" size="1" aria-label={`Open ${item.title} shelf actions`} loading={removingItemId === item.catalogItemId}>⋯</Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onSelect={() => openEditor(item)}>Edit progress</DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    color="red"
                    onSelect={() => {
                      // Use a confirmation step so shelf removals happen only after explicit intent.
                      setPendingRemovalItem(item);
                    }}
                  >
                    Remove from shelf
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </article>
          )) : <small style={{ color: theme.colors.textSecondary }}>No titles on your shelf yet.</small>}
        </section>

        {editingItem ? (
          <Box style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 20, padding: spacingTokens.lg }}>
            {/* This card intentionally uses only Radix primitives so the editor stays visually consistent and predictable. */}
            <Card style={{ width: "min(640px, 95vw)", maxHeight: "85vh", overflowY: "auto", border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}>
              {/* This header keeps artwork and title together so users can confirm they are editing the intended title. */}
              <Flex align="center" gap="3">
                <Avatar
                  src={editingItem.coverImageUrl || coverFallback(editingItem.title)}
                  fallback={editingItem.title.slice(0, 1).toUpperCase()}
                  radius="small"
                  size="6"
                />
                <Box>
                  <Heading as="h3" size="4" style={{ margin: 0 }}>Update progress</Heading>
                  <Text size="2" color="gray">{editingItem.title}</Text>
                </Box>
              </Flex>
              <Separator size="4" />

              {editingItem.itemType === "book" ? (
                <Card variant="surface" style={{ display: "grid", gap: spacingTokens.sm }}>
                  <Flex gap="2" align="center">
                    <TextField.Root
                      type="text"
                      inputMode="numeric"
                      value={bookProgressInput}
                      onChange={(event) => setBookProgressInput(event.target.value.replace(/\D+/g, ""))}
                      placeholder={bookMode === "percent" ? "Percent complete" : "Current page"}
                      disabled={markBookCompleted}
                      style={{ flex: 1 }}
                    />
                    <SegmentedControl.Root value={bookMode} onValueChange={(value) => setBookMode(value as "page" | "percent") }>
                      <SegmentedControl.Item value="page">Page</SegmentedControl.Item>
                      <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </Flex>

                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      <Checkbox checked={markBookCompleted} onCheckedChange={(checked) => setMarkBookCompleted(Boolean(checked))} />
                      <Text size="2">Mark as complete</Text>
                    </Flex>
                  </Flex>

                  {/* The footer keeps cancel on the left and save on the right so action order is stable across book and TV editors. */}
                  <Flex justify="end" gap="2">
                    <Button type="button" color="gray" variant="soft" onClick={closeEditor} disabled={saving}>Cancel</Button>
                    <Button type="button" color="green" onClick={() => { void handleSave(); }} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                  </Flex>
                </Card>
              ) : (
                <Card variant="surface" style={{ display: "grid", gap: spacingTokens.sm }}>
                  {/* This accordion keeps season selection compact while still exposing episode-level checkboxes when expanded. */}
                  <Accordion.Root type="multiple" value={expandedSeasons} onValueChange={setExpandedSeasons} style={{ display: "grid", gap: spacingTokens.xs }}>
                    {groupedSeasons.map(([season, episodes]) => {
                      const allInSeasonChecked = episodes.every((episode) => selectedEpisodes[episode.id]);
                      return (
                        <Accordion.Item key={season} value={String(season)} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, overflow: "hidden" }}>
                          <Accordion.Header>
                            <Flex asChild align="center" justify="between" style={{ width: "100%" }}>
                              <Accordion.Trigger style={{ background: theme.colors.surface, border: 0, padding: "10px 12px", cursor: "pointer" }}>
                                <Flex align="center" gap="2">
                                  <Checkbox
                                    checked={allInSeasonChecked}
                                    onClick={(event) => event.stopPropagation()}
                                    onCheckedChange={(checked) => {
                                      const next = { ...selectedEpisodes };
                                      episodes.forEach((episode) => {
                                        next[episode.id] = Boolean(checked);
                                      });
                                      setSelectedEpisodes(next);
                                    }}
                                  />
                                  <Text size="2">Season {season}</Text>
                                </Flex>
                                <ChevronDownIcon />
                              </Accordion.Trigger>
                            </Flex>
                          </Accordion.Header>
                          <Accordion.Content style={{ padding: "0 12px 10px", display: "grid", gap: 6, background: theme.colors.surfaceMuted }}>
                            {episodes.map((episode) => (
                              <Flex key={episode.id} justify="between" align="center" gap="2">
                                <Text size="1">E{episode.episodeNumber} • {episode.title ?? "Untitled"}</Text>
                                <Checkbox
                                  checked={Boolean(selectedEpisodes[episode.id])}
                                  onCheckedChange={(checked) => setSelectedEpisodes((prev) => ({ ...prev, [episode.id]: Boolean(checked) }))}
                                />
                              </Flex>
                            ))}
                          </Accordion.Content>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion.Root>

                  <Flex justify="end" gap="2">
                    <Button type="button" color="gray" variant="soft" onClick={closeEditor} disabled={saving}>Cancel</Button>
                    <Button type="button" color="green" onClick={() => { void handleSave(); }} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                  </Flex>
                </Card>
              )}

              {formError ? <Text size="1" style={{ color: "var(--red-9)" }}>{formError}</Text> : null}
            </Card>
          </Box>
        ) : null}
      </Flex>

      <AlertDialog.Root
        open={pendingRemovalItem != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingRemovalItem(null);
          }
        }}
      >
        <AlertDialog.Content maxWidth="360px">
          <AlertDialog.Title>Remove from shelf?</AlertDialog.Title>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                onClick={() => {
                  if (pendingRemovalItem) {
                    void handleRemove(pendingRemovalItem.catalogItemId);
                  }
                  setPendingRemovalItem(null);
                }}
              >
                Remove
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
};
