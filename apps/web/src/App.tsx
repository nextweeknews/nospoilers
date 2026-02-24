import { useEffect, useState, type CSSProperties } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser, ProviderLoginResult } from "../../../services/auth/src";
import { createTheme, elevationTokens, radiusTokens, resolveThemePreference, spacingTokens, type BottomNavItem, type ThemeMode, type ThemePreference } from "@nospoilers/ui";
import { buildPostPreviewText, mapAvatarPathToUiValue, type SupabaseGroupRow, type SupabasePostRow, type SupabaseUserProfileRow } from "@nospoilers/types";
import { GroupScreen } from "./screens/GroupScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingProfileScreen } from "./screens/OnboardingProfileScreen";
import { ProfileSettingsScreen } from "./screens/ProfileSettingsScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileTabScreen } from "./screens/ProfileTabScreen";
import { PostComposerSheet } from "./components/PostComposerSheet";
import { getSession, onAuthStateChange, signOut } from "./services/authClient";
import { supabaseClient } from "./services/supabaseClient";
import { profileNeedsOnboarding } from "./profileOnboarding";
import { BottomNav } from "./components/BottomNav";

const THEME_KEY = "nospoilers:web:theme-preference";

type MainView = BottomNavItem["key"];
type LoadStatus = "loading" | "ready" | "empty" | "error";

type GroupEntity = SupabaseGroupRow;

type PostEntity = SupabasePostRow & {
  previewText: string | null;
};
type OptionRow = { id: string; title: string };

const getSystemMode = (): ThemeMode => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};


const DEFAULT_AVATAR_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="none"><rect width="80" height="80" rx="40" fill="#27364A"/><circle cx="40" cy="31" r="14" fill="#7E97B3"/><path d="M16 69C16 55.745 26.745 45 40 45C53.255 45 64 55.745 64 69V80H16V69Z" fill="#7E97B3"/></svg>`)}`;


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

const mapUserWithProfile = async (user: User, session: Session): Promise<{ user: AuthUser; needsOnboarding: boolean }> => {
  const mappedUser = mapUser(user, session);
  const { data: profile } = await supabaseClient.from("users").select("id,username,display_name,avatar_path").eq("id", user.id).maybeSingle();
  const normalizedProfile = (profile as ProfileRecord | null) ?? null;

  return {
    user: mergeProfileIntoUser(mappedUser, normalizedProfile),
    needsOnboarding: profileNeedsOnboarding(normalizedProfile)
  };
};

export const App = () => {
  const [mainView, setMainView] = useState<MainView>("groups");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [showCreatePostSheet, setShowCreatePostSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogItems, setCatalogItems] = useState<OptionRow[]>([]);
  const [progressUnits, setProgressUnits] = useState<OptionRow[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; createdAt: string; text: string }>>([]);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

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
  
    const syncSession = async () => {
      try {
        const { data, error } = await getSession();
        if (error) throw error;
        if (cancelled) return;
  
        await syncAuthState(data.session);
      } catch (_error) {
        if (cancelled) return;
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
    };
  
    void syncSession();
  
    const { data } = onAuthStateChange((_event, session) => {
      // Avoid async callback directly in onAuthStateChange; defer async work.
      void (async () => {
        try {
          if (cancelled) return;
          await syncAuthState(session);
        } catch (_error) {
          if (cancelled) return;
          setCurrentUser(undefined);
          setNeedsOnboarding(false);
        }
      })();
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
      setGroupStatus("loading");
      setFeedStatus("loading");
      setGroupError(undefined);
      setFeedError(undefined);
      return;
    }

    let isCancelled = false;

    const loadData = async () => {
      setGroupStatus("loading");
      setFeedStatus("loading");
      setGroupError(undefined);
      setFeedError(undefined);

      const [groupResult, postResult] = await Promise.all([
        supabaseClient
          .from("group_memberships")
          .select("groups(id,name,description,avatar_path)")
          .eq("user_id", currentUser.id)
          .eq("status", "active")
          .order("joined_at", { ascending: false }),
        supabaseClient.from("posts").select("id,body_text,created_at").order("created_at", { ascending: false })
      ]);

      if (isCancelled) {
        return;
      }

      if (groupResult.error) {
        setGroups([]);
        setGroupStatus("error");
        setGroupError(groupResult.error.message);
      } else {
        const memberships = (groupResult.data as Array<{ groups: GroupEntity | GroupEntity[] | null }> | null) ?? [];
        const loadedGroups = memberships
          .flatMap((membership) => (Array.isArray(membership.groups) ? membership.groups : membership.groups ? [membership.groups] : []));
        setGroups(loadedGroups);
        setGroupStatus(loadedGroups.length ? "ready" : "empty");
      }

      if (postResult.error) {
        setPosts([]);
        setFeedStatus("error");
        setFeedError(postResult.error.message);
      } else {
        const loadedPosts = ((postResult.data as SupabasePostRow[] | null) ?? []).map((post) => ({
          ...post,
          previewText: buildPostPreviewText(post.body_text)
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

    void supabaseClient.from("catalog_items").select("id,title").limit(20).then(({ data }) => setCatalogItems((data as OptionRow[] | null) ?? []));
    void supabaseClient.from("catalog_progress_units").select("id,title").limit(20).then(({ data }) => setProgressUnits((data as OptionRow[] | null) ?? []));

    void Promise.all([
      supabaseClient.from("post_comments").select("id,body_text,created_at").order("created_at", { ascending: false }).limit(20),
      supabaseClient.from("post_reactions").select("id,reaction,created_at").order("created_at", { ascending: false }).limit(20)
    ]).then(([comments, reactions]) => {
      const commentEvents = ((comments.data as Array<{ id: string; body_text: string | null; created_at: string }> | null) ?? []).map((entry) => ({ id: `comment-${entry.id}`, type: "Comment", createdAt: entry.created_at, text: entry.body_text ?? "New comment" }));
      const reactionEvents = ((reactions.data as Array<{ id: string; reaction: string | null; created_at: string }> | null) ?? []).map((entry) => ({ id: `reaction-${entry.id}`, type: "Reaction", createdAt: entry.created_at, text: entry.reaction ?? "New reaction" }));
      setNotifications([...commentEvents, ...reactionEvents].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    });
  }, [currentUser]);

  const searchResults = progressUnits
    .map((unit) => ({ id: unit.id, title: unit.title, chapter: unit.title.match(/chapter\s*\d+/i)?.[0] ?? null, episode: unit.title.match(/episode\s*\d+/i)?.[0] ?? null }))
    .filter((item) => {
      const needle = searchQuery.toLowerCase();
      return !needle || item.title.toLowerCase().includes(needle) || item.chapter?.toLowerCase().includes(needle) || item.episode?.toLowerCase().includes(needle);
    });

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

  const onChooseDifferentLoginMethod = async () => {
    await signOut();
    setCurrentUser(undefined);
    setNeedsOnboarding(false);
  };

  if (pathname === "/auth/callback") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
        <AuthCallbackScreen theme={theme} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
        <LoginScreen onSignedIn={onSignedIn} theme={theme} />
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
      <div
        style={{
          width: "min(430px, 100%)",
          height: "min(880px, calc(100vh - 32px))",
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 28,
          boxShadow: elevationTokens.medium,
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr auto"
        }}
      >
        <header style={{ padding: spacingTokens.md, borderBottom: `1px solid ${theme.colors.border}`, display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: spacingTokens.sm }}>
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 18 }}>NoSpoilers</h2>

          <div style={{ position: "relative", justifySelf: "end" }}>
            <button
              type="button"
              aria-label="Account menu"
              onClick={() => setMenuOpen((current) => !current)}
              style={{ background: "transparent", border: `1px solid ${theme.colors.border}`, borderRadius: 12, color: theme.colors.textPrimary, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser.displayName ?? "Reader"}</div>
                <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>@{currentUser.username ?? "nospoiler"}</div>
              </div>
              <img
                src={currentUser.avatarUrl?.trim() || DEFAULT_AVATAR_PLACEHOLDER}
                alt="Your avatar"
                style={{ width: 28, height: 28, borderRadius: 999, objectFit: "cover" }}
              />
              <span style={{ letterSpacing: 1 }}>⋮</span>
            </button>
            {authStatus ? <small style={{ color: theme.colors.textSecondary, justifySelf: "end" }}>{authStatus}</small> : null}
            {menuOpen ? (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 12, boxShadow: elevationTokens.low, overflow: "hidden", zIndex: 5 }}>
                <button type="button" onClick={() => { setMainView("profile"); setMenuOpen(false); }} style={menuItem(theme)}>
                  Profile
                </button>
                <button type="button" onClick={async () => { const { error } = await signOut(); if (error) { setAuthStatus(`Unable to sign out: ${error.message}`); return; } setAuthStatus("Signed out."); setMainView("groups"); setCurrentUser(undefined); }} style={menuItem(theme)}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Create post"
            onClick={() => setShowCreatePostSheet(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: theme.colors.accent,
              color: "#fff",
              fontSize: 28,
              lineHeight: "28px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            +
          </button>
        </header>

        <main style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", alignContent: "start", gap: spacingTokens.md, background: theme.colors.background }}>
          {mainView === "profile" ? (
            showProfileSettings ? (
            <ProfileSettingsScreen
              user={currentUser}
              onProfileUpdated={setCurrentUser}
              onAccountDeleted={() => {
                setCurrentUser(undefined);
                setNeedsOnboarding(false);
                setMainView("groups");
                setMenuOpen(false);
              }}
              onThemePreferenceChanged={onThemePreferenceChanged}
              themePreference={themePreference}
              theme={theme}
            />
            ) : (
              <ProfileTabScreen theme={theme} user={currentUser} onEditProfile={() => setShowProfileSettings(true)} onAccountSettings={() => setShowProfileSettings(true)} />
            )
          ) : null}

          {mainView === "groups" ? (
            <GroupScreen
              groups={groups.map((group) => ({
                id: group.id,
                name: group.name,
                description: group.description,
                coverUrl: mapAvatarPathToUiValue(group.avatar_path)
              }))}
              status={groupStatus}
              errorMessage={groupError}
              theme={theme}
              onCreateGroup={() => setShowCreateGroupSheet(true)}
            />
          ) : null}

          {mainView === "notifications" ? <NotificationsScreen theme={theme} events={notifications} /> : null}

          {mainView === "for-you" ? <SearchScreen theme={theme} query={searchQuery} onQueryChange={setSearchQuery} results={searchResults} recent={searchResults.slice(0, 3)} popular={searchResults.slice(3, 6)} /> : null}
        </main>

        <BottomNav activeTab={mainView} onSelect={(view) => { setMainView(view); setMenuOpen(false); }} theme={theme} />
      </div>

      <PostComposerSheet
        open={showCreatePostSheet}
        theme={theme}
        groups={groups.map((group) => ({ id: group.id, label: group.name }))}
        catalogItems={catalogItems.map((entry) => ({ id: entry.id, label: entry.title }))}
        progressUnits={progressUnits.map((entry) => ({ id: entry.id, label: entry.title }))}
        onClose={() => setShowCreatePostSheet(false)}
        onSubmit={async (payload) => {
          if (!currentUser) {
            return;
          }

          const { data: inserted, error } = await supabaseClient.from("posts").insert({
            author_user_id: currentUser.id,
            body_text: payload.body_text,
            public: payload.public,
            group_id: payload.group_id,
            catalog_item_id: payload.catalog_item_id,
            progress_unit_id: payload.progress_unit_id,
            tenor_gif_id: payload.tenor_gif_id,
            tenor_gif_url: payload.tenor_gif_url
          }).select("id,body_text,created_at").single();
          if (error || !inserted) {
            return;
          }

          if (payload.attachments.length) {
            await supabaseClient.from("post_attachments").insert(payload.attachments.map((attachment) => ({ post_id: inserted.id, media_url: attachment.url, media_kind: attachment.kind, bytes: attachment.bytes })));
          }
          setPosts((prev) => [{ ...(inserted as SupabasePostRow), previewText: buildPostPreviewText(inserted.body_text) }, ...prev]);
        }}
      />

      {showCreateGroupSheet ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "end center", padding: spacingTokens.lg }}>
          <div style={{ width: "min(430px, 100%)", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: radiusTokens.lg, padding: spacingTokens.md, display: "grid", gap: spacingTokens.sm }}>
            <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Create group</h3>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>This placeholder sheet confirms the create-group flow is wired. Full group creation is coming next.</p>
            <button type="button" onClick={() => setShowCreateGroupSheet(false)} style={{ border: "none", borderRadius: radiusTokens.md, padding: "10px 14px", background: theme.colors.accent, color: theme.colors.accentText, fontWeight: 700, cursor: "pointer" }}>
              Close
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

const feedCard = (theme: ReturnType<typeof createTheme>): CSSProperties => ({
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: radiusTokens.md,
  padding: spacingTokens.md,
  display: "grid",
  gap: spacingTokens.sm
});
