---
title: "ArkTS 状态管理：让界面跟随数据"
description: "结合有据的真实页面，梳理 ArkUI 状态装饰器的同步方向、@Builder 值快照、ForEach key、跨组件点赞同步、请求序号与持久化边界。"
pubDate: 2025-04-09
updatedDate: 2026-10-31
tags: ["ArkTS", "HarmonyOS", "DevEco Studio"]
cover: "/covers/arkts-state.svg"
coverAlt: "数据、状态与渲染循环组成的 ArkTS 状态管理封面"
featured: false
draft: false
---

声明式 UI 的核心不是“调用方法刷新控件”，而是描述某个状态下界面应该呈现什么。数据发生变化，框架依据依赖关系更新组件。理解这条链路后，状态管理的关键就变成：数据由谁持有、谁能修改，以及子组件如何接收。

在有据这个 HarmonyOS NEXT 社区应用里，首页要在推荐、关注、每日一帖三段信息流之间滑动，帖子卡片又要在首页、详情、个人主页保持点赞态一致。状态一旦复制到多个组件再手动同步，短暂不一致和“点了不变”的问题就会接连出现。

![ArkTS 中数据驱动界面的状态循环](/covers/arkts-state.svg)

## 先确定状态的所有者

只在单个组件内部使用的数据，可以由该组件持有；需要兄弟组件共享的数据，则应提升到共同父组件。把同一份数据复制到多个组件再手动同步，容易产生短暂不一致，也会让事件处理越来越复杂。

有据首页把三页数据放在 `@State postsCache: DailyPost[][]` 里，每个 Swiper 分段只读自己那一份；点赞态则不在 `PostCard` 内部各自维护，而是交给进程级 `likeStore` 单例。前者是页面拥有的缓存，后者是跨页面共享的交互状态。两种数据生命周期不同，所有权也就不同。

还需要区分“界面状态”和“领域数据”。加载中、是否展开、草稿内容属于界面状态；帖子正文、作者、点赞总数属于领域数据。领域数据应从网络层或持久化层来，界面状态则尽量留在使用它的组件里。把两者混在一个大对象里，最终会出现“刷新页面时把用户正在编辑的草稿一起清掉”的问题。

## 装饰器描述的是同步方向

ArkUI V1 的装饰器各有明确职责：

- `@State`：组件内部状态，初始化后可以在事件回调中修改，框架驱动相关 UI 重新渲染。
- `@Prop`：父组件向子组件单向传递，子组件持有本地副本，修改不回写父组件。
- `@Link`：双向同步，子组件可以修改父组件状态；来源必须清晰。
- `@Provide` / `@Consume`：跨层级共享，适合主题、导航模式等横切状态。
- `@Watch`：监听变化并执行副作用，不负责同步本身。
- `@Observed` / `@ObjectLink`：观察类实例的属性变化，用于嵌套对象。

V2 提供了另一套模型：`@ComponentV2`、`@Local`、`@Param`、`@Once`、`@Event`、`@Provider` / `@Consumer`、`@Monitor`、`@ObservedV2` / `@Trace`。新组件可以按当前 SDK 选择 V2，但同一个组件内不要混用两套装饰器；团队里也要统一，否则“这个状态为什么没刷新”会变成装饰器考古。

> 状态装饰器解决的是数据同步方式，不替代组件边界设计；依赖越少，更新路径越容易理解。

## @Builder 参数是值快照

有据的 README 里记过一条真实踩坑：消息页未读红点“点了不变”，首因是 `@Builder` 的参数是值快照。参数传进去时是多少，后续状态变化不会让 builder 重新求值。

```typescript
// 反例：count 作为 builder 参数传入，后续变化不会刷新这段 UI
@Builder
badge(count: number) {
  Text(String(count))
    .fontSize(10)
}

// 正例：在 builder 内直接读响应式状态，依赖关系才会建立
@Builder
badge() {
  Text(String(this.unreadMessageCount))
    .fontSize(10)
}
```

同样的边界也出现在 `@Prop` 上。跨组件传逐帧动画参数时，用标量 `@Prop` 比传数组更可靠；数组引用不变时，子组件未必能感知内部变化。需要复杂对象时，明确观察层级，或者把可变字段拆成独立标量。

## 数组与对象：替换外层，别原地改

状态变量可观察，不等于所有嵌套变化都会自动传播。ArkTS 不观察数组元素的原地修改。有据首页在追加帖子时，没有直接 `this.postsCache[seg].push(...)`，而是重建外层数组：

```typescript
private setPagePosts(seg: number, list: DailyPost[]): void {
  const next: DailyPost[][] = [[], [], []];
  for (let i: number = 0; i < FEED_SEGMENTS.length; i++) {
    next[i] = i === seg ? list : this.pagePostsOf(i);
  }
  this.postsCache = next;
}
```

这不是“多此一举”，而是让状态替换这件事对框架可见。代价是重建外层数组，所以只应在页级数据变化时做，而不是在每个输入框的每次按键上做。

对象属性也是同理：只改 `post.liked = true`，普通类实例不会触发 UI；使用 `@Observed` 类配合 `@ObjectLink`，或者不可变更新，创建新对象替换旧值。若确实需要深层观察，就建立明确的类与装饰器关系，不要靠强制重建整个页面绕过问题。

## 跨组件共享：单例加订阅

有据的点赞态最初只存在每个 `PostCard` 和详情页各自的 `@State` 里，首页点赞后，详情页的同一帖子不知道，点赞数会漂移。最终方案是一个进程级 `likeStore`：保存 `postId -> { liked, count }`，组件在 `aboutToAppear` 注册并订阅，点赞时先乐观更新仓库，请求失败再回滚。

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

这是 ArkUI V1 严格模式下较稳的跨组件同步方式：不依赖深层 `@Observed`，每个卡片只把仓库的最新值写回本地 `@State`。代价是必须管理订阅生命周期，组件销毁时取消订阅；账号切换时还要清空仓库，否则上一个账号的点赞态会串到下一个账号。

V2 可以用 `@ObservedV2` 类配合 `@Trace` 字段，让多个组件直接观察同一个模型。但无论哪套机制，缓存都要有明确的失效边界：登录、登出、切号、发帖、删除帖子，都是必须清空或重建的时机。

## 列表需要稳定身份

渲染列表时，唯一键用于帮助框架识别数据项。键应来自稳定且唯一的业务标识，而不是会随插入、删除变化的数组下标。身份混乱可能造成组件状态错位，例如输入内容跟随错误的数据项。

有据首页使用 `Scroll` 加多列 `ForEach`，而不是 `WaterFlow` 加 `LazyForEach`。原因有两个：`WaterFlow` / `List` 的滚动终点会被底部非安全区钳制，末卡容易被截断；三页 Swiper 下 `LazyForEach` 的数据源又无法按页隔离，滑动时相邻页会读到同一份数据。用 `Scroll` 显式多列后，每列独立排列，滚动范围到物理屏底，每页只读自己的缓存。

代价是要自己处理分页和复用。帖子键包含分段、列下标和帖子 ID：

```typescript
ForEach(
  this.pagePostsOf(seg).filter((_p: Post, idx: number) => idx % this.feedColCount() === colIdx),
  (post: Post, idx: number) => { this.feedPost(post, idx) },
  (post: Post) => seg + '-feed-' + colIdx + '-' + String(post.id ?? '')
)
```

键里包含会变化的分段和列，账号切换或列表重建时才不会错误复用旧组件。若列表项内部还有本地状态，更要区分“数据身份”和“界面状态”；删除一项后，框架应准确销毁对应组件，而不是把旧状态复用到下一项。

## 异步结果也要回到状态

网络请求和定时任务只负责产生结果，界面仍应通过统一状态读取 loading、data 与 error。比“多个布尔值”更可靠的是请求序号：每次发起自增，响应回来时若序号已落后，就整体丢弃。

```typescript
private fetchSeq: number = 0;

private async fetch(reset: boolean): Promise<void> {
  const seq: number = ++this.fetchSeq;
  this.loading = true;
  try {
    const res = await listPosts({ page: this.page, limit: 20 });
    if (seq !== this.fetchSeq) {
      return;
    }
    this.setPagePosts(this.feedIndex, reset ? res.list : this.pagePostsOf(this.feedIndex).concat(res.list));
  } finally {
    if (seq === this.fetchSeq) {
      this.loading = false;
    }
  }
}
```

这段逻辑解决了两类真实问题：下拉刷新时仍有“加载更多”在途，旧页码回包会把列表拼出重复项；快速切换推荐 / 关注时，旧响应会写进新信息源的槽位。仅靠 `loading` 布尔值无法区分“当前请求”和“被取代的请求”，序号可以。

分页失败还要回滚页码。`loadMore` 先 `page += 1` 再请求，失败不回滚会让那一页被静默跳过；错误提示只在列表为空时可见，非空列表下用户根本不会发现少了一页。

## 登录态与持久化

有据把登录态放在 `AppStorage`，通过 `@StorageLink('authToken') @Watch('onTokenReady')` 驱动关注流补加载。这里有一个时序问题：`@StorageProp` 的初值在冷启动水合前不可信，已登录用户可能先看到游客引导条。所以 `aboutToAppear` 里会直接读一次 `getToken()` 兜底，后续变化仍交给装饰器驱动。

更关键的是持久化选择。有据在真机上遇到过覆盖安装后 `PersistentStorage` 读不回旧文件的问题：AppStorage 全部回默认值，用户随后任何一次持久化写入都会把默认值整份刷回磁盘，登录态被清空。最终会话迁到独立的 `dataPreferences` 文件，启动时同步水合、登录/登出显式落盘，并在 Asset Store 留一份加密副本；`PersistentStorage` 只保留未读红点、引导标记这类即使丢失也能重新拉取的非关键 UI 态。

这条经验比任何装饰器口诀都重要：**决定什么该持久化，比决定用什么装饰器更难。** 大列表、临时筛选条件、一次性的弹窗状态都不应塞进全局存储；会话、草稿和用户设置才需要明确的落盘策略。

## 检查清单

- 状态是否有唯一所有者？兄弟组件共享的数据是否提升到了共同父组件？
- 子组件是展示型还是可写型？`@Prop`、`@Link` 和回调的边界是否清楚？
- `@Builder` 是否直接读取响应式状态，而不是依赖值快照参数？
- 数组更新是否替换了外层引用？对象深层变化是否有明确的观察机制？
- 列表键是否包含会变化的业务与界面字段？是否避免了数组下标？
- 异步请求是否有序号或取消机制？分页失败是否回滚？
- 登录、登出、切号时，跨组件缓存是否清空？
- 持久化的是会话和设置，还是把整个列表也塞进了全局存储？

状态管理做得好，界面分支会更少，测试数据流也比检查控件是否刷新更直接。像有据这样页面数量多的应用，真正省时间的不是多写几个装饰器，而是让每份状态只有一个合理的家。
