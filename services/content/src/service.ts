import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  FeedPostView,
  FeedResponse,
  Group,
  GroupInvite,
  GroupMediaSelection,
  GroupMembership,
  GroupMembershipRole,
  GroupPrivacyMode,
  InviteAcceptanceResult,
  MainFeedPostView,
  MainFeedResponse,
  MarkProgressResult,
  MediaItem,
  MediaSearchResponse,
  MediaSearchResult,
  MediaUnit,
  Post,
  ProgressAuditEvent,
  RollbackResult,
  UserProgress,
  ExternalIdentifierType,
  GroupMediaNavigationPayload
} from "./types";

const ROLLBACK_WINDOW_MS = 2 * 60 * 1000;
const INVITE_WINDOW_MS = 10 * 60 * 1000;
const INVITE_MAX_PER_WINDOW = 5;

export interface ContentAuditEvent {
  id: string;
  eventType: "invite_acceptance" | "privacy_change" | "progress_rollback";
  actorUserId?: string;
  groupId?: string;
  targetId?: string;
  status: "success" | "failure";
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

interface InviteThrottleState {
  count: number;
  windowStartedAtMs: number;
}

interface CreateGroupInput {
  name: string;
  createdByUserId: string;
  privacyMode: GroupPrivacyMode;
  showPostsInMainFeed?: boolean;
  id?: string;
}

interface CreateGroupInviteInput {
  groupId: string;
  invitedByUserId: string;
  expiresInMs: number;
  maxUses?: number;
}

interface CreateMediaItemInput extends Pick<MediaItem, "kind" | "title" | "description" | "author" | "metadata" | "artworkUrl" | "creator" | "metadataCompleteness"> {
  id?: string;
  externalIds?: Partial<Record<ExternalIdentifierType, string>>;
}

interface UpsertManualMediaItemInput {
  id?: string;
  kind: MediaItem["kind"];
  title: string;
  creator?: string;
  artworkUrl?: string;
  description?: string;
  externalIds?: Partial<Record<ExternalIdentifierType, string>>;
}

interface CreateMediaUnitInput extends Pick<MediaUnit, "mediaItemId" | "title" | "chapterNumber" | "seasonNumber" | "episodeNumber" | "releaseOrder"> {
  id?: string;
}

interface CreateGroupMediaSelectionInput extends Pick<GroupMediaSelection, "groupId" | "mediaItemId" | "isActive"> {
  id?: string;
}

interface CreatePostInput extends Pick<Post, "groupId" | "mediaItemId" | "authorId" | "previewText" | "body" | "requiredUnitId"> {
  id?: string;
}

interface MarkAsReadInput {
  userId: string;
  groupId: string;
  mediaItemId: string;
  unitId: string;
}

interface RollbackInput {
  userId: string;
  rollbackToken: string;
}

interface AcceptInviteInput {
  inviteToken: string;
  userId?: string;
}

export class ContentService {
  private readonly groups = new Map<string, Group>();
  private readonly groupMemberships = new Map<string, GroupMembership>();
  private readonly groupInvites = new Map<string, GroupInvite>();
  private readonly mediaItems = new Map<string, MediaItem>();
  private readonly mediaSearchCache = new Map<string, MediaSearchResponse>();
  private readonly mediaSearchPopularity = new Map<string, number>();
  private readonly mediaUnits = new Map<string, MediaUnit>();
  private readonly groupMediaSelections = new Map<string, GroupMediaSelection>();
  private readonly posts = new Map<string, Post>();
  private readonly userProgress = new Map<string, UserProgress>();
  private readonly progressAuditTrail = new Map<string, ProgressAuditEvent>();
  private readonly inviteThrottle = new Map<string, InviteThrottleState>();
  private readonly suspiciousActivity = new Map<string, { score: number; reason: string; lastObservedAt: string }>();
  private readonly auditEvents: ContentAuditEvent[] = [];

  constructor(private readonly inviteSigningSecret: string = "nospoilers-dev-content-secret") {}

  createGroup(input: CreateGroupInput): Group {
    const now = new Date().toISOString();
    const group: Group = {
      id: input.id ?? `group_${this.generateId()}`,
      name: input.name,
      createdByUserId: input.createdByUserId,
      privacyMode: input.privacyMode,
      showPostsInMainFeed: input.showPostsInMainFeed ?? false,
      createdAt: now,
      updatedAt: now
    };

    this.groups.set(group.id, group);
    this.upsertMembership(group.id, input.createdByUserId, "owner");
    return group;
  }

  setGroupMainFeedVisibility(groupId: string, showPostsInMainFeed: boolean, actingUserId: string): Group {
    const group = this.requireGroup(groupId);
    this.assertHasGroupRole(actingUserId, groupId, ["owner", "admin"]);

    const previous = group.showPostsInMainFeed;
    group.showPostsInMainFeed = showPostsInMainFeed;
    group.updatedAt = new Date().toISOString();
    this.groups.set(group.id, group);
    this.logAudit({
      eventType: "privacy_change",
      actorUserId: actingUserId,
      groupId,
      status: "success",
      metadata: { previousShowPostsInMainFeed: previous, nextShowPostsInMainFeed: showPostsInMainFeed }
    });
    return group;
  }

  addGroupMember(groupId: string, userId: string, role: GroupMembershipRole, actingUserId: string): GroupMembership {
    this.requireGroup(groupId);
    this.assertHasGroupRole(actingUserId, groupId, ["owner", "admin"]);
    return this.upsertMembership(groupId, userId, role);
  }

  createInviteLink(input: CreateGroupInviteInput): { invite: GroupInvite; inviteToken: string } {
    this.requireGroup(input.groupId);
    this.assertHasGroupRole(input.invitedByUserId, input.groupId, ["owner", "admin"]);
    this.assertInviteThrottle(input.invitedByUserId);

    if (!Number.isFinite(input.expiresInMs) || input.expiresInMs <= 0) {
      throw new Error("Invite expiration must be a positive duration.");
    }

    const maxUses = input.maxUses ?? 1;
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      throw new Error("Invite max uses must be a positive integer.");
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + input.expiresInMs).toISOString();
    const invite: GroupInvite = {
      id: `invite_${this.generateId()}`,
      groupId: input.groupId,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
      maxUses,
      useCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.groupInvites.set(invite.id, invite);

    const payload = {
      inviteId: invite.id,
      groupId: invite.groupId,
      exp: new Date(invite.expiresAt).getTime(),
      nonce: this.generateId()
    };

    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.signInvitePayload(encodedPayload);
    return { invite, inviteToken: `${encodedPayload}.${signature}` };
  }

  acceptInvite(input: AcceptInviteInput): InviteAcceptanceResult {
    let payload: { inviteId: string; groupId: string; exp: number; nonce: string };
    try {
      payload = this.verifyInviteToken(input.inviteToken);
    } catch (error) {
      this.recordSuspicious("invite_token_invalid", "invite_token_invalid");
      this.logAudit({ eventType: "invite_acceptance", status: "failure", metadata: { reason: "invalid_token" } });
      throw error;
    }
    const invite = this.groupInvites.get(payload.inviteId);
    if (!invite || invite.groupId !== payload.groupId) {
      this.recordSuspicious(`invite_missing:${payload.inviteId}`, "invite_missing");
      this.logAudit({
        eventType: "invite_acceptance",
        actorUserId: input.userId,
        groupId: payload.groupId,
        targetId: payload.inviteId,
        status: "failure",
        metadata: { reason: "invalid_invite" }
      });
      throw new Error("Invite is invalid.");
    }

    if (Date.now() > payload.exp || Date.now() > new Date(invite.expiresAt).getTime()) {
      this.logAudit({
        eventType: "invite_acceptance",
        actorUserId: input.userId,
        groupId: invite.groupId,
        targetId: invite.id,
        status: "failure",
        metadata: { reason: "expired" }
      });
      throw new Error("Invite has expired.");
    }

    if (invite.useCount >= invite.maxUses) {
      this.recordSuspicious(`invite_overuse:${invite.id}`, "invite_overuse");
      this.logAudit({
        eventType: "invite_acceptance",
        actorUserId: input.userId,
        groupId: invite.groupId,
        targetId: invite.id,
        status: "failure",
        metadata: { reason: "max_uses" }
      });
      throw new Error("Invite has reached its maximum number of uses.");
    }

    if (!input.userId) {
      this.logAudit({
        eventType: "invite_acceptance",
        groupId: invite.groupId,
        targetId: invite.id,
        status: "failure",
        metadata: { reason: "auth_required" }
      });
      return {
        status: "auth_required",
        groupId: invite.groupId,
        inviteId: invite.id,
        expiresAt: invite.expiresAt,
        remainingUses: Math.max(0, invite.maxUses - invite.useCount),
        redirectTo: `/auth?invite=${encodeURIComponent(input.inviteToken)}`
      };
    }

    const existing = this.getMembership(input.userId, invite.groupId);
    if (existing) {
      this.logAudit({
        eventType: "invite_acceptance",
        actorUserId: input.userId,
        groupId: invite.groupId,
        targetId: invite.id,
        status: "success",
        metadata: { alreadyMember: true }
      });
      return {
        status: "joined",
        groupId: invite.groupId,
        inviteId: invite.id,
        expiresAt: invite.expiresAt,
        remainingUses: Math.max(0, invite.maxUses - invite.useCount),
        membership: existing
      };
    }

    invite.useCount += 1;
    invite.updatedAt = new Date().toISOString();
    this.groupInvites.set(invite.id, invite);

    const membership = this.upsertMembership(invite.groupId, input.userId, "member");
    this.logAudit({
      eventType: "invite_acceptance",
      actorUserId: input.userId,
      groupId: invite.groupId,
      targetId: invite.id,
      status: "success",
      metadata: { alreadyMember: false }
    });
    return {
      status: "joined",
      groupId: invite.groupId,
      inviteId: invite.id,
      expiresAt: invite.expiresAt,
      remainingUses: Math.max(0, invite.maxUses - invite.useCount),
      membership
    };
  }

  createMediaItem(input: CreateMediaItemInput): MediaItem {
    this.validateRequiredText("Media title", input.title, 160);
    const now = new Date().toISOString();
    const item: MediaItem = {
      id: input.id ?? `media_${this.generateId()}`,
      kind: input.kind,
      title: this.sanitizeAndEncode(input.title, 160),
      description: this.sanitizeOptionalText(input.description, 4000),
      author: this.sanitizeOptionalText(input.author, 120),
      creator: this.sanitizeOptionalText(input.creator ?? input.author, 120),
      artworkUrl: input.artworkUrl,
      externalIds: this.normalizeExternalIdentifiers(input.externalIds),
      metadataCompleteness: input.metadataCompleteness ?? "complete",
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };
    this.mediaItems.set(item.id, item);
    this.clearSearchCache();
    return item;
  }

  upsertManualMediaItem(input: UpsertManualMediaItemInput): MediaItem {
    if (input.id) {
      const existing = this.mediaItems.get(input.id);
      if (!existing) {
        throw new Error("Manual media item could not be found.");
      }

      existing.kind = input.kind;
      this.validateRequiredText("Media title", input.title, 160);
      existing.title = this.sanitizeAndEncode(input.title, 160);
      existing.creator = this.sanitizeOptionalText(input.creator, 120);
      existing.author = existing.creator;
      existing.artworkUrl = input.artworkUrl?.trim();
      existing.description = this.sanitizeOptionalText(input.description, 4000);
      existing.externalIds = this.normalizeExternalIdentifiers(input.externalIds ?? existing.externalIds);
      existing.metadataCompleteness = "manual";
      existing.updatedAt = new Date().toISOString();
      this.mediaItems.set(existing.id, existing);
      this.clearSearchCache();
      return existing;
    }

    return this.createMediaItem({
      kind: input.kind,
      title: this.sanitizeAndEncode(input.title, 160),
      author: this.sanitizeOptionalText(input.creator, 120),
      creator: this.sanitizeOptionalText(input.creator, 120),
      artworkUrl: input.artworkUrl?.trim(),
      description: this.sanitizeOptionalText(input.description, 4000),
      externalIds: input.externalIds,
      metadataCompleteness: "manual"
    });
  }

  searchMedia(query: string): MediaSearchResponse {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return { query, results: [], cached: false };
    }

    const cached = this.mediaSearchCache.get(normalizedQuery);
    if (cached) {
      this.bumpSearchPopularity(normalizedQuery);
      return { ...cached, cached: true };
    }

    const parsedIdentifier = this.parseIdentifierQuery(normalizedQuery);
    const results: MediaSearchResult[] = [];

    for (const media of this.mediaItems.values()) {
      if (parsedIdentifier) {
        const candidate = media.externalIds?.[parsedIdentifier.type];
        if (candidate && candidate === parsedIdentifier.value) {
          results.push({ media, matchedOn: parsedIdentifier.type, query });
        }
        continue;
      }

      const titleMatch = media.title.toLowerCase().includes(normalizedQuery);
      if (titleMatch) {
        results.push({ media, matchedOn: "title", query });
      }
    }

    const response: MediaSearchResponse = {
      query,
      results: results.sort((a, b) => a.media.title.localeCompare(b.media.title)),
      cached: false
    };

    this.mediaSearchCache.set(normalizedQuery, response);
    this.bumpSearchPopularity(normalizedQuery);
    this.trimSearchCache();
    return response;
  }

  getPopularMediaQueries(limit = 10): Array<{ query: string; count: number }> {
    return Array.from(this.mediaSearchPopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([queryKey, count]) => ({ query: queryKey, count }));
  }

  getGroupMediaNavigation(groupId: string): GroupMediaNavigationPayload {
    this.requireGroup(groupId);

    const activeSelection = Array.from(this.groupMediaSelections.values()).find(
      (selection) => selection.groupId === groupId && selection.isActive
    );

    if (!activeSelection) {
      return { groupId };
    }

    const media = this.mediaItems.get(activeSelection.mediaItemId);
    return {
      groupId,
      activeMediaId: activeSelection.mediaItemId,
      title: media?.title,
      artworkUrl: media?.artworkUrl
    };
  }

  createMediaUnit(input: CreateMediaUnitInput): MediaUnit {
    if (!this.mediaItems.has(input.mediaItemId)) {
      throw new Error("Unknown media item.");
    }

    this.validateRequiredText("Unit title", input.title, 160);
    const now = new Date().toISOString();
    const unit: MediaUnit = {
      id: input.id ?? `unit_${this.generateId()}`,
      mediaItemId: input.mediaItemId,
      title: this.sanitizeAndEncode(input.title, 160),
      chapterNumber: input.chapterNumber,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      releaseOrder: input.releaseOrder,
      createdAt: now,
      updatedAt: now
    };

    this.mediaUnits.set(unit.id, unit);
    return unit;
  }

  selectGroupMedia(input: CreateGroupMediaSelectionInput): GroupMediaSelection {
    if (!this.mediaItems.has(input.mediaItemId)) {
      throw new Error("Unknown media item.");
    }
    this.requireGroup(input.groupId);

    const now = new Date().toISOString();
    const selection: GroupMediaSelection = {
      id: input.id ?? `selection_${this.generateId()}`,
      groupId: input.groupId,
      mediaItemId: input.mediaItemId,
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now
    };

    if (selection.isActive) {
      for (const existing of this.groupMediaSelections.values()) {
        if (existing.groupId === selection.groupId && existing.isActive) {
          existing.isActive = false;
          existing.updatedAt = now;
          this.groupMediaSelections.set(existing.id, existing);
        }
      }
    }

    this.groupMediaSelections.set(selection.id, selection);
    return selection;
  }

  createPost(input: CreatePostInput): Post {
    this.assertIsGroupMember(input.authorId, input.groupId);

    const requiredUnit = this.mediaUnits.get(input.requiredUnitId);
    if (!requiredUnit || requiredUnit.mediaItemId !== input.mediaItemId) {
      throw new Error("Post required unit is invalid for selected media.");
    }

    const selectionExists = Array.from(this.groupMediaSelections.values()).some(
      (selection) => selection.groupId === input.groupId && selection.mediaItemId === input.mediaItemId
    );
    if (!selectionExists) {
      throw new Error("Group media selection does not exist.");
    }

    this.validateRequiredText("Post preview", input.previewText, 280);
    this.validateRequiredText("Post body", input.body, 8000);
    const now = new Date().toISOString();
    const post: Post = {
      id: input.id ?? `post_${this.generateId()}`,
      groupId: input.groupId,
      mediaItemId: input.mediaItemId,
      authorId: input.authorId,
      previewText: this.sanitizeAndEncode(input.previewText, 280),
      body: this.sanitizeAndEncode(input.body, 8000),
      requiredUnitId: input.requiredUnitId,
      createdAt: now,
      updatedAt: now
    };

    this.posts.set(post.id, post);
    return post;
  }

  getFeedForUser(userId: string, groupId: string, mediaItemId: string): FeedResponse {
    this.assertGroupMediaSelection(groupId, mediaItemId);
    this.assertCanViewGroup(userId, groupId);

    const progress = this.getOrCreateProgress(userId, groupId, mediaItemId);
    const posts = Array.from(this.posts.values())
      .filter((post) => post.groupId === groupId && post.mediaItemId === mediaItemId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((post) => this.toFeedPost(post, progress));

    return {
      groupId,
      mediaItemId,
      progress,
      posts
    };
  }

  getMainFeedForUser(userId: string): MainFeedResponse {
    const posts: MainFeedPostView[] = [];

    for (const post of this.posts.values()) {
      const group = this.groups.get(post.groupId);
      if (!group || group.privacyMode === "private" || !group.showPostsInMainFeed) {
        continue;
      }

      const progress = this.getOrCreateProgress(userId, post.groupId, post.mediaItemId);
      posts.push({
        groupId: post.groupId,
        mediaItemId: post.mediaItemId,
        ...this.toFeedPost(post, progress)
      });
    }

    posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { posts };
  }

  markAsRead(input: MarkAsReadInput): MarkProgressResult {
    this.assertGroupMediaSelection(input.groupId, input.mediaItemId);
    this.assertCanViewGroup(input.userId, input.groupId);
    const targetUnit = this.requireUnit(input.unitId, input.mediaItemId);
    const progress = this.getOrCreateProgress(input.userId, input.groupId, input.mediaItemId);

    if (targetUnit.releaseOrder <= progress.highestUnitOrder) {
      return {
        progress,
        unlockedPostIds: this.findUnlockedPostIds(input.groupId, input.mediaItemId, progress.highestUnitOrder),
        rollback: {
          token: "",
          expiresAt: new Date().toISOString()
        }
      };
    }

    const previous = { ...progress };
    progress.highestUnitOrder = targetUnit.releaseOrder;
    progress.highestUnitId = targetUnit.id;
    progress.version += 1;
    progress.updatedAt = new Date().toISOString();

    const key = this.progressKey(input.userId, input.groupId, input.mediaItemId);
    this.userProgress.set(key, progress);

    const auditId = `audit_${this.generateId()}`;
    const rollbackToken = `rollback_${this.generateId()}`;
    const audit: ProgressAuditEvent = {
      id: auditId,
      userId: input.userId,
      groupId: input.groupId,
      mediaItemId: input.mediaItemId,
      previousUnitOrder: previous.highestUnitOrder,
      previousUnitId: previous.highestUnitId,
      nextUnitOrder: progress.highestUnitOrder,
      nextUnitId: progress.highestUnitId,
      previousVersion: previous.version,
      nextVersion: progress.version,
      reason: "mark_read",
      rollbackToken,
      createdAt: progress.updatedAt
    };

    this.progressAuditTrail.set(auditId, audit);

    return {
      progress,
      unlockedPostIds: this.findUnlockedPostIds(input.groupId, input.mediaItemId, progress.highestUnitOrder),
      rollback: {
        token: rollbackToken,
        expiresAt: new Date(Date.now() + ROLLBACK_WINDOW_MS).toISOString()
      }
    };
  }

  rollbackProgress(input: RollbackInput): RollbackResult {
    const forwardAudit = Array.from(this.progressAuditTrail.values()).find(
      (audit) => audit.rollbackToken === input.rollbackToken && audit.userId === input.userId
    );

    if (!forwardAudit) {
      this.logAudit({ eventType: "progress_rollback", actorUserId: input.userId, status: "failure", metadata: { reason: "invalid_token" } });
      throw new Error("Rollback token is invalid.");
    }

    if (forwardAudit.rolledBackByAuditId) {
      this.logAudit({
        eventType: "progress_rollback",
        actorUserId: input.userId,
        groupId: forwardAudit.groupId,
        targetId: forwardAudit.id,
        status: "failure",
        metadata: { reason: "already_used" }
      });
      throw new Error("Rollback token has already been used.");
    }

    const rollbackDeadline = new Date(forwardAudit.createdAt).getTime() + ROLLBACK_WINDOW_MS;
    if (Date.now() > rollbackDeadline) {
      this.logAudit({
        eventType: "progress_rollback",
        actorUserId: input.userId,
        groupId: forwardAudit.groupId,
        targetId: forwardAudit.id,
        status: "failure",
        metadata: { reason: "expired" }
      });
      throw new Error("Rollback window has expired.");
    }

    const key = this.progressKey(forwardAudit.userId, forwardAudit.groupId, forwardAudit.mediaItemId);
    const progress = this.userProgress.get(key);
    if (!progress || progress.version !== forwardAudit.nextVersion) {
      this.logAudit({
        eventType: "progress_rollback",
        actorUserId: input.userId,
        groupId: forwardAudit.groupId,
        targetId: forwardAudit.id,
        status: "failure",
        metadata: { reason: "version_mismatch" }
      });
      throw new Error("Progress changed after this update; rollback denied for correctness.");
    }

    progress.highestUnitOrder = forwardAudit.previousUnitOrder;
    progress.highestUnitId = forwardAudit.previousUnitId;
    progress.version += 1;
    progress.updatedAt = new Date().toISOString();
    this.userProgress.set(key, progress);

    const rollbackAuditId = `audit_${this.generateId()}`;
    const rollbackAudit: ProgressAuditEvent = {
      id: rollbackAuditId,
      userId: progress.userId,
      groupId: progress.groupId,
      mediaItemId: progress.mediaItemId,
      previousUnitOrder: forwardAudit.nextUnitOrder,
      previousUnitId: forwardAudit.nextUnitId,
      nextUnitOrder: progress.highestUnitOrder,
      nextUnitId: progress.highestUnitId,
      previousVersion: forwardAudit.nextVersion,
      nextVersion: progress.version,
      reason: "rollback",
      rollbackOfAuditId: forwardAudit.id,
      createdAt: progress.updatedAt
    };

    forwardAudit.rolledBackByAuditId = rollbackAudit.id;
    this.progressAuditTrail.set(forwardAudit.id, forwardAudit);
    this.progressAuditTrail.set(rollbackAudit.id, rollbackAudit);
    this.logAudit({
      eventType: "progress_rollback",
      actorUserId: input.userId,
      groupId: forwardAudit.groupId,
      targetId: forwardAudit.id,
      status: "success"
    });

    return {
      progress,
      relockedPostIds: this.findRelockedPostIds(progress.groupId, progress.mediaItemId, progress.highestUnitOrder)
    };
  }

  getProgressAuditTrail(userId: string, groupId: string, mediaItemId: string): ProgressAuditEvent[] {
    return Array.from(this.progressAuditTrail.values())
      .filter((event) => event.userId === userId && event.groupId === groupId && event.mediaItemId === mediaItemId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  getContentAuditEvents(limit = 250): ContentAuditEvent[] {
    return this.auditEvents.slice(-Math.max(1, limit));
  }

  getSuspiciousActivity(limit = 100): Array<{ key: string; score: number; reason: string; lastObservedAt: string }> {
    return Array.from(this.suspiciousActivity.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => (a.lastObservedAt < b.lastObservedAt ? 1 : -1))
      .slice(0, Math.max(1, limit));
  }

  private toFeedPost(post: Post, progress: UserProgress): FeedPostView {
    const requiredUnit = this.requireUnit(post.requiredUnitId, post.mediaItemId);
    const unlocked = progress.highestUnitOrder >= requiredUnit.releaseOrder;

    return {
      postId: post.id,
      authorId: post.authorId,
      createdAt: post.createdAt,
      previewText: post.previewText,
      unitReference: this.formatUnitReference(requiredUnit),
      requiredUnitId: requiredUnit.id,
      unlocked,
      body: unlocked ? post.body : undefined,
      actions: {
        markAsRead: {
          label: "Mark as read/watched",
          style: "green-check",
          enabled: !unlocked,
          targetUnitId: requiredUnit.id
        }
      }
    };
  }

  private formatUnitReference(unit: MediaUnit): string {
    if (typeof unit.seasonNumber === "number" && typeof unit.episodeNumber === "number") {
      return `S${unit.seasonNumber}E${unit.episodeNumber}`;
    }
    if (typeof unit.chapterNumber === "number") {
      return `Chapter ${unit.chapterNumber}`;
    }
    return `Unit ${unit.releaseOrder}`;
  }

  private findUnlockedPostIds(groupId: string, mediaItemId: string, highestUnitOrder: number): string[] {
    return Array.from(this.posts.values())
      .filter((post) => post.groupId === groupId && post.mediaItemId === mediaItemId)
      .filter((post) => this.requireUnit(post.requiredUnitId, mediaItemId).releaseOrder <= highestUnitOrder)
      .map((post) => post.id);
  }

  private findRelockedPostIds(groupId: string, mediaItemId: string, highestUnitOrder: number): string[] {
    return Array.from(this.posts.values())
      .filter((post) => post.groupId === groupId && post.mediaItemId === mediaItemId)
      .filter((post) => this.requireUnit(post.requiredUnitId, mediaItemId).releaseOrder > highestUnitOrder)
      .map((post) => post.id);
  }

  private normalizeExternalIdentifiers(
    externalIds?: Partial<Record<ExternalIdentifierType, string>>
  ): Partial<Record<ExternalIdentifierType, string>> | undefined {
    if (!externalIds) {
      return undefined;
    }

    const normalized: Partial<Record<ExternalIdentifierType, string>> = {};
    for (const [rawType, rawValue] of Object.entries(externalIds)) {
      const type = rawType as ExternalIdentifierType;
      const value = rawValue?.trim();
      if (!value) {
        continue;
      }

      if (type === "isbn") {
        const isbn = value.replace(/[^0-9X]/gi, "").toUpperCase();
        if (isbn) normalized.isbn = isbn;
        continue;
      }

      if (type === "imdb") {
        const match = value.toLowerCase().match(/tt\d+/);
        if (match) normalized.imdb = match[0];
        continue;
      }

      normalized[type] = value.toLowerCase();
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private parseIdentifierQuery(query: string): { type: ExternalIdentifierType; value: string } | undefined {
    const isbn = query.replace(/[^0-9X]/gi, "").toUpperCase();
    if (isbn.length === 10 || isbn.length === 13) {
      return { type: "isbn", value: isbn };
    }

    const imdbMatch = query.match(/tt\d+/i);
    if (imdbMatch) {
      return { type: "imdb", value: imdbMatch[0].toLowerCase() };
    }

    return undefined;
  }

  private bumpSearchPopularity(query: string): void {
    const current = this.mediaSearchPopularity.get(query) ?? 0;
    this.mediaSearchPopularity.set(query, current + 1);
  }

  private clearSearchCache(): void {
    this.mediaSearchCache.clear();
  }

  private trimSearchCache(maxEntries = 100): void {
    if (this.mediaSearchCache.size <= maxEntries) {
      return;
    }

    const staleKeys = Array.from(this.mediaSearchCache.keys()).slice(0, this.mediaSearchCache.size - maxEntries);
    for (const key of staleKeys) {
      this.mediaSearchCache.delete(key);
    }
  }


  private validateRequiredText(field: string, value: string | undefined, maxLength: number): void {
    const normalized = value?.trim();
    if (!normalized) {
      throw new Error(`${field} is required.`);
    }
    if (normalized.length > maxLength) {
      throw new Error(`${field} exceeds max length of ${maxLength}.`);
    }
  }

  private sanitizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
    if (!value) {
      return undefined;
    }

    const sanitized = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
    return sanitized ? this.encodeForOutput(sanitized) : undefined;
  }

  private sanitizeAndEncode(value: string, maxLength: number): string {
    const sanitized = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
    return this.encodeForOutput(sanitized);
  }

  private encodeForOutput(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private assertInviteThrottle(userId: string): void {
    const now = Date.now();
    const existing = this.inviteThrottle.get(userId);
    if (!existing) {
      this.inviteThrottle.set(userId, { count: 1, windowStartedAtMs: now });
      return;
    }

    if (now - existing.windowStartedAtMs > INVITE_WINDOW_MS) {
      this.inviteThrottle.set(userId, { count: 1, windowStartedAtMs: now });
      return;
    }

    existing.count += 1;
    this.inviteThrottle.set(userId, existing);
    if (existing.count > INVITE_MAX_PER_WINDOW) {
      this.recordSuspicious(`invite_spam:${userId}`, "invite_spam");
      throw new Error("Invite creation rate exceeded. Please wait before sending more invites.");
    }
  }

  private recordSuspicious(key: string, reason: string): void {
    const current = this.suspiciousActivity.get(key);
    this.suspiciousActivity.set(key, {
      score: (current?.score ?? 0) + 1,
      reason,
      lastObservedAt: new Date().toISOString()
    });
  }

  private logAudit(event: Omit<ContentAuditEvent, "id" | "createdAt">): void {
    this.auditEvents.push({
      id: `audit_${this.generateId()}`,
      createdAt: new Date().toISOString(),
      ...event
    });

    if (this.auditEvents.length > 2000) {
      this.auditEvents.shift();
    }
  }

  private requireUnit(unitId: string, expectedMediaItemId: string): MediaUnit {
    const unit = this.mediaUnits.get(unitId);
    if (!unit || unit.mediaItemId !== expectedMediaItemId) {
      throw new Error("Media unit was not found.");
    }
    return unit;
  }

  private assertGroupMediaSelection(groupId: string, mediaItemId: string): void {
    const valid = Array.from(this.groupMediaSelections.values()).some(
      (selection) => selection.groupId === groupId && selection.mediaItemId === mediaItemId
    );

    if (!valid) {
      throw new Error("Group does not have this media selected.");
    }
  }

  private assertCanViewGroup(userId: string, groupId: string): void {
    const group = this.requireGroup(groupId);
    if (group.privacyMode === "public") {
      return;
    }

    this.assertIsGroupMember(userId, groupId);
  }

  private assertIsGroupMember(userId: string, groupId: string): void {
    const membership = this.getMembership(userId, groupId);
    if (!membership) {
      throw new Error("User is not a group member.");
    }
  }

  private assertHasGroupRole(userId: string, groupId: string, roles: GroupMembershipRole[]): void {
    const membership = this.getMembership(userId, groupId);
    if (!membership || !roles.includes(membership.role)) {
      throw new Error("User lacks required group role.");
    }
  }

  private getMembership(userId: string, groupId: string): GroupMembership | undefined {
    return Array.from(this.groupMemberships.values()).find((membership) => membership.userId === userId && membership.groupId === groupId);
  }

  private upsertMembership(groupId: string, userId: string, role: GroupMembershipRole): GroupMembership {
    const existing = this.getMembership(userId, groupId);
    const now = new Date().toISOString();

    if (existing) {
      existing.role = role;
      existing.updatedAt = now;
      this.groupMemberships.set(existing.id, existing);
      return existing;
    }

    const membership: GroupMembership = {
      id: `membership_${this.generateId()}`,
      groupId,
      userId,
      role,
      createdAt: now,
      updatedAt: now
    };

    this.groupMemberships.set(membership.id, membership);
    return membership;
  }

  private requireGroup(groupId: string): Group {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error("Group was not found.");
    }
    return group;
  }

  private verifyInviteToken(token: string): { inviteId: string; groupId: string; exp: number; nonce: string } {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      throw new Error("Invite token is malformed.");
    }

    const expectedSignature = this.signInvitePayload(encodedPayload);
    if (!this.timingSafeEqual(signature, expectedSignature)) {
      throw new Error("Invite token signature is invalid.");
    }

    const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as { inviteId: string; groupId: string; exp: number; nonce: string };
    if (!payload.inviteId || !payload.groupId || !Number.isFinite(payload.exp)) {
      throw new Error("Invite token payload is invalid.");
    }

    return payload;
  }

  private signInvitePayload(encodedPayload: string): string {
    return createHmac("sha256", this.inviteSigningSecret).update(encodedPayload).digest("base64url");
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const first = Buffer.from(a);
    const second = Buffer.from(b);
    if (first.length !== second.length) {
      return false;
    }
    return timingSafeEqual(first, second);
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private base64UrlDecode(value: string): string {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private getOrCreateProgress(userId: string, groupId: string, mediaItemId: string): UserProgress {
    const key = this.progressKey(userId, groupId, mediaItemId);
    const existing = this.userProgress.get(key);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const created: UserProgress = {
      id: `progress_${this.generateId()}`,
      userId,
      groupId,
      mediaItemId,
      highestUnitOrder: 0,
      version: 0,
      updatedAt: now
    };

    this.userProgress.set(key, created);
    return created;
  }

  private generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private progressKey(userId: string, groupId: string, mediaItemId: string): string {
    return `${userId}:${groupId}:${mediaItemId}`;
  }
}
