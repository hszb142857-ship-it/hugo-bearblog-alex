-- 陆寒水的博客：Google 登录留言系统
-- 在 Supabase Dashboard -> SQL Editor 中一次性执行。
--
-- 设计：
-- 1. 访客只能读取已审核留言。
-- 2. Google 登录用户才能提交留言。
-- 3. 新留言固定为 pending，不能由普通用户直接改成 approved。
-- 4. 只有 app_metadata.comment_admin = true 的账号可以审核、删除留言。
-- 5. service_role / secret key 永远不要放进网站前端。

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  page_path text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint comments_content_length
    check (char_length(trim(content)) between 1 and 2000)
);

create index if not exists comments_page_status_created_idx
  on public.comments (page_path, status, created_at);

create index if not exists comments_user_id_idx
  on public.comments (user_id);

alter table public.comments enable row level security;

revoke all on table public.comments from anon, authenticated;

grant select on table public.comments to anon, authenticated;
grant insert on table public.comments to authenticated;
grant update, delete on table public.comments to authenticated;

drop policy if exists "Anyone can read approved comments" on public.comments;
create policy "Anyone can read approved comments"
on public.comments
for select
to anon, authenticated
using (
  status = 'approved'
  or (select auth.uid()) = user_id
  or ((select auth.jwt() -> 'app_metadata' ->> 'comment_admin') = 'true')
);

drop policy if exists "Authenticated users can submit pending comments" on public.comments;
create policy "Authenticated users can submit pending comments"
on public.comments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
);

drop policy if exists "Only comment admins can update comments" on public.comments;
create policy "Only comment admins can update comments"
on public.comments
for update
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'comment_admin') = 'true'
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'comment_admin') = 'true'
);

drop policy if exists "Only comment admins can delete comments" on public.comments;
create policy "Only comment admins can delete comments"
on public.comments
for delete
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'comment_admin') = 'true'
);

-- 可选：如果你以后不想让用户看到自己“被拒绝”的留言，
-- 把 SELECT policy 里的：
--   or (select auth.uid()) = user_id
-- 改成只允许 status = 'approved' 或管理员查看。

-- 设置管理员：
-- 在 Supabase Dashboard 的 Authentication -> Users 找到你自己的 Google 账号，
-- 把 Raw App Metadata 设置为：
-- {"comment_admin": true}
--
-- 修改 app_metadata 后重新登录一次，让新的 JWT 生效。
