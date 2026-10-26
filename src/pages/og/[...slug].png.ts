// File: src/pages/og/[...slug].png.ts

import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';

export const prerender = false;

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const rawSlug = params.slug;
  if (!rawSlug) {
    return new Response('Not found', { status: 404 });
  }

  const slug = rawSlug.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '').replace(/^\/|\/$/g, '');
  const postEntry = await getEntry('posts', slug);
  const recipeEntry = postEntry ? undefined : await getEntry('recipes', slug);

  if (!postEntry && !recipeEntry) {
    return new Response('Not found', { status: 404 });
  }

  const heroImage = postEntry
    ? postEntry.data.image || postEntry.data.thumbnailKey
    : recipeEntry?.data.image || recipeEntry?.data.thumbnailKey;

  if (heroImage) {
    const destination = heroImage.startsWith('http') || heroImage.startsWith('/') ? heroImage : `/${heroImage}`;
    return redirect(destination, 302);
  }

  const title = escapeXml(postEntry?.data?.title ?? recipeEntry?.data?.title ?? 'darlalovly');
  const rawExcerpt =
    postEntry?.data?.excerpt ||
    postEntry?.data?.description ||
    postEntry?.data?.seoDescription ||
    recipeEntry?.data?.recipeExcerpt ||
    recipeEntry?.data?.seoDescription ||
    'Daily diary, field notes, and digital garden.';
  const excerpt = escapeXml(rawExcerpt);

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#09090b" />
  <rect x="32" y="32" width="1136" height="566" rx="16" fill="#18181b" stroke="#27272a" stroke-width="2" />
  <text x="80" y="120" fill="#71717a" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" letter-spacing="0.15em">DARLALOVLY</text>
  <text x="80" y="240" fill="#fafafa" font-family="Georgia, serif" font-size="52" font-weight="700">
    ${title.slice(0, 48)}
  </text>
  <text x="80" y="340" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="400">
    ${excerpt.slice(0, 80)}
  </text>
  <circle cx="80" cy="520" r="12" fill="#22c55e" />
  <text x="108" y="527" fill="#71717a" font-family="system-ui, -apple-system, sans-serif" font-size="20">Edge Generated</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};