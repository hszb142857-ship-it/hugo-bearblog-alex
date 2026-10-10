# 寒水 · HANSHUI SPACE

陆寒水的个人博客。Hugo 静态页面承载文字，Supabase 承载 Google 登录、留言与审核。
网站地址：<https://hanshui.space/>。仓库暂保留原名称 `hugo-bearblog-alex`。

视觉采用编辑式网格、大字号、灰白底色和少量朱红色几何构成。图片与阅读面板的质感可以独立调整；内容与留言功能保持分离。

## 现有功能

- 首页诗词、按发布日期倒序的文章列表、文章阅读及返回主页。
- 发布日期、基于 Git 的修改时间、SEO 元数据、RSS 和站点地图。
- 首页与每篇文章各自的留言区；Google 登录、保持会话和退出登录。
- 留言最多 2000 字符，新留言待审核；访客看到已审核留言，作者看到自己的留言。
- 管理员登录后，展开页面下方的“留言管理”，查看全站留言并通过、拒绝或删除。
- 原 Supabase 保活工作流：只读查询 `comments` 表，并支持手动触发。
- 新增首页主图、文章封面、背景、页眉横幅；透明度、图片模糊、裁切焦点、面板磨砂和强调色。
- 新增视觉工作台、正文图片短代码、阅读进度和少量悬停/进入动态。系统选择“减少动态”时自动关闭动画。

首页和原两篇文章的 Markdown 没有重写。原 `comments.js`、留言模板、SQL 权限脚本和保活工作流均保持原文件内容。留言仍然按原页面路径存储，因此已有留言可以继续读取。

## 快速运行

安装 [Hugo](https://gohugo.io/installation/)。本次使用官方 Hugo 0.167.0 验证。
无需远程主题、Go 依赖或 JavaScript 框架；Node.js 只用于可选的开发检查。

```sh
git clone https://github.com/hszb142857-ship-it/hugo-bearblog-alex.git hanshui-space
cd hanshui-space
hugo server --disableFastRender
```

打开终端显示的本地地址，通常是 `http://localhost:1313/`。

生产构建：

```sh
hugo --gc --minify
```

发布目录是 `public/`。继续使用现有 Cloudflare Pages 项目的域名和部署设置；不要创建新的 Supabase 项目或重新执行 SQL。

要正确显示历史修改时间，构建时保留 Git 历史。仓库的 `enableGitInfo` 和 `frontmatter.lastmod` 规则沿用原配置。

## 用视觉工作台换图片

打开网站的 `/studio/`，本地运行时为 `http://localhost:1313/studio/`。工作台不在文章列表和 RSS 中出现。

1. 选择“全站默认”、首页或某篇文章。
2. 选择首页主图、文章封面、页面背景或页眉横幅。
3. 选取本地图片，或填写站内路径 / HTTPS 图片地址。
4. 调整透明度、图片模糊和裁切焦点；需要磨砂时降低面板不透明度，再调节背景磨砂。
5. 用桌面/手机模式检查预览，点击“导出配置与图片”。
6. 解压 `hanshui-appearance.zip`，把其中的 `static/` 文件夹合并到仓库根目录。
7. 提交 GitHub，待现有部署流程完成后，所有访客即可看到新效果。

**下载导出包不会自动发布网站。** 工作台只修改当前浏览器内存，刷新会丢弃未导出的调整。选取的文件不上传到第三方服务，配置包也不包含登录信息或留言。

工作台不需要管理员身份：访客只能预览和下载自己的配置，不能通过它修改仓库或线上设置。原留言管理仍需原 Supabase 管理员权限。

图片支持 PNG、JPEG、WebP、AVIF；每张最多 8 MB，当前草稿合计最多 32 MB。建议先压缩较大的摄影图片。可导入已导出的 `appearance.json` 继续调整；图片需已放入仓库，或重新选取本地文件。

## 配置接口

持久设置统一放在 `static/appearance.json`。修改此文件不需要更改文章 Markdown。

`global` 提供默认值，`pages` 按实际页面路径覆盖。工作台会自动填写正确路径；手写路径时需与该页面的 `data-page-path` 一致。

示例：

```json
{
  "version": 1,
  "global": {
    "accent": "#ce412d",
    "motion": true,
    "surface": { "opacity": 0.96, "blur": 18 },
    "background": {
      "src": "/images/background.webp",
      "alt": "",
      "opacity": 0.18,
      "blur": 0,
      "focus_x": 50,
      "focus_y": 50,
      "fit": "cover"
    },
    "masthead": { "src": "", "opacity": 1, "blur": 0 },
    "hero": {
      "src": "/images/home.webp",
      "alt": "图片的内容说明",
      "opacity": 1,
      "blur": 0
    },
    "cover": {
      "src": "/images/article.webp",
      "alt": "文章封面的内容说明",
      "opacity": 1,
      "blur": 0
    }
  },
  "pages": {
    "/": {
      "surface": { "opacity": 0.85, "blur": 24 }
    }
  }
}
```

图片放在 `static/images/` 内，地址写成 `/images/文件名.webp`；不要在地址前面写 `static/`。

| 字段 | 用途与范围 |
| --- | --- |
| `accent` | 六位十六进制强调色，例如 `#ce412d` |
| `motion` | `true` / `false`，开启或关闭轻量动态 |
| `surface.opacity` | 阅读面板不透明度，0.55–1 |
| `surface.blur` | 面板背后的磨砂，0–40 像素 |
| `src` | 图片地址；空字符串移除该位置的图片 |
| `alt` | 无障碍图片说明；装饰背景使用空说明 |
| `caption` | 可选图片标题 |
| `opacity` | 图片不透明度，0–1；越小越透明 |
| `blur` | 图片本身的模糊，0–40 像素 |
| `focus_x` / `focus_y` | 裁切焦点，0–100；默认居中 50 |
| `fit` | `cover` 填满裁切，或 `contain` 完整显示 |

`surface.blur` 模糊的是面板背后的背景，`图片.blur` 模糊的是图片本身；两者可以分别调整。缺少磨砂支持的浏览器会使用不透明阅读底色。字体、正文和留言不会一起变模糊。

手写页面配置可以只覆盖部分字段。工作台编辑某个页面时，会保存该页当时的完整视觉设置；之后更改全站默认不会覆盖这份页面设置。删除 `pages` 中该页的条目，即可恢复全站继承。

## 在正文任意位置加入图片

原 Markdown 图片语法继续可用：

```md
![图片说明](/images/my-photo.webp)
```

需要透明度和磨砂效果时，使用新短代码：

```text
{{< image
  src="/images/my-photo.webp"
  alt="图片内容说明"
  caption="可选的图注"
  opacity="0.85"
  blur="0"
  glass="12"
>}}
```

`opacity` 为 0–1，`blur` 和 `glass` 为 0–40 像素。所有参数均可省略效果值。短代码可放在未来新增的文章或首页内容中；这次没有插入或改写原正文。

## 留言与管理员

详细设置见 [留言说明](docs/comments-setup.md)。管理员入口在现有页面的留言区下方，不是独立的 `/admin/comments/` 页面。

Google 提供商、OAuth 回调与 Supabase 项目保持原样。管理员身份仍由 `app_metadata.comment_admin = true` 控制。前端仍使用原 publishable key，不需要新增数据库凭据。

不要为了换图片重新初始化留言表。图片功能不执行数据库迁移，也不把图片存入留言表。

## Supabase 保活

原文件位于 `.github/workflows/supabase-keepalive.yml`，本次未修改。

现有 cron 为 `0 2 */3 * *`，计划在每月 1、4、7、10……日的北京时间 10:00 执行。它按月日期步进，跨月不严格相隔 72 小时；GitHub 的实际启动时间可能延迟。

查询只选择最多一个留言 ID，不写入、修改或删除留言。

## 检查与回退

不安装 Node 依赖也能运行内容保留检查：

```sh
node scripts/verify-preservation.mjs
```

它核对原首页、两篇文章、留言 JS、留言模板、SQL 和保活工作流的 Git blob 校验值，并检查站点地址、Supabase 配置、Git 时间规则和内容/留言入口。

完整开发检查：

```sh
npm ci
npm test
```

Hugo 需在命令路径中。测试先构建 `.qa/public/`，再通过隔离的模拟 Supabase 检查登录界面、提交验证、审核/拒绝/删除、退出、视觉预览与 ZIP 导出。测试不会写入线上数据库。开发依赖不参与网站生产构建。

本次验证记录见 [检验记录](docs/visual-review.md)。真实 Google 登录和管理员数据库写入应在部署后的原域名下，由账户所有者进行最终登录检查；本地端口不代替正式 OAuth 回调。

原版本提交为：

```text
e9718647ef10fda7b544162b81727dacacf71ed1
```

远程 `backup/pre-swiss-redesign` 分支保存原版本。若需要撤回视觉设计，回退重构提交或恢复该分支的站点文件。留言在 Supabase 中独立保存；回退视觉文件不会回退或清空留言。不要修改现有文章路径，否则页面留言会对应不同路径。

## 文件结构

```text
content/                 原首页、文章，以及独立视觉工作台页
layouts/                 自包含的 Hugo 模板
layouts/shortcodes/image.html
static/appearance.json   持久视觉配置
static/images/           原创 SVG 与自定义图片
static/design.js         视觉配置、预览桥接、轻量动态
static/studio.js          本地视觉编辑和 ZIP 导出
static/comments.js        原留言逻辑，保持不变
static/supabase-comments.sql
scripts/verify-preservation.mjs
tests/ui-regression.cjs    隔离界面回归测试
.github/workflows/supabase-keepalive.yml
```

自包含模板替代原远程 Bearblog 主题依赖，仍使用 Hugo。原主题可以通过原版本提交完整恢复。主图和封面 SVG 为本项目原创几何图形，没有外部图片请求、广告或新增跟踪代码。
