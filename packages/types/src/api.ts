export type GroupProgress = {
  completed: number;
  total: number;
};

export type MediaKind = "book" | "show";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  title: string;
  coverUrl: string;
  progress: GroupProgress;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  activeMediaId: string;
  media: MediaItem[];
};

export type Post = {
  id: string;
  groupId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
