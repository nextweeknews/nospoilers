import { useMemo, useState } from "react";
import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
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
  onSaveShelfProgress
}: {
  theme: AppTheme;
  user: AuthUser;
  onEditProfile: () => void;
  onAccountSettings: () => void;
  shelfItems: ShelfItem[];
  onSaveShelfProgress: (params: {
    catalogItemId: string;
    status: "in_progress" | "completed";
    currentPage?: number | null;
    progressPercent?: number | null;
    currentSeasonNumber?: number | null;
    currentEpisodeNumber?: number | null;
  }) => Promise<void>;
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [bookMode, setBookMode] = useState<"page" | "percent">("page");
  const [bookProgressInput, setBookProgressInput] = useState<string>("");
  const [markBookCompleted, setMarkBookCompleted] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Record<string, boolean>>({});
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editingItem = useMemo(() => shelfItems.find((item) => item.catalogItemId === editingItemId) ?? null, [editingItemId, shelfItems]);

  const openEditor = (item: ShelfItem) => {
    setEditingItemId(item.catalogItemId);
    setFormError(null);
    if (item.itemType === "book") {
      const usePercent = typeof item.progressPercentValue === "number" && item.progressPercentValue > 0;
      setBookMode(usePercent ? "percent" : "page");
      setBookProgressInput(
        usePercent
          ? String(Math.round(item.progressPercentValue ?? 0))
          : String(item.currentPage ?? 0)
      );
      setMarkBookCompleted(item.status === "completed");
      return;
    }

    const initialSelected: Record<string, boolean> = {};
    item.tvProgressUnits.forEach((unit) => {
      if (
        (item.currentSeasonNumber ?? 0) > unit.seasonNumber ||
        ((item.currentSeasonNumber ?? 0) === unit.seasonNumber && (item.currentEpisodeNumber ?? 0) >= unit.episodeNumber)
      ) {
        initialSelected[unit.id] = true;
      }
    });
    setSelectedEpisodes(initialSelected);
  };

  const closeEditor = () => {
    setEditingItemId(null);
    setFormError(null);
    setExpandedSeasons({});
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
    setSaving(true);
    try {
      await onSaveShelfProgress({
        catalogItemId: editingItem.catalogItemId,
        status: completed ? "completed" : "in_progress",
        currentSeasonNumber: last.seasonNumber,
        currentEpisodeNumber: last.episodeNumber
      });
      closeEditor();
    } finally {
      setSaving(false);
    }
  };

  const groupedSeasons = useMemo(() => {
    if (!editingItem || editingItem.itemType !== "tv_show") return [];
    const map = new Map<number, TvEpisodeProgressUnit[]>();
    editingItem.tvProgressUnits.forEach((unit) => {
      const season = unit.seasonNumber;
      const existing = map.get(season) ?? [];
      existing.push(unit);
      map.set(season, existing);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [editingItem]);

  return (
    <section style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}>
      <img src={user.avatarUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover", background: theme.colors.surfaceMuted }} />
      <strong style={{ color: theme.colors.textPrimary }}>@{user.username ?? "pending"}</strong>
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>{user.displayName ?? "No display name"}</p>
      <div style={{ display: "flex", gap: spacingTokens.sm }}>
        <button type="button" onClick={onEditProfile}>Edit profile</button>
        <button type="button" onClick={onAccountSettings}>Account settings</button>
      </div>

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
                Added {formatRelativeTime(item.addedAt)} ago • {item.status === "completed" ? `Completed ${formatRelativeTime(item.completedAt || item.addedAt)} ago` : item.progressSummary}
              </small>
            </div>
            <button
              type="button"
              aria-label={`Edit ${item.title} progress`}
              onClick={() => openEditor(item)}
              style={{ border: `1px solid ${theme.colors.border}`, borderRadius: 999, width: 32, height: 32, background: theme.colors.surface }}
            >
              ⋯
            </button>
          </article>
        )) : <small style={{ color: theme.colors.textSecondary }}>No titles on your shelf yet.</small>}
      </section>

      {editingItem ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 20, padding: spacingTokens.lg }}>
          <div style={{ width: "min(640px, 95vw)", maxHeight: "85vh", overflowY: "auto", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}>
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Update progress</h3>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>{editingItem.title}</p>

            {editingItem.itemType === "book" ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setBookMode("page")}>Track by page</button>
                  <button type="button" onClick={() => setBookMode("percent")}>Track by %</button>
                </div>
                <input
                  type="number"
                  value={bookProgressInput}
                  onChange={(event) => setBookProgressInput(event.target.value)}
                  min={bookMode === "percent" ? 0 : 1}
                  max={bookMode === "percent" ? 100 : editingItem.pageCount ?? undefined}
                  placeholder={bookMode === "percent" ? "Percent complete" : "Current page"}
                />
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: theme.colors.textPrimary }}>
                  <input type="checkbox" checked={markBookCompleted} onChange={(event) => setMarkBookCompleted(event.target.checked)} />
                  Mark as completed
                </label>
              </>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {groupedSeasons.map(([season, episodes]) => {
                  const allInSeasonChecked = episodes.every((episode) => selectedEpisodes[episode.id]);
                  return (
                    <div key={season} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.sm }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 8 }}>
                        <button type="button" onClick={() => setExpandedSeasons((prev) => ({ ...prev, [season]: !prev[season] }))}>
                          Season {season}
                        </button>
                        <small style={{ color: theme.colors.textSecondary }}>{episodes.length} episodes</small>
                        <input
                          type="checkbox"
                          checked={allInSeasonChecked}
                          onChange={(event) => {
                            const next = { ...selectedEpisodes };
                            episodes.forEach((episode) => {
                              next[episode.id] = event.target.checked;
                            });
                            setSelectedEpisodes(next);
                          }}
                        />
                      </div>
                      {expandedSeasons[season] ? (
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {episodes.map((episode) => (
                            <label key={episode.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                              <span style={{ color: theme.colors.textPrimary }}>Episode {episode.episodeNumber}{episode.title ? ` — ${episode.title}` : ""}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedEpisodes[episode.id])}
                                onChange={(event) => setSelectedEpisodes((prev) => ({ ...prev, [episode.id]: event.target.checked }))}
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {formError ? <small style={{ color: "#dc2626" }}>{formError}</small> : null}

            <div style={{ display: "flex", justifyContent: "end", gap: 8 }}>
              <button type="button" onClick={closeEditor} disabled={saving}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
