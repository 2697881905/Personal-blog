---
title: "Astro 静态站点部署：从 dist 到 Nginx 的可回滚发布"
description: "以这个博客为例，把 Astro 的静态构建落到 Nginx：产物验证、缓存分层、容器化、原子切换和回滚。"
pubDate: 2026-10-22
updatedDate: 2026-10-31
tags: ["Astro", "Nginx", "Docker", "Linux"]
cover: "/covers/astro-deploy.svg"
coverAlt: "构建产物、Nginx 与发布目录组成的静态部署封面"
featured: false
draft: false
---

静态站点没有应用服务器，不代表部署不需要设计。构建产物怎么验证、HTML 和静态资源缓存多久、发布时如何避免新旧文件混在一起、出问题后多久能回滚，这些问题在第一次上线时就会遇到。

这个博客用 Astro 的静态输出，构建结果是一组 HTML 和带哈希的资源文件。它比 MindType 那种 Docker Compose 加 Nginx 反代的全栈服务简单得多，但缓存与发布的基本问题是一样的。

![Astro 构建产物经过 Nginx 到达浏览器](/covers/astro-deploy.svg)

## 先看懂构建产物

`astro build` 会把页面输出到 `dist/`。默认按目录格式生成，文章路由通常对应 `dist/posts/<slug>/index.html`；`public/` 下的文件原样复制；`src` 里被引用的脚本、样式和字体进入 `dist/_astro/`，文件名带内容哈希。

```bash
npm ci
npm run check
npm run build
npm run preview
```

`preview` 用于本地检查路由和资源路径，但它不是生产环境的 Nginx。上线前至少确认：

- 首页、笔记列表、now 和每篇文章都能打开，末尾斜杠行为一致。
- `_astro` 资源返回 200，字体没有 404，封面与二维码路径正确。
- 不存在的路径返回 404，而不是意外落到首页。
- 构建使用的 Node 版本与 CI / 服务器一致，锁文件已提交。

这个仓库的 `astro.config.mjs` 开启了 `prefetchAll` 和 `viewport` 预取。它会让站内链接在进入视口时提前请求，对内容站通常有益，但移动端会多出一些流量；如果更在意首屏带宽，可以改成按需预取，或只对文章列表启用。

## Nginx 的最小配置

静态站点的核心是 `try_files` 和缓存头。下面的配置把 HTML 设为可重新验证，把带哈希的 `_astro` 资源设为长期缓存，把封面、Logo 这类不带哈希的文件设为较短缓存：

```nginx
server {
    listen 80;
    server_name example.com;
    root /srv/www/matcha/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-cache" always;
    }

    location /_astro/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location ~* \.(?:svg|png|jpg|jpeg|webp|woff2)$ {
        add_header Cache-Control "public, max-age=604800" always;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

`no-cache` 不是“不缓存”，而是允许缓存但每次使用前重新验证；配合 ETag，未变化的 HTML 仍然可以返回 304。`_astro` 文件名带内容哈希，内容一变文件名就变，因此可以放心用 `immutable`。封面和 Logo 文件名不带哈希，缓存 7 天意味着改图后同一 URL 可能短时间仍是旧图；要么换文件名，要么缩短 TTL。

安全头建议抽成 snippet，在每个 `location` 里 `include`。Nginx 的 `add_header` 有继承规则：子级 `location` 一旦出现 `add_header`，父级的同类指令不会自动继承，直接把安全头写在 `server` 块里、又在 `location` 里写缓存头，容易悄悄丢掉安全头。

如果要做自定义 404，先创建 `src/pages/404.astro`，再配置 `error_page 404 /404.html;`；不要直接指向一个不存在的文件。Astro 的静态输出不会自动生成 404 页面，除非你显式添加。

## 缓存分层与版本偏移

发布时最容易忽略的是“旧 HTML 引用新资源”或“新 HTML 引用旧资源”。带哈希的资源可以解决后者：新 HTML 引用新文件名，旧 HTML 引用旧文件名，只要旧文件还在，就不会 404。

因此发布目录要保留上一版资源，而不是构建完直接覆盖。回滚时切回旧目录，旧 HTML 和旧资源仍然成对存在。CDN 场景下，HTML 需要短缓存或主动刷新，`_astro` 资源可以长期缓存；不要为了发版把所有资源都清一遍，那会让回滚也失去缓存优势。

封面、二维码这类不带哈希的公共资源，最好在内容变化时改文件名，或者接受一个较短的缓存窗口。把它们设成一年 `immutable`，改图后用户看到的仍是旧图，这类问题很难靠“再刷新一次”解释清楚。

## 容器化与不可变镜像

如果不想在宿主机上装 Node，可以用多阶段构建：第一阶段编译，第二阶段只保留 Nginx 和 `dist`。

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run check && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
```

镜像标签用提交 SHA，而不是 `latest`。这样线上跑的是哪一版可追溯，回滚也有明确目标。`.dockerignore` 要排除 `node_modules`、`dist`、`.git` 和本地环境文件，避免把无关内容打进构建上下文。

容器化并不自动带来原子发布。单容器替换仍有短暂不可用；需要零停机时可以保留上一版容器，切换 Nginx upstream 或反向代理端口，确认健康检查通过后再停止旧容器。静态站点通常没有长连接，短暂切换的代价比全栈服务小，但仍然要避免“构建中覆盖线上目录”。

## 原子发布与回滚

推荐用版本目录加 `current` 符号链接：

```text
/srv/www/matcha/
├── releases/
│   ├── 1a2b3c4/
│   └── 5d6e7f8/
└── current -> releases/5d6e7f8
```

先把新版本完整写入 `releases/<sha>`，再原子替换 `current` 链接；Nginx 的 `root` 始终指向 `current`。下面的脚本省略了构建和传输细节，重点是切换顺序：

```bash
#!/usr/bin/env bash
set -euo pipefail

SHA="$(git rev-parse --short HEAD)"
ROOT="/srv/www/matcha"
TARGET="$ROOT/releases/$SHA"

mkdir -p "$TARGET"
rsync -a --delete dist/ "$TARGET/"

ln -sfn "$TARGET" "$ROOT/.current-next"
mv -Tf "$ROOT/.current-next" "$ROOT/current"

nginx -t
systemctl reload nginx

curl -fsS https://example.com/ >/dev/null

ls -1dt "$ROOT"/releases/* | tail -n +4 | xargs -r rm -rf
```

`ln -sfn` 先创建临时链接，再用 `mv -Tf` 替换，避免 `ln` 内部先删后建造成的短暂空窗。`nginx -t` 在 reload 前执行；健康检查失败时保留旧版本目录，手动把 `current` 切回去即可。只保留最近三个版本，既能回滚，也不会无限占用磁盘。

回滚不是“重新构建旧提交”的同义词。重新构建可能因为依赖或数据变化得到不同产物；保留旧 release 目录，才能回到当时真正上线的文件。

## CI 与验收

持续集成里至少跑三步：`npm ci`、`npm run check`、`npm run build`。构建产物可以作为 artifact 传给部署任务，避免“CI 构建一次、服务器再构建一次”带来的环境差异。部署前做一次快速验收：

- `curl -I /` 检查 HTML 的 `Cache-Control` 和状态码。
- `curl -I /_astro/<某个资源>` 检查长期缓存头。
- 访问首页、笔记列表、一篇文章、`/now/` 和一个不存在的路径。
- 检查封面、二维码、字体和 `favicon`，这些静态资源最容易在路径调整后漏掉。
- 查看 Nginx access log 的 404 比例和 5xx；发布后的异常通常先出现在这里。

这个仓库目前还有 `netlify.toml`，其中已经给 `_astro` 设置了一年 `immutable`，给 `covers`、`logos`、`qrcodes` 设置了 7 天缓存。自建 Nginx 时照着这套语义迁移即可，不必重新发明一套缓存策略。平台部署和自托管之间，真正需要保持一致的是缓存边界和回滚能力，而不是某一条命令。

## 检查清单

- 构建使用的 Node 版本、锁文件和 CI 是否一致？
- `dist` 的目录格式、末尾斜杠和 404 行为是否在预览环境验证过？
- HTML 是否短缓存，带哈希资源是否长期缓存，公共图片是否有版本策略？
- 发布是否先写完整目录，再原子切换，而不是覆盖线上文件？
- 是否保留上一版资源，回滚是否会重新构建？
- `nginx -t`、健康检查和日志验收是否在发布流程里？
- 缓存头与安全头是否因为 `add_header` 继承规则互相覆盖？

静态部署的目标不是“文件传上去能打开”，而是每次发布都可验证、可回滚，用户不会因为缓存拿到半新半旧的页面。
