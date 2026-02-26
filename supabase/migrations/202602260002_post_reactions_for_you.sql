create unique index if not exists post_reactions_post_user_unique_idx
  on public.post_reactions (post_id, user_id);

create or replace function public.sync_post_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_reaction_counts (post_id, reaction_count)
    values (new.post_id, 1)
    on conflict (post_id)
    do update set reaction_count = public.post_reaction_counts.reaction_count + 1;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.post_reaction_counts
    set reaction_count = greatest(0, reaction_count - 1)
    where post_id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_post_reaction_counts on public.post_reactions;
create trigger trg_sync_post_reaction_counts
after insert or delete on public.post_reactions
for each row
execute function public.sync_post_reaction_counts();

insert into public.post_reaction_counts (post_id, reaction_count)
select post_id, count(*)::bigint as reaction_count
from public.post_reactions
group by post_id
on conflict (post_id)
do update set reaction_count = excluded.reaction_count;

alter table public.post_reactions enable row level security;
alter table public.post_reaction_counts enable row level security;

drop policy if exists "post_reactions_select_visible_posts" on public.post_reactions;
create policy "post_reactions_select_visible_posts"
  on public.post_reactions
  for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_reactions.post_id
        and p.status = 'published'
        and p.deleted_at is null
        and (
          p.group_id is null
          or exists (
            select 1
            from public.groups g
            where g.id = p.group_id
              and (
                g.privacy = 'public'
                or exists (
                  select 1
                  from public.group_memberships gm
                  where gm.group_id = p.group_id
                    and gm.user_id = auth.uid()
                    and gm.status = 'active'
                )
              )
          )
        )
    )
  );

drop policy if exists "post_reactions_insert_own" on public.post_reactions;
create policy "post_reactions_insert_own"
  on public.post_reactions
  for insert
  with check (user_id = auth.uid());

drop policy if exists "post_reactions_delete_own" on public.post_reactions;
create policy "post_reactions_delete_own"
  on public.post_reactions
  for delete
  using (user_id = auth.uid());

drop policy if exists "post_reaction_counts_select_visible_posts" on public.post_reaction_counts;
create policy "post_reaction_counts_select_visible_posts"
  on public.post_reaction_counts
  for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_reaction_counts.post_id
        and p.status = 'published'
        and p.deleted_at is null
        and (
          p.group_id is null
          or exists (
            select 1
            from public.groups g
            where g.id = p.group_id
              and (
                g.privacy = 'public'
                or exists (
                  select 1
                  from public.group_memberships gm
                  where gm.group_id = p.group_id
                    and gm.user_id = auth.uid()
                    and gm.status = 'active'
                )
              )
          )
        )
    )
  );
