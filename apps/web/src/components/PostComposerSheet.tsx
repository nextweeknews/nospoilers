import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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

const pillControlStyle = (theme: AppTheme): CSSProperties => ({
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.pill,
  background: `linear-gradient(180deg, ${theme.colors.surface} 0%, ${theme.colors.surfaceMuted} 100%)`,
  color: theme.colors.textPrimary,
  padding: "9px 12px",
  fontSize: 14,
  outline: "none",
  transition: "box-shadow 140ms ease, border-color 140ms ease, filter 140ms ease"
});

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
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [isBodyVisible, setIsBodyVisible] = useState(open);
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

  useEffect(() => {
    if (open) {
      setIsBodyVisible(false);
      const timer = window.setTimeout(() => setIsBodyVisible(true), 140);
      return () => window.clearTimeout(timer);
    }

    setIsBodyVisible(false);
    return undefined;
  }, [open]);

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
    <>
      <style>{`
        @keyframes composerExpandUp {
          from { transform: scaleY(0.23); opacity: 0.76; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes composerContentIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          marginInline: "auto",
          width: "min(720px, calc(100% - 24px))",
          border: `1px solid ${open ? theme.colors.accent : "transparent"}`,
          borderRadius: open ? radiusTokens.lg : radiusTokens.pill,
          borderTopLeftRadius: radiusTokens.pill,
          borderTopRightRadius: radiusTokens.pill,
          background: `linear-gradient(180deg, ${theme.colors.surface} 0%, ${theme.colors.surfaceMuted} 100%)`,
          boxShadow: open ? "0 12px 28px rgba(0,0,0,0.16)" : "0 2px 10px rgba(0,0,0,0.08)",
          transition: "border-radius 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
          transformOrigin: "bottom center",
          animation: open ? "composerExpandUp 170ms ease-out" : undefined,
          overflow: "hidden"
        }}
      >
        {open ? (
          isBodyVisible ? (
            <div style={{ padding: spacingTokens.sm, display: "grid", gap: spacingTokens.sm, animation: "composerContentIn 140ms ease-out" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: theme.colors.textPrimary }}>Create a post</strong>
                <button type="button" onClick={onClose} style={{ ...pillControlStyle(theme), padding: "7px 12px", cursor: "pointer" }}>Close</button>
              </div>

              <textarea
                value={bodyText}
                maxLength={500}
                onChange={(event) => setBodyText(event.target.value)}
                placeholder="Share your spoiler-safe thoughts…"
                style={{
                  minHeight: 110,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 18,
                  background: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  resize: "vertical",
                  outline: "none",
                  padding: "12px 14px"
                }}
              />

              {attachments.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: spacingTokens.xs }}>
                  {attachments.map((attachment) => (
                    <div
                      key={`${attachment.url}-${attachment.bytes}`}
                      style={{
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 14,
                        background: theme.colors.surface,
                        padding: "8px 10px",
                        color: theme.colors.textSecondary,
                        fontSize: 12
                      }}
                    >
                      {attachment.kind === "video" ? "🎬 Video attached" : "🖼️ Image attached"}
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
                <label style={{ color: theme.colors.textSecondary, display: "grid", gap: 4 }}>
                  Group
                  <select value={groupId} onChange={(event) => setGroupId(event.target.value)} style={pillControlStyle(theme)}>
                    <option value="">Post publicly</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                  </select>
                </label>
                <label style={{ color: theme.colors.textSecondary, display: "grid", gap: 4 }}>
                  Title *
                  <select value={catalogItemId} onChange={(event) => { setCatalogItemId(event.target.value); setSelectedSeason(""); setProgressUnitId(""); setBookProgressInput(""); }} style={pillControlStyle(theme)}>
                    <option value="">Select a title</option>
                    {catalogItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <div style={{ display: "flex", alignItems: "end", gap: spacingTokens.xs }}>
                  <label style={{ ...pillControlStyle(theme), display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "10px 14px" }}>
                    <input
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        const tooLarge = files.find((file) => file.size > MAX_MEDIA_BYTES);
                        if (tooLarge) {
                          setError(`\"${tooLarge.name}\" exceeds the 10MB limit.`);
                          return;
                        }
                        setAttachments(files.map((file) => ({ url: file.name, bytes: file.size, kind: file.type.startsWith("video") ? "video" : "image" })));
                        setError(undefined);
                      }}
                    />
                    Attach
                  </label>
                  <button type="button" onClick={() => setShowGifSearch(true)} style={{ ...pillControlStyle(theme), cursor: "pointer", padding: "10px 14px" }}>
                    Add a gif
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: spacingTokens.sm, alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${theme.colors.border}`, paddingTop: spacingTokens.sm, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: spacingTokens.sm, alignItems: "center", flexWrap: "wrap" }}>
                  {selectedCatalog?.itemType === "tv_show" ? (
                    <>
                      <select value={selectedSeason} onChange={(event) => { setSelectedSeason(event.target.value); setProgressUnitId(""); }} style={pillControlStyle(theme)}>
                        <option value="">Season</option>
                        {groupedSeasons.map(([season]) => <option key={season} value={String(season)}>Season {season}</option>)}
                      </select>
                      <select value={progressUnitId} onChange={(event) => setProgressUnitId(event.target.value)} disabled={!selectedSeason} style={{ ...pillControlStyle(theme), opacity: selectedSeason ? 1 : 0.65 }}>
                        <option value="">Episode *</option>
                        {seasonEpisodes.map((episode) => (
                          <option key={episode.id} value={episode.id}>{`E${episode.episodeNumber} ${episode.title ?? ""}`.trim()}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <input value={bookProgressInput} onChange={(event) => setBookProgressInput(event.target.value)} placeholder={bookMode === "page" ? "Page *" : "Percent *"} style={pillControlStyle(theme)} />
                      <button type="button" onClick={() => setBookMode((prev) => prev === "page" ? "percent" : "page")} style={{ ...pillControlStyle(theme), cursor: "pointer", padding: "9px 12px" }}>
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
                  style={{ ...pillControlStyle(theme), background: `linear-gradient(180deg, ${theme.colors.accent} 0%, ${theme.colors.accent}CC 100%)`, color: theme.colors.surface, borderColor: `${theme.colors.accent}AA`, cursor: "pointer", padding: "10px 14px" }}
                >
                  {`Post to ${groupId ? (groups.find((entry) => entry.id === groupId)?.label ?? "group") : postAudienceLabel}`}
                </button>
              </div>

              {tenorResults.length ? (
                <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
                  {tenorResults.map((result) => (
                    <button key={result.id} type="button" onClick={() => { setTenorGifId(result.id); setTenorGifUrl(result.url); setShowGifSearch(false); }} style={{ ...pillControlStyle(theme), cursor: "pointer", padding: "7px 12px" }}>
                      {result.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <small style={{ color: theme.colors.textSecondary }}>{bodyText.length}/500</small>
              {error ? <small style={{ color: "#d11" }}>{error}</small> : null}
            </div>
          ) : (
            <div style={{ minHeight: 220 }} />
          )
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
              event.currentTarget.style.filter = "brightness(1.02)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.boxShadow = "none";
              event.currentTarget.style.filter = "none";
            }}
          >
            {triggerText}
          </button>
        )}
      </div>

      {showGifSearch ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "grid",
            placeItems: "center",
            zIndex: 40,
            padding: spacingTokens.md
          }}
          onClick={() => setShowGifSearch(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 18,
              boxShadow: "0 14px 36px rgba(0,0,0,0.2)",
              padding: spacingTokens.md,
              display: "grid",
              gap: spacingTokens.sm
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Add a gif</strong>
              <button type="button" onClick={() => setShowGifSearch(false)} style={{ ...pillControlStyle(theme), cursor: "pointer", padding: "6px 10px" }}>Close</button>
            </div>
            <input
              value={tenorQuery}
              onChange={(event) => setTenorQuery(event.target.value)}
              placeholder="Search GIFs"
              style={pillControlStyle(theme)}
            />
            <small style={{ color: theme.colors.textSecondary }}>GIF search modal scaffold in place; richer results can be wired in next.</small>
          </div>
        </div>
      ) : null}
    </>
  );
};
