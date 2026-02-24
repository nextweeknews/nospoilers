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

