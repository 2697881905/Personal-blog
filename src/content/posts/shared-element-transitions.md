---
title: "共享元素转场：连接两个页面"
description: "这个博客的文章共享转场：命名、捕获时机、尺寸差和中断处理，重点是怎么避开二次淡入和叠影。"
pubDate: 2025-05-21
updatedDate: 2026-10-31
tags: ["JavaScript", "CSS", "Astro", "Vue"]
cover: "/covers/shared-elements.svg"
coverAlt: "两个页面线框通过共享图片元素连接的转场设计封面"
featured: false
draft: false
---

页面切换不一定意味着视觉上下文必须消失。列表中的封面进入详情页时，如果图片能够连续地移动并改变尺寸，用户就更容易理解两个页面之间的关系。共享元素转场的价值在于保持空间线索，而不是给每次点击附加炫技动画。

![共享元素在两个页面之间连续移动](/covers/shared-elements.svg)

## 先选对共享对象

适合共享的元素通常具有稳定身份，例如商品图片、文章封面或用户头像。它们在旧页面和新页面中代表同一对象，只是布局和尺寸不同。按钮、装饰线等通用元素未必需要共享，否则动画会增加噪音。

View Transitions API 用 `view-transition-name` 标记需要独立捕获的元素。名称在当前页面中必须唯一；列表渲染时可以拼接数据标识，但不要让一屏内二十个条目同时拥有转场名称。

```css
.post-cover {
  view-transition-name: var(--cover-name);
  object-fit: cover;
}

::view-transition-group(*) {
  animation-duration: 420ms;
  animation-timing-function: cubic-bezier(.2, .7, .2, 1);
  overflow: clip;
}
```

这个博客在列表行和文章页之间共享编号、封面和标题。编号从 9px 变成 158px，封面从缩略图变成横幅，标题保持同一身份。共享元素在转场期间不再播放入场动画，否则会出现二次淡入和叠影。

## 在 DOM 更新前后捕获状态

浏览器需要知道旧状态何时结束、新状态何时开始。`document.startViewTransition` 的回调里应完成 DOM 更新，并等到新布局真正可用后再结束。

```javascript
async function updateWithTransition(updateView) {
  if (!document.startViewTransition) {
    await updateView();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateView();
    await document.fonts.ready;
  });

  try {
    await transition.finished;
  } catch {
    // 转场被跳过或被打断，不影响已经完成的页面更新。
  }
}
```

回调里不要等待网络请求。数据应在开始转场前准备好，否则旧页面快照会长时间冻结。字体和首屏关键图片可以等待，但不要把所有图片都 `decode()` 一遍；等待越久，用户越容易觉得页面卡住。

`ready`、`updateCallbackDone` 和 `finished` 三个 Promise 需要区分：`ready` 表示旧快照已捕获、动画即将开始；`updateCallbackDone` 表示 DOM 更新完成；`finished` 表示动画结束。DOM 更新失败和动画被取消是两件事，不能把取消当成业务错误，更不能因为动画失败就回滚页面状态。

Vue 里通常在回调中等待 `nextTick()`，确保 DOM 已经渲染。Astro 的 `<ViewTransitions />` 会为站内导航接管同样的原生能力，旧浏览器则走普通跳转。跨文档转场还需要 `@view-transition { navigation: auto; }`，并确认同源与浏览器支持范围。

## 伪元素：到底是谁在动

一次转场会生成一棵伪元素树：`::view-transition-group(name)` 负责位置和尺寸，`::view-transition-image-pair(name)` 包住新旧两张图，`::view-transition-old(name)` 和 `::view-transition-new(name)` 负责内容本身。默认情况下，group 做几何插值，old 和 new 做交叉淡化。

如果新旧页面都播放完整入场动画，用户会看到两层文字叠在一起。这个博客的处理是让根快照立即退场，只保留共享元素的运动：

```css
/* 页面底色与正文不做交叉淡化，避免旧页文字叠影 */
::view-transition-old(root) {
  animation: none;
}

::view-transition-new(root) {
  animation: none;
}

/* 共享封面保留短促的透明度过渡，几何移动由 group 负责 */
::view-transition-old(cover) {
  animation: 140ms ease-out both fade-out;
}

::view-transition-new(cover) {
  animation: 200ms ease-out both fade-in;
}
```

不要随意覆盖 group 的 `transform`。浏览器已经根据新旧矩形计算了位移和缩放，手动再写一套很容易出现起点或终点偏移。需要调整节奏时，优先改 `animation-duration`、`animation-timing-function`，而不是重写几何。

`overflow: clip` 可以避免元素在动画期间撑出滚动条。`view-transition-name: none` 用于明确排除不需要参与转场的元素。`view-transition-class` 可以把一组共享元素归到同一类，减少重复选择器；使用前确认目标浏览器支持。

## 尺寸、裁切与内容差异

共享图片从缩略图变成横幅时，宽高比可能不同。使用 `object-fit: cover` 保持裁切规则一致，并检查源图和详情图的加载时机。若旧图尚未加载，过渡可能捕获空白；若新图分辨率不足，放大过程又会暴露清晰度问题。

文字也需要克制。标题换行、字体加载和容器宽度变化都会造成抖动。可以只对封面做共享，让标题使用简单淡入；不必把所有同名元素都加入同一动画。默认的交叉淡化和位移动画通常已经足够，复杂关键帧应服务于明确的层级关系。

移动端还要检查浏览器工具栏伸缩和安全区变化。视口尺寸在转场期间改变时，元素终点可能与静态布局不同。尽量使用稳定容器，并在常见屏幕方向下测试；发现跳动时，减少参与过渡的元素通常比继续叠加修正动画更有效。

## 取消、降级与快速点击

用户可能快速连续点击，也可能在动画途中返回。过渡对象提供 `skipTransition()`，可在新导航到来时主动结束当前动画。不要用 `preventDefault()` 阻止正常导航，只为等动画播完；导航语义永远优先于视觉效果。

基础导航必须在没有 API、脚本执行失败或资源加载缓慢时仍然可用。特性检测通过后直接更新 DOM，是成本最低的降级路径；对跨文档转场还要保留普通页面跳转作为默认行为，而不是先建立一套无法降级的交互依赖。

准备在 `finished.catch` 里吞掉取消错误，但要保留日志或计数，便于区分“用户快速操作”和“代码异常”。如果发现共享元素在中断后残留，先检查是否移动了真实 DOM 节点却没有恢复占位，而不是继续叠加 `setTimeout` 清理。

## 尊重减少动态效果偏好

部分用户会因大幅缩放和移动感到不适。通过 `prefers-reduced-motion` 缩短或移除位移动画，保留即时切换或轻微透明度变化。CSS 里可以统一缩短 duration，但更稳妥的做法是在 JS 里检测到减少动效时直接更新，不创建转场。

```javascript
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion || !document.startViewTransition) {
  await updateView();
} else {
  // 正常走共享元素转场
}
```

最后检查键盘焦点、标题播报与浏览器返回行为。转场结束后把焦点移到新页面标题或主内容，标题元素可以临时设置 `tabindex="-1"` 并用 `focus({ preventScroll: true })`；不要在动画途中抢焦点，也不要把焦点留在已经消失的旧节点上。必要时用 `aria-live` 播报页面变化，保留浏览器原生的返回与滚动恢复。

## 调试与验收

- 用 DevTools 的 Animations 面板放慢转场，确认 group 的起点和终点矩形。
- 检查页面内是否有重复的 `view-transition-name`；重复名称会让相关元素无法按预期参与过渡。
- 在转场中段截图，确认没有旧页文字叠影、图片空白或边框错位。
- 模拟 `prefers-reduced-motion`，确认内容仍然立即出现。
- 测试浏览器返回、快速连续点击、移动端 390px 与横竖屏切换。
- 用 `document.getAnimations()` 检查是否残留动画；必要时在导航前调用 `skipTransition()`。

视觉连续只是体验的一部分。只有导航语义、焦点顺序、降级路径和减少动效偏好同样可靠，共享元素转场才是真正完整的页面连接方式。
