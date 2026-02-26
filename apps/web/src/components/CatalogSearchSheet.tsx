import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { radiusTokens, spacingTokens, type Theme } from "@nospoilers/ui";
import { supabaseClient } from "../services/supabaseClient";

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
  metadata?: Record<string, unknown>;
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

/**
 * Current edge function ("search-catalog") likely returns a simpler shape:
 * {
 *   query, count,
 *   results: [{ provider, source_id, item_type, title, canonical_title, release_year, cover_image_url, source_url, subtitle, metadata }]
 * }
 */
type EdgeFunctionSearchResult = {
  provider?: string;
  metadata_source?: string;
  source_id?: string;
  item_type?: string;
  title?: string;
  canonical_title?: string | null;
  release_year?: number | null;
  cover_image_url?: string | null;
  source_url?: string | null;
  subtitle?: string | null;
  metadata?: Record<string, unknown>;
};

type SearchResponse = {
  results: CatalogSearchResult[];
  pagination?: { next_cursor?: string | null; has_more?: boolean };
  providers?: { queried?: string[]; partial?: boolean; timeouts?: string[] };
};

type SearchMode = "profile" | "group" | "post";
type TypeFilter = "all" | CatalogItemType;
type SelectionBehavior = "select_only" | "import";

type Props = {
  open: boolean;
  theme: Theme;
  mode?: SearchMode;
  groupId?: number;
  onClose: () => void;

  /**
   * For immediate frontend integration before /catalog/import exists.
   * In "select_only" mode, the primary action calls onSelected and does not POST /catalog/import.
   */
  selectionBehavior?: SelectionBehavior;
  onSelected?: (selected: CatalogSearchResult) => void;

  /**
   * For full import flow (future/current if implemented).
   * Required only if selectionBehavior === "import".
   */
  onImported?: (result: CatalogImportResponse, selected: CatalogSearchResult) => void;
  onAddToShelf?: (result: CatalogImportResponse, selected: CatalogSearchResult) => void | Promise<void>;
  onAddToGroup?: (result: CatalogImportResponse, selected: CatalogSearchResult, groupId: string) => void | Promise<void>;
  availableGroups?: Array<{ id: string; name: string }>;

  onError?: (message: string) => void;

  // Endpoint overrides
  searchEndpoint?: string; // e.g. https://<project>.functions.supabase.co/search-catalog
  importEndpoint?: string; // e.g. https://<project>.functions.supabase.co/catalog-import

  // Optional fetch override + request headers
  fetchImpl?: typeof fetch;
  defaultTypeFilter?: TypeFilter;
  defaultHeaders?: HeadersInit;
  searchHeaders?: HeadersInit;
  importHeaders?: HeadersInit;

  // Convenience if you want to inject anon key directly
  apiKey?: string;
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SEARCH_ENDPOINT = `${
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_FUNCTIONS_URL ?? ""
}/search-catalog`;

const DEFAULT_IMPORT_ENDPOINT = `${
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_FUNCTIONS_URL ?? ""
}/catalog-import`;
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

const getPrimaryActionText = (mode: SearchMode, importing: boolean, selectionBehavior: SelectionBehavior) => {
  if (selectionBehavior === "select_only") return "Select item";
  if (importing) return "Adding…";
  if (mode === "post") return "Select item";
  if (mode === "group") return "Add to group";
  return "Add to profile";
};

const isCatalogItemType = (value: unknown): value is CatalogItemType => value === "book" || value === "tv_show";

const isCatalogSource = (value: unknown): value is CatalogSource =>
  value === "tmdb" || value === "tvmaze" || value === "openlibrary" || value === "google_books" || value === "manual";

const normalizeSource = (value: unknown): CatalogSource => (isCatalogSource(value) ? value : "manual");

const deriveProgressDefaults = (itemType: CatalogItemType) => {
  if (itemType === "tv_show") {
    return { has_progress_units: true, progress_unit_type: "episode" as const };
  }
  return { has_progress_units: true, progress_unit_type: "chapter" as const };
};

const toUiResultFromEdge = (raw: EdgeFunctionSearchResult): CatalogSearchResult | null => {
  const itemType = isCatalogItemType(raw.item_type) ? raw.item_type : null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const sourceId = typeof raw.source_id === "string" ? raw.source_id : "";
  const provider = normalizeSource(raw.provider);

  if (!itemType || !title || !sourceId) {
    return null;
  }

  const progressDefaults = deriveProgressDefaults(itemType);

  return {
    result_id: `${provider}:${sourceId}`,
    item_type: itemType,
    title,
    canonical_title: typeof raw.canonical_title === "string" ? raw.canonical_title : raw.canonical_title ?? null,
    release_year: typeof raw.release_year === "number" ? raw.release_year : null,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : null,
    cover_image_url: typeof raw.cover_image_url === "string" ? raw.cover_image_url : null,
    metadata_source: provider,
    source_id: sourceId,
    source_url: typeof raw.source_url === "string" ? raw.source_url : null,
    aliases: [],
    has_progress_units: progressDefaults.has_progress_units,
    progress_unit_type: progressDefaults.progress_unit_type,
    progress_summary: null,
    local_catalog: { exists: false, catalog_item_id: null },
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}
  };
};

const toUiResultFromRich = (raw: unknown): CatalogSearchResult | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<CatalogSearchResult>;

  const itemType = isCatalogItemType(obj.item_type) ? obj.item_type : null;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const sourceId = typeof obj.source_id === "string" ? obj.source_id : "";
  const metadataSource = normalizeSource(obj.metadata_source);

  if (!itemType || !title || !sourceId) return null;

  const resultId =
    typeof obj.result_id === "string" && obj.result_id.trim()
      ? obj.result_id
      : `${metadataSource}:${sourceId}`;

  const defaults = deriveProgressDefaults(itemType);

  return {
    result_id: resultId,
    item_type: itemType,
    title,
    canonical_title: typeof obj.canonical_title === "string" ? obj.canonical_title : obj.canonical_title ?? null,
    release_year: typeof obj.release_year === "number" ? obj.release_year : null,
    subtitle: typeof obj.subtitle === "string" ? obj.subtitle : null,
    cover_image_url: typeof obj.cover_image_url === "string" ? obj.cover_image_url : null,
    metadata_source: metadataSource,
    source_id: sourceId,
    source_url: typeof obj.source_url === "string" ? obj.source_url : null,
    aliases: Array.isArray(obj.aliases) ? obj.aliases.filter((v): v is string => typeof v === "string") : [],
    has_progress_units:
      typeof obj.has_progress_units === "boolean" ? obj.has_progress_units : defaults.has_progress_units,
    progress_unit_type: obj.progress_unit_type ?? defaults.progress_unit_type,
    progress_summary:
      obj.progress_summary && typeof obj.progress_summary === "object"
        ? (obj.progress_summary as Record<string, unknown>)
        : null,
    local_catalog:
      obj.local_catalog && typeof obj.local_catalog === "object"
        ? {
            exists: Boolean((obj.local_catalog as { exists?: unknown }).exists),
            catalog_item_id:
              typeof (obj.local_catalog as { catalog_item_id?: unknown }).catalog_item_id === "number"
                ? ((obj.local_catalog as { catalog_item_id: number }).catalog_item_id ?? null)
                : null
          }
        : { exists: false, catalog_item_id: null },
    metadata: obj.metadata && typeof obj.metadata === "object" ? (obj.metadata as Record<string, unknown>) : {}
  };
};

const parseErrorMessageFromJson = (json: unknown, fallback: string): string => {
  if (typeof json !== "object" || !json) return fallback;

  const maybeMessage = (json as { message?: unknown }).message;
  if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;

  const maybeError = (json as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim()) return maybeError;

  return fallback;
};

const parseSearchResponse = async (response: Response): Promise<SearchResponse> => {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Search failed (${response.status})`);
    }
    json = {};
  }

  if (!response.ok) {
    throw new Error(parseErrorMessageFromJson(json, `Search failed (${response.status})`));
  }

  const parsed = (json ?? {}) as {
    results?: unknown;
    pagination?: SearchResponse["pagination"];
    providers?: SearchResponse["providers"];
  };

  const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
  const normalizedResults: CatalogSearchResult[] = rawResults
    .map((item) => {
      // Try rich format first (already normalized backend contract)
      const rich = toUiResultFromRich(item);
      if (rich) return rich;

      // Then try current edge-function format
      return toUiResultFromEdge(item as EdgeFunctionSearchResult);
    })
    .filter((item): item is CatalogSearchResult => Boolean(item));

  return {
    results: normalizedResults,
    pagination: parsed.pagination,
    providers: parsed.providers
  };
};

const parseImportResponse = async (response: Response): Promise<CatalogImportResponse> => {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) throw new Error(`Import failed (${response.status})`);
    throw new Error("Invalid import response.");
  }

  if (!response.ok) {
    throw new Error(parseErrorMessageFromJson(json, `Import failed (${response.status})`));
  }
  return json as CatalogImportResponse;
};

const rawProvider = raw.provider ?? raw.metadata_source;
const provider = normalizeSource(rawProvider);

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

const mergeHeaders = (...headerSets: Array<HeadersInit | undefined>): Headers => {
  const headers = new Headers();
  for (const set of headerSets) {
    if (!set) continue;
    new Headers(set).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
};

export const CatalogSearchSheet = ({
  open,
  theme,
  mode = "post",
  groupId,
  onClose,
  selectionBehavior = "select_only",
  onSelected,
  onImported,
  onAddToShelf,
  onAddToGroup,
  availableGroups = [],
  onError,
  searchEndpoint = DEFAULT_SEARCH_ENDPOINT,
  importEndpoint = DEFAULT_IMPORT_ENDPOINT,
  fetchImpl = fetch,
  defaultTypeFilter = "all",
  defaultHeaders,
  searchHeaders,
  importHeaders,
  apiKey
}: Props) => {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(defaultTypeFilter);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [searchErrorMessage, setSearchErrorMessage] = useState<string>();
  const [importErrorMessage, setImportErrorMessage] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [importingResultId, setImportingResultId] = useState<string>();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [providerMeta, setProviderMeta] = useState<SearchResponse["providers"]>();
  const [menuResultId, setMenuResultId] = useState<string>();
  const [groupPickerResultId, setGroupPickerResultId] = useState<string>();
  const [hoveredResultId, setHoveredResultId] = useState<string>();

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setTypeFilter(defaultTypeFilter);
    setRecentSearches(loadRecentSearches());

    // autofocus after render
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, defaultTypeFilter]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setStatus("idle");
      setResults([]);
      setSelectedId(undefined);
      setSearchErrorMessage(undefined);
      setImportErrorMessage(undefined);
      setNextCursor(null);
      setHasMore(false);
      setImportingResultId(undefined);
      setProviderMeta(undefined);
      setMenuResultId(undefined);
      setGroupPickerResultId(undefined);
      setHoveredResultId(undefined);

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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Enter" && event.metaKey === false && event.ctrlKey === false && event.altKey === false) {
        const target = event.target as HTMLElement | null;
        if (target && target.tagName.toLowerCase() === "input") {
          if (selectionBehavior === "select_only" && selectedResultRef.current) {
            event.preventDefault();
            onSelected?.(selectedResultRef.current);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onSelected, selectionBehavior]);

  const selectedResult = useMemo(
    () => results.find((item) => item.result_id === selectedId),
    [results, selectedId]
  );

  const selectedResultRef = useRef<CatalogSearchResult | undefined>(undefined);
  useEffect(() => {
    selectedResultRef.current = selectedResult;
  }, [selectedResult]);

  const canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  const getSearchRequestHeaders = async (): Promise<Headers> => {
    const headers = mergeHeaders(
      { Accept: "application/json" },
      defaultHeaders,
      searchHeaders,
      apiKey ? { apikey: apiKey } : undefined
    );
  
    // Ensure apikey exists
    if (!headers.has("apikey")) {
      const envApiKey = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY;
      if (envApiKey) headers.set("apikey", envApiKey);
    }
  
    // Ensure Authorization exists (needed if edge function requires JWT)
    if (!headers.has("authorization")) {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set("authorization", `Bearer ${token}`);
      console.log("[catalog-search] token present?", Boolean(token), token?.slice(0, 16));
    }
  
    return headers;
  };

  const getImportRequestHeaders = async (): Promise<Headers> => {
    const headers = mergeHeaders(
      {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      defaultHeaders,
      importHeaders,
      apiKey ? { apikey: apiKey } : undefined
    );
  
    // Ensure apikey exists
    if (!headers.has("apikey")) {
      const envApiKey = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY;
      if (envApiKey) headers.set("apikey", envApiKey);
    }
  
    // Ensure Authorization exists (required by catalog-import edge function)
    if (!headers.has("authorization")) {
      try {
        // Uses the user's current session token via your existing supabase client
        const { data } = await supabaseClient.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.set("authorization", `Bearer ${token}`);
      } catch {
        // If this fails, the edge function will return "Missing Authorization bearer token"
      }
    }
  
    return headers;
  };

  const runSearch = async (opts?: { cursor?: string; append?: boolean }) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStatus("idle");
      setResults([]);
      setSearchErrorMessage(undefined);
      setImportErrorMessage(undefined);
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
      setSearchErrorMessage(undefined);
      setImportErrorMessage(undefined);
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
        headers: await getSearchRequestHeaders(),
        signal: controller.signal
      });

      const parsed = await parseSearchResponse(response);

      // Ignore stale base-search responses
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
        setSelectedId((current) => {
          if (current && parsed.results.some((r) => r.result_id === current)) return current;
          return parsed.results[0]?.result_id;
        });
      }

      setStatus("ready");
      saveRecentSearch(trimmed);
      setRecentSearches(loadRecentSearches());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "Search failed.";
      setSearchErrorMessage(message);
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
    // Intentionally excludes runSearch (function identity changes each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, open]);

  const onPickRecentSearch = (value: string) => {
    setQuery(value);
    setSearchErrorMessage(undefined);
    setImportErrorMessage(undefined);
  };

  const importCatalogItem = async (item: CatalogSearchResult) => {
    if (importingResultId) return null;
    if (!onImported) {
      const message = "Catalog import handler is not configured.";
      setImportErrorMessage(message);
      onError?.(message);
      return null;
    }

    const payload: CatalogImportRequest = {
      item_type: item.item_type,
      metadata_source: item.metadata_source,
      source_id: item.source_id,
      source_hint: {
        title: item.title,
        release_year: item.release_year ?? null
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

    setImportingResultId(item.result_id);
    setImportErrorMessage(undefined);

    try {
      const response = await fetchImpl(importEndpoint, {
        method: "POST",
        headers: await getImportRequestHeaders(),
        body: JSON.stringify(payload)
      });

      const imported = await parseImportResponse(response);
      onImported(imported, item);
      return imported;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import catalog item.";
      setImportErrorMessage(message);
      onError?.(message);
      return null;
    } finally {
      setImportingResultId(undefined);
    }
  };

  const handlePrimaryAction = async () => {
    if (!selectedResult) return;
    if (selectionBehavior === "select_only") {
      setImportErrorMessage(undefined);
      onSelected?.(selectedResult);
      return;
    }
    await importCatalogItem(selectedResult);
  };

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    await runSearch({ cursor: nextCursor, append: true });
  };

  if (!open) return null;

  const effectiveDetailError = importErrorMessage;

  return (
    <div
      style={overlayStyle()}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Catalog search"
    >
      <div style={sheetStyle(theme)} onClick={(event) => event.stopPropagation()}>
        <header style={headerStyle(theme)}>
          <div>
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Search books & TV shows</h3>
            <small style={{ color: theme.colors.textSecondary }}>{getAudienceText(mode)}</small>
          </div>
          <button type="button" onClick={onClose} style={iconButtonStyle(theme)} aria-label="Close search">
            ✕
          </button>
        </header>

        <div style={{ display: "grid", gap: spacingTokens.sm, padding: spacingTokens.md, borderBottom: `1px solid ${theme.colors.border}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchErrorMessage(undefined);
            }}
            placeholder="Search books and TV shows…"
            style={inputStyle(theme)}
            aria-label="Search catalog"
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["all", "book", "tv_show"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setTypeFilter(filter);
                  setSearchErrorMessage(undefined);
                }}
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
                subtitle="Search across books and TV shows, then select an item."
              />
            ) : null}

            {status === "loading" ? <LoadingState theme={theme} label="Searching…" /> : null}

            {status === "error" ? (
              <EmptyState theme={theme} title="Search failed" subtitle={searchErrorMessage ?? "Please try again."} />
            ) : null}

            {status === "ready" && results.length === 0 ? (
              <EmptyState theme={theme} title="No results" subtitle="Try a different title, author, or show name." />
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
                          onMouseEnter={() => setHoveredResultId(item.result_id)}
                          onMouseLeave={() => setHoveredResultId((current) => (current === item.result_id ? undefined : current))}
                          onClick={() => {
                            setSelectedId(item.result_id);
                            setImportErrorMessage(undefined);
                          }}
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
                              {item.local_catalog?.exists ? <span style={tinyPillStyle(theme, true)}>Added</span> : null}
                            </div>

                            {subtitle ? <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{subtitle}</div> : null}

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={tinyPillStyle(theme)}>{TYPE_LABEL[item.item_type]}</span>
                              <span style={tinyPillStyle(theme)}>{SOURCE_LABEL[item.metadata_source] ?? item.metadata_source}</span>
                              {progressChip ? <span style={tinyPillStyle(theme)}>{progressChip}</span> : null}
                            </div>
                          </div>

                          <div style={{ marginLeft: "auto", position: "relative", paddingLeft: 8 }}>
                            {hoveredResultId === item.result_id || menuResultId === item.result_id || groupPickerResultId === item.result_id ? (
                              <button
                                type="button"
                                aria-label={`Add ${item.title}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setMenuResultId((current) => (current === item.result_id ? undefined : item.result_id));
                                  setGroupPickerResultId(undefined);
                                }}
                                style={plusButtonStyle(theme)}
                              >
                                +
                              </button>
                            ) : null}

                            {menuResultId === item.result_id ? (
                              <div style={popoverStyle(theme)} onClick={(event) => event.stopPropagation()}>
                                <button type="button" style={popoverItemStyle(theme)} onClick={async () => {
                                  const imported = await importCatalogItem(item);
                                  if (imported) {
                                    await onAddToShelf?.(imported, item);
                                    setMenuResultId(undefined);
                                  }
                                }}>Add to shelf</button>
                                <button type="button" style={popoverItemStyle(theme)} onClick={() => setGroupPickerResultId(item.result_id)}>Add to group</button>
                              </div>
                            ) : null}

                            {groupPickerResultId === item.result_id ? (
                              <div style={popoverStyle(theme)} onClick={(event) => event.stopPropagation()}>
                                {availableGroups.length ? availableGroups.map((group) => (
                                  <button key={group.id} type="button" style={popoverItemStyle(theme)} onClick={async () => {
                                    const imported = await importCatalogItem(item);
                                    if (imported) {
                                      await onAddToGroup?.(imported, item, group.id);
                                      setGroupPickerResultId(undefined);
                                      setMenuResultId(undefined);
                                    }
                                  }}>{group.name}</button>
                                )) : <small style={{ color: theme.colors.textSecondary }}>No groups available</small>}
                              </div>
                            ) : null}
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

          {providerMeta ? (
            <div style={{ padding: spacingTokens.md, borderTop: `1px solid ${theme.colors.border}` }}>
              <small style={{ color: theme.colors.textSecondary }}>
                Providers: {(providerMeta.queried ?? []).join(", ") || "—"}
                {providerMeta.partial ? " • partial results" : ""}
                {(providerMeta.timeouts?.length ?? 0) > 0 ? ` • timeouts: ${providerMeta.timeouts?.join(", ")}` : ""}
              </small>
              {effectiveDetailError ? <p style={{ margin: "8px 0 0", color: "#b42318", fontSize: 13 }}>{effectiveDetailError}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const SelectedResultPanel = ({
  theme,
  item,
  mode,
  selectionBehavior,
  isImporting,
  onPrimaryAction,
  errorMessage
}: {
  theme: Theme;
  item: CatalogSearchResult;
  mode: SearchMode;
  selectionBehavior: SelectionBehavior;
  isImporting: boolean;
  onPrimaryAction: () => void;
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
            <span style={tinyPillStyle(theme)}>{SOURCE_LABEL[item.metadata_source] ?? item.metadata_source}</span>
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

      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={selectionBehavior === "import" ? isImporting : false}
        style={primaryButtonStyle(theme, selectionBehavior === "import" ? isImporting : false)}
      >
        {getPrimaryActionText(mode, isImporting, selectionBehavior)}
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
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 0,
  minHeight: 0,
  overflow: "hidden"
});

const listPaneStyle = (theme: Theme): CSSProperties => ({
  padding: spacingTokens.md,
  overflowY: "auto",
  minHeight: 0
});

const plusButtonStyle = (theme: Theme): CSSProperties => ({
  borderRadius: 999,
  border: `1px solid ${theme.colors.border}`,
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  background: theme.colors.surface,
  color: theme.colors.textPrimary,
  cursor: "pointer"
});

const popoverStyle = (theme: Theme): CSSProperties => ({
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  display: "grid",
  gap: 4,
  minWidth: 150,
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  padding: 6,
  zIndex: 5,
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)"
});

const popoverItemStyle = (theme: Theme): CSSProperties => ({
  border: "none",
  background: "transparent",
  textAlign: "left",
  color: theme.colors.textPrimary,
  padding: "6px 8px",
  borderRadius: 8,
  cursor: "pointer"
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
  gridTemplateColumns: "52px minmax(0,1fr) auto",
  gap: 10,
  alignItems: "center",
  cursor: "pointer",
  overflow: "visible"
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
