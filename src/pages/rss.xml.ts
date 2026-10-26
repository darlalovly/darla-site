// File: src/pages/rss.xml.ts

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts').catch(() => []);
  const recipes = await getCollection('recipes').catch(() => []);

  const publishedPosts = posts
    .filter((p) => !p.data.isDraft && !p.data.draft)
    .map((post) => {
      const slug = (post as any).slug || post.id.replace(/\.(md|mdx)$/, '');
      return {
        title: post.data.title || 'Untitled Post',
        pubDate: new Date(post.data.date),
        description: post.data.excerpt || '',
        link: `/posts/${slug}`,
      };
    });

  const publishedRecipes = recipes
    .filter((r) => !r.data.isDraft && !r.data.draft)
    .map((recipe) => {
      const slug = recipe.id.replace(/\.(md|mdx)$/, '');
      return {
        title: recipe.data.recipeName || recipe.data.title || 'Untitled Recipe',
        pubDate: recipe.data.date ? new Date(recipe.data.date) : new Date(),
        description: recipe.data.recipeExcerpt || recipe.data.seoDescription || '',
        link: `/recipes/${slug}`,
      };
    });

  const items = [...publishedPosts, ...publishedRecipes].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()
  );

  return rss({
    title: 'darlalovly',
    description: 'Personal digital garden documenting roadside history, home recipes, and independent travel.',
    site: context.site || 'https://darlalovly.com',
    items,
    customData: `<language>en-us</language>`,
  });
}