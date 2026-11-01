import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const postItems = posts
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((post) => {
      const plain = post.body
        .replace(/[#>*_`[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 1200);
      return {
        title: post.data.title,
        description: post.data.description,
        href: `/posts/${post.slug}/`,
        kind: 'note',
        meta: post.data.tags.join(' · '),
        search: `${post.data.title} ${post.data.description} ${post.data.tags.join(' ')} ${plain}`
      };
    });

  const pages = [
    { title: '所有笔记', description: `${posts.length} notes, sorted by date`, href: '/posts/', kind: 'index', meta: '~/notes', search: 'notes archive index 文章 笔记' },
    { title: 'Now', description: '最近在做什么、学什么、用什么', href: '/now/', kind: 'page', meta: '~/now', search: 'now current focus uses 现在 近况' },
    { title: '项目', description: '做过的项目与工程记录', href: '/#about', kind: 'page', meta: '~/about', search: 'projects 项目 work ArkTS HarmonyOS 有据 有径 YouJing 行程 旅行' },
    { title: '关于', description: '关于我、技术栈与这个站点', href: '/#about', kind: 'page', meta: '~/about', search: 'about profile stack 关于 技术栈 ArkTS HarmonyOS Java' }
  ];

  return new Response(JSON.stringify([...pages, ...postItems]), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
