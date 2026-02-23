export type GroupProgress = {
  completed: number;
  total: number;
};

export type MediaKind = "book" | "show";

export type ExternalIdentifierType = "isbn" | "imdb" | "tmdb" | "tvdb" | "asin";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  title: string;
  coverUrl: string;
  progress: GroupProgress;
};

export type GroupPrivacyMode = "public" | "private";

export type GroupMembershipRole = "owner" | "admin" | "member";

export type Group = {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  activeMediaId: string;
  media: MediaItem[];
  privacyMode?: GroupPrivacyMode;
  showPostsInMainFeed?: boolean;
};

export type GroupMembership = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMembershipRole;
  createdAt: string;
  updatedAt: string;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  invitedByUserId: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InviteAcceptanceResponse = {
  status: "joined" | "auth_required";
  groupId: string;
  inviteId: string;
  expiresAt: string;
  remainingUses: number;
  redirectTo?: string;
  membership?: GroupMembership;
};

export type Post = {
  id: string;
  groupId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type UserIdentityView = {
  provider: "phone" | "google" | "email";
  subject: string;
  verified: boolean;
};

export type UserProfile = {
  id: string;
  phone?: string;
  email?: string;
  identities: UserIdentityView[];
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type UsernameAvailabilityResponse = {
  requested: string;
  normalized: string;
  available: boolean;
  reason?: "invalid" | "taken" | "reserved";
  reservedUntil?: string;
};

export type ReserveUsernameRequest = {
  username: string;
};

export type UpdateProfileRequest = {
  username?: string;
  displayName?: string;
};

export type AvatarUploadRequest = {
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  bytes: number;
  width: number;
  height: number;
};

export type AvatarUploadPlanResponse = {
  uploadId: string;
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

export type FinalizeAvatarUploadRequest = {
  uploadId: string;
  metadata: {
    width: number;
    height: number;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    bytes: number;
  };
};

export type ContentMediaItem = {
  id: string;
  kind: MediaKind;
  title: string;
  description?: string;
  author?: string;
  creator?: string;
  artworkUrl?: string;
  externalIds?: Partial<Record<ExternalIdentifierType, string>>;
  metadataCompleteness?: "complete" | "partial" | "manual";
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type MediaSearchResult = {
  media: ContentMediaItem;
  matchedOn: "title" | ExternalIdentifierType;
  query: string;
};

export type MediaSearchResponse = {
  query: string;
  results: MediaSearchResult[];
  cached: boolean;
};

export type ManualMediaEntryRequest = {
  id?: string;
  kind: MediaKind;
  title: string;
  creator?: string;
  artworkUrl?: string;
  description?: string;
  externalIds?: Partial<Record<ExternalIdentifierType, string>>;
};

export type GroupMediaNavigationResponse = {
  groupId: string;
  activeMediaId?: string;
  title?: string;
  artworkUrl?: string;
};

export type ContentMediaUnit = {
  id: string;
  mediaItemId: string;
  title?: string;
  chapterNumber?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  releaseOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupMediaSelection = {
  id: string;
  groupId: string;
  mediaItemId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserProgressState = {
  id: string;
  userId: string;
  groupId: string;
  mediaItemId: string;
  highestUnitOrder: number;
  highestUnitId?: string;
  version: number;
  updatedAt: string;
};

export type ContentPost = {
  id: string;
  groupId: string;
  mediaItemId: string;
  authorId: string;
  previewText: string;
  body: string;
  requiredUnitId: string;
  createdAt: string;
  updatedAt: string;
};

export type FeedPost = {
  postId: string;
  authorId: string;
  createdAt: string;
  previewText: string;
  unitReference: string;
  requiredUnitId: string;
  unlocked: boolean;
  body?: string;
  actions: {
    markAsRead: {
      label: "Mark as read/watched";
      style: "green-check";
      enabled: boolean;
      targetUnitId: string;
    };
  };
};

export type FeedResponse = {
  groupId: string;
  mediaItemId: string;
  progress: UserProgressState;
  posts: FeedPost[];
};

export type MarkProgressResponse = {
  progress: UserProgressState;
  unlockedPostIds: string[];
  rollback: {
    token: string;
    expiresAt: string;
  };
};

export type RollbackProgressRequest = {
  rollbackToken: string;
};

export type RollbackProgressResponse = {
  progress: UserProgressState;
  relockedPostIds: string[];
};
