# 抹茶味的琴

一个以 Astro 构建的技术博客，也是一份持续更新的工程日志。主要记录 HarmonyOS / ArkTS 原生开发，也写 Java 后端、数据库与前端交互。界面使用近黑纸面、奶油白巨型字、余烬橙与紫罗兰撞色，Geist Sans / Geist Mono，强调信息密度、代码化元信息、滚动叙事与可逆的空间转场。

## 本地运行

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

生产构建输出到 `dist/`。部署时设置 `SITE_URL`（Netlify 会自动注入 `URL`），否则 canonical、sitemap 与 RSS 会指向 localhost。

## 内容维护

- 文章：`src/content/posts/*.md`
- 文章字段约束：`src/content/config.ts`
- 项目：`src/data/projects.json`
- 个人信息：`src/data/profile.json`
- 全局视觉令牌：`src/styles/global.css`
- 搜索索引：`src/pages/search.json.ts`，由内容集合自动生成
- RSS 与站点地图：`/rss.xml`、`/sitemap.xml`；404：`src/pages/404.astro`

新增文章后会自动生成 `/posts/<slug>/` 路由，并出现在文章列表、首页日志与 `Ctrl K` 搜索中。

## 可交互的地方

- 平滑滚动：完整动效模式启用 Lenis；GSAP ScrollTrigger 驱动标题拆分、日志行、项目与正文场景。
- 全站 CRT 质感：扫描线、traveling beam、噪点与暗角；`body` 后面还有一层蓝图网格。
- 首次进站（每会话一次）播放内核式开机自检动画，点击或任意按键可跳过；`sessionStorage` 的 `matcha:booted` 控制。
- 首屏背景是分布式软总线拓扑：phone / pad / watch / audio / iot 五个节点沿贝塞尔弧线互连，数据包持续流转；指针靠近节点会点亮并发出虚线发现帧。
- 悬停首屏大标题弹出 ArkTS inspector：DevEco 风格的代码浮窗，带行号与语法高亮逐行展开。
- 导航与页脚链接悬停时做乱码解码（scramble）动画。
- 首页终端可输入 `help`、`whoami`、`now`、`stack`、`notes`、`projects`、`neofetch`、`hdc list targets`、`hdc shell …`、`hilog`、`bus`、`uname`、`date`、`cat now.md`、`github`、`clear`；输入 `rm -rf /` 会被拒绝并震屏。
- 彩蛋：依次按 `↑ ↑ ↓ ↓ ← → ← → B A` 切换超级终端模式，全站换成磷光绿 CRT 主题并弹出通知；再输一次退出。
- `Ctrl K` / `⌘ K` 打开命令面板，搜索文章与页面。
- 默认启用完整动效，不提供动效偏好切换；页面直接以完整动效模式运行。
- 点击整条文章或项目记录；项目会从行内展开为工程记录浮层，并可在关闭时严格反向返回。
- `/trace` 把一次点赞的状态变更做成五段滚动叙事：`onClick → likeStore 变更 → 最小 diff → PostCard.build() → vsync 上屏`；向下滚执行，向上滚完整倒放。
- 文章编号、封面、标题、日期和阅读时长共 5 类共享元素会跨页延续：编号从 9px 长成 184px，封面沿弧线放大成全幅封面，浏览器返回时反向播放。
- 极光渐变随指针轻微视差；底部有一条技术栈跑马灯，滚动越快速度越快。首页中段是 280vh 的奶油白宣言章节，三行大字随滚动逐词点亮。
- 列表会随滚动速度产生最多 2.2° 的轻微倾斜；文章缩略图悬停时按指针位置做 3D 倾斜，桌面端才有。
- 所有页面顶部有滚动进度线；桌面首页右侧的 sections rail 会随滚动定位当前章节，进入奶油白宣言区时自动反相。
- 文章详情有根据滚动位置联动的目录、代码复制/全屏与图片灯箱。
- 标签筛选会真正把标签节点移入筛选栏，并支持浏览器前进/后退与 URL 分享。
- 技术风格箭头指针默认启用；文章行和项目行在原位显示 `READ` / `OPEN` 动作提示。

## 指针可配置项

技术箭头指针是默认行为（`BaseLayout` 中的 `<html data-cursor="technical">`）。想换回系统指针时删除该属性即可：

- `data-cursor="read|open|..."`：为任意元素定义动作标签。
- `CURSOR_OPTIONS.followDuration`：默认 `0`，表示 1:1 精确跟随；大于 `0` 才会产生拖尾。
- `CURSOR_OPTIONS.hideNative`：技术指针模式下是否隐藏系统指针。
- `--cursor-fill`：箭头填充色，默认 `#fffce1`。
- `--cursor-outline`：箭头描边色，默认 `#0e100f`。
- `--cursor-accent`：热点和动作标签颜色，默认电光橙。
- `--cursor-label-gap`：标签相对指针的间距。

详细转场地图和参数见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
