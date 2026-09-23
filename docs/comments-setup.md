# Google 留言系统设置

留言系统使用 Supabase Auth + PostgreSQL，不会把留言写进 Hugo 内容，也不会因为普通留言触发 GitHub / Cloudflare 构建。

## 1. 创建 Supabase 项目

创建项目后，在 Authentication -> Providers 中启用 Google。

Google OAuth 的配置按照 Supabase 官方文档设置：
https://supabase.com/docs/guides/auth/social-login/auth-google

网站地址是：

https://hanshui.space/

Google OAuth 的回调地址使用 Supabase Dashboard 提供的 Callback URL，并把博客地址加入允许的 Redirect URLs。

## 2. 创建留言表和权限

打开 Supabase Dashboard -> SQL Editor，把：

static/supabase-comments.sql

中的 SQL 全部执行。

RLS 必须保持开启。前端只能使用 publishable key；不要把 secret / service_role key 放进 Hugo 或浏览器代码。

## 3. 给自己的 Google 账号管理员权限

第一次使用 Google 登录后，在：

Authentication -> Users

找到自己的 Google 用户，把 Raw App Metadata 设置为：

{"comment_admin": true}

然后退出博客并重新登录一次，使新的 app_metadata 进入 JWT。

管理员审核地址：

https://hanshui.space/admin/comments/

## 4. 配置 Hugo

在 hugo.toml 中填写：

[params.comments]
  enabled = true
  supabase_url = "https://你的项目.supabase.co"
  supabase_publishable_key = "你的 sb_publishable_xxx"

publishable key 可以出现在浏览器端；RLS 才是真正的权限边界。绝对不要使用 service_role / secret key。

## 5. Google 登录设置

Supabase 当前推荐通过 signInWithOAuth({ provider: "google" }) 发起 Google 登录。

参考：
https://supabase.com/docs/reference/javascript/auth-signinwithoauth

## 6. 页面行为

- 未登录：只能看到已审核留言，并显示 Google 登录按钮。
- 已登录：可以提交留言；新留言状态固定为 pending。
- pending 留言只有作者自己和管理员可见。
- 管理员可以通过 /admin/comments/ 审核、拒绝或删除。
- 审核状态直接存在 Supabase 数据库，不需要修改 Markdown，也不需要重新运行 Hugo。
