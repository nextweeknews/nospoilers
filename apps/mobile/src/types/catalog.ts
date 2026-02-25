export type CatalogSearchItemType = "book" | "tv_show";

export type CatalogSearchResult = {
  provider: string; // "google_books" | "tvmaze" for now
  source_id: string;
  item_type: CatalogSearchItemType;
  title: string;
  canonical_title: string | null;
  release_year: number | null;
  cover_image_url: string | null;
  source_url: string | null;
  subtitle: string | null; // authors or genres
  metadata: Record<string, unknown>;
};

export type CatalogSearchResponse = {
  query: string;
  count: number;
  results: CatalogSearchResult[];
};
