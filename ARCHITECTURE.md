# 站点架构与动效系统

## 1. 设计意图

这不是把所有元素都加一遍淡入，而是把“运动”建成一套有因果的技术叙事：

- **空间连续**：文章编号、封面、标题、日期与阅读时长在列表与详情之间保持同一身份，按 0–80ms 的次序依次起飞。
- **滚动即时间轴**：请求从 Client 到 Response 的过程由滚动位置驱动，滚回即倒放。
- **文字是结构**：标题按词/字拆分入场，但屏幕阅读器仍读取完整语义。
- **运动有层级**：Lenis 负责滚动惯性，GSAP 负责场景编排，View Transitions / Flip 负责身份延续。
- **速度即质感**：跑马灯、列表倾斜和章节进度共用 ScrollTrigger 的滚动速度，快滚时整体“受力”，停下后回正。
- **一次强反相**：首页中段从深空蓝黑切到月光白纸面，用 280vh 的宣言章节制造呼吸和对比，而不是整页一个色温。
- **技术极客而非产品官网**：终端、路径、日志行、状态追踪、等宽元信息构成主视觉，没有营销 CTA 和卡片货架。

## 2. 技术架构

| 层 | 实现 | 职责 |
| --- | --- | --- |
| 平滑滚动 | **Lenis** `lerp: 0.1` | 与 GSAP ticker 同步；触摸端保留系统滚动 |
| 滚动编排 | **GSAP + ScrollTrigger** | 可逆的段落、文字、日志行、状态追踪 |
| 文本动画 | 自研 `Intl.Segmenter` 拆分 | 词/字级动画，保留完整 `aria-label` |
| 跨页转场 | **View Transitions API** | 5 类文章共享元素 + 品牌，`view-transition-class` 分组编排 |
| 页内共享 | **GSAP Flip** | 项目、二维码、图片、代码全屏 |
| 速度反馈 | **ScrollTrigger velocity + quickTo** | 跑马灯变速、列表 skew、缩略图 3D tilt |
| 光标 | 技术箭头指针（`data-cursor="technical"`） | 默认启用；动作提示显示在元素原位，删除属性可恢复原生指针 |
| 代码高亮 | **Shiki `vesper`** | 深色语法，低饱和强调，避免与蓝色主色争抢 |
| 框架 | **Astro 4.16 + TypeScript** | 静态生成、文件路由、内容集合 |

```text
src/scripts/
├── motion.ts          # 首屏 3D 标题、宣言章节、跑马灯、速度倾斜与正文场景
├── hacker.ts          # CRT 叠层、开机自检、软总线拓扑、ArkTS inspector、终端彩蛋
├── trace.ts           # ArkUI 状态变更的滚动叙事，正反向 scrub
├── smooth.ts          # Lenis 生命周期与锚点滚动
├── cursor.ts          # 技术箭头指针（默认启用）与配置项
├── reading.ts         # 全局滚动进度、章节 rail、文章目录
├── palette.ts         # Ctrl K 命令面板
├── terminal.ts        # 可输入终端（neofetch / hdc / hilog / bus / 彩蛋命令）
├── filters.ts         # 标签筛选
├── interactions.ts    # Flip 浮层、灯箱、代码块
├── motion-control.ts  # 固定完整动效
└── transitions/       # shared-id 约定、Flip、旧浏览器降级
```

### 2.1 色彩系统

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#06080d` | 深空蓝黑底，比纯黑多一点冷灰 |
| `--text` | `#e9edf5` | 冷月光白正文与巨型标题 |
| `--accent` | `#3f8cff` | 鸿蒙蓝：路径、编号、高亮、进度 |
| `--violet` | `#b39dff` | 蓝紫：次级强调、封面副标题、宣言光晕 |
| `--cyan` | `#4dd6ff` | 青色：流体光晕与热力图高段 |
| `--signal` / `--acid` | `#00e5b0` | 青绿：终端成功态、状态点与 log info |
| `--error` | `#ff5f56` | 终端错误与失败态 |
| `--warn` | `#ffb865` | 终端警告与提示态 |
| `--border` | `rgba(233,237,245,0.10)` | 月光白低对比分隔线 |

冷月光白同时承担“纸”和“字”两种角色：主页宣言区整段反相为月光白底、深空墨字，形成全站唯一的高亮章节；蓝紫青三团环境光贯穿首屏与宣言区，维持单一冷色温。

#### 浅色模式

`html[data-theme="light"]` 将同一套语义令牌换成蓝图纸面：`--bg #f2f5fa`、`--text #0b1220`、`--accent #1b66dd`、`--faint #5a6678`，并用 `--scrim-solid #dfe4ec` 处理减少透明度场景的遮罩。文章封面在浅色下做 `invert(1)`，让深色截图变成浅色纸面；`.terminal-card`、`.trace-console`、`.code-block` 继续使用独立夜间令牌，保证等宽文本对比度。主题偏好存于 `matcha:theme`，首屏前由内联脚本写入 `data-theme`，导航栏按钮只切换已保存值，不接管系统设置。

浅色模式另有四层细节：开机自检改成纸面蓝图网格；`body::after` 的 54px 网格按 `scrollY × 0.05` 缓慢位移；文章封面悬停时由 `::after` 扫过一条 720ms 的蓝色绘图线；主题按钮切换时释放一圈 620ms、始终 1px 描边的墨滴涟漪，并带 Sun / Moon 图标的 240ms 旋转反馈。

### 2.2 比例系统

所有尺寸用 `clamp()` 随视口温和缩放，1440 以下基本保持原设计，1920 起整体放大：

| 尺寸 | 规则 | 1440 | 1920 |
| --- | --- | --- | --- |
| 内容列 | `clamp(1180px, 82vw, 1440px)` | 1180 | 1440 |
| 主标题 | `clamp(56px, 7.6vw, 132px)` | 108 | 132 |
| 终端列 | `clamp(470px, 31vw, 540px)` | 470 | 540 |
| 章节标题 | `clamp(34px, 3.8vw, 62px)` | 54 | 62 |
| 跑马灯 | `clamp(28px, 4.2vw, 72px)` | 60 | 72 |
| 宣言 | `clamp(34px, 5.4vw, 96px)` | 78 | 96 |
| 日志标题 | `clamp(24px, 1.5vw, 28px)` | 24 | 28 |

矮屏（高度 ≤820px）会把首屏上下留白压到 88/64px，保证 1366×768 也能在首屏看到跑马灯。

首屏背景是贯穿横宽的极光渐变层（`left: calc(50% - 50vw); width: 100vw`），紫/橙/青/粉四团光晕在任意宽度下都铺满横向，随指针做轻微视差；跑马灯两端用与底色同色的渐变叠层渐隐（不依赖 mask），左右边缘实测峰值亮度 322/730 与 132/730。

## 3. 动效系统的四层模型

### 3.1 时钟层：Lenis

完整动效模式下启用，统一桌面滚轮与锚点滚动的速度感。触摸设备使用 `syncTouch: false`，保留原生惯性，避免手势劫持。

### 3.2 场景层：GSAP + ScrollTrigger

- 首屏是一段自上而下的 timeline：路径标签、标题、正文、终端、光标依次进入；标题字符从 `rotateX(-82°)` 翻起覆盖 `expo.out`。
- 页面标题和段落标题按词拆分，`expo.out` 进入；英文单词不会被任意断行。
- 日志行使用 row timeline：行位移、封面 `clip-path`、文本次级元素分段跟随。
- 宣言章节是 280vh 的 sticky 场景：22 个词从 18% 透明度逐字点亮，进度线、编号和背景光晕由同一 scrub 时间轴驱动。
- 两条跑马灯用一个 `xPercent: -50` 无限循环，`ScrollTrigger.getVelocity()` 实时改变 `timeScale`，快滚时加速、停下回到常速。
- 状态追踪使用 `scrub: 0.9`，滚动位置就是时间轴进度，天然支持正放、暂停和倒放。

### 3.3 身份层：View Transitions + Flip

跨页交付编号、封面、标题、日期与阅读时长；页内通过移动真实 DOM 节点实现项目、二维码、图片和代码浮层。两者各司其职，同一元素不同时运行两套机制。共享元素本身在转场期间不再播放入场动画，避免二次淡入和叠影。

转场按 `view-transition-class` 分五组：`cover` 先走 620ms 弧线，`index` 在 40ms 后放大，`title` 在 80ms 后上移，日期与阅读时长（`chip`）从 0ms 起就离开元信息行，避免被放大的编号压住。摘要与标签不再做几何飞行，改为落地后由 GSAP 做 520ms、40ms stagger 的跟随淡入，因此不会横穿封面。

### 3.4 反馈层：细节动效

默认使用系统指针；日志行 hover 在行尾显示 `READ`，项目行在原位显示 `OPEN`，不依赖鼠标跟随层。桌面端缩略图随指针做最多 10° / 7° 的 3D 倾斜；列表整体按滚动速度做最多 2.2° 的 skew，停止滚动后 500ms 回正。可选技术指针只在 `<html data-cursor="technical">` 时启用，并默认采用 1:1 坐标更新，不做插值。按钮按压、滚动进度、章节 rail 和目录高亮控制在 120–280ms。

**指针配置**：`CURSOR_OPTIONS.followDuration` 默认 `0`（精确跟随），`hideNative` 控制系统指针是否隐藏。任意元素通过 `data-cursor="read|open|…"` 定义技术指针的动作标签。视觉由 `--cursor-fill`、`--cursor-outline`、`--cursor-accent`、`--cursor-label-gap` 四个 CSS 变量控制。

## 4. `data-shared-id` 约定

| 类型 | 示例 |
| --- | --- |
| 品牌 | `site:brand` |
| 文章编号 | `post:mysql-index-design:index` |
| 文章封面 | `post:mysql-index-design:cover` |
| 文章标题 | `post:mysql-index-design:title` |
| 发布日期 | `post:mysql-index-design:date` |
| 阅读时长 | `post:mysql-index-design:read` |
| 筛选 | `filter:tag:java` |
| 项目 | `project:mindtype:surface`、`:title`、`:logo`、`:index` |
| 图片 | `media:post-slug:0` |
| 代码 | `code:post-slug:0:surface` |
| 二维码 | `qr:wechat:trigger` |

每个 `data-shared-id` 在单个页面中必须唯一。共享元素移动时使用占位节点保持布局，禁止仅用 opacity/scale 冒充。

## 5. 共享元素转场地图

| 源 → 目标 | 共享 ID | 转场与参数 | 次级动效 | 反向路径 |
| --- | --- | --- | --- | --- |
| 日志编号 → 详情大编号 | `post:{slug}:index` | VT `index` 组：延迟 40ms，580ms，`expo.out` | 字号 9px → 158px，填充变描边，中段旋转 -4° 后回正 | 浏览器返回自动反演 |
| 日志缩略图 → 文章封面 | `post:{slug}:cover` | VT `cover` 组：0ms，620ms | 从 116×73 放大到 100vw×16:9（1440 下约 1425×801），中段上移 42px、放大 4%、亮度回落 | 返回同一几何对 |
| 日志标题 → 文章标题 | `post:{slug}:title` | VT `title` 组：延迟 80ms，520ms | 上移 26px、轻微过冲回正；其余日志行 200ms 淡出下沉 | 返回重放 |
| 日期 / 阅读时长 → 文章元信息 | `post:{slug}:date`、`:read` | VT `chip` 组：0ms，320ms | 先离开编号的放大区域，带 18px 上移与 scale 0.86 回正 | 返回重放 |
| 文章列表 → 详情 / 返回 | `post-list` | 去程 180ms，返回 210ms | 滚动位置恢复 | 浏览器 history |
| 品牌 → 新页品牌 | `site:brand` | VT 620ms，`brand` 组关闭自身动画 | 导航固定 | 自动反演 |
| 项目行 → 工程记录浮层 | `project:{id}:surface` | Flip 400ms 展开 / 280ms 返回；`expo.out + absolute + nested` | 编号长成 180px 水印，详情行 420ms stagger | 同一节点移回占位元素 |
| 社交图标 → 二维码 | `qr:{id}:trigger` | Flip 280ms | 二维码内容 160ms 淡入 | 关闭反向 |
| 标签 → 筛选栏 | `filter:tag:{tag}` | Flip 220ms | 不匹配行 120ms 淡出 | clear / 浏览器返回 |
| 图片 → 灯箱 | `media:{slug}:{index}` | Flip 280ms | 圆角、边框同步 | 关闭反向 |
| 代码块 → 全屏 | `code:{slug}:{index}:surface` | Flip 280ms | 工具栏与行号一起移动 | 关闭反向 |
| 复制 → 完成态 | 不共享 | 即时文本切换 | 1600ms 后恢复 | 不适用 |

摘要和标签不做几何飞行：它们与封面、编号的路径重叠，飞行中会横穿封面。二者在落地后由 GSAP 以 520ms、40ms stagger 跟随淡入，作为转场的收尾而不是第二段飞行。

## 6. 动效参数表

| 场景 | 触发 | 属性 / 工具 | 时长、缓动与节奏 |
| --- | --- | --- | --- |
| 平滑滚动 | 滚轮 | Lenis + `gsap.ticker` | `lerp 0.1`；触摸端不启用 |
| 首屏标题 | 首次加载 | 字符 `rotateX(-82°)` + y + opacity | 1050ms，stagger 45ms，`expo.out` |
| 首屏正文元素 | 首次加载 | y 18px + opacity | 620ms，stagger 60ms |
| 终端入场 | 首次加载 | `clip-path` + x/y | 1100ms，`expo.out` |
| 首屏光球 | 首次加载 + 指针 | 缩放淡入；`quickTo` 位移；9s yoyo 漂浮 | 1800ms 入场；视差 900ms |
| 章节标题 | 滚动进入 | 字符 mask + y + rotate | 720ms，stagger 19ms |
| 日志行 | 滚动进入 | y 22px、封面 clip-path、文本 10px | 620 / 780 / 420ms |
| 项目、关于区块 | 滚动进入 | y 20px + opacity | 620ms；`toggleActions` 可逆 |
| 宣言章节 | 滚动 | 22 个词 opacity + y；进度线；光晕位移 | 280vh，`scrub 0.55`，词 stagger 140ms |
| 技术栈跑马灯 | 常驻 + 滚动速度 | `xPercent: -50` 循环 + `timeScale` | 34s 基础周期；滚动时最高 3.4× |
| 页脚跑马灯 | 常驻 + 滚动速度 | 同上，描边字 | 26s 基础周期 |
| 列表速度倾斜 | 任意滚动 | `skewY` quickTo | ±2.2°，500ms 回正 |
| 缩略图倾斜 | 指针悬停 | `rotationX/Y` quickTo | ±7° / ±10°，500ms |
| 状态追踪 | 滚动 | 5 段状态 + 进度线 + 代码行 | 255vh 滚动距离，`scrub 0.9` |
| 正文标题 / 引用 | 滚动进入 | y 22px + opacity | 650ms，可逆 |
| 项目浮层 | 点击 | Flip 尺寸/位置/圆角 | 展开 400ms `expo.out`；返回 280ms `power3.inOut` |
| 项目详情 | 展开后 | y 16px + opacity，逐条 | 420ms，stagger 45ms |
| 路由转场 | 站内导航 | View Transitions，按 class 分组 | 封面 620ms、编号 580ms、标题 520ms、chip 320ms；延迟 0/40/80/0ms；桌面 `expo.out`，移动 420ms |
| 文章收尾 | 转场落地后 | 摘要与标签 y 16px + opacity | 520ms，stagger 40ms |
| 可选技术指针 | 显式启用 | 1:1 `x/y` 定位；动作标签 | 0ms 跟随；按压 100–160ms |
| 顶栏滚动进度 | 任意滚动 | `scaleX` | 1:1 跟随，无缓动 |
| 章节 rail | 首页滚动 | 当前区块高亮 | 160ms |
| 目录联动 | 标题越过视口上沿 | 边框与颜色 | 160ms |
| 命令面板 | Ctrl K | opacity + scale + y | 140ms |
| 复制链接 / 代码 | 点击 | 文本状态 | 即时，1600ms 恢复 |

## 7. 正向与反向链路

1. **路由链**：`ViewTransitions` 自动保留旧/新快照，返回时同一组 name 反向插值；旧浏览器由 `pagehide` 保存矩形后反向恢复。
2. **浮层链**：打开前捕获源节点几何，关闭时先捕获当前几何，再把真实节点移回占位元素并反向 Flip。
3. **滚动叙事链**：状态追踪是由 `scrub` 驱动的唯一时间轴；从 0→1 正向播放，从 1→0 倒放。自动化验证中 `03 → 05 → 03`，状态、计数器和代码高亮同步回退。
4. **段落链**：标题、日志行和 reveal 使用 `toggleActions: play none none reverse`，滚回触发点上方会反向收束。
5. **中断清理**：快速重复触发时 `Flip.killFlipsOf`、`gsap.killTweensOf`、`AbortController`、`gsap.context().revert()` 负责终止旧链，不叠加。

## 8. 文字动画与无障碍

- `Intl.Segmenter` 按词拆分，再按字建立 mask；英文单词不会被任意断行。
- 原元素写入完整 `aria-label`，拆分字符统一 `aria-hidden="true"`，屏幕阅读器不会逐字朗读。
- 文本拆分在所有页面启用；路由切换或销毁时 `context.revert()` 会清除位移，文本保持可见。
- `prefers-reduced-transparency`、`prefers-contrast` 与焦点环继续生效。

## 9. 动效策略

- 站点固定 `data-motion="full"`，不提供偏好切换；启动时清除旧的 `matcha:motion` 存储。
- 完整动效覆盖系统低动效：启用 Lenis、GSAP 场景和完整共享转场；技术箭头指针默认启用，删除 `data-cursor="technical"` 可恢复原生指针。
- 低动效 CSS / JS 分支保留为防御代码，但正常入口不会触发。
- 无 JavaScript 时内容仍然完整可见；所有场景动画只增强，不承载内容。

## 10. 性能边界

- 动画属性限定为 `transform`、`opacity`、`clip-path`；不逐帧改布局尺寸。
- 关于区块的 reveal 只在进入/离开时切换，不做持续循环。
- 状态追踪只使用一个 scrub 时间轴，节点数量固定为 5。
- 两条跑马灯和一个宣言场景是主要的持续动效；跑马灯只改 `xPercent`，宣言只改文字的 `opacity/y`。
- 全幅封面是 1600×900 的 SVG，`object-fit: cover` 在 16:9 容器内不产生二次裁切；7 张封面共约 60 KB。
- Lenis 在页面切换前销毁；ScrollTrigger 由 `gsap.context` 统一清理；速度监听只有一个全局实例。
- 无粒子、无全屏滚动劫持、无 WebGL、无多层滚动视差；软总线使用 2D Canvas，最多 5 个节点和 12 个数据包，按约 30fps 节流，并在页面不可见时暂停。

## 11. 验证记录

- `npm run build`：11 个静态路由（含 404，7 篇文章）构建通过；`npm run check`：0 errors / 0 warnings / 1 hint。
- 完整动效：首屏 6 个拆分字符、22 个宣言词、2 条跑马灯、Lenis、状态追踪、软总线 Canvas 与滚动进度全部启动；技术箭头指针默认启用。
- 极客层：CRT 扫描线 / beam / 噪点 / 暗角常驻；开机自检每会话一次，可点击或按键跳过；`bus` 命令触发软总线全节点脉冲；Konami 序列切换磷光绿主题。
- 移动端交互：触点涟漪、卡片与标签独立 `scale` 按压、项目详情底部 sheet 下拉关闭、路由 8px 落位、终端新行 180ms 入场。
- 触摸无障碍：涟漪标记 `aria-hidden`；sheet 使用 `role="dialog"`、`aria-modal`、`aria-keyshortcuts="Escape"`，焦点落在关闭按钮并在弹层内循环；Escape、关闭按钮或下拉均可退出，关闭后焦点回到触发按钮；拖拽把手与关闭按钮触控高度均为 44px。
- 状态追踪：中段 `03 / mutated`，终点 `05 / painted`，滚回中段恢复 `03 / mutated`。
- 路由返回：文章列表滚动位置从 `574` 恢复到 `574`。
- 共享元素：7 篇文章 × 5 类文章共享项，加上品牌与根快照，首页共 37 个转场名称、全部唯一；文章页 7 个；转场中段无旧页文字叠影。
- 路由起势：点击后 110ms 内非目标日志行淡出下沉、目标行保留实体高亮，随后进入分组飞行；摘要和标签在落地后 520ms 跟随淡入。
- 飞行分组实测：`cover` 620ms、`index` 580ms（延迟 40ms）、`title` 520ms（延迟 80ms）、`chip` 320ms；编号落地 184px；封面从 116×73 放大到 1425×802 后无二次淡入。
- 宣言章节：背景 `#e9edf5`，章节 rail 自动反相；中段计数 `03 / 03`，22 个词中 19 个已点亮，进度线与光晕同步。
- 速度反馈：列表 `skewY` 最大 2.2°，停止后回到 0；缩略图悬停产生约 4° / 5° 的 3D 倾斜。
- 动效策略：固定 `data-motion="full"`；低动效分支仅作为防御代码保留，正常入口不会触发。
- 指针：默认创建技术箭头 `.cursor` 层并启用 `has-custom-cursor`；`READ` / `OPEN` / `inspect` 作为动作标签。删除 `<html data-cursor="technical">` 即回到系统指针。
- 项目浮层：编号放大到 180px 描边水印，详情行依次进入；关闭走 280ms 反向 Flip。
- 响应式：1440 / 1280 / 1024 / 390 均无横向溢出；1920 内容列 1440、标题 132px、终端 540px；1536 标题 115.6px；1024 标题 76.7px；390 文章全幅封面 390px，标题 54.6px；1366×768 首屏高度 598px，跑马灯完整可见；章节 rail 仅在 ≥1400px 显示。
- 深浅色：系统深色 → `#06080d`，切换浅色 → `#f2f5fa`；`matcha:theme` 跨路由保持，按钮 `aria-pressed` / `aria-label` 同步；390px 主题按钮与命令按钮均为 44px；浅色封面 `invert(1)`，终端 / 代码块保留夜间令牌；减少透明度时遮罩 `#dfe4ec`。正文对比度 17.1:1；弱化文字深色 4.7:1、浅色 5.3:1；rail 激活态深色 6.1:1、浅色 17.1:1。
- 浅色动效：自检屏 `#f2f5fa` 纸面 + 54px 蓝图网格；滚动 800px 后网格偏移 40px；封面扫描动画 `light-cover-scan` 720ms；主题涟漪 620ms、描边恒为 1px，结束后节点自动移除；系统减少动效时跳过主题涟漪。
- 1920 文章页：全幅封面 1905×1072，标题单行；1920 宣言三行各占一行，22 词中 19 个点亮。
- 浏览器运行时异常：0；完整动效固定运行，不再提供偏好切换。
