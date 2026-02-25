import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { radiusTokens, spacingTokens, type Theme } from "@nospoilers/ui";

type CatalogItemType = "book" | "tv_show";
type CatalogSource = "tmdb" | "tvmaze" | "openlibrary" | "google_books" | "manual";

export type CatalogSearchResult = {
  result_id: string;
  item_type: CatalogItemType;
  title: string;
  canonical_title?: string | null;
  release_year?: number | null;
  subtitle?: string | null;
  cover_image_url?: string | null;
  metadata_source: CatalogSource;
  source_id: string;
  source_url?: string | null;
  aliases?: string[];
  has_progress_units: boolean;
  progress_unit_type?: "chapter" | "episode" | "page" | "percent" | null;
  progress_summary?: Record<string, unknown> | null;
  local_catalog?: { exists: boolean; catalog_item_id: number | null };
};

export type CatalogImportRequest = {
  item_type: CatalogItemType;
  metadata_source: CatalogSource;
  source_id: string;
  source_hint?: { title?: string; release_year?: number | null };
  import_options?: { fetch_progress_units?: boolean; progress_fetch_depth?: "none" | "summary" | "full" };
  attach?: { user_profile?: boolean; group_ids?: number[] };
};

export type CatalogImportResponse = {
  catalog_item: {
    id: number;
    item_type: CatalogItemType;
    title: string;
    canonical_title?: string | null;
    release_year?: number | null;
    cover_image_url?: string | null;
    metadata_source?: CatalogSource | null;
    source_id?: string | null;
    source_url?: string | null;
  };
  progress_units?: {
    imported: boolean;
    unit_type?: "chapter" | "episode" | "page" | "percent" | null;
    count?: number | null;
    summary?: Record<string, unknown> | null;
  };
  dedupe?: {
    matched_existing_catalog_item_id?: number | null;
    created_new_catalog_item?: boolean;
  };
};

type SearchResponse = {
  results: CatalogSearchResult[];
  pagination?: { next_cursor?: string | null; has_more?: boolean };
  providers?: { queried?: string[]; partial?: boolean; timeouts?: string[] };
};

type SearchMode = "profile" | "group" | "post";
type TypeFilter = "all" | CatalogItemType;

type Props = {
  open: boolean;
  theme: Theme;
  mode: SearchMode;
  groupId?: number;
  onClose: () => void;
  onImported: (result: CatalogImportResponse, selected: CatalogSearchResult) => void;
  onError?: (message: string) => void;

  // Optional endpoint overrides
  searchEndpoint?: string; // default: /search/catalog
  importEndpoint?: string; // default: /catalog/import

  // Optional auth/session hooks if your backend needs credentials or custom fetch
  fetchImpl?: typeof fetch;
  defaultTypeFilter?: TypeFilter;
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SEARCH_ENDPOINT = "/search/catalog";
const DEFAULT_IMPORT_ENDPOINT = "/catalog/import";
const RECENT_SEARCHES_KEY = "nospoilers:catalog-search:recent";

const SOURCE_LABEL: Record<CatalogSource, string> = {
  tmdb: "TMDB",
  tvmaze: "TVmaze",
  openlibrary: "Open Library",
  google_books: "Google Books",
  manual: "Manual"
};

const TYPE_LABEL: Record<CatalogItemType, string> = {
  book: "Book",
  tv_show: "TV Show"
};

const progressLabel = (value?: CatalogSearchResult["progress_unit_type"]) => {
  if (!value) return null;
  if (value === "episode") return "Episodes";
  if (value === "chapter") return "Chapters";
  if (value === "page") return "Pages";
  if (value === "percent") return "Percent";
  return null;
};

const formatSubtitle = (item: CatalogSearchResult): string => {
  const parts: string[] = [];
  if (item.subtitle?.trim()) parts.push(item.subtitle.trim());
  if (item.release_year) parts.push(String(item.release_year));
  return parts.join(" • ");
};

const getAudienceText = (mode: SearchMode) => {
  if (mode === "group") return "Add to group";
  if (mode === "profile") return "Add to profile";
  return "Select for post";
};

const getImportButtonText = (mode: SearchMode, importing: boolean) => {
  if (importing) return "Adding…";
  if (mode === "post") return "Select item";
  if (mode === "group") return "Add to group";
  return "Add to profile";
};

const parseSearchResponse = async (response: Response): Promise<SearchResponse> => {
  const json = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof json === "object" && json && "message" in json && typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : `Search failed (${response.status})`;
    throw new Error(message);
  }
  const parsed = json as Partial<SearchResponse>;
  return {
    results: Array.isArray(parsed.results) ? parsed.results : [],
    pagination: parsed.pagination,
    providers: parsed.providers
  };
};

const parseImportResponse = async (response: Response): Promise<CatalogImportResponse> => {
  const json = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof json === "object" && json && "message" in json && typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : `Import failed (${response.status})`;
    throw new Error(message);
  }
  return json as CatalogImportResponse;
};

const loadRecentSearches = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string").slice(0, 8);
  } catch {
    return [];
  }
};

const saveRecentSearch = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return;

  const next = [trimmed, ...loadRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
};

export const CatalogSearchSheet = ({
  open,
  theme,
  mode,
  groupId,
  onClose,
  onImported,
  onError,
  searchEndpoint = DEFAULT_SEARCH_ENDPOINT,
  importEndpoint = DEFAULT_IMPORT_ENDPOINT,
  fetchImpl = fetch,
  defaultTypeFilter = "all"
}: Props) => {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(defaultTypeFilter);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [importingResultId, setImportingResultId] = useState<string>();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [providerMeta, setProviderMeta] = useState<SearchResponse["providers"]>();

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setRecentSearches(loadRecentSearches());
    // autofocus after render
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setStatus("idle");
      setResults([]);
      setSelectedId(undefined);
      setErrorMessage(undefined);
      setNextCursor(null);
      setHasMore(false);
      setImportingResultId(undefined);
      setProviderMeta(undefined);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
  }, [open]);

  const selectedResult = useMemo(
    () => results.find((item) => item.result_id === selectedId),
    [results, selectedId]
  );

  const canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  const runSearch = async (opts?: { cursor?: string; append?: boolean }) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStatus("idle");
      setResults([]);
      setErrorMessage(undefined);
      setNextCursor(null);
      setHasMore(false);
      setProviderMeta(undefined);
      return;
    }

    const append = Boolean(opts?.append);
    const cursor = opts?.cursor;

    if (abortRef.current && !append) {
      abortRef.current.abort();
    }

    const requestSeq = ++requestSeqRef.current;
    const controller = new AbortController();
    if (!append) {
      abortRef.current = controller;
      setStatus("loading");
      setErrorMessage(undefined);
    } else {
      setIsLoadingMore(true);
    }

    const params = new URLSearchParams();
    params.set("q", trimmed);
    if (typeFilter !== "all") params.set("types", typeFilter);
    params.set("limit", "12");
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await fetchImpl(`${searchEndpoint}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });

      const parsed = await parseSearchResponse(response);

      // Ignore stale responses
      if (!append && requestSeq !== requestSeqRef.current) return;

      setProviderMeta(parsed.providers);
      setNextCursor(parsed.pagination?.next_cursor ?? null);
      setHasMore(Boolean(parsed.pagination?.has_more));

      if (append) {
        setResults((prev) => {
          const seen = new Set(prev.map((item) => item.result_id));
          const merged = [...prev];
          for (const item of parsed.results) {
            if (!seen.has(item.result_id)) {
              merged.push(item);
              seen.add(item.result_id);
            }
          }
          return merged;
        });
      } else {
        setResults(parsed.results);
        setSelectedId(parsed.results[0]?.result_id);
      }

      setStatus("ready");
      saveRecentSearch(trimmed);
      setRecentSearches(loadRecentSearches());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "Search failed.";
      setErrorMessage(message);
      setStatus("error");
      onError?.(message);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    debounceRef.current = window.setTimeout(() => {
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, open]);

  const onPickRecentSearch = (value: string) => {
    setQuery(value);
  };

  const handleImportSelected = async () => {
    if (!selectedResult) return;
    if (importingResultId) return;

    const payload: CatalogImportRequest = {
      item_type: selectedResult.item_type,
      metadata_source: selectedResult.metadata_source,
      source_id: selectedResult.source_id,
      source_hint: {
        title: selectedResult.title,
        release_year: selectedResult.release_year ?? null
      },
      import_options: {
        fetch_progress_units: true,
        progress_fetch_depth: mode === "post" ? "summary" : "full"
      },
      attach:
        mode === "post"
          ? undefined
          : mode === "profile"
            ? { user_profile: true }
            : { group_ids: groupId ? [groupId] : [] }
    };

    setImportingResultId(selectedResult.result_id);
    setErrorMessage(undefined);

    try {
      const response = await fetchImpl(importEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const imported = await parseImportResponse(response);
      onImported(imported, selectedResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import catalog item.";
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setImportingResultId(undefined);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    await runSearch({ cursor: nextCursor, append: true });
  };

  if (!open) return null;

  return (
    <div style={overlayStyle()}>
      <div style={sheetStyle(theme)}>
        <header style={headerStyle(theme)}>
          <div>
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Search books & TV shows</h3>
            <small style={{ color: theme.colors.textSecondary }}>{getAudienceText(mode)}</small>
          </div>
          <button type="button" onClick={onClose} style={iconButtonStyle(theme)} aria-label="Close search">
            ✕
          </button>
        </header>

        <div style={{ display: "grid", gap: spacingTokens.sm }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, aliases, authors…"
            style={inputStyle(theme)}
            aria-label="Search catalog"
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["all", "book", "tv_show"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTypeFilter(filter)}
                style={chipButtonStyle(theme, typeFilter === filter)}
              >
                {filter === "all" ? "All" : TYPE_LABEL[filter]}
              </button>
            ))}
          </div>

          {!canSearch && recentSearches.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <small style={{ color: theme.colors.textSecondary }}>Recent searches</small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {recentSearches.map((item) => (
                  <button key={item} type="button" onClick={() => onPickRecentSearch(item)} style={chipButtonStyle(theme, false)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div style={contentGridStyle()}>
          <div style={listPaneStyle(theme)}>
            {status === "idle" ? (
              <EmptyState
                theme={theme}
                title={`Type at least ${MIN_QUERY_LENGTH} characters`}
                subtitle="Search across books and TV shows, then add to your profile, group, or post."
              />
            ) : null}

            {status === "loading" ? (
              <LoadingState theme={theme} label="Searching…" />
            ) : null}

            {status === "error" ? (
              <EmptyState theme={theme} title="Search failed" subtitle={errorMessage ?? "Please try again."} />
            ) : null}

            {status === "ready" && results.length === 0 ? (
              <EmptyState theme={theme} title="No results" subtitle="Try a different title, author, or alternate name." />
            ) : null}

            {status === "ready" && results.length > 0 ? (
              <>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {results.map((item) => {
                    const isSelected = selectedId === item.result_id;
                    const subtitle = formatSubtitle(item);
                    const progressChip = progressLabel(item.progress_unit_type);
                    return (
                      <li key={item.result_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.result_id)}
                          style={resultRowButtonStyle(theme, isSelected)}
                        >
                          <div style={coverWrapperStyle(theme)}>
                            {item.cover_image_url ? (
                              <img
                                src={item.cover_image_url}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                              />
                            ) : (
                              <div style={coverFallbackStyle(theme)}>
                                <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                  {item.item_type === "book" ? "Book" : "TV"}
                                </span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: "grid", gap: 4, textAlign: "left" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <strong style={{ color: theme.colors.textPrimary, fontSize: 14 }}>{item.title}</strong>
                              {item.local_catalog?.exists ? (
                                <span style={tinyPillStyle(theme, true)}>Added</span>
                              ) : null}
                            </div>

                            {subtitle ? (
                              <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{subtitle}</div>
                            ) : null}

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={tinyPillStyle(theme)}>{TYPE_LABEL[item.item_type]}</span>
                              <span style={tinyPillStyle(theme)}>{SOURCE_LABEL[item.metadata_source]}</span>
                              {progressChip ? <span style={tinyPillStyle(theme)}>{progressChip}</span> : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {(hasMore || isLoadingMore) && (
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => void handleLoadMore()}
                      disabled={!hasMore || isLoadingMore}
                      style={secondaryButtonStyle(theme, !hasMore || isLoadingMore)}
                    >
                      {isLoadingMore ? "Loading…" : hasMore ? "Load more" : "No more results"}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div style={detailPaneStyle(theme)}>
            {selectedResult ? (
              <SelectedResultPanel
                theme={theme}
                item={selectedResult}
                mode={mode}
                isImporting={importingResultId === selectedResult.result_id}
                onImport={() => void handleImportSelected()}
                errorMessage={errorMessage}
              />
            ) : (
              <EmptyState theme={theme} title="Select a result" subtitle="Choose an item to preview details and add it." />
            )}

            {providerMeta ? (
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <small style={{ color: theme.colors.textSecondary }}>
                  Providers: {(providerMeta.queried ?? []).join(", ") || "—"}
                  {providerMeta.partial ? " • partial results" : ""}
                  {(providerMeta.timeouts?.length ?? 0) > 0 ? ` • timeouts: ${providerMeta.timeouts?.join(", ")}` : ""}
                </small>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const SelectedResultPanel = ({
  theme,
  item,
  mode,
  isImporting,
  onImport,
  errorMessage
}: {
  theme: Theme;
  item: CatalogSearchResult;
  mode: SearchMode;
  isImporting: boolean;
  onImport: () => void;
  errorMessage?: string;
}) => {
  const subtitle = formatSubtitle(item);

  return (
    <div style={{ display: "grid", gap: spacingTokens.sm, alignContent: "start", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: spacingTokens.sm, alignItems: "start" }}>
        <div style={{ width: 72, height: 108, borderRadius: 12, overflow: "hidden", border: `1px solid ${theme.colors.border}` }}>
          {item.cover_image_url ? (
            <img src={item.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={coverFallbackStyle(theme)}>
              <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>{TYPE_LABEL[item.item_type]}</span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ color: theme.colors.textPrimary, fontSize: 16, lineHeight: 1.2 }}>{item.title}</strong>
          {subtitle ? <div style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{subtitle}</div> : null}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={tinyPillStyle(theme)}>{TYPE_LABEL[item.item_type]}</span>
            <span style={tinyPillStyle(theme)}>{SOURCE_LABEL[item.metadata_source]}</span>
            {item.local_catalog?.exists ? <span style={tinyPillStyle(theme, true)}>Already in catalog</span> : null}
          </div>
        </div>
      </div>

      {item.aliases?.length ? (
        <section style={sectionCardStyle(theme)}>
          <small style={{ color: theme.colors.textSecondary }}>Aliases</small>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {item.aliases.slice(0, 8).map((alias) => (
              <span key={alias} style={tinyPillStyle(theme)}>
                {alias}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section style={sectionCardStyle(theme)}>
        <small style={{ color: theme.colors.textSecondary }}>Progress tracking</small>
        <div style={{ marginTop: 6, color: theme.colors.textPrimary, fontSize: 14 }}>
          {item.has_progress_units
            ? `${progressLabel(item.progress_unit_type) ?? "Units"} available`
            : item.progress_unit_type
              ? `Will use ${progressLabel(item.progress_unit_type)?.toLowerCase()} fallback`
              : "Progress mode will be determined during import"}
        </div>

        {item.progress_summary ? (
          <pre
            style={{
              margin: "8px 0 0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 11,
              color: theme.colors.textSecondary,
              background: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 10,
              padding: 8
            }}
          >
            {JSON.stringify(item.progress_summary, null, 2)}
          </pre>
        ) : null}
      </section>

      {item.source_url ? (
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.colors.accent, fontSize: 13, textDecoration: "none" }}
        >
          View source ↗
        </a>
      ) : null}

      {errorMessage ? <p style={{ margin: 0, color: "#b42318", fontSize: 13 }}>{errorMessage}</p> : null}

      <button type="button" onClick={onImport} disabled={isImporting} style={primaryButtonStyle(theme, isImporting)}>
        {getImportButtonText(mode, isImporting)}
      </button>
    </div>
  );
};

const EmptyState = ({ theme, title, subtitle }: { theme: Theme; title: string; subtitle?: string }) => (
  <div
    style={{
      border: `1px dashed ${theme.colors.border}`,
      borderRadius: radiusTokens.md,
      padding: spacingTokens.md,
      display: "grid",
      gap: 6,
      alignContent: "center",
      minHeight: 180
    }}
  >
    <strong style={{ color: theme.colors.textPrimary }}>{title}</strong>
    {subtitle ? <span style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{subtitle}</span> : null}
  </div>
);

const LoadingState = ({ theme, label }: { theme: Theme; label: string }) => (
  <div
    style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: radiusTokens.md,
      padding: spacingTokens.md,
      minHeight: 180,
      display: "grid",
      placeItems: "center",
      color: theme.colors.textSecondary
    }}
  >
    {label}
  </div>
);

// ----- styles -----

const overlayStyle = (): CSSProperties => ({
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "grid",
  placeItems: "end center",
  padding: spacingTokens.lg,
  zIndex: 30
});

const sheetStyle = (theme: Theme): CSSProperties => ({
  width: "min(960px, 100%)",
  maxHeight: "min(88vh, 860px)",
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 20,
  boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
  display: "grid",
  gridTemplateRows: "auto auto 1fr",
  overflow: "hidden"
});

const headerStyle = (theme: Theme): CSSProperties => ({
  padding: spacingTokens.md,
  borderBottom: `1px solid ${theme.colors.border}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacingTokens.sm
});

const iconButtonStyle = (theme: Theme): CSSProperties => ({
  border: `1px solid ${theme.colors.border}`,
  background: "transparent",
  color: theme.colors.textPrimary,
  borderRadius: 10,
  width: 36,
  height: 36,
  cursor: "pointer"
});

const inputStyle = (theme: Theme): CSSProperties => ({
  width: "100%",
  borderRadius: radiusTokens.md,
  border: `1px solid ${theme.colors.border}`,
  padding: "11px 12px",
  background: theme.colors.surface,
  color: theme.colors.textPrimary,
  outline: "none"
});

const contentGridStyle = (): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
  gap: 0,
  minHeight: 0,
  overflow: "hidden"
});

const listPaneStyle = (theme: Theme): CSSProperties => ({
  borderRight: `1px solid ${theme.colors.border}`,
  padding: spacingTokens.md,
  overflowY: "auto",
  minHeight: 0
});

const detailPaneStyle = (theme: Theme): CSSProperties => ({
  padding: spacingTokens.md,
  overflowY: "auto",
  minHeight: 0,
  display: "grid"
});

const chipButtonStyle = (theme: Theme, active: boolean): CSSProperties => ({
  borderRadius: 999,
  border: `1px solid ${active ? theme.colors.accent : theme.colors.border}`,
  background: active ? theme.colors.accent : "transparent",
  color: active ? theme.colors.accentText : theme.colors.textPrimary,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer"
});

const resultRowButtonStyle = (theme: Theme, selected: boolean): CSSProperties => ({
  width: "100%",
  borderRadius: 12,
  border: `1px solid ${selected ? theme.colors.accent : theme.colors.border}`,
  background: selected ? `${theme.colors.accent}12` : theme.colors.surface,
  padding: 8,
  display: "grid",
  gridTemplateColumns: "52px 1fr",
  gap: 10,
  alignItems: "start",
  cursor: "pointer"
});

const coverWrapperStyle = (theme: Theme): CSSProperties => ({
  width: 52,
  height: 76,
  borderRadius: 10,
  overflow: "hidden",
  border: `1px solid ${theme.colors.border}`,
  background: theme.colors.background
});

const coverFallbackStyle = (theme: Theme): CSSProperties => ({
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: theme.colors.background
});

const tinyPillStyle = (theme: Theme, emphasized = false): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: `1px solid ${emphasized ? theme.colors.accent : theme.colors.border}`,
  background: emphasized ? `${theme.colors.accent}14` : "transparent",
  color: emphasized ? theme.colors.accent : theme.colors.textSecondary,
  padding: "2px 8px",
  fontSize: 11,
  lineHeight: 1.4
});

const sectionCardStyle = (theme: Theme): CSSProperties => ({
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  padding: spacingTokens.sm,
  background: theme.colors.surface
});

const primaryButtonStyle = (theme: Theme, disabled: boolean): CSSProperties => ({
  marginTop: "auto",
  border: "none",
  borderRadius: radiusTokens.md,
  padding: "10px 14px",
  background: theme.colors.accent,
  color: theme.colors.accentText,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.7 : 1
});

const secondaryButtonStyle = (theme: Theme, disabled: boolean): CSSProperties => ({
  borderRadius: radiusTokens.md,
  border: `1px solid ${theme.colors.border}`,
  background: "transparent",
  color: theme.colors.textPrimary,
  padding: "8px 12px",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1
});
