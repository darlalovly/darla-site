import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Handles dates gracefully to avoid build crashes
const resilientDate = z.union([z.date(), z.string(), z.number()]).optional().transform((val) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
});

const field_notes = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/field_notes" }),
    schema: z.object({
        title: z.string(),
        date: resilientDate,
        
        // Exact category alignment matching sniffcult & your daily activities
        category: z.enum([
            'musings',   // Added for personal thoughts & updates
            'watching',  // Movies, television, entertainment
            'wearing',   // Perfume, SOTD, fashion
            'cooking',   // Kitchen experiments, temporary home cooking
            'tasting',   // Restaurant reviews, local discoveries, dining out
            'sights',    // Regional landmarks, neighborhood spots, photos
            'scents',    // Ambient scents, regional smells
            'thoughts'   // Reflections, personal philosophy
        ]).default('thoughts'),

        // Sniffcult-compatible taxonomies & metadata
        mood: z.array(z.string()).optional(),
        sotd: z.string().optional(), // Scent of the Day
        location: z.string().optional(), // e.g., "Rapid City, SD" or "New Orleans, LA"
        chapter: z.string().optional(), // e.g., "The Dakota Chapter"

        // Media & Excerpt
        thumbnailKey: z.string().optional(),
        image: z.string().optional(),
        excerpt: z.string().optional(),

        // Keeps posts hidden from public site until set to false
        isDraft: z.boolean().optional().default(true),
    })
});

export const collections = {
    field_notes,
};