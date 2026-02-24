import { useEffect, useState, type CSSProperties } from "react";
import type { AuthUser, ProviderLoginResult } from "../../../services/auth/src";
import { createTheme, elevationTokens, radiusTokens, resolveThemePreference, spacingTokens, type ThemeMode, type ThemePreference } from "@nospoilers/ui";
import { GroupScreen } from "./screens/GroupScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingProfileScreen } from "./screens/OnboardingProfileScreen";
import { ProfileSettingsScreen } from "./screens/ProfileSettingsScreen";
import { supabaseClient } from "./services/supabaseClient";

const THEME_KEY = "nospoilers:web:theme-preference";

type MainView = "feed" | "groups" | "account";
type LoadStatus = "loading" | "ready" | "empty" | "error";

type GroupEntity = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
};

type PostEntity = {
  id: string;
  preview_text: string | null;
  created_at: string;
};

const getSystemMode = (): ThemeMode => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

const hasCompleteProfile = (user: AuthUser): boolean => Boolean(user.displayName?.trim() && user.username?.trim() && user.avatarUrl?.trim());

export const App = () => {
  const [mainView, setMainView] = useState<MainView>("feed");
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

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
        supabaseClient.from("groups").select("id,name,description,cover_url").order("created_at", { ascending: false }),
        supabaseClient.from("posts").select("id,preview_text,created_at").order("created_at", { ascending: false })
      ]);

      if (isCancelled) {
        return;
      }

      if (groupResult.error) {
        setGroups([]);
        setGroupStatus("error");
        setGroupError(groupResult.error.message);
      } else {
        const loadedGroups = (groupResult.data as GroupEntity[] | null) ?? [];
        setGroups(loadedGroups);
        setGroupStatus(loadedGroups.length ? "ready" : "empty");
      }

      if (postResult.error) {
        setPosts([]);
        setFeedStatus("error");
        setFeedError(postResult.error.message);
      } else {
        const loadedPosts = (postResult.data as PostEntity[] | null) ?? [];
        setPosts(loadedPosts);
        setFeedStatus(loadedPosts.length ? "ready" : "empty");
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  const onSignedIn = (result: ProviderLoginResult) => {
    setCurrentUser(result.user);
    if (result.user.preferences?.themePreference) {
      setThemePreference(result.user.preferences.themePreference);
    }
  };

  const onThemePreferenceChanged = (next: ThemePreference) => {
    setThemePreference(next);
    window.localStorage.setItem(THEME_KEY, next);
  };

  const theme = createTheme(resolveThemePreference(systemMode, themePreference));

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
        <LoginScreen onSignedIn={onSignedIn} theme={theme} />
      </div>
    );
  }

  if (!hasCompleteProfile(currentUser)) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: theme.colors.background, padding: spacingTokens.lg }}>
        <OnboardingProfileScreen user={currentUser} theme={theme} onProfileCompleted={setCurrentUser} />
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
          gridTemplateRows: "auto 1fr"
        }}
      >
        <header style={{ padding: spacingTokens.md, borderBottom: `1px solid ${theme.colors.border}`, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: spacingTokens.md }}>
          <button
            type="button"
            aria-label="Create post"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
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

          <div style={{ justifySelf: "center", background: theme.colors.surfaceMuted, borderRadius: radiusTokens.pill, border: `1px solid ${theme.colors.border}`, padding: 4, display: "flex", gap: 4 }}>
            {(["feed", "groups"] as const).map((view) => {
              const active = mainView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setMainView(view);
                    setMenuOpen(false);
                  }}
                  style={{
                    border: "none",
                    borderRadius: radiusTokens.pill,
                    background: active ? theme.colors.accent : "transparent",
                    color: active ? theme.colors.accentText : theme.colors.textPrimary,
                    padding: "8px 16px",
                    textTransform: "capitalize",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {view}
                </button>
              );
            })}
          </div>

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
                src={currentUser.avatarUrl ?? "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop"}
                alt="Your avatar"
                style={{ width: 28, height: 28, borderRadius: 999, objectFit: "cover" }}
              />
              <span style={{ letterSpacing: 1 }}>⋮</span>
            </button>
            {menuOpen ? (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 12, boxShadow: elevationTokens.low, overflow: "hidden", zIndex: 5 }}>
                <button type="button" onClick={() => { setMainView("account"); setMenuOpen(false); }} style={menuItem(theme)}>
                  Account
                </button>
                <button type="button" onClick={() => { setMainView("feed"); setCurrentUser(undefined); }} style={menuItem(theme)}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main style={{ overflowY: "auto", padding: spacingTokens.md, display: "grid", alignContent: "start", gap: spacingTokens.md, background: theme.colors.background }}>
          {mainView === "account" ? (
            <ProfileSettingsScreen
              user={currentUser}
              onProfileUpdated={setCurrentUser}
              onAccountDeleted={() => {
                setCurrentUser(undefined);
                setMainView("feed");
                setMenuOpen(false);
              }}
              onThemePreferenceChanged={onThemePreferenceChanged}
              themePreference={themePreference}
              theme={theme}
            />
          ) : null}

          {mainView === "groups" ? (
            <GroupScreen
              group={groups[0] ? { name: groups[0].name, description: groups[0].description, coverUrl: groups[0].cover_url } : undefined}
              status={groupStatus}
              errorMessage={groupError}
              theme={theme}
            />
          ) : null}

          {mainView === "feed" ? (
            feedStatus === "loading" ? (
              <article style={feedCard(theme)}><p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading feed posts from Supabase…</p></article>
            ) : feedStatus === "error" ? (
              <article style={feedCard(theme)}><p style={{ margin: 0, color: theme.colors.textSecondary }}>Unable to load feed from backend: {feedError}</p></article>
            ) : feedStatus === "empty" ? (
              <article style={feedCard(theme)}><p style={{ margin: 0, color: theme.colors.textSecondary }}>No real feed posts are available for this account yet.</p></article>
            ) : (
              posts.map((post) => (
                <article key={post.id} style={feedCard(theme)}>
                  <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>Post {post.id.slice(0, 8)}</h3>
                  <p style={{ margin: 0, color: theme.colors.textSecondary }}>{post.preview_text ?? "(No preview text provided.)"}</p>
                  <small style={{ color: theme.colors.accentStrong, fontWeight: 600 }}>{new Date(post.created_at).toLocaleString()}</small>
                </article>
              ))
            )
          ) : null}
        </main>
      </div>
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
