import type {
  FeedPostView,
  FeedResponse,
  GroupMediaSelection,
  MarkProgressResult,
  MediaItem,
  MediaUnit,
  Post,
  ProgressAuditEvent,
  RollbackResult,
  UserProgress
} from "./types";

const ROLLBACK_WINDOW_MS = 2 * 60 * 1000;

interface CreateMediaItemInput extends Pick<MediaItem, "kind" | "title" | "description" | "author" | "metadata"> {
  id?: string;
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

export class ContentService {
  private readonly mediaItems = new Map<string, MediaItem>();
  private readonly mediaUnits = new Map<string, MediaUnit>();
  private readonly groupMediaSelections = new Map<string, GroupMediaSelection>();
  private readonly posts = new Map<string, Post>();
  private readonly userProgress = new Map<string, UserProgress>();
  private readonly progressAuditTrail = new Map<string, ProgressAuditEvent>();

  createMediaItem(input: CreateMediaItemInput): MediaItem {
    const now = new Date().toISOString();
    const item: MediaItem = {
      id: input.id ?? `media_${this.generateId()}`,
      kind: input.kind,
      title: input.title,
      description: input.description,
      author: input.author,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };
    this.mediaItems.set(item.id, item);
    return item;
  }

  createMediaUnit(input: CreateMediaUnitInput): MediaUnit {
    if (!this.mediaItems.has(input.mediaItemId)) {
      throw new Error("Unknown media item.");
    }

    const now = new Date().toISOString();
    const unit: MediaUnit = {
      id: input.id ?? `unit_${this.generateId()}`,
      mediaItemId: input.mediaItemId,
      title: input.title,
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

    const now = new Date().toISOString();
    const post: Post = {
      id: input.id ?? `post_${this.generateId()}`,
      groupId: input.groupId,
      mediaItemId: input.mediaItemId,
      authorId: input.authorId,
      previewText: input.previewText,
      body: input.body,
      requiredUnitId: input.requiredUnitId,
      createdAt: now,
      updatedAt: now
    };

    this.posts.set(post.id, post);
    return post;
  }

  getFeedForUser(userId: string, groupId: string, mediaItemId: string): FeedResponse {
    this.assertGroupMediaSelection(groupId, mediaItemId);

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

  markAsRead(input: MarkAsReadInput): MarkProgressResult {
    this.assertGroupMediaSelection(input.groupId, input.mediaItemId);
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
      throw new Error("Rollback token is invalid.");
    }

    if (forwardAudit.rolledBackByAuditId) {
      throw new Error("Rollback token has already been used.");
    }

    const rollbackDeadline = new Date(forwardAudit.createdAt).getTime() + ROLLBACK_WINDOW_MS;
    if (Date.now() > rollbackDeadline) {
      throw new Error("Rollback window has expired.");
    }

    const key = this.progressKey(forwardAudit.userId, forwardAudit.groupId, forwardAudit.mediaItemId);
    const progress = this.userProgress.get(key);
    if (!progress || progress.version !== forwardAudit.nextVersion) {
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
