import type { APIRoute } from 'astro';
import { getPosts, postPath, postTags } from '../lib/posts';
import { site } from '../lib/site';

export const prerender = true;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const baseUrl = configuredSite ?? new URL(site.url);
  const posts = await getPosts();
  const feedUrl = new URL('/rss.xml', baseUrl).href;
  const homeUrl = new URL('/', baseUrl).href;
  const lastBuildDate =
    posts.reduce<Date | undefined>((latest, post) => {
      const candidate = post.data.updated ?? post.data.date;
      return !latest || candidate.valueOf() > latest.valueOf() ? candidate : latest;
    }, undefined) ?? new Date();

  const items = posts.map((post) => {
    const url = new URL(postPath(post), baseUrl).href;
    const categories = postTags(post).map((tag) => `      <category>${escapeXml(tag)}</category>`);

    return [
      '    <item>',
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
      `      <description>${escapeXml(post.data.description)}</description>`,
      ...categories,
      '    </item>',
    ].join('\n');
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(site.title)}</title>`,
    `    <link>${escapeXml(homeUrl)}</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    '    <language>en</language>',
    `    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
