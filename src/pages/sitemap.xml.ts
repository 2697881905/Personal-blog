import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const GET: APIRoute = async (context) => {
  const site = context.site ?? new URL(context.request.url).origin;
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const entries = [
    { loc: new URL('/', site).href, lastmod: posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate },
    { loc: new URL('/posts/', site).href, lastmod: posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate },
    { loc: new URL('/now/', site).href },
    ...posts.map((post) => ({
      loc: new URL(`/posts/${post.slug}/`, site).href,
      lastmod: post.data.updatedDate ?? post.data.pubDate
    }))
  ];

  const urls = entries.map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>` : '',
    '  </url>'
  ].filter(Boolean).join('\n')).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
