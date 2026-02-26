import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { useEffect, useMemo, useState } from "react";
import type { TvEpisodeProgressUnit } from "../screens/ProfileTabScreen";

type GroupOption = { id: string; label: string };
type CatalogOption = {
  id: string;
  label: string;
  itemType: "book" | "tv_show";
  tvProgressUnits: TvEpisodeProgressUnit[];
};
type Attachment = { url: string; kind: "image" | "video"; bytes: number };

type PostComposerSheetProps = {
  open: boolean;
  theme: AppTheme;
  groups: GroupOption[];
  catalogItems: CatalogOption[];
  defaultGroupId?: string;
  defaultCatalogItemId?: string;
  triggerText: string;
  postAudienceLabel: string;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (payload: {
    body_text: string;
    group_id: string | null;
    catalog_item_id: string;
    progress_unit_id: string | null;
    tenor_gif_url: string | null;
    tenor_gif_id: string | null;
    attachments: Attachment[];
  }) => Promise<void>;
};

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const PostComposerSheet = ({
  open,
  theme,
  groups,
  catalogItems,
  defaultGroupId,
  defaultCatalogItemId,
  triggerText,
  postAudienceLabel,
  onOpen,
  onClose,
  onSubmit
}: PostComposerSheetProps) => {
  const [bodyText, setBodyText] = useState("");
  const [groupId, setGroupId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [progressUnitId, setProgressUnitId] = useState("");
  const [bookMode, setBookMode] = useState<"page" | "percent">("page");
  const [bookProgressInput, setBookProgressInput] = useState("");
  const [tenorQuery, setTenorQuery] = useState("");
  const [tenorGifId, setTenorGifId] = useState("");
  const [tenorGifUrl, setTenorGifUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setGroupId(defaultGroupId ?? "");
    setCatalogItemId(defaultCatalogItemId ?? "");
    setSelectedSeason("");
    setProgressUnitId("");
    setBookProgressInput("");
    setError(undefined);
  }, [defaultCatalogItemId, defaultGroupId, open]);

  const selectedCatalog = useMemo(() => catalogItems.find((item) => item.id === catalogItemId), [catalogItemId, catalogItems]);

  const groupedSeasons = useMemo(() => {
    if (!selectedCatalog || selectedCatalog.itemType !== "tv_show") {
      return [] as Array<[number, TvEpisodeProgressUnit[]]>;
    }

    const seasonMap = new Map<number, TvEpisodeProgressUnit[]>();
    selectedCatalog.tvProgressUnits.forEach((unit) => {
      const values = seasonMap.get(unit.seasonNumber) ?? [];
      values.push(unit);
      seasonMap.set(unit.seasonNumber, values);
    });

    return [...seasonMap.entries()].sort((a, b) => a[0] - b[0]);
  }, [selectedCatalog]);

  const seasonEpisodes = useMemo(() => {
    const seasonNumber = Number.parseInt(selectedSeason, 10);
    if (!Number.isInteger(seasonNumber)) return [];
    return groupedSeasons.find(([season]) => season === seasonNumber)?.[1] ?? [];
  }, [groupedSeasons, selectedSeason]);

  const tenorResults = useMemo(() => {
    const q = tenorQuery.trim();
    if (!q) return [];

    return Array.from({ length: 3 }).map((_, idx) => ({
      id: `${q.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      url: `https://tenor.com/view/${q.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      label: `${q} GIF ${idx + 1}`
    }));
  }, [tenorQuery]);

  return (
    <div
      style={{
        marginInline: "auto",
        width: "min(720px, calc(100% - 24px))",
        border: `1px solid ${open ? theme.colors.accent : theme.colors.border}`,
        borderRadius: radiusTokens.pill,
        background: theme.colors.surfaceMuted,
        boxShadow: open ? "0 6px 20px rgba(0,0,0,0.12)" : "none",
        transition: "all 220ms ease"
      }}
    >
      {open ? (
        <div style={{ padding: spacingTokens.sm, display: "grid", gap: spacingTokens.sm, animation: "composerGrowUp 220ms ease" }}>
          <style>{"@keyframes composerGrowUp{from{opacity:.5;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}"}</style>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: theme.colors.textPrimary }}>Create a post</strong>
            <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: theme.colors.textSecondary, cursor: "pointer" }}>Close</button>
          </div>

          <textarea
            value={bodyText}
            maxLength={500}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Share your spoiler-safe thoughts…"
            style={{ minHeight: 110, border: "none", outline: "none", background: "transparent", color: theme.colors.textPrimary, resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
            <label style={{ color: theme.colors.textSecondary, display: "grid", gap: 4 }}>
              Group
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value="">Post publicly</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
              </select>
            </label>
            <label style={{ color: theme.colors.textSecondary, display: "grid", gap: 4 }}>
              Title *
              <select value={catalogItemId} onChange={(event) => { setCatalogItemId(event.target.value); setSelectedSeason(""); setProgressUnitId(""); setBookProgressInput(""); }}>
                <option value="">Select a title</option>
                {catalogItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
            <label>
              <input type="file" accept="image/*,video/*" multiple onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                const tooLarge = files.find((file) => file.size > MAX_MEDIA_BYTES);
                if (tooLarge) {
                  setError(`\"${tooLarge.name}\" exceeds the 10MB limit.`);
                  return;
                }
                setAttachments(files.map((file) => ({ url: file.name, bytes: file.size, kind: file.type.startsWith("video") ? "video" : "image" })));
                setError(undefined);
              }} />
              <span style={{ marginLeft: spacingTokens.xs, color: theme.colors.textSecondary }}>Attach</span>
            </label>
            <label style={{ color: theme.colors.textSecondary }}>
              Add a GIF
              <input value={tenorQuery} onChange={(event) => setTenorQuery(event.target.value)} placeholder="Search GIFs" style={{ marginLeft: spacingTokens.xs }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: spacingTokens.sm, alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: spacingTokens.sm, alignItems: "center", flexWrap: "wrap" }}>
              {selectedCatalog?.itemType === "tv_show" ? (
                <>
                  <select value={selectedSeason} onChange={(event) => { setSelectedSeason(event.target.value); setProgressUnitId(""); }}>
                    <option value="">Season</option>
                    {groupedSeasons.map(([season]) => <option key={season} value={String(season)}>Season {season}</option>)}
                  </select>
                  <select value={progressUnitId} onChange={(event) => setProgressUnitId(event.target.value)} disabled={!selectedSeason}>
                    <option value="">Episode *</option>
                    {seasonEpisodes.map((episode) => (
                      <option key={episode.id} value={episode.id}>{`E${episode.episodeNumber} ${episode.title ?? ""}`.trim()}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <input value={bookProgressInput} onChange={(event) => setBookProgressInput(event.target.value)} placeholder={bookMode === "page" ? "Page *" : "Percent *"} />
                  <button type="button" onClick={() => setBookMode((prev) => prev === "page" ? "percent" : "page")} style={{ borderRadius: radiusTokens.pill, border: `1px solid ${theme.colors.border}`, background: "transparent", padding: "6px 10px" }}>
                    {bookMode === "page" ? "Page #" : "%"}
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!catalogItemId) {
                  setError("Title is required.");
                  return;
                }

                let resolvedProgressUnitId: string | null = null;
                if (selectedCatalog?.itemType === "tv_show") {
                  if (!progressUnitId) {
                    setError("Select a season and episode.");
                    return;
                  }
                  resolvedProgressUnitId = progressUnitId;
                } else {
                  const numeric = Number.parseInt(bookProgressInput, 10);
                  if (!Number.isInteger(numeric) || (bookMode === "percent" && (numeric < 0 || numeric > 100)) || (bookMode === "page" && numeric < 1)) {
                    setError(bookMode === "page" ? "Enter a valid page number." : "Enter a percent between 0 and 100.");
                    return;
                  }
                  resolvedProgressUnitId = `${bookMode}:${numeric}`;
                }

                await onSubmit({
                  body_text: bodyText,
                  group_id: groupId || null,
                  catalog_item_id: catalogItemId,
                  progress_unit_id: resolvedProgressUnitId,
                  tenor_gif_id: tenorGifId || null,
                  tenor_gif_url: tenorGifUrl || null,
                  attachments
                });
                setBodyText("");
                setTenorQuery("");
                setTenorGifId("");
                setTenorGifUrl("");
                setAttachments([]);
                onClose();
              }}
              style={{ background: "#1f8f4a", color: "#fff", border: "none", borderRadius: radiusTokens.pill, padding: "10px 14px", cursor: "pointer" }}
            >
              {`Post to ${groupId ? (groups.find((entry) => entry.id === groupId)?.label ?? "group") : postAudienceLabel}`}
            </button>
          </div>

          {tenorResults.length ? (
            <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
              {tenorResults.map((result) => (
                <button key={result.id} type="button" onClick={() => { setTenorGifId(result.id); setTenorGifUrl(result.url); }} style={{ borderRadius: radiusTokens.pill, border: `1px solid ${theme.colors.border}` }}>
                  {result.label}
                </button>
              ))}
            </div>
          ) : null}

          <small style={{ color: theme.colors.textSecondary }}>{bodyText.length}/500</small>
          {error ? <small style={{ color: "#d11" }}>{error}</small> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Create a post"
          style={{
            width: "100%",
            border: "none",
            borderRadius: radiusTokens.pill,
            background: "transparent",
            color: theme.colors.textSecondary,
            padding: "12px 18px",
            textAlign: "left",
            cursor: "text"
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.boxShadow = `inset 0 0 0 1px ${theme.colors.border}`;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.boxShadow = "none";
          }}
        >
          {triggerText}
        </button>
      )}
    </div>
  );
};
