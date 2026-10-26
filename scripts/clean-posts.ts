// File: scripts/clean-posts.ts

import fs from 'node:fs/promises';
import path from 'node:path';

const POSTS_DIR = path.resolve(process.cwd(), 'src/content/posts');

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getMarkdownFiles(fullPath)));
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function cleanPostContent(raw: string, filename: string): { content: string; modified: boolean; details: string[] } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    return { content: raw, modified: false, details: [] };
  }

  const [, frontmatter, originalBody] = fmMatch;
  let body = originalBody;
  const details: string[] = [];

  // Extract featured / hero image filename from frontmatter
  const heroMatch = frontmatter.match(/^(?:thumbnailKey|heroImage|image):\s*["']?([^"'\r\n]+)["']?/m);
  const heroKey = heroMatch ? heroMatch[1].trim() : null;
  const heroFilename = heroKey ? path.basename(heroKey) : null;

  // 1. Remove duplicate featured image from markdown body
  if (heroFilename) {
    const escapedName = heroFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove wrapping figure/div containing hero image
    const figRegex = new RegExp(`<figure[^>]*>\\s*<img[^>]*src=["'][^"']*${escapedName}["'][^>]*>.*?</figure>`, 'gis');
    if (figRegex.test(body)) {
      body = body.replace(figRegex, '');
      details.push('Removed duplicate hero <figure>');
    }

    // Remove standalone HTML img tag with hero image
    const imgHtmlRegex = new RegExp(`<img[^>]*src=["'][^"']*${escapedName}["'][^>]*\\/?>`, 'gi');
    if (imgHtmlRegex.test(body)) {
      body = body.replace(imgHtmlRegex, '');
      details.push('Removed duplicate hero <img>');
    }

    // Remove markdown image syntax with hero image
    const mdImgRegex = new RegExp(`!\\[[^\\]]*\\]\\([^)]*${escapedName}[^)]*\\)`, 'gi');
    if (mdImgRegex.test(body)) {
      body = body.replace(mdImgRegex, '');
      details.push('Removed duplicate hero markdown image');
    }
  }

  // 2. Convert standard HTML formatting to Markdown
  // Figures with captions
  body = body.replace(
    /<figure[^>]*>\s*<img[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*\/?>\s*(?:<figcaption>(.*?)<\/figcaption>)?\s*<\/figure>/gis,
    (_, src, alt, caption) => `![${(caption || alt || '').trim()}](${src})`
  );

  // Remaining figures
  body = body.replace(
    /<figure[^>]*>\s*<img[^>]*src=["']([^"']+)["'][^>]*\/?>\s*(?:<figcaption>(.*?)<\/figcaption>)?\s*<\/figure>/gis,
    (_, src, caption) => `![${(caption || '').trim()}](${src})`
  );

  // Standalone images
  body = body.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*\/?>/gi,
    (_, src, alt) => `![${(alt || '').trim()}](${src})`
  );

  // Headings
  for (let i = 6; i >= 1; i--) {
    const headingRegex = new RegExp(`<h${i}[^>]*>(.*?)</h${i}>`, 'gis');
    body = body.replace(headingRegex, (_, text) => `${'#'.repeat(i)} ${text.trim()}\n\n`);
  }

  // Formatting tags
  body = body.replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gis, '**$1**');
  body = body.replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gis, '*$1*');
  body = body.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)');
  body = body.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, block) =>
    block.trim().split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n'
  );

  // Lists
  body = body.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
  body = body.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');

  // Paragraphs and breaks
  body = body.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Remove empty container elements
  body = body.replace(/<\/?(?:div|span|section|article)[^>]*>/gi, '');

  // Decode basic HTML entities
  body = body
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // Normalize excessive vertical whitespace
  body = body.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const modified = body !== originalBody.trim();
  const cleanedContent = `---\n${frontmatter.trim()}\n---\n\n${body}\n`;

  return { content: cleanedContent, modified, details };
}

async function runCleanup() {
  try {
    const files = await getMarkdownFiles(POSTS_DIR);
    console.log(`Auditing ${files.length} posts in ${POSTS_DIR}...`);

    let updatedCount = 0;

    for (const file of files) {
      const relPath = path.relative(process.cwd(), file);
      const raw = await fs.readFile(file, 'utf-8');
      const { content, modified, details } = cleanPostContent(raw, relPath);

      if (modified) {
        await fs.writeFile(file, content, 'utf-8');
        updatedCount++;
        console.log(`[CLEANED] ${relPath} ${details.length > 0 ? `(${details.join(', ')})` : ''}`);
      }
    }

    console.log(`Cleanup complete: ${updatedCount} of ${files.length} posts sanitized to pure Markdown.`);
  } catch (err) {
    console.error('Error executing cleanup:', err);
    process.exit(1);
  }
}

runCleanup();