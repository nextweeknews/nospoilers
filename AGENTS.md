Include detailed but plain-language comments within the codebase when adding or changing sections.
Generated summaries should include plain-language descriptions of the additions or changes.

# Where possible, use Radix Themes for styling:
- Radix Themes (@radix-ui/themes) is an open-source React component library optimized for fast development, easy maintenance, and accessibility. It provides a comprehensive set of pre-styled, themeable UI components built on top of Radix Primitives.
- License: MIT
- Documentation: https://www.radix-ui.com/themes/docs/theme

The full docs for this project are hosted at:
- Theme overview: https://www.radix-ui.com/themes/docs/theme/overview
- Component docs: https://www.radix-ui.com/themes/docs/components (e.g., .../components/button, .../components/dialog)
- Utilities: https://www.radix-ui.com/themes/docs/utilities/box
- Releases: https://www.radix-ui.com/themes/docs/overview/releases
- When referenced, Radix icons refer to this collection: https://www.radix-ui.com/icons
- A select number of Radix primitives have been added as styles:
-   Accordion: https://www.radix-ui.com/primitives/docs/components/accordion
- When you need to understand a component's API, intended behavior, or usage patterns, consult the docs at the URLs above rather than guessing.


# Here is the Supabase SQL schema for this project:
```
CREATE TABLE public.catalog_item_aliases (
  catalog_item_id bigint NOT NULL,
  alias text NOT NULL,
  alias_type text NOT NULL DEFAULT 'alternate'::text CHECK (alias_type = ANY (ARRAY['alternate'::text, 'abbreviation'::text, 'localized'::text])),
  search_alias text,
  search_document tsvector,
  CONSTRAINT catalog_item_aliases_pkey PRIMARY KEY (catalog_item_id, alias),
  CONSTRAINT catalog_item_aliases_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id)
);
CREATE TABLE public.catalog_item_group_add_counts (
  catalog_item_id bigint NOT NULL,
  active_group_add_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT catalog_item_group_add_counts_pkey PRIMARY KEY (catalog_item_id),
  CONSTRAINT catalog_item_group_add_counts_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id)
);
CREATE TABLE public.catalog_item_user_add_counts (
  catalog_item_id bigint NOT NULL,
  user_add_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT catalog_item_user_add_counts_pkey PRIMARY KEY (catalog_item_id),
  CONSTRAINT catalog_item_user_add_counts_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id)
);
CREATE TABLE public.catalog_items (
  id bigint NOT NULL DEFAULT nextval('catalog_items_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  item_type text NOT NULL CHECK (item_type = ANY (ARRAY['book'::text, 'tv_show'::text])),
  title text NOT NULL,
  canonical_title text,
  release_year integer,
  cover_image_url text,
  metadata_source text CHECK (metadata_source = ANY (ARRAY['tmdb'::text, 'tvmaze'::text, 'openlibrary'::text, 'google_books'::text, 'manual'::text])),
  source_id text,
  source_url text,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_title text,
  search_document tsvector,
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  public_id bigint NOT NULL DEFAULT next_public_snowflake_id(),
  CONSTRAINT catalog_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.catalog_progress_units (
  id bigint NOT NULL DEFAULT nextval('catalog_progress_units_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  catalog_item_id bigint NOT NULL,
  unit_type text NOT NULL CHECK (unit_type = ANY (ARRAY['chapter'::text, 'episode'::text])),
  volume_number integer,
  chapter_number integer,
  season_number integer,
  episode_number integer,
  title text,
  sequence_index integer NOT NULL CHECK (sequence_index >= 0),
  CONSTRAINT catalog_progress_units_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_progress_units_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id)
);
CREATE TABLE public.catalog_source_mappings (
  catalog_item_id bigint NOT NULL,
  item_type text NOT NULL CHECK (item_type = ANY (ARRAY['book'::text, 'tv_show'::text])),
  source_name text NOT NULL CHECK (source_name = ANY (ARRAY['tmdb'::text, 'tvmaze'::text, 'openlibrary'::text, 'google_books'::text, 'manual'::text])),
  source_id text NOT NULL,
  source_url text,
  source_kind text,
  is_primary boolean NOT NULL DEFAULT false,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  last_synced_at timestamp with time zone,
  sync_etag text,
  sync_status text CHECK (sync_status IS NULL OR (sync_status = ANY (ARRAY['ok'::text, 'stale'::text, 'error'::text]))),
  raw_source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT catalog_source_mappings_pkey PRIMARY KEY (source_name, source_id, item_type),
  CONSTRAINT catalog_source_mappings_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id)
);
CREATE TABLE public.comment_reactions (
  comment_id bigint NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 64),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comment_reactions_pkey PRIMARY KEY (comment_id, user_id, emoji),
  CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.post_comments(id),
  CONSTRAINT comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.group_catalog_items (
  group_id bigint NOT NULL,
  catalog_item_id bigint NOT NULL,
  added_by_user_id uuid NOT NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT group_catalog_items_pkey PRIMARY KEY (group_id, catalog_item_id),
  CONSTRAINT group_catalog_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_catalog_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id),
  CONSTRAINT group_catalog_items_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.group_memberships (
  user_id uuid NOT NULL,
  group_id bigint NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])),
  status text NOT NULL CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'requested'::text, 'banned'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_memberships_pkey PRIMARY KEY (user_id, group_id),
  CONSTRAINT group_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT group_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 120),
  privacy text NOT NULL CHECK (privacy = ANY (ARRAY['public'::text, 'private'::text])),
  created_by uuid NOT NULL,
  avatar_path text,
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  deleted_at timestamp with time zone,
  public_id bigint NOT NULL DEFAULT next_public_snowflake_id(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.post_attachments (
  id bigint NOT NULL DEFAULT nextval('post_attachments_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  post_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['image'::text, 'video'::text])),
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  duration_seconds numeric CHECK (duration_seconds IS NULL OR duration_seconds >= 0::numeric),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  CONSTRAINT post_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT post_attachments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_comment_counts (
  post_id bigint NOT NULL,
  comment_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT post_comment_counts_pkey PRIMARY KEY (post_id),
  CONSTRAINT post_comment_counts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_comments (
  id bigint NOT NULL DEFAULT nextval('post_comments_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  post_id bigint NOT NULL,
  author_user_id uuid NOT NULL,
  parent_comment_id bigint,
  body_text text NOT NULL CHECK (char_length(body_text) >= 1 AND char_length(body_text) <= 1000),
  CONSTRAINT post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id),
  CONSTRAINT post_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.post_comments(id)
);
CREATE TABLE public.post_reaction_counts (
  post_id bigint NOT NULL,
  reaction_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT post_reaction_counts_pkey PRIMARY KEY (post_id),
  CONSTRAINT post_reaction_counts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_reactions (
  post_id bigint NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 64),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_reactions_pkey PRIMARY KEY (post_id, user_id, emoji),
  CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.posts (
  id bigint NOT NULL DEFAULT nextval('posts_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  author_user_id uuid NOT NULL,
  group_id bigint,
  body_text text CHECK (char_length(body_text) >= 1 AND char_length(body_text) <= 10000),
  deleted_at timestamp with time zone,
  status text NOT NULL DEFAULT 'published'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'deleted'::text])),
  catalog_item_id bigint,
  progress_unit_id bigint,
  spoiler_sequence_index integer CHECK (spoiler_sequence_index IS NULL OR spoiler_sequence_index >= 0),
  tenor_gif_url text CHECK (tenor_gif_url IS NULL OR char_length(tenor_gif_url) <= 2000),
  tenor_gif_id text,
  has_media boolean NOT NULL DEFAULT false,
  book_page integer CHECK (book_page IS NULL OR book_page >= 0),
  book_percent numeric CHECK (book_percent IS NULL OR book_percent >= 0::numeric AND book_percent <= 100::numeric),
  book_chapter_number integer CHECK (book_chapter_number IS NULL OR book_chapter_number >= 0),
  book_progress_source text NOT NULL DEFAULT 'none'::text CHECK (book_progress_source = ANY (ARRAY['none'::text, 'page'::text, 'percent'::text, 'chapter'::text, 'mixed'::text])),
  public_id bigint NOT NULL DEFAULT next_public_snowflake_id(),
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id),
  CONSTRAINT posts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT posts_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id),
  CONSTRAINT posts_progress_unit_id_fkey FOREIGN KEY (progress_unit_id) REFERENCES public.catalog_progress_units(id)
);
CREATE TABLE public.reports (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reporter_user_id uuid NOT NULL,
  target_type USER-DEFINED NOT NULL,
  target_public_id bigint NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) >= 1 AND char_length(reason) <= 200),
  details text CHECK (details IS NULL OR char_length(details) <= 2000),
  status USER-DEFINED NOT NULL DEFAULT 'open'::report_status,
  reviewed_at timestamp with time zone,
  reviewed_by_user_id uuid,
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public.users(id),
  CONSTRAINT reports_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.site_admin (
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_admin_pkey PRIMARY KEY (user_id),
  CONSTRAINT site_admin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_media_progress (
  user_id uuid NOT NULL,
  catalog_item_id bigint NOT NULL,
  current_unit_id bigint,
  current_sequence_index integer NOT NULL DEFAULT 0 CHECK (current_sequence_index >= 0),
  status text NOT NULL DEFAULT 'in_progress'::text CHECK (status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'completed'::text, 'dropped'::text])),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  rating smallint CHECK (rating IS NULL OR rating >= 1 AND rating <= 10),
  current_page integer CHECK (current_page IS NULL OR current_page >= 0),
  current_chapter_number integer CHECK (current_chapter_number IS NULL OR current_chapter_number >= 0),
  current_season_number integer CHECK (current_season_number IS NULL OR current_season_number >= 0),
  current_episode_number integer CHECK (current_episode_number IS NULL OR current_episode_number >= 0),
  progress_percent numeric CHECK (progress_percent IS NULL OR progress_percent >= 0::numeric AND progress_percent <= 100::numeric),
  watched_episode_count integer CHECK (watched_episode_count IS NULL OR watched_episode_count >= 0),
  CONSTRAINT user_media_progress_pkey PRIMARY KEY (user_id, catalog_item_id),
  CONSTRAINT user_media_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_media_progress_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id),
  CONSTRAINT user_media_progress_current_unit_id_fkey FOREIGN KEY (current_unit_id) REFERENCES public.catalog_progress_units(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) >= 1 AND char_length(display_name) <= 80),
  username USER-DEFINED UNIQUE CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,24}$'::citext AND username::text = lower(username::text)),
  avatar_url text,
  email text,
  phone_e164 text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])),
  has_google boolean NOT NULL DEFAULT false,
  has_phone boolean NOT NULL DEFAULT false,
  has_password boolean NOT NULL DEFAULT false,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 300),
  avatar_path text,
  deleted_at timestamp with time zone,
  public_id bigint NOT NULL DEFAULT next_public_snowflake_id(),
  is_premium boolean NOT NULL DEFAULT false,
  is_site_admin boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  infraction_count integer NOT NULL DEFAULT 0 CHECK (infraction_count >= 0),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
```
# And here are all Supabase SQL policies:
```
[
  {
    "schema_name": "public",
    "table_name": "catalog_item_aliases",
    "policy_name": "catalog_aliases_select_authenticated",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "catalog_item_group_add_counts",
    "policy_name": "public can read catalog group add counts",
    "command": "SELECT",
    "roles": "unknown (OID=0)",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "catalog_item_user_add_counts",
    "policy_name": "public can read catalog add counts",
    "command": "SELECT",
    "roles": "unknown (OID=0)",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "catalog_item_user_add_counts",
    "policy_name": "public_read_user_add_counts",
    "command": "SELECT",
    "roles": "anon, authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "catalog_items",
    "policy_name": "catalog_items_select_authenticated",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "catalog_progress_units",
    "policy_name": "catalog_units_select_authenticated",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "comment_reactions",
    "policy_name": "comment_reactions_delete_self",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "comment_reactions",
    "policy_name": "comment_reactions_insert_self_if_comment_visible",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((user_id = auth.uid()) AND can_view_comment(comment_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "comment_reactions",
    "policy_name": "comment_reactions_select_if_comment_visible",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_comment(comment_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "gci_delete_group_admin",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "is_group_admin_or_owner(group_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "group_catalog_items_delete",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "is_group_admin(group_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "gci_insert_group_admin",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(is_group_admin_or_owner(group_id, auth.uid()) AND (added_by_user_id = auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "group_catalog_items_insert",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((added_by_user_id = auth.uid()) AND is_group_admin(group_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "gci_select_visible_group",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_group(group_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "group_catalog_items_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_group(group_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "gci_update_group_admin",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "is_group_admin_or_owner(group_id, auth.uid())",
    "with_check_expression": "is_group_admin_or_owner(group_id, auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "group_catalog_items",
    "policy_name": "group_catalog_items_update",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "is_group_admin(group_id, auth.uid())",
    "with_check_expression": "is_group_admin(group_id, auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "group_memberships",
    "policy_name": "group_memberships_delete",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "((user_id = auth.uid()) OR is_group_admin(group_id, auth.uid()))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_memberships",
    "policy_name": "group_memberships_insert",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(((user_id = auth.uid()) AND (role = 'owner'::text) AND (status = 'active'::text) AND (EXISTS ( SELECT 1\n   FROM groups g\n  WHERE ((g.id = group_memberships.group_id) AND (g.created_by = auth.uid()) AND (g.deleted_at IS NULL) AND (NOT (EXISTS ( SELECT 1\n           FROM group_memberships gm\n          WHERE (gm.group_id = group_memberships.group_id)))))))) OR ((user_id = auth.uid()) AND (role = 'member'::text) AND (status = ANY (ARRAY['requested'::text, 'active'::text])) AND (EXISTS ( SELECT 1\n   FROM groups g\n  WHERE ((g.id = group_memberships.group_id) AND (g.deleted_at IS NULL))))) OR is_group_admin(group_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "group_memberships",
    "policy_name": "group_memberships_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "((user_id = auth.uid()) OR is_group_member(group_id, auth.uid()))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "group_memberships",
    "policy_name": "group_memberships_update",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "((user_id = auth.uid()) OR is_group_admin(group_id, auth.uid()))",
    "with_check_expression": "((user_id = auth.uid()) OR is_group_admin(group_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "groups",
    "policy_name": "groups_delete",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "is_group_owner(id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "groups",
    "policy_name": "groups_insert",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(created_by = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "groups",
    "policy_name": "groups_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "((deleted_at IS NULL) AND ((privacy = 'public'::text) OR (created_by = auth.uid()) OR is_group_member(id, auth.uid())))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "groups",
    "policy_name": "groups_update",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "((deleted_at IS NULL) AND is_group_admin(id, auth.uid()))",
    "with_check_expression": "is_group_admin(id, auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "post_attachments",
    "policy_name": "post_attachments_delete_if_can_moderate_post",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "can_moderate_post(post_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_attachments",
    "policy_name": "post_attachments_insert_if_can_moderate_post",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "can_moderate_post(post_id, auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "post_attachments",
    "policy_name": "post_attachments_select_if_post_visible",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_post_with_spoiler_gate(post_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_attachments",
    "policy_name": "post_attachments_update_if_can_moderate_post",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "can_moderate_post(post_id, auth.uid())",
    "with_check_expression": "can_moderate_post(post_id, auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "post_comment_counts",
    "policy_name": "public can read post comment counts",
    "command": "SELECT",
    "roles": "unknown (OID=0)",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_comments",
    "policy_name": "post_comments_delete_author_or_group_admin",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM posts p\n  WHERE ((p.id = post_comments.post_id) AND (p.group_id IS NOT NULL) AND is_group_admin_or_owner(p.group_id, auth.uid())))))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_comments",
    "policy_name": "post_comments_insert_if_post_visible",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((author_user_id = auth.uid()) AND can_view_post_with_spoiler_gate(post_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "post_comments",
    "policy_name": "post_comments_select_if_post_visible",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_post_with_spoiler_gate(post_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_comments",
    "policy_name": "post_comments_update_author_or_group_admin",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM posts p\n  WHERE ((p.id = post_comments.post_id) AND (p.group_id IS NOT NULL) AND is_group_admin_or_owner(p.group_id, auth.uid())))))",
    "with_check_expression": "((author_user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM posts p\n  WHERE ((p.id = post_comments.post_id) AND (p.group_id IS NOT NULL) AND is_group_admin_or_owner(p.group_id, auth.uid())))))"
  },
  {
    "schema_name": "public",
    "table_name": "post_reaction_counts",
    "policy_name": "post_reaction_counts_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reaction_counts",
    "policy_name": "public can read post reaction counts",
    "command": "SELECT",
    "roles": "unknown (OID=0)",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_delete_own",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_delete_self",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_insert_own",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_insert_self_if_post_visible",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((user_id = auth.uid()) AND can_view_post_with_spoiler_gate(post_id, auth.uid()))"
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "true",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_select_if_post_visible",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "can_view_post_with_spoiler_gate(post_id, auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "post_reactions",
    "policy_name": "post_reactions_update_own",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_delete",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND is_group_admin(group_id, auth.uid())))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_delete_author_or_group_admin",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM group_memberships gm\n  WHERE ((gm.group_id = posts.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_insert",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((author_user_id = auth.uid()) AND ((group_id IS NULL) OR can_post_in_group(group_id, auth.uid())))"
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_insert_author_member",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((author_user_id = auth.uid()) AND ((group_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM group_memberships gm\n  WHERE ((gm.group_id = posts.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text))))))"
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_select",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "((deleted_at IS NULL) AND (status <> 'deleted'::text) AND ((group_id IS NULL) OR can_view_group(group_id, auth.uid())))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_select_visible",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "(((group_id IS NULL) AND (author_user_id = auth.uid())) OR (EXISTS ( SELECT 1\n   FROM groups g\n  WHERE ((g.id = posts.group_id) AND ((g.privacy = 'public'::text) OR (EXISTS ( SELECT 1\n           FROM group_memberships gm\n          WHERE ((gm.group_id = g.id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text)))))))))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_update",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND is_group_admin(group_id, auth.uid())))",
    "with_check_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND is_group_admin(group_id, auth.uid())))"
  },
  {
    "schema_name": "public",
    "table_name": "posts",
    "policy_name": "posts_update_author_or_group_admin",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM group_memberships gm\n  WHERE ((gm.group_id = posts.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))",
    "with_check_expression": "((author_user_id = auth.uid()) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM group_memberships gm\n  WHERE ((gm.group_id = posts.group_id) AND (gm.user_id = auth.uid()) AND (gm.status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::text, 'admin'::text])))))))"
  },
  {
    "schema_name": "public",
    "table_name": "reports",
    "policy_name": "reports_delete_admin",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "reports",
    "policy_name": "reports_insert_own",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((reporter_user_id = auth.uid()) AND (status = 'open'::report_status) AND (reviewed_at IS NULL) AND (reviewed_by_user_id IS NULL))"
  },
  {
    "schema_name": "public",
    "table_name": "reports",
    "policy_name": "reports_select_admin",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "reports",
    "policy_name": "reports_update_admin",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": "is_site_admin()"
  },
  {
    "schema_name": "public",
    "table_name": "site_admin",
    "policy_name": "site_admin_delete_admins_only",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "site_admin",
    "policy_name": "site_admin_insert_admins_only",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "is_site_admin()"
  },
  {
    "schema_name": "public",
    "table_name": "site_admin",
    "policy_name": "site_admin_select_admins_only",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "site_admin",
    "policy_name": "site_admin_update_admins_only",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "is_site_admin()",
    "with_check_expression": "is_site_admin()"
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "delete_own_progress",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "ump_delete_self",
    "command": "DELETE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "insert_own_progress",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "ump_insert_self",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "select_own_progress",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "ump_select_self",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "ump_select_shared_group_members",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "((user_id <> auth.uid()) AND (EXISTS ( SELECT 1\n   FROM ((group_memberships gm_me\n     JOIN group_memberships gm_them ON (((gm_them.group_id = gm_me.group_id) AND (gm_them.user_id = user_media_progress.user_id) AND (gm_them.status = 'active'::text))))\n     JOIN group_catalog_items gci ON (((gci.group_id = gm_me.group_id) AND (gci.catalog_item_id = user_media_progress.catalog_item_id))))\n  WHERE ((gm_me.user_id = auth.uid()) AND (gm_me.status = 'active'::text)))))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "ump_update_self",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "user_media_progress",
    "policy_name": "update_own_progress",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "(user_id = auth.uid())",
    "with_check_expression": "(user_id = auth.uid())"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "policy_name": "users_insert_own",
    "command": "INSERT",
    "roles": "authenticated",
    "using_expression": null,
    "with_check_expression": "((auth.uid() = id) AND (is_premium = false) AND (is_site_admin = false) AND (is_banned = false) AND (infraction_count = 0))"
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "policy_name": "public can read basic profile",
    "command": "SELECT",
    "roles": "unknown (OID=0)",
    "using_expression": "((status = 'active'::text) AND (deleted_at IS NULL))",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "policy_name": "users_select_own",
    "command": "SELECT",
    "roles": "authenticated",
    "using_expression": "(auth.uid() = id)",
    "with_check_expression": null
  },
  {
    "schema_name": "public",
    "table_name": "users",
    "policy_name": "users_update_own_profile_hardened",
    "command": "UPDATE",
    "roles": "authenticated",
    "using_expression": "(auth.uid() = id)",
    "with_check_expression": "((auth.uid() = id) AND (is_premium = ( SELECT u.is_premium\n   FROM users u\n  WHERE (u.id = users.id))) AND (is_site_admin = ( SELECT u.is_site_admin\n   FROM users u\n  WHERE (u.id = users.id))) AND (is_banned = ( SELECT u.is_banned\n   FROM users u\n  WHERE (u.id = users.id))) AND (infraction_count = ( SELECT u.infraction_count\n   FROM users u\n  WHERE (u.id = users.id))))"
  }
]
```
