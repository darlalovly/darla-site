// File: src/pages/og/[...slug].png.ts

export const prerender = true;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export async function getStaticPaths() {
  const posts = await getCollection('posts').catch(() => []);
  const recipes = await getCollection('recipes').catch(() => []);

  const postPaths = posts
    .filter((p) => !p.data.isDraft && !p.data.draft)
    .map((p) => {
      const slug = (p as any).slug || p.id.replace(/\.(md|mdx)$/, '');
      return {
        params: { slug: `posts/${slug}` },
        props: {
          title: p.data.title || 'Untitled Post',
          category: (p.data as any).category || (p.data as any).type || 'Post',
          type: 'POST',
          date: p.data.date,
        },
      };
    });

  const recipePaths = recipes
    .filter((r) => !r.data.isDraft && !r.data.draft)
    .map((r) => {
      const slug = r.id.replace(/\.(md|mdx)$/, '');
      return {
        params: { slug: `recipes/${slug}` },
        props: {
          title: r.data.recipeName || r.data.title || 'Untitled Recipe',
          category: 'Kitchen Archive',
          type: 'RECIPE',
          date: r.data.date,
        },
      };
    });

  return [
    {
      params: { slug: 'default' },
      props: {
        title: 'darlalovly',
        category: 'Digital Garden',
        type: 'JOURNAL',
        date: undefined,
      },
    },
    ...postPaths,
    ...recipePaths,
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const { title, category, type, date } = props as {
    title: string;
    category: string;
    type: string;
    date?: string | Date;
  };

  const fontRes = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/space-mono@latest/latin-400-normal.ttf');
  const fontData = await fontRes.arrayBuffer();

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase()
    : '';

  const markup = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        color: '#f4f4f5',
        padding: '64px 72px',
        fontFamily: 'Space Mono',
        border: '14px solid #18181b',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #27272a',
              paddingBottom: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    letterSpacing: '0.2em',
                    color: '#a1a1aa',
                  },
                  children: `[ ${type} / ${category.toUpperCase()} ]`,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    letterSpacing: '0.2em',
                    color: '#71717a',
                  },
                  children: formattedDate,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            },
            children: [
              {
                type: 'h1',
                props: {
                  style: {
                    fontSize: title.length > 40 ? '48px' : '62px',
                    lineHeight: 1.15,
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    margin: 0,
                    letterSpacing: '0.03em',
                  },
                  children: title,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px solid #27272a',
              paddingTop: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '22px',
                    letterSpacing: '0.15em',
                    color: '#ffffff',
                    fontWeight: 'bold',
                  },
                  children: 'DARLALOVLY.COM',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    letterSpacing: '0.2em',
                    color: '#71717a',
                  },
                  children: 'STUDIO ARCHIVE',
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(markup as any, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Space Mono',
        data: fontData,
        style: 'normal',
        weight: 400,
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};