create index if not exists posts_personal_feed_idx
  on public.posts (created_at desc)
  where status = 'published' and deleted_at is null and group_id is null;

create index if not exists posts_group_feed_idx
  on public.posts (group_id, created_at desc)
  where status = 'published' and deleted_at is null and group_id is not null;

drop policy if exists "posts_select_public_or_member" on public.posts;
create policy "posts_select_public_or_member"
  on public.posts
  for select
  using (
    status = 'published'
    and deleted_at is null
    and (
      group_id is null
      or exists (
        select 1
        from public.groups g
        where g.id = posts.group_id
          and (
            g.privacy = 'public'
            or (
              g.privacy = 'private'
              and exists (
                select 1
                from public.group_memberships gm
                where gm.group_id = posts.group_id
                  and gm.user_id = auth.uid()
                  and gm.status = 'active'
              )
            )
          )
      )
    )
  );
