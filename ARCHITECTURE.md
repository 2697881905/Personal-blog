# 作品集站点技术架构说明

> 项目路径：`/Users/itxiaobai/Mine/my-dev-portfolio`
> 文档版本：v1.0 · 适用代码版本 Astro 4.16.18

本文档面向开发者，说明该个人技术主页的整体技术架构、模块划分、渲染策略与设计系统，便于后续维护、扩展与性能调优。

---

## 1. 项目概述

一个零运行时后端的**静态个人技术主页**，用于集中展示个人身份、技术栈、项目与贡献热力图。核心特征：

- **构建输出**：纯静态站点（`output: 'static'`，Astro SSG），无服务器端逻辑，可直接托管于任意静态 CDN。
- **混合岛屿架构**：在 Astro 静态外壳内，同时嵌入 **Vue 3** 与 **React 18** 两类交互岛屿，按需水合（Hydration）。
- **设计语言**：深色「液态玻璃（liquid glass）」风格，抹茶金（`#d9b382`）作为强调色，搭配渐变签名手写体动画。
- **部署目标**：Netlify，构建产物为 `dist/` 目录。

---

## 2. 技术栈

| 层 | 选型 | 版本 | 职责 |
| --- | --- | --- | --- |
| 框架核心 | **Astro** | 4.16.18 | 静态生成、文件路由、岛屿编排 |
| 岛屿 (Vue) | **@astrojs/vue** + Vue | 3.5.x | Hero / ProfileSidebar / SkillCard / Footer |
| 岛屿 (React) | **@astrojs/react** + React | 18.3.x | Terminal / Heatmap 交互组件 |
| 样式 | **Tailwind CSS** | 3.4.x | 原子类 + 自定义设计令牌 |
| 动画 | **GSAP** | 3.12.x | 进场遮罩、滚动揭示、签名书写动画 |
| 语言 | **TypeScript** | 5.7.x | 严格模式（`astro/tsconfigs/strict`） |
| 字体 | Outfit / Sora / JetBrains Mono | — | 通过 Google Fonts 引入 |
| 部署 | Netlify | — | 静态托管 + 构建流水线 |

依赖均锁定于 `package.json`，`npm install` 经 `.npmrc` 指向华为云镜像以保证安装速度。

---

## 3. 架构设计

### 3.1 渲染模型：Astro Islands

站点主体为静态 HTML（首屏内容在构建期生成），仅对需要交互的区块启用客户端框架。

```
BaseLayout.astro (外壳：<head> / 背景视频层 / 遮罩 / <slot/> / Footer)
└── index.astro (页面编排：数据驱动 + 岛屿装配)
    ├── ProfileSidebar   client:load   (Vue)   侧边个人卡片
    ├── Terminal         client:only   (React) 伪终端交互（仅桌面端渲染）
    ├── Heatmap          client:only   (React) 贡献/钢琴热力图
    ├── Hero             client:load   (Vue)   主标题区
    ├── SkillCard × N    (Vue)         技术栈图标（静态渲染）
    └── Footer           client:load   (Vue)   页脚社交链接
```

### 3.2 水合策略（Hydration）

| 指令 | 使用位置 | 行为 |
| --- | --- | --- |
| `client:load` | Footer、ProfileSidebar、Hero | 页面加载后立即水合，交互立即可用 |
| `client:only="react"` | Terminal、Heatmap | 不在服务端渲染，仅客户端挂载；避免 React 组件被 SSR 后产生不一致，且节省首屏 HTML 体积 |

`Terminal` 与 `Heatmap` 被包裹在 `lg:block` 容器内，仅在 `≥1024px` 视口渲染，移动端不加载该 React 岛屿，降低移动端 JS 负担。

### 3.3 文件路由

- `src/pages/index.astro` 为唯一路由 `/`，构建后输出 `dist/index.html`。
- 遵循 Astro 约定式路由，无额外路由配置。

---

## 4. 目录结构

```
my-dev-portfolio/
├── astro.config.mjs        # Astro 集成配置（vue/react/tailwind）
├── tailwind.config.cjs     # 设计令牌与主题扩展
├── tsconfig.json           # 严格 TS 配置
├── netlify.toml            # 构建与发布配置
├── .npmrc                  # 镜像源
├── public/                 # 静态资源（视频、字体、二维码、favicon）
│   ├── background.mp4      # 背景视频（H.264，约 583KB）
│   ├── background-poster.png
│   └── qrcodes/            # 微信/QQ/赞赏二维码
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro     # 全局外壳（视频层、遮罩、字体、脚本）
│   ├── pages/
│   │   └── index.astro          # 主页编排
│   ├── components/
│   │   ├── vue/                 # Vue 岛屿组件
│   │   │   ├── Hero.vue
│   │   │   ├── ProfileSidebar.vue
│   │   │   ├── SkillCard.vue
│   │   │   └── Footer.vue
│   │   └── react/               # React 岛屿组件
│   │       ├── Terminal.tsx
│   │       └── Heatmap.tsx
│   ├── data/                    # 内容数据（JSON，驱动渲染）
│   │   ├── profile.json
│   │   ├── projects.json
│   │   └── skills.json
│   ├── styles/
│   │   └── global.css           # 玻璃拟态类、动画、视频兼容层
│   └── env.d.ts
```

---

## 5. 数据层

内容完全由 `src/data/*.json` 驱动，页面通过 Astro frontmatter 导入并渲染，实现**内容与视图分离**：

- `profile.json`：姓名、头衔、简介、标签、社交链接。
- `projects.json`：项目列表（当前 3 条），主页通过 `title.includes('MindType')` 过滤展示重点项。
- `skills.json`：技术栈条目（约 27 项，含 `name` / `logo` 字段）。

修改文案或项目无需触碰组件逻辑，直接编辑 JSON 即可。

---

## 6. 样式与设计系统

### 6.1 设计令牌（Tailwind + CSS 变量双轨）

`tailwind.config.cjs` 定义语义色板，`global.css` 通过 `:root` CSS 变量同步，便于原生 CSS 与 Tailwind 共用：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `background` / `--bg` | `#0e0f13` | 页面底色（深色） |
| `card` | `#12141a` | 卡片表面 |
| `accent` / `--accent` | `#d9b382` | 抹茶金强调色 |
| `text` / `muted` | `#e9ebef` / `#9aa1ac` | 主/次文字 |
| `border` | `rgba(255,255,255,.10)` | 描边（玻璃边缘高光） |

字体栈：`sans → Outfit/PingFang SC`；标题 `section-title → Sora`；等宽 `mono → JetBrains Mono`。

### 6.2 液态玻璃组件类

`global.css` 定义一套可复用玻璃质感类，统一毛玻璃与内阴影：

- `.liquid-surface` / `.liquid-surface-strong` / `.liquid-surface-flat`：`backdrop-filter: blur(18px) saturate(195%)` + 内高光 + 多层阴影。
- `.liquid-hover`：悬停上浮（`translateY(-4px)`）+ Apple 缓动 `--ease-apple`。
- `.liquid-chip` / `.liquid-nav` / `.liquid-footer` / `.liquid-avatar`：标签、导航、页脚、头像变体。

### 6.3 签名动画

`matcha-signature`（SVG 文本）通过 `stroke-dasharray` 描边书写 + 渐变填充 + 高光扫光，配合 `@keyframes` 完成一次性入场（8s，非无限循环，遵循克制原则）。

---

## 7. 动画系统

由 `index.astro` 内的 `<script>`（客户端模块）驱动 GSAP：

- **进场遮罩**：`#page-entrance` 旋转环 + 遮罩淡出（`autoAlpha`），随后首屏 `[data-entrance]` 元素错峰上浮淡入。
- **滚动揭示**：`[data-reveal]` 区块经 `ScrollTrigger`（`start: 'top 88%'`）在滚入视口时淡入上浮。
- **无障碍降级**：脚本首行检测 `prefers-reduced-motion: reduce`，命中则**完全跳过** GSAP 注册与动画，CSS 层亦通过媒体查询禁用相关 `animation` 并直接显示终态。

---

## 8. 背景视频跨浏览器兼容

`BaseLayout.astro` 中的视频层针对国内定制浏览器（荣耀、微信 X5/TBS、UC）做了专项处理（详见 `global.css` 注释）：

1. **层叠上下文逃逸**：Tailwind `scale-110` 的 `transform` 会创建独立层叠上下文，使视频逃逸 `z-0` 容器跑到顶层——改用**尺寸放大 + 负偏移（`top/left: -6%; width/height: 112%`）**而非 `transform`。
2. **inline 默认显示**：视频默认 `display:inline` 在部分内核导致绝对定位失效，已显式 `.bg-video { display:block }`。
3. **微信 X5 内核**：添加 `x5-playsinline` / `x5-video-player-type="h5"` / `x5-video-player-fullscreen="false"` / `x5-video-orientation="portrait"` 防止被劫持为系统播放器；`preload="auto"` 触发加载；通过 `WeixinJSBridgeReady` 事件与 `touchstart/click` 手势兜底主动 `play()`。
4. **降级**：`@supports not (object-fit: cover)` 时回退为拉伸填充。

---

## 9. 部署（Netlify）

`netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
```

- 构建命令关闭 Astro 遥测（`ASTRO_TELEMETRY_DISABLED=1`）。
- 发布目录为 `dist/`，无服务端函数。
- 背景视频与二维码等静态资源置于 `public/`，构建时原样拷贝。

---

## 10. 性能与可访问性要点

### 性能
- **零运行时后端** + 静态生成，TTFB 极低，首屏 HTML 体积小。
- **岛屿化水合**：仅交互组件加载框架 JS；`client:only` 组件不在服务端渲染，节省 HTML 体积。
- **响应式岛屿**：桌面端专属的 React 组件（`Terminal`/`Heatmap`）在移动端不渲染，降低移动端 JS 与算力开销。
- **资源优化**：背景视频经压缩（约 583KB，H.264）；字体走 `display=swap` 避免阻塞渲染；`content-visibility:auto` 用于长区块（`Heatmap` 容器）延迟离屏渲染。

### 可访问性
- 语义化标签 `<main>` / `<section>` / `aria-label`；社交链接、二维码弹窗均有 `role` 与 `aria-hidden` 管理。
- 二维码弹窗支持 `Escape` 关闭、点击遮罩关闭，并临时锁定 `body` 滚动。
- 全站尊重 `prefers-reduced-motion`，关闭所有装饰性动画。
- 弹窗挂载到 `<body>` 下避免祖先 `transform` 导致 `position:fixed` 失效。

---

## 11. 后续优化建议

1. **字体自托管**：当前依赖 Google Fonts 外链，国内访问不稳定；建议自托管 `Outfit/Sora/JetBrains Mono` 并 `preload` 关键字体，消除外部阻塞。
2. **图片响应式**：`MindType` logo 已声明 `width/height`，建议补充 `srcset` 适配高分屏。
3. **React 岛屿体积**：`Heatmap` 含随机生成逻辑，可考虑 `React.lazy` + 动态导入进一步拆分。
4. **Lighthouse 监控**：建立 CI 中的 Lighthouse CI，固化性能/无障碍基线（当前架构预期可达 90+）。
5. **内容来源统一**：社交链接在 `profile.json` 与 `index.astro` 内联两处存在，建议统一抽取到数据层。

---

**维护者**：itxiaobai · **文档生成日期**：2026-07-19
