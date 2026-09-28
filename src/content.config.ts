import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const field_notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/field_notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum([
      'musings',
      'watching',
      'wearing',
      'cooking',
      'tasting',
      'sights',
      'scents',
      'thoughts',
    ]).default('thoughts'),
    mood: z.array(z.string()).optional(),
    sotd: z.string().optional(),
    location: z.string().optional(),
    chapter: z.string().optional(),
    thumbnailKey: z.string().optional(),
    image: z.string().optional(),
    excerpt: z.string().optional(),
    isDraft: z.boolean().optional().default(false),
  }),
});

export const collections = { field_notes };