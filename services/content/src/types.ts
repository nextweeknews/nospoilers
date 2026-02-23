export type MediaKind = "book" | "show";

export type GroupPrivacyMode = "public" | "private";
export type GroupMembershipRole = "owner" | "admin" | "member";

export interface Group {
  id: string;
  name: string;
  privacyMode: GroupPrivacyMode;
  showPostsInMainFeed: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  invitedByUserId: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InviteAcceptanceResult {
  status: "joined" | "auth_required";
  groupId: string;
  inviteId: string;
  expiresAt: string;
  remainingUses: number;
  redirectTo?: string;
  membership?: GroupMembership;
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  description?: string;
  author?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUnit {
  id: string;
  mediaItemId: string;
  title?: string;
  chapterNumber?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  releaseOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMediaSelection {
  id: string;
  groupId: string;
  mediaItemId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProgress {
  id: string;
  userId: string;
  groupId: string;
  mediaItemId: string;
  highestUnitOrder: number;
  highestUnitId?: string;
  version: number;
  updatedAt: string;
}

export interface Post {
  id: string;
  groupId: string;
  mediaItemId: string;
  authorId: string;
  previewText: string;
  body: string;
  requiredUnitId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressAuditEvent {
  id: string;
  userId: string;
  groupId: string;
  mediaItemId: string;
  previousUnitOrder: number;
  previousUnitId?: string;
  nextUnitOrder: number;
  nextUnitId?: string;
  previousVersion: number;
  nextVersion: number;
  reason: "mark_read" | "rollback";
  rollbackOfAuditId?: string;
  rollbackToken?: string;
  rolledBackByAuditId?: string;
  createdAt: string;
}

export interface FeedPostView {
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
}

export interface FeedResponse {
  groupId: string;
  mediaItemId: string;
  progress: UserProgress;
  posts: FeedPostView[];
}

export interface MainFeedPostView extends FeedPostView {
  groupId: string;
  mediaItemId: string;
}

export interface MainFeedResponse {
  posts: MainFeedPostView[];
}

export interface MarkProgressResult {
  progress: UserProgress;
  unlockedPostIds: string[];
  rollback: {
    token: string;
    expiresAt: string;
  };
}

export interface RollbackResult {
  progress: UserProgress;
  relockedPostIds: string[];
}
