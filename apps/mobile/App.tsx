import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, TextInput, View, useColorScheme } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser, ProviderLoginResult } from "../../services/auth/src";
import { createTheme, resolveThemePreference, spacingTokens, type BottomNavItem, type ThemePreference } from "@nospoilers/ui";
import {
  mapAvatarPathToUiValue,
  type SupabaseCatalogProgressUnitRow,
  type SupabaseGroupRow,
  type SupabasePostAttachmentInsert,
  type SupabasePostInsert,
  type SupabasePostReactionRow,
  type SupabaseUserProfileRow
} from "@nospoilers/types";
import { GroupScreen } from "./src/screens/GroupScreen";
import { BottomTabs } from "./src/components/BottomTabs";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ProfileSettingsScreen } from "./src/screens/ProfileSettingsScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ProfileTabScreen } from "./src/screens/ProfileTabScreen";
import { PostComposerModal } from "./src/components/PostComposerModal";
import { OnboardingProfileScreen } from "./src/screens/OnboardingProfileScreen";
import { mobileConfig } from "./src/config/env";
import { getSession, onAuthStateChange, signOut } from "./src/services/authClient";
import { supabaseClient } from "./src/services/supabaseClient";
import { AppText } from "./src/components/Typography";
import { profileNeedsOnboarding } from "./src/profileOnboarding";

type GroupEntity = SupabaseGroupRow;

type GroupLoadStatus = "loading" | "ready" | "empty" | "error";


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
export default function App() {
  const [activeTab, setActiveTab] = useState<BottomNavItem["key"]>("groups");
  const [currentUser, setCurrentUser] = useState<AuthUser>();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [groupStatus, setGroupStatus] = useState<GroupLoadStatus>("loading");
  const [groupError, setGroupError] = useState<string>();
  const [groups, setGroups] = useState<GroupEntity[]>([]);
  const [authResolved, setAuthResolved] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showCreateGroupSheet, setShowCreateGroupSheet] = useState(false);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDescription, setCreateGroupDescription] = useState("");
  const [createGroupPrivacy, setCreateGroupPrivacy] = useState<"public" | "private">("private");
  const [createGroupError, setCreateGroupError] = useState<string>();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showCreatePostSheet, setShowCreatePostSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogItems, setCatalogItems] = useState<Array<{ id: string; title: string }>>([]);
  const [progressUnits, setProgressUnits] = useState<Array<{ id: string; title: string }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; createdAt: string; text: string }>>([]);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const colorScheme = useColorScheme();
  const theme = createTheme(resolveThemePreference(colorScheme === "dark" ? "dark" : "light", themePreference));

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await getSession();
      if (data.session?.user) {
        const mapped = await mapUserWithProfile(data.session.user, data.session);
        setCurrentUser(mapped.user);
        setNeedsOnboarding(mapped.needsOnboarding);
      } else {
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
      setAuthResolved(true);
    };

    void syncSession();

    const { data } = onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const mapped = await mapUserWithProfile(session.user, session);
        setCurrentUser(mapped.user);
        setNeedsOnboarding(mapped.needsOnboarding);
      } else {
        setCurrentUser(undefined);
        setNeedsOnboarding(false);
      }
      setAuthResolved(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setGroupStatus("loading");
      setGroupError(undefined);
      return;
    }

    let cancelled = false;

    const loadGroups = async () => {
      setGroupStatus("loading");
      const result = await supabaseClient
        .from("group_memberships")
        .select("groups(id,name,description,avatar_path)")
        .eq("user_id", currentUser.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (cancelled) {
        return;
      }

      if (result.error) {
        setGroups([]);
        setGroupStatus("error");
        setGroupError(result.error.message);
        return;
      }

      const memberships = (result.data as Array<{ groups: GroupEntity | GroupEntity[] | null }> | null) ?? [];
      const loaded = memberships
        .flatMap((membership) => (Array.isArray(membership.groups) ? membership.groups : membership.groups ? [membership.groups] : []));
      setGroups(loaded);
      setGroupStatus(loaded.length ? "ready" : "empty");
      setGroupError(undefined);
    };

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);


  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void supabaseClient.from("catalog_items").select("id,title").limit(20).then(({ data }) => setCatalogItems((data as Array<{ id: string; title: string }> | null) ?? []));
    void supabaseClient.from("catalog_progress_units").select("id,title").limit(20).then(({ data }) => setProgressUnits((data as SupabaseCatalogProgressUnitRow[] | null) ?? []));

    void Promise.all([
      supabaseClient.from("post_comments").select("id,body_text,created_at").order("created_at", { ascending: false }).limit(20),
      supabaseClient.from("post_reactions").select("post_id,user_id,emoji,created_at").order("created_at", { ascending: false }).limit(20)
    ]).then(([comments, reactions]) => {
      const commentEvents = ((comments.data as Array<{ id: string; body_text: string | null; created_at: string }> | null) ?? []).map((entry) => ({ id: `comment-${entry.id}`, type: "Comment", createdAt: entry.created_at, text: entry.body_text ?? "New comment" }));
      const reactionEvents = ((reactions.data as SupabasePostReactionRow[] | null) ?? []).map((entry) => ({ id: `reaction-${entry.post_id}-${entry.user_id}-${entry.created_at}`, type: "Reaction", createdAt: entry.created_at, text: entry.emoji }));
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
    setThemePreference(result.user.preferences?.themePreference ?? "system");
  };

  const onChooseDifferentLoginMethod = async () => {
    await signOut();
    setCurrentUser(undefined);
    setNeedsOnboarding(false);
    setAuthResolved(true);
  };

  const resetCreateGroupSheet = () => {
    setCreateGroupName("");
    setCreateGroupDescription("");
    setCreateGroupPrivacy("private");
    setCreateGroupError(undefined);
    setIsCreatingGroup(false);
  };

  const closeCreateGroupSheet = () => {
    setShowCreateGroupSheet(false);
    resetCreateGroupSheet();
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
    closeCreateGroupSheet();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.container, { padding: spacingTokens.lg }]}>
        <AppText style={[styles.configText, { color: theme.colors.textSecondary }]}>
          Env {mobileConfig.environment} · API {mobileConfig.apiBaseUrl} · Auth {mobileConfig.authClientId}
        </AppText>
        {!authResolved ? (
          <View style={styles.authLoadingState}>
            <ActivityIndicator color={theme.colors.accent} />
            <AppText style={[styles.authLoadingText, { color: theme.colors.textSecondary }]}>Signing you in…</AppText>
          </View>
        ) : !currentUser ? (
          <LoginScreen onSignedIn={onSignedIn} theme={theme} />
        ) : needsOnboarding ? (
          <OnboardingProfileScreen
            user={currentUser}
            theme={theme}
            onProfileCompleted={(user) => {
              setCurrentUser(user);
              setNeedsOnboarding(false);
            }}
            onChooseDifferentLoginMethod={onChooseDifferentLoginMethod}
          />
        ) : (
          <>
            <View style={styles.headerRow}>
              <AppText style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>NoSpoilers</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create post"
                onPress={() => setShowCreatePostSheet(true)}
                style={[styles.createPostButton, { backgroundColor: theme.colors.accent }]}
              >
                <AppText style={[styles.createPostButtonLabel, { color: theme.colors.accentText }]}>+</AppText>
              </Pressable>
            </View>
            {activeTab === "profile" ? (
              showProfileSettings ? (
              <ProfileSettingsScreen
                user={currentUser}
                onProfileUpdated={setCurrentUser}
                onAccountDeleted={() => {
                  setCurrentUser(undefined);
                  setNeedsOnboarding(false);
                  setActiveTab("groups");
                }}
                theme={theme}
                themePreference={themePreference}
                onThemePreferenceChanged={setThemePreference}
              />
              ) : (
                <ProfileTabScreen theme={theme} user={currentUser} onEditProfile={() => setShowProfileSettings(true)} onAccountSettings={() => setShowProfileSettings(true)} />
              )
            ) : activeTab === "groups" ? (
              <GroupScreen
                groups={groups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  coverUrl: mapAvatarPathToUiValue(group.avatar_path)
                }))}
                status={groupStatus}
                errorMessage={groupError}
                onCreateGroup={() => setShowCreateGroupSheet(true)}
                theme={theme}
              />
            ) : activeTab === "for-you" ? (
              <SearchScreen theme={theme} query={searchQuery} onQueryChange={setSearchQuery} results={searchResults} recent={searchResults.slice(0, 3)} popular={searchResults.slice(3, 6)} />
            ) : (
              <NotificationsScreen theme={theme} events={notifications} />
            )}
            <BottomTabs activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
            <Modal visible={showCreateGroupSheet} transparent animationType="slide" onRequestClose={closeCreateGroupSheet}>
              <View style={styles.modalBackdrop}>
                <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <AppText style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Create group</AppText>
                  <AppText style={[styles.modalFieldLabel, { color: theme.colors.textSecondary }]}>Name</AppText>
                  <TextInput
                    value={createGroupName}
                    onChangeText={setCreateGroupName}
                    placeholder="Book Club"
                    placeholderTextColor={theme.colors.textSecondary}
                    maxLength={80}
                    style={[styles.modalInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
                  />
                  <AppText style={[styles.modalFieldLabel, { color: theme.colors.textSecondary }]}>Description</AppText>
                  <TextInput
                    value={createGroupDescription}
                    onChangeText={setCreateGroupDescription}
                    placeholder="What is this group about?"
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    maxLength={240}
                    style={[styles.modalInput, styles.modalTextarea, { borderColor: theme.colors.border, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted }]}
                  />
                  <AppText style={[styles.modalFieldLabel, { color: theme.colors.textSecondary }]}>Privacy</AppText>
                  <View style={styles.modalPrivacyRow}>
                    {(["private", "public"] as const).map((privacyValue) => {
                      const selected = createGroupPrivacy === privacyValue;
                      return (
                        <Pressable
                          key={privacyValue}
                          onPress={() => setCreateGroupPrivacy(privacyValue)}
                          style={[
                            styles.modalPrivacyOption,
                            {
                              borderColor: selected ? theme.colors.accent : theme.colors.border,
                              backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceMuted
                            }
                          ]}
                        >
                          <AppText style={{ color: selected ? theme.colors.accentText : theme.colors.textPrimary, fontWeight: "600" }}>
                            {privacyValue === "private" ? "Private" : "Public"}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {createGroupError ? <AppText style={[styles.modalError, { color: "#b42318" }]}>{createGroupError}</AppText> : null}
                  <Pressable onPress={() => void handleCreateGroup()} disabled={isCreatingGroup} style={[styles.modalButton, { backgroundColor: theme.colors.accent, opacity: isCreatingGroup ? 0.7 : 1 }]}>
                    <AppText style={{ color: theme.colors.accentText, fontWeight: "700" }}>{isCreatingGroup ? "Creating…" : "Create group"}</AppText>
                  </Pressable>
                  <Pressable onPress={closeCreateGroupSheet} style={[styles.modalButtonSecondary, { borderColor: theme.colors.border }]}>
                    <AppText style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Cancel</AppText>
                  </Pressable>
                </View>
              </View>
            </Modal>
            <PostComposerModal
              visible={showCreatePostSheet}
              theme={theme}
              groups={groups.map((group) => ({ id: group.id, label: group.name }))}
              catalogItems={catalogItems.map((entry) => ({ id: entry.id, label: entry.title }))}
              progressUnits={progressUnits.map((entry) => ({ id: entry.id, label: entry.title }))}
              onClose={() => setShowCreatePostSheet(false)}
              onSubmit={async (payload) => {
                if (!currentUser) {
                  return;
                }

                const postInsert: SupabasePostInsert = {
                  author_user_id: currentUser.id,
                  body_text: payload.body_text,
                  group_id: payload.group_id,
                  catalog_item_id: payload.catalog_item_id,
                  progress_unit_id: payload.progress_unit_id,
                  tenor_gif_id: payload.tenor_gif_id,
                  tenor_gif_url: payload.tenor_gif_url,
                  has_media: payload.attachments.length > 0,
                  ...(payload.status ? { status: payload.status } : {})
                };

                const { data: inserted, error } = await supabaseClient.from("posts").insert(postInsert).select("id").single();

                if (error || !inserted || !payload.attachments.length) {
                  return;
                }

                const attachmentInserts: SupabasePostAttachmentInsert[] = payload.attachments.map((attachment, index) => ({
                  post_id: inserted.id,
                  kind: attachment.kind,
                  storage_path: attachment.storage_path,
                  size_bytes: attachment.size_bytes,
                  sort_order: index
                }));

                await supabaseClient.from("post_attachments").insert(attachmentInserts);
              }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, gap: 12 },
  configText: { fontSize: 12 },
  authLoadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  authLoadingText: { fontSize: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  createPostButton: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  createPostButtonLabel: { fontSize: 28, fontWeight: "700", lineHeight: 30 },
  placeholderCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: spacingTokens.lg, gap: spacingTokens.sm },
  placeholderTitle: { fontSize: 18, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", padding: spacingTokens.lg },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: spacingTokens.lg, gap: spacingTokens.sm },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalFieldLabel: { fontSize: 13, fontWeight: "600" },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  modalTextarea: { minHeight: 88, textAlignVertical: "top" },
  modalPrivacyRow: { flexDirection: "row", gap: spacingTokens.sm },
  modalPrivacyOption: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  modalError: { fontSize: 13 },
  modalButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: spacingTokens.sm },
  modalButtonSecondary: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" }
});
