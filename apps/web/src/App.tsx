import { useEffect, useState, type CSSProperties } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser, ProviderLoginResult } from "../../../services/auth/src";
import {
  createTheme,
  elevationTokens,
  radiusTokens,
  resolveThemePreference,
  spacingTokens,
  type ThemeMode,
  type ThemePreference
} from "@nospoilers/ui";
import {
  buildPostPreviewText,
  mapAvatarPathToUiValue,
  resolveSingleGroupAudience,
  type SupabaseGroupRow,
  type SupabasePostRow,
  type SupabaseUserProfileRow
} from "@nospoilers/types";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingProfileScreen } from "./screens/OnboardingProfileScreen";
import { ProfileSettingsScreen } from "./screens/ProfileSettingsScreen";
import { PublicFeedScreen } from "./screens/PublicFeedScreen";
import { ProfileTabScreen, type ShelfItem } from "./screens/ProfileTabScreen";
import { PostComposerSheet } from "./components/PostComposerSheet";
import {
  CatalogSearchSheet,
  type CatalogImportResponse,
  type CatalogSearchResult
} from "./components/CatalogSearchSheet";
import { getSession, onAuthStateChange, signOut } from "./services/authClient";
import { supabaseClient } from "./services/supabaseClient";
import { profileNeedsOnboarding } from "./profileOnboarding";

const THEME_KEY = "nospoilers:web:theme-preference";
const MAIN_VIEW_KEY = "nospoilers:web:last-main-view";

type MainView = "groups" | "for-you" | "profile";
type LoadStatus = "loading" | "ready" | "empty" | "error";

type GroupEntity = SupabaseGroupRow;

type PostEntity = SupabasePostRow & {
  previewText: string | null;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  catalogItemTitle?: string;
  progressLine?: string;
};

type OptionRow = { id: string; title: string };

type GroupCatalogItem = {
  groupId: string;
  catalogItemId: string;
  title: string;
  coverImageUrl?: string;
};

type CatalogSearchContext =
  | { mode: "post" }
  | { mode: "group"; groupId: string }
  | { mode: "profile" };

type PendingPostCatalogSelection = {
  catalogItemId: string;
  catalogItemLabel: string;
};

const getSystemMode = (): ThemeMode => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const DEFAULT_AVATAR_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="none"><rect width="80" height="80" rx="40" fill="#27364A"/><circle cx="40" cy="31" r="14" fill="#7E97B3"/><path d="M16 69C16 55.745 26.745 45 40 45C53.255 45 64 55.745 64 69V80H16V69Z" fill="#7E97B3"/></svg>`
)}`;

const DEFAULT_COVER_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="96" viewBox="0 0 72 96"><rect width="72" height="96" rx="8" fill="#334155"/><path d="M20 20h32v56H20z" fill="#475569"/><path d="M24 28h24M24 36h20M24 44h24" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/></svg>`
)}`;

const HOME_ICON = "⌂";
const FOR_YOU_ICON = "✦";
const GROUP_FALLBACK_ICON = "👥";

const formatAuthorDisplayName = (author: { display_name?: string | null; username?: string | null } | null): string => {
  const displayName = author?.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const username = author?.username?.trim();
  if (username) {
    return username;
  }

  return "Unknown";
};



const formatPostProgressLine = (post: SupabasePostRow & {
  book_page?: number | null;
  book_percent?: number | null;
  catalog_progress_units?: { season_number?: number | null; episode_number?: number | null; title?: string | null } | Array<{ season_number?: number | null; episode_number?: number | null; title?: string | null }> | null;
}): string | undefined => {
  if (typeof post.book_page === "number") return `Page ${post.book_page}`;
  if (typeof post.book_percent === "number") return `${post.book_percent}%`;
  const unit = Array.isArray(post.catalog_progress_units) ? post.catalog_progress_units[0] : post.catalog_progress_units;
  if (!unit) return undefined;
  if (typeof unit.season_number !== "number" || typeof unit.episode_number !== "number") return undefined;
  const episodeTitle = unit.title?.trim();
  return `S${unit.season_number}, E${unit.episode_number}${episodeTitle ? ` - ${episodeTitle}` : ""}`;
};

const mapUser = (user: User, session: Session): AuthUser => ({
  id: user.id,
  email: user.email,
  primaryPhone: user.phone,
  identities: (user.identities ?? []).map((identity) => ({
    provider: identity.provider === "sms" ? "phone" : (identity.provider as "google" | "email"),
    subject: identity.identity_id,
    verified: Boolean(identity.last_sign_in_at)
  })),
  createdAt: user.created_at,
  updatedAt: user.updated_at ?? user.created_at,
  displayName: (user.user_metadata.full_name as string | undefined) ?? (user.user_metadata.name as string | undefined),
  avatarUrl: user.user_metadata.avatar_url as string | undefined,
  preferences: { themePreference: session.user.user_metadata.theme_preference as ThemePreference | undefined }
});

type ProfileRecord = SupabaseUserProfileRow;

const mergeProfileIntoUser = (authUser: AuthUser, profile?: ProfileRecord | null): AuthUser => {
  if (!profile) {
    return authUser;
  }

  const normalizedUsername = profile.username?.trim();
  const username = normalizedUsername || authUser.username;

  return {
    ...authUser,
    username,
    usernameNormalized: normalizedUsername ? normalizedUsername.toLowerCase() : authUser.usernameNormalized,
    displayName: profile.display_name?.trim() ? profile.display_name.trim() : authUser.displayName,
    avatarUrl: mapAvatarPathToUiValue(profile.avatar_path) ?? authUser.avatarUrl
  };
};

const mapUserWithProfile = async (
  user: User,
  session: Session
): Promise<{ user: AuthUser; needsOnboarding: boolean }> => {
  const mappedUser = mapUser(user, session);
  const { data: profile, error } = await supabaseClient
    .from("users")
    .select("id,username,display_name,avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[app] failed to load user profile row", error);
  }

  const normalizedProfile = (profile as ProfileRecord | null) ?? null;

  return {
    user: mergeProfileIntoUser(mappedUser, normalizedProfile),
    needsOnboarding: profileNeedsOnboarding(normalizedProfile)
  };
};

export const App = () => {
  const [mainView, setMainView] = useState<MainView>(() => {
    const saved = window.sessionStorage.getItem(MAIN_VIEW_KEY);
    return saved === "groups" || saved === "for-you" || saved === "profile" ? saved : "for-you";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [systemMode, setSystemMode] = useState<ThemeMode>(() => getSystemMode());
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [groups, setGroups] = useState<GroupEntity[]>([]);
  const [posts, setPosts] = useState<PostEntity[]>([]);
  const [groupStatus, setGroupStatus] = useState<LoadStatus>("loading");
  const [feedStatus, setFeedStatus] = useState<LoadStatus>("loading");
  const [groupError, setGroupError] = useState<string>();
  const [feedError, setFeedError] = useState<string>();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>();
  const [showCreateGroupSheet, setShowCreateGroupSheet] = useState(false);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDescription, setCreateGroupDescription] = useState("");
  const [createGroupPrivacy, setCreateGroupPrivacy] = useState<"public" | "private">("private");
  const [createGroupError, setCreateGroupError] = useState<string>();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showCreatePostSheet, setShowCreatePostSheet] = useState(false);
  const [showCatalogSearchSheet, setShowCatalogSearchSheet] = useState(false);
  const [catalogSearchContext, setCatalogSearchContext] = useState<CatalogSearchContext | null>(null);
  const [catalogSearchError, setCatalogSearchError] = useState<string>();
  const [pendingPostCatalogSelection, setPendingPostCatalogSelection] = useState<PendingPostCatalogSelection | null>(null);
  const [selectedCatalogItemIdForProgress, setSelectedCatalogItemIdForProgress] = useState<string | null>(null);
  const [groupPosts, setGroupPosts] = useState<PostEntity[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<OptionRow[]>([]);
  const [progressUnits, setProgressUnits] = useState<OptionRow[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; createdAt: string; text: string }>>([]);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [groupCatalogItems, setGroupCatalogItems] = useState<GroupCatalogItem[]>([]);
  const [selectedShelfCatalogItemId, setSelectedShelfCatalogItemId] = useState<string | null>(null);
  const [selectedGroupCatalogItemId, setSelectedGroupCatalogItemId] = useState<string | null>(null);
  const [hoveredSidebarItemKey, setHoveredSidebarItemKey] = useState<string | null>(null);

  const syncAuthState = async (session: Session | null) => {
    if (!session?.user) {
      setCurrentUser(undefined);
      setNeedsOnboarding(false);
      return;
    }

    const mapped = await mapUserWithProfile(session.user, session);
    setCurrentUser(mapped.user);
    setNeedsOnboarding(mapped.needsOnboarding);
  };

  const FUNCTIONS_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_FUNCTIONS_URL ?? "";
    console.log("VITE_SUPABASE_FUNCTIONS_URL", import.meta.env.VITE_SUPABASE_FUNCTIONS_URL);

  const syncTvMazeIfStale = async (catalogItemId: string) => {
    if (!FUNCTIONS_URL) return;
  
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!anon) return;
  
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
  
      // Fire-and-forget; the function will no-op unless ended=null and updated_at > 10 minutes old.
      await fetch(`${FUNCTIONS_URL}/catalog-sync-tvmaze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ catalog_item_id: Number(catalogItemId) })
      });
    } catch (error) {
      // Don't block UI on sync failures
      console.warn("[app] tvmaze sync failed", error);
    }
  };

  const refreshCatalogItems = async () => {
    const { data, error } = await supabaseClient
      .from("catalog_items")
      .select("id,title")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[app] catalog_items load failed", error);
      setCatalogItems([]);
      return;
    }

    setCatalogItems((data as OptionRow[] | null) ?? []);
  };

  const loadProgressUnitsForCatalogItem = async (catalogItemId: string) => {
    const { data, error } = await supabaseClient
      .from("catalog_progress_units")
      .select("id,title")
      .eq("catalog_item_id", catalogItemId)
      .order("sequence_index", { ascending: true })
      .limit(500);

    if (error) {
      console.error("[app] catalog_progress_units load failed", error);
      setProgressUnits([]);
      return;
    }

    setProgressUnits((data as OptionRow[] | null) ?? []);
  };

  const openCatalogSearch = (context: CatalogSearchContext) => {
    setCatalogSearchError(undefined);
    setCatalogSearchContext(context);
    setShowCatalogSearchSheet(true);
  };

  const closeCatalogSearch = () => {
    setShowCatalogSearchSheet(false);
    setCatalogSearchContext(null);
  };

  const handleCatalogImported = async (imported: CatalogImportResponse, selected: CatalogSearchResult) => {
    const importedId = String(imported.catalog_item.id);
    const importedTitle = imported.catalog_item.title;

    setCatalogItems((prev) => {
      const exists = prev.some((item) => item.id === importedId);
      if (exists) return prev;
      return [{ id: importedId, title: importedTitle }, ...prev];
    });

    void refreshCatalogItems();

    if (catalogSearchContext?.mode === "post") {
      setPendingPostCatalogSelection({
        catalogItemId: importedId,
        catalogItemLabel: importedTitle
      });
      setSelectedCatalogItemIdForProgress(importedId);
      setShowCreatePostSheet(true);
    }

    // placeholders for later:
    // if (catalogSearchContext?.mode === "group") { refresh group catalog list }
    // if (catalogSearchContext?.mode === "profile") { refresh user library/progress list }

    console.log("[app] catalog import success", {
      importedCatalogItemId: importedId,
      title: importedTitle,
      source: selected.metadata_source,
      sourceId: selected.source_id,
      context: catalogSearchContext
    });

    if (catalogSearchContext?.mode === "post") {
      closeCatalogSearch();
    }
  };

  const pathname = window.location.pathname;
  const isAuthCallbackRoute = pathname === "/auth/callback";

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (isAuthCallbackRoute) {
      return;
    }

    let cancelled = false;

    const safeSyncAuthState = async (session: Session | null) => {
      // Extra gate: never process auth state if callback route is active during async timing.
      if (cancelled || window.location.pathname === "/auth/callback") {
        return;
      }

      try {
        await syncAuthState(session);
      } catch (_error) {
        if (cancelled) return;
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
    };

    const syncSession = async () => {
      try {
        const { data, error } = await getSession();
        if (error) throw error;
        if (cancelled) return;
        if (window.location.pathname === "/auth/callback") return;

        await safeSyncAuthState(data.session);
      } catch (_error) {
        if (cancelled) return;
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
    };

    void syncSession();

    const { data } = onAuthStateChange((event, session) => {
      // Avoid async callback directly on Supabase listener. Defer work.
      if (cancelled) return;
      if (window.location.pathname === "/auth/callback") {
        console.log("[app] ignoring auth event during callback route", event);
        return;
      }

      void safeSyncAuthState(session);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [isAuthCallbackRoute]);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setPosts([]);
      setGroupPosts([]);
      setGroupStatus("loading");
      setFeedStatus("loading");
      setGroupError(undefined);
      setFeedError(undefined);
      setShelfItems([]);
      setGroupCatalogItems([]);
      setSelectedShelfCatalogItemId(null);
      setSelectedGroupCatalogItemId(null);
      return;
    }

    let isCancelled = false;

    const loadData = async () => {
      setGroupStatus("loading");
      setFeedStatus("loading");
      setGroupError(undefined);
      setFeedError(undefined);

      let activeGroupIds: string[] = [];

      const groupResult = await supabaseClient
        .from("group_memberships")
        .select("groups(id,name,description,avatar_path)")
        .eq("user_id", currentUser.id)
        .eq("status", "active")
        .order("joined_at", { ascending: false });

      if (isCancelled) {
        return;
      }

      if (groupResult.error) {
        console.error("[app] group_memberships load failed", groupResult.error);
        setGroups([]);
        setGroupStatus("error");
        setGroupError(groupResult.error.message);
        setGroupPosts([]);
      } else {
        const memberships = (groupResult.data as Array<{ groups: GroupEntity | GroupEntity[] | null }> | null) ?? [];
        const loadedGroups = memberships.flatMap((membership) =>
          Array.isArray(membership.groups) ? membership.groups : membership.groups ? [membership.groups] : []
        );
        setGroups(loadedGroups);
        setGroupStatus(loadedGroups.length ? "ready" : "empty");
        setSelectedGroupId((current) => (current && !loadedGroups.some((group) => group.id === current) ? null : current));

        const groupIds = loadedGroups.map((group) => group.id);
        activeGroupIds = groupIds.map((groupId) => String(groupId));
        if (!groupIds.length) {
          setGroupPosts([]);
        } else {
          const groupFeedResult = await supabaseClient
            .from("posts")
            .select("id,body_text,created_at,status,deleted_at,group_id,catalog_item_id,progress_unit_id,book_page,book_percent,users!posts_author_user_id_fkey(display_name,username,avatar_path),catalog_items!posts_catalog_item_id_fkey(title),catalog_progress_units!posts_progress_unit_id_fkey(season_number,episode_number,title)")
            .in("group_id", groupIds)
            .eq("status", "published")
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (groupFeedResult.error) {
            console.error("[app] group feed load failed", groupFeedResult.error);
            setGroupPosts([]);
          } else {
            setGroupPosts(
              ((groupFeedResult.data as SupabasePostRow[] | null) ?? []).map((post) => ({
                ...post,
                previewText: buildPostPreviewText(post.body_text),
                authorDisplayName: formatAuthorDisplayName(
                  (post as SupabasePostRow & { users?: { display_name?: string | null; username?: string | null } | null }).users ?? null
                ),
                authorAvatarUrl:
                  mapAvatarPathToUiValue(
                    (post as SupabasePostRow & { users?: { avatar_path?: string | null } | null }).users?.avatar_path
                  ) ?? DEFAULT_AVATAR_PLACEHOLDER,
                catalogItemTitle:
                  (post as SupabasePostRow & { catalog_items?: { title?: string | null } | null }).catalog_items?.title?.trim() || undefined,
                progressLine: formatPostProgressLine(post as SupabasePostRow & {
                  book_page?: number | null;
                  book_percent?: number | null;
                  catalog_progress_units?: { season_number?: number | null; episode_number?: number | null; title?: string | null } | Array<{ season_number?: number | null; episode_number?: number | null; title?: string | null }> | null;
                })
              }))
            );
          }
        }
      }

      const shelfResult = await supabaseClient
        .from("user_media_progress")
        .select("catalog_item_id,status,started_at,completed_at,updated_at,current_page,current_season_number,current_episode_number,progress_percent,catalog_items!user_media_progress_catalog_item_id_fkey(id,title,item_type,page_count,cover_image_url),catalog_progress_units!user_media_progress_current_unit_id_fkey(id,season_number,episode_number,title)")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false });

      if (shelfResult.error) {
        console.error("[app] user_media_progress load failed", shelfResult.error);
        setShelfItems([]);
      } else {
        const rows = (shelfResult.data as Array<{
          catalog_item_id: string | number;
          status: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string | null;
          current_page?: number | null;
          current_season_number?: number | null;
          current_episode_number?: number | null;
          progress_percent?: number | null;
          catalog_items?: { id: string | number; title?: string | null; item_type?: "book" | "tv_show" | null; page_count?: number | null; cover_image_url?: string | null } | Array<{ id: string | number; title?: string | null; item_type?: "book" | "tv_show" | null; page_count?: number | null; cover_image_url?: string | null }> | null;
          catalog_progress_units?: { id?: string | number | null; season_number?: number | null; episode_number?: number | null; title?: string | null } | Array<{ id?: string | number | null; season_number?: number | null; episode_number?: number | null; title?: string | null }> | null;
        }> | null) ?? [];

        const catalogIds = rows.map((row) => row.catalog_item_id);
        const { data: allUnits, error: allUnitsError } = catalogIds.length
          ? await supabaseClient
              .from("catalog_progress_units")
              .select("id,catalog_item_id,season_number,episode_number,title")
              .in("catalog_item_id", catalogIds)
              .order("season_number", { ascending: true })
              .order("episode_number", { ascending: true })
          : { data: [], error: null };

        if (allUnitsError) {
          console.error("[app] catalog_progress_units for shelf load failed", allUnitsError);
        }

        const unitsByCatalogId = new Map<string, Array<{ id: string; season_number: number; episode_number: number; title?: string }>>();
        (((allUnits as Array<{ id: string | number; catalog_item_id: string | number; season_number?: number | null; episode_number?: number | null; title?: string | null }> | null) ?? [])).forEach((unit) => {
          const key = String(unit.catalog_item_id);
          const list = unitsByCatalogId.get(key) ?? [];
          list.push({
            id: String(unit.id),
            season_number: Number(unit.season_number ?? 0),
            episode_number: Number(unit.episode_number ?? 0),
            title: unit.title ?? undefined
          });
          unitsByCatalogId.set(key, list);
        });

        setShelfItems(rows.map((row) => {
          const catalogItemId = String(row.catalog_item_id);
          const catalogItem = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items;
          const currentUnit = Array.isArray(row.catalog_progress_units) ? row.catalog_progress_units[0] : row.catalog_progress_units;
          const itemType = catalogItem?.item_type === "tv_show" ? "tv_show" : "book";
          const tvUnits = unitsByCatalogId.get(catalogItemId) ?? [];
          const pageCount = catalogItem?.page_count ?? null;
          const currentPage = row.current_page ?? null;
          const currentSeason = row.current_season_number ?? currentUnit?.season_number ?? null;
          const currentEpisode = row.current_episode_number ?? currentUnit?.episode_number ?? null;
          const progressPercentValue = row.progress_percent ?? null;

          const progressPercent = itemType === "book"
            ? Math.max(0, Math.min(100, Math.round(progressPercentValue ?? (currentPage && pageCount ? (currentPage / pageCount) * 100 : 0))))
            : (() => {
                if (progressPercentValue != null) return Math.max(0, Math.min(100, Math.round(progressPercentValue)));
                if (!tvUnits.length || !currentSeason || !currentEpisode) return 0;
                const checkedEpisodes = tvUnits.filter((unit) => (
                  unit.season_number < currentSeason || (unit.season_number === currentSeason && unit.episode_number <= currentEpisode)
                )).length;
                return Math.max(0, Math.min(100, Math.round((checkedEpisodes / tvUnits.length) * 100)));
              })();

          const progressSummary = itemType === "book"
            ? (progressPercentValue != null
                ? `${Math.round(progressPercentValue)}%`
                : `Page ${currentPage ?? 0}/${pageCount ?? "?"}`)
            : `${Math.round(progressPercent)}% watched`;

          return {
            catalogItemId,
            title: catalogItem?.title?.trim() || `Catalog #${row.catalog_item_id}`,
            itemType,
            coverImageUrl: catalogItem?.cover_image_url ?? undefined,
            status: row.status,
            addedAt: row.started_at || row.updated_at || new Date().toISOString(),
            updatedAt: row.updated_at || row.started_at || new Date().toISOString(),
            completedAt: row.completed_at,
            progressSummary,
            progressPercent,
            currentPage,
            pageCount,
            currentSeasonNumber: currentSeason,
            currentEpisodeNumber: currentEpisode,
            progressPercentValue,
            tvProgressUnits: tvUnits.map((unit) => ({ id: unit.id, seasonNumber: unit.season_number, episodeNumber: unit.episode_number, title: unit.title }))
          };
        }));
      }

      if (activeGroupIds.length) {
        const groupCatalogResult = await supabaseClient
          .from("group_catalog_items")
          .select("group_id,catalog_item_id,catalog_items!group_catalog_items_catalog_item_id_fkey(title,cover_image_url)")
          .in("group_id", activeGroupIds)
          .eq("is_active", true)
          .order("added_at", { ascending: false });

        if (groupCatalogResult.error) {
          console.error("[app] group_catalog_items load failed", groupCatalogResult.error);
          setGroupCatalogItems([]);
        } else {
          setGroupCatalogItems(
            (((groupCatalogResult.data as Array<{ group_id: string | number; catalog_item_id: string | number; catalog_items?: { title?: string | null; cover_image_url?: string | null } | null }> | null) ?? [])).map((row) => ({
              groupId: String(row.group_id),
              catalogItemId: String(row.catalog_item_id),
              title: row.catalog_items?.title?.trim() || `Catalog #${row.catalog_item_id}`,
              coverImageUrl: row.catalog_items?.cover_image_url ?? undefined
            }))
          );
        }
      } else {
        setGroupCatalogItems([]);
      }

      const postResult = await supabaseClient
        .from("posts")
        .select("id,body_text,created_at,status,deleted_at,group_id,catalog_item_id,progress_unit_id,book_page,book_percent,users!posts_author_user_id_fkey(display_name,username,avatar_path),catalog_items!posts_catalog_item_id_fkey(title),catalog_progress_units!posts_progress_unit_id_fkey(season_number,episode_number,title)")
        .eq("status", "published")
        .is("deleted_at", null)
        .is("group_id", null)
        .order("created_at", { ascending: false });

      if (postResult.error) {
        console.error("[app] posts load failed", postResult.error);
        setPosts([]);
        setFeedStatus("error");
        setFeedError(postResult.error.message);
      } else {
        const loadedPosts = ((postResult.data as SupabasePostRow[] | null) ?? []).map((post) => ({
          ...post,
          previewText: buildPostPreviewText(post.body_text),
          authorDisplayName: formatAuthorDisplayName(
            (post as SupabasePostRow & { users?: { display_name?: string | null; username?: string | null } | null }).users ?? null
          ),
          authorAvatarUrl:
            mapAvatarPathToUiValue(
              (post as SupabasePostRow & { users?: { avatar_path?: string | null } | null }).users?.avatar_path
            ) ?? DEFAULT_AVATAR_PLACEHOLDER,
          catalogItemTitle:
            (post as SupabasePostRow & { catalog_items?: { title?: string | null } | null }).catalog_items?.title?.trim() || undefined,
          progressLine: formatPostProgressLine(post as SupabasePostRow & {
            book_page?: number | null;
            book_percent?: number | null;
            catalog_progress_units?: { season_number?: number | null; episode_number?: number | null; title?: string | null } | Array<{ season_number?: number | null; episode_number?: number | null; title?: string | null }> | null;
          })
        }));
        setPosts(loadedPosts);
        setFeedStatus(loadedPosts.length ? "ready" : "empty");
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void refreshCatalogItems();

    // Fallback starter list until a specific catalog item is selected.
    void supabaseClient
      .from("catalog_progress_units")
      .select("id,title")
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          console.error("[app] catalog_progress_units load failed", error);
          setProgressUnits([]);
          return;
        }
        setProgressUnits((data as OptionRow[] | null) ?? []);
      });

    void Promise.all([
      supabaseClient
        .from("post_comments")
        .select("id,body_text,created_at,deleted_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseClient
        .from("post_reactions")
        .select("post_id,user_id,emoji,created_at")
        .order("created_at", { ascending: false })
        .limit(20)
    ]).then(([comments, reactions]) => {
      if (comments.error) {
        console.error("[app] post_comments load failed", comments.error);
      }
      if (reactions.error) {
        console.error("[app] post_reactions load failed", reactions.error);
      }

      const commentEvents = (
        ((comments.data as Array<{ id: string; body_text: string | null; created_at: string; deleted_at?: string | null }> | null) ?? [])
          .filter((entry) => entry.deleted_at == null)
          .map((entry) => ({
            id: `comment-${entry.id}`,
            type: "Comment",
            createdAt: entry.created_at,
            text: entry.body_text ?? "New comment"
          }))
      );

      const reactionEvents =
        ((reactions.data as Array<{ post_id: string; user_id: string; emoji: string | null; created_at: string }> | null) ?? []).map(
          (entry) => ({
            id: `reaction-${entry.post_id}-${entry.user_id}-${entry.created_at}`,
            type: "Reaction",
            createdAt: entry.created_at,
            text: entry.emoji ?? "New reaction"
          })
        );

      setNotifications([...commentEvents, ...reactionEvents].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedCatalogItemIdForProgress) {
      return;
    }

    void loadProgressUnitsForCatalogItem(selectedCatalogItemIdForProgress);
  }, [currentUser, selectedCatalogItemIdForProgress]);

  useEffect(() => {
    if (!currentUser) return;
  
    // When a group catalog item is selected, opportunistically sync TV episodes if stale.
    if (selectedGroupCatalogItemId) {
      void syncTvMazeIfStale(selectedGroupCatalogItemId);
    }
  }, [currentUser, selectedGroupCatalogItemId]);

  const onSignedIn = (result: ProviderLoginResult) => {
    if (result.user.preferences?.themePreference) {
      setThemePreference(result.user.preferences.themePreference);
    }
  };

  const onThemePreferenceChanged = (next: ThemePreference) => {
    setThemePreference(next);
    window.localStorage.setItem(THEME_KEY, next);
  };

  const theme = createTheme(resolveThemePreference(systemMode, themePreference));

  useEffect(() => {
    window.sessionStorage.setItem(MAIN_VIEW_KEY, mainView);
  }, [mainView]);

  const selectedGroup = selectedGroupId ? groups.find((group) => String(group.id) === selectedGroupId) : undefined;
  const selectedGroupCatalogItems = selectedGroupId
    ? groupCatalogItems.filter((item) => item.groupId === selectedGroupId)
    : [];
  const selectedGroupPosts = selectedGroupId
    ? groupPosts.filter((post) => {
        const inGroup = String((post as { group_id?: string | number | null }).group_id ?? "") === selectedGroupId;
        if (!inGroup) return false;
        if (!selectedGroupCatalogItemId) return true;
        return String((post as { catalog_item_id?: string | number | null }).catalog_item_id ?? "") === selectedGroupCatalogItemId;
      })
    : [];
  const selectedShelfPosts = selectedShelfCatalogItemId
    ? posts.filter(
        (post) => String((post as { catalog_item_id?: string | number | null }).catalog_item_id ?? "") === selectedShelfCatalogItemId
      )
    : posts;
  const selectedShelfItem = selectedShelfCatalogItemId
    ? shelfItems.find((item) => item.catalogItemId === selectedShelfCatalogItemId)
    : undefined;
  const selectedGroupCatalogItem = selectedGroupCatalogItemId
    ? selectedGroupCatalogItems.find((item) => item.catalogItemId === selectedGroupCatalogItemId)
    : undefined;
  const createPostContextGroupName = mainView === "groups" ? selectedGroup?.name : undefined;
  const createPostContextTitle = mainView === "groups" ? selectedGroupCatalogItem?.title : selectedShelfItem?.title;
  const createPostTriggerText = `Create a post${createPostContextGroupName ? ` in ${createPostContextGroupName}` : ""}${createPostContextTitle ? ` about ${createPostContextTitle}` : ""}`;
  const defaultCreatePostGroupId = mainView === "groups" && selectedGroupId ? selectedGroupId : undefined;
  const defaultCreatePostCatalogItemId = mainView === "groups" ? selectedGroupCatalogItemId ?? undefined : selectedShelfCatalogItemId ?? undefined;

  const onChooseDifferentLoginMethod = async () => {
    await signOut();
    setCurrentUser(undefined);
    setNeedsOnboarding(false);
  };

  const resetCreateGroupModal = () => {
    setCreateGroupName("");
    setCreateGroupDescription("");
    setCreateGroupPrivacy("private");
    setCreateGroupError(undefined);
    setIsCreatingGroup(false);
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupSheet(false);
    resetCreateGroupModal();
  };

  const handleCreateGroup = async () => {
    if (!currentUser || isCreatingGroup) {
      return;
    }

    const normalizedName = createGroupName.trim();
    const normalizedDescription = createGroupDescription.trim();

    if (!normalizedName) {
      setCreateGroupError("Group name is required.");
      return;
    }

    setCreateGroupError(undefined);
    setIsCreatingGroup(true);

    const { data: insertedGroup, error: groupInsertError } = await supabaseClient
      .from("groups")
      .insert({
        name: normalizedName,
        description: normalizedDescription || null,
        privacy: createGroupPrivacy,
        created_by: currentUser.id
      })
      .select("id,name,description,avatar_path")
      .single();

    if (groupInsertError || !insertedGroup) {
      console.error("[app] group insert failed", {
        code: groupInsertError?.code,
        message: groupInsertError?.message,
        details: groupInsertError?.details,
        hint: groupInsertError?.hint,
        payload: {
          name: normalizedName,
          description: normalizedDescription || null,
          privacy: createGroupPrivacy,
          created_by: currentUser.id
        }
      });

      setCreateGroupError(groupInsertError?.message ?? "Unable to create group.");
      setIsCreatingGroup(false);
      return;
    }

    const { error: membershipInsertError } = await supabaseClient.from("group_memberships").insert({
      user_id: currentUser.id,
      group_id: insertedGroup.id,
      role: "owner",
      status: "active"
    });

    if (membershipInsertError) {
      await supabaseClient.from("groups").delete().eq("id", insertedGroup.id);
      setCreateGroupError(membershipInsertError.message);
      setIsCreatingGroup(false);
      return;
    }

    setGroups((prev) => [insertedGroup as GroupEntity, ...prev]);
    setGroupStatus("ready");
    closeCreateGroupModal();
  };

  if (pathname === "/auth/callback") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: theme.colors.background,
          padding: spacingTokens.lg
        }}
      >
        <AuthCallbackScreen theme={theme} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: theme.colors.background,
          padding: spacingTokens.lg
        }}
      >
        <LoginScreen onSignedIn={onSignedIn} theme={theme} />
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: theme.colors.background,
          padding: spacingTokens.lg
        }}
      >
        <OnboardingProfileScreen
          user={currentUser}
          theme={theme}
          onProfileCompleted={(user) => {
            setCurrentUser(user);
            setNeedsOnboarding(false);
          }}
          onChooseDifferentLoginMethod={onChooseDifferentLoginMethod}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        background: theme.colors.background,
        padding: 0
      }}
    >
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          background: theme.colors.surface,
          color: theme.colors.textPrimary,
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr"
        }}
      >
        <style>{`
          button, select {
            border-radius: ${radiusTokens.pill}px;
            transition: box-shadow 140ms ease, border-color 140ms ease, filter 140ms ease;
          }

          button:hover, select:hover {
            filter: brightness(1.02);
          }
        `}</style>
        <header
          style={{
            padding: spacingTokens.md,
            display: "grid",
            gridTemplateColumns: "180px minmax(280px, 1fr) auto",
            alignItems: "center",
            gap: spacingTokens.md
          }}
        >
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 22 }}>NoSpoilers</h2>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onFocus={() => openCatalogSearch({ mode: "post" })}
            placeholder="Search books, shows, and posts"
            style={{
              width: "100%",
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              background: theme.colors.background,
              color: theme.colors.textPrimary,
              fontSize: 14
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: spacingTokens.sm, position: "relative" }}>
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => setNotificationModalOpen(true)}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 10,
                background: theme.colors.surface,
                color: theme.colors.textPrimary,
                padding: "10px 12px",
                cursor: "pointer"
              }}
            >
              🔔 {notifications.length}
            </button>
            <button
              type="button"
              aria-label="Account menu"
              onClick={() => setMenuOpen((current) => !current)}
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
            >
              <img
                src={currentUser.avatarUrl?.trim() || DEFAULT_AVATAR_PLACEHOLDER}
                alt="Your avatar"
                style={{ width: 36, height: 36, borderRadius: 999, objectFit: "cover", border: `1px solid ${theme.colors.border}` }}
              />
            </button>

            {menuOpen ? (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 12,
                  boxShadow: elevationTokens.low,
                  overflow: "hidden",
                  zIndex: 10,
                  minWidth: 180
                }}
              >
                <button type="button" onClick={() => { setMainView("profile"); setShowProfileSettings(false); setMenuOpen(false); }} style={menuItem(theme)}>
                  View profile
                </button>
                <button type="button" onClick={() => { setMainView("profile"); setShowProfileSettings(true); setMenuOpen(false); }} style={menuItem(theme)}>
                  Account settings
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await signOut();
                    if (error) {
                      setAuthStatus(`Unable to sign out: ${error.message}`);
                      return;
                    }
                    setAuthStatus("Signed out.");
                    setMainView("for-you");
                    setCurrentUser(undefined);
                  }}
                  style={menuItem(theme)}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main
          style={{
            display: "grid",
            gridTemplateColumns: "320px 320px minmax(420px, 1fr) 220px",
            justifyContent: "start",
            minHeight: 0,
            background: theme.colors.background
          }}
        >
          <aside style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", alignContent: "start", gap: spacingTokens.xs, borderRight: `1px solid ${theme.colors.border}` }}>
            <button
              type="button"
              onClick={() => { setMainView("for-you"); setSelectedGroupId(null); setSelectedShelfCatalogItemId(null); setSelectedGroupCatalogItemId(null); setShowProfileSettings(false); }}
              onMouseEnter={() => setHoveredSidebarItemKey("nav-for-you")}
              onMouseLeave={() => setHoveredSidebarItemKey((current) => current === "nav-for-you" ? null : current)}
              style={listItemStyle(theme, mainView === "for-you", hoveredSidebarItemKey === "nav-for-you")}
            >
              <SidebarItemContent label="For you" iconText={FOR_YOU_ICON} theme={theme} />
            </button>
            <strong style={{ color: theme.colors.textSecondary, marginTop: spacingTokens.sm, padding: "8px 14px" }}>Your groups</strong>
            {groups.map((group) => {
              const active = mainView === "groups" && selectedGroupId === String(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => { setMainView("groups"); setSelectedGroupId(String(group.id)); setSelectedGroupCatalogItemId(null); setShowProfileSettings(false); }}
                  onMouseEnter={() => setHoveredSidebarItemKey(`group-${group.id}`)}
                  onMouseLeave={() => setHoveredSidebarItemKey((current) => current === `group-${group.id}` ? null : current)}
                  style={listItemStyle(theme, active, hoveredSidebarItemKey === `group-${group.id}`)}
                >
                  <SidebarItemContent
                    label={group.name}
                    avatarUrl={mapAvatarPathToUiValue(group.avatar_path) ?? undefined}
                    fallbackIcon={GROUP_FALLBACK_ICON}
                    theme={theme}
                  />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCreateGroupSheet(true)}
              style={{ border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: "10px 12px", background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", textAlign: "left", marginTop: spacingTokens.sm }}
            >
              + Create group
            </button>
          </aside>

          <aside style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", alignContent: "start", gap: spacingTokens.xs, borderRight: `1px solid ${theme.colors.border}` }}>
            {mainView === "for-you" ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedShelfCatalogItemId(null)}
                  onMouseEnter={() => setHoveredSidebarItemKey("shelf-home")}
                  onMouseLeave={() => setHoveredSidebarItemKey((current) => current === "shelf-home" ? null : current)}
                  style={listItemStyle(theme, selectedShelfCatalogItemId == null, hoveredSidebarItemKey === "shelf-home")}
                >
                  <SidebarItemContent label="Home" iconText={HOME_ICON} theme={theme} />
                </button>
                {shelfItems.map((item) => (
                  <button
                    key={item.catalogItemId}
                    type="button"
                    onClick={() => setSelectedShelfCatalogItemId(item.catalogItemId)}
                    onMouseEnter={() => setHoveredSidebarItemKey(`shelf-${item.catalogItemId}`)}
                    onMouseLeave={() => setHoveredSidebarItemKey((current) => current === `shelf-${item.catalogItemId}` ? null : current)}
                    style={listItemStyle(theme, selectedShelfCatalogItemId === item.catalogItemId, hoveredSidebarItemKey === `shelf-${item.catalogItemId}`)}
                  >
                    <SidebarItemContent label={item.title} artworkUrl={item.coverImageUrl} theme={theme} />
                  </button>
                ))}
              </>
            ) : null}

            {mainView === "groups" ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedGroupCatalogItemId(null)}
                  onMouseEnter={() => setHoveredSidebarItemKey("group-home")}
                  onMouseLeave={() => setHoveredSidebarItemKey((current) => current === "group-home" ? null : current)}
                  style={listItemStyle(theme, selectedGroupCatalogItemId == null, hoveredSidebarItemKey === "group-home")}
                >
                  <SidebarItemContent label="Home" iconText={HOME_ICON} theme={theme} />
                </button>
                {selectedGroupCatalogItems.map((item) => (
                  <button
                    key={`${item.groupId}-${item.catalogItemId}`}
                    type="button"
                    onClick={() => setSelectedGroupCatalogItemId(item.catalogItemId)}
                    onMouseEnter={() => setHoveredSidebarItemKey(`group-catalog-${item.groupId}-${item.catalogItemId}`)}
                    onMouseLeave={() => setHoveredSidebarItemKey((current) => current === `group-catalog-${item.groupId}-${item.catalogItemId}` ? null : current)}
                    style={listItemStyle(theme, selectedGroupCatalogItemId === item.catalogItemId, hoveredSidebarItemKey === `group-catalog-${item.groupId}-${item.catalogItemId}`)}
                  >
                    <SidebarItemContent label={item.title} artworkUrl={item.coverImageUrl} theme={theme} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedGroupId) {
                      return;
                    }
                    openCatalogSearch({ mode: "group", groupId: selectedGroupId });
                  }}
                  disabled={!selectedGroupId}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    cursor: selectedGroupId ? "pointer" : "not-allowed",
                    textAlign: "left",
                    marginTop: spacingTokens.sm,
                    opacity: selectedGroupId ? 1 : 0.65
                  }}
                >
                  + Add title to group
                </button>
              </>
            ) : null}
          </aside>

          <section style={{ overflowY: "auto", padding: spacingTokens.md, minWidth: 0, borderRight: `1px solid ${theme.colors.border}`, display: "grid", gridTemplateRows: "1fr auto", gap: spacingTokens.sm }}>
            <div style={{ minHeight: 0 }}>
            {mainView === "profile" ? (
              showProfileSettings ? (
                <ProfileSettingsScreen
                  user={currentUser}
                  onProfileUpdated={setCurrentUser}
                  onAccountDeleted={() => {
                    setCurrentUser(undefined);
                    setNeedsOnboarding(false);
                    setMainView("for-you");
                    setMenuOpen(false);
                  }}
                  onThemePreferenceChanged={onThemePreferenceChanged}
                  themePreference={themePreference}
                  theme={theme}
                />
              ) : (
                <ProfileTabScreen
                  theme={theme}
                  user={currentUser}
                  onEditProfile={() => setShowProfileSettings(true)}
                  onAccountSettings={() => setShowProfileSettings(true)}
                  shelfItems={shelfItems}
                  onSaveShelfProgress={async ({ catalogItemId, status, currentPage, progressPercent, currentSeasonNumber, currentEpisodeNumber, watchedEpisodeCount }) => {
                    const payload = {
                      user_id: currentUser.id,
                      catalog_item_id: Number(catalogItemId),
                      status,
                      current_page: currentPage ?? null,
                      progress_percent: progressPercent ?? null,
                      current_season_number: currentSeasonNumber ?? null,
                      current_episode_number: currentEpisodeNumber ?? null,
                      watched_episode_count: watchedEpisodeCount ?? null
                    };

                    const { error } = await supabaseClient.from("user_shelf").upsert(payload, { onConflict: "user_id,catalog_item_id" });
                    if (error) {
                      console.error("[app] failed to update shelf progress", error);
                      return;
                    }
                  }}
                />
              )
            ) : null}

            {mainView === "for-you" ? <PublicFeedScreen theme={theme} status={feedStatus} errorMessage={feedError} posts={selectedShelfPosts} emptyMessage={selectedShelfCatalogItemId ? "No posts for this title yet." : "No public posts yet."} showCatalogContext={!selectedShelfCatalogItemId} /> : null}

            {mainView === "groups" ? (
              selectedGroup ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacingTokens.sm, marginBottom: spacingTokens.md }}>
                    <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>{selectedGroup.name}</h3>
                  </div>
                  <PublicFeedScreen
                    theme={theme}
                    status={groupStatus === "ready" ? (selectedGroupPosts.length ? "ready" : "empty") : groupStatus}
                    errorMessage={groupError}
                    posts={selectedGroupPosts}
                    title={`${selectedGroup.name} Feed`}
                    loadingMessage="Loading group posts…"
                    emptyMessage={selectedGroupCatalogItemId ? "No posts for this title yet." : "No posts in this group yet."}
                    showCatalogContext={!selectedGroupCatalogItemId}
                  />
                </>
              ) : (
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>Select a group from the left column.</p>
              )
            ) : null}
            {catalogSearchError ? <small style={{ color: "#b42318" }}>Catalog search/import error: {catalogSearchError}</small> : null}
            {authStatus ? <small style={{ color: theme.colors.textSecondary }}>{authStatus}</small> : null}
            </div>

            {mainView !== "profile" ? (
              <div style={{ position: "sticky", bottom: 0, background: theme.colors.background, paddingTop: spacingTokens.xs, paddingBottom: spacingTokens.xs }}>
                <PostComposerSheet
                  open={showCreatePostSheet}
                  theme={theme}
                  groups={groups.map((group) => ({ id: String(group.id), label: group.name }))}
                  catalogItems={shelfItems.map((item) => ({
                    id: item.catalogItemId,
                    label: item.title,
                    itemType: item.itemType,
                    tvProgressUnits: item.tvProgressUnits
                  }))}
                  defaultGroupId={defaultCreatePostGroupId}
                  defaultCatalogItemId={defaultCreatePostCatalogItemId}
                  triggerText={createPostTriggerText}
                  postAudienceLabel={createPostContextGroupName ?? "public"}
                  onOpen={() => setShowCreatePostSheet(true)}
                  onClose={() => setShowCreatePostSheet(false)}
                  onSubmit={async (payload) => {
                    if (!currentUser) {
                      return;
                    }

                    const audience = resolveSingleGroupAudience({
                      groupId: payload.group_id
                    });

                    if (payload.catalog_item_id) {
                      setSelectedCatalogItemIdForProgress(String(payload.catalog_item_id));
                    }

                    const postInsertPayload: Record<string, unknown> = {
                      author_user_id: currentUser.id,
                      body_text: payload.body_text,
                      group_id: audience.groupId,
                      catalog_item_id: payload.catalog_item_id,
                      progress_unit_id: payload.progress_unit_id,
                      book_page: payload.book_page,
                      book_percent: payload.book_percent,
                      tenor_gif_id: payload.tenor_gif_id,
                      tenor_gif_url: payload.tenor_gif_url
                    };

                    const { data: inserted, error } = await supabaseClient
                      .from("posts")
                      .insert(postInsertPayload)
                      .select("id,body_text,created_at,status,deleted_at,group_id,catalog_item_id,progress_unit_id,book_page,book_percent")
                      .single();

                    if (error || !inserted) {
                      console.error("[app] post insert failed", error);
                      return;
                    }

                    if (payload.attachments.length) {
                      const attachmentRows = payload.attachments.map((attachment, index) => ({
                        post_id: inserted.id,
                        kind: attachment.kind,
                        storage_path: attachment.url,
                        size_bytes: attachment.bytes ?? null,
                        sort_order: index
                      }));

                      const { error: attachmentError } = await supabaseClient.from("post_attachments").insert(attachmentRows);

                      if (attachmentError) {
                        console.error("[app] post_attachments insert failed", attachmentError);
                      }
                    }

                    const insertedPost = {
                      ...(inserted as SupabasePostRow),
                      previewText: buildPostPreviewText(inserted.body_text),
                      authorDisplayName: currentUser.displayName?.trim() || currentUser.username || "You",
                      authorAvatarUrl: currentUser.avatarUrl ?? DEFAULT_AVATAR_PLACEHOLDER,
                      catalogItemTitle: shelfItems.find((item) => item.catalogItemId === String((inserted as SupabasePostRow).catalog_item_id))?.title,
                      progressLine: formatPostProgressLine(inserted as SupabasePostRow)
                    };

                    if ((inserted as { group_id?: string | number | null }).group_id == null) {
                      setPosts((prev) => [insertedPost, ...prev]);
                    } else {
                      setGroupPosts((prev) => [insertedPost, ...prev]);
                    }
                  }}
                />
              </div>
            ) : null}
          </section>

          <aside style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", alignContent: "start", gap: spacingTokens.sm }}>
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Trending</h3>
          </aside>
        </main>
      </div>

      {notificationModalOpen ? (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 30, padding: spacingTokens.lg }}
          onClick={() => setNotificationModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(520px, 90vw)", maxHeight: "70vh", overflowY: "auto", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.lg, display: "grid", gap: spacingTokens.sm }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Notifications</h3>
              <button type="button" onClick={() => setNotificationModalOpen(false)} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: 8, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer" }}>Close</button>
            </div>
            {notifications.length ? notifications.map((eventItem) => (
              <article key={eventItem.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.md, padding: spacingTokens.sm, display: "grid", gap: 2 }}>
                <strong style={{ color: theme.colors.textPrimary, fontSize: 13 }}>{eventItem.text}</strong>
                <small style={{ color: theme.colors.textSecondary }}>{new Date(eventItem.createdAt).toLocaleString()}</small>
              </article>
            )) : <small style={{ color: theme.colors.textSecondary }}>No notifications yet.</small>}
          </div>
        </div>
      ) : null}

      {catalogSearchContext ? (
        <CatalogSearchSheet
          open={showCatalogSearchSheet}
          theme={theme}
          mode={catalogSearchContext.mode}
          groupId={catalogSearchContext.mode === "group" ? Number(catalogSearchContext.groupId) : undefined}
          selectionBehavior="import"
          availableGroups={groups.map((group) => ({ id: String(group.id), name: group.name }))}
          onClose={closeCatalogSearch}
          onImported={handleCatalogImported}
          onAddToShelf={async (imported) => {
            if (!currentUser) return;
            const catalogItemId = imported.catalog_item.id;
            const { error } = await supabaseClient.from("user_media_progress").upsert(
              {
                user_id: currentUser.id,
                catalog_item_id: catalogItemId,
                status: "in_progress",
                current_sequence_index: 0,
                updated_at: new Date().toISOString()
              },
              { onConflict: "user_id,catalog_item_id" }
            );

            if (error) {
              setCatalogSearchError(error.message);
              return;
            }

            setShelfItems((prev) => {
              const next = prev.filter((entry) => entry.catalogItemId !== String(catalogItemId));
              return [{
                catalogItemId: String(catalogItemId),
                title: imported.catalog_item.title,
                itemType: imported.catalog_item.item_type === "tv_show" ? "tv_show" : "book",
                coverImageUrl: imported.catalog_item.cover_image_url ?? undefined,
                status: "in_progress",
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null,
                progressSummary: imported.catalog_item.item_type === "tv_show" ? "Season 1, Episode 1" : "Page 0/?",
                progressPercent: 0,
                currentPage: null,
                pageCount: null,
                currentSeasonNumber: null,
                currentEpisodeNumber: null,
                progressPercentValue: null,
                tvProgressUnits: []
              }, ...next];
            });
          }}
          onAddToGroup={async (imported, _selected, groupId) => {
            if (!currentUser) return;
            const catalogItemId = imported.catalog_item.id;
            const { error } = await supabaseClient.from("group_catalog_items").upsert(
              {
                group_id: groupId,
                catalog_item_id: catalogItemId,
                added_by_user_id: currentUser.id,
                is_active: true
              },
              { onConflict: "group_id,catalog_item_id" }
            );

            if (error) {
              setCatalogSearchError(error.message);
              return;
            }

            setGroupCatalogItems((prev) => {
              const next = prev.filter((entry) => !(entry.groupId === String(groupId) && entry.catalogItemId === String(catalogItemId)));
              return [{ groupId: String(groupId), catalogItemId: String(catalogItemId), title: imported.catalog_item.title }, ...next];
            });
          }}
          onError={(message) => {
            setCatalogSearchError(message);
            console.error("[app] catalog search/import failed", message);
          }}
          searchEndpoint={`${FUNCTIONS_URL}/search-catalog`}
          importEndpoint={`${FUNCTIONS_URL}/catalog-import`}
        />
      ) : null}

      {showCreateGroupSheet ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "end center",
            padding: spacingTokens.lg
          }}
        >
          <div
            style={{
              width: "min(430px, 100%)",
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: radiusTokens.lg,
              padding: spacingTokens.md,
              display: "grid",
              gap: spacingTokens.sm
            }}
          >
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Create group</h3>
            <label style={{ display: "grid", gap: 4, color: theme.colors.textSecondary, fontSize: 14 }}>
              Name
              <input
                value={createGroupName}
                onChange={(event) => setCreateGroupName(event.target.value)}
                placeholder="Book Club"
                maxLength={80}
                style={{ borderRadius: radiusTokens.md, border: `1px solid ${theme.colors.border}`, padding: "10px 12px" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, color: theme.colors.textSecondary, fontSize: 14 }}>
              Description
              <textarea
                value={createGroupDescription}
                onChange={(event) => setCreateGroupDescription(event.target.value)}
                placeholder="What is this group about?"
                rows={4}
                maxLength={240}
                style={{
                  borderRadius: radiusTokens.md,
                  border: `1px solid ${theme.colors.border}`,
                  padding: "10px 12px",
                  resize: "vertical"
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, color: theme.colors.textSecondary, fontSize: 14 }}>
              Privacy
              <select
                value={createGroupPrivacy}
                onChange={(event) => setCreateGroupPrivacy(event.target.value as "public" | "private")}
                style={{ borderRadius: radiusTokens.md, border: `1px solid ${theme.colors.border}`, padding: "10px 12px" }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            {createGroupError ? <p style={{ margin: 0, color: "#b42318" }}>{createGroupError}</p> : null}
            <button
              type="button"
              onClick={() => void handleCreateGroup()}
              disabled={isCreatingGroup}
              style={{
                border: "none",
                borderRadius: radiusTokens.md,
                padding: "10px 14px",
                background: theme.colors.accent,
                color: theme.colors.accentText,
                fontWeight: 700,
                cursor: isCreatingGroup ? "not-allowed" : "pointer",
                opacity: isCreatingGroup ? 0.7 : 1
              }}
            >
              {isCreatingGroup ? "Creating…" : "Create group"}
            </button>
            <button
              type="button"
              onClick={closeCreateGroupModal}
              style={{
                borderRadius: radiusTokens.md,
                border: `1px solid ${theme.colors.border}`,
                padding: "10px 14px",
                background: "transparent",
                color: theme.colors.textPrimary,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const menuItem = (theme: ReturnType<typeof createTheme>): CSSProperties => ({
  width: "100%",
  border: "none",
  background: "transparent",
  color: theme.colors.textPrimary,
  textAlign: "left",
  padding: "10px 14px",
  cursor: "pointer"
});

const SidebarItemContent = ({
  label,
  theme,
  iconText,
  avatarUrl,
  artworkUrl,
  fallbackIcon
}: {
  label: string;
  theme: ReturnType<typeof createTheme>;
  iconText?: string;
  avatarUrl?: string;
  artworkUrl?: string;
  fallbackIcon?: string;
}) => {
  const imageSrc = avatarUrl || artworkUrl;
  const fallbackText = iconText || fallbackIcon;

  return (
    <span
      style={{
        display: "grid",
        gridTemplateColumns: "24px minmax(0, 1fr)",
        alignItems: "center",
        columnGap: spacingTokens.sm,
        width: "100%"
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          style={{ width: 24, height: 24, borderRadius: avatarUrl ? 999 : 6, objectFit: "cover", border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceMuted }}
        />
      ) : fallbackText ? (
        <span style={{ width: 24, height: 24, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${theme.colors.textSecondary}22`, color: theme.colors.textSecondary, fontSize: 14, lineHeight: 1 }}>
          {fallbackText}
        </span>
      ) : (
        <img src={DEFAULT_COVER_PLACEHOLDER} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", border: `1px solid ${theme.colors.border}` }} />
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          lineHeight: 1.3
        }}
      >
        {label}
      </span>
    </span>
  );
};

const listItemStyle = (theme: ReturnType<typeof createTheme>, active: boolean, hovered = false): CSSProperties => ({
  ...menuItem(theme),
  padding: "12px 14px",
  fontSize: 16,
  fontWeight: 500,
  borderRadius: radiusTokens.sm,
  minHeight: 64,
  display: "flex",
  alignItems: "center",
  background: active ? `${theme.colors.accent}1F` : hovered ? `${theme.colors.accent}10` : "transparent",
  color: active ? theme.colors.accent : hovered ? theme.colors.textPrimary : theme.colors.textPrimary,
  transition: "background-color 120ms ease, color 120ms ease"
});

// Kept in case you use it again shortly.
const feedCard = (theme: ReturnType<typeof createTheme>): CSSProperties => ({
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  padding: spacingTokens.md,
  display: "grid",
  gap: spacingTokens.sm
});
