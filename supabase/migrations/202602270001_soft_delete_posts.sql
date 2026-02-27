create or replace function public.soft_delete_post(p_post_id bigint, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.posts (id, author_user_id, deleted_at)
  values (p_post_id, p_user_id, timezone('utc', now()))
  on conflict (id) do update
  set deleted_at = excluded.deleted_at
  where posts.author_user_id = excluded.author_user_id;
end;
$$;

grant execute on function public.soft_delete_post(bigint, uuid) to authenticated;
