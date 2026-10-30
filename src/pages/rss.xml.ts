import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import profile from '../data/profile.json';

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const site = context.site ?? new URL(context.request.url).origin;

  return rss({
    title: `${profile.name} · 工程笔记`,
    description: `${profile.name}的个人技术博客，记录 Java 后端、数据库、HarmonyOS 与前端交互。`,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.slug}/`,
      categories: post.data.tags
    })),
    customData: '<language>zh-CN</language>'
  });
};
