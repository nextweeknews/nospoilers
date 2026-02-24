alter table public.posts
  add column if not exists is_public boolean not null default false;

create index if not exists posts_public_feed_idx
  on public.posts (created_at desc)
  where status = 'published' and deleted_at is null and is_public = true;

drop policy if exists "posts_select_public_or_member" on public.posts;
create policy "posts_select_public_or_member"
  on public.posts
  for select
  using (
    (
      status = 'published'
      and deleted_at is null
      and is_public = true
    )
    or exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = posts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );
