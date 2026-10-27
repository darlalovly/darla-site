// File: src/content.config.ts

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const resilientDate = z
  .union([z.date(), z.string(), z.number()])
  .optional()
  .transform((val: unknown) => {
    if (!val) return new Date();
    const d = new Date(val as string | number | Date);
    return isNaN(d.getTime()) ? new Date() : d;
  });

const optionalResilientDate = z
  .union([z.date(), z.string(), z.number()])
  .optional()
  .transform((val: unknown) => {
    if (!val) return undefined;
    const d = new Date(val as string | number | Date);
    return isNaN(d.getTime()) ? undefined : d;
  });

const normalizeStringArray = z.preprocess((val: unknown) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) return [val.trim()];
  return [];
}, z.array(z.string()).default([]));

const locationPinSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  label: z.string().optional(),
  address: z.string().optional(),
  url: z.string().optional(),
  mapUrl: z.string().optional(),
  lat: z.union([z.number(), z.string()]).optional(),
  lng: z.union([z.number(), z.string()]).optional(),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
  lon: z.union([z.number(), z.string()]).optional(),
  note: z.string().optional(),
  description: z.string().optional(),
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
    modifiedDate: optionalResilientDate,
    order: z.number().optional(),
    type: z.enum(['entry', 'quote', 'note', 'photo']).default('entry'),
    author: z.string().optional(),
    quoteText: z.string().optional(),
    quoteSource: z.string().optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    categories: z.array(z.string()).optional(),
    subcategories: z.array(z.string()).optional(),
    destinations: z.array(z.string()).optional(),
    state: z.string().optional(),
    mood: normalizeStringArray.optional(),
    tags: normalizeStringArray,
    sotd: z.string().optional(),
    location: z.string().optional(),
    locations: z.array(locationPinSchema).optional().default([]),
    pins: z.array(locationPinSchema).optional(),
    chapter: z.string().optional(),
    thumbnailKey: z.string().optional(),
    heroImage: z.string().optional(),
    image: z.string().optional(),
    gallery: z.array(galleryItemSchema).optional().default([]),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    heroOrientation: z.enum(['landscape', 'portrait', 'square']).optional().default('landscape'),
    heroPosition: z.enum(['top', 'left', 'right', 'none']).optional().default('top'),
    showHeroImage: z.boolean().optional().default(true),
    excerpt: z.string().optional(),
    seoDescription: z.string().optional(),
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
    modifiedDate: optionalResilientDate,
    isDraft: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    heroOrientation: z.enum(['landscape', 'portrait', 'square']).optional().default('landscape'),
    heroPosition: z.enum(['top', 'left', 'right', 'none']).optional().default('top'),
    showHeroImage: z.boolean().optional().default(true),
    thumbnailKey: z.string().optional(),
    cardThumbnail: z.string().optional(),
    recipeThumb: z.string().optional(),
    image: z.string().optional(),
    gallery: z.array(galleryItemSchema).optional().default([]),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    servings: z.union([z.number(), z.string()]).optional(),
    recipeExcerpt: z.string().optional(),
    recipeIngredients: z.string().optional(),
    recipeInstructions: z.string().optional(),
    recipeNotes: z.string().optional(),
    spices: z.string().optional(),
    tags: normalizeStringArray,
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoFocusKeyword: z.string().optional(),
    seoNoIndex: z.boolean().optional(),
  }),
});

export const collections = { posts, recipes };