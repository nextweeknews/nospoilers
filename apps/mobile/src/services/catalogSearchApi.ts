import type { CatalogSearchItemType, CatalogSearchResponse } from "../types/catalog";

type SearchCatalogParams = {
  query: string;
  types?: CatalogSearchItemType[];
  limit?: number;
};

const getCatalogSearchUrl = (): string => {
  const url = import.meta.env.VITE_CATALOG_SEARCH_URL as string | undefined;
  if (!url) {
    throw new Error("Missing VITE_CATALOG_SEARCH_URL");
  }
  return url;
};

export const searchCatalog = async ({
  query,
  types = ["book", "tv_show"],
  limit = 20
}: SearchCatalogParams): Promise<CatalogSearchResponse> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, count: 0, results: [] };
  }

  const url = new URL(getCatalogSearchUrl());
  url.searchParams.set("q", trimmed);
  url.searchParams.set("types", types.join(","));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string
    }
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Catalog search failed (${response.status})`);
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Catalog search failed (${response.status})`;
    throw new Error(message);
  }

  return data as CatalogSearchResponse;
};
