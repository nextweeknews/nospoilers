const PREVIEW_MAX_CHARS = 140;

export type SupabaseUserProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
};

export type SupabaseGroupRow = {
  id: string;
  name: string;
  description: string | null;
  avatar_path: string | null;
};

export type SupabasePostRow = {
  id: string;
  body_text: string | null;
  created_at: string;
  status: string;
  deleted_at: string | null;
  group_id: string | null;
  catalog_item_id: string | null;
};

export type PostAudienceSelection = {
  groupId: string | null;
};

export const resolveSingleGroupAudience = ({ groupId }: PostAudienceSelection): PostAudienceSelection => {
  if (!groupId) {
    return { groupId: null };
  }

  return { groupId };
};


export type SupabaseCatalogProgressUnitRow = {
  id: string;
  title: string;
};

export type SupabasePostReactionRow = {
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type SupabasePostInsert = {
  author_user_id: string;
  body_text: string;
  group_id: string | null;
  catalog_item_id: string | null;
  progress_unit_id: string | null;
  tenor_gif_id: string | null;
  tenor_gif_url: string | null;
  has_media: boolean;
  status?: string;
};

export type SupabasePostAttachmentInsert = {
  post_id: string;
  kind: "image" | "video";
  storage_path: string;
  size_bytes: number;
  sort_order: number;
};

export const mapAvatarPathToUiValue = (avatarPath?: string | null): string | undefined => {
  if (!avatarPath) {
    return undefined;
  }

  const normalized = avatarPath.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const buildPostPreviewText = (bodyText?: string | null): string | null => {
  if (!bodyText) {
    return null;
  }

  const normalized = bodyText.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > PREVIEW_MAX_CHARS
    ? `${normalized.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd()}…`
    : normalized;
};
