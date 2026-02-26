alter table public.posts
  add column if not exists book_page integer,
  add column if not exists book_percent integer;

alter table public.posts
  drop constraint if exists posts_book_page_positive,
  add constraint posts_book_page_positive check (book_page is null or book_page >= 1);

alter table public.posts
  drop constraint if exists posts_book_percent_range,
  add constraint posts_book_percent_range check (book_percent is null or (book_percent >= 0 and book_percent <= 100));
