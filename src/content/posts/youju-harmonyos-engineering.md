---
title: "有据：HarmonyOS NEXT 社区应用的工程拆解"
description: "有据的 47 个 ArkTS 页面怎么拆：三段信息流、Scroll 多列、请求序号、401 处理，以及 Push 深链。"
pubDate: 2026-10-14
updatedDate: 2026-10-31
tags: ["HarmonyOS", "ArkTS", "Node.js"]
cover: "/covers/youju-arkts.svg"
coverAlt: "HarmonyOS 设备、信息流卡片与星图圈子组成的工程拆解封面"
featured: false
draft: false
---

有据是一个 HarmonyOS NEXT 原生的体验分享社区：用户发布结构化帖子，标签聚合成圈子并以星图呈现，首页有推荐、关注、每日一帖三段信息流。客户端有 47 个 `.ets` 页面，服务端是 Express + Prisma + MySQL。仓库在 [GitHub](https://github.com/2697881905/youju) 公开，下面的文件路径和代码都来自当前主分支。

这篇不复述功能清单，而是拆几个真正影响体验的工程选择：信息流怎么分页、为什么不用 `LazyForEach`、点赞态如何跨页一致、401 为什么不能一律跳登录页，以及推送和深链如何不把用户带到错误的地方。

![有据的 HarmonyOS 信息流与星图圈子](/covers/youju-arkts.svg)

## 先分层，再写页面

仓库的结构很直接：`entry/src/main/ets` 下分 `pages`、`components`、`design`、`services`、`models`、`utils`；后端 `backend/src` 分 `routes`、`services`、`middleware`，数据模型集中在 `prisma/schema.prisma`。

页面数量一多，最容易出现的问题是“所有逻辑都写进 build()”。有据的做法是把页面当组合层：页面负责路由、分段和状态编排，卡片、标签栏、评论列表拆成组件，网络请求收进 `services/api.ets`。设计令牌单独放在 `design/tokens`，颜色、间距、圆角、动效不散落在各个页面里。

这不是为了目录好看，而是为了改一处不牵动十处。比如顶栏统一走 `HdsNavigation`，沉浸光感材质由一个 `deviceInfo.apiAvailable('26.0.0')` 门禁控制；低版本设备回退到组件自绘的描边或实色底。门禁不通过时视觉不能坏，这比“多写一个 if”重要。

## 信息流：页码、缓存与请求序号

列表接口是 `GET /v1/posts?page=&limit=&sort=hot|latest|recommend&tag=&author=`。服务端用 Prisma 的 `skip` / `take` 取页，按 `hotScore` 或 `createdAt` 排序；Prisma 模型上也为推荐和对比表建了对应索引。

客户端没有把三页数据塞进一个数组，而是 `@State postsCache: DailyPost[][]`，Swiper 的每个分段只读自己那一份。切回已经看过的分段时，先展示 120 秒的会话缓存（只缓存首屏 `page=1`），再后台刷新；这样不会白屏，也不会把上一页的内容错写到当前页。

真正避免错乱的是请求序号：

```typescript
private fetchSeq: number = 0;

private async fetch(reset: boolean): Promise<void> {
  const seq: number = ++this.fetchSeq;
  this.loading = true;
  try {
    const res = await listPosts({ page: this.page, limit: 20 });
    if (seq !== this.fetchSeq) {
      return; // 期间已有更新的请求，旧响应整体丢弃
    }
    this.setPagePosts(this.feedIndex, reset ? res.list : this.pagePostsOf(this.feedIndex).concat(res.list));
  } catch (e) {
    if (seq !== this.fetchSeq) {
      return;
    }
    this.error = (e as Error).message;
    if (!reset && this.page > 1) {
      this.page -= 1; // 失败页回滚，避免静默跳过一页
    }
  } finally {
    if (seq === this.fetchSeq) {
      this.loading = false; // 被取代的请求不能替新请求关 loading
    }
  }
}
```

`loading` 一个布尔值不够用：下拉刷新时可能还有“加载更多”在途，旧页码回包会把列表拼出重复项；快速切换推荐 / 关注时，旧响应会写进新信息源的槽位。序号让“最后一次发起的请求”拥有写权限，其余响应只能被丢弃。

页码分页在这里是合理选择：用户需要回到前面的位置，数据量也还没有大到深分页不可接受。代价是排序字段变化时可能重复或遗漏。如果以后推荐流的数据量继续增长，可以改为按 `(hotScore, id)` 的游标；但在当前阶段，没必要为了“先进”把前后端都改一遍。

关注流的空态还藏着一个细节：关注数是异步取的，未取到之前不能用默认值 0，否则会先闪一下“你还没有关注任何人”，再变成“关注的人还没发内容”。有据用 `-1` 表示未知、`-2` 表示失败，判别依据没到齐时先渲染加载态。这类三态值比“看起来合理”的默认值更诚实。

## 为什么首页不用 LazyForEach

首页最终用的是 `Scroll` 加多列 `ForEach`，而不是 `WaterFlow` 加 `LazyForEach`。原因不是偏好，而是两个真机问题：

- `WaterFlow` / `List` 的滚动终点会被底部非安全区钳制，最后一张卡容易被截断，露出窗口底色；`expandSafeArea` / `ignoreLayoutSafeArea` 挂在容器上都不解决问题。
- 三段信息流放在 Swiper 里时，`LazyForEach` 的数据源无法按页隔离；滑动过程中相邻页会读到同一份数据，显示成别的分段内容。

`Scroll` 的滚动范围天然到物理屏底；按窗口宽度算 2 / 3 / 4 列，每个列只取“原始下标对列数取模”的帖子，保留瀑布流的紧凑感。代价是失去了虚拟化，列表很长时要自己控制页大小和复用；有据当前每页 20 条，先接受这个代价，再在数据量变化时重新评估。

列表键也来自这段结构：

```typescript
ForEach(
  this.pagePostsOf(seg).filter((_p: Post, idx: number) => idx % this.feedColCount() === colIdx),
  (post: Post, idx: number) => { this.feedPost(post, idx) },
  (post: Post) => seg + '-feed-' + colIdx + '-' + String(post.id ?? '')
)
```

键里包含分段、列下标和帖子 ID。`ForEach` 的 key 生成器必须包含会变化的状态字段；只写 `post.id`，切分段或换列时可能复用错组件。另一个真实坑是 `@Builder` 的参数是值快照：把未读数作为参数传进 builder，数字变了 UI 也不会刷新。红点“点了不变”的首因就是这个，不是状态没更新。

## 点赞：一个进程级仓库

同一张帖子会同时出现在首页、详情、个人主页和“我赞过”。如果每个 `PostCard` 都维护自己的 `@State liked`，首页点赞后详情页不会知道，点赞数会漂移。

有据的 `likeStore` 是一个进程级单例：`postId -> { liked, count }`，组件在 `aboutToAppear` 注册并订阅，点赞时先乐观更新仓库，请求失败再回滚到操作前快照。

```typescript
const prev = likeStore.applyOptimistic(id, willLike);
try {
  if (willLike) {
    await upPost(id);
  } else {
    await cancelUpPost(id);
  }
} catch (e) {
  likeStore.revert(id, prev);
}
```

进入详情或刷新列表后用服务器返回值 `syncFromServer` 校准，避免本地乐观值与服务端长期漂移。组件销毁时取消订阅，账号切换时清空仓库；否则上一个账号的 `liked/count` 会串到下一个账号。

这是 ArkUI V1 严格模式下较稳的跨组件同步方式，不依赖深层 `@Observed`。V2 可以用 `@ObservedV2` + `@Trace` 让多个组件直接观察同一个模型，但缓存失效边界仍然要自己定义：登录、登出、切号、发帖、删帖，都是清空或重建的时机。更细的装饰器边界与值快照问题，见 [ArkTS 状态管理](/posts/harmonyos-arkts-state/)。

## 网络层：一个入口处理所有异常

客户端所有请求都走 `services/api.ets` 的 `request()`：统一拼 `BASE_URL`、带 `Authorization`、10 秒连接与读取超时，最后 `req.destroy()` 释放请求对象。

这里有一个 HarmonyOS 真机特有的坑：`http` 的 `OBJECT` 响应模式在超过约 64KB 时会把 `result` 降级成原始字符串，列表接口约 75KB 就会触发，`code` 字段读不到，所有业务接口都报“请求失败”。有据改用 `STRING` 模式，手动 `JSON.parse`，解析失败再走兜底路径。这不是“多写一层解析”，而是设备行为差异必须被网络层吸收。

401 的处理也分两种语义：

- 本地没有 token 的 401 是“这个动作需要登录”，不能让全局逻辑把登录页压到当前内层页之上；取消登录后用户应该回到原页面。
- 本地有 token 的 401 是“会话过期”，需要清登录态并引导重新登录，否则用户会看起来还登录着，却处处失败。

有据在请求层只写一个 `authExpiredAt` 标记，2 秒节流，避免并发 401 重复触发；真正的清态和跳转由 UI 层监听标记后执行。层与层之间不互相调用清态函数，避免循环依赖。

当前没有单独的 refresh token 流程，token 到期后重新登录。如果以后加刷新，必须做单飞：并发 401 只发起一次刷新，其余请求等待同一个结果；刷新失败再统一登出。否则十个请求同时刷新，会把一次过期变成十次登录请求。

重试也要克制。有据只对连接类错误做最多 3 次自动重试，4xx 直接交给页面；发布包把“后端未启动 / hdc rport”这类开发提示替换成用户能理解的网络文案。错误信息是产品的一部分，不能把调试细节留给审核员和用户。

## 推送与深链：先白名单，再跳转

有据用 Push Kit 获取设备 token，登录后上报并绑定账号；登出或注销前先解绑，再清会话，因为解绑请求本身要带鉴权头。推送权限只在已登录且未授权时申请一次，失败静默降级——推送是增强，不能拖累启动。

通知点击和深链最终都收敛到同一个 `PushRoute`：类型、帖子 ID、评论 ID、通知 ID、私信对方 ID。来源有两类：服务端 `clickAction.data` 平铺进 `want.parameters`，以及 `youju://post/{id}` / `https://youju.chat/post/{id}` 深链。

两条入口都做了白名单：

- 路由类型只接受 `comment/up/mention/bookmark/follow/system/dm/post/user`，其他类型直接丢弃。EntryAbility 是 exported 的，任意应用都能构造 want；不校验类型，就可能被伪造 `type=dm + peerId` 带进指定会话，冒充官方通知。
- https 深链只认 `youju.chat` 域名，其他 host 静默忽略；`youju://` 只解析固定路径和正整数 ID。

待处理路由用 `pendingPushRoute` 加单调递增的 `pushRouteSeq` 两段信号。原因是 AppStorage 对“同一值重复写入”不派发变更；连续点开两条同类型通知，只写路由值不会触发第二次跳转。加一个序号，`@Watch` 才能每次都消费。

## 会话持久化：一次覆盖安装的教训

有据最初用 `PersistentStorage` 持久化登录态，真机覆盖安装后遇到过问题：冷启动读不回旧文件，AppStorage 全部回默认值；用户随后任意一次持久化写入（比如重新同意隐私弹窗）会把默认值整份刷回磁盘，token 和用户信息被清空。

最终会话迁到独立的 `dataPreferences` 文件：启动时同步水合 AppStorage，登录/登出显式 `flushSync` 落盘；token 在 prefs 里不以明文保存，而是和设备 ODID 加随机 nonce 绑定的 keystream 做遮蔽，另在 Asset Store 留一份副本。覆盖安装会清空 Asset Store，所以恢复路径必须以 prefs 为准。

这套方案也有诚实的安全边界：它能防跨设备提取和备份还原，但同设备 root 场景下，ODID 和密钥流都能重算，遮蔽不提供额外保护。真正的结论不是“加密了就安全”，而是先明确威胁模型，再决定哪一层负责什么。

未读红点、圈子引导标记这类即使丢失也能重新拉取的状态，仍留在 `PersistentStorage`。会话和 UI 偏好分开存，是这次迁移里最重要的设计决定。

## 工程细节与发布

有据的仓库里还记录了不少“上线之后才会遇到”的问题：

- 后端路由顺序：`/following` 必须注册在 `/:id` 之前，否则会被当成 `id='following'` 命中详情路由；`/trash`、`/compare` 同理。
- 公开读接口用软鉴权：匿名可浏览，带合法 token 时才按 `viewerId` 打 `myUp/myBookmark`；写接口必须走严格鉴权。
- 错误处理中间件在生产环境会把含 `prisma/sql/jwt/stack` 等内部线索的消息归一化，避免把实现细节返回给客户端。
- Prisma 的索引跟着查询走：推荐流 `[hotScore, status, deletedAt]`，跨帖对比 `[genre, status, deletedAt, metricValue]`。JSON 字段排序吃不到索引，所以可排序的数字被抽成独立列。
- 当前版本 1.0.4，`versionCode` 只增不减；上架版本仍是 1.0.1，版本号和提审包要分开看。

这些细节不会出现在功能演示里，却决定了应用在真机、弱网、账号切换和审核场景下是否稳定。

## 检查清单

- 信息流是否有请求序号？切换分段或刷新时，旧响应会不会写进新列表？
- 分页失败是否回滚页码？加载态是否只由当前请求关闭？
- 列表键是否包含分段、列和业务 ID？`@Builder` 是否误用了值快照参数？
- 跨页共享状态是否有单一仓库？账号切换时是否清空？
- 401 是否区分“需要登录”和“会话过期”？并发刷新是否单飞？
- 推送和深链是否有类型、域名、参数白名单？待处理路由能否连续触发？
- 会话持久化是否在覆盖安装、登出、注销路径都验证过？
- 后端路由顺序、软鉴权、索引和错误脱敏是否覆盖了真实攻击面？

有据的工程价值不在于用了多少新 API，而在于每个“为什么不用”都有真机证据：为什么不用 `LazyForEach`，为什么不用统一 401 跳转，为什么不用 `PersistentStorage` 存会话。把这些取舍写下来，比再做一个页面更有复用价值。
