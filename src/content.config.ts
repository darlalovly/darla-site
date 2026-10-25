// File: src/content.config.ts

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const resilientDate = z
  .union([z.date(), z.string(), z.number()])
  .optional()
  .transform((val) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  });

const locationPinSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  url: z.string().optional(),
});

const galleryItemSchema = z.union([
  z.string(),
  z.object({
    src: z.string().optional(),
    key: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    date: z.union([z.date(), z.string(), z.number()]).optional(),
  }),
]);

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    date: resilientDate,
    order: z.number().optional(),
    type: z.enum(['entry', 'quote', 'note']).default('entry'),
    author: z.string().optional(),
    quoteText: z.string().optional(),
    quoteSource: z.string().optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    categories: z.array(z.string()).optional(),
    subcategories: z.array(z.string()).optional(),
    destinations: z.array(z.string()).optional(),
    state: z.string().optional(),
    mood: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional().default([]),
    sotd: z.string().optional(),
    location: z.string().optional(),
    locations: z.array(locationPinSchema).optional(),
    chapter: z.string().optional(),
    thumbnailKey: z.string().optional(),
    image: z.string().optional(),
    gallery: z.array(galleryItemSchema).optional(),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    heroOrientation: z.enum(['landscape', 'portrait', 'square']).optional().default('landscape'),
    excerpt: z.string().optional(),
    isDraft: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
  }),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    recipeName: z.string().optional(),
    date: resilientDate,
    isDraft: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    heroOrientation: z.enum(['landscape', 'portrait', 'square']).optional().default('landscape'),
    thumbnailKey: z.string().optional(),
    image: z.string().optional(),
    gallery: z.array(galleryItemSchema).optional(),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    servings: z.union([z.number(), z.string()]).optional(),
    recipeExcerpt: z.string().optional(),
    recipeIngredients: z.string().optional(),
    recipeInstructions: z.string().optional(),
    recipeNotes: z.string().optional(),
    spices: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoFocusKeyword: z.string().optional(),
    seoNoIndex: z.boolean().optional(),
  }),
});

export const collections = { posts, recipes };