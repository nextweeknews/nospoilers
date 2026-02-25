import { radiusTokens, spacingTokens, type AppTheme } from "@nospoilers/ui";
import { useMemo, useState } from "react";

type Option = { id: string; label: string };
type Attachment = { url: string; kind: "image" | "video"; bytes: number };

type PostComposerSheetProps = {
  open: boolean;
  theme: AppTheme;
  groups: Option[];
  catalogItems: Option[];
  progressUnits: Option[];
  onClose: () => void;
  onSubmit: (payload: {
    body_text: string;
    group_id: string | null;
    catalog_item_id: string | null;
    progress_unit_id: string | null;
    tenor_gif_url: string | null;
    tenor_gif_id: string | null;
    attachments: Attachment[];
  }) => Promise<void>;
};

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const PostComposerSheet = ({ open, theme, groups, catalogItems, progressUnits, onClose, onSubmit }: PostComposerSheetProps) => {
  const [bodyText, setBodyText] = useState("");
  const [groupId, setGroupId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [progressUnitId, setProgressUnitId] = useState("");
  const [tenorQuery, setTenorQuery] = useState("");
  const [tenorGifId, setTenorGifId] = useState("");
  const [tenorGifUrl, setTenorGifUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string>();

  const tenorResults = useMemo(() => {
    const q = tenorQuery.trim();
    if (!q) {
      return [];
    }

    return Array.from({ length: 3 }).map((_, idx) => ({
      id: `${q.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      url: `https://tenor.com/view/${q.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      label: `${q} GIF ${idx + 1}`
    }));
  }, [tenorQuery]);

  if (!open) {
    return null;
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "end center", padding: spacingTokens.lg }}>
      <div style={{ width: "min(520px, 100%)", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.md, display: "grid", gap: spacingTokens.sm, transform: "translateX(0)", animation: "slideInFromRight 180ms ease-out" }}>
        <style>{"@keyframes slideInFromRight{from{opacity:.5;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}"}</style>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Create post</h3>
        <textarea value={bodyText} maxLength={500} onChange={(event) => setBodyText(event.target.value)} placeholder="Write something spoiler-safe..." style={{ minHeight: 92, borderRadius: radiusTokens.md, border: `1px solid ${theme.colors.border}`, padding: spacingTokens.sm, resize: "vertical" }} />
        <small style={{ color: theme.colors.textSecondary }}>{bodyText.length}/500</small>

        <label>
          Group (optional)
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <label>
          Catalog item (optional)
          <select value={catalogItemId} onChange={(event) => setCatalogItemId(event.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            {catalogItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Progress unit (optional)
          <select value={progressUnitId} onChange={(event) => setProgressUnitId(event.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            {progressUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
          </select>
        </label>

        <label>
          Media picker (10MB max each)
          <input type="file" accept="image/*,video/*" multiple onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            const tooLarge = files.find((file) => file.size > MAX_MEDIA_BYTES);
            if (tooLarge) {
              setError(`\"${tooLarge.name}\" exceeds the 10MB limit.`);
              return;
            }
            setAttachments(files.map((file) => ({
              url: file.name,
              bytes: file.size,
              kind: file.type.startsWith("video") ? "video" : "image"
            })));
            setError(undefined);
          }} />
        </label>

        <label>
          Tenor search
          <input value={tenorQuery} onChange={(event) => setTenorQuery(event.target.value)} placeholder="Search GIFs" />
        </label>
        <div style={{ display: "flex", gap: spacingTokens.sm, flexWrap: "wrap" }}>
          {tenorResults.map((result) => (
            <button key={result.id} type="button" onClick={() => { setTenorGifId(result.id); setTenorGifUrl(result.url); }} style={{ borderRadius: radiusTokens.pill, border: `1px solid ${theme.colors.border}` }}>
              {result.label}
            </button>
          ))}
        </div>
        {tenorGifId ? <small style={{ color: theme.colors.textSecondary }}>Selected Tenor: {tenorGifId}</small> : null}
        {error ? <small style={{ color: "#d11" }}>{error}</small> : null}

        <div style={{ display: "flex", gap: spacingTokens.sm, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={async () => {
            await onSubmit({
              body_text: bodyText,
              group_id: groupId || null,
              catalog_item_id: catalogItemId || null,
              progress_unit_id: progressUnitId || null,
              tenor_gif_id: tenorGifId || null,
              tenor_gif_url: tenorGifUrl || null,
              attachments
            });
            onClose();
          }} style={{ background: theme.colors.accent, color: theme.colors.accentText, border: "none", borderRadius: radiusTokens.md, padding: "10px 14px" }}>Publish</button>
        </div>
      </div>
    </div>
  );
};
